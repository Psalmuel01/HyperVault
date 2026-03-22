// scripts/deploy-all-manual.js
// ─────────────────────────────────────────────────────────────
//  Manual deployment path that avoids ContractFactory.deploy()
//  hangs on some Polkadot Hub RPC nodes.
//
//  Usage:
//    USE_NATIVE_DOT=true npx hardhat run scripts/deploy-all-manual.js --network polkadotTestnet
// ─────────────────────────────────────────────────────────────

const { ethers } = require("hardhat");
const fs = require("fs");

function parseBool(name) {
  const raw = (process.env[name] || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

function maybeAddress(value) {
  const raw = (value || "").trim();
  if (!raw) return null;
  return /^0x[a-fA-F0-9]{40}$/.test(raw) ? raw : null;
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

async function deployViaRawTx(label, factory, signer, ctorArgs, txOverrides) {
  const txRequest = await factory.getDeployTransaction(...ctorArgs);
  if (txOverrides.gasPrice !== undefined) txRequest.gasPrice = txOverrides.gasPrice;
  if (txOverrides.gasLimit !== undefined) txRequest.gasLimit = txOverrides.gasLimit;
  txRequest.from = signer.address;

  console.log(`\n[${label}] broadcasting create tx...`);
  const tx = await signer.sendTransaction(txRequest);
  console.log(`      ↳ tx: ${tx.hash}`);

  const rcpt = await tx.wait();
  if (!rcpt || rcpt.status !== 1n) {
    throw new Error(`${label} deployment reverted: ${tx.hash}`);
  }
  if (!rcpt.contractAddress) {
    throw new Error(`${label} deployment missing contract address: ${tx.hash}`);
  }
  console.log(`      ✅ ${label}: ${rcpt.contractAddress}`);
  return rcpt.contractAddress;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const useNativeDot = parseBool("USE_NATIVE_DOT");
  const dotTokenAddress = useNativeDot
    ? ethers.ZeroAddress
    : maybeAddress(process.env.DOT_ERC20_ADDRESS);
  if (!dotTokenAddress) {
    throw new Error("Set USE_NATIVE_DOT=true for canonical mode, or set DOT_ERC20_ADDRESS.");
  }
  const hubSovereign = maybeBytes32("HUB_SOVEREIGN");

  const defaultGasPrice = network.chainId === 420420417n ? 1_000_000_000_000n : null;
  const txGasPrice = parseBigIntEnv("GAS_PRICE_WEI", defaultGasPrice);
  const txGasLimit = parseBigIntEnv("GAS_LIMIT", 15_000_000n);
  const txOverrides = {};
  if (txGasPrice !== null) txOverrides.gasPrice = txGasPrice;
  if (txGasLimit !== null) txOverrides.gasLimit = txGasLimit;

  console.log("\n═══════════════════════════════════════════════");
  console.log("  HyperVault — Manual Deploy Path");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Deployer      : ${deployer.address}`);
  console.log(`  Balance       : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} PAS`);
  console.log(`  Deposit mode  : ${useNativeDot ? "NATIVE (canonical PAS/DOT)" : "ERC20 token"}`);
  console.log(`  DOT token     : ${dotTokenAddress}`);
  console.log(`  Hub Sovereign : ${hubSovereign}`);
  if (txGasPrice !== null) console.log(`  Gas price     : ${txGasPrice} wei`);
  if (txGasLimit !== null) console.log(`  Gas limit     : ${txGasLimit}`);

  const BuildCallData = await ethers.getContractFactory("BuildCallData");
  const libAddress = await deployViaRawTx("BuildCallData", BuildCallData, deployer, [], txOverrides);

  const HyperVault = await ethers.getContractFactory("HyperVault", {
    libraries: { BuildCallData: libAddress },
  });
  const vaultAddress = await deployViaRawTx(
    "HyperVault",
    HyperVault,
    deployer,
    [dotTokenAddress, hubSovereign, false],
    txOverrides
  );

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
  console.log(`  DOT token  : ${dotTokenAddress}`);
  console.log(`  Network    : Polkadot Hub Testnet (420420417)\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

