/// <reference types="vite/client" />

/** Hats found in public/hats at build time (see hatsPlugin in vite.config.ts). Default hat is first. */
declare module 'virtual:hats' {
  export interface HatAsset {
    /** File name inside public/hats, e.g. "tinfoil-hat.png". */
    file: string;
    /** URL to load it from, e.g. "/hats/tinfoil-hat.png". */
    url: string;
    /** Human-readable name derived from the file name, e.g. "Tinfoil Hat". */
    name: string;
  }
  const hats: HatAsset[];
  export default hats;
}

/** Installed @mediapipe/tasks-vision version, injected by Vite. */
declare const __MEDIAPIPE_VERSION__: string;
