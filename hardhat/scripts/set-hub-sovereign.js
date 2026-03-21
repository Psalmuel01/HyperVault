// scripts/set-hub-sovereign.js
// ─────────────────────────────────────────────────────────────
//  Update hub sovereign after deployment.
//
//  Usage:
//    VAULT_ADDRESS=0x... HUB_SOVEREIGN=0x... npx hardhat run scripts/set-hub-sovereign.js --network polkadotTestnet
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

async function main() {
  const [signer] = await ethers.getSigners();
  const vaultAddress = requireAddress("VAULT_ADDRESS");
  const hubSovereign = requireBytes32("HUB_SOVEREIGN");

  const vault = await ethers.getContractAt("HyperVault", vaultAddress, signer);

  console.log(`Setting hub sovereign on ${vaultAddress}...`);
  const tx = await vault.setHubSovereign(hubSovereign);
  await tx.wait();
  console.log(`✅ Updated (tx: ${tx.hash})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
