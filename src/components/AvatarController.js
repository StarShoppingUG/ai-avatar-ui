import { CharacterBrain } from "../avatar/CharacterBrain.js";
import {
  AVATAR_SOURCES,
  DEFAULT_AVATAR_ID,
  DEFAULT_AVATAR_NAME,
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
  AUDIO_FALLBACK_DURATION,
} from "./constants.js";
import { applyUiLanguageToApp } from "./i18n.js";

const AVATAR_LIST = AVATAR_SOURCES;

class AvatarController {
  constructor(model) {
    this.model = model;
    this.instanceId = model.instanceId || "default";
    this.currentAvatarId = DEFAULT_AVATAR_ID;
    this.responseLanguage = DEFAULT_RESPONSE_LANGUAGE;
    this.brain = new CharacterBrain(model.backend || BACKEND, this.instanceId, {
      appId: model.getAttribute("app-id") || undefined,
      userId: model.getAttribute("user-id") || undefined,
      settingsScope: model.getAttribute("settings-scope") || undefined,
      settingsGroup: model.getAttribute("settings-group") || undefined,
    });
    this.voiceCatalog = { en: [], ja: [] };
    this.lastAudio = null;
    this.audioQueue = [];
    this.isAudioPlaying = false;
    this._historyRequestId = 0;
    this._listeners = [];
    this._settingsLoaded = false;
  }

  /** Registers a window listener via _listeners so destroy() can remove it later. */
  _on(eventName, handler) {
    window.addEventListener(eventName, handler);
    this._listeners.push({ eventName, handler });
  }

  /** All emissions go through here so the instance id is stamped automatically. */
  emit(name, detail = {}) {
    emitAvatarEvent(name, detail, this.instanceId);
  }

  async init() {
    this.emit("app:loading");
    this.emitStatus("Loading avatar…", "yellow");
    this.registerListeners();

    await customElements.whenDefined("avatar-settings");

    this.syncInitialResponseLanguage();
    await this.loadPersistedSettings();
    this._settingsLoaded = true;
    this.emitAvailableAvatars();
    // Safe before model.loadAvatar() — only reads AvatarSources data.
    this.emitCurrentProfile();

    const loadedOk = await this.selectAvatar(this.currentAvatarId, {
      persist: false,
    });

    this.refreshHistory();

    if (loadedOk) {
      this.emitStatus("Ready", "green");
      this.emit("app:ready");
    } else {
      this.emit("app:load-error");
    }
  }

