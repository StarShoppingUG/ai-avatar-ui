import { getStoredUiLanguage, getUiText, translateStatusText } from './i18n.js';
import { getLastStatusDetail } from './events.js';

class AvatarStatus extends HTMLElement {
connectedCallback() {
    this.classList.add('avatar-status');
    this.instanceId = this.getAttribute('instance') || 'default';
    this.innerHTML = `
      <div class="status-pill">
        <span class="status-dot yellow"></span>
        <span class="status-text">Initializing</span>
      </div>
    `;
    this._onUpdateStatus = (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      this.updateStatus(event.detail);
    };
    window.addEventListener('avatar:update-status', this._onUpdateStatus);
    this.applyUiLanguage(getStoredUiLanguage(this.instanceId));

    if (getLastStatusDetail(this.instanceId)) this.updateStatus(getLastStatusDetail(this.instanceId));
  }

  disconnectedCallback() {
    if (this._onUpdateStatus) {
      window.removeEventListener('avatar:update-status', this._onUpdateStatus);
      this._onUpdateStatus = null;
    }
  }

  applyUiLanguage(language = 'en') {
    const text = getUiText(language);
    const statusText = this.querySelector('.status-text');
    if (statusText) {
      statusText.textContent = translateStatusText(statusText.textContent, language) || text.statusInitializing;
    }
  }

  updateStatus(detail) {
    const text = detail?.text || 'Ready';
    let color = detail?.color;
    if (!color) {
      const normalized = String(text || '').trim().toLowerCase();
      if (normalized === 'ready' || normalized === getUiText(getStoredUiLanguage(this.instanceId)).statusReady.toLowerCase()) {
        color = 'green';
      } else {
        color = 'white';
      }
    }
    const statusText = this.querySelector('.status-text');
    if (statusText) {
      statusText.textContent = translateStatusText(text, getStoredUiLanguage(this.instanceId));
    }
    const dot = this.querySelector('.status-dot');
    if (!dot) return;
    dot.className = `status-dot ${color}`;
  }
}


export { AvatarStatus };