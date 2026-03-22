import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface DepositPanelProps {
  dotBalance: number;
  sharePrice: number;
  totalShares: number;
  tokenSymbol: string;
  xcmEnabled: boolean;
  externalXcmExecutorMode: boolean;
  autoRelayXcm: boolean;
  onDeposit: (amount: number) => void;
}

const DepositPanel = ({
  dotBalance,
  sharePrice,
  totalShares,
  tokenSymbol,
  xcmEnabled,
  externalXcmExecutorMode,
  autoRelayXcm,
  onDeposit,
}: DepositPanelProps) => {
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
        <span className="text-xs font-ui text-muted-foreground">Balance: <span className="font-mono">{dotBalance.toFixed(2)} {tokenSymbol}</span></span>
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
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-ui font-semibold text-primary tracking-[0.14em] uppercase hover:text-primary/80 transition-colors"
        >
          MAX
        </button>
      </div>

      {numAmount > 0 && (
        <div className="bg-muted rounded-md p-3 space-y-2 text-xs font-ui">
          <div className="flex justify-between text-muted-foreground">
            <span>Shares received</span>
            <span className="text-foreground font-mono">{sharesReceived.toFixed(4)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Vault share</span>
            <span className="text-foreground font-mono">{vaultPercent.toFixed(2)}%</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Rate</span>
            <span className="text-foreground font-mono">1 share = {sharePrice.toFixed(4)} {tokenSymbol}</span>
          </div>
        </div>
      )}

      <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
        <p className="text-[10px] font-ui font-semibold text-muted-foreground tracking-[0.14em] uppercase mb-1">What Happens Next</p>
        <p className="text-sm font-ui text-muted-foreground leading-6">
          {!xcmEnabled
            ? 'Deposit is recorded on-chain, but XCM yield dispatch is currently off.'
            : externalXcmExecutorMode
              ? (autoRelayXcm
                ? 'After wallet confirmation, app auto-relays prepared XCM to Bifrost.'
                : 'After deposit, relay the prepared XCM manually from wallet/scripts.')
              : 'Vault contract dispatches XCM to Bifrost in the same flow.'}
        </p>
      </div>

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
