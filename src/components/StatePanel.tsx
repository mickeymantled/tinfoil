import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

const ICONS = { loading: '>', empty: '?', error: '!' } as const;
// Literal class names so Tailwind keeps these @layer components rules.
const KIND_CLASS = { loading: 'state-loading', empty: 'state-empty', error: 'state-error' } as const;

/** Terminal-styled loading / empty / error block for anything that hits the API. */
export function StatePanel(props: {
  kind: 'loading' | 'empty' | 'error';
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  const { kind, title, children, action, compact = false } = props;
  return (
    <div
      className={cn('state-panel', KIND_CLASS[kind], compact && 'state-compact')}
      role={kind === 'error' ? 'alert' : 'status'}
      aria-busy={kind === 'loading' || undefined}
    >
      <div className="state-head">
        <span className="state-icon" aria-hidden="true">
          [{ICONS[kind]}]
        </span>
        <p className={cn('state-title', kind === 'loading' && 'cursor-blink')}>{title}</p>
      </div>
      {kind === 'loading' && !compact ? (
        <div aria-hidden="true">
          <div className="state-progress" />
          <div className="state-cipher">7F 3A 9C E1 00 4B D2 88 1F A0 6E 5D C3 77 0B 9A 2E F4 61 D8 3C</div>
        </div>
      ) : null}
      {children ? <div className="state-body">{children}</div> : null}
      {action ? <div className="state-action">{action}</div> : null}
    </div>
  );
}
