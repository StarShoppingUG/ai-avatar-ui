import * as THREE from 'three';

// Define the exact hardware shape keys your pure .glb model uses to build each expression
const COMBINED_EXPRESSIONS = {
       happy: {
        // --- 1. CONVERSATIONAL SOFT SMILE ---
        // Lowered weights prevent the lips from stretching into an unnatural grin
        mouthSmileLeft: 0.60,       
        mouthSmileRight: 0.60,
        mouthSmile: 0.5, 
               // Blends the unified smile shape smoothly

        // --- 2. REMOVED GUM EXPOSITION KEYS ---
        mouthUpperUpLeft: 0.3,      // REMOVED: Stops the upper lip from exposing gums
        mouthUpperUpRight: 0.3,     // REMOVED: Stops the upper lip from exposing gums

        // --- 3. RE-SHAPING THE LIP LINES NATURALLY ---
        mouthDimpleLeft: 0.30,      // Softens the corners inward so the smile looks warm
        mouthDimpleRight: 0.30,
        mouthLowerDownLeft: 0.2,   // Gently relaxes the lower lip downward for a soft parting look
        mouthLowerDownRight: 0.2,

        // --- 4. GENUINE SMILE EYE BLENDING ("DUCHENNE SMILE") ---
        // Pushing cheeks and squinting slightly completes a real smile, avoiding dead eyes
        cheekSquintLeft: 0.4,      // Lowered to prevent puffing up the face too much
        cheekSquintRight: 0.4,
        eyeSquintLeft: 0.3,        // Softly narrows the lower eyelids naturally
        eyeSquintRight: 0.3,
        browInnerUp: 0.3           // Minimal, gentle lift to open up the expression
    },

    sad: {
        browDownLeft: 0.20,
        browDownRight: 0.20,
        browOuterUpLeft: 0.65,      // Pulls outer brows up to create the "worried/sad" angle
        browOuterUpRight: 0.65,
        mouthFrownLeft: 0.80,       // Heavy down-pull on mouth corners
        mouthFrownRight: 0.80,
        mouthShrugLower: 0.45,      // Pushes lower lip upward into a subtle pouting depth
        mouthDimpleLeft: 0.30,      // Dimples the mouth corners inward slightly to reinforce sadness
        mouthDimpleRight: 0.30,
        eyeSquintLeft: 0.25,        // Saddens the eyes by slightly closing lower lids
        eyeSquintRight: 0.25
    },
    surprised: {
        eyeWideLeft: 1.0,           // Maximum wide-eyed shock exposure
        eyeWideRight: 1.0,
        browInnerUp: 0.90,          // Lifts inner brows straight up high
        browOuterUpLeft: 0.70,      // Arch the outer brows outward
        browOuterUpRight: 0.70,
        jawOpen: 0.35,              // Drops jaw down for an open-mouthed look
        mouthFunnel: 0.25           // Forms mouth layout into an 'O' circle shape
    },
    angry: {
        // --- 1. FOCUSED, HUMAN ANGER BROW ---
        // Lowered from 1.0 to 0.75 to prevent unnatural forehead collapsing
        browDownLeft: 0.75,          
        browDownRight: 0.75,
        browInnerUp: 0.0,
        
        // --- 2. PIERCING GLARE ---
        eyeSquintLeft: 0.50,        // Narrows the eyes into a sharp, focused stare
        eyeSquintRight: 0.50,

        // --- 3. CLENCHED, RECTANGULAR LIPS (REPLACES THE APELIK LOOK) ---
        // Pulling the mouth corners tight horizontally into a tense, flat line
        mouthStretchLeft: 0.40,     
        mouthStretchRight: 0.40,
        mouthFrownLeft: 0.45,       // Subtle downturn to anchor the frustration
        mouthFrownRight: 0.45,

        // --- 4. TIGHT JAW COMPRESSION ---
        // Rolls the lips inward tightly over the teeth to mimic a real clenched jaw
        mouthRollLower: 0.40,       
        mouthRollUpper: 0.40,       
        
        // --- 5. CLEAN REMOVALS ---
        noseSneerLeft: 0.0,         // REMOVED: Completely stops face bunching
        noseSneerRight: 0.0,        // REMOVED: Completely stops face bunching
        mouthLowerDownLeft: 0.0,    // REMOVED: Stops the chin from stretching out
        mouthLowerDownRight: 0.0
    },

       scared: {
        // --- 1. NATURAL HORROR BROW ARCH ---
        browInnerUp: 0.85,          // Lifts the center inner brows up in a natural fear pinch
        browDownLeft: 0.60,         // Softly pulls the outer brows downward
        browDownRight: 0.60,
        browOuterUpLeft: 0.0,
        browOuterUpRight: 0.0,

        // --- 2. THE PANICKED EYE GLARE ---
        eyeWideLeft: 0.85,           // Wide eyes, but slightly softened from 1.0 to look less bug-eyed
        eyeWideRight: 0.85,
        eyeSquintLeft: 0.0,
        eyeSquintRight: 0.0,

        // --- 3. THE RECTANGULAR, ANTI-CREEPY PANIC MOUTH ---
        mouthStretchLeft: 0.80,     // Pulls the mouth wide horizontally
        mouthStretchRight: 0.80,
        
        // REMOVED ALL SMILE KEYS TO KILL THE CREEPY JOKER LOOK!
        mouthSmileLeft: 0.0,       
        mouthSmileRight: 0.0,

        // --- 4. LIP ROLLING TO FLATTEN THE LINES CONVERSATIONALLY ---
        // These tuck the lips tightly over the teeth to flatten the corners naturally
        mouthRollLower: 0.50,       
        mouthRollUpper: 0.40,       

        // --- 5. SOFTENED OPEN JAW VERTICES ---
        mouthUpperUpLeft: 0.25,     // Soft vertical lift
        mouthUpperUpRight: 0.25,
        mouthLowerDownLeft: 0.25,   // Soft vertical drop
        mouthLowerDownRight: 0.25,
        
        jawOpen: 0.18,              // Lowered from 0.28 to 0.18 to prevent a gaping, hollow mouth look
        jawForward: 0.10,           // Subtle natural alignment thrust

        // --- 6. CLEAN SPEECH AUDIO ALIGNMENT ---
        viseme_FF: 0.30,            
        viseme_CH: 0.20,            
        mouthShrugLower: 0.20
    },
    relaxed: {
        // --- 1. EASED, NATURAL RESTING EYELIDS (NO PINCHING) ---
        // We drop eyeSquint significantly to stop the lower lid from pinching upward.
        // Instead, we use eyeBlink at a safe threshold (0.28) to gently droop 
        // the upper eyelid downward for a natural, peaceful resting gaze.
        eyeSquintLeft: 0.2,        // Kept very low to preserve natural eye shape
        eyeSquintRight: 0.2,       
        eyeBlinkLeft: 0.2,         // Soft upper-eyelid droop (perfect for a relaxed look)
        eyeBlinkRight: 0.2,        
        eyeLookDownLeft: 0.3,      // Gentle downward gaze to remove the rigid lens stare
        eyeLookDownRight: 0.3,

        // --- 2. SMOOTH, SERENE FOREHEAD LAYOUT ---
        // Softened values prevent the forehead mesh from bunching up.
        browDownLeft: 0.3,         
        browDownRight: 0.3,        
        browInnerUp: 0.3,          // Very slight lift to keep the expression warm

        // --- 3. SUBTLE SKINNED CHEEK CUSHION ---
        cheekSquintLeft: 0.3,      // Minimal pressure under the eye socket
        cheekSquintRight: 0.3,

        // --- 4. THE LOOSE PARTED SILHOUETTE MOUTH ---
        // Maintained the highly visible parted lip structure from before, 
        // as this breaks the neutral posture instantly without altering the eyes.
        jawOpen: 0.5,              // Visible, clean gap between the lips
        mouthPressLeft: 0.3,       
        mouthPressRight: 0.4,
        mouthFrownLeft: 0.3,       // Soft organic slack on the left corner
        mouthFrownRight: 0.1,
        mouthStretchLeft: 0.3,     
        mouthStretchRight: 0.2,
        mouthSmileRight: 0.2,      // Tiny micro-lift keeps the resting face serene

        // --- 5. SYSTEM WIPES ---
        mouthSmileLeft: 0.0,
        mouthDimpleLeft: 0.0,      
        mouthDimpleRight: 0.0,
        eyeWideLeft: 0.0,
        eyeWideRight: 0.0
    },


    neutral: {}                     // Smooth return loop to clear face canvas values
};


