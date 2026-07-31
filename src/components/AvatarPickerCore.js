// Reusable picker/persona/language logic shared between <avatar-settings>
// and <avatar-setup>. Operates only on DOM nodes handed to it plus an
// `emit` callback, so each host component can use its own markup/layout.
import { getStoredUiLanguage } from "./i18n.js";
import {
  RESPONSE_LANGUAGES,
  DEFAULT_RESPONSE_LANGUAGE,
  UI_LANGUAGES,
} from "./constants.js";

export class AvatarPickerCore {
  /**
   * @param {object} nodes - all optional, methods no-op if a node is missing:
   *   avatarSearchInput, avatarGrid, avatarGridEmpty,
   *   responseLanguageSelect, uiLanguageSelect,
   *   profileName, profileBio, personaSaveBtn, personaResetBtn
   * @param {(name: string, detail?: object) => void} emit
   * @param {string} instanceId
   * @param {{emitOnSelect?: boolean}} [options] - emitOnSelect (default true)
   *   controls whether clicking a grid card immediately emits
   *   'select-avatar' (AvatarSettings' existing live-switch behavior) or
   *   only updates local state, leaving the host to emit later
   *   (AvatarSetup: defer the actual GLB load until "Continue").
   */
  constructor(nodes, emit, instanceId = "default", options = {}) {
    this.nodes = nodes;
    this.emit = emit;
    this.instanceId = instanceId;
    this.emitOnSelect = options.emitOnSelect !== false;
    this.avatars = [];
    this.currentAvatarId = null;
    this.avatarSearchQuery = "";
    this.currentProfileDetail = null;
    // Host-supplied UI side-effect hook (e.g. close a nested overlay,
    // update a summary button) — called on every selection regardless of
    // emitOnSelect, since it's presentation, not the event contract.
    this.onAvatarSelected = null;
  }

  bindEvents() {
    const {
      avatarSearchInput, avatarGrid,
      responseLanguageSelect, uiLanguageSelect,
      personaSaveBtn, personaResetBtn,
    } = this.nodes;

    avatarSearchInput?.addEventListener("input", (event) => {
      this.avatarSearchQuery = event.target.value || "";
      this.renderAvatarGrid();
    });

    avatarGrid?.addEventListener("click", (event) => {
      const card = event.target.closest(".avatar-card");
      if (!card) return;
      const avatarId = card.dataset.avatarId;
      if (!avatarId || avatarId === this.currentAvatarId) return;
      this.currentAvatarId = avatarId;
      this.renderAvatarGrid();
      if (this.emitOnSelect) this.emit("select-avatar", { avatarId });
      this.onAvatarSelected?.(avatarId);
    });

    avatarGrid?.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const card = event.target.closest(".avatar-card");
      if (!card) return;
      event.preventDefault();
      card.click();
    });

    responseLanguageSelect?.addEventListener("change", (event) => {
      this.emit("set-response-language", { language: event.target.value });
    });
    uiLanguageSelect?.addEventListener("change", (event) => {
      this.emit("set-ui-language", { language: event.target.value });
    });

    personaSaveBtn?.addEventListener("click", () => {
      const value = this.nodes.profileBio?.value ?? "";
      const language = getStoredUiLanguage(this.instanceId);
      const nameValue = this.nodes.profileName?.value?.trim();
      const payload = { avatarId: this.currentAvatarId, text: value, language };
      if (nameValue) payload.name = nameValue;
      this.emit("edit-persona", payload);
    });
    personaResetBtn?.addEventListener("click", () => {
      this.emit("reset-persona", { avatarId: this.currentAvatarId });
    });
  }

  populateAvatars(detail = {}) {
    const avatars = Array.isArray(detail.avatars) ? detail.avatars : [];
    this.avatars = avatars;
    this.currentAvatarId = detail.currentAvatarId ?? this.currentAvatarId;
    this.renderAvatarGrid();
    this.populateResponseLanguages(detail.responseLanguage);
    this.populateUiLanguages();
  }

  renderAvatarGrid() {
    const { avatarGrid, avatarGridEmpty } = this.nodes;
    if (!avatarGrid) return;

    const query = this.avatarSearchQuery.trim().toLowerCase();
    const filtered = query
      ? this.avatars.filter((avatar) =>
          (avatar.name || "").toLowerCase().includes(query),
        )
      : this.avatars;

    if (avatarGridEmpty) avatarGridEmpty.hidden = filtered.length > 0;

    avatarGrid.innerHTML = filtered
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

  // preferredLanguage, when given, is the controller's actual current
  // (possibly backend-restored) responseLanguage — see the comment in the
  // original AvatarSettings for why this can't just read .value back.
  populateResponseLanguages(preferredLanguage = null) {
    const { responseLanguageSelect } = this.nodes;
    if (!responseLanguageSelect) return;
    const requested = preferredLanguage || responseLanguageSelect.value;
    responseLanguageSelect.innerHTML = RESPONSE_LANGUAGES.map(
      (lang) =>
        `<option value="${lang}">${lang === "en" ? "English" : lang === "ja" ? "Japanese" : "Japanese + English"}</option>`,
    ).join("");
    const selectedValue = RESPONSE_LANGUAGES.includes(requested)
      ? requested
      : DEFAULT_RESPONSE_LANGUAGE;
    responseLanguageSelect.value = selectedValue;
  }

  populateUiLanguages() {
    const { uiLanguageSelect } = this.nodes;
    if (!uiLanguageSelect) return;
    uiLanguageSelect.innerHTML = UI_LANGUAGES.map(
      (lang) =>
        `<option value="${lang}">${lang === "en" ? "English" : "日本語"}</option>`,
    ).join("");
    uiLanguageSelect.value = getStoredUiLanguage(this.instanceId);
  }

  updateProfile(detail = {}) {
    const { profileName, profileBio, personaResetBtn } = this.nodes;
    if (!profileName || !profileBio) return;
    this.currentProfileDetail = { ...(this.currentProfileDetail || {}), ...detail };

    if (document.activeElement !== profileName) {
      profileName.value = this.currentProfileDetail.name || "";
    }

    const language = getStoredUiLanguage(this.instanceId);
    const personaText = language === "ja"
      ? (this.currentProfileDetail.personaJa || detail.personaJa || detail.persona)
      : detail.persona;

    if (document.activeElement !== profileBio) {
      profileBio.value = personaText || "";
    }
    if (personaResetBtn) {
      personaResetBtn.disabled = !this.currentProfileDetail.isCustomPersona;
    }
  }
}