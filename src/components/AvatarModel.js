import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

import { AvatarManager } from '../avatar/AvatarManager.js';
import { AnimationManager } from '../avatar/AnimationManager.js';
import { ExpressionEngine } from '../avatar/ExpressionEngine.js';
import { LipSync } from '../avatar/LipSync.js';
import { CharacterBrain } from '../avatar/CharacterBrain.js';
import { EmotionSystem } from '../avatar/EmotionSystem.js';
import { CameraFraming } from '../avatar/CameraFraming.js';
import { DEFAULT_AVATAR_NAME, getAvatar as lookupAvatar } from '../avatar/AvatarSources.js';
import { BACKEND, resolveAssetUrl } from './constants.js';
import { AvatarController } from './AvatarController.js';

/**
 * <avatar-model> — renders the 3D scene (Three.js canvas, camera, lighting),
 * loads/swaps avatar GLB files, and drives animation/lip-sync from backend
 * behavior data via AvatarController. Shows a retry prompt on load failure.
 */
class AvatarModel extends HTMLElement {
  constructor() {
    super();
    this._connected = false;
    this.backend = this.getAttribute('backend') || BACKEND;
    this.currentAvatarId = this.getAttribute('avatar-id') || DEFAULT_AVATAR_NAME;
    this.instanceId = this.getAttribute('instance') || 'default';

    // Scale/offset default to undefined so AvatarScale.apply() uses its own
    // tuned defaults. The -mobile variants only apply below the breakpoint
    // set by avatar-mobile-breakpoint (see _computeScaleConfig()).
    this._mobileMq = null;
    this._isMobile = false;
    this.avatarScaleConfig = this._computeScaleConfig();
    this.scene = new THREE.Scene();
    this.renderer = null;
    this.camera = null;
    this.orbitControls = null;
    this.cameraFraming = null;
    this.avatarManager = new AvatarManager(this.scene);
    this.animationManager = null;
    this.expressionEngine = null;
    this.lipSync = null;
    this.emotionSystem = null;
    this.currentAvatarModel = null;
    this.controller = null;
    this.canvas = null;
    this.loadingOverlay = null;
    this._resizeObserver = null;
    this._clock = null;
    this.modelClock = null;
  }

  /** Reads an attribute as a float, returning undefined (not NaN) when unset/invalid. */
  _floatAttr(name) {
    const raw = this.getAttribute(name);
    if (raw === null || raw === '') return undefined;
    const value = parseFloat(raw);
    return Number.isNaN(value) ? undefined : value;
  }

  /** Resolves {scale, verticalOffset} for the current viewport, preferring
   * the -mobile attribute when the breakpoint currently matches. */
  _computeScaleConfig() {
    const base = {
      scale: this._floatAttr('avatar-scale'),
      verticalOffset: this._floatAttr('avatar-vertical-offset'),
    };
    if (!this._isMobile) return base;
    const mobileScale = this._floatAttr('avatar-scale-mobile');
    const mobileOffset = this._floatAttr('avatar-vertical-offset-mobile');
    return {
      scale: mobileScale !== undefined ? mobileScale : base.scale,
      verticalOffset: mobileOffset !== undefined ? mobileOffset : base.verticalOffset,
    };
  }

  /** Watches for mobile/desktop breakpoint transitions and re-applies scale live. */
  _bindMobileWatcher() {
    if (this._mobileMq) {
      this._mobileMq.removeEventListener('change', this._onMobileMqChange);
    }
    const breakpoint = this._floatAttr('avatar-mobile-breakpoint') ?? 640;
    this._mobileMq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    this._isMobile = this._mobileMq.matches;
    this._onMobileMqChange = (e) => {
      this._isMobile = e.matches;
      this.avatarScaleConfig = this._computeScaleConfig();
      this.avatarManager?.setTransform(this.avatarScaleConfig);
    };
    this._mobileMq.addEventListener('change', this._onMobileMqChange);
  }

