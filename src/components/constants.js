// App-wide constants shared across avatar-* custom elements.
export const BACKEND = '';
export const DEFAULT_RESPONSE_LANGUAGE = 'ja';
export const RESPONSE_LANGUAGES = ['en', 'ja', 'both'];
export const UI_LANGUAGES = ['en', 'ja'];
export const AUDIO_FALLBACK_DURATION = 3000;

export const ASSET_BASE_URL = `${new URL(import.meta.url).origin}/`;

export function resolveAssetUrl(path) {
  return new URL(String(path).replace(/^\//, ''), ASSET_BASE_URL).href;
}

// Avatar .glb models are hosted separately (Netlify), NOT under this app's
// own origin like other public/ assets — they're too large to ship in this
// repo (see AvatarSources.js). Kept as its own constant/function rather than
// folding into resolveAssetUrl() above, since that one is anchored to
// wherever THIS script is served from, which is a different origin entirely
// from where the models live.
export const AVATAR_CDN_BASE = 'https://lexx-ai-avatars.netlify.app/';

export function resolveAvatarUrl(filename) {
  return new URL(String(filename).replace(/^\//, ''), AVATAR_CDN_BASE).href;
}