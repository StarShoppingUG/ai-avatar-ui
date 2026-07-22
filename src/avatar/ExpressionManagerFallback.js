import * as THREE from "three";

// Viseme synonyms for mouth shapes (aa=open, ih/ee=smile, ou/oh=round, etc.)
//
// movement was driven through here via setValue(). The app now drives GLB
// lip-sync directly through morph targets in LipSync.update(), and emotions
// through ExpressionEngine. The one thing that still calls setValue() today
// is LipSync.stop(), which zeroes out the mouth-shape keys below when audio
// playback ends — so that's the only path this class needs to support.
const VISME_SYNONYMS = {
  aa: [
    "aa",
    "a",
    "mouth_a",
    "v_aa",
    "phoneme_aa",
    "m_aa",
    "a_aa",
    "jawopen",
    "mouthopen",
  ],
  ih: ["ih", "i", "mouth_i", "v_i", "phoneme_i", "m_ih", "i_ih"],
  ou: ["ou", "o", "mouth_o", "v_ou", "phoneme_ou", "m_ou", "o_ou", "viseme_o"],
  ee: ["ee", "e", "mouth_e", "v_ee", "phoneme_ee", "m_ee", "e_ee", "viseme_e"],
  oh: ["oh", "o", "mouth_o", "v_oh", "phoneme_oh", "m_oh", "o_oh", "viseme_o"],
};

const JAW_BONE_PATTERNS = ["jaw", "lowerjaw", "lower_jaw", "chin", "mandible"];

// Per-mesh multipliers (matched by name substring)
const MESH_MULTIPLIERS = {
  head: 0.7,
  teeth: 0.9,
  tongue: 0.6,
};

function normalize(name) {
  return (name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function nameMatches(name, patterns) {
  return patterns.some((pattern) => normalize(name).includes(pattern));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class ExpressionManagerFallback {
  constructor(root, personaName = null) {
    this.root = root;
    this.morphTargets = new Map();
    this.jawBone = null;
    this.meshMap = new Map(); // mesh -> name for multiplier lookup
    this.morphCurrent = new Map(); // track current values for lerping

    this._scan(root);
  }

  // FIX: Clears out old cache tracks and scans the newly switched model geometry
  updateRoot(newRoot) {
    this.root = newRoot;

    // Wipe old mesh caches so they don't leak or conflict
    this.morphTargets.clear();
    this.meshMap.clear();
    this.morphCurrent.clear();
    this.jawBone = null;

    // Scan your new avatar assets
    this._scan(newRoot);
  }

  _scan(root) {
    root.traverse((obj) => {
      const name = normalize(obj.name);
      if (!this.jawBone && obj.isBone && nameMatches(name, JAW_BONE_PATTERNS)) {
        this.jawBone = obj;
      }

      if (
        obj.isMesh &&
        obj.morphTargetDictionary &&
        obj.morphTargetInfluences
      ) {
        this.meshMap.set(obj, obj.name); // store mesh name
        Object.entries(obj.morphTargetDictionary).forEach(
          ([morphName, index]) => {
            const key = normalize(morphName);
            const list = this.morphTargets.get(key) || [];
            list.push({ mesh: obj, index });
            this.morphTargets.set(key, list);
          },
        );
      }
    });
  }

  _getMeshMultiplier(mesh) {
    const meshName = (this.meshMap.get(mesh) || "").toLowerCase();
    let base = 0.9;

    for (const [pattern, mult] of Object.entries(MESH_MULTIPLIERS)) {
      if (meshName.includes(pattern)) {
        base = mult;
        break;
      }
    }

    return base;
  }

  _findMorphKeys(key) {
    const normalized = normalize(key);
    if (this.morphTargets.has(normalized)) return [normalized];

    const candidates = new Set();
    const synonyms = VISME_SYNONYMS[normalized] || [];

    synonyms.forEach((syn) => {
      if (this.morphTargets.has(syn)) {
        candidates.add(syn);
      }
    });

    for (const morphKey of this.morphTargets.keys()) {
      if (morphKey.includes(normalized) || normalized.includes(morphKey)) {
        candidates.add(morphKey);
      }
    }

    return Array.from(candidates);
  }

  _setMorph(key, weight) {
    const normalizedKey = normalize(key);
    const targets = this.morphTargets.get(normalizedKey);
    if (!targets || !targets.length) return false;

    targets.forEach(({ mesh, index }) => {
      const clampedWeight = THREE.MathUtils.clamp(
        weight * this._getMeshMultiplier(mesh),
        -1,
        1,
      );
      mesh.morphTargetInfluences[index] = clampedWeight;
    });
    return true;
  }

  _setMorphs(keys, weight) {
    let applied = false;
    keys.forEach((key) => {
      if (this._setMorph(key, weight)) {
        applied = true;
      }
    });
    return applied;
  }

  /**
   * Sets the lip-sync mouth shape weights based on phonetic viseme symbols.
   * FIX: Disables the fallback jaw bone rotation track so that skeletal joints
   * do not forcefully squash active facial blendshapes during speech.
   */
  _setViseme(key, weight) {
    const normalized = normalize(key);
    let morphKeys = this._findMorphKeys(normalized);

    // DYNAMIC SYLLABLE ROUTING: If exact rig target fails, assign direct fallbacks
    if (!morphKeys.length) {
      if (normalized === "oh" || normalized === "ou") {
        morphKeys = this._findMorphKeys("o");
      } else if (normalized === "ee") {
        morphKeys = this._findMorphKeys("e");
      } else if (normalized === "ih") {
        morphKeys = this._findMorphKeys("i");
      }
    }

    // Keep mouth movement subtle and close to the previous natural state.
    // Speech should still be visible, but not open the mouth aggressively.
    if (morphKeys.length) {
      return this._setMorphs(morphKeys, weight * 0.45);
    }

    // FIXED: Return false instead of falling back to _setJaw() bone rotation overrides.
    // This allows your Ready Player Me character to use its pre-baked mouth morph textures cleanly.
    return false;
  }

  _setJaw(weight) {
    if (!this.jawBone) return false;
    const clamped = clamp(weight, 0, 1);
    // Jaw rotation: -weight * 0.45 (matches Next.js implementation)
    this.jawBone.rotation.x = -clamped * 0.45;
    return true;
  }

  /**
   * Main runtime parameter router.
   */
  setValue(name, weight) {
    const normalized = normalize(name);
    const clampedWeight = THREE.MathUtils.clamp(weight, 0, 1);

    // 1. Native Phonetic Lip Sync Processing
    if (Object.prototype.hasOwnProperty.call(VISME_SYNONYMS, normalized)) {
      if (this._setViseme(normalized, clampedWeight)) {
        return true;
      }
      return this._setJaw(clampedWeight);
    }

    // Standard Fallback Direct Mapping Utilities
    if (this.morphTargets.has(normalized)) {
      return this._setMorph(normalized, clampedWeight);
    }

    const morphKeys = this._findMorphKeys(normalized);
    if (morphKeys.length) {
      return this._setMorphs(morphKeys, clampedWeight);
    }

    if (["aa", "ih", "ou", "ee", "oh"].includes(normalized)) {
      return this._setJaw(clampedWeight);
    }

    return false;
  }

}