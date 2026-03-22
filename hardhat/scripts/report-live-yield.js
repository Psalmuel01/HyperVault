// scripts/report-live-yield.js
// ─────────────────────────────────────────────────────────────
//  Credit realized live yield into vault share accounting.
//
//  Required env:
//    VAULT_ADDRESS   (0x...)
//    YIELD_AMOUNT    (human units, e.g. 0.125)
//    PROOF_REF       (bytes32 0x...)
//
//  Usage:
//    VAULT_ADDRESS=0x... YIELD_AMOUNT=0.125 PROOF_REF=0x... \
//      npx hardhat run scripts/report-live-yield.js --network polkadotTestnet
// ─────────────────────────────────────────────────────────────

const { ethers } = require("hardhat");

function requireAddress(name) {
  const value = (process.env[name] || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${name} must be a 20-byte hex address`);
  }
  return value;
}

function requireBytes32(name) {
  const value = (process.env[name] || "").trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(`${name} must be bytes32 hex`);
  }
  return value;
}

function parseBigIntEnv(name) {
  const raw = (process.env[name] || "").trim();
  if (!raw) return null;
  if (!/^[0-9]+$/.test(raw)) throw new Error(`${name} must be an integer`);
  return BigInt(raw);
}

async function main() {
  const [signer] = await ethers.getSigners();
  const vaultAddress = requireAddress("VAULT_ADDRESS");
  const proofRef = requireBytes32("PROOF_REF");
  const gasPrice = parseBigIntEnv("GAS_PRICE_WEI");
  const gasLimit = parseBigIntEnv("GAS_LIMIT");
  const overrides = {};
  if (gasPrice !== null) overrides.gasPrice = gasPrice;
  if (gasLimit !== null) overrides.gasLimit = gasLimit;
  const amountHuman = (process.env.YIELD_AMOUNT || "").trim();
  if (!amountHuman) {
    throw new Error("YIELD_AMOUNT is required");
  }

  const vault = await ethers.getContractAt("HyperVault", vaultAddress, signer);
  const dotDecimals = Number(await vault.dotDecimals());
  const amount = ethers.parseUnits(amountHuman, dotDecimals);

  console.log(`Reporting live yield...`);
  console.log(`  Vault      : ${vaultAddress}`);
  console.log(`  Yield      : ${amountHuman}`);
  console.log(`  Dot decimals: ${dotDecimals}`);
  console.log(`  Proof      : ${proofRef}`);

  const tx = await vault.reportLiveYield(amount, proofRef, overrides);
  await tx.wait();
  console.log(`✅ Live yield reported (tx: ${tx.hash})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
