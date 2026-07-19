import * as THREE from 'three';

// Responsive camera framing for the avatar: fits both frame width and
// height in view (whichever needs more FOV wins), and grounds the avatar's
// feet + calibrates the floor line via floorScreenFraction on resize.
export class CameraFraming {
    constructor({ camera, orbitControls, renderer, cameraDistance = 2.25, floorScreenFraction = 0.85 }) {
        this.camera = camera;
        this.orbitControls = orbitControls;
        this.renderer = renderer;
        this.cameraDistance = cameraDistance;

        // 0–1 screen position for the floor line (0 = top, 1 = bottom).
        this.floorScreenFraction = floorScreenFraction;

        // World Y of the floor, set by setAvatar()'s floorY param.
        this.floorY = 0;

        this.FRAME_WIDTH = 1.65;
        // Vertical framing height (meters), centered on orbitControls.target.y.
        this.FRAME_HEIGHT = 1.65;

        // Set once setAvatar() runs and we have real measurements.
        this.avatarRoot   = null;
        this.avatarHeight = null;
        this.avatarWidth  = null;

        this.resize = this.resize.bind(this);
        window.addEventListener('resize', this.resize);

        // Apply initial framing using fallback constants.
        this.resize();
    }

    // Measures the avatar's real size and grounds its feet at floorY.
    // Call once after the VRM/GLB has loaded into the scene.
    setAvatar(avatarRoot, floorY = 0) {
        this.avatarRoot = avatarRoot;
        this.floorY = floorY;
        if (!avatarRoot) return;

        avatarRoot.rotation.y = Math.PI;

        const box = new THREE.Box3().setFromObject(avatarRoot);
        const size = new THREE.Vector3();
        box.getSize(size);

        this.avatarHeight = size.y;
        this.avatarWidth  = size.x;

        // Ground the feet: shift the root by however far its lowest
        // point currently is from the target floor height.
        avatarRoot.position.y += (floorY - box.min.y);

        this.resize();
    }

    resize() {
    const rect = this.renderer?.domElement?.getBoundingClientRect?.();
    const w = rect?.width || this.renderer?.domElement?.clientWidth || window.innerWidth;
    const h = rect?.height || this.renderer?.domElement?.clientHeight || window.innerHeight;

    // Detect mobile/narrow framing by aspect ratio or width, not raw height
    // alone — a wide container can still resolve short via CSS percentages.
    const aspect = w / h;
    const isMobile = aspect <= 0.9 || w <= 400;

    this.renderer.setSize(Math.max(1, Math.floor(w)), Math.max(1, Math.floor(h)), false);
    this.camera.aspect = w / h;

    const height = this.avatarHeight ?? 1.75;
    const width  = this.avatarWidth  ?? 0.5;

    const HEIGHT_MARGIN = 1.12;
    const WIDTH_MARGIN  = 1.35;

    if (isMobile) {
        // Aim at upper chest/neck so head is always visible
        const chestY = height * 0.75;
        this.orbitControls.target.y = chestY;
        this.camera.position.y = chestY;
    
        // Tighter frame — just head and shoulders
        this.FRAME_WIDTH  = width * WIDTH_MARGIN * 1.2;
        this.FRAME_HEIGHT = (height - chestY) * 2.5 * HEIGHT_MARGIN;

        this.camera.position.z = -this.cameraDistance * 0.6;

        // Skip floor pan on mobile — it drags the view down to the feet
        this.camera.fov = 45;
        this.camera.updateProjectionMatrix();
        this.orbitControls.update();
        return; 
        
    } else {
        // Full body view
        const centerY = height / 2;
        this.orbitControls.target.y = centerY;
        this.camera.position.y = centerY;
        this.FRAME_WIDTH  = width  * WIDTH_MARGIN;
        this.FRAME_HEIGHT = height * HEIGHT_MARGIN;

        this.camera.position.z = -this.cameraDistance;
    }

    // Floor pan calibration
    const frameTopY = this.orbitControls.target.y + this.FRAME_HEIGHT / 2;
    const currentFloorFraction = (frameTopY - this.floorY) / this.FRAME_HEIGHT;
    const panDelta = (this.floorScreenFraction - currentFloorFraction) * this.FRAME_HEIGHT;

    this.orbitControls.target.y += panDelta;
    this.camera.position.y += panDelta;

    // FOV calculation
    const halfWidthFovRad = Math.atan((this.FRAME_WIDTH / 2) / this.camera.position.z);
    const vFovHalfFromWidth = Math.atan(Math.tan(halfWidthFovRad) / this.camera.aspect);
    const vFovHalfFromHeight = Math.atan((this.FRAME_HEIGHT / 2) / this.camera.position.z);
    const vFovHalfRad = Math.max(vFovHalfFromWidth, vFovHalfFromHeight);

    let verticalFovDeg = THREE.MathUtils.radToDeg(2 * vFovHalfRad);
    verticalFovDeg = Math.max(28, Math.min(75, verticalFovDeg));

    this.camera.fov = verticalFovDeg;
    this.camera.updateProjectionMatrix();
    this.orbitControls.update();
}

    // Adjust where the floor line sits on screen (0–1) and reapply framing.
    setFloorScreenFraction(value) {
        this.floorScreenFraction = value;
        this.resize();
    }

    dispose() {
        window.removeEventListener('resize', this.resize);
    }
}