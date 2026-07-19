import styleText from './index.css?raw';

import { AvatarModel } from './components/AvatarModel.js';
import { AvatarStatus } from './components/AvatarStatus.js';
import { AvatarCaptions } from './components/AvatarCaptions.js';
import { AvatarInputs } from './components/AvatarInputs.js';
import { AvatarSettings } from './components/AvatarSettings.js';

injectStyles(styleText);

// Sizing for <avatar-model> / .avatar-frame / .avatar-canvas lives entirely
// in index.css. Nothing is injected here — edit index.css directly to
// change how big the avatar renders.

function injectStyles(css) {
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

customElements.define('avatar-model', AvatarModel);
customElements.define('avatar-status', AvatarStatus);
customElements.define('avatar-captions', AvatarCaptions);
customElements.define('avatar-inputs', AvatarInputs);
customElements.define('avatar-settings', AvatarSettings);

window.addEventListener('DOMContentLoaded', () => {
  const shell = document.querySelector('.avatar-shell');
  if (!shell) return;
  if (!document.querySelector('avatar-model')) {
    // No width/height attributes needed — avatar-model fills its
    // container (.avatar-shell) by default. Size it via CSS instead.
    const model = document.createElement('avatar-model');
    shell.appendChild(model);
  }
});