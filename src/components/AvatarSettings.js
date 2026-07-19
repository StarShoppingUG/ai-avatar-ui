import { emitAvatarEvent } from './events.js';
import { getStoredUiLanguage, getUiText } from './i18n.js';
import { RESPONSE_LANGUAGES, DEFAULT_RESPONSE_LANGUAGE, UI_LANGUAGES } from './constants.js';

class AvatarSettings extends HTMLElement {
  connectedCallback() {
    this.classList.add('avatar-settings');
    this.innerHTML = `
      <div class="settings-toggle-wrapper">
        <button type="button" class="settings-toggle">⚙️ Settings</button>
      </div>
      <div class="settings-overlay" aria-hidden="true">
        <div class="settings-card" role="dialog" aria-modal="true">
          <div class="settings-header">
            <div>
              <div class="settings-title">Avatar Settings</div>
              <div class="settings-subtitle">Switch avatar, response language, interface language, chat history.</div>
            </div>
            <button type="button" class="settings-close" aria-label="Close settings">✕</button>
          </div>
          <div class="settings-body">
           <div class="profile-card">
              <div class="profile-name"></div>
              <div class="profile-bio"></div>
            </div>
            <div class="settings-group">
              <label>Avatar</label>
              <select class="avatar-select"></select>
            </div>
            <div class="settings-group">
              <label>Reply language</label>
              <select class="response-language-select"></select>
            </div>
            <div class="settings-group">
              <label>Interface</label>
              <select class="ui-language-select"></select>
            </div>
           
            <div class="settings-group">
              <button type="button" class="history-open">View chat history</button>
            </div>
          </div>
          <div class="chat-history-overlay" aria-hidden="true">
            <div class="chat-history-card" role="dialog" aria-modal="true">
              <div class="chat-history-header">
                <div>
                  <div class="history-title">Chat history</div>
                  <div class="history-subtitle">Review and clear your conversation log.</div>
                </div>
                <button type="button" class="history-close" aria-label="Close chat history">✕</button>
              </div>
              <div class="chat-history-actions">
                <button type="button" class="history-clear">Clear history</button>
              </div>
              <div class="chat-history-thread"></div>
            </div>
          </div>
          <div class="confirm-reset-overlay" aria-hidden="true">
            <div class="confirm-reset-card" role="dialog" aria-modal="true">
              <div class="confirm-reset-title">Clear chat history?</div>
              <div class="confirm-reset-copy">This action is irreversible and will remove your conversation history.</div>
              <div class="confirm-reset-actions">
                <button type="button" class="confirm-reset-cancel">Cancel</button>
                <button type="button" class="confirm-reset-confirm">Clear</button>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    `;
    this.cacheNodes();
    this.bindEvents();
    this.populateResponseLanguages();
    this.populateUiLanguages();
    this.applyUiLanguage(getStoredUiLanguage());
    window.addEventListener('avatar:available-avatars', (event) => this.populateAvatars(event.detail));
    window.addEventListener('avatar:update-profile', (event) => this.updateProfile(event.detail));
  }

  cacheNodes() {
    this.settingsToggle = this.querySelector('.settings-toggle');
    this.settingsOverlay = this.querySelector('.settings-overlay');
    this.settingsClose = this.querySelector('.settings-close');
    this.avatarSelect = this.querySelector('.avatar-select');
    this.responseLanguageSelect = this.querySelector('.response-language-select');
    this.uiLanguageSelect = this.querySelector('.ui-language-select');
    this.profileName = this.querySelector('.profile-name');
    this.profileBio = this.querySelector('.profile-bio');
    this.historyOpenBtn = this.querySelector('.history-open');
    this.chatHistoryOverlay = this.querySelector('.chat-history-overlay');
    this.historyCloseBtn = this.querySelector('.history-close');
    this.historyThread = this.querySelector('.chat-history-thread');
    this.historyClearBtn = this.querySelector('.history-clear');
    this.confirmOverlay = this.querySelector('.confirm-reset-overlay');
    this.confirmCancelBtn = this.querySelector('.confirm-reset-cancel');
    this.confirmConfirmBtn = this.querySelector('.confirm-reset-confirm');
  }

