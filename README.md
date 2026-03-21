# HyperVault

HyperVault is a Solidity vault targeting **Polkadot Hub (EVM)** that:

1. Accepts `DOT` deposits (ERC-20 precompile token)
2. Dispatches XCM messages to Bifrost for `DOT -> vDOT`
3. Tracks user shares in-vault
4. Handles async redemption (`vDOT -> DOT`) and user claims

## Locked Architecture

- Execution chain: **Polkadot Hub Testnet** (`chainId: 420420417`)
- Deposit token: **DOT ERC-20 precompile token**
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

## Contract Deployment

Use the Hardhat workspace guide:

- [/Users/sam/Desktop/Polkadot/HyperVault/hardhat/README.md](/Users/sam/Desktop/Polkadot/HyperVault/hardhat/README.md)

Quick flow:

```bash
cd hardhat
DOT_ERC20_ADDRESS=0x... npx hardhat run scripts/deploy-all.js --network polkadotTestnet
VAULT_ADDRESS=0x... HUB_SOVEREIGN=0x... npx hardhat run scripts/set-hub-sovereign.js --network polkadotTestnet
VAULT_ADDRESS=0x... DOT_CURRENCY_ID=0x0800 VDOT_CURRENCY_ID=0x0900 DEST_CHAIN_INDEX_RAW=0x01 XCM_REMARK=HyperVault CHANNEL_ID=0 npx hardhat run scripts/configure-live-xcm.js --network polkadotTestnet
```

## Commands

```bash
npm run build
npm run lint
npm run test
cd hardhat && npx hardhat test
```
