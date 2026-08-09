import { emitAvatarEvent } from "./events.js";
import { getStoredUiLanguage, getUiText } from "./i18n.js";
import {
  RESPONSE_LANGUAGES,
  DEFAULT_RESPONSE_LANGUAGE,
  UI_LANGUAGES,
} from "./constants.js";
import { AvatarPickerCore } from "./AvatarPickerCore.js";
import { AvatarSettingsController } from "./AvatarSettingsController.js";
class AvatarSettings extends HTMLElement {
  connectedCallback() {
    this.classList.add("avatar-settings");
    this.instanceId = this.getAttribute("instance") || "default";
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
              <img class="profile-thumb" alt="" hidden />
              <div class="persona-edit-actions">
                <button type="button" class="persona-save" title="Save" aria-label="Save">
                  <svg xmlns="http://w3.org" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 6 9 17l-5-5"></path>
                  </svg>
                </button>
                <button type="button" class="persona-reset" disabled title="Reset to default" aria-label="Reset to default">
                  <svg xmlns="http://w3.org" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 12a9 9 0 1 0 3-6.7"></path>
                    <path d="M3 4v5h5"></path>
                  </svg>
                </button>
              </div>
              <input type="text" class="profile-name" />
              <textarea class="profile-bio" rows="4"></textarea>
            </div>
   <div class="settings-group">
  <label>Avatar</label>
  <button type="button" class="avatar-open">
    <span class="avatar-open-thumb"></span>
    <span class="avatar-open-name">Choose avatar</span>
    <span class="avatar-open-chevron">›</span>
  </button>
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
          <div class="avatar-picker-overlay" aria-hidden="true">
  <div class="avatar-picker-card" role="dialog" aria-modal="true">
    <div class="avatar-picker-header">
      <div class="avatar-picker-title">Choose an avatar</div>
      <button type="button" class="avatar-picker-close" aria-label="Close">✕</button>
    </div>
    <input type="text" class="avatar-search" placeholder="Search avatars" />
    <div class="avatar-grid" role="listbox" aria-label="Choose an avatar"></div>
    <div class="avatar-grid-empty" hidden>No avatars match your search.</div>
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
// NEW:
    this.cacheNodes();
    this.core = new AvatarPickerCore(
      {
        avatarSearchInput: this.avatarSearchInput,
        avatarGrid: this.avatarGrid,
        avatarGridEmpty: this.avatarGridEmpty,
        responseLanguageSelect: this.responseLanguageSelect,
        uiLanguageSelect: this.uiLanguageSelect,
        profileName: this.profileName,
        profileBio: this.profileBio,
        personaSaveBtn: this.personaSaveBtn,
        personaResetBtn: this.personaResetBtn,
      },
      (name, detail) => this.emit(name, detail),
      this.instanceId,
      // emitOnSelect defaults to true — live-switch on click, same as before.
    );
    this.core.onAvatarSelected = () => {
      this.updateAvatarOpenButton();
      this.closeAvatarPicker();
    };
    this.core.bindEvents();
    this.bindEvents();
    this.core.populateResponseLanguages();
    this.core.populateUiLanguages();
    this.applyUiLanguage(getStoredUiLanguage(this.instanceId));
    this._onAvailableAvatars = (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      this.populateAvatars(event.detail);
    };
    this._onUpdateProfile = (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      this.core.updateProfile(event.detail);
    };
    window.addEventListener("avatar:available-avatars", this._onAvailableAvatars);
    window.addEventListener("avatar:update-profile", this._onUpdateProfile);

    this.initPersistence();
  }

  disconnectedCallback() {
    window.removeEventListener("avatar:available-avatars", this._onAvailableAvatars);
    window.removeEventListener("avatar:update-profile", this._onUpdateProfile);
    window.removeEventListener("avatar:open-chat-history", this._onOpenChatHistory);
    window.removeEventListener("avatar:chat-history", this._onChatHistory);
    this.core?.destroy?.();
    this.settingsController?.destroy?.();
  }

  // Every emission from this component goes through here so the instance
  // id is always stamped automatically.
  emit(name, detail = {}) {
    emitAvatarEvent(name, detail, this.instanceId);
  }

