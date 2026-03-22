import { ConnectButton } from '@rainbow-me/rainbowkit';
import HyperVaultLogo from '@/components/HyperVaultLogo';
import ConnectWallet from '@/components/ConnectWallet';
import VaultStatsBar from '@/components/VaultStatsBar';
import DepositPanel from '@/components/DepositPanel';
import PositionPanel from '@/components/PositionPanel';
import ActivityFeed from '@/components/ActivityFeed';
import TransactionOverlay from '@/components/TransactionOverlay';
import { useVault } from '@/hooks/use-vault';

const Index = () => {
  const vault = useVault();

  if (!vault.connected) {
    return (
      <ConnectWallet
        vaultStats={{ apy: vault.vaultState.apy, totalDOT: vault.vaultState.totalDOT, tokenSymbol: vault.tokenSymbol }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {vault.pendingTx && (
        <TransactionOverlay type={vault.pendingTx.type} hash={vault.pendingTx.hash} />
      )}

      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <HyperVaultLogo />
        <div className="flex items-center gap-4">
          <div className="text-right mr-2">
            <p className="text-xs font-mono text-accent">{vault.dotBalance.toFixed(2)} {vault.tokenSymbol}</p>
          </div>
          {/* RainbowKit provides the address, chain, and disconnect in one component */}
          <ConnectButton
            accountStatus="address"
            chainStatus="icon"
            showBalance={false}
          />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* XCM status banner */}
        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/60 bg-muted/50 rounded-md px-4 py-2 border border-border/50">
          <div className={`w-1.5 h-1.5 rounded-full ${vault.vaultState.xcmEnabled ? 'bg-accent' : 'bg-secondary'} animate-pulse`} />
          <span>
            {vault.vaultState.xcmEnabled
              ? (
                vault.vaultState.externalXcmExecutorMode
                  ? 'Live mode: external relayer (wallet submits prepared XCM)'
                  : 'Live mode: in-contract XCM dispatch'
              )
              : 'XCM dispatch disabled — configure live mode before production deposits'}
          </span>
          <span className="ml-auto">
            {vault.vaultState.xcmEnabled
              ? (
                vault.autoRelayXcm
                  ? 'Auto-relay: ON'
                  : 'Auto-relay: OFF'
              )
              : 'Fallback mode: simulated vDOT APY'}
          </span>
        </div>

        <VaultStatsBar vaultState={vault.vaultState} userPosition={vault.userPosition} tokenSymbol={vault.tokenSymbol} />

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <DepositPanel
              dotBalance={vault.dotBalance}
              sharePrice={vault.vaultState.sharePrice}
              totalShares={vault.vaultState.totalShares}
              tokenSymbol={vault.tokenSymbol}
              onDeposit={vault.deposit}
            />
            <PositionPanel
              position={vault.userPosition}
              sharePrice={vault.vaultState.sharePrice}
              tokenSymbol={vault.tokenSymbol}
              onWithdraw={vault.withdraw}
              onClaimWithdrawal={vault.claimWithdrawal}
            />
          </div>
          <ActivityFeed transactions={vault.transactions} tokenSymbol={vault.tokenSymbol} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-4 mt-12">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-[10px] font-mono text-muted-foreground/40 tracking-widest uppercase">
          <span>HyperVault · Polkadot Hub EVM</span>
          <span>{vault.tokenSymbol} ↔ vDOT · ~{vault.vaultState.apy}% APY</span>
          <span>Hackathon Build · March 2026</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
