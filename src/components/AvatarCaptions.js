class AvatarCaptions extends HTMLElement {
connectedCallback() {
    this.classList.add('avatar-captions');
    this.instanceId = this.getAttribute('instance') || 'default';
    this.innerHTML = `<div class="avatar-caption" aria-live="polite"></div>`;
    this._onShowCaption = (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      this.showCaption(event.detail?.text, event.detail?.durationMs, event.detail?.captionId);
    };
    this._onHideCaption = (event) => {
      if (event.detail?.instance !== this.instanceId) return;
      this.hideCaption(event.detail?.captionId);
    };
    window.addEventListener('avatar:show-caption', this._onShowCaption);
    window.addEventListener('avatar:hide-caption', this._onHideCaption);
  }
  disconnectedCallback() {
    if (this._onShowCaption) {
      window.removeEventListener('avatar:show-caption', this._onShowCaption);
      this._onShowCaption = null;
    }
    if (this._onHideCaption) {
      window.removeEventListener('avatar:hide-caption', this._onHideCaption);
      this._onHideCaption = null;
    }
    if (this._captionHideTimer) {
      clearTimeout(this._captionHideTimer);
      this._captionHideTimer = null;
    }
  }


  showCaption(text, durationMs = 0, captionId = null) {
    const caption = this.querySelector('.avatar-caption');
    if (!caption) return;
    const nextText = String(text || '').trim();
    caption.textContent = nextText;
    caption.classList.toggle('visible', Boolean(nextText));

    this._captionCurrentId = captionId;
    const duration = Number(durationMs || 0);
    this._captionMinDuration = duration > 0 ? duration : 0;
    this._captionShownAt = duration > 0 ? Date.now() : 0;
    if (this._captionHideTimer) {
      clearTimeout(this._captionHideTimer);
      this._captionHideTimer = null;
    }
  }

  hideCaption(captionId = null) {
    const caption = this.querySelector('.avatar-caption');
    if (!caption) return;

    const activeCaptionId = captionId || this._captionCurrentId;
    if (captionId && this._captionCurrentId !== captionId) {
      return;
    }

    const now = Date.now();
    const elapsed = this._captionShownAt ? now - this._captionShownAt : 0;
    const remaining = this._captionMinDuration ? this._captionMinDuration - elapsed : 0;

    if (remaining > 0) {
      if (this._captionHideTimer) {
        clearTimeout(this._captionHideTimer);
      }
      this._captionHideTimer = setTimeout(() => {
        this._captionHideTimer = null;
        this.hideCaption(activeCaptionId);
      }, remaining);
      return;
    }

    caption.classList.remove('visible');
    setTimeout(() => {
      if (this._captionCurrentId === activeCaptionId) {
        caption.textContent = '';
      }
    }, 220);
  }
}


export { AvatarCaptions };