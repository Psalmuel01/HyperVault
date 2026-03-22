import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link } from 'react-router-dom';
import HyperVaultLogo from '@/components/HyperVaultLogo';
import ConnectWallet from '@/components/ConnectWallet';
import VaultStatsBar from '@/components/VaultStatsBar';
import DepositPanel from '@/components/DepositPanel';
import PositionPanel from '@/components/PositionPanel';
import ActivityFeed from '@/components/ActivityFeed';
import TransactionOverlay from '@/components/TransactionOverlay';
import UserFlowGuide from '@/components/UserFlowGuide';
import { useVault } from '@/hooks/use-vault';

const formatBalance = (value: number) =>
  value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

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
      <header className="border-b border-border bg-card/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <HyperVaultLogo />
        <div className="flex items-center gap-3">
          <Link
            to="/about"
            className="inline-flex items-center rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-[10px] font-ui font-semibold text-primary hover:bg-primary/15 tracking-[0.16em] uppercase transition-colors"
          >
            About
          </Link>
          <div className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
            <p className="text-[10px] font-ui font-semibold text-muted-foreground tracking-[0.16em] uppercase">Balance</p>
            <p className="text-xs font-mono font-medium text-accent">{formatBalance(vault.dotBalance)} {vault.tokenSymbol}</p>
          </div>
          <ConnectButton.Custom>
            {({ account, chain, mounted, openAccountModal, openChainModal, openConnectModal }) => {
              const ready = mounted;
              const connected = ready && account && chain;
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-ui font-semibold text-primary hover:bg-primary/15 transition-colors"
                  >
                    Connect Wallet
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openChainModal}
                    className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-[10px] font-ui font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {chain.name}
                  </button>
                  <button
                    onClick={openAccountModal}
                    className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-ui font-semibold text-foreground hover:border-primary/40 transition-colors"
                  >
                    {account.displayName}
                  </button>
                </div>
              );
            }}
          </ConnectButton.Custom>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* XCM status banner */}
        <div className="flex items-center gap-2 text-[11px] font-ui text-muted-foreground/70 bg-muted/50 rounded-md px-4 py-2 border border-border/50">
          <div className={`w-1.5 h-1.5 rounded-full ${vault.vaultState.xcmEnabled ? 'bg-accent' : 'bg-secondary'} animate-pulse`} />
          <span>
            {vault.vaultState.xcmEnabled
              ? (
                vault.vaultState.externalXcmExecutorMode
                  ? 'Live mode: external relayer (wallet submits prepared XCM)'
                  : 'Live mode: in-contract XCM dispatch'
              )
              : 'Safe mode: deposits work, but cross-chain yield dispatch is off'}
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

        <UserFlowGuide
          vaultState={vault.vaultState}
          userPosition={vault.userPosition}
          tokenSymbol={vault.tokenSymbol}
          autoRelayXcm={vault.autoRelayXcm}
        />

        <VaultStatsBar vaultState={vault.vaultState} userPosition={vault.userPosition} tokenSymbol={vault.tokenSymbol} />

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <DepositPanel
              dotBalance={vault.dotBalance}
              sharePrice={vault.vaultState.sharePrice}
              totalShares={vault.vaultState.totalShares}
              tokenSymbol={vault.tokenSymbol}
              xcmEnabled={vault.vaultState.xcmEnabled}
              externalXcmExecutorMode={vault.vaultState.externalXcmExecutorMode}
              autoRelayXcm={vault.autoRelayXcm}
              onDeposit={vault.deposit}
            />
            <PositionPanel
              position={vault.userPosition}
              sharePrice={vault.vaultState.sharePrice}
              tokenSymbol={vault.tokenSymbol}
              xcmEnabled={vault.vaultState.xcmEnabled}
              externalXcmExecutorMode={vault.vaultState.externalXcmExecutorMode}
              onWithdraw={vault.withdraw}
              onClaimWithdrawal={vault.claimWithdrawal}
            />
          </div>
          <ActivityFeed transactions={vault.transactions} tokenSymbol={vault.tokenSymbol} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 px-6 py-4 mt-12">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-[10px] font-ui font-semibold text-muted-foreground/80 tracking-[0.14em] uppercase">
          <span>HyperVault · Polkadot Hub EVM</span>
          <span>{vault.tokenSymbol} ↔ vDOT · ~{vault.vaultState.apy}% APY</span>
          <span>Hackathon Build · March 2026</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
