import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface DepositPanelProps {
  dotBalance: number;
  sharePrice: number;
  totalShares: number;
  tokenSymbol: string;
  onDeposit: (amount: number) => void;
}

const DepositPanel = ({ dotBalance, sharePrice, totalShares, tokenSymbol, onDeposit }: DepositPanelProps) => {
  const [amount, setAmount] = useState('');
  const numAmount = parseFloat(amount) || 0;
  const sharesReceived = numAmount / sharePrice;
  const vaultPercent = totalShares > 0 ? (sharesReceived / (totalShares + sharesReceived)) * 100 : 100;

  const handleDeposit = () => {
    if (numAmount > 0 && numAmount <= dotBalance) {
      onDeposit(numAmount);
      setAmount('');
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-foreground">Deposit</h3>
        <span className="text-xs font-mono text-muted-foreground">Balance: {dotBalance.toFixed(2)} {tokenSymbol}</span>
      </div>

      <div className="relative">
        <input
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-muted border border-border rounded-md px-4 py-3 font-mono text-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <button
          onClick={() => setAmount(dotBalance.toString())}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-semibold text-primary tracking-widest uppercase hover:text-primary/80 transition-colors"
        >
          MAX
        </button>
      </div>

      {numAmount > 0 && (
        <div className="bg-muted rounded-md p-3 space-y-2 text-xs font-mono">
          <div className="flex justify-between text-muted-foreground">
            <span>Shares received</span>
            <span className="text-foreground">{sharesReceived.toFixed(4)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Vault share</span>
            <span className="text-foreground">{vaultPercent.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Rate</span>
            <span className="text-foreground">1 share = {sharePrice.toFixed(4)} {tokenSymbol}</span>
          </div>
        </div>
      )}

      <Button
        variant="vault"
        className="w-full py-5"
        disabled={numAmount <= 0 || numAmount > dotBalance}
        onClick={handleDeposit}
      >
        {numAmount > dotBalance ? 'Insufficient Balance' : `Deposit ${tokenSymbol}`}
      </Button>
    </div>
  );
};

export default DepositPanel;
