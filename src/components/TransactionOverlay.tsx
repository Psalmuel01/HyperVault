import { BLOCK_EXPLORER } from '@/lib/contract';

interface TransactionOverlayProps {
  type: string;
  hash: string;
}

const TransactionOverlay = ({ type, hash }: TransactionOverlayProps) => {
  const explorerUrl = hash ? `${BLOCK_EXPLORER}/tx/${hash}` : '';

  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 max-w-sm text-center px-6">
        {/* Animated vault icon */}
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center animate-xcm-pulse glow-primary">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" className="text-primary">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
          {/* Orbiting dot */}
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-secondary rounded-full animate-pulse" />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-mono text-foreground">{type}</p>
          <p className="text-xs font-mono text-primary animate-pulse">
            Waiting for wallet + chain confirmation...
          </p>
        </div>

        {hash && (
          <div className="bg-card border border-border rounded-md px-4 py-2">
            <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-1">TX HASH</p>
            {explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-primary/80 hover:text-primary break-all transition-colors underline underline-offset-2"
              >
                {hash}
              </a>
            ) : (
              <p className="text-xs font-mono text-muted-foreground break-all">{hash}</p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/60">
          <div className="w-1 h-1 rounded-full bg-accent animate-pulse" />
          <span>Awaiting confirmation</span>
        </div>
      </div>
    </div>
  );
};

export default TransactionOverlay;
