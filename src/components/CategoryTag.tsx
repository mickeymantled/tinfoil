import type { Category } from '../../shared/types';
import { cn } from '../lib/cn';

// Literal class names (tag-<slugify(category)>) so Tailwind keeps these @layer components rules.
const TAG_CLASS: Record<Category, string> = {
  Ransomware: 'tag-ransomware',
  'Data Breach': 'tag-data-breach',
  'Infrastructure/Grid': 'tag-infrastructure-grid',
  Outage: 'tag-outage',
  'Vulnerability/Zero-Day': 'tag-vulnerability-zero-day',
  'Nation-State': 'tag-nation-state',
  'Crypto Hack': 'tag-crypto-hack',
  Other: 'tag-other',
};

export function CategoryTag(props: { category: Category; className?: string }) {
  const { category, className } = props;
  return <span className={cn('tag', TAG_CLASS[category] ?? 'tag-other', className)}>{category}</span>;
}
