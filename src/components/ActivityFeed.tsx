import { Transaction } from '@/hooks/use-vault';
import { BLOCK_EXPLORER } from '@/lib/contract';

interface ActivityFeedProps {
  transactions: Transaction[];
  tokenSymbol: string;
}

const typeLabels: Record<string, { label: string; color: string }> = {
  deposit: { label: 'DEPOSIT', color: 'text-accent' },
  withdraw: { label: 'WITHDRAW', color: 'text-primary' },
  claim: { label: 'CLAIM', color: 'text-accent' },
  xcm_dispatch: { label: 'XCM', color: 'text-secondary' },
  xcm_relay: { label: 'RELAY', color: 'text-secondary' },
  yield_accrual: { label: 'YIELD', color: 'text-accent' },
};

const statusDots: Record<string, string> = {
  confirmed: 'bg-accent',
  pending: 'bg-yellow-400',
  dispatched: 'bg-secondary animate-pulse',
};

const ActivityFeed = ({ transactions, tokenSymbol }: ActivityFeedProps) => {
  const recent = transactions.slice(0, 6);
  const formatAgo = (timestamp: number) => {
    const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-3">
      <h3 className="font-display text-lg text-foreground">Activity</h3>

      <div className="space-y-2">
        {recent.length === 0 ? (
          <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-4 text-sm font-ui text-muted-foreground">
            No on-chain activity yet for this vault/account.
          </div>
        ) : null}
        {recent.map((tx) => {
          const info = typeLabels[tx.type] || { label: tx.type, color: 'text-foreground' };
          const timeStr = formatAgo(tx.timestamp);

          return (
            <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-1.5 h-1.5 rounded-full ${statusDots[tx.status]}`} />
                <span className={`text-[10px] font-ui font-semibold tracking-[0.14em] ${info.color}`}>
                  {info.label}
                </span>
                <span className="text-sm font-ui text-muted-foreground">{tx.user}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-foreground">{tx.amount.toFixed(2)} {tokenSymbol}</span>
                <span className="text-[10px] font-mono text-muted-foreground/60">{timeStr}</span>
                {tx.txHash ? (
                  <a
                    href={`${BLOCK_EXPLORER}/tx/${tx.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-ui font-semibold text-primary/80 hover:text-primary"
                  >
                    view
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActivityFeed;