const EMOTION_ALIASES = {
    excited: 'happy', loving: 'happy', worried: 'sad', confused: 'surprised', thinking: 'relaxed',  fear: 'scared',      // Map backend 'fear' to scared
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

     /* Traverses .glb scene hierarchy to locate the mesh hosting morph keys*/
    _findFaceMesh() {
        this.faceMesh = null;
        const root = this.model?.scene || this.model;
        if (!root?.traverse) return;

        root.traverse((obj) => {
            // Find any mesh that contains valid morph target configuration keys
            if (obj.isMesh && obj.morphTargetDictionary && obj.morphTargetInfluences) {
                // Prioritize targeting the main head mesh
                if (obj.name.toLowerCase().includes('head') || !this.faceMesh) {
                    this.faceMesh = obj;
                }
            }
        });

        // Initialize target map data pools once mesh tracking registers
        if (this.faceMesh) {
            Object.keys(this.faceMesh.morphTargetDictionary).forEach((key) => {
                this.targetWeights[key] = 0;
                if (this.currentWeights[key] === undefined) this.currentWeights[key] = 0;
            });
        }
    }

    setExpression(emotion) {
        if (!this.faceMesh) this._findFaceMesh();
        
        const clean = String(emotion || 'neutral').trim().toLowerCase();
        const targetEmotion = EMOTION_ALIASES[clean] || (COMBINED_EXPRESSIONS[clean] ? clean : 'neutral');
        this.activeEmotion = targetEmotion;

        // Resets all targets back down to an un-distorted 0.0 baseline state
        Object.keys(this.targetWeights).forEach((key) => { this.targetWeights[key] = 0; });

        // Maps combined layout parameters onto target states
        const designLayout = COMBINED_EXPRESSIONS[targetEmotion] || {};
        Object.entries(designLayout).forEach(([morphName, targetWeight]) => {
            if (this.faceMesh.morphTargetDictionary[morphName] !== undefined) {
                this.targetWeights[morphName] = targetWeight;
            }
        });
    }

       update(delta) {
        if (!this.faceMesh) {
            this._findFaceMesh();
            return;
        }

        const dt = delta || 0.016;
        const dict = this.faceMesh.morphTargetDictionary;
        const influences = this.faceMesh.morphTargetInfluences;
        // Lower this number for an even slower fade; raise it for snappier
        // expressions 8 → 3.5 → 1.5 → 0.6 → 0.3 → 0.5
        const lerpFactor = 1 - Math.exp(-1.5 * dt); 

        // 1. Smoothly interpolate every active emotional shape key
        Object.keys(this.targetWeights).forEach((key) => {
            let targetValue = this.targetWeights[key];

            // --- THE CRITICAL FIX: DYNAMIC MOUTH SUPPRESSION (DUCKING) ---
            // If the avatar is actively talking, aggressively suppress any emotional shape keys 
            // affecting the lower face so they don't overwrite or choke out the lip sync.
            if (this.isTalking) {
                const isMouthKey = key.includes('mouth') || 
                                   key.includes('jaw') || 
                                   key.includes('lip') || 
                                   key.includes('cheek') || 
                                   key.includes('viseme');
                                   
                if (isMouthKey) {
                    // Reduce emotional intensity on the mouth by 80% to give lip-sync 100% vertex headroom
                    targetValue *= 0.20; 
                }
            }

            this.currentWeights[key] += (targetValue - this.currentWeights[key]) * lerpFactor;
            
            // Push values directly to the hardware rendering buffer array index
            const index = dict[key];
            if (index !== undefined) {
                influences[index] = Math.max(0, Math.min(1, this.currentWeights[key]));
            }
        });

        // 2. Compute runtime procedural blinking cycles
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

        // Apply blink tracking additively directly to native keys
        const leftBlinkIdx = dict['eyeBlinkLeft'] || dict['eyeBlink_L'];
        const rightBlinkIdx = dict['eyeBlinkRight'] || dict['eyeBlink_R'];
        
        if (leftBlinkIdx !== undefined) influences[leftBlinkIdx] = this._blinkState !== 'waiting' ? this._blinkProgress : 0;
        if (rightBlinkIdx !== undefined) influences[rightBlinkIdx] = this._blinkState !== 'waiting' ? this._blinkProgress : 0;
    }

}