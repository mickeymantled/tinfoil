import { useId } from 'react';
import { cn } from '../lib/cn';

/** Decorative bits for paper / cork surfaces. Absolutely positioned (see .paperclip etc. in index.css); place inside a relative parent. */

export function PaperClip(props: { className?: string }) {
  return (
    <svg className={cn('paperclip', props.className)} viewBox="0 0 24 64" aria-hidden="true" focusable="false">
      <path
        d="M15 18 V50 A4.5 4.5 0 0 1 6 50 V10 A7 7 0 0 1 20 10 V53 A9 9 0 0 1 2 53 V22"
        fill="none"
        stroke="#5d6369"
        strokeWidth="2.6"
        strokeLinecap="round"
        transform="translate(0.6 0.8)"
        opacity="0.55"
      />
      <path
        d="M15 18 V50 A4.5 4.5 0 0 1 6 50 V10 A7 7 0 0 1 20 10 V53 A9 9 0 0 1 2 53 V22"
        fill="none"
        stroke="#c3c9ce"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M20 14 V40" fill="none" stroke="#f2f5f7" strokeWidth="0.8" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

export function CoffeeStain(props: { className?: string }) {
  const filterId = `stain-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg className={cn('coffee-stain', props.className)} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <defs>
        <filter id={filterId} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="9" />
        </filter>
      </defs>
      <g filter={`url(#${filterId})`}>
        <circle cx="100" cy="100" r="74" fill="#8a5a24" fillOpacity="0.07" />
        <circle cx="100" cy="100" r="74" fill="none" stroke="#7a4716" strokeOpacity="0.42" strokeWidth="5" />
        <circle cx="100" cy="100" r="70" fill="none" stroke="#7a4716" strokeOpacity="0.16" strokeWidth="2" />
        <path d="M40 132 A72 72 0 0 1 58 46" fill="none" stroke="#6e3f12" strokeOpacity="0.3" strokeWidth="3" />
        <circle cx="168" cy="54" r="6" fill="#7a4716" fillOpacity="0.25" />
        <circle cx="178" cy="70" r="3" fill="#7a4716" fillOpacity="0.2" />
      </g>
    </svg>
  );
}

const PIN_COLORS = {
  red: { head: '#d8312a', dark: '#8e1a15' },
  amber: { head: '#e3a21c', dark: '#97680a' },
  green: { head: '#2fae5a', dark: '#1a6a36' },
} as const;

export function Pushpin(props: { className?: string; color?: 'red' | 'amber' | 'green' }) {
  const c = PIN_COLORS[props.color ?? 'red'];
  return (
    <svg className={cn('pushpin', props.className)} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M16 17 L17.2 30 L14.8 30 Z" fill="#9aa3a8" />
      <ellipse cx="16" cy="17.5" rx="6.5" ry="2.4" fill={c.dark} />
      <circle cx="16" cy="11" r="8.5" fill={c.head} />
      <circle cx="16" cy="11" r="8.5" fill="none" stroke={c.dark} strokeWidth="1.2" />
      <circle cx="12.8" cy="7.8" r="2.8" fill="#fff" opacity="0.45" />
    </svg>
  );
}
