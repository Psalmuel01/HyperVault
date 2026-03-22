// scripts/debug-xcm-message.js
// ─────────────────────────────────────────────────────────────
//  Build HyperVault mint XCM bytes off-chain and probe
//  XCM precompile parsing via weighMessage.
//
//  Usage:
//    VAULT_ADDRESS=0x... DOT_AMOUNT=0.1 npx hardhat run scripts/debug-xcm-message.js --network polkadotTestnet
// ─────────────────────────────────────────────────────────────

const { ethers } = require("hardhat");

const XCM_PRECOMPILE = "0x00000000000000000000000000000000000a0000";
const XCM_IFACE = new ethers.Interface([
  "function weighMessage(bytes) view returns ((uint64 refTime, uint64 proofSize))",
  "function send(bytes dest, bytes message)"
]);

function compactU128(v) {
  let n = BigInt(v);
  if (n < 64n) {
    return ethers.toBeHex(Number(n << 2n), 1);
  }
  if (n < 16384n) {
    const enc = (n << 2n) | 1n;
    return ethers.toBeHex(Number(enc), 2).replace(/^0x(..)(..)$/i, "0x$2$1");
  }
  if (n < 1073741824n) {
    const enc = (n << 2n) | 2n;
    const x = Number(enc);
    const b0 = x & 0xff;
    const b1 = (x >> 8) & 0xff;
    const b2 = (x >> 16) & 0xff;
    const b3 = (x >> 24) & 0xff;
    return ethers.hexlify(Uint8Array.from([b0, b1, b2, b3]));
  }
  const bytes = [];
  while (n > 0n) {
    bytes.push(Number(n & 0xffn));
    n >>= 8n;
  }
  const prefix = ((bytes.length - 4) << 2) | 3;
  return ethers.hexlify(Uint8Array.from([prefix, ...bytes]));
}

function leHex(v, byteLen) {
  const out = new Uint8Array(byteLen);
  let n = BigInt(v);
  for (let i = 0; i < byteLen; i++) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return ethers.hexlify(out);
}

function toTruncBytes(v) {
  const out = [];
  let n = BigInt(v);
  for (let i = 0; i < 8; i++) {
    const b = Number((n >> BigInt(8 * i)) & 0xffn);
    if (b === 0) break;
    out.push(b);
  }
  return ethers.hexlify(Uint8Array.from(out));
}

function scaleChar(ch) {
  const c = ch.charCodeAt(0);
  if (c >= 48 && c <= 57) return c; // 0-9
  if (c >= 97 && c <= 122) return c; // a-z
  if (c >= 65 && c <= 90) return c; // A-Z
  throw new Error("unsupported remark charset");
}

function toScaleString(s) {
  const len = toTruncBytes(BigInt(s.length * 4));
  const content = ethers.hexlify(Uint8Array.from([...s].map(scaleChar)));
  return ethers.concat([len, content]);
}

function encodeBytes(data) {
  const len = compactU128(BigInt(ethers.getBytes(data).length));
  return ethers.concat([len, data]);
}

function buildCreateOrderCall({
  caller,
  chainId,
  blockNumber,
  tokenBytes2,
  amount,
  targetChain,
  remark,
  channelId
}) {
  return ethers.concat([
    "0x7d0e", // PALLET_INDEX=125, CREATE_ORDER_CALL_INDEX=14
    caller,
    leHex(chainId, 8),
    leHex(blockNumber, 16),
    tokenBytes2,
    leHex(amount, 16),
    targetChain,
    toScaleString(remark),
    leHex(channelId, 4)
  ]);
}

function buildMintMessage({ dotAmount, hubSovereign, mintCall }) {
  const RELAY_HERE_ASSET_ID = "0x010000";

  const withdrawAsset = ethers.concat([
    "0x00",
    "0x04",
    RELAY_HERE_ASSET_ID,
    compactU128(dotAmount)
  ]);

  const buyExecution = ethers.concat([
    "0x13",
    RELAY_HERE_ASSET_ID,
    compactU128(dotAmount),
    "0x00"
  ]);

  const transact = ethers.concat([
    "0x06",
    "0x01",
    "0x00",
    encodeBytes(encodeBytes(mintCall))
  ]);

  const refundSurplus = "0x14";
  const depositAsset = ethers.concat(["0x0d", "0x010101000000", "0x01010000", hubSovereign]);
  const depositAssetFixed = ethers.concat(["0x0d", "0x01010001000000", "0x00010100", hubSovereign]);

  return ethers.concat([
    "0x05",
    "0x14",
    withdrawAsset,
    buyExecution,
    transact,
    refundSurplus,
    depositAssetFixed
  ]);
}

