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

function maybeBytes32(name) {
  const value = (process.env[name] || "").trim();
  if (!value) return "0x" + "00".repeat(32);
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(`${name} must be bytes32 hex (0x + 64 hex chars)`);
  }
  return value;
}

async function main() {
  const [deployer] = await ethers.getSigners();

  const dotTokenAddress = requireAddress("DOT_ERC20_ADDRESS");
  const hubSovereign = maybeBytes32("HUB_SOVEREIGN");

  console.log("\n═══════════════════════════════════════════════");
  console.log("  HyperVault — Polkadot Hub Deploy");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance : ${ethers.formatEther(
    await ethers.provider.getBalance(deployer.address)
  )} PAS`);
  console.log(`  DOT ERC20: ${dotTokenAddress}`);
  console.log(`  Hub Sovereign: ${hubSovereign}\n`);

  console.log("[1/2] Deploying BuildCallData Library...");
  const BuildCallData = await ethers.getContractFactory("BuildCallData");
  const lib = await BuildCallData.deploy();
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
    false
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`      ✅ HyperVault: ${vaultAddress}`);

  const frontendEnv = [
    `VITE_DOT_TOKEN_ADDRESS=${dotTokenAddress}`,
    `VITE_VAULT_ADDRESS=${vaultAddress}`,
    `VITE_CHAIN_ID=420420417`,
    `VITE_RPC_URL=https://services.polkadothub-rpc.com/testnet`,
  ].join("\n") + "\n";
  fs.writeFileSync(".env.frontend", frontendEnv);

  const deployMeta = [
    `VAULT_ADDRESS=${vaultAddress}`,
    `DOT_ERC20_ADDRESS=${dotTokenAddress}`,
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
  console.log("  1. Configure live XCM:");
  console.log("     npx hardhat run scripts/configure-live-xcm.js --network polkadotTestnet");
  console.log("  2. Smoke-test deposits:");
  console.log("     npx hardhat run scripts/test-deposit.js --network polkadotTestnet");
  console.log("  3. Frontend env is in hardhat/.env.frontend\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
