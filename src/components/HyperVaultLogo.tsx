const HyperVaultLogo = ({ className = '' }: { className?: string }) => (
  <div className={`flex items-center gap-3 ${className}`}>
    <div className="relative">
      <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center glow-primary">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-primary">
          <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-accent rounded-full animate-pulse" />
    </div>
    <div>
      <h1 className="font-display text-xl tracking-tight text-foreground">HyperVault</h1>
      <p className="text-[10px] font-ui font-semibold text-muted-foreground tracking-[0.14em] uppercase">Polkadot Hub</p>
    </div>
  </div>
);

export default HyperVaultLogo;