function buildMessageVariant({
  dotAmount,
  hubSovereign,
  mintCall,
  includeTransact,
  includeRefund,
  depositVariant
}) {
  const RELAY_HERE_ASSET_ID = "0x010000";
  const instructions = [];

  instructions.push(
    ethers.concat(["0x00", "0x04", RELAY_HERE_ASSET_ID, compactU128(dotAmount)])
  );
  instructions.push(
    ethers.concat(["0x13", RELAY_HERE_ASSET_ID, compactU128(dotAmount), "0x00"])
  );

  if (includeTransact) {
    instructions.push(
      ethers.concat(["0x06", "0x01", "0x00", encodeBytes(encodeBytes(mintCall))])
    );
  }
  if (includeRefund) {
    instructions.push("0x14");
  }

  if (depositVariant === "legacy") {
    instructions.push(
      ethers.concat(["0x0d", "0x010101000000", "0x01010000", hubSovereign])
    );
  } else if (depositVariant === "with-max-assets") {
    instructions.push(
      ethers.concat(["0x0d", "0x010101000000", "0x04", "0x01010000", hubSovereign])
    );
  } else if (depositVariant === "beneficiary-network-any") {
    instructions.push(
      ethers.concat(["0x0d", "0x010101000000", "0x01010100", hubSovereign])
    );
  } else if (depositVariant === "beneficiary-network-any-with-max") {
    instructions.push(
      ethers.concat(["0x0d", "0x010101000000", "0x04", "0x01010100", hubSovereign])
    );
  } else if (depositVariant === "fixed") {
    instructions.push(
      ethers.concat(["0x0d", "0x01010001000000", "0x00010100", hubSovereign])
    );
  } else if (depositVariant === "all-counted-1") {
    instructions.push(
      ethers.concat(["0x0d", "0x010204", "0x00010100", hubSovereign])
    );
  } else if (depositVariant === "docs-like") {
    instructions.push(
      ethers.concat(["0x0d", "0x010101000000", "0x010100", hubSovereign])
    );
  }

  const lenCompact = compactU128(BigInt(instructions.length));
  return ethers.concat(["0x05", lenCompact, ...instructions]);
}

async function tryWeigh(label, message) {
  try {
    const out = await ethers.provider.call({
      to: XCM_PRECOMPILE,
      data: XCM_IFACE.encodeFunctionData("weighMessage", [message])
    });
    const [weight] = XCM_IFACE.decodeFunctionResult("weighMessage", out);
    console.log(`✅ ${label}: refTime=${weight.refTime} proofSize=${weight.proofSize}`);
  } catch (err) {
    console.log(`❌ ${label}: ${err?.message || err}`);
  }
}

async function trySend(label, dest, from, message) {
  try {
    await ethers.provider.call({
      to: XCM_PRECOMPILE,
      from,
      data: XCM_IFACE.encodeFunctionData("send", [dest, message])
    });
    console.log(`✅ send ${label}: accepted`);
  } catch (err) {
    console.log(`❌ send ${label}: ${err?.message || err}`);
  }
}

