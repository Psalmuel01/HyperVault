import { UserPosition, VaultState } from '@/hooks/use-vault';

interface UserFlowGuideProps {
  vaultState: VaultState;
  userPosition: UserPosition;
  tokenSymbol: string;
  autoRelayXcm: boolean;
}

type StepStatus = 'completed' | 'active' | 'upcoming';

const stepCardClass: Record<StepStatus, string> = {
  completed: 'border-accent/40 bg-accent/5',
  active: 'border-primary/50 bg-primary/5',
  upcoming: 'border-border bg-card',
};

const stepDotClass: Record<StepStatus, string> = {
  completed: 'bg-accent text-accent-foreground',
  active: 'bg-primary/70 text-primary-foreground',
  upcoming: 'bg-muted text-muted-foreground',
};

const StepCard = ({
  index,
  title,
  body,
  status,
}: {
  index: number;
  title: string;
  body: string;
  status: StepStatus;
}) => (
  <div className={`rounded-lg border p-4 transition-colors cursor-pointer ${stepCardClass[status]}`}>
    <div className="flex items-center gap-2 mb-2">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-ui font-semibold ${stepDotClass[status]}`}>
        {index}
      </div>
      <p className="text-xs font-ui font-semibold tracking-[0.14em] uppercase">{title}</p>
      {status === 'active' ? (
        <span className="ml-auto text-[10px] font-ui font-semibold tracking-[0.14em] uppercase text-primary">
          Current
        </span>
      ) : null}
    </div>
    <p className="text-sm font-ui text-muted-foreground leading-6">{body}</p>
  </div>
);

const UserFlowGuide = ({ vaultState, userPosition, tokenSymbol, autoRelayXcm }: UserFlowGuideProps) => {
  const hasDeposit = userPosition.shares > 0 || userPosition.dotValue > 0;
  const hasPending = userPosition.pendingWithdrawal > 0;
  const canWithdraw = hasDeposit && !hasPending;

  const depositStatus: StepStatus = hasDeposit || hasPending ? 'completed' : 'active';
  const relayStatus: StepStatus = !hasDeposit && !hasPending
    ? 'upcoming'
    : (vaultState.xcmEnabled ? 'completed' : 'active');
  const withdrawStatus: StepStatus = hasPending
    ? 'completed'
    : (canWithdraw ? 'active' : 'upcoming');
  const claimStatus: StepStatus = hasPending ? 'active' : 'upcoming';

  return (
    <div className="bg-card border border-border rounded-lg p-5 space-y-3">
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
          status={depositStatus}
          body={`Deposit native ${tokenSymbol} into HyperVault to mint shares.`}
        />
        <StepCard
          index={2}
          title="Relay XCM"
          status={relayStatus}
          body={vaultState.externalXcmExecutorMode
            ? (autoRelayXcm
              ? 'Your wallet auto-relays prepared XCM after confirmation.'
              : 'Relay required: submit prepared XCM from your wallet.')
            : 'Vault dispatches XCM directly from contract.'}
        />
        <StepCard
          index={3}
          title="Withdraw"
          status={withdrawStatus}
          body="Withdraw burns shares and triggers redeem path from Bifrost."
        />
        <StepCard
          index={4}
          title="Claim"
          status={claimStatus}
          body={hasPending
            ? (userPosition.claimReady
              ? `Settlement is attested. Claim redeemed ${tokenSymbol} now.`
              : `Waiting for operator settlement attestation before claim.`)
            : `Claim redeemed ${tokenSymbol} after withdrawal settlement.`}
        />
      </div>
    </div>
  );
};

export default UserFlowGuide;