  bindEvents() {
    this.settingsToggle?.addEventListener('click', () => this.openSettings());
    this.settingsClose?.addEventListener('click', () => this.closeSettings());
    this.settingsOverlay?.addEventListener('click', (event) => {
      if (event.target === this.settingsOverlay) {
        this.closeSettings();
      }
    });

    this.avatarSelect?.addEventListener('change', (event) => {
      emitAvatarEvent('select-avatar', { avatarId: event.target.value });
    });
    this.responseLanguageSelect?.addEventListener('change', (event) => {
      emitAvatarEvent('set-response-language', { language: event.target.value });
    });
    this.uiLanguageSelect?.addEventListener('change', (event) => {
      emitAvatarEvent('set-ui-language', { language: event.target.value });
    });
    this.historyOpenBtn?.addEventListener('click', () => {
      emitAvatarEvent('open-chat-history');
      this.openChatHistory();
    });
    this.historyClearBtn?.addEventListener('click', () => this.openConfirmReset());
    this.historyCloseBtn?.addEventListener('click', () => this.closeChatHistory());
    this.confirmCancelBtn?.addEventListener('click', () => this.closeConfirmReset());
    this.confirmConfirmBtn?.addEventListener('click', () => this.confirmClearHistory());
    this.confirmOverlay?.addEventListener('click', (event) => {
      if (event.target === this.confirmOverlay) {
        this.closeConfirmReset();
      }
    });
    this.chatHistoryOverlay?.addEventListener('click', (event) => {
      if (event.target === this.chatHistoryOverlay) {
        this.closeChatHistory();
      }
    });
    window.addEventListener('avatar:open-chat-history', () => this.openChatHistory());
    window.addEventListener('avatar:chat-history', (event) => this.renderHistory(event.detail?.history || [], event.detail?.responseLanguage, event.detail?.avatarName));
  }

  openSettings() {
    this.settingsOverlay?.classList.add('open');
    this.settingsOverlay?.setAttribute('aria-hidden', 'false');
  }

  closeSettings() {
    this.settingsOverlay?.classList.remove('open');
    this.settingsOverlay?.setAttribute('aria-hidden', 'true');
  }

  openChatHistory() {
    this.chatHistoryOverlay?.classList.add('open');
    this.chatHistoryOverlay?.setAttribute('aria-hidden', 'false');
  }

  closeChatHistory() {
    this.chatHistoryOverlay?.classList.remove('open');
    this.chatHistoryOverlay?.setAttribute('aria-hidden', 'true');
  }

  populateAvatars(detail = {}) {
    const avatars = Array.isArray(detail.avatars) ? detail.avatars : [];
    const currentAvatarName = detail.currentAvatarName || detail.currentAvatarId;
    if (!this.avatarSelect) return;
    this.avatarSelect.innerHTML = avatars
      .map((avatar) => `<option value="${avatar.name}" ${avatar.name === currentAvatarName ? 'selected' : ''}>${avatar.name}</option>`)
      .join('');

    if (currentAvatarName) {
      this.avatarSelect.value = currentAvatarName;
      emitAvatarEvent('request-current-profile');
    }

    this.populateResponseLanguages(detail.responseLanguage);
    this.populateUiLanguages();
  }

