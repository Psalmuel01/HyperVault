import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserPosition } from '@/hooks/use-vault';

interface PositionPanelProps {
  position: UserPosition;
  sharePrice: number;
  onWithdraw: (shares: number) => void;
  onClaimWithdrawal: () => void;
}

const PositionPanel = ({ position, sharePrice, onWithdraw, onClaimWithdrawal }: PositionPanelProps) => {
  const [withdrawMode, setWithdrawMode] = useState(false);
  const [shareAmount, setShareAmount] = useState('');
  const numShares = parseFloat(shareAmount) || 0;
  const dotOut = numShares * sharePrice;

  const handleWithdraw = () => {
    if (numShares > 0 && numShares <= position.shares) {
      onWithdraw(numShares);
      setShareAmount('');
      setWithdrawMode(false);
    }
  };

  if (position.shares === 0 && position.pendingWithdrawal <= 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-5 flex flex-col items-center justify-center min-h-[200px] text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-muted-foreground">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-sm font-mono text-muted-foreground">No active position</p>
        <p className="text-xs font-mono text-muted-foreground/60 mt-1">Deposit DOT to start earning yield</p>
      </div>
    );
  }

  const depositAge = position.depositTimestamp
    ? Math.floor((Date.now() - position.depositTimestamp) / 60000)
    : 0;

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-3">
      <h3 className="font-display text-lg text-foreground">Your Position</h3>

      {position.pendingWithdrawal > 0 && (
        <div className="bg-muted rounded-md p-3 space-y-2">
          <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">Pending Withdrawal</p>
          <p className="text-sm font-mono text-foreground">
            {position.pendingWithdrawal.toFixed(4)} DOT is ready once redeem settles.
          </p>
          <Button variant="vault" className="w-full py-4" onClick={onClaimWithdrawal}>
            Claim Redeemed DOT
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-muted rounded-md p-3">
          <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase block mb-1">Shares</span>
          <span className="text-base font-mono font-semibold text-foreground">{position.shares.toFixed(4)}</span>
        </div>
        <div className="bg-muted rounded-md p-3">
          <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase block mb-1">DOT Value</span>
          <span className="text-base font-mono font-semibold text-foreground">{position.dotValue.toFixed(4)}</span>
        </div>
        <div className="bg-muted rounded-md p-3">
          <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase block mb-1">Yield Earned</span>
          <span className="text-base font-mono font-semibold text-accent">
            +{position.yieldEarned.toFixed(4)} DOT
          </span>
        </div>
        <div className="bg-muted rounded-md p-3">
          <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase block mb-1">Deposited</span>
          <span className="text-base font-mono font-semibold text-foreground">{depositAge}m ago</span>
        </div>
      </div>

      {!withdrawMode ? (
        <Button
          variant="vault-outline"
          className="w-full py-4"
          disabled={position.shares <= 0 || position.pendingWithdrawal > 0}
          onClick={() => setWithdrawMode(true)}
        >
          Withdraw
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <input
              type="number"
              placeholder="Shares to redeem"
              value={shareAmount}
              onChange={(e) => setShareAmount(e.target.value)}
              className="w-full bg-muted border border-border rounded-md px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <button
              onClick={() => setShareAmount(position.shares.toString())}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-semibold text-primary tracking-widest uppercase"
            >
              MAX
            </button>
          </div>
          {numShares > 0 && (
            <p className="text-xs font-mono text-muted-foreground">
              You'll receive ≈ <span className="text-accent">{dotOut.toFixed(4)} DOT</span>
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="vault" className="flex-1 py-4" disabled={numShares <= 0 || numShares > position.shares} onClick={handleWithdraw}>
              Confirm Withdraw
            </Button>
            <Button variant="ghost" className="py-4 text-xs font-mono text-muted-foreground" onClick={() => { setWithdrawMode(false); setShareAmount(''); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PositionPanel;
