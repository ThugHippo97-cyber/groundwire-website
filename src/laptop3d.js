import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { CSS3DRenderer, CSS3DObject } from "three/examples/jsm/renderers/CSS3DRenderer.js";

const MODEL_URL = "/models/groundwire-laptop.glb";
const SCREEN_NODE_NAME = "Display.002";

// Clamp range for the mouse-follow tilt — wide enough to feel alive, tight
// enough that the laptop never reads as spinning away from the hero pose.
const MAX_TILT_X = 0.1; // pitch, radians (~6deg)
const MAX_TILT_Y = 0.22; // yaw, radians (~13deg)
const REST_YAW = -0.06; // slight resting turn so it isn't perfectly head-on

export function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") || canvas.getContext("webgl"))
    );
  } catch {
    return false;
  }
}

/**
 * Boots the 3D hero laptop. Resolves once the model has loaded and the live
 * carousel has been mounted onto the screen; rejects (caller should fall
 * back to the SVG chassis) on any WebGL/load failure.
 */
export function initLaptop3D({ stage, canvas, css3dRoot, screenEl, loadingEl }) {
  return new Promise((resolve, reject) => {
    if (!supportsWebGL()) {
      reject(new Error("WebGL unavailable"));
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
    camera.position.set(0, 0.05, 3.4);
    camera.lookAt(0, -0.08, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // alpha:true only enables the canvas's alpha channel — the renderer still
    // clears to opaque black by default, which would hide the CSS3D layer
    // sitting underneath wherever nothing is drawn (i.e. the screen cutout).
    renderer.setClearColor(0x000000, 0);

    const cssRenderer = new CSS3DRenderer({ element: css3dRoot });

    const rig = new THREE.Group();
    scene.add(rig);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(1.5, 2.5, 2.5);
    scene.add(key);
    // Cyan rim/fill lights tie the model's lighting to the brand accent.
    const rim = new THREE.PointLight(0x00b7ff, 6, 8);
    rim.position.set(-1.6, 0.6, 1.2);
    scene.add(rim);
    const fill = new THREE.PointLight(0x00b7ff, 2, 8);
    fill.position.set(1.6, -0.6, 1.6);
    scene.add(fill);

    function resize() {
      const rect = stage.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      renderer.setSize(rect.width, rect.height);
      cssRenderer.setSize(rect.width, rect.height);
    }
    resize();
    window.addEventListener("resize", resize);

    const target = { x: 0, y: REST_YAW };
    const current = { x: 0, y: REST_YAW };

    function onMouseMove(event) {
      const rect = stage.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      target.x = THREE.MathUtils.clamp(-py * MAX_TILT_X, -MAX_TILT_X, MAX_TILT_X);
      target.y = THREE.MathUtils.clamp(REST_YAW + px * MAX_TILT_Y, -MAX_TILT_Y, MAX_TILT_Y);
    }
    function onMouseLeave() {
      target.x = 0;
      target.y = REST_YAW;
    }
    stage.addEventListener("mousemove", onMouseMove);
    stage.addEventListener("mouseleave", onMouseLeave);

    let stopped = false;
    function animate() {
      if (stopped) return;
      requestAnimationFrame(animate);
      current.x = THREE.MathUtils.damp(current.x, target.x, 6, 0.016);
      current.y = THREE.MathUtils.damp(current.y, target.y, 6, 0.016);
      rig.rotation.x = current.x;
      rig.rotation.y = current.y;
      renderer.render(scene, camera);
      cssRenderer.render(scene, camera);
    }

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    loader.load(
      MODEL_URL,
      (gltf) => {
        const model = gltf.scene;

        // Normalize scale/position so the model sits centered at a known size,
        // regardless of the units it was authored in.
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = 1.6 / maxDim;
        model.scale.setScalar(scale);
        model.position.sub(center.multiplyScalar(scale));
        rig.add(model);
        // Box3/getWorldQuaternion below read matrixWorld — force a fresh
        // propagation now, since nothing has rendered yet to do it for us.
        rig.updateMatrixWorld(true);

        // GLTFLoader renames objects whose node and mesh share the same
        // source name (common when a node has a single mesh) to avoid a
        // name collision — e.g. "Display.002" becomes "Display.002_1".
        // The original name survives in userData.name, so fall back to that.
        let screenMesh = model.getObjectByName(SCREEN_NODE_NAME);
        if (!screenMesh) {
          model.traverse((obj) => {
            if (!screenMesh && obj.userData?.name === SCREEN_NODE_NAME) {
              screenMesh = obj;
            }
          });
        }
        if (!screenMesh) {
          reject(new Error(`"${SCREEN_NODE_NAME}" node not found in model`));
          return;
        }

        // Keep the screen mesh in the depth buffer (so it still occludes
        // whatever geometry sits directly behind it — e.g. a lid backing
        // plate) but stop it from painting any color, leaving the pixel
        // transparent so the CSS3D carousel layer underneath shows through.
        screenMesh.material.colorWrite = false;

        const screenBox = new THREE.Box3().setFromObject(screenMesh);
        const screenSize = new THREE.Vector3();
        screenBox.getSize(screenSize);
        const screenCenter = new THREE.Vector3();
        screenBox.getCenter(screenCenter);

        const pxWidth = 1000;
        const pxHeight = Math.round((screenSize.y / screenSize.x) * pxWidth);
        screenEl.style.width = `${pxWidth}px`;
        screenEl.style.height = `${pxHeight}px`;

        // Screen backlight: a low-intensity cyan PointLight just in front of the
        // screen face. Illuminates the surrounding bezel and lid so the screen
        // reads as a self-lit monitor rather than a dark rectangle.
        const screenBacklight = new THREE.PointLight(0x00b7ff, 1.4, 2.2);
        screenBacklight.position.copy(screenCenter).add(new THREE.Vector3(0, 0, 0.18));
        scene.add(screenBacklight);

        const cssObject = new CSS3DObject(screenEl);
        const factor = pxWidth / screenSize.x;
        cssObject.scale.set(1 / factor, 1 / factor, 1 / factor);
        cssObject.position.copy(screenCenter);

        const screenQuat = new THREE.Quaternion();
        screenMesh.getWorldQuaternion(screenQuat);
        cssObject.quaternion.copy(screenQuat);

        screenEl.style.opacity = "0";
        screenEl.style.transition = "opacity 0.5s ease-out";
        rig.add(cssObject);

        loadingEl?.classList.add("hidden");
        animate();
        requestAnimationFrame(() => requestAnimationFrame(() => {
          screenEl.style.opacity = "1";
        }));
        resolve({ renderer, cssRenderer });
      },
      undefined,
      (err) => {
        window.removeEventListener("resize", resize);
        stage.removeEventListener("mousemove", onMouseMove);
        stage.removeEventListener("mouseleave", onMouseLeave);
        reject(err);
      }
    );
  });
}
