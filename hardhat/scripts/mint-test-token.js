// scripts/mint-test-token.js
// ─────────────────────────────────────────────────────────────
//  Mint helper for test ERC20 tokens exposing `mint(address,uint256)`.
//
//  Required env:
//    TOKEN_ADDRESS or DOT_ERC20_ADDRESS
//
//  Optional env:
//    TO                 (default: signer)
//    AMOUNT             (human units, default: 50)
//    DECIMALS           (override; if omitted tries token.decimals(), fallback 18)
//
//  Usage:
//    DOT_ERC20_ADDRESS=0x... AMOUNT=50 npx hardhat run scripts/mint-test-token.js --network polkadotTestnet
// ─────────────────────────────────────────────────────────────

const { ethers } = require("hardhat");

function requireAddress(value, name) {
  const v = (value || "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(v)) {
    throw new Error(`${name} must be a 20-byte hex address`);
  }
  return v;
}

async function safeDecimals(token) {
  try {
    const d = await token.decimals();
    return Number(d);
  } catch {
    return 18;
  }
}

async function main() {
  const [signer] = await ethers.getSigners();
  const tokenAddress = requireAddress(
    process.env.TOKEN_ADDRESS || process.env.DOT_ERC20_ADDRESS,
    "TOKEN_ADDRESS / DOT_ERC20_ADDRESS"
  );
  const to = process.env.TO
    ? requireAddress(process.env.TO, "TO")
    : signer.address;

  const token = await ethers.getContractAt(
    ["function mint(address to, uint256 amount)", "function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
    tokenAddress,
    signer
  );

  const decimals = process.env.DECIMALS
    ? Number(process.env.DECIMALS)
    : await safeDecimals(token);
  const amountHuman = (process.env.AMOUNT || "50").trim();
  const amount = ethers.parseUnits(amountHuman, decimals);

  console.log("\n═══════════════════════════════════════════════");
  console.log("  Test Token Mint");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Signer : ${signer.address}`);
  console.log(`  Token  : ${tokenAddress}`);
  console.log(`  To     : ${to}`);
  console.log(`  Amount : ${amountHuman} (${amount.toString()} raw)`);

  const tx = await token.mint(to, amount);
  await tx.wait();
  console.log(`✅ Minted (tx: ${tx.hash})`);

  const bal = await token.balanceOf(to);
  console.log(`  New balance (raw): ${bal.toString()}`);
  console.log("═══════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
