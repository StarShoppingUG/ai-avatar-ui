import { CharacterBrain } from '../avatar/CharacterBrain.js';
import { AVATAR_SOURCES, DEFAULT_AVATAR_NAME, getAvatar as lookupAvatar } from '../avatar/AvatarSources.js';
import { emitAvatarEvent } from './events.js';
import { BACKEND, DEFAULT_RESPONSE_LANGUAGE, RESPONSE_LANGUAGES, UI_LANGUAGES, AUDIO_FALLBACK_DURATION } from './constants.js';
import { applyUiLanguageToApp } from './i18n.js';

const AVATAR_LIST = AVATAR_SOURCES;

class AvatarController {
  constructor(model) {
    this.model = model;
    this.currentAvatarId = DEFAULT_AVATAR_NAME;
    this.responseLanguage = DEFAULT_RESPONSE_LANGUAGE;
    this.brain = new CharacterBrain(model.backend || BACKEND);
    this.voiceCatalog = { en: [], ja: [] };
    this.lastAudio = null;
    this.audioQueue = [];
    this.isAudioPlaying = false;
  }

  async init() {
    emitAvatarEvent('app:loading');
    this.emitStatus('Loading avatar…', 'yellow');
    this.registerListeners();
  
    await customElements.whenDefined('avatar-settings');
   
    this.syncInitialResponseLanguage();
    await this.loadPersistedSettings();
    this.emitAvailableAvatars();

    await this.loadVoiceCatalog();
 
    await this.selectAvatar(this.currentAvatarId);
 
    this.refreshHistory();

    this.emitStatus('Ready', 'green');
    emitAvatarEvent('app:ready');
  }

  // Pulls this user's saved settings (last avatar, reply language, UI
  // language) from the backend and applies them before the first avatar is
  // selected — runs after syncInitialResponseLanguage() so it takes
  // priority over that DOM-default fallback. Backend unreachable/offline
  // just means falling back to the existing in-code defaults for this run;
  // it's not fatal.
  async loadPersistedSettings() {
    try {
      const settings = await this.brain.getSettings();
      if (settings.last_avatar) {
        this.currentAvatarId = settings.last_avatar;
      }
      if (settings.response_language && RESPONSE_LANGUAGES.includes(settings.response_language)) {
        this.responseLanguage = settings.response_language;
      }
      if (settings.ui_language && UI_LANGUAGES.includes(settings.ui_language)) {
        applyUiLanguageToApp(settings.ui_language);
      }
    } catch (error) {
      console.error('[avatar-init] loadPersistedSettings failed — falling back to in-code defaults:', error);
    }
  }

  registerListeners() {
    window.addEventListener('avatar:open-chat-history', () => this.refreshHistory());
    window.addEventListener('avatar:clear-chat-history', () => this.clearChatHistory());

    window.addEventListener('avatar:ask', (event) => {
      const text = String(event.detail?.text || '').trim();
      if (text) this.handleAsk(text);
    });

    window.addEventListener('avatar:select-avatar', (event) => {
      const avatarName = event.detail?.avatarId;
      if (avatarName) this.selectAvatar(avatarName);
    });

    window.addEventListener('avatar:request-current-profile', () => {
      const avatar = lookupAvatar(this.currentAvatarId);
      if (!avatar) return;
      emitAvatarEvent('update-profile', {
        name: avatar.name,
        persona: avatar.persona,
        personaJa: avatar.personaJa || avatar.persona,
        voiceEn: avatar.voiceEn,
        voiceJa: avatar.voiceJa,
      });
    });

    window.addEventListener('avatar:set-response-language', (event) => {
      const language = event.detail?.language;
      if (RESPONSE_LANGUAGES.includes(language)) {
        this.responseLanguage = language;
        this.brain.saveSettings({ response_language: language }).catch(() => {});
      }
    });

    window.addEventListener('avatar:set-ui-language', (event) => {
      const language = event.detail?.language;
      if (UI_LANGUAGES.includes(language)) {
        applyUiLanguageToApp(language);
        emitAvatarEvent('request-current-profile');
        this.brain.saveSettings({ ui_language: language }).catch(() => {});
      }
    });

    window.addEventListener('avatar:thinking', (event) => {
      const active = Boolean(event.detail?.active);
      if (active) {
        this.model.emotionSystem?.startThinking();
      } else {
        this.model.emotionSystem?.stopThinking();
      }
    });

    window.addEventListener('avatar:listening', (event) => {
      const active = Boolean(event.detail?.active);
      if (active) {
        this.model.emotionSystem?.startListening();
      } else {
        this.model.emotionSystem?.stopListening();
      }
    });

    window.addEventListener('avatar:set-voice', (event) => {
      const { lang, voiceName } = event.detail || {};
      const avatar = lookupAvatar(this.currentAvatarId);
      if (!avatar || !voiceName) return;
      if (lang === 'ja') avatar.voiceJa = voiceName;
      else avatar.voiceEn = voiceName;
      this.emitStatus('Voice updated.', 'green');
    });

    window.addEventListener('avatar:reset', () => this.resetConversation());
  }

