// scripts/configure-live-xcm.js
// ─────────────────────────────────────────────────────────────
//  Configure HyperVault for live DOT <-> vDOT XCM flow.
//
//  Required env:
//    VAULT_ADDRESS
//    DOT_CURRENCY_ID      (bytes2, e.g. 0x0800)
//    VDOT_CURRENCY_ID     (bytes2, e.g. 0x0900)
//    DEST_CHAIN_INDEX_RAW (bytes1, implementation-specific, e.g. 0x01)
//    XCM_REMARK           (letters/digits only)
//    CHANNEL_ID           (uint32)
//
//  Optional:
//    XCM_REF_TIME
//    XCM_PROOF_SIZE
//
//  Usage:
//    ... npx hardhat run scripts/configure-live-xcm.js --network polkadotTestnet
// ─────────────────────────────────────────────────────────────

const { ethers } = require("hardhat");

function requireAddress(name) {
  const value = (process.env[name] || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${name} must be a 20-byte hex address`);
  }
  return value;
}

function requireBytesN(name, bytesLen) {
  const value = (process.env[name] || "").trim();
  const re = new RegExp(`^0x[a-fA-F0-9]{${bytesLen * 2}}$`);
  if (!re.test(value)) throw new Error(`${name} must be ${bytesLen} bytes hex`);
  return value;
}

function requireRemark() {
  const value = (process.env.XCM_REMARK || "").trim();
  if (!value) throw new Error("XCM_REMARK is required");
  if (!/^[a-zA-Z0-9]+$/.test(value)) {
    throw new Error("XCM_REMARK must be letters/digits only");
  }
  return value;
}

function parseUint(name, fallback) {
  const raw = (process.env[name] || "").trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }
  return value;
}

async function main() {
  const [signer] = await ethers.getSigners();
  const vaultAddress = requireAddress("VAULT_ADDRESS");
  const dotCurrencyId = requireBytesN("DOT_CURRENCY_ID", 2);
  const vDotCurrencyId = requireBytesN("VDOT_CURRENCY_ID", 2);
  const destChainIndexRaw = requireBytesN("DEST_CHAIN_INDEX_RAW", 1);
  const remark = requireRemark();
  const channelId = parseUint("CHANNEL_ID", 0);
  const refTime = parseUint("XCM_REF_TIME", 5_000_000_000);
  const proofSize = parseUint("XCM_PROOF_SIZE", 131_072);

  const vault = await ethers.getContractAt("HyperVault", vaultAddress, signer);

  console.log(`Configuring live XCM on ${vaultAddress}...`);
  const setWeightsTx = await vault.setXcmWeights(refTime, proofSize);
  await setWeightsTx.wait();
  console.log(`✅ setXcmWeights (tx: ${setWeightsTx.hash})`);

  const setConfigTx = await vault.setXcmConfig(
    dotCurrencyId,
    vDotCurrencyId,
    destChainIndexRaw,
    remark,
    channelId,
    true
  );
  await setConfigTx.wait();
  console.log(`✅ setXcmConfig enabled=true (tx: ${setConfigTx.hash})`);

  const state = await vault.getVaultState();
  console.log(`Live enabled: ${state._xcmEnabled}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