  // preferredLanguage, when given, is the controller's actual current
  // (possibly backend-restored) responseLanguage. Without it, rebuilding
  // the <select>'s innerHTML below wipes any prior selection, and reading
  // .value straight back just returns the first <option> ("en") — not
  // whatever was previously selected or restored. Blindly emitting that
  // guessed value used to re-save it as if the user had just chosen it,
  // clobbering a correctly-restored setting on every single page load.
  populateResponseLanguages(preferredLanguage = null) {
    if (!this.responseLanguageSelect) return;
    const requested = preferredLanguage || this.responseLanguageSelect.value;
    this.responseLanguageSelect.innerHTML = RESPONSE_LANGUAGES
      .map((lang) => `<option value="${lang}">${lang === 'en' ? 'English' : lang === 'ja' ? 'Japanese' : 'Japanese + English'}</option>`)
      .join('');
    const selectedValue = RESPONSE_LANGUAGES.includes(requested) ? requested : DEFAULT_RESPONSE_LANGUAGE;
    this.responseLanguageSelect.value = selectedValue;
    emitAvatarEvent('set-response-language', { language: selectedValue });
  }

  populateUiLanguages() {
    if (!this.uiLanguageSelect) return;
    this.uiLanguageSelect.innerHTML = UI_LANGUAGES
      .map((lang) => `<option value="${lang}">${lang === 'en' ? 'English' : '日本語'}</option>`)
      .join('');
    this.uiLanguageSelect.value = getStoredUiLanguage();
  }

  applyUiLanguage(language = 'en') {
    const lang = UI_LANGUAGES.includes(language) ? language : 'en';
    const text = getUiText(lang);

    const labels = this.querySelectorAll('.settings-group > label');
    if (labels[0]) labels[0].textContent = text.avatarLabel;
    if (labels[1]) labels[1].textContent = text.replyLabel;
    if (labels[2]) labels[2].textContent = text.interfaceLabel;

    const historyOpen = this.querySelector('.history-open');
    if (historyOpen) historyOpen.textContent = text.historyButton;

    const historyTitle = this.querySelector('.history-title');
    if (historyTitle) historyTitle.textContent = text.historyTitle;

    const historySubtitle = this.querySelector('.history-subtitle');
    if (historySubtitle) historySubtitle.textContent = text.historySubtitle;

    const historyClear = this.querySelector('.history-clear');
    if (historyClear) historyClear.textContent = text.clearHistory;

    const historyClose = this.querySelector('.history-close');
    if (historyClose) historyClose.setAttribute('aria-label', text.close);

    const settingsToggle = this.querySelector('.settings-toggle');
    if (settingsToggle) {
      settingsToggle.textContent = `⚙️ ${text.settingsLabel}`;
      settingsToggle.setAttribute('aria-label', text.openSettings);
    }

    const settingsClose = this.querySelector('.settings-close');
    if (settingsClose) settingsClose.setAttribute('aria-label', text.closeSettings);

    const title = this.querySelector('.settings-title');
    if (title) title.textContent = text.settingsTitle;

    const subtitle = this.querySelector('.settings-subtitle');
    if (subtitle) subtitle.textContent = text.settingsSubtitle;

    const input = this.querySelector('.chat-input');
    if (input) input.placeholder = text.placeholder;

    const sendBtn = this.querySelector('.send-btn');
    if (sendBtn) {
      sendBtn.textContent = text.send;
      sendBtn.setAttribute('title', text.send);
    }

    const micBtn = this.querySelector('.mic-btn');
    if (micBtn) micBtn.setAttribute('title', text.micTitle);

    if (this.historyThread?.querySelector('.chat-placeholder')) {
      this.historyThread.innerHTML = `<div class="chat-placeholder">${text.conversationCleared}</div>`;
    }

    if (this.uiLanguageSelect) {
      this.uiLanguageSelect.value = lang;
    }
    if (this.currentProfileDetail) {
      this.updateProfile(this.currentProfileDetail);
    }
  }

  updateProfile(detail = {}) {
    if (!this.profileName || !this.profileBio) return;
    this.currentProfileDetail = { ...(this.currentProfileDetail || {}), ...detail };
    this.profileName.textContent = detail.name || this.profileName.textContent;
    const language = getStoredUiLanguage();
    const personaText = language === 'ja'
      ? (this.currentProfileDetail.personaJa || detail.personaJa || detail.persona)
      : detail.persona;
    this.profileBio.textContent = personaText || this.profileBio.textContent;
  }

