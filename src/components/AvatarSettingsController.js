import { CharacterBrain } from "../avatar/CharacterBrain.js";
import {
  DEFAULT_AVATAR_ID,
  getAvatar as lookupAvatar,
  getAllAvatars,
  setPersonaOverride,
  resetPersonaOverride,
  hasPersonaOverride,
  setPersonaOverridesCache,
  getPersonaOverridesCache,
} from "../avatar/AvatarSources.js";
import { emitAvatarEvent } from "./events.js";
import {
  BACKEND,
  DEFAULT_RESPONSE_LANGUAGE,
  RESPONSE_LANGUAGES,
  UI_LANGUAGES,
} from "./constants.js";
import { applyUiLanguageToApp } from "./i18n.js";

/**
 * AvatarSettingsController — the same persistence surface as
 * AvatarController (avatar selection, persona/name edits, response
 * language, UI language), for pages that mount <avatar-settings> with no
 * <avatar-model> present. No Three.js/GLTFLoader/canvas involved. Created
 * automatically by AvatarSettings.js when it detects no matching
 * <avatar-model> exists on the page for its instance — see that file.
 *
 * Voice and scale are intentionally NOT handled here — they aren't exposed
 * on the settings panel today, and remain in-memory-only on AvatarController.
 *
 * IMPORTANT: registerListeners() attaches to `window`, not to this
 * instance's element — so this controller MUST be torn down via destroy()
 * whenever the owning <avatar-settings> disconnects (e.g. on every
 * client-side route change in a Next.js app). Without a working destroy(),
 * these listeners outlive the page that created them: a stale controller
 * from an unmounted settings-only page keeps reacting to
 * avatar:select-avatar / avatar:edit-persona / etc. for its instanceId
 * indefinitely, including on later pages that happen to reuse the same
 * instance id (e.g. navigating into the exact character/instance that card
 * represented) — each stale controller independently re-saves settings
 * from its own frozen, increasingly-stale local state. That's the likely
 * cause of "last avatar keeps resetting after client-side navigation, but
 * is fine after a full reload" — a reload clears all module state, so no
 * stale controller exists to interfere; SPA navigation does not.
 */
export class AvatarSettingsController {
  constructor({ backend = BACKEND, instanceId = "default", appId, userId } = {}) {
    this.instanceId = instanceId;
    this.currentAvatarId = DEFAULT_AVATAR_ID;
    this.responseLanguage = DEFAULT_RESPONSE_LANGUAGE;
    this.brain = new CharacterBrain(backend, instanceId, { appId, userId });
    this._destroyed = false;

    // Bind once and keep the references around — addEventListener and
    // removeEventListener only cancel each other out when given the exact
    // same function reference, so the old inline-arrow-function version of
    // registerListeners() could never actually be unregistered.
    this._onSelectAvatar = this._onSelectAvatar.bind(this);
    this._onRequestCurrentProfile = this._onRequestCurrentProfile.bind(this);
    this._onSetResponseLanguage = this._onSetResponseLanguage.bind(this);
    this._onSetUiLanguage = this._onSetUiLanguage.bind(this);
    this._onEditPersona = this._onEditPersona.bind(this);
    this._onResetPersona = this._onResetPersona.bind(this);
  }

  emit(name, detail = {}) {
    emitAvatarEvent(name, detail, this.instanceId);
  }

  async init() {
    this.registerListeners();

    // Same cold-start retry pattern as AvatarController.loadPersistedSettings()
    // — absorbs a sleeping backend's first failed request instead of
    // flashing default state for one load.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (this._destroyed) return; // torn down mid-init — stop touching state
      try {
        const settings = await this.brain.getSettings();
        if (this._destroyed) return; // disconnected while the fetch was in flight

        if (settings.last_avatar) {
          this.currentAvatarId = settings.last_avatar;
        }
        if (
          settings.response_language &&
          RESPONSE_LANGUAGES.includes(settings.response_language)
        ) {
          this.responseLanguage = settings.response_language;
        }
        if (settings.ui_language && UI_LANGUAGES.includes(settings.ui_language)) {
          applyUiLanguageToApp(settings.ui_language, this.instanceId);
        }
        setPersonaOverridesCache(settings.persona_overrides || {});
        break; // success — no retry needed
      } catch (error) {
        const isLastAttempt = attempt === 1;
        console.error(
          `[avatar-settings-init] getSettings failed (attempt ${attempt + 1}/2)` +
            (isLastAttempt ? " — falling back to in-code defaults:" : " — retrying:"),
          error,
        );
        if (!isLastAttempt) {
          await new Promise((resolve) => setTimeout(resolve, 2500));
          if (this._destroyed) return;
        }
      }
    }