  static get observedAttributes() {
    // avatar-width/avatar-height are optional inline-style overrides; the
    // element fills its container by default. app-id/user-id/settings-scope
    // /settings-group are observed so a host app that sets them slightly
    // after connect (e.g. post-auth) still takes effect.
    return [
      'avatar-width',
      'avatar-height',
      'backend',
      'app-id',
      'user-id',
      'settings-scope',
      'settings-group',
      'avatar-scale',
      'avatar-vertical-offset',
      'avatar-scale-mobile',
      'avatar-vertical-offset-mobile',
      'avatar-mobile-breakpoint',
      'instance',
    ];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'avatar-width') {
      this.style.width = newValue || '';
      this.resize();
    }
    if (name === 'avatar-height') {
      this.style.height = newValue || '';
      this.resize();
    }
    if (name === 'backend' && newValue) {
      this.backend = newValue;
      this._recreateBrain();
    }
    if (name === 'instance' && newValue) {
      this.instanceId = newValue;
      this._recreateBrain();
    }
    if (
      name === 'app-id' ||
      name === 'user-id' ||
      name === 'settings-scope' ||
      name === 'settings-group'
    ) {
      this._recreateBrain();
    }
    if (
      name === 'avatar-scale' ||
      name === 'avatar-vertical-offset' ||
      name === 'avatar-scale-mobile' ||
      name === 'avatar-vertical-offset-mobile'
    ) {
      this.avatarScaleConfig = this._computeScaleConfig();
      this.avatarManager?.setTransform(this.avatarScaleConfig);
    }
    if (name === 'avatar-mobile-breakpoint') {
      this._bindMobileWatcher();
      this.avatarScaleConfig = this._computeScaleConfig();
      this.avatarManager?.setTransform(this.avatarScaleConfig);
    }
  }

  /** Rebuilds CharacterBrain from current identity/scoping attributes, so a
   * late attribute change never leaves it talking under a stale tenant/scope. */
  _recreateBrain() {
    if (!this.controller) return;
    this.controller.brain = new CharacterBrain(this.backend, this.instanceId, {
      appId: this.getAttribute('app-id') || undefined,
      userId: this.getAttribute('user-id') || undefined,
      settingsScope: this.getAttribute('settings-scope') || undefined,
      settingsGroup: this.getAttribute('settings-group') || undefined,
    });
  }

  connectedCallback() {
    if (this._connected) return;
    this._connected = true;
    this.instanceId = this.getAttribute('instance') || 'default';
    this._bindMobileWatcher();
    this.avatarScaleConfig = this._computeScaleConfig();
    this.classList.add('avatar-model');
    this.render();
    this.canvas = this.querySelector('.avatar-canvas');
    this.loadingOverlay = this.querySelector('.avatar-loading-overlay');
    this.errorOverlay = this.querySelector('.avatar-error-overlay');
    this.retryBtn = this.querySelector('.avatar-retry-btn');
    this.retryBtn?.addEventListener('click', () => this.retryLoadAvatar());
    this.initThree();
    this.bindResize();
    this.controller = new AvatarController(this);
    this.controller.init();
  }

  disconnectedCallback() {
    this._connected = false;
    this._disposed = true;

    if (this._mobileMq) {
      this._mobileMq.removeEventListener('change', this._onMobileMqChange);
      this._mobileMq = null;
    }

    this.controller?.destroy();

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
    if (this._onWindowResize) {
      window.removeEventListener('resize', this._onWindowResize);
      this._onWindowResize = null;
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer = null;
    }

    this.orbitControls?.dispose();
    this.animationManager?.dispose();
  }

  render() {
    this.innerHTML = `
      <div class="avatar-frame">
        <canvas class="avatar-canvas avatar-canvas--loading" aria-label="Avatar canvas"></canvas>
        <img class="photo-2d-canvas" alt="Photo Render" />
        <div class="avatar-loading-overlay visible" aria-hidden="true">
          <div class="avatar-spinner"></div>
        </div>
        <div class="avatar-error-overlay" aria-hidden="true">
          <div class="avatar-error-message">Couldn't load the avatar — this is most likely due to an unstable internet connection.</div>
          <button type="button" class="avatar-retry-btn">Retry</button>
        </div>
      </div>
    `;
  }

  initThree() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;

    // Resolved against this script's own origin so the HDR doesn't 404 when
    // the bundle is embedded on a page hosted elsewhere.
    new RGBELoader().load(resolveAssetUrl('/assets/textures/sunset.hdr'), (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      this.scene.environment = texture;
    });

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.camera.position.set(0, 1.22, -3.5);

    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.target.set(0, 1.05, 0);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.08;
    this.orbitControls.enablePan = false;
    this.orbitControls.enableZoom = true;
    this.orbitControls.minDistance = 1.0;
    this.orbitControls.maxDistance = 5.0;
    this.orbitControls.minPolarAngle = Math.PI / 4;
    this.orbitControls.maxPolarAngle = Math.PI / 2;
    this.orbitControls.update();

    this.cameraFraming = new CameraFraming({
      camera: this.camera,
      orbitControls: this.orbitControls,
      renderer: this.renderer,
      cameraDistance: 3.5,
      floorScreenFraction: 1.08,
    });

    // Soft ambient fill plus a front-left key and front-right fill light,
    // tuned for face shadow depth without harsh contrast.
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.2));

    const frontLeftKey = new THREE.DirectionalLight(0xfff5ee, 1.6);
    frontLeftKey.position.set(-2.0, 6.0, -3.8);
    this.scene.add(frontLeftKey);

    const frontRightFill = new THREE.DirectionalLight(0xffffff, 0.8);
    frontRightFill.position.set(2.0, 5.5, -3.8);
    this.scene.add(frontRightFill);

    this.resize();
    this.animate();
  }

  bindResize() {
    if (typeof ResizeObserver !== 'undefined') {
      this._resizeObserver = new ResizeObserver(() => this.resize());
      this._resizeObserver.observe(this);
    }
    this._onWindowResize = () => this.resize();
    window.addEventListener('resize', this._onWindowResize);
  }

  showLoadingOverlay() {
    this.loadingOverlay?.classList.add('visible');
    this.canvas?.classList.add('avatar-canvas--loading');
  }

  hideLoadingOverlay() {
    this.loadingOverlay?.classList.remove('visible');
    this.canvas?.classList.remove('avatar-canvas--loading');
  }

  showErrorOverlay(message = 'Failed to load avatar') {
    if (!this.errorOverlay) return;
    const msgEl = this.errorOverlay.querySelector('.avatar-error-message');
    if (msgEl) msgEl.textContent = message;
    this.errorOverlay.classList.add('visible');
    this.errorOverlay.setAttribute('aria-hidden', 'false');
  }

  hideErrorOverlay() {
    this.errorOverlay?.classList.remove('visible');
    this.errorOverlay?.setAttribute('aria-hidden', 'true');
  }

  /** Retries via the controller's normal selectAvatar() flow, so status
   * text and settings persistence stay consistent with a regular selection. */
  retryLoadAvatar() {
    if (!this.controller || this._retrying) return;
    this._retrying = true;
    if (this.retryBtn) this.retryBtn.disabled = true;
    this.hideErrorOverlay();
    this.controller.selectAvatar(this.controller.currentAvatarId).finally(() => {
      this._retrying = false;
      if (this.retryBtn) this.retryBtn.disabled = false;
    });
  }

  async loadAvatar(avatarId, avatarData) {
    const avatar = avatarData || lookupAvatar(avatarId, this.instanceId);
    if (!avatar) return false;
    this.controller?.emitStatus(`Loading ${avatar.name}…`, 'yellow');
    this.hideErrorOverlay();
    this.showLoadingOverlay();

    try {
      this.currentAvatarModel = await this.avatarManager.loadAvatar(
        avatar.file,
        avatar.name,
        this.avatarScaleConfig
      );

      await this.attachEngines(this.currentAvatarModel, avatar.name);

      this.cameraFraming.resize();
      this.hideLoadingOverlay();
      return true;
    } catch (error) {
      console.error(`[avatar-model] Failed to load avatar "${avatar.name}":`, error);
      this.currentAvatarModel = null;
      this.expressionEngine = null;
      this.lipSync = null;
      this.animationManager = null;
      this.emotionSystem = null;
      this.controller?.emitStatus('Avatar failed to load', 'red');
      this.hideLoadingOverlay();
      this.showErrorOverlay('This is most likely due to an unstable internet connection.');
      return false;
    }
  }

  async attachEngines(avatarModel, personaName) {
    this.animationManager?.dispose();
    this.animationManager = new AnimationManager();

    if (this.expressionEngine) {
      this.expressionEngine.setAvatarModel(avatarModel);
    } else {
      this.expressionEngine = new ExpressionEngine(avatarModel);
    }

    this.lipSync = new LipSync(avatarModel, personaName);
    this.lipSync.setExpressionEngine(this.expressionEngine);
    this.animationManager.setExpressionEngine(this.expressionEngine);

    const clipsReady = await this.animationManager.init(avatarModel);

    this.avatarManager.expressionEngine = this.expressionEngine;
    this.avatarManager.animationManager = this.animationManager;

    // Re-point at the fresh engines instead of constructing a new
    // EmotionSystem, so external references survive an avatar swap.
    if (this.emotionSystem) {
      this.emotionSystem.expression = this.expressionEngine;
      this.emotionSystem.animation = this.animationManager;
      this.emotionSystem.lipSync = this.lipSync;
    } else {
      this.emotionSystem = new EmotionSystem({
        expression: this.expressionEngine,
        animation: this.animationManager,
        lipSync: this.lipSync,
      });
    }

    this.expressionEngine.setExpression('neutral');

    window.avatarManager = this.avatarManager;
    window.emotionSystem = this.emotionSystem;
  }

  resize() {
    if (!this.renderer || !this.camera) return;
    const rect = this.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      if (!this._warnedZeroSize) {
        this._warnedZeroSize = true;
        console.warn(
          '[avatar-model] container resolved to 0×0 — check that every ' +
          'ancestor of <avatar-model> has an explicit height (not `auto`). ' +
          `Got width=${rect.width}, height=${rect.height}.`
        );
      }
      return;
    }
    this._warnedZeroSize = false;
    this.renderer.setSize(rect.width, rect.height, false);
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.cameraFraming?.resize();
  }

  animate() {
    if (this._disposed) return;
    requestAnimationFrame(() => this.animate());
    const delta = this.clock.getDelta();

    // Bones first, facial morphs layered on top, then lip-sync additively.
    this.animationManager?.update(delta);
    this.expressionEngine?.update(delta);
    this.lipSync?.update(delta);

    this.orbitControls?.update();
    this.renderer?.render(this.scene, this.camera);
  }

  get clock() {
    if (!this._clock) this._clock = new THREE.Clock();
    return this._clock;
  }
}

export { AvatarModel };