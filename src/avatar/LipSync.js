/**
 * LipSync — mouth shapes synced directly to TTS audio waveforms using Web Audio API.
 */
import * as THREE from "three";

const MOUTH_SHAPES = ["aa", "ih", "oh"]; // Focus shapes for natural energy distribution
const LERP_SPEED = 24;

export class LipSync {
  constructor(avatarModel, personaName = null) {
    this.avatarModel = avatarModel;
    this.personaName = personaName;
    this.audio = null;
    this.playing = false;

    // Web Audio API properties
    this.audioCtx = null;
    this.source = null;
    this.analyser = null;
    this.audioData = null;

    this.currentMouthOpen = 0;
    this.targetMouthOpen = 0;

    // Internal engine reference mapping
    this._expressionEngineRef = null;
  }

  get expressionEngine() {
    return this._expressionEngineRef;
  }

  setExpressionEngine(engine) {
    this._expressionEngineRef = engine;
  }

  get manager() {
    return this.avatarModel && this.avatarModel.expressionManager;
  }

  /**
   * Drives the existing fallback (non-analyser) mouth-flap simulation in
   * update() without a real <audio> element to analyze — used when there's
   * no downloadable audio/viseme data, e.g. the browser's speechSynthesis
   * offline announcement. update() already fakes a sine-wave mouth motion
   * whenever `playing` is true and `analyser` is null; this just toggles
   * that state cleanly and routes through the normal stop() cleanup.
   */
  simulateTalking(active) {
    if (active) {
      this.stop(); // clear any real playback/analyser state first
      this.playing = true;
      const engine = this.expressionEngine;
      if (engine && typeof engine.setTalkingState === "function") {
        engine.setTalkingState(true);
      }
    } else {
      this.stop();
    }
  }

  async play(audioUrl, visemes, onComplete = null) {
    this.stop();
    if (!audioUrl) {
      if (typeof onComplete === "function") onComplete();
      return;
    }

    this.audio = new Audio(audioUrl);
    this.audio.crossOrigin = "anonymous";

    this.audio.onended = () => {
      this.stop();
      if (typeof onComplete === "function") onComplete();
    };

    this.audio.onerror = () => {
      this.stop();
      if (typeof onComplete === "function") onComplete();
    };

    // Hook up Audio Analyser logic
    this.audio.onplay = () => {
      try {
        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContextClass();
        this.source = this.audioCtx.createMediaElementSource(this.audio);
        this.analyser = this.audioCtx.createAnalyser();

        this.analyser.fftSize = 1024; // smaller buffer size for lower latency response
        this.analyser.smoothingTimeConstant = 0.4; // snappier tracking

        this.source.connect(this.analyser);
        this.analyser.connect(this.audioCtx.destination);

        this.audioData = new Uint8Array(this.analyser.fftSize);
        this.playing = true;

        // Safe runtime signaling sequence
        const engine = this.expressionEngine;
        if (engine && typeof engine.setTalkingState === "function") {
          engine.setTalkingState(true);
        }
      } catch (_) {
        this.playing = true;

        const engine = this.expressionEngine;
        if (engine && typeof engine.setTalkingState === "function") {
          engine.setTalkingState(true);
        }
      }
    };

    try {
      await this.audio.play();
    } catch (_) {
      if (typeof onComplete === "function") onComplete();
    }
    return this.audio;
  }

  stop() {
    this.playing = false;
    this.targetMouthOpen = 0;
    this.currentMouthOpen = 0;

    // Notify expression management layouts to expand boundaries back up instantly
    const engine = this.expressionEngine;
    if (engine && typeof engine.setTalkingState === "function") {
      engine.setTalkingState(false);
    }

    if (this.audio) {
      try {
        this.audio.pause();
      } catch (_) {}
      this.audio = null;
    }

    // Clean up audio nodes to prevent memory leaks and pipeline errors
    if (this.source) {
      try {
        this.source.disconnect();
      } catch (_) {}
      this.source = null;
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch (_) {}
      this.audioCtx = null;
    }
    this.analyser = null;
    this.audioData = null;

    // Clear out mouth positions completely when stopping to prevent stuck open poses
    const mgr = this.manager;
    if (mgr) {
      MOUTH_SHAPES.forEach((m) => {
        try {
          mgr.setValue(m, 0);
        } catch (_) {}
      });
    }
  }

