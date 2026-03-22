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

function parseUint(name, fallback, max = Number.MAX_SAFE_INTEGER) {
  const raw = (process.env[name] || "").trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > max) {
    throw new Error(`${name} must be a non-negative number <= ${max}`);
  }
  return value;
}

function parseOptionalBool(name) {
  const raw = (process.env[name] || "").trim().toLowerCase();
  if (!raw) return null;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  throw new Error(`${name} must be true/false`);
}

function parseBigIntEnv(name) {
  const raw = (process.env[name] || "").trim();
  if (!raw) return null;
  if (!/^[0-9]+$/.test(raw)) throw new Error(`${name} must be an integer`);
  return BigInt(raw);
}

async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const vaultAddress = requireAddress("VAULT_ADDRESS");
  const dotCurrencyId = requireBytesN("DOT_CURRENCY_ID", 2);
  const vDotCurrencyId = requireBytesN("VDOT_CURRENCY_ID", 2);
  const destChainIndexRaw = requireBytesN("DEST_CHAIN_INDEX_RAW", 1);
  const remark = requireRemark();
  const channelId = parseUint("CHANNEL_ID", 0, 0xffffffff);
  const refTime = parseUint("XCM_REF_TIME", 5_000_000_000);
  const proofSize = parseUint("XCM_PROOF_SIZE", 131_072);
  const externalXcmMode = parseOptionalBool("EXTERNAL_XCM_MODE");
  const gasPrice = parseBigIntEnv("GAS_PRICE_WEI");
  const gasLimit = parseBigIntEnv("GAS_LIMIT");
  const overrides = {};
  if (gasPrice !== null) overrides.gasPrice = gasPrice;
  if (gasLimit !== null) overrides.gasLimit = gasLimit;

  const vault = await ethers.getContractAt("HyperVault", vaultAddress, signer);
  const nativeMode = await vault.nativeDotMode();

  if (network.chainId === 420420417n) {
    console.log("⚠ Chain 420420417 uses canonical PAS (Paseo), not DOT.");
  }
  if (!nativeMode) {
    console.log("⚠ Vault is in ERC20 mode. This is fallback/test mode, not canonical asset mode.");
  }

  console.log(`Configuring live XCM on ${vaultAddress}...`);
  const setWeightsTx = await vault.setXcmWeights(refTime, proofSize, overrides);
  await setWeightsTx.wait();
  console.log(`✅ setXcmWeights (tx: ${setWeightsTx.hash})`);

  const setConfigTx = await vault.setXcmConfig(
    dotCurrencyId,
    vDotCurrencyId,
    destChainIndexRaw,
    remark,
    channelId,
    true,
    overrides
  );
  await setConfigTx.wait();
  console.log(`✅ setXcmConfig enabled=true (tx: ${setConfigTx.hash})`);

  if (externalXcmMode !== null) {
    const setExternalTx = await vault.setExternalXcmExecutorMode(externalXcmMode, overrides);
    await setExternalTx.wait();
    console.log(`✅ setExternalXcmExecutorMode=${externalXcmMode} (tx: ${setExternalTx.hash})`);
  }

  const state = await vault.getVaultState();
  console.log(`Live enabled: ${state._xcmEnabled}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
