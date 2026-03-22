// scripts/check-live-config.js
// ─────────────────────────────────────────────────────────────
//  Read-only diagnostics for deployed HyperVault on Polkadot Hub.
//
//  Required env:
//    VAULT_ADDRESS
//
//  Optional env:
//    DOT_ERC20_ADDRESS
//
//  Usage:
//    VAULT_ADDRESS=0x... npx hardhat run scripts/check-live-config.js --network polkadotTestnet
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
  const vaultAddress = requireAddress("VAULT_ADDRESS");
  const [signer] = await ethers.getSigners();
  const vault = await ethers.getContractAt("HyperVault", vaultAddress, signer);

  const state = await vault.getVaultState();
  const nativeMode = await vault.nativeDotMode();
  const dotToken = await vault.dotToken();
  const dotDecimals = Number(await vault.dotDecimals());
  const dotCurrencyId = await vault.dotCurrencyId();
  const vDotCurrencyId = await vault.vDotCurrencyId();
  const destChainIndexRaw = await vault.destChainIndexRaw();
  const remark = await vault.remark();
  const channelId = await vault.channelId();
  const xcmRefTime = await vault.xcmRefTime();
  const xcmProofSize = await vault.xcmProofSize();
  const hubSovereign = await vault.hubSovereign();
  const externalXcmMode = await vault.externalXcmExecutorMode();

  const dotAddress = nativeMode
    ? ethers.ZeroAddress
    : (process.env.DOT_ERC20_ADDRESS || dotToken).trim();
  const vaultDotBal = nativeMode
    ? await ethers.provider.getBalance(vaultAddress)
    : await (await ethers.getContractAt("IERC20", dotAddress, signer)).balanceOf(vaultAddress);
  const isConfigured =
    state._xcmEnabled &&
    dotCurrencyId !== "0x0000" &&
    vDotCurrencyId !== "0x0000" &&
    destChainIndexRaw !== "0x00" &&
    remark.length > 0;

  console.log("\n═══════════════════════════════════════════════");
  console.log("  HyperVault — Live Config Check");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Vault            : ${vaultAddress}`);
  console.log(`  Deposit mode     : ${nativeMode ? "NATIVE (canonical)" : "ERC20 token"}`);
  console.log(`  DOT token        : ${dotToken}`);
  console.log(`  DOT decimals     : ${dotDecimals}`);
  console.log(`  DOT currency id  : ${dotCurrencyId}`);
  console.log(`  vDOT currency id : ${vDotCurrencyId}`);
  console.log(`  Dest chain raw   : ${destChainIndexRaw}`);
  console.log(`  Remark           : ${remark}`);
  console.log(`  Channel id       : ${channelId}`);
  console.log(`  Ref time         : ${xcmRefTime}`);
  console.log(`  Proof size       : ${xcmProofSize}`);
  console.log(`  Hub sovereign    : ${hubSovereign}`);
  console.log(`  XCM enabled      : ${state._xcmEnabled}`);
  console.log(`  External XCM mode: ${externalXcmMode}`);
  console.log(`  XCM configured   : ${isConfigured}`);
  console.log(`  Paused           : ${state._paused}`);
  console.log(`  Total deposited  : ${ethers.formatUnits(state._totalDotDeposited, dotDecimals)}`);
  console.log(`  DOT vault bal    : ${ethers.formatUnits(vaultDotBal, dotDecimals)}`);
  console.log("═══════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
