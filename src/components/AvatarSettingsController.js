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
 * AvatarSettingsController — same persistence surface as AvatarController
 * (avatar selection, persona/name edits, languages) for pages that mount
 * <avatar-settings> with no <avatar-model> present. No Three.js involved.
 * Created by AvatarSettings.js when no matching <avatar-model> exists for
 * its instance. Voice/scale are intentionally not handled here.
 *
 * Listens on `window`, not on its own element, so destroy() MUST be called
 * from the owning <avatar-settings>'s disconnectedCallback — otherwise a
 * stale controller from an unmounted page keeps reacting to events for its
 * instanceId indefinitely (SPA navigation doesn't clear module state).
 */
export class AvatarSettingsController {
  constructor({ backend = BACKEND, instanceId = "default", appId, userId, settingsScope, settingsGroup } = {}) {
    this.instanceId = instanceId;
    this.currentAvatarId = DEFAULT_AVATAR_ID;
    this.responseLanguage = DEFAULT_RESPONSE_LANGUAGE;
    this.brain = new CharacterBrain(backend, instanceId, { appId, userId, settingsScope, settingsGroup });
    this._destroyed = false;
    this._abortController = new AbortController();
    this._settingsLoaded = false;
    this._historyRequestId = 0;

    this._onSelectAvatar = this._onSelectAvatar.bind(this);
    this._onRequestCurrentProfile = this._onRequestCurrentProfile.bind(this);
    this._onSetResponseLanguage = this._onSetResponseLanguage.bind(this);
    this._onSetUiLanguage = this._onSetUiLanguage.bind(this);
    this._onEditPersona = this._onEditPersona.bind(this);
    this._onResetPersona = this._onResetPersona.bind(this);
    this._onOpenChatHistory = this._onOpenChatHistory.bind(this);
    this._onClearChatHistory = this._onClearChatHistory.bind(this);
  }

  emit(name, detail = {}) {
    emitAvatarEvent(name, detail, this.instanceId);
  }

  async init() {
    this.registerListeners();

    // Cold-start retry: absorbs a sleeping backend's first failed request
    // instead of flashing default state for one load.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (this._destroyed) return;
      try {
        const settings = await this.brain.getSettings({ signal: this._abortController.signal });
        if (this._destroyed) return;

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
        break;
      } catch (error) {
        if (this._destroyed || error.name === "AbortError") return;

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
    this._settingsLoaded = true;
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
    window.addEventListener("avatar:open-chat-history", this._onOpenChatHistory);
    window.addEventListener("avatar:clear-chat-history", this._onClearChatHistory);
  }

  /** Removes all window listeners and marks this controller inert. Safe to
   * call more than once. Must be called from the owning element's
   * disconnectedCallback — see the class doc comment above. */
  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._abortController.abort();
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
    window.removeEventListener("avatar:open-chat-history", this._onOpenChatHistory);
    window.removeEventListener("avatar:clear-chat-history", this._onClearChatHistory);
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
    if (!this._settingsLoaded) return;
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
        if (this._destroyed) return;
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
    // Full cache, not just this entry — /settings stores persona_overrides as a full replace.
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

  _onOpenChatHistory(event) {
    if (this._destroyed) return;
    if (event.detail?.instance !== this.instanceId) return;
    this.refreshHistory();
  }

  _onClearChatHistory(event) {
    if (this._destroyed) return;
    if (event.detail?.instance !== this.instanceId) return;
    this.clearChatHistory();
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
    this.emit("update-profile", {
      name: avatar.name,
      persona: avatar.persona,
      personaJa: avatar.personaJa || avatar.persona,
      thumbnail: avatar.thumbnail,
      isCustomPersona: hasPersonaOverride(avatar.id, this.instanceId),
    });
  }

  /** Same contract as AvatarController.refreshHistory() — pulls the
   * authoritative log and hands the UI one full snapshot. */
  async refreshHistory() {
    const requestId = ++this._historyRequestId;
    const avatarName = lookupAvatar(this.currentAvatarId, this.instanceId)?.name;
    try {
      const data = await this.brain.history(avatarName);
      if (this._destroyed || requestId !== this._historyRequestId) return;
      const history = Array.isArray(data?.history) ? data.history : [];
      this.emit("chat-history", {
        history,
        responseLanguage: this.responseLanguage,
        avatarName,
      });
    } catch (error) {
      if (this._destroyed || requestId !== this._historyRequestId) return;
      this.emit("chat-history", {
        history: [],
        responseLanguage: this.responseLanguage,
        avatarName,
      });
    }
  }

  async clearChatHistory() {
    if (this._destroyed) return;
    const avatarName = lookupAvatar(this.currentAvatarId, this.instanceId)?.name;
    await this.brain.reset(avatarName);
    if (this._destroyed) return;
    this.refreshHistory();
  }
}