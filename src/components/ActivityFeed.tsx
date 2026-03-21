import { Transaction } from '@/hooks/use-vault';

interface ActivityFeedProps {
  transactions: Transaction[];
}

const typeLabels: Record<string, { label: string; color: string }> = {
  deposit: { label: 'DEPOSIT', color: 'text-accent' },
  withdraw: { label: 'WITHDRAW', color: 'text-primary' },
  claim: { label: 'CLAIM', color: 'text-accent' },
  xcm_dispatch: { label: 'XCM', color: 'text-secondary' },
  yield_accrual: { label: 'YIELD', color: 'text-accent' },
};

const statusDots: Record<string, string> = {
  confirmed: 'bg-accent',
  pending: 'bg-yellow-400',
  dispatched: 'bg-secondary animate-pulse',
};

const ActivityFeed = ({ transactions }: ActivityFeedProps) => {
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
                <span className={`text-[10px] font-mono font-semibold tracking-widest ${info.color}`}>
                  {info.label}
                </span>
                <span className="text-xs font-mono text-muted-foreground">{tx.user}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-foreground">{tx.amount.toFixed(2)} DOT</span>
                <span className="text-[10px] font-mono text-muted-foreground/60">{timeStr}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ActivityFeed;
