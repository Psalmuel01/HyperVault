import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useBalance, useReadContract, useWriteContract, usePublicClient, useWalletClient } from 'wagmi';
import { decodeEventLog, encodeFunctionData, formatUnits, parseUnits, type Address, type Log as ViemLog } from 'viem';
import { toast } from '@/components/ui/sonner';
import {
  VAULT_ABI,
  ERC20_ABI,
  XCM_PRECOMPILE_ABI,
  XCM_PRECOMPILE,
  VAULT_ADDRESS,
  DOT_TOKEN_ADDRESS,
  DOT_DECIMALS,
  USE_NATIVE_DOT,
  AUTO_RELAY_XCM,
} from '@/lib/contract';

// ─────────────────────────────────────────────────────────────
//  Types exported to components
// ─────────────────────────────────────────────────────────────

export interface UserPosition {
  shares: number;
  dotValue: number;
  yieldEarned: number;
  yieldPercent: number;
  depositTimestamp: number | null;
  pendingWithdrawal: number;
}

export interface VaultState {
  totalDOT: number;
  totalShares: number;
  sharePrice: number;
  apy: number;
  userCount: number;
  xcmEnabled: boolean;
  externalXcmExecutorMode: boolean;
  nativeDotMode: boolean;
  paused: boolean;
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'claim' | 'xcm_dispatch' | 'xcm_relay' | 'yield_accrual';
  user: string;
  amount: number;
  shares?: number;
  timestamp: number;
  status: 'confirmed' | 'pending' | 'dispatched';
  txHash: string;
}

// ─────────────────────────────────────────────────────────────
//  Mock fallback values (used when no contract is deployed)
// ─────────────────────────────────────────────────────────────

const MOCK_APY = 15.2;
const NATIVE_WALLET_DECIMALS = 18;
const ACTIVITY_LOOKBACK_BLOCKS = 20_000n;

const generateTxHash = () =>
  '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

const shortenAddress = (addr: string) =>
  addr.slice(0, 6) + '...' + addr.slice(-4);

// ─────────────────────────────────────────────────────────────
//  Helper: check if contract integration is configured
// ─────────────────────────────────────────────────────────────

const isContractConfigured = () =>
  VAULT_ADDRESS &&
  VAULT_ADDRESS.length > 2 &&
  (USE_NATIVE_DOT || (DOT_TOKEN_ADDRESS && DOT_TOKEN_ADDRESS.length > 2));

// ─────────────────────────────────────────────────────────────
//  Format helpers
// ─────────────────────────────────────────────────────────────

const fmtDot = (raw: bigint | undefined, decimals = DOT_DECIMALS): number => {
  if (!raw) return 0;
  return Number(formatUnits(raw, decimals));
};

const fmtShares = (raw: bigint | undefined): number => {
  if (!raw) return 0;
  return Number(formatUnits(raw, 18));
};

const fmtSharePrice = (raw: bigint | undefined): number => {
  if (!raw) return 1;
  // Share price is scaled by 1e18
  return Number(formatUnits(raw, 18));
};

// ─────────────────────────────────────────────────────────────
//  Main hook
// ─────────────────────────────────────────────────────────────

