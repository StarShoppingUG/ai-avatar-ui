import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { AvatarScale } from './AvatarScale.js';
import { ExpressionManagerFallback } from './ExpressionManagerFallback.js';


/* AvatarManager — loads and positions the avatar body. GLB-only. */

// Releases GPU resources (geometries, materials, textures) for a scene
// subtree. Used when swapping avatars so the previous model doesn't leak.
function disposeObject3D(object) {
    if (!object) return;
    object.traverse((child) => {
        if (!child.isMesh) return;
        child.geometry?.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
            if (!material) return;
            Object.values(material).forEach((value) => {
                if (value && typeof value.dispose === 'function') value.dispose();
            });
            material.dispose();
        });
    });
}

export class AvatarManager {
    constructor(scene) {
        this.scene = scene;
        this.currentAvatar = null;
        this.loader = new GLTFLoader();
        this.loader.setMeshoptDecoder(MeshoptDecoder);
    }

    get avatarModel() {
        return this.currentAvatar;
    }

    /**
     * Update scale and/or vertical position for the currently loaded avatar,
     * live — no reload needed. Either field is optional; omit one to leave
     * it as-is. verticalOffset is stored back onto the avatar's own scale
     * metadata so it survives a later scale-only call.
     */
    setTransform({ scale, verticalOffset } = {}) {
        if (!this.currentAvatar) return;
        const meta = this.currentAvatar.userData?.avatarScale;
        if (meta && verticalOffset !== undefined) meta.verticalOffset = verticalOffset;
        AvatarScale.applyProportions(this.currentAvatar, scale ?? meta?.scale ?? 1);
    }

    _removeCurrent() {
        if (!this.currentAvatar) return;
        if (this.currentAvatar.scene) this.scene.remove(this.currentAvatar.scene);
        try { this.currentAvatar.dispose?.(); } catch (_) {}
        this.currentAvatar = null;
    }

async loadAvatar(url, personaName = null, customization = {}, timeoutMs = 30000) {
        this._removeCurrent();

        // Every call gets a unique token. If a newer loadAvatar() call comes
        // in before this one finishes, this token becomes stale — used
        // below to make sure a slow/overlapping load never adds its result
        // to the scene after being superseded, even if it technically
        // "succeeds" after the fact.
        this._loadToken = (this._loadToken || 0) + 1;
        const myToken = this._loadToken;

        return new Promise((resolve, reject) => {
            // On unstable connections the GLTFLoader's fetch can stall
            // indefinitely — it never calls onLoad or onError, it just
            // hangs. Without this, the caller's await never resolves and
            // the UI gets stuck (or, combined with an unconditional
            // "Ready" elsewhere, silently looks fine while staying blank).
            let settled = false;
            const timeoutId = setTimeout(() => {
                if (settled) return;
                settled = true;
                reject(new Error(
                    `Avatar load timed out after ${timeoutMs}ms for "${url}" — check your connection.`
                ));
            }, timeoutMs);

            this.loader.load(
                url,
                (gltf) => {
                    // Rotate to face camera — GLB uses +Z forward, flip 180°
                    gltf.scene.rotation.y = Math.PI;
                    gltf.scene.traverse((obj) => {
                        obj.frustumCulled = false;
                        obj.castShadow = true;
                    });

                    const wrapper = {
                        scene: gltf.scene,
                        expressionManager: new ExpressionManagerFallback(gltf.scene, personaName),
                        update: () => {},
                        dispose: () => disposeObject3D(gltf.scene),
                    };

                    // Normalize size + ground feet at y=0. `customization` lets
                    // callers (AvatarModel → AvatarController) set an overall
                    // scale and vertical position per-avatar; AvatarScale.apply()
                    // falls back to its own defaults for anything left unset here.
                    const { scale, verticalOffset } = customization;
                    AvatarScale.apply(wrapper, { scale, verticalOffset });

                    if (settled) return; // timeout already fired, discard this late success
                    if (myToken !== this._loadToken) {
                        // A newer loadAvatar() call superseded this one while
                        // it was in flight — discard this result entirely
                        // instead of adding a second model to the scene.
                        settled = true;
                        clearTimeout(timeoutId);
                        disposeObject3D(gltf.scene);
                        reject(new Error('Superseded by a newer avatar load'));
                        return;
                    }

                    this.scene.add(gltf.scene);
                    this.currentAvatar = wrapper;

                    settled = true;
                    clearTimeout(timeoutId);
                    resolve(wrapper);
                },
                (xhr) => {
                    if (xhr.total) {
                        const pct = Math.round((xhr.loaded / xhr.total) * 100);
                    }
                },
(error) => {
                    if (settled) return; // timeout already fired, discard this late error
                    if (myToken !== this._loadToken) {
                        settled = true;
                        clearTimeout(timeoutId);
                        return; // superseded — nothing to report, the newer load owns the outcome
                    }
                    settled = true;
                    clearTimeout(timeoutId);
                    // Main: friendly error for missing files
                    const raw = (error && error.message) || String(error);
                    const friendly = /Unexpected token|JSON|DOCTYPE/i.test(raw)
                        ? `Avatar file not found at "${url}" (server returned a web page instead of a model). Check that the file exists under public${url}.`
                        : `Avatar load error for "${url}": ${raw}`;
                    reject(new Error(friendly));
                }
            );
        });
    }

}