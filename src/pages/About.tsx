import { Link } from 'react-router-dom';
import { BLOCK_EXPLORER, PASSET_HUB_CHAIN_ID, VAULT_ADDRESS } from '@/lib/contract';

const About = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="font-display text-2xl">About HyperVault</h1>
          <Link
            to="/"
            className="inline-flex items-center rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-ui font-semibold text-primary hover:bg-primary/15 transition-colors"
          >
            Back To App
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <section className="bg-card border border-border rounded-xl p-6 space-y-3">
          <h2 className="font-display text-2xl">Overview</h2>
          <p className="text-sm font-ui text-muted-foreground leading-7">
            HyperVault is a Polkadot Hub EVM vault for native PAS/DOT deposits. Deposits mint vault shares, then trigger
            cross-chain staking intent toward Bifrost (vDOT strategy). On exit, users initiate redeem, wait for settlement,
            and claim returned funds.
          </p>
        </section>

        <section className="grid md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-5 space-y-2">
            <p className="text-[10px] font-ui font-semibold text-muted-foreground tracking-[0.14em] uppercase">Step 1</p>
            <h3 className="font-display text-xl">Deposit</h3>
            <p className="text-sm font-ui text-muted-foreground">You deposit native PAS on Polkadot Hub Testnet.</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 space-y-2">
            <p className="text-[10px] font-ui font-semibold text-muted-foreground tracking-[0.14em] uppercase">Step 2</p>
            <h3 className="font-display text-xl">Relay XCM</h3>
            <p className="text-sm font-ui text-muted-foreground">Your wallet relays the prepared cross-chain XCM message.</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 space-y-2">
            <p className="text-[10px] font-ui font-semibold text-muted-foreground tracking-[0.14em] uppercase">Step 3</p>
            <h3 className="font-display text-xl">Redeem</h3>
            <p className="text-sm font-ui text-muted-foreground">On withdraw, HyperVault prepares redeem XCM to unwind vDOT.</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 space-y-2">
            <p className="text-[10px] font-ui font-semibold text-muted-foreground tracking-[0.14em] uppercase">Step 4</p>
            <h3 className="font-display text-xl">Claim</h3>
            <p className="text-sm font-ui text-muted-foreground">When funds return, you claim your PAS/DOT back.</p>
          </div>
        </section>

        <section className="bg-card border border-border rounded-xl p-6 space-y-3">
          <h2 className="font-display text-2xl">Live Deployment</h2>
          <div className="text-sm font-ui text-muted-foreground space-y-2">
            <p>Chain ID: <span className="font-mono">{PASSET_HUB_CHAIN_ID}</span></p>
            <p>Vault: <span className="font-mono">{VAULT_ADDRESS || 'Not set in frontend env'}</span></p>
            {VAULT_ADDRESS ? (
              <a
                href={`${BLOCK_EXPLORER}/address/${VAULT_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-primary hover:text-primary/80"
              >
                Open Vault On Explorer
              </a>
            ) : null}
          </div>
        </section>

        <section className="bg-muted/40 border border-border rounded-xl p-6 space-y-2">
          <h2 className="font-display text-xl">Execution Model On Testnet</h2>
          <p className="text-sm font-ui text-muted-foreground leading-7">
            On current Hub testnet, contract-origin XCM send may fail. HyperVault therefore supports external relayer mode:
            the vault emits prepared XCM payloads and the connected wallet relays them. This preserves live functionality
            while keeping vault accounting and user state fully on-chain.
          </p>
        </section>
      </main>
    </div>
  );
};

export default About;
