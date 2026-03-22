import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { formatUnits, parseUnits, type Address, type Log } from 'viem';
import { toast } from '@/components/ui/sonner';
import { VAULT_ABI, ERC20_ABI, VAULT_ADDRESS, DOT_TOKEN_ADDRESS, DOT_DECIMALS, USE_NATIVE_DOT } from '@/lib/contract';

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
  paused: boolean;
}

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw' | 'claim' | 'xcm_dispatch' | 'yield_accrual';
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

const generateTxHash = () =>
  '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

const shortenAddress = (addr: string) =>
  addr.slice(0, 6) + '...' + addr.slice(-4);

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: '1', type: 'deposit', user: '0x7a3b...4f2e', amount: 250, shares: 243.9, timestamp: Date.now() - 120000, status: 'confirmed', txHash: generateTxHash() },
  { id: '2', type: 'xcm_dispatch', user: '0x7a3b...4f2e', amount: 250, timestamp: Date.now() - 118000, status: 'confirmed', txHash: generateTxHash() },
  { id: '3', type: 'deposit', user: '0x9c1d...8a3f', amount: 500, shares: 487.8, timestamp: Date.now() - 60000, status: 'confirmed', txHash: generateTxHash() },
  { id: '4', type: 'yield_accrual', user: 'vault', amount: 0.42, timestamp: Date.now() - 30000, status: 'confirmed', txHash: generateTxHash() },
  { id: '5', type: 'xcm_dispatch', user: '0x9c1d...8a3f', amount: 500, timestamp: Date.now() - 58000, status: 'dispatched', txHash: generateTxHash() },
];

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
  const contractReady = isContractConfigured();

  // ── Pending transaction tracking ───────────────────────────
  const [pendingTx, setPendingTx] = useState<{ type: string; hash: string } | null>(null);
  const [pendingTxHash, setPendingTxHash] = useState<`0x${string}` | undefined>();
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);

  // ── Mock fallback state (when no contract) ─────────────────
  const [mockDotBalance, setMockDotBalance] = useState(100);
  const [mockVaultState, setMockVaultState] = useState<VaultState>({
    totalDOT: 12847.5,
    totalShares: 12532.1,
    sharePrice: 1.0252,
    apy: MOCK_APY,
    userCount: 47,
    xcmEnabled: false,
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

  // ── Wait for pending tx confirmation ───────────────────────
  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({
    hash: pendingTxHash,
  });

  // Clear pending state on tx confirmation
  useEffect(() => {
    if (txConfirmed && pendingTxHash) {
      setPendingTx(null);
      setPendingTxHash(undefined);
      // Refresh all data
      refetchVaultState();
      refetchUserInfo();
      refetchDotBalance();
      refetchNativeBalance();
      toast.success('Transaction confirmed!');
    }
  }, [txConfirmed, pendingTxHash, refetchVaultState, refetchUserInfo, refetchDotBalance, refetchNativeBalance]);

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
      paused: paused,
    };
  }, [contractReady, vaultStateRaw, mockVaultState, dotDecimalsRaw, vaultDotDecimalsRaw]);

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
      return fmtDot(nativeBalanceRaw?.value, tokenDecimals);
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
        const fromBlock = currentBlock > 500n ? currentBlock - 500n : 0n;

        const [depositLogs, withdrawLogs, xcmLogs] = await Promise.all([
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

        for (const log of depositLogs) {
          const args = (log as Log & { args: { user: Address; dotAmount: bigint; sharesIssued: bigint } }).args;
          const tokenDecimals = Number(vaultDotDecimalsRaw ?? dotDecimalsRaw ?? DOT_DECIMALS);
          parsed.push({
            id: `${log.transactionHash}-${log.logIndex}`,
            type: 'deposit',
            user: shortenAddress(args.user),
            amount: fmtDot(args.dotAmount, tokenDecimals),
            shares: fmtShares(args.sharesIssued),
            timestamp: Date.now(), // Block timestamps need separate fetch; using now as approximation
            status: 'confirmed',
            txHash: log.transactionHash || '',
          });
        }

        for (const log of withdrawLogs) {
          const args = (log as Log & { args: { user: Address; sharesBurned: bigint; dotEstimate: bigint } }).args;
          const tokenDecimals = Number(vaultDotDecimalsRaw ?? dotDecimalsRaw ?? DOT_DECIMALS);
          parsed.push({
            id: `${log.transactionHash}-${log.logIndex}`,
            type: 'withdraw',
            user: shortenAddress(args.user),
            amount: fmtDot(args.dotEstimate, tokenDecimals),
            shares: fmtShares(args.sharesBurned),
            timestamp: Date.now(),
            status: 'confirmed',
            txHash: log.transactionHash || '',
          });
        }

        for (const log of xcmLogs) {
          const args = (log as Log & { args: { user: Address; action: string; dotAmount: bigint; live: boolean } }).args;
          const tokenDecimals = Number(vaultDotDecimalsRaw ?? dotDecimalsRaw ?? DOT_DECIMALS);
          parsed.push({
            id: `${log.transactionHash}-${log.logIndex}`,
            type: 'xcm_dispatch',
            user: shortenAddress(args.user),
            amount: fmtDot(args.dotAmount, tokenDecimals),
            timestamp: Date.now(),
            status: args.live ? 'dispatched' : 'confirmed',
            txHash: log.transactionHash || '',
          });
        }

        // Sort newest first
        parsed.sort((a, b) => b.timestamp - a.timestamp);

        if (parsed.length > 0) {
          setTransactions(parsed.slice(0, 10));
        }
      } catch (err) {
        // Silently fail — events are not critical and might not exist on new deployments
        console.warn('Failed to fetch events:', err);
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 30_000);
    return () => clearInterval(interval);
  }, [contractReady, publicClient, isConnected, dotDecimalsRaw, vaultDotDecimalsRaw]);

  // ─────────────────────────────────────────────────────────────
  //  Actions
  // ─────────────────────────────────────────────────────────────

  const deposit = useCallback(async (amount: number) => {
    if (amount <= 0 || amount > dotBalance) return;

    // ── Contract mode ───────────────────────────────────────
    if (contractReady && address) {
      try {
        const tokenDecimals = Number(vaultDotDecimalsRaw ?? dotDecimalsRaw ?? DOT_DECIMALS);
        const rawAmount = parseUnits(amount.toString(), tokenDecimals);

        let depositHash: `0x${string}`;
        if (nativeDotMode) {
          setPendingTx({ type: 'Depositing canonical PAS/DOT & dispatching XCM to Bifrost', hash: '' });
          depositHash = await writeContractAsync({
            address: VAULT_ADDRESS,
            abi: VAULT_ABI,
            functionName: 'deposit',
            args: [rawAmount],
            value: rawAmount,
          });
        } else {
          // Step 1: Approve DOT spending
          setPendingTx({ type: 'Approving DOT...', hash: '' });

          const approveHash = await writeContractAsync({
            address: DOT_TOKEN_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [VAULT_ADDRESS, rawAmount],
          });

          toast.info('Approval submitted, waiting for confirmation...');

          if (publicClient) {
            await publicClient.waitForTransactionReceipt({ hash: approveHash });
          }

          // Step 2: Deposit
          setPendingTx({ type: 'Depositing DOT & dispatching XCM to Bifrost', hash: approveHash });
          depositHash = await writeContractAsync({
            address: VAULT_ADDRESS,
            abi: VAULT_ABI,
            functionName: 'deposit',
            args: [rawAmount],
          });
        }

        setPendingTx({ type: 'Depositing DOT & dispatching XCM to Bifrost', hash: depositHash });
        setPendingTxHash(depositHash);

        // Add to transactions immediately as pending
        const short = shortenAddress(address);
        setTransactions(prev => [
          { id: Date.now().toString(), type: 'deposit', user: short, amount, timestamp: Date.now(), status: 'pending', txHash: depositHash },
          ...prev,
        ]);

      } catch (err: unknown) {
        setPendingTx(null);
        setPendingTxHash(undefined);
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
  }, [dotBalance, contractReady, address, writeContractAsync, publicClient, mockVaultState, mockUserPosition, dotDecimalsRaw, nativeDotMode, vaultDotDecimalsRaw]);

  const withdraw = useCallback(async (shareAmount: number) => {
    if (shareAmount <= 0 || shareAmount > userPosition.shares) return;

    // ── Contract mode ───────────────────────────────────────
    if (contractReady && address) {
      try {
        const rawShares = parseUnits(shareAmount.toString(), 18);

        setPendingTx({ type: 'Redeeming vDOT via XCM from Bifrost', hash: '' });

        const withdrawHash = await writeContractAsync({
          address: VAULT_ADDRESS,
          abi: VAULT_ABI,
          functionName: 'withdraw',
          args: [rawShares],
        });

        setPendingTx({ type: 'Redeeming vDOT via XCM from Bifrost', hash: withdrawHash });
        setPendingTxHash(withdrawHash);

        const short = shortenAddress(address);
        setTransactions(prev => [
          { id: Date.now().toString(), type: 'withdraw', user: short, amount: shareAmount * vaultState.sharePrice, shares: shareAmount, timestamp: Date.now(), status: 'pending', txHash: withdrawHash },
          ...prev,
        ]);

      } catch (err: unknown) {
        setPendingTx(null);
        setPendingTxHash(undefined);
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
  }, [userPosition, vaultState.sharePrice, contractReady, address, writeContractAsync, mockVaultState, mockUserPosition]);

  const claimWithdrawal = useCallback(async () => {
    if (userPosition.pendingWithdrawal <= 0) return;

    if (contractReady && address) {
      try {
        setPendingTx({ type: 'Claiming redeemed DOT', hash: '' });

        const claimHash = await writeContractAsync({
          address: VAULT_ADDRESS,
          abi: VAULT_ABI,
          functionName: 'claimWithdrawal',
          args: [],
        });

        setPendingTx({ type: 'Claiming redeemed DOT', hash: claimHash });
        setPendingTxHash(claimHash);

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
      } catch (err: unknown) {
        setPendingTx(null);
        setPendingTxHash(undefined);
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
  }, [userPosition.pendingWithdrawal, contractReady, address, writeContractAsync, mockUserPosition.pendingWithdrawal]);

  return {
    connected: isConnected,
    walletAddress: address ?? '',
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
