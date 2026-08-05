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

// Resolver for 2D avatar thumbnail previews
export function resolveThumbnailUrl(filename) {
  return resolveAssetUrl(`/assets/thumbnails/${filename}`);
}

// Avatar .glb models are hosted separately (Netlify)
export const AVATAR_CDN_BASE = 'https://lexx-ai-avatars.netlify.app/';

export function resolveAvatarUrl(filename) {
  return new URL(String(filename).replace(/^\//, ''), AVATAR_CDN_BASE).href;
}