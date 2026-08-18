/**
 * CharacterBrain — the frontend's connection to the AI backend (the brain).
 *
 * It does not think on its own; it asks the backend, which calls the LLM and
 * returns a single behavior JSON (reply + expression + animation + voice + visemes).
 * If the backend is unreachable it returns a safe offline behavior so the UI
 * never hard-crashes.
 */
export class CharacterBrain {
    constructor(backendUrl = '', instanceId = 'default', options = {}) {
        this.backend = backendUrl;
        this.instanceId = instanceId;

        // Get user's timezone automatically (detected once, used for all requests)
        this.userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Tenant identity — which host application this widget is embedded
        // in. Third-party integrators pass their own app-id attribute;
        // anyone else (our own demo, or a host that hasn't configured one)
        // falls back to the page's hostname, so unrelated deployments still
        // get natural isolation from each other without any setup.
        this.appId = CharacterBrain.resolveAppId(options.appId);

        // User identity within that tenant. Third-party host apps that have
        // their own users pass user-id explicitly, so history/settings
        // survive across that user's devices. Anyone who doesn't supply one
        // (our demo included) falls back to the existing behavior: a random
        // id generated once and cached in localStorage, scoped per instance
        // so two <avatar-model instance="..."> groups on the same page
        // don't silently share one identity.
        this.userId = options.userId || CharacterBrain.getOrCreateUserId(instanceId);

        // 'app' = every user of this app-id shares one settings row
        // (last_avatar, languages, persona edits) — new, opt-in.
        // Default ('user') = today's per-browser/UUID isolation, unchanged.
        // Chat history is ALWAYS per-user regardless of this setting —
        // it only affects /settings.
        this.settingsScope = options.settingsScope === 'app' ? 'app' : 'user';

        // Second scoping dimension alongside app-id, for settingsScope
        // 'app' usage only — lets one app-id share settings per some
        // sub-grouping the integrator defines (e.g. a "character" =
        // scenario + avatar combo) instead of every scope='app' user of
        // that app-id sharing a single row. Opt-in, defaults to '' (same
        // default the backend's AppSettings.settings_group column has),
        // so existing scope='app' usage that never sets this keeps
        // landing on the same row as before. No effect at all under the
        // default 'user' scope.
        this.settingsGroup = options.settingsGroup || '';
    }

    static resolveAppId(providedAppId) {
        if (providedAppId) return providedAppId;
        try {
            return window.location.hostname || 'default';
        } catch (error) {
            return 'default';
        }
    }

    static getOrCreateUserId(instanceId = 'default') {
        const STORAGE_KEY = `avatar_user_id:${instanceId}`;
        try {
            let id = localStorage.getItem(STORAGE_KEY);
            if (!id) {
                id = crypto.randomUUID();
                localStorage.setItem(STORAGE_KEY, id);
            }
            return id;
        } catch (error) {
            // Private browsing / storage disabled — fall back to an
            // in-memory id so requests still work for this session, just
            // without persistence across reloads.
            return crypto.randomUUID();
        }
    }

    /** Headers for a JSON request body (POST /ask, /settings, etc). */
    _jsonHeaders() {
        return {
            'Content-Type': 'application/json',
            'X-App-Id': this.appId,
            'X-User-Id': this.userId,
            'X-Settings-Scope': this.settingsScope,
            'X-Settings-Group': this.settingsGroup,
        };
    }

    /** Headers for a GET/no-body request (history, settings). */
    _headers() {
        return {
            'X-App-Id': this.appId,
            'X-User-Id': this.userId,
            'X-Settings-Scope': this.settingsScope,
            'X-Settings-Group': this.settingsGroup,
        };
    }