  async loadVoiceCatalog() {

    try {
      const { catalog } = await this.brain.voices();
 
      this.voiceCatalog = catalog || { en: [], ja: [] };
      emitAvatarEvent('available-voices', { catalog: this.voiceCatalog });
    } catch (error) {
 
      emitAvatarEvent('available-voices', { catalog: this.voiceCatalog });
    }
  }

  syncInitialResponseLanguage() {
    const settings = document.querySelector('avatar-settings');
    const currentValue = settings?.querySelector('.response-language-select')?.value;
    if (RESPONSE_LANGUAGES.includes(currentValue)) {
      this.responseLanguage = currentValue;
    }
  }

  async selectAvatar(avatarId) {
  
    const avatar = lookupAvatar(avatarId);
    if (!avatar) {
  
      return;
    }

    // lookupAvatar() falls back to AVATAR_SOURCES[0] whenever avatarId
    // doesn't match a known avatar (e.g. a typo'd default/persisted id).
    // If we blindly stored the requested avatarId here, currentAvatarId
    // would silently diverge from the avatar that's actually loaded —
    // breaking the settings dropdown selection and keying chat history
    // lookups to an id the backend never saw. Storing avatar.name instead
    // means currentAvatarId always reflects reality, and a mismatch is
    // surfaced immediately rather than failing silently.
    if (avatar.name !== avatarId) {
      console.warn(
        `[avatar-init] selectAvatar: unknown avatarId "${avatarId}", falling back to "${avatar.name}"`,
      );
    }
    this.currentAvatarId = avatar.name;
    this.brain.saveSettings({ last_avatar: avatar.name }).catch(() => {});

    emitAvatarEvent('update-profile', {
      name: avatar.name,
      persona: avatar.persona,
      personaJa: avatar.personaJa || avatar.persona,
      voiceEn: avatar.voiceEn,
      voiceJa: avatar.voiceJa,
    });

    this.emitStatus(`Loading ${avatar.name}…`, 'yellow');
    emitAvatarEvent('avatar-loading', { active: true });

    await this.model.loadAvatar(avatarId, avatar);

    emitAvatarEvent('avatar-loading', { active: false });
    this.emitStatus('Ready', 'green');

    // Switching avatars means the chat history panel should now show this
    // avatar's own past messages, not whatever the previous avatar had.
    this.refreshHistory();
  }

  async handleAsk(text) {
    this.emitStatus('Thinking…', 'yellow');
    this.emitThinking(true);

    const avatar = lookupAvatar(this.currentAvatarId);
    const speakLanguage = this.responseLanguage === 'ja' ? 'ja' : 'en';
    let data;
    let reachedBackend = true;

    try {
      data = await this.brain.ask(
        text,
        'Default',
        avatar?.persona,
        { en: avatar?.voiceEn, ja: avatar?.voiceJa },
        avatar?.name,
        speakLanguage,
      );
    } catch (error) {
      reachedBackend = false;
      data = this.brain.offlineBehavior(text);
    }

    this.applyBehavior(data);
    this.emitStatus('Ready', 'green');

    // The chat history panel is sourced from the backend's conversation_history,
    // not accumulated locally — only pull a fresh copy when we actually reached
    // the backend, so an offline/unreachable backend leaves it unpopulated
    // instead of showing a client-only guess.
    if (reachedBackend) {
      await this.refreshHistory();
    }
  }

