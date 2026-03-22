// ─────────────────────────────────────────────────────────────
//  HyperVault — Contract configuration
//  ABI extracted from hardhat/artifacts/contracts/HyperVault.sol
// ─────────────────────────────────────────────────────────────

import { type Address } from 'viem';

// ── Chain constants ──────────────────────────────────────────
export const PASSET_HUB_CHAIN_ID = 420420417;
export const PASSET_HUB_RPC = 'https://services.polkadothub-rpc.com/testnet';
export const BLOCK_EXPLORER = 'https://blockscout-passet-hub.parity-testnet.parity.io';

// ── Contract addresses (set via env vars, or fallback empty) ─
export const VAULT_ADDRESS = (import.meta.env.VITE_VAULT_ADDRESS ?? '') as Address;
export const DOT_TOKEN_ADDRESS = (import.meta.env.VITE_DOT_TOKEN_ADDRESS ?? '') as Address;
export const USE_NATIVE_DOT = String(import.meta.env.VITE_USE_NATIVE_DOT ?? '').toLowerCase() === 'true';

// ── DOT decimals on Polkadot Hub ─────────────────────────────
export const DOT_DECIMALS = 10;

// ── Minimal ERC-20 ABI ───────────────────────────────────────
export const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ── HyperVault ABI ───────────────────────────────────────────
export const VAULT_ABI = [
  { inputs: [{ internalType: 'address', name: '_dotToken', type: 'address' }, { internalType: 'bytes32', name: '_hubSovereign', type: 'bytes32' }, { internalType: 'bool', name: '_xcmEnabled', type: 'bool' }], stateMutability: 'nonpayable', type: 'constructor' },
  { inputs: [{ internalType: 'uint256', name: 'requested', type: 'uint256' }, { internalType: 'uint256', name: 'available', type: 'uint256' }], name: 'InsufficientShares', type: 'error' },
  { inputs: [{ internalType: 'uint256', name: 'expected', type: 'uint256' }, { internalType: 'uint256', name: 'actual', type: 'uint256' }], name: 'InvalidNativeDeposit', type: 'error' },
  { inputs: [], name: 'InvalidSovereign', type: 'error' },
  { inputs: [], name: 'NothingToWithdraw', type: 'error' },
  { inputs: [{ internalType: 'address', name: 'owner', type: 'address' }], name: 'OwnableInvalidOwner', type: 'error' },
  { inputs: [{ internalType: 'address', name: 'account', type: 'address' }], name: 'OwnableUnauthorizedAccount', type: 'error' },
  { inputs: [], name: 'ReentrancyGuardReentrantCall', type: 'error' },
  { inputs: [{ internalType: 'address', name: 'token', type: 'address' }], name: 'SafeERC20FailedOperation', type: 'error' },
  { inputs: [], name: 'TransferFailed', type: 'error' },
  { inputs: [{ internalType: 'uint256', name: 'actual', type: 'uint256' }], name: 'UnexpectedNativeValue', type: 'error' },
  { inputs: [], name: 'VaultPaused', type: 'error' },
  { inputs: [], name: 'XcmCallFailed', type: 'error' },
  { inputs: [], name: 'XcmNotConfigured', type: 'error' },
  { inputs: [], name: 'ZeroAmount', type: 'error' },
  { anonymous: false, inputs: [{ indexed: true, internalType: 'address', name: 'user', type: 'address' }, { indexed: false, internalType: 'uint256', name: 'dotAmount', type: 'uint256' }, { indexed: false, internalType: 'uint256', name: 'sharesIssued', type: 'uint256' }, { indexed: false, internalType: 'uint256', name: 'sharePrice', type: 'uint256' }], name: 'Deposited', type: 'event' },
  { anonymous: false, inputs: [{ indexed: false, internalType: 'uint256', name: 'yieldAdded', type: 'uint256' }, { indexed: false, internalType: 'uint256', name: 'newTotalDot', type: 'uint256' }], name: 'MockYieldAccrued', type: 'event' },
  { anonymous: false, inputs: [{ indexed: false, internalType: 'bytes32', name: 'hubSovereign', type: 'bytes32' }], name: 'HubSovereignUpdated', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, internalType: 'address', name: 'previousOwner', type: 'address' }, { indexed: true, internalType: 'address', name: 'newOwner', type: 'address' }], name: 'OwnershipTransferred', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, internalType: 'address', name: 'user', type: 'address' }, { indexed: false, internalType: 'uint256', name: 'dotReturned', type: 'uint256' }, { indexed: false, internalType: 'uint256', name: 'yieldEarned', type: 'uint256' }], name: 'WithdrawalCompleted', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, internalType: 'address', name: 'user', type: 'address' }, { indexed: false, internalType: 'uint256', name: 'sharesBurned', type: 'uint256' }, { indexed: false, internalType: 'uint256', name: 'dotEstimate', type: 'uint256' }], name: 'WithdrawalInitiated', type: 'event' },
  { anonymous: false, inputs: [{ indexed: false, internalType: 'bytes2', name: 'dotCurrencyId', type: 'bytes2' }, { indexed: false, internalType: 'bytes2', name: 'vDotCurrencyId', type: 'bytes2' }, { indexed: false, internalType: 'bytes1', name: 'destChainIndexRaw', type: 'bytes1' }, { indexed: false, internalType: 'string', name: 'remark', type: 'string' }, { indexed: false, internalType: 'uint32', name: 'channelId', type: 'uint32' }, { indexed: false, internalType: 'bool', name: 'enabled', type: 'bool' }], name: 'XcmConfigUpdated', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, internalType: 'address', name: 'user', type: 'address' }, { indexed: false, internalType: 'string', name: 'action', type: 'string' }, { indexed: false, internalType: 'uint256', name: 'dotAmount', type: 'uint256' }, { indexed: false, internalType: 'bool', name: 'live', type: 'bool' }], name: 'XcmDispatched', type: 'event' },
  { inputs: [], name: 'BIFROST_PARA_ID', outputs: [{ internalType: 'uint32', name: '', type: 'uint32' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'BPS', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'INITIAL_SHARE_PRICE', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'MOCK_APY_BPS', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'SECONDS_PER_YEAR', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'XCM_PRECOMPILE', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'channelId', outputs: [{ internalType: 'uint32', name: '', type: 'uint32' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'claimWithdrawal', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'user', type: 'address' }], name: 'completeWithdrawal', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'currentSharePrice', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: 'amount', type: 'uint256' }], name: 'deposit', outputs: [], stateMutability: 'payable', type: 'function' },
  { inputs: [{ internalType: 'address', name: '', type: 'address' }], name: 'depositTimestamp', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'depositorCount', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'destChainIndexRaw', outputs: [{ internalType: 'bytes1', name: '', type: 'bytes1' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'dotCurrencyId', outputs: [{ internalType: 'bytes2', name: '', type: 'bytes2' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'dotDecimals', outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'dotToken', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'user', type: 'address' }], name: 'getEstimatedYield', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'user', type: 'address' }], name: 'getUserInfo', outputs: [{ internalType: 'uint256', name: '_shares', type: 'uint256' }, { internalType: 'uint256', name: '_dotValue', type: 'uint256' }, { internalType: 'uint256', name: '_estimatedYield', type: 'uint256' }, { internalType: 'uint256', name: '_depositedAt', type: 'uint256' }, { internalType: 'uint256', name: '_pendingWithdrawal', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'user', type: 'address' }], name: 'getUserPositionDot', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getVaultState', outputs: [{ internalType: 'uint256', name: '_totalDotDeposited', type: 'uint256' }, { internalType: 'uint256', name: '_totalShares', type: 'uint256' }, { internalType: 'uint256', name: '_sharePrice', type: 'uint256' }, { internalType: 'uint256', name: '_mockAccruedYield', type: 'uint256' }, { internalType: 'uint256', name: '_depositorCount', type: 'uint256' }, { internalType: 'bool', name: '_xcmEnabled', type: 'bool' }, { internalType: 'bool', name: '_paused', type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'hubSovereign', outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'lastYieldTimestamp', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'mockAccruedYield', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'nativeDotMode', outputs: [{ internalType: 'bool', name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'owner', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'paused', outputs: [{ internalType: 'bool', name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: '', type: 'address' }], name: 'pendingWithdrawal', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: '', type: 'address' }], name: 'pendingWithdrawalBalanceStart', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'remark', outputs: [{ internalType: 'string', name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'renounceOwnership', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'to', type: 'address' }, { internalType: 'uint256', name: 'amount', type: 'uint256' }], name: 'rescueDot', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'bool', name: '_paused', type: 'bool' }], name: 'setPaused', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'bytes32', name: '_hubSovereign', type: 'bytes32' }], name: 'setHubSovereign', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'bytes2', name: '_dotCurrencyId', type: 'bytes2' }, { internalType: 'bytes2', name: '_vDotCurrencyId', type: 'bytes2' }, { internalType: 'bytes1', name: '_destChainIndexRaw', type: 'bytes1' }, { internalType: 'string', name: '_remark', type: 'string' }, { internalType: 'uint32', name: '_channelId', type: 'uint32' }, { internalType: 'bool', name: '_enabled', type: 'bool' }], name: 'setXcmConfig', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'uint64', name: '_refTime', type: 'uint64' }, { internalType: 'uint64', name: '_proofSize', type: 'uint64' }], name: 'setXcmWeights', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ internalType: 'address', name: '', type: 'address' }], name: 'shares', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalDotDeposited', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalShares', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'newOwner', type: 'address' }], name: 'transferOwnership', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'vDotCurrencyId', outputs: [{ internalType: 'bytes2', name: '', type: 'bytes2' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'uint256', name: 'shareAmount', type: 'uint256' }], name: 'withdraw', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'xcmEnabled', outputs: [{ internalType: 'bool', name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'xcmProofSize', outputs: [{ internalType: 'uint64', name: '', type: 'uint64' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'xcmRefTime', outputs: [{ internalType: 'uint64', name: '', type: 'uint64' }], stateMutability: 'view', type: 'function' },
] as const;