    /**
     * @param {string} text
     * @param {string} persona
     * @param {string} [avatarPersona] - avatar specialty text that should be preserved in AI requests.
     * @param {{en?: string, ja?: string}} [voices] - optional per-character
     *   voice override (full Edge-TTS neural voice names). Omit a key to use
     *   the backend's default voice for that language.
     * @param {string} [characterName] - the currently-selected AVATAR's id.
     *   The backend uses this for the LLM's self-identification.
     * @param {string} [speakLanguage] - user's speaking language
     */
    async ask(text, persona, avatarPersona = null, voices = {}, characterName = null, speakLanguage = 'en', teachingMode = false) {
        const res = await fetch(`${this.backend}/ask`, {
            method: 'POST',
            headers: this._jsonHeaders(),
            body: JSON.stringify({
                text,
                persona,
                avatar_persona: avatarPersona || null,
                character_name: characterName || null,
                voice_en: voices.en || null,
                voice_ja: voices.ja || null,
                speak_language: speakLanguage === 'ja' ? 'ja' : 'en',
                timezone: this.userTimezone,  // Send timezone for real-time date awareness
                teaching_mode: Boolean(teachingMode),
            }),
        });
        if (!res.ok) throw new Error(`Backend /ask failed (${res.status})`);
        return res.json();
    }
async translate(text, target = 'ja') {
        const body = new URLSearchParams();
        body.set('text', text);
        body.set('target', target);
        const res = await fetch(`${this.backend}/translate`, {
            method: 'POST',
            body,
        });
        if (!res.ok) throw new Error(`Backend /translate failed (${res.status})`);
        return res.json();
    }

    /** { history: [{role, text|content, text_en?, text_ja?, time, character_name?}] } —
     * the backend's authoritative conversation log. The frontend renders from
     * this directly instead of keeping its own running copy, so it stays
     * correct across reloads and (later) survives a swap to a real database.
     * @param {string} [characterName] - when given, only that avatar's turns
     *   are returned (conversation_history is one shared list on the backend,
     *   holding every avatar's messages tagged by character_name). Omit to
     *   get everything. */
    async history(characterName = null) {
        const url = characterName
            ? `${this.backend}/history?character_name=${encodeURIComponent(characterName)}`
            : `${this.backend}/history`;
        const res = await fetch(url, { cache: 'no-store', headers: this._headers() });
        if (!res.ok) throw new Error(`Backend /history failed (${res.status})`);
        return res.json();
    }

    /** { ui_language, response_language, last_avatar } — this user's saved settings,
     * or defaults if they've never saved any. */
    async getSettings({ signal } = {}) {
        const res = await fetch(`${this.backend}/settings`, { cache: 'no-store', headers: this._headers(), signal });
        if (!res.ok) throw new Error(`Backend /settings (get) failed (${res.status})`);
        return res.json();
    }

    /** Partial update — only pass the fields that changed. Returns the full
     * saved settings row. @param {{ui_language?: string, response_language?: string, last_avatar?: string}} patch */
    async saveSettings(patch = {}) {
        const res = await fetch(`${this.backend}/settings`, {
            method: 'POST',
            headers: this._jsonHeaders(),
            body: JSON.stringify(patch),
            // Lets the browser finish this request in the background even
            // if the tab is closed/navigated away right after it's fired —
            // without this, a fire-and-forget save (see selectAvatar() and
            // the response-language listener in AvatarController.js) can
            // get silently cancelled mid-flight on a slow connection,
            // making a just-picked avatar or language "randomly" fail to
            // persist depending on how quickly the user closes the tab.
            keepalive: true,
        });
        if (!res.ok) throw new Error(`Backend /settings (save) failed (${res.status})`);
        return res.json();
    }


    /** Clears chat history. @param {string} [characterName] - when given, only
     * that avatar's turns are cleared; omit to clear everything for this user. */
    async reset(characterName = null) {
        const url = characterName
            ? `${this.backend}/reset?character_name=${encodeURIComponent(characterName)}`
            : `${this.backend}/reset`;
        try { await fetch(url, { method: 'POST', headers: this._headers() }); } catch (_) {}
    }

    /** TTS for live meeting avatar interpreter. */
    async voice(text, voice = 'en-US', culture = 'en') {
        const res = await fetch(`${this.backend}/voice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, voice, culture }),
        });
        if (!res.ok) throw new Error(`Backend /voice failed (${res.status})`);
        return res.json();
    }

    /** Offline fallback behavior so the avatar still reacts without a backend. */
        /**
     * Offline fallback behavior so the avatar still reacts without a backend.
     * FIX: Swapped hardcoded 'thinking' and 'explain' strings out for 'neutral' 
     * face blendshapes and your explicit 'offline' loop clip track.
     */
    offlineBehavior(text) {
        return {
            reply: `(offline) I heard: "${text}". Start the backend to enable the AI.`,
            translated_reply: '',
            romanization: '',
            expression: 'neutral', 
            animation: 'offline',
            voice: 'en-US',
            primary: 'en',
            audio_url_en: '', audio_url_ja: '', audio_url: '',
            visemes_en: [], visemes_ja: [], visemes: [],
            _offline: true, // marks this as a local fallback, not a real backend reply
        };
    }

}