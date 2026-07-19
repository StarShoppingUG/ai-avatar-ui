import { getStoredUiLanguage, getUiText, translateStatusText } from './i18n.js';
import { getLastStatusDetail } from './events.js';

class AvatarStatus extends HTMLElement {
  connectedCallback() {
    this.classList.add('avatar-status');
    this.innerHTML = `
      <div class="status-pill">
        <span class="status-dot yellow"></span>
        <span class="status-text">Initializing</span>
      </div>
    `;
    window.addEventListener('avatar:update-status', (event) => this.updateStatus(event.detail));
    this.applyUiLanguage(getStoredUiLanguage());

    // Catch up immediately if status updates already fired before this
    // element's listener above was registered (see emitAvatarEvent) —
    // otherwise a missed early event leaves this panel stuck showing the
    // hardcoded "Initializing" text above even though the app has since
    // moved on.
    if (getLastStatusDetail()) this.updateStatus(getLastStatusDetail());
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
      if (normalized === 'ready' || normalized === getUiText(getStoredUiLanguage()).statusReady.toLowerCase()) {
        color = 'green';
      } else {
        color = 'white';
      }
    }
    const statusText = this.querySelector('.status-text');
    if (statusText) {
      statusText.textContent = translateStatusText(text, getStoredUiLanguage());
    }
    const dot = this.querySelector('.status-dot');
    if (!dot) return;
    dot.className = `status-dot ${color}`;
  }
}


export { AvatarStatus };