  cacheNodes() {
    this.settingsToggle = this.querySelector(".settings-toggle");
    this.settingsOverlay = this.querySelector(".settings-overlay");
    this.settingsClose = this.querySelector(".settings-close");
    this.avatarSearchInput = this.querySelector(".avatar-search");
    this.avatarGrid = this.querySelector(".avatar-grid");
    this.avatarGridEmpty = this.querySelector(".avatar-grid-empty");
    this.responseLanguageSelect = this.querySelector(
      ".response-language-select",
    );
    this.uiLanguageSelect = this.querySelector(".ui-language-select");
    this.profileThumb = this.querySelector(".profile-thumb");
    this.profileName = this.querySelector(".profile-name");
    this.profileBio = this.querySelector(".profile-bio");
    this.personaSaveBtn = this.querySelector(".persona-save");
    this.personaResetBtn = this.querySelector(".persona-reset");
    this.historyOpenBtn = this.querySelector(".history-open");
    this.chatHistoryOverlay = this.querySelector(".chat-history-overlay");
    this.historyCloseBtn = this.querySelector(".history-close");
    this.historyThread = this.querySelector(".chat-history-thread");
    this.historyClearBtn = this.querySelector(".history-clear");
    this.confirmOverlay = this.querySelector(".confirm-reset-overlay");
    this.confirmCancelBtn = this.querySelector(".confirm-reset-cancel");
    this.confirmConfirmBtn = this.querySelector(".confirm-reset-confirm");
    this.avatarOpenBtn = this.querySelector(".avatar-open");
    this.avatarOpenThumb = this.querySelector(".avatar-open-thumb");
    this.avatarOpenName = this.querySelector(".avatar-open-name");
    this.avatarPickerOverlay = this.querySelector(".avatar-picker-overlay");
    this.avatarPickerClose = this.querySelector(".avatar-picker-close");
  }

  bindEvents() {
    this.settingsToggle?.addEventListener("click", () => this.openSettings());
    this.settingsClose?.addEventListener("click", () => this.closeSettings());
    this.settingsOverlay?.addEventListener("click", (event) => {
      if (event.target === this.settingsOverlay) {
        this.closeSettings();
      }
    });

    this.historyOpenBtn?.addEventListener("click", () => {
      this.emit("open-chat-history");
      this.openChatHistory();
    });
    this.historyClearBtn?.addEventListener("click", () =>
      this.openConfirmReset(),
    );
    this.historyCloseBtn?.addEventListener("click", () =>
      this.closeChatHistory(),
    );
    this.confirmCancelBtn?.addEventListener("click", () =>
      this.closeConfirmReset(),
    );
    this.confirmConfirmBtn?.addEventListener("click", () =>
      this.confirmClearHistory(),
    );
    this.confirmOverlay?.addEventListener("click", (event) => {
      if (event.target === this.confirmOverlay) {
        this.closeConfirmReset();
      }
    });
    this.chatHistoryOverlay?.addEventListener("click", (event) => {
      if (event.target === this.chatHistoryOverlay) {
        this.closeChatHistory();
      }
    });
    this.avatarOpenBtn?.addEventListener("click", () =>
      this.openAvatarPicker(),
    );
    this.avatarPickerClose?.addEventListener("click", () =>
      this.closeAvatarPicker(),
    );
    this.avatarPickerOverlay?.addEventListener("click", (event) => {
      if (event.target === this.avatarPickerOverlay) {
        this.closeAvatarPicker();
      }
    });

    this._onOpenChatHistory = (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      this.openChatHistory();
    };
    this._onChatHistory = (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      this.renderHistory(
        event.detail?.history || [],
        event.detail?.responseLanguage,
        event.detail?.avatarName,
      );
    };
    window.addEventListener("avatar:open-chat-history", this._onOpenChatHistory);
    window.addEventListener("avatar:chat-history", this._onChatHistory);
  }

  openSettings() {
    this.settingsOverlay?.classList.add("open");
    this.settingsOverlay?.setAttribute("aria-hidden", "false");
  }

  closeSettings() {
    this.settingsOverlay?.classList.remove("open");
    this.settingsOverlay?.setAttribute("aria-hidden", "true");
  }

  openChatHistory() {
    this.chatHistoryOverlay?.classList.add("open");
    this.chatHistoryOverlay?.setAttribute("aria-hidden", "false");
  }

