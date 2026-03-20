// scripts/deploy-all.js
// ─────────────────────────────────────────────────────────────
//  Deploys WrappedPAS first, then HyperVault pointing at it.
//  Run this as your single deploy command on day-of.
//
//  Usage:
//    npx hardhat run scripts/deploy-all.js --network polkadotTestnet
// ─────────────────────────────────────────────────────────────

const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("\n═══════════════════════════════════════════════");
  console.log("  HyperVault — Full Deploy (WrappedPAS + Vault)");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Balance : ${ethers.formatEther(
    await ethers.provider.getBalance(deployer.address)
  )} PAS\n`);

  // ── Step 1: Deploy WrappedPAS ─────────────────────────────
  console.log("[1/3] Deploying WrappedPAS...");
  const WrappedPAS = await ethers.getContractFactory("WrappedPAS");
  const wpas = await WrappedPAS.deploy();
  await wpas.waitForDeployment();
  const wpasAddress = await wpas.getAddress();
  console.log(`      ✅ WrappedPAS deployed: ${wpasAddress}`);

  // ── Step 2: Seed WrappedPAS with some WPAS for demo ──────
  // Wrap 10 PAS so the vault has liquid WPAS for mock withdrawals
  console.log("[2/3] Seeding vault with initial WPAS...");
  const seedAmount = ethers.parseEther("10"); // 10 PAS
  const depositTx = await wpas.deposit({ value: seedAmount });
  await depositTx.wait();
  console.log(`      ✅ Wrapped 10 PAS → WPAS (tx: ${depositTx.hash})`);

  // ── Step 3: Deploy HyperVault ─────────────────────────────
  console.log("[3/4] Deploying BuildCallData Library...");
  const BuildCallData = await ethers.getContractFactory("BuildCallData");
  const lib = await BuildCallData.deploy();
  await lib.waitForDeployment();
  const libAddress = await lib.getAddress();
  console.log(`      ✅ BuildCallData deployed: ${libAddress}`);

  console.log("[4/4] Deploying HyperVault...");

  // Placeholder sovereign — update after deploy using the
  // Substrate sovereign account tool for your vault address.
  // https://www.shawntabrizi.com/substrate-js/
  const HUB_SOVEREIGN = process.env.HUB_SOVEREIGN
    || "0x" + "00".repeat(32);

  const HyperVault = await ethers.getContractFactory("HyperVault", {
    libraries: {
      BuildCallData: libAddress
    }
  });
  const vault = await HyperVault.deploy(
    wpasAddress,     // _dotToken  = WrappedPAS
    HUB_SOVEREIGN,   // _hubSovereign
    false            // _xcmEnabled = false (mock mode, safe default)
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log(`      ✅ HyperVault deployed: ${vaultAddress}`);

  // ── Transfer seed WPAS to vault for mock withdrawals ─────
  const transferTx = await wpas.transfer(vaultAddress, seedAmount);
  await transferTx.wait();
  console.log(`      ✅ Transferred 10 WPAS to vault for liquidity`);

  // ── Summary ───────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Deployment Complete");
  console.log("═══════════════════════════════════════════════");
  console.log(`  WrappedPAS : ${wpasAddress}`);
  console.log(`  HyperVault : ${vaultAddress}`);
  console.log(`  XCM mode   : MOCK (safe default)`);
  console.log(`  Network    : Polkadot Testnet (chainId 420420417)`);

  // ── Write .env for frontend ───────────────────────────────
  const envContent = [
    `VITE_DOT_TOKEN_ADDRESS=${wpasAddress}`,
    `VITE_VAULT_ADDRESS=${vaultAddress}`,
    `VITE_CHAIN_ID=420420417`,
    `VITE_RPC_URL=https://eth-rpc-testnet.polkadot.io`,
  ].join("\n") + "\n";

  fs.writeFileSync(".env.frontend", envContent);
  console.log(`\n  Frontend env written to .env.frontend`);
  console.log(`  Copy to your frontend directory as .env\n`);

  // ── Next steps ────────────────────────────────────────────
  console.log("  Next steps:");
  console.log("  1. Compute vault sovereign on Bifrost:");
  console.log(`     https://www.shawntabrizi.com/substrate-js/`);
  console.log(`     Input: ${vaultAddress}`);
  console.log("  2. To enable live XCM once call bytes are known:");
  console.log(`     vault.setXcmConfig(mintBytes, redeemBytes, true)`);
  console.log("  3. Test the full flow:");
  console.log(`     npx hardhat run scripts/test-deposit.js --network polkadotTestnet\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });