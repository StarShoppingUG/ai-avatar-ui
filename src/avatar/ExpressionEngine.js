const COMBINED_EXPRESSIONS = {
    happy: {
        mouthSmileLeft: 0.60,
        mouthSmileRight: 0.60,
        mouthSmile: 0.50,
        mouthOpen: 0.50,
        mouthUpperUpLeft: 0.30,
        mouthUpperUpRight: 0.30,
        mouthDimpleLeft: 0.32,
        mouthDimpleRight: 0.28,
        mouthLowerDownLeft: 0.20,
        mouthLowerDownRight: 0.20,
        cheekSquintLeft: 0.40,
        cheekSquintRight: 0.40,
        eyeSquintLeft: 0.52,
        eyeSquintRight: 0.48,
        browInnerUp: 0.60
    },

    sad: {
        browInnerUp: 0.85,
        browOuterUpLeft: 0.78,
        browOuterUpRight: 0.72,
        eyeSquintLeft: 0.40,
        eyeSquintRight: 0.40,
        eyeBlinkLeft: 0.28,
        eyeBlinkRight: 0.23,
        mouthFrownLeft: 0.95,
        mouthFrownRight: 0.95,
        mouthShrugLower: 0.70,
        mouthDimpleLeft: 0.40,
        mouthDimpleRight: 0.40
    },

    angry: {
        browDownLeft: 0.82,
        browDownRight: 0.78,
        eyeSquintLeft: 0.78,
        eyeSquintRight: 0.72,
        mouthFrownLeft: 0.50,
        mouthFrownRight: 0.50,
        mouthStretchLeft: 0.45,
        mouthStretchRight: 0.45
    },

    surprised: {
        eyeWideLeft: 1.0,
        eyeWideRight: 1.0,
        browInnerUp: 0.90,
        browOuterUpLeft: 0.72,
        browOuterUpRight: 0.68,
        jawOpen: 0.35,
        mouthOpen: 0.45,
        mouthFunnel: 0.25,
        mouthPucker: 0.15
    },

    scared: {
        browInnerUp: 0.85,
        browDownLeft: 0.62,
        browDownRight: 0.58,
        eyeWideLeft: 0.88,
        eyeWideRight: 0.82,
        mouthStretchLeft: 0.80,
        mouthStretchRight: 0.80,
        mouthRollLower: 0.50,
        mouthRollUpper: 0.40,
        jawOpen: 0.18,
        mouthOpen: 0.18,
        jawForward: 0.10,
        viseme_FF: 0.30,
        viseme_CH: 0.20,
        mouthShrugLower: 0.20,
        mouthPucker: 0.0,
        mouthFunnel: 0.0
    },

    relaxed: {
        eyeBlinkLeft: 0.42,
        eyeBlinkRight: 0.46,
        eyeLookDownLeft: 0.38,
        eyeLookDownRight: 0.42,
        browDownLeft: 0.18,
        browDownRight: 0.12,
        jawOpen: 0.25,
        mouthOpen: 0.35,
        mouthSmileRight: 0.25,
        mouthSmileLeft: 0.20,
        mouthSmile: 0.20
    },

    neutral: {}
};

const EMOTION_ALIASES = {
    excited: 'happy', loving: 'happy', worried: 'sad', confused: 'surprised', thinking: 'relaxed', fear: 'scared',
    afraid: 'scared'
};

// Fallback for rigs missing whole groups of granular shapes (e.g. no
// mouthSmileLeft/Right, no jawOpen). If every key in `missing` is absent
// from the current model, each `floor` value is applied as a MINIMUM
// (via Math.max), not added — guarantees a strong result even if the base
// weight was low or zero. No-op on rigs that already have the granular keys.
const COMPENSATION_RULES = {
    happy: [
        { missing: ['cheekSquintLeft', 'cheekSquintRight'], floor: { eyeSquintLeft: 0.65, eyeSquintRight: 0.65 } },
        { missing: ['mouthSmileLeft', 'mouthSmileRight'], floor: { mouthSmile: 1 } },
        { missing: ['mouthUpperUpLeft', 'mouthUpperUpRight'], floor: { mouthOpen: 1, mouthLowerDownLeft: 1, mouthLowerDownRight: 1 } },
    ],
    angry: [
        { missing: ['mouthStretchLeft', 'mouthStretchRight'], floor: { noseSneerLeft: 0.55, noseSneerRight: 0.50, mouthShrugUpper: 0.30 } },
    ],
    surprised: [
        { missing: ['jawOpen'], floor: { mouthOpen: 1 } },
        { missing: ['mouthFunnel'], floor: { mouthPucker: 0.25 } },
    ],
    scared: [
        { missing: ['mouthStretchLeft', 'mouthStretchRight'], floor: { mouthShrugUpper: 0.35, mouthShrugLower: 0.30, noseSneerLeft: 0.30, noseSneerRight: 0.30 } },
        { missing: ['mouthRollLower', 'mouthRollUpper'], floor: { mouthShrugLower: 0.20 } },
        { missing: ['jawOpen'], floor: { mouthOpen: 1, jawForward: 0.40 } },
    ],
    relaxed: [
        { missing: ['eyeLookDownLeft', 'eyeLookDownRight'], floor: { eyeBlinkLeft: 0.55, eyeBlinkRight: 0.55 } },
    ],
};

