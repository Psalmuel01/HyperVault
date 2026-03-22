// scripts/deploy-all.js
// ─────────────────────────────────────────────────────────────
//  Deploy HyperVault on Polkadot Hub with real DOT token wiring.
//
//  Usage:
//    DOT_ERC20_ADDRESS=0x... npx hardhat run scripts/deploy-all.js --network polkadotTestnet
// ─────────────────────────────────────────────────────────────

const { ethers } = require("hardhat");
const fs = require("fs");

function requireAddress(name) {
  const value = (process.env[name] || "").trim();
  if (!value) throw new Error(`Missing env var: ${name}`);
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${name} must be a 20-byte hex address (0x...)`);
  }
  return value;
}

function maybeAddress(value) {
  const raw = (value || "").trim();
  if (!raw) return null;
  return /^0x[a-fA-F0-9]{40}$/.test(raw) ? raw : null;
}

function parseBool(name) {
  const raw = (process.env[name] || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function maybeAssetIdToErc20(name) {
  const raw = (process.env[name] || "").trim();
  if (!raw) return null;

  let assetId;
  if (/^0x[0-9a-fA-F]+$/.test(raw)) {
    assetId = Number(BigInt(raw));
  } else if (/^[0-9]+$/.test(raw)) {
    assetId = Number(raw);
  } else {
    throw new Error(`${name} must be decimal or 0x-prefixed hex`);
  }

  if (!Number.isInteger(assetId) || assetId < 0 || assetId > 0xffffffff) {
    throw new Error(`${name} must fit in uint32`);
  }

  // Per Polkadot docs: 0x[assetId(4 bytes)][24 zero bytes][prefix=0x01200000]
  const head = assetId.toString(16).padStart(8, "0");
  return `0x${head}${"0".repeat(24)}01200000`;
}

function maybeBytes32(name) {
  const value = (process.env[name] || "").trim();
  if (!value) return "0x" + "00".repeat(32);
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(`${name} must be bytes32 hex (0x + 64 hex chars)`);
  }
  return value;
}

function parseBigIntEnv(name, fallback = null) {
  const raw = (process.env[name] || "").trim();
  if (!raw) return fallback;
  if (!/^[0-9]+$/.test(raw)) {
    throw new Error(`${name} must be an integer in wei`);
  }
  return BigInt(raw);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const useNativeDot = parseBool("USE_NATIVE_DOT");

  const explicitDot = useNativeDot ? null : maybeAddress(process.env.DOT_ERC20_ADDRESS);
  const derivedDot = useNativeDot ? null : maybeAssetIdToErc20("DOT_ASSET_ID");
  const dotTokenAddress = useNativeDot
    ? ethers.ZeroAddress
    : (explicitDot || derivedDot);
  if (!dotTokenAddress) {
    throw new Error("Set USE_NATIVE_DOT=true for canonical mode, or set DOT_ERC20_ADDRESS/DOT_ASSET_ID.");
  }
  const hubSovereign = maybeBytes32("HUB_SOVEREIGN");
  const defaultGasPrice = network.chainId === 420420417n ? 1_000_000_000_000n : null;
  const txGasPrice = parseBigIntEnv("GAS_PRICE_WEI", defaultGasPrice);
  const txGasLimit = parseBigIntEnv("GAS_LIMIT");
  const txOverrides = {};
  if (txGasPrice !== null) txOverrides.gasPrice = txGasPrice;
  if (txGasLimit !== null) txOverrides.gasLimit = txGasLimit;

  console.log("\n═══════════════════════════════════════════════");
  console.log("  HyperVault — Polkadot Hub Deploy");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance : ${ethers.formatEther(
    await ethers.provider.getBalance(deployer.address)
  )} PAS`);
  console.log(`  Deposit mode: ${useNativeDot ? "NATIVE (canonical PAS/DOT)" : "ERC20 token"}`);
  console.log(`  DOT token  : ${dotTokenAddress}`);
  if (!useNativeDot && (process.env.DOT_ERC20_ADDRESS || "").trim() && !explicitDot) {
    console.log("  Note: ignored invalid DOT_ERC20_ADDRESS env value");
  }
  if (!useNativeDot && (process.env.DOT_ASSET_ID || "").trim()) {
    console.log(`  DOT_ASSET_ID: ${process.env.DOT_ASSET_ID.trim()} (derived precompile)`);
  }
  if (txGasPrice !== null) console.log(`  Gas price : ${txGasPrice} wei`);
  if (txGasLimit !== null) console.log(`  Gas limit : ${txGasLimit}`);
  console.log(`  Hub Sovereign: ${hubSovereign}\n`);

  console.log("[1/2] Deploying BuildCallData Library...");
  const BuildCallData = await ethers.getContractFactory("BuildCallData");
  const lib = await BuildCallData.deploy(txOverrides);
  const libTx = lib.deploymentTransaction();
  if (libTx) console.log(`      ↳ tx: ${libTx.hash}`);
  await lib.waitForDeployment();
  const libAddress = await lib.getAddress();
  console.log(`      ✅ BuildCallData: ${libAddress}`);

  console.log("[2/2] Deploying HyperVault...");
  const HyperVault = await ethers.getContractFactory("HyperVault", {
    libraries: {
      BuildCallData: libAddress
    }
  });

  // Start with xcmEnabled=false until setXcmConfig has verified params.
  const vault = await HyperVault.deploy(
    dotTokenAddress,
    hubSovereign,
    false,
    txOverrides
  );
  const vaultTx = vault.deploymentTransaction();
  if (vaultTx) console.log(`      ↳ tx: ${vaultTx.hash}`);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`      ✅ HyperVault: ${vaultAddress}`);

  const frontendEnv = [
    `VITE_DOT_TOKEN_ADDRESS=${dotTokenAddress}`,
    `VITE_USE_NATIVE_DOT=${useNativeDot ? "true" : "false"}`,
    `VITE_VAULT_ADDRESS=${vaultAddress}`,
    `VITE_CHAIN_ID=420420417`,
    `VITE_RPC_URL=https://services.polkadothub-rpc.com/testnet`,
  ].join("\n") + "\n";
  fs.writeFileSync(".env.frontend", frontendEnv);

  const deployMeta = [
    `VAULT_ADDRESS=${vaultAddress}`,
    `DOT_ERC20_ADDRESS=${dotTokenAddress}`,
    `USE_NATIVE_DOT=${useNativeDot ? "true" : "false"}`,
    `BUILD_CALL_DATA_ADDRESS=${libAddress}`,
    `HUB_SOVEREIGN=${hubSovereign}`,
  ].join("\n") + "\n";
  fs.writeFileSync(".vault-address", deployMeta);

  console.log("\n═══════════════════════════════════════════════");
  console.log("  Deployment Complete");
  console.log("═══════════════════════════════════════════════");
  console.log(`  HyperVault : ${vaultAddress}`);
  console.log(`  DOT ERC20  : ${dotTokenAddress}`);
  console.log(`  XCM mode   : DISABLED (safe until configured)`);
  console.log(`  Network    : Polkadot Hub Testnet (420420417)\n`);

  if (hubSovereign === "0x" + "00".repeat(32)) {
    console.log("  ⚠ HUB_SOVEREIGN is zero. Set the real sovereign and run:");
    console.log("    npx hardhat run scripts/set-hub-sovereign.js --network polkadotTestnet\n");
  }

  console.log("  Next steps:");
  console.log("  1. Probe Hub precompiles (recommended):");
  console.log("     npx hardhat run scripts/probe-hub-precompiles.js --network polkadotTestnet");
  console.log("  2. Configure live XCM:");
  console.log("     npx hardhat run scripts/configure-live-xcm.js --network polkadotTestnet");
  console.log("  3. Smoke-test deposits:");
  console.log("     npx hardhat run scripts/test-deposit.js --network polkadotTestnet");
  console.log("  4. Read live config:");
  console.log("     VAULT_ADDRESS=0x... npx hardhat run scripts/check-live-config.js --network polkadotTestnet");
  console.log("  5. Frontend env is in hardhat/.env.frontend\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
