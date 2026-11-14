import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // near-black terminal surfaces
        ink: {
          950: '#040604',
          900: '#080b08',
          800: '#0e130e',
          700: '#151c15',
          600: '#1f2a1f',
          500: '#2d3b2d',
        },
        // terminal green
        phosphor: {
          DEFAULT: '#3dff7a',
          dim: '#1fa64d',
          dark: '#0f5c2a',
          soft: '#b4f5c8',
        },
        // amber CRT
        amber: {
          DEFAULT: '#ffb000',
          dim: '#b87f00',
          soft: '#ffd98a',
        },
        // alerts and red string
        alert: {
          DEFAULT: '#ff2e2e',
          dim: '#b01717',
          dark: '#5e0b0b',
        },
        // document tones
        manila: {
          DEFAULT: '#e2c282',
          light: '#eed9a6',
          dark: '#c9a25a',
          edge: '#a9833f',
        },
        paper: {
          DEFAULT: '#efe6cf',
          aged: '#e4d7b4',
          dark: '#cdbd94',
        },
        typeink: '#221a11',
        stamp: '#b3201c',
      },
      fontFamily: {
        type: ['"Special Elite"', '"Courier New"', 'Courier', 'monospace'],
        crt: ['VT323', '"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 18px rgba(61, 255, 122, 0.35)',
        'glow-amber': '0 0 18px rgba(255, 176, 0, 0.35)',
        'glow-red': '0 0 18px rgba(255, 46, 46, 0.45)',
        doc: '0 1px 0 rgba(255,255,255,0.35) inset, 0 14px 30px -12px rgba(0,0,0,0.85), 0 2px 4px rgba(0,0,0,0.5)',
      },
      maxWidth: {
        site: '72rem',
      },
    },
  },
  plugins: [],
} satisfies Config;