   // Inside your LipSync.js -> update(delta) function:
  update(delta) {
    if (!this.avatarModel) return;
    const dt = delta || 0.016;

    // Waveform energy tracking layout calculation logic
    if (this.playing && this.analyser && this.audioData) {
            this.analyser.getByteTimeDomainData(this.audioData);
      let sum = 0;
      for (let i = 0; i < this.audioData.length; i++) {
        const v = (this.audioData[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / this.audioData.length);

      // UPGRADED MATH: Increased multiplier for sharper movement, lifted ceiling to 0.46
      this.targetMouthOpen = Math.min(0.46, Math.max(0, (rms - 0.012) * 3.2));


       } else if (this.playing && !this.analyser) {
      const t = performance.now() * 0.001;
      // No real waveform to analyze (offline/browser-TTS speech), so fake it.
      // Blend two out-of-phase waves at different rates so it doesn't read as
      // a single metronomic flap, and match the ~0-0.46 amplitude range the
      // real analyser path produces above — the old 0.05-0.21 range read as
      // barely moving next to actual audio-driven speech.
      const wave = Math.abs(Math.sin(t * 9.5)) * 0.7 + Math.abs(Math.sin(t * 5.3 + 1.3)) * 0.3;
      this.targetMouthOpen = 0.06 + wave * 0.40;

    } else {
      this.targetMouthOpen = 0;
    }

    const lerpFactor = 1 - Math.exp(-24 * dt);
    this.currentMouthOpen += (this.targetMouthOpen - this.currentMouthOpen) * lerpFactor;
    this.currentMouthOpen = Math.max(0, Math.min(1, this.currentMouthOpen));

    if (
      this.expressionEngine &&
      typeof this.expressionEngine.setTalkingState === "function"
    ) {
      this.expressionEngine.setTalkingState(this.currentMouthOpen > 0.02);
    }

    // --- HIGH FIDELITY VISEME MATCHING FOR CHOSEN GLB MODELS ---
    // 1. Dynamically locate your head/face mesh reference from the parent scene tree once per frame
const faceMeshes = [];
const root = this.avatarModel.scene || this.avatarModel;
if (root && typeof root.traverse === 'function') {
  root.traverse((obj) => {
    if (obj.isMesh && obj.morphTargetDictionary && obj.morphTargetInfluences) {
      faceMeshes.push(obj);
    }
  });
}
  

    // 2. If the face mesh is found, cleanly apply your high-fidelity speech visemes
if (faceMeshes.length) {
  const targetVisemes = ['viseme_aa', 'viseme_I', 'viseme_O', 'viseme_U', 'jawOpen', 'mouthOpen'];

  faceMeshes.forEach((mesh) => {
    const dict = mesh.morphTargetDictionary;
    const influences = mesh.morphTargetInfluences;

    targetVisemes.forEach(v => {
      if (dict[v] !== undefined) influences[dict[v]] = 0;
    });

    const visemeAA = dict['viseme_aa'];
    const visemeO = dict['viseme_O'];
    const jawFallback = dict['jawOpen'] || dict['mouthOpen'] || dict['mouthClose'];

    if (visemeAA !== undefined && visemeO !== undefined) {
      influences[visemeAA] = Math.min(1.0, influences[visemeAA] + (this.currentMouthOpen * 0.85));
      influences[visemeO] = Math.min(1.0, influences[visemeO] + (this.currentMouthOpen * 0.15));
    } else if (jawFallback !== undefined) {
      influences[jawFallback] = Math.min(1.0, influences[jawFallback] + this.currentMouthOpen);
    }
  });
}

  }

}