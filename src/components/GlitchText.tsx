import { cn } from '../lib/cn';

/** Text with an occasional channel-split glitch (pure CSS, off with reduced motion). Headings only, never body copy. */
export function GlitchText(props: { text: string; as?: 'h1' | 'h2' | 'h3' | 'span' | 'div'; className?: string }) {
  const { text, as: As = 'span', className } = props;
  return (
    <As className={cn('glitch', className)} data-text={text}>
      {text}
    </As>
  );
}
