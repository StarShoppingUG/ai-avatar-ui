// src/avatar/AnimationManager.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { resolveAssetUrl } from '../components/constants.js';

// Resolved against this script's own origin (see resolveAssetUrl in
// constants.js) rather than a bare root-relative path — otherwise every
// clip fetch (CLIP_BASE + file) 404s silently whenever this bundle is
// embedded on a page hosted somewhere other than where these assets
// actually live, or in dev mode where the module's own path isn't the
// site root.
const CLIP_BASE = resolveAssetUrl("/assets/animations/");

const ANIMATION_ALIASES = {
    talking: 'talk',
    thinking: 'think',
};

// FIX: Expanded to catch bone-driven face paths, direct expression bindings, and skeletal eye rigs
const isFaceTrack = (name) => {
    const lower = name.toLowerCase();
    return lower.includes("blendshape") || 
           lower.includes("morphtarget") ||
           lower.includes("expression") ||
           lower.includes("vrm") ||
           lower.includes("face") ||
           lower.includes("eye") ||
           lower.includes("jaw") ||
           lower.includes("mouth") ||
           lower.includes("brow");
};

export class AnimationManager {
    constructor() {
        this.avatarModel = null;
        this.mixer = null;
        this.actions = {};
        this.current = null;
        this.gltfLoader = new GLTFLoader();
        this.fbxLoader = new FBXLoader();
        this.ready = false;
        this.loading = false;
        this._activeListener = null; 
        this.isTalking = false;
        this.expressionEngine = null; // Link reference
    }

    setExpressionEngine(engine) {
        this.expressionEngine = engine;
    }

    async init(avatarModel) {
        this.dispose();
        this.avatarModel = avatarModel;
        if (!avatarModel?.scene) return false;

        this.mixer = new THREE.AnimationMixer(avatarModel.scene);
        this.actions = {};
        this.current = null;
        this.ready = false;
        this.loading = true;


        const animationManifest = {
            'idle':      'Idle.fbx',
            'talk':      'Talking.fbx',
            'think':     'Thinking.fbx',
            'listening': 'Listening.fbx',
            'thankful':  'Thankful.fbx',
            'nod'  :     "Nod.fbx",
            'greeting':  'Greeting.fbx',
            'offline':   'Offline.fbx'
        };

        const entries = Object.entries(animationManifest);
        let loaded = 0;

        await Promise.all(entries.map(async ([name, file]) => {
            try {
                let clip = null;

                if (file.toLowerCase().endsWith('.fbx')) {
                    const fbxAsset = await this.fbxLoader.loadAsync(CLIP_BASE + file);
                    if (fbxAsset?.animations?.length > 0) {
                        clip = fbxAsset.animations[0];
                    }
                } else {
                    const gltf = await this.gltfLoader.loadAsync(CLIP_BASE + file);
                    clip = this._extractClip(gltf, name);
                }

                if (!clip) {
                    return;
                }

                const filtered = this._filterFaceTracks(clip);
                filtered.name = name;
                
                const action = this.mixer.clipAction(filtered);
                action.setEffectiveTimeScale(1);
                
                if (!this._actionHasBindings(action)) {
                    return;
                }
                
                this.actions[name] = action;
                loaded += 1;
            } catch (err) {
                 console.warn(`Could not load animation track clip "${name}" from file "${file}":`, err);
            }
        }));

        this.loading = false;
        this.ready = loaded > 0;

        if (this.ready) {
            this.play('idle', { loop: true, fade: 0 });
        }

        return this.ready;
    }

    _extractClip(gltf, name) {
        const animations = gltf.animations || [];
        if (!animations.length) return null;
        const named = animations.find((clip) => clip.name === name);
        return named || animations[0];
    }

    _filterFaceTracks(clip) {
        if (!clip || !clip.tracks || !clip.tracks.length) return clip;
        const tracks = clip.tracks.filter((track) => !isFaceTrack(track.name));
        if (tracks.length === clip.tracks.length) return clip;
        return new THREE.AnimationClip(clip.name, clip.duration, tracks);
    }

    _actionHasBindings(action) {
        try {
            return action._propertyBindings && action._propertyBindings.length > 0;
        } catch (_) {
            return Boolean(action.getClip && action.getClip().tracks.length);
        }
    }

    hasClip(name) {
        const normalized = String(name).trim().toLowerCase();
        const key = ANIMATION_ALIASES[normalized] ?? normalized;
        return Boolean(this.actions[key]);
    }

    setTalkingState(talking) {
        this.isTalking = !!talking;
        
        if (this.expressionEngine) {
            this.expressionEngine.setTalkingState(this.isTalking);
        }
        
        if (this.current && this.current === this.actions['offline']) return;
        if (this.current && (this.current === this.actions['greeting'] || this.current === this.actions['thankful'] || this.current === this.actions['nod'])) {
            return;
        }

        const fallbackState = this.isTalking ? 'talk' : 'idle';
        this.play(fallbackState, { loop: true, fade: 0.7 });
    }

    // Default crossfade raised from 0.35s to 0.7s — longer blend between clips
    // reads as a natural weight shift instead of a robotic pose-snap.
    play(name, { loop = true, fade = 0.7 } = {}) {
        if (!this.ready || !this.mixer || !name) return false;

        const normalized = String(name).trim().toLowerCase();
        const key = ANIMATION_ALIASES[normalized] ?? normalized;
        
        if (!key || !this.actions[key]) {
            return false;
        }

        const isContinuousAction = (key === 'idle' || key === 'talk' || key === 'offline');
        const targetLoopBehavior = (key === 'greeting'|| key === 'thankful' || key === 'nod') ? false : (isContinuousAction ? true : loop);

        this._playAction(key, { loop: targetLoopBehavior, fade, gestureName: key });
        return true;
    }

    _playAction(key, { loop, fade, gestureName = '' }) {
        const next = this.actions[key];
        if (!next) return;

        if (this._activeListener) {
            this.mixer.removeEventListener('finished', this._activeListener);
            this._activeListener = null;
        }

        next.reset();
        next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
        next.clampWhenFinished = true; 

        if (this.current && this.current !== next) {
            next.enabled = true;
            next.setEffectiveWeight(1);
            next.play();
            this.current.crossFadeTo(next, fade, false);
        } else {
            next.play();
        }

        const isOneShotGesture = (key === 'greeting' || key === 'thankful' || key === 'nod');

        if (!loop && isOneShotGesture) {
            const onFinished = (e) => {
                if (e.action !== next) return;
                
                this.mixer.removeEventListener('finished', onFinished);
                if (this._activeListener === onFinished) {
                    this._activeListener = null;
                }
                
                const fallbackClip = this.isTalking ? 'talk' : 'idle';
                this.play(fallbackClip, { loop: true, fade: 0.7 });
            };
            
            this._activeListener = onFinished;
            this.mixer.addEventListener('finished', onFinished);
        }

        this.current = next;
    }

    playIdle() {
        if (this._activeListener) {
            this.mixer?.removeEventListener('finished', this._activeListener);
            this._activeListener = null;
        }
        this.isTalking = false;
        if (this.expressionEngine) this.expressionEngine.setTalkingState(false);
        return this.play('idle', { loop: true, fade: 0.7 });
    }

    update(delta) {
        this.mixer?.update(delta || 0.016);
    }

    dispose() {
        if (this.mixer && this._activeListener) {
            this.mixer.removeEventListener('finished', this._activeListener);
        }
        this._activeListener = null;
        this.mixer?.stopAllAction();
        this.mixer = null;
        this.actions = {};
        this.current = null;
        this.avatarModel = null;
        this.ready = false;
    }
}