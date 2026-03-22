// ─────────────────────────────────────────────────────────────
//  Wagmi + RainbowKit configuration for HyperVault
//  Defines the Passet Hub testnet chain and wallet connectors.
// ─────────────────────────────────────────────────────────────

import { createConfig, http } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { defineChain } from 'viem';

// ── Passet Hub (Polkadot Hub TestNet) ─────────────────────────
export const polkadotTestnet = defineChain({
  id: 420420417,
  name: 'Polkadot Testnet',
  nativeCurrency: {
    name: 'PAS',
    symbol: 'PAS',
    decimals: 10,
  },
  rpcUrls: {
    default: {
      http: ['https://services.polkadothub-rpc.com/testnet'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Blockscout',
      url: 'https://blockscout-passet-hub.parity-testnet.parity.io',
    },
  },
  testnet: true,
});

// ── Wagmi config (injected wallets only; avoids WalletConnect dependency at runtime) ──
export const config = createConfig({
  chains: [polkadotTestnet],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [polkadotTestnet.id]: http('https://services.polkadothub-rpc.com/testnet'),
  },
});