  applyBehavior(data) {
    const selectedLang = this.responseLanguage;
    let en = data.reply || data.text_en || '';
    let ja = data.translated_reply || data.text_ja || '';

    if (selectedLang === 'en') {
      ja = '';
      data.primary = 'en';
      data.audio_url = data.audio_url_en || '';
      data.visemes = data.visemes_en || [];
    } else if (selectedLang === 'ja') {
      en = '';
      data.primary = 'ja';
      data.audio_url = data.audio_url_ja || '';
      data.visemes = data.visemes_ja || [];
    } else {
      data.primary = 'en';
      data.audio_url = data.audio_url_en || '';
      data.visemes = data.visemes_en || [];
    }

    if (data._offline) {
      // Fallback reply — surface it to the user without polluting the persisted chat log.
      const offlineText = en || ja || data.reply || 'Offline';
      this.emitStatus(offlineText, 'red');
      this.speakOfflineNotice(offlineText);
    }

    this.emitThinking(false);

    const incomingAnim = String(data.animation || '').toLowerCase().trim();
    const isOneShotGesture = ['greeting', 'thankful', 'nod'].includes(incomingAnim);
    const hasAudio = !!(data.audio_url || data.audio_url_en || data.audio_url_ja);

    // Backend was reached and replied normally, but its TTS call came back
    // empty (e.g. edge_tts's cloud endpoint is unreachable while our own
    // backend and the LLM call are fine). Distinct from the data._offline
    // case above — the avatar isn't "offline" here, it just has no audio for
    // this one reply — so voice it locally instead of leaving it silent.
    if (!data._offline && !hasAudio) {
      const fallbackText = en || ja || data.reply || '';
      if (fallbackText) this.speakLocalNotice(fallbackText, { settleAnimation: 'idle' });
    }

    // A named clip other than the gesture/talk/idle ones (e.g. 'offline') that actually
    // exists in the AnimationManager's loaded clips.
    const hasStandaloneClip = incomingAnim
      && !isOneShotGesture
      && incomingAnim !== 'talk'
      && incomingAnim !== 'idle'
      && typeof this.model.animationManager?.hasClip === 'function'
      && this.model.animationManager.hasClip(incomingAnim);

    if (this.model.animationManager) {
      if (isOneShotGesture) {
        // Gesture playback (greeting/thankful/nod) is triggered via the emotion/gesture system below;
        // this just tells the manager whether to fall back to talking or idle once it finishes.
        this.model.animationManager.isTalking = hasAudio;
      } else if (hasStandaloneClip) {
        // A specific clip was requested (e.g. 'offline') and exists — play it directly
        // instead of defaulting to the talk/idle loop.
        this.model.animationManager.play(incomingAnim, { loop: true, fade: 0.7 });
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

    const captionText = selectedLang === 'en' ? en : selectedLang === 'ja' ? ja : en || ja;
    this.emitCaption(captionText);

    // All three response-language modes now funnel through processAudioQueue
    // so avatar:speaking (and the duration-based timing it relies on) fires
    // consistently — previously 'en'/'ja' replies called emotionSystem.apply()
    // directly and never went through the queue, so inputs never actually
    // got disabled for the (default) single-language case.
    if (selectedLang === 'en') {
      this.audioQueue.push({ ...data, primary: 'en', audio_url: data.audio_url_en || '', visemes: data.visemes_en || [] });
    } else if (selectedLang === 'ja') {
      this.audioQueue.push({ ...data, primary: 'ja', audio_url: data.audio_url_ja || '', visemes: data.visemes_ja || [] });
    } else {
      this.audioQueue.push({ ...data, primary: 'en', audio_url: data.audio_url_en || '', visemes: data.visemes_en || [] });
      this.audioQueue.push({ ...data, primary: 'ja', audio_url: data.audio_url_ja || '', visemes: data.visemes_ja || [] });
    }
    this.processAudioQueue();
  }

  /**
   * Voices the offline fallback message using the browser's built-in speech
   * synthesis (no backend reachable at all in this state). Settles back into
   * the dedicated 'offline' pose/clip once the utterance ends, same as before.
   */
  speakOfflineNotice(text) {
    this.speakLocalNotice(text, { settleAnimation: 'offline', retryFlag: '_offlineVoiceRetried' });
  }

  /**
   * Voices `text` using the browser's built-in speech synthesis instead of
   * backend audio. Used both when the backend itself is unreachable
   * (speakOfflineNotice) and when the backend replied fine but its own TTS
   * call came back empty (e.g. edge_tts's cloud endpoint is down) — those two
   * cases differ only in what pose the avatar should settle into afterward,
   * via `settleAnimation`. Drives the avatar's lip-sync fallback simulation
   * and a talk animation for the duration of the utterance.
   *
   * @param {string} text
   * @param {{settleAnimation?: 'offline'|'idle', retryFlag?: string}} [options]
   *   settleAnimation: pose to return to when speech ends. 'offline' plays the
   *   dedicated offline clip (falling back to idle if it isn't loaded); 'idle'
   *   always returns straight to idle, since the backend is actually working.
   *   retryFlag: per-call-site flag name on `this`, so the offline-notice retry
   *   and the TTS-missing-fallback retry don't stomp on each other if both
   *   fire in the same session.
   */
  speakLocalNotice(text, { settleAnimation = 'idle', retryFlag = '_localVoiceRetried' } = {}) {
    if (!text || typeof window === 'undefined' || !window.speechSynthesis) return;

    // Voice list loads asynchronously in some browsers (notably Chrome) — retry once
    // after it's populated, but don't block the announcement indefinitely on it.
    if (!window.speechSynthesis.getVoices().length && !this[retryFlag]) {
      this[retryFlag] = true;
      window.speechSynthesis.addEventListener(
        'voiceschanged',
        () => this.speakLocalNotice(text, { settleAnimation, retryFlag }),
        { once: true }
      );
      return;
    }
    this[retryFlag] = false;

    try {
      window.speechSynthesis.cancel(); // don't stack announcements
      const utterance = new SpeechSynthesisUtterance(text);

      const avatar = lookupAvatar(this.currentAvatarId);
      const neuralVoiceName = avatar?.voiceEn || '';
      // Edge-TTS neural voice names look like "en-US-JennyNeural" — pull the locale out
      // so the browser voice at least matches language/region.
      const localeMatch = neuralVoiceName.match(/^[a-z]{2}-[A-Z]{2}/);
      const locale = localeMatch ? localeMatch[0] : 'en-US';
      utterance.lang = locale;

      const browserVoice = this.pickBrowserVoice(locale, neuralVoiceName);
      if (browserVoice) utterance.voice = browserVoice;

      utterance.onstart = () => {
        this.model.lipSync?.simulateTalking(true);
        if (this.model.animationManager) {
          this.model.animationManager.isTalking = true;
          this.model.animationManager.play('talk', { loop: true, fade: 0.7 });
        }
      };

      const settle = () => {
        this.model.lipSync?.simulateTalking(false);
        if (this.model.animationManager) {
          this.model.animationManager.isTalking = false;
          if (settleAnimation === 'offline' && this.model.animationManager.hasClip?.('offline')) {
            this.model.animationManager.play('offline', { loop: true, fade: 0.7 });
          } else {
            this.model.animationManager.play('idle', { loop: true, fade: 0.7 });
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

  /**
   * Best-effort match between an avatar's Edge-TTS neural voice name and one of
   * the browser's locally available speechSynthesis voices. Can't reproduce the
   * exact neural voice offline, so this matches locale first, then deterministically
   * spreads avatars across same-locale voices (by hashing the neural voice name) so
   * different avatars at least sound distinct from each other offline.
   */
  pickBrowserVoice(locale, neuralVoiceName) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;

    const localePrefix = locale.slice(0, 2).toLowerCase();
    const localeMatches = voices.filter((v) => v.lang?.toLowerCase().startsWith(localePrefix));
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
    emitAvatarEvent('speaking', { active: true });

    const nextData = this.audioQueue.shift();
    const captionText = nextData.primary === 'ja'
      ? (nextData.translated_reply || nextData.text_ja || '')
      : (nextData.reply || nextData.text_en || '');

    const captionDuration = nextData.primary === 'ja' ? 3200 : 0;
    const captionId = this.emitCaption(captionText, captionDuration);
    this.lastAudio = this.model.emotionSystem?.apply(nextData, BACKEND, () => this.hideCaption(captionId)) || null;

    const audioUrl = nextData.primary === 'ja'
      ? (nextData.audio_url_ja || nextData.audio_url || nextData.audio_url_en)
      : (nextData.audio_url_en || nextData.audio_url || nextData.audio_url_ja);
    let duration = AUDIO_FALLBACK_DURATION;

    if (audioUrl) {
      try {
        duration = await this.measureAudioDuration(audioUrl);
      } catch (error) {
      }
    }

    await new Promise((resolve) => setTimeout(resolve, duration + 200));
    this.isAudioPlaying = false;
    if (this.audioQueue.length > 0) {
      this.processAudioQueue();
    } else {
      // Only clear the "speaking" state once the whole queue (both the en
      // and ja variants of a reply) has finished — otherwise inputs would
      // briefly re-enable between the two clips in the same turn.
      emitAvatarEvent('speaking', { active: false });
    }
  }

  measureAudioDuration(url) {
    return new Promise((resolve) => {
      const audio = new Audio(url);
      audio.addEventListener('loadedmetadata', () => resolve(audio.duration * 1000));
      audio.addEventListener('error', () => resolve(AUDIO_FALLBACK_DURATION));
    });
  }

  emitThinking(active) {
    emitAvatarEvent('thinking', { active: Boolean(active) });
  }

  emitCaption(text, durationMs = 0) {
    if (!text || !text.trim()) {
      this.hideCaption();
      return null;
    }

    this._nextCaptionId = (this._nextCaptionId || 0) + 1;
    const captionId = this._nextCaptionId;
    emitAvatarEvent('show-caption', { text: text.trim(), durationMs, captionId });
    return captionId;
  }

  hideCaption(captionId = null) {
    emitAvatarEvent('hide-caption', { captionId });
  }

  /**
   * Pulls the authoritative conversation log from the backend and hands it
   * to the UI as one full snapshot (avatar:chat-history). If the backend
   * can't be reached — offline, not running, etc — this resolves to an
   * empty list rather than falling back to any locally-remembered state,
   * so the chat history panel simply stays unpopulated in that case.
   */
  async refreshHistory() {
    try {
      // Only pull the currently-selected avatar's own turns — the backend
      // stores every avatar's history for this user in one table, tagged
      // per row by character_name, so passing it here keeps the panel from
      // showing every avatar's messages mixed together.
      const data = await this.brain.history(this.currentAvatarId);
      emitAvatarEvent('chat-history', {
        history: Array.isArray(data?.history) ? data.history : [],
        responseLanguage: this.responseLanguage,
        avatarName: this.currentAvatarId,
      });
    } catch (error) {
      emitAvatarEvent('chat-history', { history: [], responseLanguage: this.responseLanguage, avatarName: this.currentAvatarId });
    }
  }

  /**
   * Clears the backend's conversation history (today an in-memory list,
   * later a database row/table) and refreshes the panel from it. If the
   * backend can't be reached, there's nothing server-side to clear yet —
   * refreshHistory() will just show the empty state.
   */
  async clearChatHistory() {
    await this.brain.reset(this.currentAvatarId);
    this.refreshHistory();
  }

  emitAvailableAvatars() {
    emitAvatarEvent('available-avatars', {
      avatars: AVATAR_LIST,
      currentAvatarId: this.currentAvatarId,
      currentAvatarName: this.currentAvatarId,
      responseLanguage: this.responseLanguage,
    });
  }

  emitStatus(text, color = 'white') {
    emitAvatarEvent('update-status', { text, color });
  }

  

  resetConversation() {
    this.brain.reset();
    this.model.emotionSystem?.reset();
    this.emitStatus('Conversation reset', 'green');
    emitAvatarEvent('chat-action', { type: 'reset' });
  }
}


export { AvatarController };