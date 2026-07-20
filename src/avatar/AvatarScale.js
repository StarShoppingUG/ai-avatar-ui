import * as THREE from 'three';

/**
 * Defaults — kept as fallbacks so existing calls to apply()/ground() with no
 * options behave exactly as before. Any of these can be overridden per-call
 * (e.g. per-avatar or per-integration) without touching this file.
 */
export const AVATAR_SCALE_DEFAULTS = {
  /** Target standing height in scene units — tuned for Genies-style waist-up framing. */
  targetHeight: 3.05,
  /** Vertical baseline shift for framing. */
  verticalOffset: -1.2,
  /**
   * Slight forward pitch applied to every avatar for a more engaged, leaning-in
   * posture. If the avatar leans backwards instead of forwards, flip the sign.
   */
  forwardTiltX: -0.05,
};

export class AvatarScale {
  static measureHeight(avatarModel) {
    const box = new THREE.Box3().setFromObject(avatarModel.scene);
    const size = box.getSize(new THREE.Vector3()).y;
    return isNaN(size) || size < 0.1 ? 1.6 : size;
  }

  /* Centers the avatar, applies vertical offset, and sets the forward lean without losing Y rotation */
  static ground(avatarModel, {
    verticalOffset = AVATAR_SCALE_DEFAULTS.verticalOffset,
    forwardTiltX = AVATAR_SCALE_DEFAULTS.forwardTiltX,
  } = {}) {
    avatarModel.scene.updateMatrixWorld(true);
    avatarModel.scene.position.set(0, verticalOffset, 0);

    // 1. Keep whatever Y rotation the avatar already had (e.g., from facing the camera)
    const currentY = avatarModel.scene.rotation.y;

    // 2. If no Y rotation exists yet, manually flip it 180 degrees (Math.PI) to face front
    const targetY = currentY === 0 ? Math.PI : currentY;

    // 3. Apply the X lean safely alongside the Y rotation
    avatarModel.scene.rotation.set(forwardTiltX, targetY, 0);

    avatarModel.scene.updateMatrixWorld(true);
  }


  static apply(avatarModel, {
    scale = 1,
    targetHeight = AVATAR_SCALE_DEFAULTS.targetHeight,
    verticalOffset = AVATAR_SCALE_DEFAULTS.verticalOffset,
    forwardTiltX = AVATAR_SCALE_DEFAULTS.forwardTiltX,
  } = {}) {
    if (!avatarModel?.scene) return { norm: 1 };

    // Reset baseline safely including rotation
    avatarModel.scene.scale.set(1, 1, 1);
    avatarModel.scene.position.set(0, 0, 0);
    avatarModel.scene.rotation.set(0, 0, 0); 
    avatarModel.scene.updateMatrixWorld(true);

    const rawHeight = this.measureHeight(avatarModel);
    const norm = rawHeight > 0.01 ? targetHeight / rawHeight : 1;

    // Uniform scale — same factor on all three axes, so the avatar just
    // gets bigger/smaller without stretching out of proportion.
    const s = norm * scale;

    avatarModel.scene.scale.set(s, s, s);

    // Execute horizontal centering, grounding, and rotation logic
    this.ground(avatarModel, { verticalOffset, forwardTiltX });

    avatarModel.userData = avatarModel.userData || {};
    // Keep verticalOffset/forwardTiltX/targetHeight around so applyProportions()
    // (called later on scale changes) can reuse the same framing instead of
    // silently falling back to the module defaults.
    avatarModel.userData.avatarScale = {
      norm, sx: s, sy: s, sz: s, scale,
      targetHeight, verticalOffset, forwardTiltX,
    };

    return { norm, sx: s, sy: s, sz: s };
  }

  /** Apply a uniform scale multiplier on top of the normalized base scale. */
  static applyProportions(avatarModel, scale = 1) {
    if (!avatarModel?.scene) return;

    const meta = avatarModel?.userData?.avatarScale ?? {};
    const base = meta.norm ?? 1;
    const s = base * scale;

    avatarModel.scene.scale.set(s, s, s);

    // Always reground, reusing whatever offset/tilt this avatar was set up
    // with in apply() — so a per-avatar vertical offset survives scale changes.
    this.ground(avatarModel, {
      verticalOffset: meta.verticalOffset,
      forwardTiltX: meta.forwardTiltX,
    });

    if (avatarModel.userData?.avatarScale) {
      avatarModel.userData.avatarScale.sx = s;
      avatarModel.userData.avatarScale.sy = s;
      avatarModel.userData.avatarScale.sz = s;
      avatarModel.userData.avatarScale.scale = scale;
    }
  }
}