  closeChatHistory() {
    this.chatHistoryOverlay?.classList.remove("open");
    this.chatHistoryOverlay?.setAttribute("aria-hidden", "true");
  }

  openAvatarPicker() {
    this.avatarPickerOverlay?.classList.add("open");
    this.avatarPickerOverlay?.setAttribute("aria-hidden", "false");
    this.avatarSearchInput?.focus();
  }

  closeAvatarPicker() {
    this.avatarPickerOverlay?.classList.remove("open");
    this.avatarPickerOverlay?.setAttribute("aria-hidden", "true");
  }

// NEW:
  populateAvatars(detail = {}) {
    this.core.populateAvatars(detail);
    this.updateAvatarOpenButton();
    const currentAvatarName = detail.currentAvatarName || detail.currentAvatarId;
    if (currentAvatarName) {
      this.emit("request-current-profile");
    }
  }

  // Renders the searchable grid from this.avatars / this.avatarSearchQuery /
  // this.currentAvatarId. Called on initial load, on every search keystroke,
  // and after a selection so the highlighted card stays in sync.
  renderAvatarGrid() {
    if (!this.avatarGrid) return;

    const query = this.avatarSearchQuery.trim().toLowerCase();
    const filtered = query
      ? this.avatars.filter((avatar) =>
          (avatar.name || "").toLowerCase().includes(query),
        )
      : this.avatars;

    if (this.avatarGridEmpty) {
      this.avatarGridEmpty.hidden = filtered.length > 0;
    }

    this.avatarGrid.innerHTML = filtered
      .map((avatar) => {
        const isSelected = avatar.id === this.currentAvatarId;
        const initials = (avatar.name || "?").trim().slice(0, 2).toUpperCase();
        const thumb = avatar.thumbnail
          ? `<img src="${avatar.thumbnail}" alt="" loading="lazy" class="avatar-card-thumb" />`
          : `<div class="avatar-card-fallback">${initials}</div>`;
        return `
        <div
          class="avatar-card${isSelected ? " avatar-card--selected" : ""}"
          data-avatar-id="${avatar.id}"
          role="option"
          aria-selected="${isSelected}"
          tabindex="0"
        >
          ${thumb}
          <span class="avatar-card-name">${avatar.name || avatar.id}</span>
        </div>
      `;
      })
      .join("");
  }

updateAvatarOpenButton() {
  if (!this.avatarOpenName) return;
  const avatar = this.core.avatars.find((a) => a.id === this.core.currentAvatarId);
  this.avatarOpenName.textContent = avatar?.name || "Choose avatar";

  if (this.avatarOpenThumb) {
    if (avatar?.thumbnail) {
      this.avatarOpenThumb.innerHTML = `<img src="${avatar.thumbnail}" alt="" class="avatar-open-thumb-img" />`;
    } else {
      const initials = (avatar?.name || "?").trim().slice(0, 2).toUpperCase();
      this.avatarOpenThumb.textContent = avatar ? initials : "";
    }
  }
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
    this.responseLanguageSelect.innerHTML = RESPONSE_LANGUAGES.map(
      (lang) =>
        `<option value="${lang}">${lang === "en" ? "English" : lang === "ja" ? "Japanese" : "Japanese + English"}</option>`,
    ).join("");
    const selectedValue = RESPONSE_LANGUAGES.includes(requested)
      ? requested
      : DEFAULT_RESPONSE_LANGUAGE;
    this.responseLanguageSelect.value = selectedValue;
    // Note: intentionally no emit here. This method only syncs the
    // <select>'s displayed value (on initial connect and when the backend
    // settings arrive). Emitting 'set-response-language' from here caused it
    // to be treated as a real user change and re-saved on every page load,
    // clobbering the actual persisted setting. The event is now emitted only
    // from the dropdown's own 'change' listener in bindEvents(), where a
    // user-initiated selection actually happened.
  }

  populateUiLanguages() {
    if (!this.uiLanguageSelect) return;
    this.uiLanguageSelect.innerHTML = UI_LANGUAGES.map(
      (lang) =>
        `<option value="${lang}">${lang === "en" ? "English" : "日本語"}</option>`,
    ).join("");
    this.uiLanguageSelect.value = getStoredUiLanguage(this.instanceId);
  }

