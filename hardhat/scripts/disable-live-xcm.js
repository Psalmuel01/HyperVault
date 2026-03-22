// scripts/disable-live-xcm.js
// ─────────────────────────────────────────────────────────────
//  Disable live XCM on a deployed vault while preserving config.
//
//  Required env:
//    VAULT_ADDRESS
//
//  Usage:
//    VAULT_ADDRESS=0x... npx hardhat run scripts/disable-live-xcm.js --network polkadotTestnet
// ─────────────────────────────────────────────────────────────

const { ethers } = require("hardhat");

function requireAddress(name) {
  const value = (process.env[name] || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${name} must be a 20-byte hex address`);
  }
  return value;
}

async function main() {
  const [signer] = await ethers.getSigners();
  const vaultAddress = requireAddress("VAULT_ADDRESS");
  const vault = await ethers.getContractAt("HyperVault", vaultAddress, signer);

  const dotCurrencyId = await vault.dotCurrencyId();
  const vDotCurrencyId = await vault.vDotCurrencyId();
  const destChainIndexRaw = await vault.destChainIndexRaw();
  const remark = await vault.remark();
  const channelId = await vault.channelId();

  console.log(`Disabling live XCM on ${vaultAddress}...`);
  const tx = await vault.setXcmConfig(
    dotCurrencyId,
    vDotCurrencyId,
    destChainIndexRaw,
    remark,
    channelId,
    false
  );
  await tx.wait();
  console.log(`✅ setXcmConfig enabled=false (tx: ${tx.hash})`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
