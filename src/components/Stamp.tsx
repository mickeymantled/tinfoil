import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

// Literal class names so Tailwind keeps these @layer components rules.
const TONES = { red: 'stamp-red', green: 'stamp-green', amber: 'stamp-amber', ink: 'stamp-ink' } as const;
const SIZES = { sm: 'stamp-sm', md: '', lg: 'stamp-lg' } as const;

export function Stamp(props: {
  children: ReactNode;
  tone?: 'red' | 'green' | 'amber' | 'ink';
  rotate?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const { children, tone = 'red', rotate = -8, size = 'md', className } = props;
  return (
    <span
      className={cn('stamp', TONES[tone], SIZES[size], className)}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </span>
  );
}
