# HyperVault

HyperVault is a Solidity vault targeting **Polkadot Hub (EVM)** that:

1. Accepts canonical hub token deposits (`PAS` on testnet, `DOT` on mainnet)
2. Builds and dispatches XCM messages to Bifrost for `DOT -> vDOT`
3. Tracks user shares in-vault
4. Handles async redemption (`vDOT -> DOT`) and user claims

## Locked Architecture

- Execution chain: **Polkadot Hub Testnet** (`chainId: 420420417`)
- Deposit token mode: **native canonical token (recommended)** or ERC-20 fallback
- Yield source: **Bifrost vDOT**
- Cross-chain transport: **XCM precompile**
- Withdraw model: **async redeem + claim**

## Repository Layout

- Frontend: `/src`
- Contracts: `/hardhat/contracts`
- Deployment/config scripts: `/hardhat/scripts`

## Frontend Setup

```bash
npm install
npm run dev
```

Frontend env values are written by deploy script into:

- `/Users/sam/Desktop/Polkadot/HyperVault/hardhat/.env.frontend`

Copy those values into:

- `/Users/sam/Desktop/Polkadot/HyperVault/.env`

For current Hub testnet runtime behavior, keep:

- `VITE_USE_NATIVE_DOT=true`
- `VITE_AUTO_RELAY_XCM=true` (frontend relays prepared XCM from wallet)

## Contract Deployment

Use the Hardhat workspace guide:

- [/Users/sam/Desktop/Polkadot/HyperVault/hardhat/README.md](/Users/sam/Desktop/Polkadot/HyperVault/hardhat/README.md)

Quick flow:

```bash
cd hardhat
USE_NATIVE_DOT=true npx hardhat run scripts/deploy-all.js --network polkadotTestnet
# or (fallback only): DOT_ERC20_ADDRESS=0x... npx hardhat run scripts/deploy-all.js --network polkadotTestnet
npx hardhat run scripts/probe-hub-precompiles.js --network polkadotTestnet
VAULT_ADDRESS=0x... HUB_SOVEREIGN=0x... npx hardhat run scripts/set-hub-sovereign.js --network polkadotTestnet
VAULT_ADDRESS=0x... DOT_CURRENCY_ID=0x0800 VDOT_CURRENCY_ID=0x0900 DEST_CHAIN_INDEX_RAW=0x01 XCM_REMARK=HyperVault CHANNEL_ID=0 EXTERNAL_XCM_MODE=true npx hardhat run scripts/configure-live-xcm.js --network polkadotTestnet
DOT_ERC20_ADDRESS=0x... AMOUNT=50 npx hardhat run scripts/mint-test-token.js --network polkadotTestnet
VAULT_ADDRESS=0x... npx hardhat run scripts/check-live-config.js --network polkadotTestnet
```

## Commands

```bash
npm run build
npm run lint
npm run test
cd hardhat && npx hardhat test
```
