// scripts/mark-withdrawal-settled.js
// ─────────────────────────────────────────────────────────────
//  Attest a user's pending withdrawal settlement.
//
//  Required env:
//    VAULT_ADDRESS   (0x...)
//    USER_ADDRESS    (0x...)
//    PROOF_REF       (bytes32 0x...)
//
//  Usage:
//    VAULT_ADDRESS=0x... USER_ADDRESS=0x... PROOF_REF=0x... \
//      npx hardhat run scripts/mark-withdrawal-settled.js --network polkadotTestnet
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
  const userAddress = requireAddress("USER_ADDRESS");
  const proofRef = requireBytes32("PROOF_REF");
  const gasPrice = parseBigIntEnv("GAS_PRICE_WEI");
  const gasLimit = parseBigIntEnv("GAS_LIMIT");
  const overrides = {};
  if (gasPrice !== null) overrides.gasPrice = gasPrice;
  if (gasLimit !== null) overrides.gasLimit = gasLimit;

  const vault = await ethers.getContractAt("HyperVault", vaultAddress, signer);

  console.log(`Marking withdrawal settled...`);
  console.log(`  Vault : ${vaultAddress}`);
  console.log(`  User  : ${userAddress}`);
  console.log(`  Proof : ${proofRef}`);

  const tx = await vault.recordWithdrawalSettlement(userAddress, proofRef, overrides);
  await tx.wait();
  console.log(`✅ Settlement recorded (tx: ${tx.hash})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