  applyUiLanguage(language = "en") {
    const lang = UI_LANGUAGES.includes(language) ? language : "en";
    const text = getUiText(lang);

    const labels = this.querySelectorAll(".settings-group > label");
    if (labels[0]) labels[0].textContent = text.avatarLabel;
    if (labels[1]) labels[1].textContent = text.replyLabel;
    if (labels[2]) labels[2].textContent = text.interfaceLabel;

    if (this.avatarSearchInput)
      this.avatarSearchInput.placeholder =
        text.avatarSearchPlaceholder || this.avatarSearchInput.placeholder;

    const historyOpen = this.querySelector(".history-open");
    if (historyOpen) historyOpen.textContent = text.historyButton;

    const historyTitle = this.querySelector(".history-title");
    if (historyTitle) historyTitle.textContent = text.historyTitle;

    const historySubtitle = this.querySelector(".history-subtitle");
    if (historySubtitle) historySubtitle.textContent = text.historySubtitle;

    const historyClear = this.querySelector(".history-clear");
    if (historyClear) historyClear.textContent = text.clearHistory;

    const historyClose = this.querySelector(".history-close");
    if (historyClose) historyClose.setAttribute("aria-label", text.close);

    const settingsToggle = this.querySelector(".settings-toggle");
    if (settingsToggle) {
      settingsToggle.textContent = `⚙️ ${text.settingsLabel}`;
      settingsToggle.setAttribute("aria-label", text.openSettings);
    }

    const settingsClose = this.querySelector(".settings-close");
    if (settingsClose)
      settingsClose.setAttribute("aria-label", text.closeSettings);

    const title = this.querySelector(".settings-title");
    if (title) title.textContent = text.settingsTitle;

    const subtitle = this.querySelector(".settings-subtitle");
    if (subtitle) subtitle.textContent = text.settingsSubtitle;

    const input = this.querySelector(".chat-input");
    if (input) input.placeholder = text.placeholder;

    const sendBtn = this.querySelector(".send-btn");
    if (sendBtn) {
      sendBtn.textContent = text.send;
      sendBtn.setAttribute("title", text.send);
    }

    const micBtn = this.querySelector(".mic-btn");
    if (micBtn) micBtn.setAttribute("title", text.micTitle);

    if (this.historyThread?.querySelector(".chat-placeholder")) {
      this.historyThread.innerHTML = `<div class="chat-placeholder">${text.conversationCleared}</div>`;
    }

    if (this.uiLanguageSelect) {
      this.uiLanguageSelect.value = lang;
    }
// NEW:
    if (this.core.currentProfileDetail) {
      this.core.updateProfile(this.core.currentProfileDetail);
    }
  }

updateProfile(detail = {}) {
    if (!this.profileName || !this.profileBio) return;
    this.currentProfileDetail = { ...(this.currentProfileDetail || {}), ...detail };

    if (document.activeElement !== this.profileName) {
      this.profileName.value = this.currentProfileDetail.name || '';
    }

    const language = getStoredUiLanguage(this.instanceId);
    const personaText = language === 'ja'
      ? (this.currentProfileDetail.personaJa || detail.personaJa || detail.persona)
      : detail.persona;

    if (document.activeElement !== this.profileBio) {
      this.profileBio.value = personaText || '';
    }
    if (this.personaResetBtn) {
      this.personaResetBtn.disabled = !this.currentProfileDetail.isCustomPersona;
    }
    this.updateProfileThumbnail(this.currentProfileDetail.thumbnail);
  }

  /** Renders the current avatar's thumbnail on the profile card, if one is
   * configured. Falls back to hiding the image node entirely (rather than
   * showing a broken-image icon) when no thumbnail exists for this avatar. */
  updateProfileThumbnail(thumbnailUrl) {
    if (!this.profileThumb) return;
    if (thumbnailUrl) {
      this.profileThumb.src = thumbnailUrl;
      this.profileThumb.hidden = false;
    } else {
      this.profileThumb.hidden = true;
      this.profileThumb.removeAttribute('src');
    }
  }

