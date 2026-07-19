import * as THREE from 'three';

/** Target standing height in scene units — tuned for Genies-style waist-up framing. */
const TARGET_HEIGHT = 3.05;
/*Vertical baseline shift for framing. */
const VERTICAL_OFFSET = -1.2;

/** 
 * Slight forward pitch applied to every avatar for a more engaged, leaning-in 
 * posture. If the avatar leans backwards instead of forwards, change this to 0.05.
 */
const FORWARD_TILT_X = -0.05; 

export class AvatarScale {
  static measureHeight(avatarModel) {
    const box = new THREE.Box3().setFromObject(avatarModel.scene);
    const size = box.getSize(new THREE.Vector3()).y;
    return isNaN(size) || size < 0.1 ? 1.6 : size;
  }

  /* Centers the avatar, applies vertical offset, and sets the forward lean */
/* Centers the avatar, applies vertical offset, and sets the forward lean without losing Y rotation */
static ground(avatarModel) {
  avatarModel.scene.updateMatrixWorld(true);
  avatarModel.scene.position.set(0, VERTICAL_OFFSET, 0);
  
  // 1. Keep whatever Y rotation the avatar already had (e.g., from facing the camera)
  const currentY = avatarModel.scene.rotation.y;
  
  // 2. If no Y rotation exists yet, manually flip it 180 degrees (Math.PI) to face front
  const targetY = currentY === 0 ? Math.PI : currentY;

  // 3. Apply the X lean safely alongside the Y rotation
  avatarModel.scene.rotation.set(FORWARD_TILT_X, targetY, 0);
  
  avatarModel.scene.updateMatrixWorld(true);
}


  static apply(avatarModel, { heightScale = 1, buildScale = 1 } = {}) {
    if (!avatarModel?.scene) return { norm: 1 };

    // Reset baseline safely including rotation
    avatarModel.scene.scale.set(1, 1, 1);
    avatarModel.scene.position.set(0, 0, 0);
    avatarModel.scene.rotation.set(0, 0, 0); 
    avatarModel.scene.updateMatrixWorld(true);

    const rawHeight = this.measureHeight(avatarModel);
    const norm = rawHeight > 0.01 ? TARGET_HEIGHT / rawHeight : 1;

    const sx = norm * buildScale;
    const sy = norm * heightScale;
    const sz = norm * buildScale;

    avatarModel.scene.scale.set(sx, sy, sz);

    // Execute horizontal centering, grounding, and rotation logic
    this.ground(avatarModel);

    avatarModel.userData = avatarModel.userData || {};
    avatarModel.userData.avatarScale = { norm, sx, sy, sz, heightScale, buildScale };

    return { norm, sx, sy, sz };
  }

  /** Apply studio height/build on top of normalized base scale. */
  static applyProportions(avatarModel, heightScale = 1, buildScale = 1) {
    if (!avatarModel?.scene) return;

    const base = avatarModel?.userData?.avatarScale?.norm ?? 1;
    const sx = base * buildScale;
    const sy = base * heightScale;
    const sz = base * buildScale;

    avatarModel.scene.scale.set(sx, sy, sz);

    // Always reground to recalculate centered offsets and maintain the tilt
    this.ground(avatarModel);

    if (avatarModel.userData?.avatarScale) {
      avatarModel.userData.avatarScale.sx = sx;
      avatarModel.userData.avatarScale.sy = sy;
      avatarModel.userData.avatarScale.sz = sz;
      avatarModel.userData.avatarScale.heightScale = heightScale;
      avatarModel.userData.avatarScale.buildScale = buildScale;
    }
  }
}
