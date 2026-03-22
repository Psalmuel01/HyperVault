// scripts/set-external-xcm-mode.js
// ─────────────────────────────────────────────────────────────
//  Toggle external XCM relayer mode on HyperVault.
//
//  Usage:
//    VAULT_ADDRESS=0x... EXTERNAL_XCM_MODE=true npx hardhat run scripts/set-external-xcm-mode.js --network polkadotTestnet
// ─────────────────────────────────────────────────────────────

const { ethers } = require("hardhat");

function requireAddress(name) {
  const value = (process.env[name] || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${name} must be a 20-byte hex address`);
  }
  return value;
}

function requireBool(name) {
  const raw = (process.env[name] || "").trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  throw new Error(`${name} must be true/false`);
}

async function main() {
  const [signer] = await ethers.getSigners();
  const vaultAddress = requireAddress("VAULT_ADDRESS");
  const mode = requireBool("EXTERNAL_XCM_MODE");
  const vault = await ethers.getContractAt("HyperVault", vaultAddress, signer);

  console.log(`Setting external XCM mode=${mode} on ${vaultAddress}...`);
  const tx = await vault.setExternalXcmExecutorMode(mode);
  await tx.wait();
  console.log(`✅ Updated (tx: ${tx.hash})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