export class ExpressionEngine {
    constructor(avatarModel) {
        this.model = avatarModel;
        this.faceMesh = null;

        this.targetWeights = {};
        this.currentWeights = {};
        this.activeEmotion = 'neutral';
        this.isTalking = false;

        this._blinkState = 'waiting';
        this._blinkProgress = 0;
        this._blinkTimer = 3.0;

        this._findFaceMesh();
    }

    setAvatarModel(newAvatarModel) {
        this.model = newAvatarModel;
        this._findFaceMesh();
    }

    setTalkingState(talking) {
        this.isTalking = !!talking;
    }

    // Finds every mesh with morph targets — picks by richness, not name.
    _findFaceMesh() {
        this.faceMeshes = [];
        const root = this.model?.scene || this.model;
        if (!root?.traverse) return;

        root.traverse((obj) => {
            if (obj.isMesh && obj.morphTargetDictionary && obj.morphTargetInfluences) {
                this.faceMeshes.push(obj);
            }
        });

        this.faceMeshes.forEach((mesh) => {
            Object.keys(mesh.morphTargetDictionary).forEach((key) => {
                if (this.targetWeights[key] === undefined) this.targetWeights[key] = 0;
                if (this.currentWeights[key] === undefined) this.currentWeights[key] = 0;
            });
        });

    }

    _existsSomewhere(key) {
        return this.faceMeshes.some((m) => m.morphTargetDictionary[key] !== undefined);
    }

    setExpression(emotion) {
        if (!this.faceMeshes?.length) this._findFaceMesh();

        const clean = String(emotion || 'neutral').trim().toLowerCase();
        const targetEmotion = EMOTION_ALIASES[clean] || (COMBINED_EXPRESSIONS[clean] ? clean : 'neutral');
        this.activeEmotion = targetEmotion;

        Object.keys(this.targetWeights).forEach((key) => { this.targetWeights[key] = 0; });

        const designLayout = COMBINED_EXPRESSIONS[targetEmotion] || {};
        Object.entries(designLayout).forEach(([morphName, targetWeight]) => {
            if (this._existsSomewhere(morphName)) {
                this.targetWeights[morphName] = targetWeight;
            }
        });

        // Apply compensation floors for missing shape groups (see COMPENSATION_RULES).
        const rules = COMPENSATION_RULES[targetEmotion] || [];
        rules.forEach(({ missing, floor }) => {
            const groupIsMissing = missing.every((key) => !this._existsSomewhere(key));
            if (!groupIsMissing) return;
            Object.entries(floor).forEach(([morphName, floorWeight]) => {
                if (this._existsSomewhere(morphName)) {
                    this.targetWeights[morphName] = Math.max(this.targetWeights[morphName] || 0, floorWeight);
                }
            });
        });
    }

    update(delta) {
        if (!this.faceMeshes?.length) {
            this._findFaceMesh();
            return;
        }

        const dt = delta || 0.016;
        const lerpFactor = 1 - Math.exp(-1.5 * dt);

        // Smooth every active shape key toward its target
        Object.keys(this.targetWeights).forEach((key) => {
            let targetValue = this.targetWeights[key];

            if (this.isTalking) {
                const isMouthKey = key.includes('mouth') ||
                                   key.includes('jaw') ||
                                   key.includes('lip') ||
                                   key.includes('cheek') ||
                                   key.includes('viseme');
                if (isMouthKey) {
                    targetValue *= 0.20;
                }
            }

            this.currentWeights[key] += (targetValue - this.currentWeights[key]) * lerpFactor;
        });

        // Push smoothed values to every mesh that has each key
        this.faceMeshes.forEach((mesh) => {
            const dict = mesh.morphTargetDictionary;
            const influences = mesh.morphTargetInfluences;
            Object.keys(this.currentWeights).forEach((key) => {
                const index = dict[key];
                if (index !== undefined) {
                    influences[index] = Math.max(0, Math.min(1, this.currentWeights[key]));
                }
            });
        });

        // Procedural blink state machine
        if (this._blinkState === "waiting") {
            this._blinkTimer -= dt;
            if (this._blinkTimer <= 0) this._blinkState = "closing";
        } else if (this._blinkState === "closing") {
            this._blinkProgress += dt * 14;
            if (this._blinkProgress >= 1) { this._blinkProgress = 1; this._blinkState = "opening"; }
        } else if (this._blinkState === "opening") {
            this._blinkProgress -= dt * 10;
            if (this._blinkProgress <= 0) {
                this._blinkProgress = 0;
                this._blinkState = "waiting";
                this._blinkTimer = 3.0 + Math.random() * 3.0;
            }
        }

        this.faceMeshes.forEach((mesh) => {
            const dict = mesh.morphTargetDictionary;
            const influences = mesh.morphTargetInfluences;
            const leftBlinkIdx = dict['eyeBlinkLeft'] ?? dict['eyeBlink_L'];
            const rightBlinkIdx = dict['eyeBlinkRight'] ?? dict['eyeBlink_R'];

            if (leftBlinkIdx !== undefined) influences[leftBlinkIdx] = this._blinkState !== 'waiting' ? this._blinkProgress : 0;
            if (rightBlinkIdx !== undefined) influences[rightBlinkIdx] = this._blinkState !== 'waiting' ? this._blinkProgress : 0;
        });
    }
}