async function main() {
  const [signer] = await ethers.getSigners();
  const vaultAddress = (process.env.VAULT_ADDRESS || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(vaultAddress)) {
    throw new Error("Set VAULT_ADDRESS=0x...");
  }

  const vault = await ethers.getContractAt("HyperVault", vaultAddress, signer);
  const dotDecimals = Number(await vault.dotDecimals());
  const dotCurrencyId = await vault.dotCurrencyId();
  const destChainIndexRaw = await vault.destChainIndexRaw();
  const remark = await vault.remark();
  const channelId = Number(await vault.channelId());
  const hubSovereign = await vault.hubSovereign();

  const amountHuman = (process.env.DOT_AMOUNT || "0.1").trim();
  const amount = ethers.parseUnits(amountHuman, dotDecimals);
  const blockNumber = await ethers.provider.getBlockNumber();
  const network = await ethers.provider.getNetwork();
  const targetChain = ethers.concat([destChainIndexRaw, vaultAddress]);
  const mintCall = buildCreateOrderCall({
    caller: vaultAddress,
    chainId: Number(network.chainId),
    blockNumber,
    tokenBytes2: dotCurrencyId,
    amount,
    targetChain,
    remark,
    channelId
  });
  const message = buildMintMessage({
    dotAmount: amount,
    hubSovereign,
    mintCall
  });

  const dest = "0x05010100b91f";

  console.log("\n═══════════════════════════════════════════════");
  console.log("  HyperVault XCM Message Debug");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Vault        : ${vaultAddress}`);
  console.log(`  Amount       : ${amountHuman}`);
  console.log(`  Dot decimals : ${dotDecimals}`);
  console.log(`  Dot ccy id   : ${dotCurrencyId}`);
  console.log(`  Hub sovereign: ${hubSovereign}`);
  console.log(`  Dest         : ${dest}`);
  console.log(`  MintCall len : ${ethers.getBytes(mintCall).length}`);
  console.log(`  Message len  : ${ethers.getBytes(message).length}`);
  console.log(`\nMintCall:\n${mintCall}`);
  console.log(`\nMessage:\n${message}`);

  console.log("\nVariant probes:");
  const msgBase = buildMessageVariant({
    dotAmount: amount,
    hubSovereign,
    mintCall,
    includeTransact: false,
    includeRefund: false,
    depositVariant: "none"
  });
  const msgBaseTransact = buildMessageVariant({
    dotAmount: amount,
    hubSovereign,
    mintCall,
    includeTransact: true,
    includeRefund: false,
    depositVariant: "none"
  });
  const msgBaseTransactRefund = buildMessageVariant({
    dotAmount: amount,
    hubSovereign,
    mintCall,
    includeTransact: true,
    includeRefund: true,
    depositVariant: "none"
  });
  await tryWeigh("base (withdraw+buy)", msgBase);
  await tryWeigh("base+transact", msgBaseTransact);
  await tryWeigh("base+transact+refund", msgBaseTransactRefund);
  await tryWeigh("base+refund+deposit legacy", buildMessageVariant({
    dotAmount: amount,
    hubSovereign,
    mintCall,
    includeTransact: false,
    includeRefund: true,
    depositVariant: "legacy"
  }));
  await tryWeigh("base+refund+deposit + max", buildMessageVariant({
    dotAmount: amount,
    hubSovereign,
    mintCall,
    includeTransact: false,
    includeRefund: true,
    depositVariant: "with-max-assets"
  }));
  await tryWeigh("base+refund+deposit beneficiary Any", buildMessageVariant({
    dotAmount: amount,
    hubSovereign,
    mintCall,
    includeTransact: false,
    includeRefund: true,
    depositVariant: "beneficiary-network-any"
  }));
  await tryWeigh("base+refund+deposit beneficiary Any + max", buildMessageVariant({
    dotAmount: amount,
    hubSovereign,
    mintCall,
    includeTransact: false,
    includeRefund: true,
    depositVariant: "beneficiary-network-any-with-max"
  }));
  await tryWeigh("full legacy", buildMessageVariant({
    dotAmount: amount,
    hubSovereign,
    mintCall,
    includeTransact: true,
    includeRefund: true,
    depositVariant: "legacy"
  }));
  await tryWeigh("full + max", buildMessageVariant({
    dotAmount: amount,
    hubSovereign,
    mintCall,
    includeTransact: true,
    includeRefund: true,
    depositVariant: "with-max-assets"
  }));
  await tryWeigh("full beneficiary Any", buildMessageVariant({
    dotAmount: amount,
    hubSovereign,
    mintCall,
    includeTransact: true,
    includeRefund: true,
    depositVariant: "beneficiary-network-any"
  }));
  await tryWeigh("full beneficiary Any + max", buildMessageVariant({
    dotAmount: amount,
    hubSovereign,
    mintCall,
    includeTransact: true,
    includeRefund: true,
    depositVariant: "beneficiary-network-any-with-max"
  }));
  const msgFullFixed = buildMessageVariant({
    dotAmount: amount,
    hubSovereign,
    mintCall,
    includeTransact: true,
    includeRefund: true,
    depositVariant: "fixed"
  });
  await tryWeigh("full fixed", msgFullFixed);
  const msgFullAllCounted = buildMessageVariant({
    dotAmount: amount,
    hubSovereign,
    mintCall,
    includeTransact: true,
    includeRefund: true,
    depositVariant: "all-counted-1"
  });
  await tryWeigh("full all-counted-1", msgFullAllCounted);
  const msgFullDocsLike = buildMessageVariant({
    dotAmount: amount,
    hubSovereign,
    mintCall,
    includeTransact: true,
    includeRefund: true,
    depositVariant: "docs-like"
  });
  await tryWeigh("full docs-like", msgFullDocsLike);

  console.log("\nSend probes:");
  await trySend("base", dest, signer.address, msgBase);
  await trySend("base+transact", dest, signer.address, msgBaseTransact);
  await trySend("base+transact+refund", dest, signer.address, msgBaseTransactRefund);
  await trySend("full fixed", dest, signer.address, msgFullFixed);
  await trySend("full all-counted-1", dest, signer.address, msgFullAllCounted);
  await trySend("full docs-like", dest, signer.address, msgFullDocsLike);

  try {
    await ethers.provider.call({
      to: XCM_PRECOMPILE,
      from: signer.address,
      data: XCM_IFACE.encodeFunctionData("send", [dest, message])
    });
    console.log("✅ send(dest,message) static call accepted");
  } catch (err) {
    const data = err?.data?.data || err?.data || err?.error?.data;
    console.log(`❌ send(dest,message) static call reverted: ${err?.message || err}`);
    if (typeof data === "string") console.log(`   data: ${data}`);
  }

  if ((process.env.DO_TX_SEND || "").trim() === "1") {
    console.log("\nLive tx probe:");
    try {
      const tx = await signer.sendTransaction({
        to: XCM_PRECOMPILE,
        data: XCM_IFACE.encodeFunctionData("send", [dest, message]),
        gasLimit: 2_000_000
      });
      const rcpt = await tx.wait();
      console.log(`✅ precompile send tx hash: ${tx.hash}`);
      console.log(`   status=${rcpt.status} gasUsed=${rcpt.gasUsed.toString()}`);
    } catch (err) {
      console.log(`❌ precompile send tx failed: ${err?.message || err}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
