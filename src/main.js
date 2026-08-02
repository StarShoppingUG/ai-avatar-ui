import styleText from './index.css?raw';

import { AvatarModel } from './components/AvatarModel.js';
import { AvatarStatus } from './components/AvatarStatus.js';
import { AvatarCaptions } from './components/AvatarCaptions.js';
import { AvatarInputs } from './components/AvatarInputs.js';
import { AvatarSettings } from './components/AvatarSettings.js';
import { AvatarSetup } from './components/AvatarSetup.js';

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
customElements.define('avatar-setup', AvatarSetup);

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

// Injects a small loading-spinner overlay into every .ai-avatar-shell on
// the page and marks each as "loading" until its avatar-model instance
// reports app:ready — see the .avatar-app-boot-spinner / .avatar-app-loading
// rules in index.css. Purely cosmetic: gives the initial wait something to
// look at instead of a blank page that then pops straight to full content.
function injectBootSpinners() {
  document.querySelectorAll('.ai-avatar-shell').forEach((shell) => {
    if (shell.querySelector('.avatar-app-boot-spinner')) return; // already injected
    const spinner = document.createElement('div');
    spinner.className = 'avatar-app-boot-spinner';
    spinner.innerHTML = '<div class="avatar-spinner"></div>';
    shell.appendChild(spinner);
    shell.classList.add('avatar-app-loading');
  });
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', injectBootSpinners);
} else {
  injectBootSpinners();
}

// Reveals every avatar-* component belonging to a given instance only once
// that instance's persisted settings (avatar, ui language, response
// language) have actually been loaded and applied — avoids a visible flash
// of the default avatar/English UI while a slower backend responds. Works
// per-component rather than via a wrapper element, since these components
// are documented as usable standalone (placed anywhere on a page, not
// necessarily inside .ai-avatar-shell) — see README's Custom Input
// Elements / Multiple Avatar Instances sections.
const REVEAL_TAGS = ['avatar-model', 'avatar-status', 'avatar-captions', 'avatar-inputs', 'avatar-settings'];

function revealComponentsForInstance(instanceId) {
  REVEAL_TAGS.forEach((tag) => {
    document.querySelectorAll(tag).forEach((el) => {
      const id = el.getAttribute('instance') || 'default';
      if (id === instanceId) el.classList.add('avatar-app-ready');
    });
  });

  // Stop the boot spinner for whichever shell(s) contain this instance's
  // avatar-model — a page may have multiple shells (multi-instance), each
  // resolving independently.
  document.querySelectorAll(`avatar-model`).forEach((model) => {
    const id = model.getAttribute('instance') || 'default';
    if (id !== instanceId) return;
    model.closest('.ai-avatar-shell')?.classList.remove('avatar-app-loading');
  });
}

window.addEventListener('avatar:app:ready', (event) => {
  revealComponentsForInstance(event.detail?.instance || 'default');
});

// Safety net — reveal everything after 8s even if app:ready never fired for
// some reason (shouldn't happen given loadPersistedSettings()'s own error
// handling, but avoids permanently invisible components if something
// upstream changes).
setTimeout(() => {
  REVEAL_TAGS.forEach((tag) => {
    document.querySelectorAll(tag).forEach((el) => el.classList.add('avatar-app-ready'));
  });
  document.querySelectorAll('.ai-avatar-shell').forEach((shell) => {
    shell.classList.remove('avatar-app-loading');
  });
}, 8000);