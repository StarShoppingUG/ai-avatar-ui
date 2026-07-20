// App-wide constants shared across avatar-* custom elements.
export const BACKEND = '';
export const DEFAULT_RESPONSE_LANGUAGE = 'ja';
export const RESPONSE_LANGUAGES = ['en', 'ja', 'both'];
export const UI_LANGUAGES = ['en', 'ja'];
export const AUDIO_FALLBACK_DURATION = 3000;

// The origin (protocol+host+port) this script was loaded from — NOT its
// directory. public/ assets are always served at site root ('/assets/...'),
// regardless of which source file references them: true in dev (Vite serves
// each module at its real per-file path, but all share the dev server's
// origin), true when this app is hosted standalone, and true when this
// bundle is embedded on someone else's page (assets sit next to the single
// built file at the same dist root). Using the *directory* of import.meta.url
// instead of just its origin broke dev mode specifically — there,
// constants.js's own URL is something like '.../src/components/constants.js',
// so its directory is nowhere near where public/assets actually lives; only
// the production bundle (one file, sitting at the dist root) coincidentally
// made directory-relative resolution look correct.
export const ASSET_BASE_URL = `${new URL(import.meta.url).origin}/`;

export function resolveAssetUrl(path) {
  return new URL(String(path).replace(/^\//, ''), ASSET_BASE_URL).href;
}