import { useEffect } from 'react';
import { config } from '../config';

/**
 * Sets document.title to `${title} | TINFOIL HAT` and the description meta tag
 * (falls back to the site description). Restores nothing on unmount: the next
 * page sets its own.
 */
export function usePageMeta(meta: { title: string; description?: string }): void {
  const { title, description } = meta;
  useEffect(() => {
    document.title = `${title} | ${config.tokenName}`;
    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!tag) {
      tag = document.createElement('meta');
      tag.name = 'description';
      document.head.appendChild(tag);
    }
    tag.content = description ?? config.description;
  }, [title, description]);
}
