import { emitAvatarEvent } from "./events.js";
import { AvatarPickerCore } from "./AvatarPickerCore.js";

class AvatarSetup extends HTMLElement {
connectedCallback() {
    this.classList.add("avatar-setup");
    this.instanceId = this.getAttribute("instance") || "default";
    this.mode = this.getAttribute("mode") || "first-visit";
    this._rendered = false;

    this._latestAvatarsDetail = null;
    this._latestProfileDetail = null;

    window.addEventListener("avatar:available-avatars", (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      this._latestAvatarsDetail = event.detail;
      this.core?.populateAvatars(event.detail);
    });
    window.addEventListener("avatar:update-profile", (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      this._latestProfileDetail = event.detail;
      this.core?.updateProfile(event.detail);
    });
  }

  /** Called by AvatarController once it's decided this step should run. */
  show() {
    if (!this._rendered) this._render();
    this.classList.add("open");
    this.setAttribute("aria-hidden", "false");
  }

  hide() {
    this.classList.remove("open");
    this.setAttribute("aria-hidden", "true");
  }

  _render() {
    this._rendered = true;
    this.innerHTML = `
      <div class="avatar-setup-card" role="dialog" aria-modal="true">
        <div class="avatar-setup-header">
          <div class="avatar-setup-title">Welcome — set up your avatar</div>
        </div>
        <div class="avatar-setup-body">
          <div class="profile-card">
            <div class="persona-edit-actions">
              <button type="button" class="persona-save" title="Save" aria-label="Save">Save</button>
              <button type="button" class="persona-reset" disabled title="Reset to default" aria-label="Reset to default">Reset</button>
            </div>
            <input type="text" class="profile-name" />
            <textarea class="profile-bio" rows="4"></textarea>
          </div>
          <div class="settings-group">
            <label>Select Avatar</label>
            <input type="text" class="avatar-search" placeholder="Search avatars" />
            <div class="avatar-grid" role="listbox" aria-label="Choose an avatar"></div>
            <div class="avatar-grid-empty" hidden>No avatars match your search.</div>
          </div>
          <div class="settings-group">
            <label>Reply language</label>
            <select class="response-language-select"></select>
          </div>
          <div class="settings-group">
            <label>Interface</label>
            <select class="ui-language-select"></select>
          </div>
        </div>
        <div class="avatar-setup-footer">
          <button type="button" class="avatar-setup-continue">Continue</button>
        </div>
      </div>
    `;

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
      // Critical: don't emit 'select-avatar' on every grid click. That
      // event drives AvatarController.selectAvatar() -> model.loadAvatar(),
      // i.e. the actual GLB load. During setup we only want that to happen
      // once, on Continue — otherwise every click while browsing avatars
      // would trigger a real (redundant) 3D load before the user confirms.
      { emitOnSelect: false },
    );
    this.core.bindEvents();
this.continueBtn?.addEventListener("click", () => this.complete());

    if (this._latestAvatarsDetail) this.core.populateAvatars(this._latestAvatarsDetail);
    if (this._latestProfileDetail) this.core.updateProfile(this._latestProfileDetail);
  }

  cacheNodes() {
    this.avatarSearchInput = this.querySelector(".avatar-search");
    this.avatarGrid = this.querySelector(".avatar-grid");
    this.avatarGridEmpty = this.querySelector(".avatar-grid-empty");
    this.responseLanguageSelect = this.querySelector(".response-language-select");
    this.uiLanguageSelect = this.querySelector(".ui-language-select");
    this.profileName = this.querySelector(".profile-name");
    this.profileBio = this.querySelector(".profile-bio");
    this.personaSaveBtn = this.querySelector(".persona-save");
    this.personaResetBtn = this.querySelector(".persona-reset");
    this.continueBtn = this.querySelector(".avatar-setup-continue");
  }

  emit(name, detail = {}) {
    emitAvatarEvent(name, detail, this.instanceId);
  }

  /** Fires the real select-avatar for whatever the user landed on (only
   * now, once), hides the step, then signals completion so
   * AvatarController's gated init() can proceed. */
  complete() {
    if (this.core?.currentAvatarId) {
      this.emit("select-avatar", { avatarId: this.core.currentAvatarId });
    }
    this.hide();
    this.emit("setup-complete");
  }
}

export { AvatarSetup };