  /**
   * Renders a full snapshot from the backend (avatar:chat-history), replacing
   * whatever was shown before. Nothing here is accumulated locally — this is
   * the only way rows get into the panel.
   */
  renderHistory(list = [], responseLanguage = 'en', avatarName = '') {
    if (!this.historyThread) return;
    this.historyThread.innerHTML = '';

    if (!list.length) {
      const text = getUiText(getStoredUiLanguage());
      this.historyThread.innerHTML = `<div class="chat-placeholder">${text.conversationCleared}</div>`;
      return;
    }

    const showEn = responseLanguage === 'en' || responseLanguage === 'both';
    const showJa = responseLanguage === 'ja' || responseLanguage === 'both';

    list.forEach((entry) => {
      try {
        const time = entry.time
          ? new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '';
        // Prefer the name tagged on this specific turn (character_name from the
        // backend); fall back to the currently-selected avatar's name, then to
        // the generic label if neither is available.
        const speakerName = entry.character_name || avatarName || '';
        if (entry.role === 'assistant') {
          // Backend always stores both translations; only surface the one(s)
          // matching the current reply-language setting, same as the live reply.
          const preferEn = showEn && entry.text_en;
          const preferJa = showJa && entry.text_ja;
          if (preferEn) this.appendHistoryItem('avatar', entry.text_en, time, speakerName);
          if (preferJa) this.appendHistoryItem('avatar', entry.text_ja, time, speakerName);
          // Neither preferred-language variant was available for this turn
          // (e.g. translation failed for just this one reply) — fall back to
          // whatever text it does have instead of silently dropping the turn.
          if (!preferEn && !preferJa) {
            const fallback = entry.text_en || entry.text_ja || entry.text || entry.content || '';
            if (fallback) this.appendHistoryItem('avatar', fallback, time, speakerName);
          }
        } else {
          this.appendHistoryItem(entry.role || 'user', entry.text || entry.content || '', time);
        }
      } catch (err) {
        // A single malformed entry shouldn't take the rest of the render down
        // with it — otherwise one bad row silently hides every newer message
        // that comes after it in the list.
        console.error('Failed to render a chat history entry:', entry, err);
      }
    });

    this.historyThread.scrollTo({ top: this.historyThread.scrollHeight, behavior: 'auto' });
  }

  appendHistoryItem(role, text, time = '', speakerName = '') {
    const clean = String(text || '').trim();
    if (!this.historyThread || !clean) return;

    const sender = String(role || '').trim().toLowerCase();
    const label = sender === 'user'
      ? 'You'
      : (sender === 'avatar' || sender === 'assistant')
        ? (speakerName || 'Avatar')
        : sender ? sender.charAt(0).toUpperCase() + sender.slice(1) : 'Message';

    const item = document.createElement('div');
    const isUser = sender === 'user';
    item.className = `chat-history-item ${isUser ? 'chat-history-item--user' : 'chat-history-item--avatar'}`;
    item.innerHTML = `
      <div class="chat-history-meta">
        <span class="chat-history-sender">${label}</span>
        ${time ? `<span class="chat-history-time">${time}</span>` : ''}
      </div>
      <div class="chat-history-bubble">${clean}</div>
    `;

    this.historyThread.appendChild(item);
  }

  openConfirmReset() {
    this.confirmOverlay?.classList.add('open');
    this.confirmOverlay?.setAttribute('aria-hidden', 'false');
  }

  closeConfirmReset() {
    this.confirmOverlay?.classList.remove('open');
    this.confirmOverlay?.setAttribute('aria-hidden', 'true');
  }

  confirmClearHistory() {
    emitAvatarEvent('clear-chat-history');
    this.closeConfirmReset();
    this.closeChatHistory();
  }
}


export { AvatarSettings };