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

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-3">
      <h3 className="font-display text-lg text-foreground">Activity</h3>

      <div className="space-y-2">
        {recent.map((tx) => {
          const info = typeLabels[tx.type] || { label: tx.type, color: 'text-foreground' };
          const ago = Math.floor((Date.now() - tx.timestamp) / 1000);
          const timeStr = ago < 60 ? `${ago}s` : `${Math.floor(ago / 60)}m`;

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
