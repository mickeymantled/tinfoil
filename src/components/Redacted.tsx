import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../lib/cn';

/** Black bar over text. Hover or keyboard focus peeks; click, tap, Enter or Space toggles a lasting reveal. */
export function Redacted(props: { children: ReactNode; dark?: boolean; className?: string }) {
  const { children, dark = false, className } = props;
  const [revealed, setRevealed] = useState(false);

  const onKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setRevealed((r) => !r);
    }
  };

  return (
    <span
      role="button"
      tabIndex={0}
      aria-pressed={revealed}
      aria-label={revealed ? undefined : 'Redacted text. Activate to reveal.'}
      data-revealed={revealed ? 'true' : 'false'}
      className={cn('redacted', dark && 'redacted-dark', className)}
      onClick={() => setRevealed((r) => !r)}
      onKeyDown={onKeyDown}
    >
      {children}
    </span>
  );
}