    if (this._destroyed) return;
    this.emitAvailableAvatars();
    this.emitCurrentProfile();
  }

  registerListeners() {
    window.addEventListener("avatar:select-avatar", this._onSelectAvatar);
    window.addEventListener(
      "avatar:request-current-profile",
      this._onRequestCurrentProfile,
    );
    window.addEventListener(
      "avatar:set-response-language",
      this._onSetResponseLanguage,
    );
    window.addEventListener("avatar:set-ui-language", this._onSetUiLanguage);
    window.addEventListener("avatar:edit-persona", this._onEditPersona);
    window.addEventListener("avatar:reset-persona", this._onResetPersona);
  }

  /** Removes every window listener registered in registerListeners() and
   * marks this controller inert. Safe to call more than once. Must be
   * called by the owning <avatar-settings> element's disconnectedCallback
   * — see the class doc comment above for why this matters in Next.js. */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    window.removeEventListener("avatar:select-avatar", this._onSelectAvatar);
    window.removeEventListener(
      "avatar:request-current-profile",
      this._onRequestCurrentProfile,
    );
    window.removeEventListener(
      "avatar:set-response-language",
      this._onSetResponseLanguage,
    );
    window.removeEventListener(
      "avatar:set-ui-language",
      this._onSetUiLanguage,
    );
    window.removeEventListener("avatar:edit-persona", this._onEditPersona);
    window.removeEventListener("avatar:reset-persona", this._onResetPersona);
  }

  _onSelectAvatar(event) {
    if (this._destroyed) return;
    if (event.detail?.instance !== this.instanceId) return;
    const avatarId = event.detail?.avatarId;
    if (!avatarId) return;
    const avatar = lookupAvatar(avatarId, this.instanceId);
    if (!avatar) return;
    this.currentAvatarId = avatar.id;
    this.brain.saveSettings({ last_avatar: avatar.id }).catch(() => {});
    this.emitCurrentProfile();
  }

  _onRequestCurrentProfile(event) {
    if (this._destroyed) return;
    if (event.detail?.instance !== this.instanceId) return;
    this.emitCurrentProfile();
  }

  _onSetResponseLanguage(event) {
    if (this._destroyed) return;
    if (event.detail?.instance !== this.instanceId) return;
    const language = event.detail?.language;
    if (!RESPONSE_LANGUAGES.includes(language)) return;
    this.responseLanguage = language;
    this.brain.saveSettings({ response_language: language }).catch(() => {});
    this.emitAvailableAvatars();
  }

  _onSetUiLanguage(event) {
    if (this._destroyed) return;
    if (event.detail?.instance !== this.instanceId) return;
    const language = event.detail?.language;
    if (!UI_LANGUAGES.includes(language)) return;
    applyUiLanguageToApp(language, this.instanceId);
    this.emit("request-current-profile");
    this.brain.saveSettings({ ui_language: language }).catch(() => {});
  }

  async _onEditPersona(event) {
    if (this._destroyed) return;
    if (event.detail?.instance !== this.instanceId) return;
    const { avatarId, text, language, name } = event.detail || {};
    const targetId = avatarId || this.currentAvatarId;
    if (text === undefined && name === undefined) return;

    const fields = {};
    if (name !== undefined) fields.name = name;

    if (text !== undefined) {
      const isJa = language === "ja";
      fields[isJa ? "personaJa" : "persona"] = text;
      try {
        const targetLang = isJa ? "en" : "ja";
        const result = await this.brain.translate(text, targetLang);
        if (this._destroyed) return; // disconnected while translate() was in flight
        const translated = result?.text ?? "";
        if (translated) fields[isJa ? "persona" : "personaJa"] = translated;
      } catch (error) {
        console.error(
          "[avatar-settings-persona] translate failed, saving single language only:",
          error,
        );
      }
    }

    if (this._destroyed) return;
    setPersonaOverride(targetId, fields, this.instanceId);
    // Full cache, not just this entry — /settings stores persona_overrides
    // as a full replace on the backend, same reasoning as AvatarController.
    this.brain
      .saveSettings({ persona_overrides: getPersonaOverridesCache() })
      .catch(() => {});
    if (targetId === this.currentAvatarId) this.emitCurrentProfile();
    this.emitAvailableAvatars();
  }

  _onResetPersona(event) {
    if (this._destroyed) return;
    if (event.detail?.instance !== this.instanceId) return;
    const targetId = event.detail?.avatarId || this.currentAvatarId;
    resetPersonaOverride(targetId, this.instanceId);
    this.brain
      .saveSettings({ persona_overrides: getPersonaOverridesCache() })
      .catch(() => {});
    if (targetId === this.currentAvatarId) this.emitCurrentProfile();
    this.emitAvailableAvatars();
  }

  emitAvailableAvatars() {
    this.emit("available-avatars", {
      avatars: getAllAvatars(this.instanceId),
      currentAvatarId: this.currentAvatarId,
      currentAvatarName: lookupAvatar(this.currentAvatarId, this.instanceId)?.name,
      responseLanguage: this.responseLanguage,
    });
  }

  emitCurrentProfile() {
    const avatar = lookupAvatar(this.currentAvatarId, this.instanceId);
    if (!avatar) return;
    this.emit("update-profile", {
      name: avatar.name,
      persona: avatar.persona,
      personaJa: avatar.personaJa || avatar.persona,
      thumbnail: avatar.thumbnail,
      isCustomPersona: hasPersonaOverride(avatar.id, this.instanceId),
    });
  }
}