

const COMBINED_EXPRESSIONS = {
    happy: {
        mouthSmileLeft: 0.60,       
        mouthSmileRight: 0.60,
        mouthSmile: 1.0,
        mouthUpperUpLeft: 0.30,      
        mouthUpperUpRight: 0.30,     
        mouthDimpleLeft: 0.32,      // Asymmetric lift for organic feel
        mouthDimpleRight: 0.28,
        mouthLowerDownLeft: 0.20,   
        mouthLowerDownRight: 0.20,
        cheekSquintLeft: 0.40,      
        cheekSquintRight: 0.40,
        eyeSquintLeft: 0.52,        // Asymmetric eye compression
        eyeSquintRight: 0.48,       
        browInnerUp: 0.60           
    },

    sad: {
        browInnerUp: 0.85,          
        browOuterUpLeft: 0.78,      // Broken symmetry on brow worry lines
        browOuterUpRight: 0.72,     
        eyeSquintLeft: 0.40,
        eyeSquintRight: 0.40,
        eyeBlinkLeft: 0.28,         // Asymmetric droop for defeated eyes
        eyeBlinkRight: 0.23,        
        mouthFrownLeft: 0.95,       
        mouthFrownRight: 0.95,
        mouthShrugLower: 0.70,      
        mouthDimpleLeft: 0.40,      
        mouthDimpleRight: 0.40
    },

    angry: {
        browDownLeft: 0.82,         // Asymmetric frustration furrow
        browDownRight: 0.78,        
        eyeSquintLeft: 0.78,        // Pierce glare asymmetry
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
        browOuterUpLeft: 0.72,      // Natural asymmetric arching
        browOuterUpRight: 0.68,     
        jawOpen: 0.35,              
        mouthOpen: 0.45,            
        mouthFunnel: 0.25,          
        mouthPucker: 0.15           
    },

    scared: {
        browInnerUp: 0.85,          
        browDownLeft: 0.62,         // Asymmetric fear pull
        browDownRight: 0.58,        
        eyeWideLeft: 0.88,          // Panicked eye glare asymmetry
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
        mouthPucker: 0.0,           // Clears speech pucker tear
        mouthFunnel: 0.0            // Clears speech funnel tear
    },

    relaxed: {
        eyeBlinkLeft: 0.42,         // Sleepy asymmetric gravity drop
        eyeBlinkRight: 0.46,        
        eyeLookDownLeft: 0.38,      
        eyeLookDownRight: 0.42,     
        browDownLeft: 0.18,         // Slacked micro-asymmetry
        browDownRight: 0.12,        
        jawOpen: 0.25,              
        mouthOpen: 0.35,            
        mouthSmileRight: 0.25,      // Asymmetric resting loop
        mouthSmileLeft: 0.20,
        mouthSmile: 0.20          
    },

    neutral: {}
};


const EMOTION_ALIASES = {
    excited: 'happy', loving: 'happy', worried: 'sad', confused: 'surprised', thinking: 'relaxed',  fear: 'scared',  
    afraid: 'scared'
};

export class ExpressionEngine {
    constructor(avatarModel) {
        this.model = avatarModel;
        this.faceMesh = null;
        
        this.targetWeights = {}; // Tracks current goal for every single morph key
        this.currentWeights = {}; // Tracks smoothed runtime frame positions
        this.activeEmotion = 'neutral';
        this.isTalking = false;

        // Procedural Blinking Properties
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

  /* Traverses .glb scene hierarchy to locate the mesh hosting morph keys.
   Selects the mesh with the MOST morph targets, rather than matching on
   name — model sources vary wildly in naming (some use "head", some use
   generic names like "mesh_8"), but the primary face mesh reliably has by
   far the richest set of morph targets, since it alone carries the full
   viseme set plus every emotion/expression shape together. */
   
_findFaceMesh() {
    this.faceMeshes = [];
    const root = this.model?.scene || this.model;
    if (!root?.traverse) return;

    root.traverse((obj) => {
        if (obj.isMesh && obj.morphTargetDictionary && obj.morphTargetInfluences) {
            this.faceMeshes.push(obj);
        }
    });

    // Initialize target map data pools using the union of all keys across meshes
    this.faceMeshes.forEach((mesh) => {
        Object.keys(mesh.morphTargetDictionary).forEach((key) => {
            if (this.targetWeights[key] === undefined) this.targetWeights[key] = 0;
            if (this.currentWeights[key] === undefined) this.currentWeights[key] = 0;
        });
    });
}

setExpression(emotion) {
    if (!this.faceMeshes?.length) this._findFaceMesh();

    const clean = String(emotion || 'neutral').trim().toLowerCase();
    const targetEmotion = EMOTION_ALIASES[clean] || (COMBINED_EXPRESSIONS[clean] ? clean : 'neutral');
    this.activeEmotion = targetEmotion;

    Object.keys(this.targetWeights).forEach((key) => { this.targetWeights[key] = 0; });

    const designLayout = COMBINED_EXPRESSIONS[targetEmotion] || {};
    Object.entries(designLayout).forEach(([morphName, targetWeight]) => {
        // Apply if ANY mesh has this key (union check, not single-mesh check)
        const existsSomewhere = this.faceMeshes.some(m => m.morphTargetDictionary[morphName] !== undefined);
        if (existsSomewhere) {
            this.targetWeights[morphName] = targetWeight;
        }
    });
}
update(delta) {
    if (!this.faceMeshes?.length) {
        this._findFaceMesh();
        return;
    }

    const dt = delta || 0.016;
    const lerpFactor = 1 - Math.exp(-1.5 * dt);

    // 1. Smooth every active emotional shape key (compute once — shared across meshes)
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

    // 2. Procedural blinking cycle (state machine unchanged)
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

    // Apply blink across every mesh that has the key
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