/**
 * TINFOIL HAT site config.
 *
 * Every token-specific value lives in this one file. Replace the placeholders
 * below and rebuild (`npm run build`). Anything still set to a placeholder is
 * shown on the site as "pending" instead of linking somewhere broken.
 *
 * This file is imported by the React app, by vite.config.ts (page title and
 * social meta tags) and by scripts/generate-og.ts (the Open Graph image), so
 * keep it free of browser-only or Node-only code.
 */
export const config = {
  /** Display name of the token. */
  tokenName: 'TINFOIL HAT',

  /** Ticker, including the dollar sign. */
  ticker: '$TINFOIL',

  /** Chain the token lives on. */
  chain: 'Solana',

  /** One-line tagline shown in the hero and in link previews. */
  tagline: 'They are already inside the grid. Wear the hat.',

  /** Longer description used for SEO and social cards. */
  description:
    'TINFOIL HAT ($TINFOIL) is the cyber incident coin on Solana: a tinfoil hat PFP generator, a live monitor of real cyber incidents, and a grid-down survival guide.',

  /** Token mint / contract address. */
  contractAddress: '3D5nV4rQuNJezr6BGfxgQY3qqrtigmEnV2gqSi7ipump',

  links: {
    /** Where the BUY button goes (Jupiter, Raydium, pump.fun, ...). PLACEHOLDER. */
    buy: 'https://example.com/REPLACE_WITH_BUY_LINK',

    /** DEX chart (DexScreener pair page). */
    chart: 'https://dexscreener.com/solana/FjqAhBSdkceLQ9CcTqDgFKNLFZpNzHrxSpXcnSKLrTbW',

    /** X (Twitter) profile. */
    x: 'https://x.com/tinfoilhatonx',

    /** Telegram group or channel. PLACEHOLDER. */
    telegram: 'https://t.me/REPLACE_WITH_TELEGRAM',
  },

  /** Prefilled text for the hat generator's "Share on X" button. The site URL is appended automatically. */
  shareText: "They can't read my thoughts anymore. Hat secured. $TINFOIL",

  /**
   * Hat generator: try to auto-place the hat with in-browser face detection
   * (MediaPipe). The detector is downloaded from a CDN the first time it is
   * needed, runs entirely in the browser, and falls back to manual placement
   * when it finds nothing. Set to false to never load it.
   */
  faceDetection: true,
};

export type SiteConfig = typeof config;

/** True while a config value is still one of the obvious placeholders above. */
export function isPlaceholder(value: string | undefined | null): boolean {
  if (!value || !value.trim()) return true;
  return /REPLACE_WITH|PASTE_|example\.com/i.test(value);
}
