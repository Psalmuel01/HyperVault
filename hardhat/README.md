# HyperVault Hardhat Workspace

This workspace deploys and configures `HyperVault.sol` for **Polkadot Hub Testnet**.

## Required Environment Variables

Set these before running deployment/config scripts:

- `PRIVATE_KEY` deployer key (0x-prefixed).
- `DOT_ERC20_ADDRESS` DOT ERC-20 precompile address on Polkadot Hub.
- `VAULT_ADDRESS` set after deployment (for follow-up scripts).

Optional:

- `HUB_SOVEREIGN` bytes32 sovereign account if already known.
- `DOT_CURRENCY_ID`, `VDOT_CURRENCY_ID`, `DEST_CHAIN_INDEX_RAW`, `XCM_REMARK`, `CHANNEL_ID` for enabling live XCM.
- `XCM_REF_TIME`, `XCM_PROOF_SIZE` for weight tuning.

## Script Flow

1. Deploy:

```bash
DOT_ERC20_ADDRESS=0x... npx hardhat run scripts/deploy-all.js --network polkadotTestnet
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

4. Deposit smoke test:

```bash
VAULT_ADDRESS=0x... DOT_ERC20_ADDRESS=0x... npx hardhat run scripts/test-deposit.js --network polkadotTestnet
```