  /** Loads saved settings (last avatar, languages) before the first avatar
   * is selected. Runs after syncInitialResponseLanguage() so it takes
   * priority. A failed/offline backend just means falling back to in-code
   * defaults for this run — not fatal. */
  async loadPersistedSettings() {
    // Default to "not first visit" so an unreachable backend fails toward
    // skipping the setup gate rather than blocking every visitor on it.
    this._isFirstVisit = false;

    // One retry after a short delay — covers a cold-started backend (e.g.
    // free-tier hosting waking up) where the first request can fail even
    // though the backend is fine moments later.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const settings = await this.brain.getSettings();
        this._isFirstVisit = !settings.last_avatar;
        if (settings.last_avatar) {
          this.currentAvatarId = settings.last_avatar;
        }
        if (
          settings.response_language &&
          RESPONSE_LANGUAGES.includes(settings.response_language)
        ) {
          this.responseLanguage = settings.response_language;
        }
        if (
          settings.ui_language &&
          UI_LANGUAGES.includes(settings.ui_language)
        ) {
          applyUiLanguageToApp(settings.ui_language, this.instanceId);
        }
        // Must populate before init()'s emitAvailableAvatars()/emitCurrentProfile()
        // run, since those read getAvatar()/getAllAvatars() synchronously off this cache.
        setPersonaOverridesCache(settings.persona_overrides || {});
        return;
      } catch (error) {
        const isLastAttempt = attempt === 1;
        console.error(
          `[avatar-init] loadPersistedSettings failed (attempt ${attempt + 1}/2)` +
            (isLastAttempt
              ? " — falling back to in-code defaults:"
              : " — retrying:"),
          error,
        );
        if (!isLastAttempt) {
          await new Promise((resolve) => setTimeout(resolve, 2500));
        }
      }
    }
  }

  registerListeners() {
    this._on("avatar:open-chat-history", (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      this.refreshHistory();
    });
    this._on("avatar:clear-chat-history", (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      this.clearChatHistory();
    });

    this._on("avatar:ask", (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      const text = String(event.detail?.text || "").trim();
      if (text) this.handleAsk(text);
    });

    this._on("avatar:select-avatar", (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      const avatarName = event.detail?.avatarId;
      if (avatarName) this.selectAvatar(avatarName);
    });

    this._on("avatar:request-current-profile", (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      if (!this._settingsLoaded) return;
      this.emitCurrentProfile();
    });

    this._on("avatar:edit-persona", async (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      const { avatarId, text, language, name } = event.detail || {};
      const targetId = avatarId || this.currentAvatarId;
      if (text === undefined && name === undefined) return;

      const fields = {};

      // Name is a proper noun, shared across languages — not translated.
      if (name !== undefined) {
        fields.name = name;
      }

      if (text !== undefined) {
        const isJa = language === "ja";
        fields[isJa ? "personaJa" : "persona"] = text;

        try {
          const targetLang = isJa ? "en" : "ja";
          const result = await this.brain.translate(text, targetLang);
          const translated = result?.text ?? "";
          if (translated) {
            fields[isJa ? "persona" : "personaJa"] = translated;
          }
        } catch (error) {
          console.error(
            "[avatar-persona] translate failed, saving single language only:",
            error,
          );
        }
      }

      setPersonaOverride(targetId, fields, this.instanceId);
      // Full cache, not just this entry — /settings stores persona_overrides as a full replace.
      this.brain
        .saveSettings({ persona_overrides: getPersonaOverridesCache() })
        .catch(() => {});
      if (targetId === this.currentAvatarId) this.emitCurrentProfile();
      this.emitAvailableAvatars();
    });

    this._on("avatar:reset-persona", (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      const targetId = event.detail?.avatarId || this.currentAvatarId;
      resetPersonaOverride(targetId, this.instanceId);
      this.brain
        .saveSettings({ persona_overrides: getPersonaOverridesCache() })
        .catch(() => {});
      if (targetId === this.currentAvatarId) this.emitCurrentProfile();
      this.emitAvailableAvatars();
    });
    this._on("avatar:set-response-language", (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      const language = event.detail?.language;
      if (RESPONSE_LANGUAGES.includes(language)) {
        this.responseLanguage = language;
        this.brain
          .saveSettings({ response_language: language })
          .catch(() => {});
        // Rebroadcast so every <avatar-settings> panel watching this instance updates its dropdown.
        this.emitAvailableAvatars();
      }
    });

    this._on("avatar:set-ui-language", (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      const language = event.detail?.language;
      if (UI_LANGUAGES.includes(language)) {
        applyUiLanguageToApp(language, this.instanceId);
        this.emit("request-current-profile");
        this.brain.saveSettings({ ui_language: language }).catch(() => {});
      }
    });

    this._on("avatar:thinking", (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      const active = Boolean(event.detail?.active);
      if (active) {
        this.model.emotionSystem?.startThinking();
      } else {
        this.model.emotionSystem?.stopThinking();
      }
    });

    this._on("avatar:listening", (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      const active = Boolean(event.detail?.active);
      if (active) {
        this.model.emotionSystem?.startListening();
      } else {
        this.model.emotionSystem?.stopListening();
      }
    });

    this._on("avatar:set-voice", (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      const { lang, voiceName } = event.detail || {};
      const avatar = lookupAvatar(this.currentAvatarId, this.instanceId);
      if (!avatar || !voiceName) return;
      if (lang === "ja") avatar.voiceJa = voiceName;
      else if (lang === "both") avatar.voiceBoth = voiceName;
      else avatar.voiceEn = voiceName;
      this.emitStatus("Voice updated.", "green");
    });

    this._on("avatar:set-scale", (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      const { scale, verticalOffset } = event.detail || {};
      if (scale === undefined && verticalOffset === undefined) return;

      if (scale !== undefined) this.model.avatarScaleConfig.scale = scale;
      if (verticalOffset !== undefined)
        this.model.avatarScaleConfig.verticalOffset = verticalOffset;

      this.model.avatarManager?.setTransform(this.model.avatarScaleConfig);
      this.emitStatus("Scale updated.", "green");
    });

    this._on("avatar:reset", (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      this.resetConversation();
    });
  }

  destroy() {
    this._listeners.forEach(({ eventName, handler }) => {
      window.removeEventListener(eventName, handler);
    });
    this._listeners = [];
  }

  syncInitialResponseLanguage() {
    const settings = document.querySelector("avatar-settings");
    const currentValue = settings?.querySelector(
      ".response-language-select",
    )?.value;
    if (RESPONSE_LANGUAGES.includes(currentValue)) {
      this.responseLanguage = currentValue;
    }
  }

  async selectAvatar(avatarId, { persist = true } = {}) {
    const avatar = lookupAvatar(avatarId, this.instanceId);
    if (!avatar) {
      return;
    }

    // lookupAvatar() falls back to AVATAR_SOURCES[0] for an unknown id.
    // Store avatar.id (not the requested avatarId) so currentAvatarId
    // always reflects what's actually loaded, and log any mismatch.
    if (avatar.id !== avatarId) {
      console.warn(
        `[avatar-init] selectAvatar: unknown avatarId "${avatarId}", falling back to "${avatar.name}"`,
      );
    }
    this.currentAvatarId = avatar.id;

    if (persist) {
      this.brain.saveSettings({ last_avatar: avatar.id }).catch(() => {});
    }

    this.emitCurrentProfile();

    this.emitStatus(`Loading ${avatar.name}…`, "yellow");
    this.emit("avatar-loading", { active: true });

    const loaded = await this.model.loadAvatar(avatarId, avatar);

    this.emit("avatar-loading", { active: false });
    // Only announce "Ready" on actual success — loadAvatar() already emits its own error status on failure.
    if (loaded) {
      this.emitStatus("Ready", "green");
    }
    // Lets avatar-inputs disable/re-enable the textarea/mic/send with the model's health.
    this.emit("load-error", { active: !loaded });

    // Switching avatars means the chat history panel should show this avatar's own history.
    this.refreshHistory();

    return loaded;
  }

  /** Emits update-profile for the current avatar, including whether it has
   * a saved persona override (drives the "Reset to default" button state). */
  emitCurrentProfile() {
    const avatar = lookupAvatar(this.currentAvatarId, this.instanceId);
    if (!avatar) return;
    this.emit("update-profile", {
      name: avatar.name,
      persona: avatar.persona,
      personaJa: avatar.personaJa || avatar.persona,
      voiceEn: avatar.voiceEn,
      voiceJa: avatar.voiceJa,
      voiceBoth: avatar.voiceBoth,
      thumbnail: avatar.thumbnail,
      isCustomPersona: hasPersonaOverride(avatar.id, this.instanceId),
    });
  }

  async handleAsk(text) {
    this.emitStatus("Thinking…", "yellow");
    this.emitThinking(true);

    const avatar = lookupAvatar(this.currentAvatarId, this.instanceId);
    const speakLanguage = this.responseLanguage === "ja" ? "ja" : "en";
    // voiceBoth is only for "both" mode's mixed-language track; "en"/"ja"
    // mode uses the avatar's dedicated native voice, sent via the `en` slot.
    const activeVoice =
      this.responseLanguage === "ja"
        ? avatar?.voiceJa
        : this.responseLanguage === "both"
          ? avatar?.voiceBoth
          : avatar?.voiceEn;
    let data;
    let reachedBackend = true;

    try {
      data = await this.brain.ask(
        text,
        "Default",
        avatar?.persona,
        { en: activeVoice, ja: activeVoice },
        avatar?.name, // send the display name, not the id
        speakLanguage,
      );
    } catch (error) {
      reachedBackend = false;
      data = this.brain.offlineBehavior(text);
    }

    this.applyBehavior(data);
    this.emitStatus("Ready", "green");

    // /ask can return before the backend finishes persisting this turn to
    // its own history store, so an immediate /history fetch can race that
    // write and land one turn late. Render optimistically now, reconcile after.
    if (reachedBackend) {
      this.appendOptimisticTurn(text, data);
      await this.refreshHistory();
    }
  }

  /** Renders the just-completed exchange immediately from the reply payload
   * already in hand, ahead of refreshHistory()'s reconciling fetch. */
  appendOptimisticTurn(userText, data) {
    const now = new Date().toISOString();
    const avatarName = lookupAvatar(
      this.currentAvatarId,
      this.instanceId,
    )?.name;
    const base = this._lastKnownHistory || [];
    const optimistic = [
      ...base,
      { role: "user", text: userText, time: now, character_name: avatarName },
      {
        role: "assistant",
        text: data.reply || data.text_en || "",
        text_en: data.reply || data.text_en || "",
        text_ja: data.translated_reply || data.text_ja || "",
        time: now,
        character_name: avatarName,
      },
    ];
    this._lastKnownHistory = optimistic;
    this.emit("chat-history", {
      history: optimistic,
      responseLanguage: this.responseLanguage,
      avatarName,
    });
  }

  applyBehavior(data) {
    const selectedLang = this.responseLanguage;
    let en = data.reply || data.text_en || "";
    let ja = data.translated_reply || data.text_ja || "";

    if (selectedLang === "en") {
      ja = "";
      data.primary = "en";
      data.audio_url = data.audio_url_en || "";
      data.visemes = data.visemes_en || [];
    } else if (selectedLang === "ja") {
      en = "";
      data.primary = "ja";
      data.audio_url = data.audio_url_ja || "";
      data.visemes = data.visemes_ja || [];
    } else {
      data.primary = "en";
      data.audio_url = data.audio_url_en || "";
      data.visemes = data.visemes_en || [];
    }

    if (data._offline) {
      // Fallback reply — surface it without polluting the persisted chat log.
      const offlineText = en || ja || data.reply || "Offline";
      this.emitStatus(offlineText, "red");
      this.speakOfflineNotice(offlineText);
    }

    this.emitThinking(false);

    const incomingAnim = String(data.animation || "")
      .toLowerCase()
      .trim();
    const isOneShotGesture = ["greeting", "thankful", "nod"].includes(
      incomingAnim,
    );
    const hasAudio = !!(
      data.audio_url ||
      data.audio_url_en ||
      data.audio_url_ja
    );

    // Backend replied fine but its TTS came back empty (e.g. edge_tts
    // unreachable) — distinct from data._offline; voice it locally instead of staying silent.
    if (!data._offline && !hasAudio) {
      const fallbackText = en || ja || data.reply || "";
      if (fallbackText)
        this.speakLocalNotice(fallbackText, { settleAnimation: "idle" });
    }

    // A named clip (e.g. 'offline') other than the gesture/talk/idle ones, that actually exists.
    const hasStandaloneClip =
      incomingAnim &&
      !isOneShotGesture &&
      incomingAnim !== "talk" &&
      incomingAnim !== "idle" &&
      typeof this.model.animationManager?.hasClip === "function" &&
      this.model.animationManager.hasClip(incomingAnim);

    if (this.model.animationManager) {
      if (isOneShotGesture) {
        // Gesture itself plays via the emotion/gesture system; this just sets the post-gesture fallback.
        this.model.animationManager.isTalking = hasAudio;
      } else if (hasStandaloneClip) {
        // Specific clip requested and exists — play it instead of the default talk/idle loop.
        this.model.animationManager.play(incomingAnim, {
          loop: true,
          fade: 0.7,
        });
        this.model.animationManager.isTalking = hasAudio;
      } else if (hasAudio) {
        this.model.animationManager.setTalkingState(true);
      } else {
        this.model.animationManager.setTalkingState(false);
      }
    }
    const resolvedExpression = data.expression || data.emotion;

    if (this.model.expressionEngine) {
      this.model.expressionEngine.setTalkingState(hasAudio);
      if (resolvedExpression) {
        this.model.expressionEngine.setExpression(resolvedExpression);
      }
    }

    const captionText =
      selectedLang === "en" ? en : selectedLang === "ja" ? ja : en || ja;
    // Instant preview before processAudioQueue() knows real audio duration;
    // replaced almost immediately by the properly timed chunk sequence below.
    const [previewChunk] = this.splitIntoCaptionChunks(captionText);
    this.emitCaption(previewChunk || captionText);

    // All three response-language modes funnel through processAudioQueue so
    // avatar:speaking fires consistently; the backend now returns one
    // shared track/text for 'both' too, same as 'en'/'ja'.
    if (selectedLang === "en") {
      this.audioQueue.push({
        ...data,
        primary: "en",
        audio_url: data.audio_url_en || "",
        visemes: data.visemes_en || [],
      });
    } else if (selectedLang === "ja") {
      this.audioQueue.push({
        ...data,
        primary: "ja",
        audio_url: data.audio_url_ja || "",
        visemes: data.visemes_ja || [],
      });
    } else {
      this.audioQueue.push({
        ...data,
        primary: "en",
        audio_url: data.audio_url || data.audio_url_en || data.audio_url_ja || "",
        visemes: data.visemes || data.visemes_en || data.visemes_ja || [],
      });
    }
    this.processAudioQueue();
  }

  /** Voices the offline fallback via browser speech synthesis, settling
   * into the 'offline' pose once done. */
  speakOfflineNotice(text) {
    this.speakLocalNotice(text, {
      settleAnimation: "offline",
      retryFlag: "_offlineVoiceRetried",
    });
  }

  /**
   * Voices `text` via browser speech synthesis instead of backend audio —
   * used when the backend is unreachable, or when it replied fine but its
   * TTS came back empty. Drives lip-sync simulation and a talk animation
   * for the utterance's duration.
   *
   * @param {string} text
   * @param {{settleAnimation?: 'offline'|'idle', retryFlag?: string}} [options]
   *   settleAnimation: pose on speech end. retryFlag: per-call-site flag so
   *   concurrent retries (offline-notice vs TTS-missing) don't collide.
   */
  speakLocalNotice(
    text,
    { settleAnimation = "idle", retryFlag = "_localVoiceRetried" } = {},
  ) {
    if (!text || typeof window === "undefined" || !window.speechSynthesis)
      return;

    // Voice list loads async in some browsers (notably Chrome) — retry once after it populates.
    if (!window.speechSynthesis.getVoices().length && !this[retryFlag]) {
      this[retryFlag] = true;
      window.speechSynthesis.addEventListener(
        "voiceschanged",
        () => this.speakLocalNotice(text, { settleAnimation, retryFlag }),
        { once: true },
      );
      return;
    }
    this[retryFlag] = false;

    try {
      window.speechSynthesis.cancel(); // don't stack announcements
      const utterance = new SpeechSynthesisUtterance(text);

      const avatar = lookupAvatar(this.currentAvatarId, this.instanceId);
      const neuralVoiceName = avatar?.voiceEn || "";
      // Edge-TTS names look like "en-US-JennyNeural" — pull the locale so the browser voice at least matches.
      const localeMatch = neuralVoiceName.match(/^[a-z]{2}-[A-Z]{2}/);
      const locale = localeMatch ? localeMatch[0] : "en-US";
      utterance.lang = locale;

      const browserVoice = this.pickBrowserVoice(locale, neuralVoiceName);
      if (browserVoice) utterance.voice = browserVoice;

      utterance.onstart = () => {
        this.model.lipSync?.simulateTalking(true);
        if (this.model.animationManager) {
          this.model.animationManager.isTalking = true;
          this.model.animationManager.play("talk", { loop: true, fade: 0.7 });
        }
      };

      const settle = () => {
        this.model.lipSync?.simulateTalking(false);
        if (this.model.animationManager) {
          this.model.animationManager.isTalking = false;
          if (
            settleAnimation === "offline" &&
            this.model.animationManager.hasClip?.("offline")
          ) {
            this.model.animationManager.play("offline", {
              loop: true,
              fade: 0.7,
            });
          } else {
            this.model.animationManager.play("idle", { loop: true, fade: 0.7 });
          }
        }
      };
      utterance.onend = settle;
      utterance.onerror = settle;

      window.speechSynthesis.speak(utterance);
    } catch (error) {
      // speechSynthesis unavailable or blocked — captions/status still show the message.
    }
  }

  /** Best-effort match between an avatar's Edge-TTS voice and a locally
   * available speechSynthesis voice — matches locale, then deterministically
   * spreads avatars across same-locale voices so they sound distinct offline. */
  pickBrowserVoice(locale, neuralVoiceName) {
    if (typeof window === "undefined" || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    const localePrefix = locale.slice(0, 2).toLowerCase();
    const localeMatches = voices.filter((v) =>
      v.lang?.toLowerCase().startsWith(localePrefix),
    );
    const pool = localeMatches.length ? localeMatches : voices;
    if (pool.length === 1 || !neuralVoiceName) return pool[0];

    let hash = 0;
    for (let i = 0; i < neuralVoiceName.length; i++) {
      hash = (hash * 31 + neuralVoiceName.charCodeAt(i)) >>> 0;
    }
    return pool[hash % pool.length];
  }

  async processAudioQueue() {
    if (this.isAudioPlaying || this.audioQueue.length === 0) return;
    this.isAudioPlaying = true;
    this.emit("speaking", { active: true });

    const nextData = this.audioQueue.shift();
    const captionText =
      nextData.primary === "ja"
        ? nextData.translated_reply || nextData.text_ja || ""
        : nextData.reply || nextData.text_en || "";

    // Actually-resolved backend, not the bare BACKEND constant (which is ''
    // whenever a `backend` attribute override is set).
    const backendOrigin = this.model.backend || BACKEND;

    // Set once the chunk sequence finishes; if audio's own end callback
    // fires first, hideCaption(null) falls back to whatever's showing.
    let lastChunkId = null;

    this.lastAudio =
      this.model.emotionSystem?.apply(nextData, backendOrigin, () =>
        this.hideCaption(lastChunkId),
      ) || null;

    const relativeAudioUrl =
      nextData.primary === "ja"
        ? nextData.audio_url_ja || nextData.audio_url || nextData.audio_url_en
        : nextData.audio_url_en || nextData.audio_url || nextData.audio_url_ja;
    const audioUrl = relativeAudioUrl
      ? `${backendOrigin}${relativeAudioUrl}`
      : relativeAudioUrl;
    let duration = AUDIO_FALLBACK_DURATION;

    if (audioUrl) {
      try {
        duration = await this.measureAudioDuration(audioUrl);
      } catch (error) {}
    }

    // Replayed as timed bursts (like real closed captions) — see splitIntoCaptionChunks/playCaptionChunks.
    const chunks = this.splitIntoCaptionChunks(captionText);
    const chunkSequence = this.playCaptionChunks(chunks, duration).then(
      (id) => {
        lastChunkId = id;
      },
    );

    await new Promise((resolve) => setTimeout(resolve, duration + 200));
    await chunkSequence;
    this.isAudioPlaying = false;
    if (this.audioQueue.length > 0) {
      this.processAudioQueue();
    } else {
      // Only clear "speaking" once the whole queue finishes, so inputs
      // don't briefly re-enable mid-reply when more than one entry is queued.
      this.emit("speaking", { active: false });
    }
  }

  measureAudioDuration(url) {
    return new Promise((resolve) => {
      const audio = new Audio(url);
      audio.addEventListener("loadedmetadata", () =>
        resolve(audio.duration * 1000),
      );
      audio.addEventListener("error", () => resolve(AUDIO_FALLBACK_DURATION));
    });
  }

  emitThinking(active) {
    this.emit("thinking", { active: Boolean(active) });
  }

  emitCaption(text, durationMs = 0) {
    if (!text || !text.trim()) {
      this.hideCaption();
      return null;
    }

    this._nextCaptionId = (this._nextCaptionId || 0) + 1;
    const captionId = this._nextCaptionId;
    this.emit("show-caption", {
      text: text.trim(),
      durationMs,
      captionId,
    });
    return captionId;
  }

  hideCaption(captionId = null) {
    this.emit("hide-caption", { captionId });
  }

  /** Breaks a reply into short caption-sized pieces so a long reply never
   * covers the avatar's face — splits on sentence boundaries first, falling
   * back to word boundaries for any single sentence still too long. */
  splitIntoCaptionChunks(text, maxChars = 130) {
    const trimmed = String(text || "").trim();
    if (!trimmed) return [];

    const sentences = trimmed
      .split(/(?<=[.!?。！？])\s*/)
      .map((s) => s.trim())
      .filter(Boolean);

    const chunks = [];
    for (const sentence of sentences) {
      if (sentence.length <= maxChars) {
        chunks.push(sentence);
        continue;
      }
      const words = sentence.split(/\s+/);
      let current = "";
      for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length > maxChars && current) {
          chunks.push(current);
          current = word;
        } else {
          current = next;
        }
      }
      if (current) chunks.push(current);
    }

    return chunks.length ? chunks : [trimmed];
  }

  /** Steps through caption chunks as a timed sequence, distributing
   * totalDurationMs proportionally to each chunk's length. Returns the id
   * of the last chunk shown, so the caller can hide it once playback ends. */
  async playCaptionChunks(chunks, totalDurationMs) {
    if (!chunks.length) return null;

    const totalChars = chunks.reduce((sum, c) => sum + c.length, 0) || 1;
    const MIN_CHUNK_MS = 900; // floor so even a short trailing chunk stays readable

    let captionId = null;
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      const share = chunk.length / totalChars;
      const chunkDuration = Math.max(
        MIN_CHUNK_MS,
        Math.round(totalDurationMs * share),
      );

      captionId = this.emitCaption(chunk, chunkDuration);
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, chunkDuration));
      }
    }
    return captionId;
  }

  /** Pulls the authoritative conversation log and hands the UI one full
   * snapshot. Unreachable backend resolves to an empty list rather than
   * falling back to local state. */
  async refreshHistory() {
    const requestId = ++this._historyRequestId;
    const avatarName = lookupAvatar(
      this.currentAvatarId,
      this.instanceId,
    )?.name;
    try {
      const data = await this.brain.history(avatarName);
      if (requestId !== this._historyRequestId) return;
      const history = Array.isArray(data?.history) ? data.history : [];
      this._lastKnownHistory = history;
      this.emit("chat-history", {
        history,
        responseLanguage: this.responseLanguage,
        avatarName,
      });
    } catch (error) {
      if (requestId !== this._historyRequestId) return;
      this.emit("chat-history", {
        history: [],
        responseLanguage: this.responseLanguage,
        avatarName,
      });
    }
  }

  /** Clears the backend's conversation history and refreshes the panel. */
  async clearChatHistory() {
    const avatarName = lookupAvatar(
      this.currentAvatarId,
      this.instanceId,
    )?.name;
    await this.brain.reset(avatarName);
    this.refreshHistory();
  }

  emitAvailableAvatars() {
    this.emit("available-avatars", {
      avatars: getAllAvatars(this.instanceId),
      currentAvatarId: this.currentAvatarId,
      currentAvatarName: lookupAvatar(this.currentAvatarId, this.instanceId)
        ?.name,
      responseLanguage: this.responseLanguage,
    });
  }

  emitStatus(text, color = "white") {
    this.emit("update-status", { text, color });
  }

  resetConversation() {
    this.brain.reset();
    this.model.emotionSystem?.reset();
    this.emitStatus("Conversation reset", "green");
    this.emit("chat-action", { type: "reset" });
  }
}

export { AvatarController };