export function useVault() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const contractReady = isContractConfigured();

  // ── Pending transaction tracking ───────────────────────────
  const [pendingTx, setPendingTx] = useState<{ type: string; hash: string } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // ── Mock fallback state (when no contract) ─────────────────
  const [mockDotBalance, setMockDotBalance] = useState(100);
  const [mockVaultState, setMockVaultState] = useState<VaultState>({
    totalDOT: 12847.5,
    totalShares: 12532.1,
    sharePrice: 1.0252,
    apy: MOCK_APY,
    userCount: 47,
    xcmEnabled: false,
    externalXcmExecutorMode: false,
    nativeDotMode: true,
    paused: false,
  });
  const [mockUserPosition, setMockUserPosition] = useState<UserPosition>({
    shares: 0,
    dotValue: 0,
    yieldEarned: 0,
    yieldPercent: 0,
    depositTimestamp: null,
    pendingWithdrawal: 0,
  });

  // ── Contract reads: Vault state ────────────────────────────
  const { data: vaultStateRaw, refetch: refetchVaultState } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'getVaultState',
    query: { enabled: contractReady && isConnected, refetchInterval: 10_000 },
  });

  const { data: nativeModeRaw } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'nativeDotMode',
    query: { enabled: contractReady && isConnected },
  });

  const nativeDotMode = Boolean(nativeModeRaw ?? USE_NATIVE_DOT);

  const { data: externalXcmModeRaw } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'externalXcmExecutorMode',
    query: { enabled: contractReady && isConnected },
  });
  const externalXcmExecutorMode = Boolean(externalXcmModeRaw ?? false);

  const { data: vaultDotDecimalsRaw } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'dotDecimals',
    query: { enabled: contractReady && isConnected },
  });

  // ── Contract reads: User info ──────────────────────────────
  const { data: userInfoRaw, refetch: refetchUserInfo } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'getUserInfo',
    args: address ? [address] : undefined,
    query: { enabled: contractReady && isConnected && !!address, refetchInterval: 10_000 },
  });

  // ── Contract reads: DOT balance ────────────────────────────
  const tokenAddressForRead = (DOT_TOKEN_ADDRESS && DOT_TOKEN_ADDRESS.length > 2
    ? DOT_TOKEN_ADDRESS
    : '0x0000000000000000000000000000000000000000') as Address;

  const { data: dotBalanceRaw, refetch: refetchDotBalance } = useReadContract({
    address: tokenAddressForRead,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: contractReady && isConnected && !!address && !nativeDotMode, refetchInterval: 10_000 },
  });

  const { data: nativeBalanceRaw, refetch: refetchNativeBalance } = useBalance({
    address,
    query: { enabled: contractReady && isConnected && !!address && nativeDotMode, refetchInterval: 10_000 },
  });

  const { data: dotDecimalsRaw } = useReadContract({
    address: tokenAddressForRead,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled: contractReady && isConnected && !nativeDotMode },
  });

  // ── Contract writes ────────────────────────────────────────
  const { writeContractAsync } = useWriteContract();

  // ── Derived: vault state ───────────────────────────────────
  const vaultState: VaultState = useMemo(() => {
    if (!contractReady || !vaultStateRaw) return mockVaultState;

    const [totalDotDeposited, totalShares, sharePrice,, depositorCount, xcmEnabled, paused] = vaultStateRaw;
    const tokenDecimals = Number(vaultDotDecimalsRaw ?? dotDecimalsRaw ?? DOT_DECIMALS);

    return {
      totalDOT: fmtDot(totalDotDeposited, tokenDecimals),
      totalShares: fmtShares(totalShares),
      sharePrice: fmtSharePrice(sharePrice),
      apy: MOCK_APY, // APY is always mocked (Bifrost doesn't expose it on-chain)
      userCount: Number(depositorCount),
      xcmEnabled: xcmEnabled,
      externalXcmExecutorMode,
      nativeDotMode,
      paused: paused,
    };
  }, [contractReady, vaultStateRaw, mockVaultState, dotDecimalsRaw, vaultDotDecimalsRaw, externalXcmExecutorMode, nativeDotMode]);

  // ── Derived: user position ─────────────────────────────────
  const userPosition: UserPosition = useMemo(() => {
    if (!contractReady || !userInfoRaw) return mockUserPosition;

    const [shares, dotValue, estimatedYield, depositedAt, pendingWithdrawal] = userInfoRaw;
    const tokenDecimals = Number(vaultDotDecimalsRaw ?? dotDecimalsRaw ?? DOT_DECIMALS);

    const sharesNum = fmtShares(shares);
    const dotValueNum = fmtDot(dotValue, tokenDecimals);
    const yieldNum = fmtDot(estimatedYield, tokenDecimals);
    const principal = dotValueNum - yieldNum;

    return {
      shares: sharesNum,
      dotValue: dotValueNum,
      yieldEarned: yieldNum,
      yieldPercent: principal > 0 ? (yieldNum / principal) * 100 : 0,
      depositTimestamp: Number(depositedAt) > 0 ? Number(depositedAt) * 1000 : null,
      pendingWithdrawal: fmtDot(pendingWithdrawal, tokenDecimals),
    };
  }, [contractReady, userInfoRaw, mockUserPosition, dotDecimalsRaw, vaultDotDecimalsRaw]);

  // ── Derived: DOT balance ───────────────────────────────────
  const dotBalance: number = useMemo(() => {
    if (!contractReady) return mockDotBalance;
    const tokenDecimals = Number(vaultDotDecimalsRaw ?? dotDecimalsRaw ?? DOT_DECIMALS);
    if (nativeDotMode) {
      // Wallet/native EVM balance is exposed in 18-decimal units on Hub EVM.
      // Keep vault accounting decimals unchanged; this path is display/user-balance only.
      return fmtDot(nativeBalanceRaw?.value, NATIVE_WALLET_DECIMALS);
    }
    if (dotBalanceRaw === undefined) return mockDotBalance;
    return fmtDot(dotBalanceRaw, tokenDecimals);
  }, [contractReady, dotBalanceRaw, mockDotBalance, dotDecimalsRaw, nativeDotMode, nativeBalanceRaw?.value, vaultDotDecimalsRaw]);

  // ── Fetch contract events for activity feed ────────────────
  useEffect(() => {
    if (!contractReady || !publicClient || !isConnected) return;

    const fetchEvents = async () => {
      try {
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock > ACTIVITY_LOOKBACK_BLOCKS
          ? currentBlock - ACTIVITY_LOOKBACK_BLOCKS
          : 0n;

        const [depositLogs, withdrawInitiatedLogs, withdrawalCompletedLogs, xcmLogs] = await Promise.all([
          publicClient.getLogs({
            address: VAULT_ADDRESS,
            event: {
              type: 'event',
              name: 'Deposited',
              inputs: [
                { indexed: true, name: 'user', type: 'address' },
                { indexed: false, name: 'dotAmount', type: 'uint256' },
                { indexed: false, name: 'sharesIssued', type: 'uint256' },
                { indexed: false, name: 'sharePrice', type: 'uint256' },
              ],
            },
            fromBlock,
            toBlock: 'latest',
          }),
          publicClient.getLogs({
            address: VAULT_ADDRESS,
            event: {
              type: 'event',
              name: 'WithdrawalInitiated',
              inputs: [
                { indexed: true, name: 'user', type: 'address' },
                { indexed: false, name: 'sharesBurned', type: 'uint256' },
                { indexed: false, name: 'dotEstimate', type: 'uint256' },
              ],
            },
            fromBlock,
            toBlock: 'latest',
          }),
          publicClient.getLogs({
            address: VAULT_ADDRESS,
            event: {
              type: 'event',
              name: 'WithdrawalCompleted',
              inputs: [
                { indexed: true, name: 'user', type: 'address' },
                { indexed: false, name: 'dotReturned', type: 'uint256' },
                { indexed: false, name: 'yieldEarned', type: 'uint256' },
              ],
            },
            fromBlock,
            toBlock: 'latest',
          }),
          publicClient.getLogs({
            address: VAULT_ADDRESS,
            event: {
              type: 'event',
              name: 'XcmDispatched',
              inputs: [
                { indexed: true, name: 'user', type: 'address' },
                { indexed: false, name: 'action', type: 'string' },
                { indexed: false, name: 'dotAmount', type: 'uint256' },
                { indexed: false, name: 'live', type: 'bool' },
              ],
            },
            fromBlock,
            toBlock: 'latest',
          }),
        ]);

        const parsed: Transaction[] = [];
        const allLogs = [...depositLogs, ...withdrawInitiatedLogs, ...withdrawalCompletedLogs, ...xcmLogs];
        const uniqueBlockNumbers = Array.from(
          new Set(
            allLogs
              .map((log) => log.blockNumber?.toString())
              .filter((value): value is string => !!value),
          ),
        );

        const blockTimestampEntries = await Promise.all(
          uniqueBlockNumbers.map(async (blockNumberStr) => {
            const block = await publicClient.getBlock({ blockNumber: BigInt(blockNumberStr) });
            return [blockNumberStr, Number(block.timestamp) * 1000] as const;
          }),
        );
        const blockTimestamps = new Map<string, number>(blockTimestampEntries);

        const getLogTimestamp = (log: ViemLog) => {
          const blockNumberStr = log.blockNumber?.toString();
          if (!blockNumberStr) return Date.now();
          return blockTimestamps.get(blockNumberStr) ?? Date.now();
        };

        const formatActor = (actor: Address) =>
          address && actor.toLowerCase() === address.toLowerCase()
            ? 'You'
            : shortenAddress(actor);

        for (const log of depositLogs) {
          const args = (log as ViemLog & { args: { user: Address; dotAmount: bigint; sharesIssued: bigint } }).args;
          const tokenDecimals = Number(vaultDotDecimalsRaw ?? dotDecimalsRaw ?? DOT_DECIMALS);
          parsed.push({
            id: `${log.transactionHash}-${log.logIndex}`,
            type: 'deposit',
            user: formatActor(args.user),
            amount: fmtDot(args.dotAmount, tokenDecimals),
            shares: fmtShares(args.sharesIssued),
            timestamp: getLogTimestamp(log),
            status: 'confirmed',
            txHash: log.transactionHash || '',
          });
        }

        for (const log of withdrawInitiatedLogs) {
          const args = (log as ViemLog & { args: { user: Address; sharesBurned: bigint; dotEstimate: bigint } }).args;
          const tokenDecimals = Number(vaultDotDecimalsRaw ?? dotDecimalsRaw ?? DOT_DECIMALS);
          parsed.push({
            id: `${log.transactionHash}-${log.logIndex}`,
            type: 'withdraw',
            user: formatActor(args.user),
            amount: fmtDot(args.dotEstimate, tokenDecimals),
            shares: fmtShares(args.sharesBurned),
            timestamp: getLogTimestamp(log),
            status: 'confirmed',
            txHash: log.transactionHash || '',
          });
        }

        for (const log of withdrawalCompletedLogs) {
          const args = (log as ViemLog & { args: { user: Address; dotReturned: bigint } }).args;
          const tokenDecimals = Number(vaultDotDecimalsRaw ?? dotDecimalsRaw ?? DOT_DECIMALS);
          parsed.push({
            id: `${log.transactionHash}-${log.logIndex}`,
            type: 'claim',
            user: formatActor(args.user),
            amount: fmtDot(args.dotReturned, tokenDecimals),
            timestamp: getLogTimestamp(log),
            status: 'confirmed',
            txHash: log.transactionHash || '',
          });
        }

        for (const log of xcmLogs) {
          const args = (log as ViemLog & { args: { user: Address; action: string; dotAmount: bigint; live: boolean } }).args;
          const tokenDecimals = Number(vaultDotDecimalsRaw ?? dotDecimalsRaw ?? DOT_DECIMALS);
          parsed.push({
            id: `${log.transactionHash}-${log.logIndex}`,
            type: 'xcm_dispatch',
            user: formatActor(args.user),
            amount: fmtDot(args.dotAmount, tokenDecimals),
            timestamp: getLogTimestamp(log),
            status: args.live ? 'dispatched' : 'confirmed',
            txHash: log.transactionHash || '',
          });
        }

        // Sort newest first
        parsed.sort((a, b) => b.timestamp - a.timestamp);

        setTransactions(parsed.slice(0, 10));
      } catch (err) {
        // Silently fail — events are not critical and might not exist on new deployments
        console.warn('Failed to fetch events:', err);
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 30_000);
    return () => clearInterval(interval);
  }, [contractReady, publicClient, isConnected, dotDecimalsRaw, vaultDotDecimalsRaw, address]);

  const waitAndRefresh = useCallback(async (hash: `0x${string}`) => {
    if (!publicClient) return;
    await publicClient.waitForTransactionReceipt({ hash });
    await Promise.all([
      refetchVaultState(),
      refetchUserInfo(),
      refetchDotBalance(),
      refetchNativeBalance(),
    ]);
  }, [publicClient, refetchVaultState, refetchUserInfo, refetchDotBalance, refetchNativeBalance]);

  const extractPreparedXcm = useCallback((logs: readonly ViemLog[]) => {
    for (const log of logs) {
      if (!log.address || log.address.toLowerCase() !== VAULT_ADDRESS.toLowerCase()) continue;
      try {
        const decoded = decodeEventLog({
          abi: VAULT_ABI,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName !== 'XcmMessagePrepared') continue;
        const args = decoded.args as {
          user: Address;
          action: string;
          dotAmount: bigint;
          dest: `0x${string}`;
          message: `0x${string}`;
        };
        return args;
      } catch {
        // ignore unrelated logs
      }
    }
    return null;
  }, []);

  const relayPreparedXcm = useCallback(async (dest: `0x${string}`, message: `0x${string}`) => {
    if (!walletClient || !publicClient || !address) {
      throw new Error('Wallet client not ready for XCM relay.');
    }
    const relayHash = await walletClient.sendTransaction({
      account: address,
      to: XCM_PRECOMPILE,
      data: encodeFunctionData({
        abi: XCM_PRECOMPILE_ABI,
        functionName: 'send',
        args: [dest, message],
      }),
      gas: 2_000_000n,
    });
    await waitAndRefresh(relayHash);
    return relayHash;
  }, [walletClient, publicClient, address, waitAndRefresh]);

  // ─────────────────────────────────────────────────────────────
  //  Actions
  // ─────────────────────────────────────────────────────────────

  const deposit = useCallback(async (amount: number) => {
    if (amount <= 0 || amount > dotBalance) return;

    // ── Contract mode ───────────────────────────────────────
    if (contractReady && address && publicClient) {
      try {
        const tokenDecimals = Number(vaultDotDecimalsRaw ?? dotDecimalsRaw ?? DOT_DECIMALS);
        const rawAmount = parseUnits(amount.toString(), tokenDecimals);
        const short = shortenAddress(address);

        let depositHash: `0x${string}`;
        if (nativeDotMode) {
          setPendingTx({ type: `Depositing ${nativeDotMode ? 'PAS' : 'DOT'}`, hash: '' });
          depositHash = await writeContractAsync({
            address: VAULT_ADDRESS,
            abi: VAULT_ABI,
            functionName: 'deposit',
            args: [rawAmount],
            value: rawAmount,
          });
        } else {
          // Step 1: Approve DOT spending
          setPendingTx({ type: 'Approving token spend...', hash: '' });

          const approveHash = await writeContractAsync({
            address: DOT_TOKEN_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [VAULT_ADDRESS, rawAmount],
          });

          toast.info('Approval submitted, waiting for confirmation...');
          await waitAndRefresh(approveHash);

          // Step 2: Deposit
          setPendingTx({ type: 'Depositing token into HyperVault...', hash: approveHash });
          depositHash = await writeContractAsync({
            address: VAULT_ADDRESS,
            abi: VAULT_ABI,
            functionName: 'deposit',
            args: [rawAmount],
          });
        }

        setPendingTx({ type: 'Confirming deposit...', hash: depositHash });

        setTransactions(prev => [
          { id: Date.now().toString(), type: 'deposit', user: short, amount, timestamp: Date.now(), status: 'pending', txHash: depositHash },
          ...prev,
        ]);

        const depositReceipt = await publicClient.waitForTransactionReceipt({ hash: depositHash });
        await waitAndRefresh(depositHash);

        const prepared = extractPreparedXcm(depositReceipt.logs);
        const tokenLabel = nativeDotMode ? 'PAS' : 'DOT';

        if (externalXcmExecutorMode) {
          if (prepared && AUTO_RELAY_XCM) {
            setPendingTx({ type: 'Relaying XCM to Bifrost...', hash: '' });
            const relayHash = await relayPreparedXcm(prepared.dest, prepared.message);
            setTransactions(prev => [
              {
                id: `${Date.now()}-relay`,
                type: 'xcm_relay',
                user: short,
                amount,
                timestamp: Date.now(),
                status: 'dispatched',
                txHash: relayHash,
              },
              ...prev,
            ]);
            toast.success(`Deposit confirmed and XCM relayed for ${amount} ${tokenLabel}.`);
          } else if (prepared) {
            toast.warning('Deposit confirmed. XCM message prepared but auto-relay is disabled.');
          } else {
            toast.warning('Deposit confirmed, but no prepared XCM message was found in logs.');
          }
        } else {
          toast.success(`Deposit confirmed and XCM dispatched by contract for ${amount} ${tokenLabel}.`);
        }

        setPendingTx(null);
      } catch (err: unknown) {
        setPendingTx(null);
        const msg = err instanceof Error ? err.message : 'Transaction failed';
        if (msg.includes('User rejected') || msg.includes('user rejected')) {
          toast.error('Transaction rejected by user.');
        } else {
          toast.error(`Deposit failed: ${msg.slice(0, 120)}`);
        }
      }
      return;
    }

    // ── Mock fallback ────────────────────────────────────────
    const txHash = generateTxHash();
    setPendingTx({ type: 'Depositing DOT & dispatching XCM to Bifrost', hash: txHash });

    setTimeout(() => {
      const shares = amount / mockVaultState.sharePrice;
      const newUserShares = mockUserPosition.shares + shares;
      const newDotValue = newUserShares * mockVaultState.sharePrice;

      setMockDotBalance(prev => prev - amount);
      setMockUserPosition({
        shares: newUserShares,
        dotValue: newDotValue,
        yieldEarned: newDotValue - (mockUserPosition.dotValue > 0 ? mockUserPosition.dotValue - mockUserPosition.yieldEarned + amount : amount),
        yieldPercent: 0,
        depositTimestamp: mockUserPosition.depositTimestamp || Date.now(),
        pendingWithdrawal: mockUserPosition.pendingWithdrawal,
      });
      setMockVaultState(prev => ({
        ...prev,
        totalDOT: prev.totalDOT + amount,
        totalShares: prev.totalShares + shares,
        userCount: mockUserPosition.shares === 0 ? prev.userCount + 1 : prev.userCount,
      }));

      const short = address ? shortenAddress(address) : '0x0000...0000';
      setTransactions(prev => [
        { id: Date.now().toString(), type: 'deposit', user: short, amount, shares, timestamp: Date.now(), status: 'confirmed', txHash },
        { id: (Date.now() + 1).toString(), type: 'xcm_dispatch', user: short, amount, timestamp: Date.now(), status: 'dispatched', txHash: generateTxHash() },
        ...prev,
      ]);

      setPendingTx(null);
    }, 2500);
  }, [
    dotBalance,
    contractReady,
    address,
    publicClient,
    writeContractAsync,
    mockVaultState,
    mockUserPosition,
    dotDecimalsRaw,
    nativeDotMode,
    vaultDotDecimalsRaw,
    extractPreparedXcm,
    externalXcmExecutorMode,
    relayPreparedXcm,
    waitAndRefresh,
  ]);

  const withdraw = useCallback(async (shareAmount: number) => {
    if (shareAmount <= 0 || shareAmount > userPosition.shares) return;

    // ── Contract mode ───────────────────────────────────────
    if (contractReady && address && publicClient) {
      try {
        const rawShares = parseUnits(shareAmount.toString(), 18);
        const short = shortenAddress(address);
        const amountEstimate = shareAmount * vaultState.sharePrice;

        setPendingTx({ type: 'Submitting withdrawal request...', hash: '' });

        const withdrawHash = await writeContractAsync({
          address: VAULT_ADDRESS,
          abi: VAULT_ABI,
          functionName: 'withdraw',
          args: [rawShares],
        });

        setPendingTx({ type: 'Confirming withdrawal...', hash: withdrawHash });

        setTransactions(prev => [
          { id: Date.now().toString(), type: 'withdraw', user: short, amount: amountEstimate, shares: shareAmount, timestamp: Date.now(), status: 'pending', txHash: withdrawHash },
          ...prev,
        ]);

        const withdrawReceipt = await publicClient.waitForTransactionReceipt({ hash: withdrawHash });
        await waitAndRefresh(withdrawHash);

        if (externalXcmExecutorMode) {
          const prepared = extractPreparedXcm(withdrawReceipt.logs);
          if (prepared && AUTO_RELAY_XCM) {
            setPendingTx({ type: 'Relaying redeem XCM from wallet...', hash: '' });
            const relayHash = await relayPreparedXcm(prepared.dest, prepared.message);
            setTransactions(prev => [
              {
                id: `${Date.now()}-xcm-relay`,
                type: 'xcm_relay',
                user: short,
                amount: amountEstimate,
                timestamp: Date.now(),
                status: 'dispatched',
                txHash: relayHash,
              },
              ...prev,
            ]);
            toast.success('Withdrawal requested and redeem XCM relayed.');
          } else if (prepared) {
            toast.warning('Withdrawal requested. XCM message prepared but auto-relay is disabled.');
          } else {
            toast.warning('Withdrawal requested, but no prepared XCM message was found in logs.');
          }
        } else {
          toast.success('Withdrawal request confirmed and redeem XCM dispatched by contract.');
        }

        setPendingTx(null);
      } catch (err: unknown) {
        setPendingTx(null);
        const msg = err instanceof Error ? err.message : 'Transaction failed';
        if (msg.includes('User rejected') || msg.includes('user rejected')) {
          toast.error('Transaction rejected by user.');
        } else {
          toast.error(`Withdrawal failed: ${msg.slice(0, 120)}`);
        }
      }
      return;
    }

    // ── Mock fallback ────────────────────────────────────────
    const txHash = generateTxHash();
    setPendingTx({ type: 'Redeeming vDOT via XCM from Bifrost', hash: txHash });

    setTimeout(() => {
      const dotAmount = shareAmount * mockVaultState.sharePrice;
      const newShares = mockUserPosition.shares - shareAmount;
      const newDotValue = newShares * mockVaultState.sharePrice;

      setMockDotBalance(prev => prev + dotAmount);
      setMockUserPosition({
        shares: newShares,
        dotValue: newDotValue,
        yieldEarned: newShares > 0 ? mockUserPosition.yieldEarned * (newShares / mockUserPosition.shares) : 0,
        yieldPercent: newShares > 0 ? mockUserPosition.yieldPercent : 0,
        depositTimestamp: newShares > 0 ? mockUserPosition.depositTimestamp : null,
        pendingWithdrawal: mockUserPosition.pendingWithdrawal,
      });
      setMockVaultState(prev => ({
        ...prev,
        totalDOT: prev.totalDOT - dotAmount,
        totalShares: prev.totalShares - shareAmount,
        userCount: newShares === 0 ? prev.userCount - 1 : prev.userCount,
      }));

      const short = address ? shortenAddress(address) : '0x0000...0000';
      setTransactions(prev => [
        { id: Date.now().toString(), type: 'withdraw', user: short, amount: dotAmount, shares: shareAmount, timestamp: Date.now(), status: 'confirmed', txHash },
        ...prev,
      ]);

      setPendingTx(null);
    }, 3000);
  }, [
    userPosition,
    vaultState.sharePrice,
    contractReady,
    address,
    publicClient,
    writeContractAsync,
    mockVaultState,
    mockUserPosition,
    externalXcmExecutorMode,
    extractPreparedXcm,
    relayPreparedXcm,
    waitAndRefresh,
  ]);

  const claimWithdrawal = useCallback(async () => {
    if (userPosition.pendingWithdrawal <= 0) return;

    if (contractReady && address && publicClient) {
      try {
        setPendingTx({ type: 'Claiming redeemed DOT', hash: '' });

        const claimHash = await writeContractAsync({
          address: VAULT_ADDRESS,
          abi: VAULT_ABI,
          functionName: 'claimWithdrawal',
          args: [],
        });

        setPendingTx({ type: 'Claiming redeemed DOT', hash: claimHash });

        const short = shortenAddress(address);
        setTransactions(prev => [
          {
            id: Date.now().toString(),
            type: 'claim',
            user: short,
            amount: userPosition.pendingWithdrawal,
            timestamp: Date.now(),
            status: 'pending',
            txHash: claimHash,
          },
          ...prev,
        ]);
        await waitAndRefresh(claimHash);
        setPendingTx(null);
        toast.success('Claim confirmed.');
      } catch (err: unknown) {
        setPendingTx(null);
        const msg = err instanceof Error ? err.message : 'Transaction failed';
        if (msg.includes('User rejected') || msg.includes('user rejected')) {
          toast.error('Transaction rejected by user.');
        } else {
          toast.error(`Claim failed: ${msg.slice(0, 120)}`);
        }
      }
      return;
    }

    // Mock mode: clear pending balance immediately.
    setMockDotBalance(prev => prev + mockUserPosition.pendingWithdrawal);
    setMockUserPosition(prev => ({ ...prev, pendingWithdrawal: 0 }));
  }, [userPosition.pendingWithdrawal, contractReady, address, publicClient, writeContractAsync, mockUserPosition.pendingWithdrawal, waitAndRefresh]);

  return {
    connected: isConnected,
    walletAddress: address ?? '',
    tokenSymbol: nativeDotMode ? 'PAS' : 'DOT',
    nativeDotMode,
    externalXcmExecutorMode,
    autoRelayXcm: AUTO_RELAY_XCM,
    dotBalance,
    vaultState,
    userPosition,
    transactions,
    pendingTx,
    deposit,
    withdraw,
    claimWithdrawal,
  };
}
