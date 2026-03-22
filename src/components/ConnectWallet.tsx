import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link } from 'react-router-dom';
import HyperVaultLogo from '@/components/HyperVaultLogo';

interface ConnectWalletProps {
  onConnect?: () => void;
  vaultStats: { apy: number; totalDOT: number; tokenSymbol: string };
}

const ConnectWallet = ({ vaultStats }: ConnectWalletProps) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute top-5 right-6 z-20">
        <Link
          to="/about"
          className="inline-flex items-center rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-[10px] font-ui font-semibold text-primary hover:bg-primary/15 tracking-[0.16em] uppercase transition-colors"
        >
          About
        </Link>
      </div>

      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* Glow orbs */}
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/3 right-1/4 w-72 h-72 bg-secondary/5 rounded-full blur-[100px]" />

      <div className="relative z-10 flex flex-col items-center gap-10 max-w-lg px-6">
        <div className="animate-float">
          <HyperVaultLogo className="scale-150" />
        </div>

        <div className="text-center space-y-3">
          <h2 className="font-display text-4xl md:text-5xl text-foreground leading-tight">
            Native {vaultStats.tokenSymbol} Yield.
            <br />
            <span className="text-gradient">No Bridges.</span>
          </h2>
          <p className="font-ui text-base text-muted-foreground max-w-md leading-7">
            Deposit {vaultStats.tokenSymbol} → Earn ~{vaultStats.apy}% APY via Bifrost vDOT → Withdraw {vaultStats.tokenSymbol} + yield.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full">
          {[
            '1. Connect',
            '2. Deposit',
            '3. Relay XCM',
            '4. Withdraw + Claim',
          ].map((step) => (
            <div key={step} className="rounded-md border border-border bg-card/50 px-3 py-2 text-[11px] font-ui font-semibold text-muted-foreground text-center">
              {step}
            </div>
          ))}
        </div>

        {/* RainbowKit ConnectButton — styled to match HyperVault theme */}
        <ConnectButton.Custom>
          {({ openConnectModal, mounted }) => {
            const ready = mounted;
            return (
              <div
                {...(!ready && {
                  'aria-hidden': true,
                  style: { opacity: 0, pointerEvents: 'none' as const, userSelect: 'none' as const },
                })}
              >
                <button
                  onClick={openConnectModal}
                  className="px-12 py-4 text-sm font-ui font-semibold tracking-[0.14em] uppercase rounded-md bg-gradient-to-r from-primary to-secondary text-primary-foreground transition-all duration-300 hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] glow-primary"
                >
                  Connect Wallet
                </button>
              </div>
            );
          }}
        </ConnectButton.Custom>

        <div className="flex items-center gap-6 text-xs font-ui text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span>APY: ~{vaultStats.apy}%</span>
          </div>
          <div className="h-3 w-px bg-border" />
          <span>TVL: {vaultStats.totalDOT.toLocaleString()} {vaultStats.tokenSymbol}</span>
          <div className="h-3 w-px bg-border" />
          <span>Powered by Bifrost</span>
        </div>
      </div>

      {/* Architecture hint */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-ui font-semibold text-muted-foreground/40 tracking-[0.14em] uppercase">
        XCM · Polkadot Hub EVM · Solidity
      </div>
    </div>
  );
};

export default ConnectWallet;