  /**
   * Renders a full snapshot from the backend (avatar:chat-history), replacing
   * whatever was shown before. Nothing here is accumulated locally — this is
   * the only way rows get into the panel.
   */
  renderHistory(list = [], responseLanguage = "en", avatarName = "") {
    if (!this.historyThread) return;
    this.historyThread.innerHTML = "";
    if (!list.length) {
      const text = getUiText(getStoredUiLanguage(this.instanceId));
      this.historyThread.innerHTML = `<div class="chat-placeholder">${text.conversationCleared}</div>`;
      return;
    }

    const showEn = responseLanguage === "en" || responseLanguage === "both";
    const showJa = responseLanguage === "ja" || responseLanguage === "both";

    list.forEach((entry) => {
      try {
        const time = entry.time
          ? new Date(entry.time).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "";
        const speakerName = entry.character_name || avatarName || "";
        if (entry.role === "assistant") {
          const preferEn = showEn && entry.text_en;
          const preferJa = showJa && entry.text_ja;
          if (preferEn)
            this.appendHistoryItem("avatar", entry.text_en, time, speakerName);
          if (preferJa)
            this.appendHistoryItem("avatar", entry.text_ja, time, speakerName);
          if (!preferEn && !preferJa) {
            const fallback =
              entry.text_en ||
              entry.text_ja ||
              entry.text ||
              entry.content ||
              "";
            if (fallback)
              this.appendHistoryItem("avatar", fallback, time, speakerName);
          }
        } else {
          this.appendHistoryItem(
            entry.role || "user",
            entry.text || entry.content || "",
            time,
          );
        }
      } catch (err) {
        console.error("Failed to render a chat history entry:", entry, err);
      }
    });

    this.historyThread.scrollTo({
      top: this.historyThread.scrollHeight,
      behavior: "auto",
    });
  }

  appendHistoryItem(role, text, time = "", speakerName = "") {
    const clean = String(text || "").trim();
    if (!this.historyThread || !clean) return;

    const sender = String(role || "")
      .trim()
      .toLowerCase();
    const label =
      sender === "user"
        ? "You"
        : sender === "avatar" || sender === "assistant"
          ? speakerName || "Avatar"
          : sender
            ? sender.charAt(0).toUpperCase() + sender.slice(1)
            : "Message";

    const item = document.createElement("div");
    const isUser = sender === "user";
    item.className = `chat-history-item ${isUser ? "chat-history-item--user" : "chat-history-item--avatar"}`;
    item.innerHTML = `
      <div class="chat-history-meta">
        <span class="chat-history-sender">${label}</span>
        ${time ? `<span class="chat-history-time">${time}</span>` : ""}
      </div>
      <div class="chat-history-bubble">${clean}</div>
    `;

    this.historyThread.appendChild(item);
  }

  openConfirmReset() {
    this.confirmOverlay?.classList.add("open");
    this.confirmOverlay?.setAttribute("aria-hidden", "false");
  }

  closeConfirmReset() {
    this.confirmOverlay?.classList.remove("open");
    this.confirmOverlay?.setAttribute("aria-hidden", "true");
  }

  confirmClearHistory() {
    this.emit("clear-chat-history");
    this.closeConfirmReset();
    this.closeChatHistory();
  }
  /**
   * Ensures SOMETHING is persisting settings for this instance. If an
   * <avatar-model> for the same instance exists on the page, AvatarController
   * (created inside AvatarModel.connectedCallback()) already handles
   * persistence — this component just listens, as it always has. If no such
   * element exists, this is a settings-only page/card (no 3D avatar), so
   * spin up the lightweight, Three.js-free AvatarSettingsController instead
   * — otherwise every change made here would silently go nowhere.
   */
  async initPersistence() {
    try {
      await customElements.whenDefined("avatar-model");
      const hasMatchingModel = Array.from(
        document.querySelectorAll("avatar-model"),
      ).some((el) => (el.getAttribute("instance") || "default") === this.instanceId);

      if (hasMatchingModel) return;

      this.settingsController = new AvatarSettingsController({
        instanceId: this.instanceId,
        backend: this.getAttribute("backend") || undefined,
        appId: this.getAttribute("app-id") || undefined,
        userId: this.getAttribute("user-id") || undefined,
      });
      await this.settingsController.init();
    } catch (error) {
      console.error(
        `[avatar-settings] initPersistence failed for instance "${this.instanceId}":`,
        error,
      );
    }
  }
}

export { AvatarSettings };
