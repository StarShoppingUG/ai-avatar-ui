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

class AvatarModel extends HTMLElement {
  constructor() {
    super();
    this._connected = false;
    this.backend = this.getAttribute('backend') || BACKEND;
    this.currentAvatarId = this.getAttribute('avatar-id') || DEFAULT_AVATAR_NAME;
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

  static get observedAttributes() {
    // avatar-width / avatar-height are OPTIONAL. By default the element
    // fills its container (see the injected CSS above). Only set these
    // attributes if you specifically want an inline-style override that
    // beats your stylesheet (inline style has higher specificity than
    // any CSS selector). Otherwise just size the container, or target
    // `avatar-model` directly in your own CSS.
    return ['avatar-width', 'avatar-height', 'backend'];
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
      if (this.controller) {
        this.controller.brain = new CharacterBrain(this.backend);
      }
    }
  }

  connectedCallback() {
    if (this._connected) return;
    this._connected = true;
    this.classList.add('avatar-model');
    this.render();
    this.canvas = this.querySelector('.avatar-canvas');
    this.loadingOverlay = this.querySelector('.avatar-loading-overlay');
    this.initThree();
    this.bindResize();
    this.controller = new AvatarController(this);
    this.controller.init();
  }

  render() {
    this.innerHTML = `
      <div class="avatar-frame">
        <canvas class="avatar-canvas avatar-canvas--loading" aria-label="Avatar canvas"></canvas>
        <img class="photo-2d-canvas" alt="Photo Render" />
        <div class="avatar-loading-overlay visible" aria-hidden="true">
          <div class="avatar-spinner"></div>
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

    // Resolved against this script's own origin (see resolveAssetUrl in
    // constants.js) rather than a bare root-relative path — otherwise this
    // 404s silently whenever the bundle is embedded on a page hosted
    // somewhere other than where these assets actually live.
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

    //BALANCED OVERHEAD LIGHTING SETUP (SOFTENED BRIGHTNESS)

    // 1. Base Ambient Light (Lowered from 0.6 to 0.4 to bring back shadow depth)
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    // 2. Softened Front-Left Key Light (Lowered intensity from 3.2 to 1.6)
    const frontLeftKey = new THREE.DirectionalLight(0xfff5ee, 1.6);
    frontLeftKey.position.set(-2.0, 6.0, -3.8); 
    this.scene.add(frontLeftKey);

    // 3. Softened Front-Right Fill Light (Lowered intensity from 1.5 to 0.8)
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
    window.addEventListener('resize', () => this.resize());
  }

  showLoadingOverlay() {
    this.loadingOverlay?.classList.add('visible');
    this.canvas?.classList.add('avatar-canvas--loading');
  }

  hideLoadingOverlay() {
    this.loadingOverlay?.classList.remove('visible');
    this.canvas?.classList.remove('avatar-canvas--loading');
  }

  async loadAvatar(avatarId, avatarData) {
    const avatar = avatarData || lookupAvatar(avatarId);
    if (!avatar) return;

    this.controller?.emitStatus(`Loading ${avatar.name}…`, 'yellow');
    this.showLoadingOverlay();


    try {
      this.currentAvatarModel = await this.avatarManager.loadAvatar(avatar.file, avatar.name);


      await this.attachEngines(this.currentAvatarModel, avatar.name);

      this.cameraFraming.resize();
      this.hideLoadingOverlay();
    } catch (error) {
   
      this.currentAvatarModel = null;
      this.expressionEngine = null;
      this.lipSync = null;
      this.animationManager = null;
      this.emotionSystem = null;
      this.controller?.emitStatus('Ready (no model)', 'green');
      this.hideLoadingOverlay();
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
  
  // Connect references across components cleanly
  this.lipSync.setExpressionEngine(this.expressionEngine);
  this.animationManager.setExpressionEngine(this.expressionEngine);

  const clipsReady = await this.animationManager.init(avatarModel);


  this.avatarManager.expressionEngine = this.expressionEngine;
  this.avatarManager.animationManager = this.animationManager;

  // --- THE DEFINITIVE PIPELINE SYNC FIX ---
  // Re-instantiate or explicitly update properties so EmotionSystem holds live targets
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

  // Force an immediate layout reset on the freshly established references
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
    requestAnimationFrame(() => this.animate());
    const delta = this.clock.getDelta();
    
    // 1. Compute bone movements from Mixamo clips first
    this.animationManager?.update(delta);
    
    // 2. LAYER PURE GEOMETRY EXPRESSIONS ON TOP OF BONE MANIPULATION
    this.expressionEngine?.update(delta); // Calculates combined emotions
    this.lipSync?.update(delta);         // Inject speech open additively on top

    // 3. Render frame scene coordinates
    this.orbitControls?.update();
    this.renderer?.render(this.scene, this.camera);
  }




  get clock() {
    if (!this._clock) this._clock = new THREE.Clock();
    return this._clock;
  }
}


export { AvatarModel };