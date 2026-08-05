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
 */
export class AvatarSettingsController {
  constructor({ backend = BACKEND, instanceId = "default", appId, userId } = {}) {
    this.instanceId = instanceId;
    this.currentAvatarId = DEFAULT_AVATAR_ID;
    this.responseLanguage = DEFAULT_RESPONSE_LANGUAGE;
    this.brain = new CharacterBrain(backend, instanceId, { appId, userId });
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
      try {
        const settings = await this.brain.getSettings();
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
        }
      }
    }

    this.emitAvailableAvatars();
    this.emitCurrentProfile();
  }

  registerListeners() {
    window.addEventListener("avatar:select-avatar", (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      const avatarId = event.detail?.avatarId;
      if (!avatarId) return;
      const avatar = lookupAvatar(avatarId, this.instanceId);
      if (!avatar) return;
      this.currentAvatarId = avatar.id;
      this.brain.saveSettings({ last_avatar: avatar.id }).catch(() => {});
      this.emitCurrentProfile();
    });

    window.addEventListener("avatar:request-current-profile", (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      this.emitCurrentProfile();
    });

window.addEventListener("avatar:set-response-language", (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      const language = event.detail?.language;
      if (!RESPONSE_LANGUAGES.includes(language)) return;
      this.responseLanguage = language;
      this.brain.saveSettings({ response_language: language }).catch(() => {});
      this.emitAvailableAvatars();
    });

    window.addEventListener("avatar:set-ui-language", (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      const language = event.detail?.language;
      if (!UI_LANGUAGES.includes(language)) return;
      applyUiLanguageToApp(language, this.instanceId);
      this.emit("request-current-profile");
      this.brain.saveSettings({ ui_language: language }).catch(() => {});
    });

    window.addEventListener("avatar:edit-persona", async (event) => {
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
          const translated = result?.text ?? "";
          if (translated) fields[isJa ? "persona" : "personaJa"] = translated;
        } catch (error) {
          console.error(
            "[avatar-settings-persona] translate failed, saving single language only:",
            error,
          );
        }
      }

      setPersonaOverride(targetId, fields, this.instanceId);
      // Full cache, not just this entry — /settings stores persona_overrides
      // as a full replace on the backend, same reasoning as AvatarController.
      this.brain
        .saveSettings({ persona_overrides: getPersonaOverridesCache() })
        .catch(() => {});
      if (targetId === this.currentAvatarId) this.emitCurrentProfile();
      this.emitAvailableAvatars();
    });

    window.addEventListener("avatar:reset-persona", (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      const targetId = event.detail?.avatarId || this.currentAvatarId;
      resetPersonaOverride(targetId, this.instanceId);
      this.brain
        .saveSettings({ persona_overrides: getPersonaOverridesCache() })
        .catch(() => {});
      if (targetId === this.currentAvatarId) this.emitCurrentProfile();
      this.emitAvailableAvatars();
    });
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
