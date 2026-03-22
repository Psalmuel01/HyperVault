# HyperVault Hardhat Workspace

This workspace deploys and configures `HyperVault.sol` for **Polkadot Hub Testnet**.

## Required Environment Variables

Set these before running deployment/config scripts:

- `PRIVATE_KEY` deployer key (0x-prefixed).
- `USE_NATIVE_DOT=true` to use canonical native token mode (recommended).
- `DOT_ERC20_ADDRESS` only for ERC-20 fallback mode.
- `DOT_ASSET_ID` optional alternative in ERC-20 mode; deploy script derives `DOT_ERC20_ADDRESS`.
- `VAULT_ADDRESS` set after deployment (for follow-up scripts).

Optional:

- `HUB_SOVEREIGN` bytes32 sovereign account if already known.
- `DOT_CURRENCY_ID`, `VDOT_CURRENCY_ID`, `DEST_CHAIN_INDEX_RAW`, `XCM_REMARK`, `CHANNEL_ID` for enabling live XCM.
- `XCM_REF_TIME`, `XCM_PROOF_SIZE` for weight tuning.

## Script Flow

1. Deploy:

```bash
USE_NATIVE_DOT=true npx hardhat run scripts/deploy-all.js --network polkadotTestnet
# or
DOT_ERC20_ADDRESS=0x... npx hardhat run scripts/deploy-all.js --network polkadotTestnet
```

Preflight probe (recommended before deploy):

```bash
npx hardhat run scripts/probe-hub-precompiles.js --network polkadotTestnet
```

2. (If needed) set sovereign after deriving it:

```bash
VAULT_ADDRESS=0x... HUB_SOVEREIGN=0x... npx hardhat run scripts/set-hub-sovereign.js --network polkadotTestnet
```

3. Enable live XCM:

```bash
VAULT_ADDRESS=0x... \
DOT_CURRENCY_ID=0x0800 \
VDOT_CURRENCY_ID=0x0900 \
DEST_CHAIN_INDEX_RAW=0x01 \
XCM_REMARK=HyperVault \
CHANNEL_ID=0 \
npx hardhat run scripts/configure-live-xcm.js --network polkadotTestnet
```

If live XCM needs to be paused quickly:

```bash
VAULT_ADDRESS=0x... npx hardhat run scripts/disable-live-xcm.js --network polkadotTestnet
```

4. Deposit smoke test (auto-detects native vs ERC-20 mode):

```bash
VAULT_ADDRESS=0x... npx hardhat run scripts/test-deposit.js --network polkadotTestnet
```

If using test ERC20 (like `tDOT`) and your balance is low, mint first:

```bash
DOT_ERC20_ADDRESS=0x... AMOUNT=50 npx hardhat run scripts/mint-test-token.js --network polkadotTestnet
```

5. Read-only live config check:

```bash
VAULT_ADDRESS=0x... npx hardhat run scripts/check-live-config.js --network polkadotTestnet
```
