import { UserPosition, VaultState } from '@/hooks/use-vault';

interface UserFlowGuideProps {
  vaultState: VaultState;
  userPosition: UserPosition;
  tokenSymbol: string;
  autoRelayXcm: boolean;
}

const StepCard = ({
  index,
  title,
  body,
  done,
}: {
  index: number;
  title: string;
  body: string;
  done: boolean;
}) => (
  <div className={`rounded-lg border p-4 ${done ? 'border-accent/40 bg-accent/5' : 'border-border bg-card'}`}>
    <div className="flex items-center gap-2 mb-2">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-ui font-semibold ${done ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
        {index}
      </div>
      <p className="text-xs font-ui font-semibold tracking-[0.14em] uppercase">{title}</p>
    </div>
    <p className="text-sm font-ui text-muted-foreground leading-6">{body}</p>
  </div>
);

const UserFlowGuide = ({ vaultState, userPosition, tokenSymbol, autoRelayXcm }: UserFlowGuideProps) => {
  const hasDeposit = userPosition.shares > 0 || userPosition.dotValue > 0;
  const hasPending = userPosition.pendingWithdrawal > 0;

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg">Guided Flow</h3>
        <span className="text-[10px] font-ui font-semibold text-muted-foreground tracking-[0.14em] uppercase">
          {vaultState.xcmEnabled ? 'Live Mode' : 'Safe Mode'}
        </span>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <StepCard
          index={1}
          title="Deposit"
          done={hasDeposit}
          body={`Deposit native ${tokenSymbol} into HyperVault to mint shares.`}
        />
        <StepCard
          index={2}
          title="Relay XCM"
          done={hasDeposit && vaultState.xcmEnabled}
          body={vaultState.externalXcmExecutorMode
            ? (autoRelayXcm
              ? 'Your wallet auto-relays prepared XCM after confirmation.'
              : 'Relay required: submit prepared XCM from your wallet.')
            : 'Vault dispatches XCM directly from contract.'}
        />
        <StepCard
          index={3}
          title="Withdraw"
          done={hasPending || !hasDeposit}
          body="Withdraw burns shares and triggers redeem path from Bifrost."
        />
        <StepCard
          index={4}
          title="Claim"
          done={!hasPending}
          body={`Claim redeemed ${tokenSymbol} when pending balance becomes available.`}
        />
      </div>
    </div>
  );
};

export default UserFlowGuide;
