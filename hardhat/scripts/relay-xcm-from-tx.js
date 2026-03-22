// scripts/relay-xcm-from-tx.js
// ─────────────────────────────────────────────────────────────
//  Relay prepared XCM message from a HyperVault tx receipt.
//
//  Usage:
//    VAULT_ADDRESS=0x... DEPOSIT_TX=0x... npx hardhat run scripts/relay-xcm-from-tx.js --network polkadotTestnet
// ─────────────────────────────────────────────────────────────

const { ethers } = require("hardhat");

const XCM_PRECOMPILE = "0x00000000000000000000000000000000000a0000";
const XCM_IFACE = new ethers.Interface(["function send(bytes dest, bytes message)"]);

function requireAddress(name) {
  const value = (process.env[name] || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw new Error(`${name} must be a 20-byte hex address`);
  }
  return value;
}

function requireHash(name) {
  const value = (process.env[name] || "").trim();
  if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
    throw new Error(`${name} must be a tx hash`);
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
  const txHash = requireHash("DEPOSIT_TX");
  const gasPrice = parseBigIntEnv("GAS_PRICE_WEI");
  const gasLimit = parseBigIntEnv("GAS_LIMIT");

  const vault = await ethers.getContractAt("HyperVault", vaultAddress, signer);
  const receipt = await ethers.provider.getTransactionReceipt(txHash);
  if (!receipt) throw new Error(`Transaction not found: ${txHash}`);

  const prepared = receipt.logs
    .map((log) => { try { return vault.interface.parseLog(log); } catch { return null; } })
    .find((evt) => evt?.name === "XcmMessagePrepared");

  if (!prepared) {
    throw new Error("No XcmMessagePrepared event in this receipt");
  }

  const dest = prepared.args.dest;
  const message = prepared.args.message;

  console.log("\n═══════════════════════════════════════════════");
  console.log("  HyperVault — XCM Relay");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Vault   : ${vaultAddress}`);
  console.log(`  Tx      : ${txHash}`);
  console.log(`  Action  : ${prepared.args.action}`);
  console.log(`  Amount  : ${prepared.args.dotAmount.toString()}`);
  console.log(`  Dest    : ${dest}`);
  console.log(`  Msg len : ${ethers.getBytes(message).length}`);

  const tx = await signer.sendTransaction({
    to: XCM_PRECOMPILE,
    data: XCM_IFACE.encodeFunctionData("send", [dest, message]),
    gasLimit: gasLimit ?? 2_000_000n,
    ...(gasPrice !== null ? { gasPrice } : {})
  });
  const rcpt = await tx.wait();
  console.log(`✅ Relayed (tx: ${tx.hash}, status=${rcpt.status})`);
  console.log("═══════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
