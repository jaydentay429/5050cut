/**
 * Three.js 场景：相机、灯光、地面、物体生成与切开。
 * WebGL 只出现在这一文件（以及它调用的 catalog / sliceFace）。
 */
import * as THREE from "three";
import { CONFIG } from "./config.js";
import {
  createMaterials,
  createPlaneCap,
  createWholeObject,
  disposeMaterials,
  objectExtents,
} from "./catalog.js";
import { makeAwningTexture, makeThemeBoard, makeThemeGround, makeThemeWall } from "./sliceFace.js";

function disposeObject(root) {
  if (!root) return;
  root.traverse((node) => {
    if (node.geometry) node.geometry.dispose();
  });
  root.parent?.remove(root);
}

function easeOut(t) {
  return 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(CONFIG.backgroundColor, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.backgroundColor);
  scene.fog = new THREE.Fog(CONFIG.backgroundColor, CONFIG.scene.fogNear, CONFIG.scene.fogFar);

  const camera = new THREE.PerspectiveCamera(
    CONFIG.scene.fov,
    1,
    CONFIG.scene.near,
    CONFIG.scene.far,
  );
  const lookAt = new THREE.Vector3(...CONFIG.scene.lookAt);
  const cameraHome = new THREE.Vector3();
  camera.position.set(...CONFIG.scene.cameraPos);
  camera.lookAt(lookAt);

  const hemi = new THREE.HemisphereLight(
    CONFIG.scene.hemiSky,
    CONFIG.scene.hemiGround,
    CONFIG.scene.hemiIntensity,
  );
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(CONFIG.scene.sunColor, CONFIG.scene.sunIntensity);
  sun.position.set(...CONFIG.scene.sunPos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 22;
  sun.shadow.camera.left = -5;
  sun.shadow.camera.right = 5;
  sun.shadow.camera.top = 5;
  sun.shadow.camera.bottom = -5;
  sun.shadow.bias = -0.0008;
  sun.target.position.set(0, 0, 0);
  scene.add(sun.target);
  scene.add(sun);

  const spot = new THREE.SpotLight("#fff6e0", 1.15, 14, 0.58, 0.45, 1);
  spot.position.set(0.2, 5.4, 3.4);
  spot.target.position.set(0, 0.2, 0);
  scene.add(spot);
  scene.add(spot.target);

  const rim = new THREE.DirectionalLight("#ffd8b0", 0.35);
  rim.position.set(3.4, 1.4, -2.2);
  scene.add(rim);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({
      color: "#ffffff",
      roughness: 1,
      metalness: 0,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.001;
  ground.receiveShadow = true;
  scene.add(ground);
  let groundMap = null;

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 6.2),
    new THREE.MeshStandardMaterial({
      color: "#ffffff",
      roughness: 0.92,
      metalness: 0,
    }),
  );
  wall.position.set(0, 1.35, -5.2);
  wall.receiveShadow = true;
  scene.add(wall);
  let wallMap = null;

  const dressing = new THREE.Group();
  scene.add(dressing);

  let boardMap = makeThemeBoard("fruit");
  const [bw, bh, bd] = CONFIG.scene.boardSize;
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(bw, bh, bd),
    new THREE.MeshStandardMaterial({
      map: boardMap,
      roughness: 0.86,
      metalness: 0,
    }),
  );
  board.position.y = -bh / 2;
  board.receiveShadow = true;
  board.castShadow = true;
  scene.add(board);

  const strokeBlade = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.04, 1),
    new THREE.MeshStandardMaterial({
      color: "#f3e6d0",
      emissive: "#8a5a28",
      emissiveIntensity: 0.45,
      metalness: 0.4,
      roughness: 0.35,
    }),
  );
  strokeBlade.visible = false;
  scene.add(strokeBlade);

  const objectRoot = new THREE.Group();
  scene.add(objectRoot);

  const debrisRoot = new THREE.Group();
  scene.add(debrisRoot);
  const debrisGeo = new THREE.SphereGeometry(0.04, 6, 5);
  const debrisBoxGeo = new THREE.BoxGeometry(0.07, 0.045, 0.055);
  const debrisItems = [];
  let debrisMat = null;

  const DEBRIS_COLORS = {
    wood: "#c49a62",
    apple: "#d43a32",
    pear: "#c8d46a",
    orange: "#e07028",
    banana: "#f7e7a0",
    strawberry: "#e04050",
    lemon: "#ffe36a",
    rose: "#d04058",
    tulip: "#e06828",
    daisy: "#ffe56a",
    pencil: "#e0a028",
    eraser: "#e890a4",
    crayon: "#4a78e8",
    ruler: "#e8d4a8",
  };

  const sliceFlash = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: "#fff4d6",
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  sliceFlash.rotation.y = Math.PI / 2;
  sliceFlash.visible = false;
  scene.add(sliceFlash);

  const state = {
    type: null,
    length: 0,
    materials: null,
    whole: null,
    left: null,
    right: null,
    dropT: 1,
    shake: 0,
    shakeMag: 0,
    fatalSplit: false,
    perfectSplit: false,
    heroSplit: false,
    clock: 0,
    hero: 0,
    flash: 0,
    showcase: true,
    inspect: false,
    bodies: null,
    thud: false,
    splitAxis: "plane",
    cutNormal: null,
    cutPoint: null,
    clipPos: null,
    clipNeg: null,
  };

  function restHeight() {
    if (!state.type) return 0;
    return objectExtents(state.type, state.length).height / 2;
  }

  function clearObject() {
    disposeObject(state.whole);
    disposeObject(state.left);
    disposeObject(state.right);
    disposeMaterials(state.materials);
    state.whole = null;
    state.left = null;
    state.right = null;
    state.materials = null;
    state.type = null;
    state.perfectSplit = false;
    state.fatalSplit = false;
    state.heroSplit = false;
    state.hero = 0;
    state.flash = 0;
    state.bodies = null;
    state.thud = false;
    state.splitAxis = "plane";
    state.cutNormal = null;
    state.cutPoint = null;
    state.clipPos = null;
    state.clipNeg = null;
    sliceFlash.visible = false;
    strokeBlade.visible = false;
    clearDebris();
  }

  function spawn(type, length) {
    clearObject();
    state.type = type;
    state.length = length;
    state.materials = createMaterials(type);
    state.whole = createWholeObject(type, length, state.materials);
    state.dropT = state.inspect ? 1 : 0;
    state.hero = 0;
    state.whole.position.y = restHeight() + (state.inspect ? 0.08 : CONFIG.scene.dropHeight);
    state.whole.position.z = state.inspect ? 1.05 : 0;
    objectRoot.add(state.whole);
  }

  function cloneWithClip(source, plane) {
    const clone = source.clone(true);
    clone.traverse((node) => {
      if (!node.isMesh) return;
      const wrap = (mat) => {
        const copy = mat.clone();
        copy.clippingPlanes = [plane];
        copy.clipShadows = true;
        return copy;
      };
      node.material = Array.isArray(node.material) ? node.material.map(wrap) : wrap(node.material);
    });
    return clone;
  }

  function syncClipPlanes() {
    if (!state.left || !state.right || !state.cutNormal || !state.cutPoint) return;
    const localN = state.cutNormal;
    const localP = state.cutPoint;
    if (state.clipNeg) {
      state.left.updateWorldMatrix(true, false);
      const p = localP.clone().applyMatrix4(state.left.matrixWorld);
      const n = localN.clone().negate().transformDirection(state.left.matrixWorld).normalize();
      state.clipNeg.setFromNormalAndCoplanarPoint(n, p);
    }
    if (state.clipPos) {
      state.right.updateWorldMatrix(true, false);
      const p = localP.clone().applyMatrix4(state.right.matrixWorld);
      const n = localN.clone().transformDirection(state.right.matrixWorld).normalize();
      state.clipPos.setFromNormalAndCoplanarPoint(n, p);
    }
  }

  function split(cut, perfect = false, fatal = false, milestone = false) {
    if (!state.type || !state.whole) return;
    const normal = new THREE.Vector3(cut.nx, cut.ny, cut.nz).normalize();
    const point = new THREE.Vector3(cut.point.x, cut.point.y, cut.point.z);
    state.splitAxis = "plane";
    state.cutNormal = normal;
    state.cutPoint = point;
    state.clipNeg = new THREE.Plane();
    state.clipPos = new THREE.Plane();
    const left = cloneWithClip(state.whole, state.clipNeg);
    const right = cloneWithClip(state.whole, state.clipPos);
    const capMat = state.materials?.face;
    if (capMat) {
      const capL = createPlaneCap(state.type, state.length, normal, cut.d, capMat);
      const capR = capL.clone(true);
      capL.position.addScaledVector(normal, -0.003);
      capR.position.addScaledVector(normal, 0.003);
      left.add(capL);
      right.add(capR);
    }
    objectRoot.remove(state.whole);
    state.whole = null;
    state.left = left;
    state.right = right;
    state.perfectSplit = perfect;
    state.fatalSplit = fatal;
    state.heroSplit = perfect || milestone;
    objectRoot.add(state.left, state.right);
    syncClipPlanes();
    state.shakeMag = perfect || fatal ? CONFIG.feedback.perfectShake : CONFIG.feedback.shake;
    state.shake = 1;
    state.hero = 0;
    strokeBlade.visible = false;
    burstDebris(cut.ratio ?? 0.5, perfect, fatal);
    showSliceFlash();
    kickHalves(perfect, fatal);
    setSplitProgress(0);
  }

  function kickHalves(perfect, fatal) {
    if (!state.left || !state.right || !state.type) return;
    const hy = restHeight();
    state.left.position.set(0, hy, 0);
    state.right.position.set(0, hy, 0);
    const kick = perfect ? 1.22 : fatal ? 1.55 : 1;
    const pop = perfect ? 1.18 : fatal ? 0.92 : 0.78;
    const side = CONFIG.feedback.splitKick * kick;
    const up = CONFIG.feedback.splitPop * pop;
    const n = state.cutNormal || new THREE.Vector3(1, 0, 0);
    state.bodies = [
      {
        mesh: state.left,
        vx: -n.x * side,
        vy: up * (0.55 + Math.abs(n.y) * 0.45),
        vz: -n.z * side + (Math.random() - 0.5) * (fatal ? 0.7 : 0.28),
        wx: (Math.random() - 0.5) * 1.4 + n.z * 1.1,
        wy: fatal ? -1.8 : -0.65,
        wz: (Math.random() - 0.5) * 0.8 - n.x * 1.2,
        thudded: false,
      },
      {
        mesh: state.right,
        vx: n.x * side,
        vy: up * (0.9 + Math.abs(n.y) * 0.35),
        vz: n.z * side + (Math.random() - 0.5) * (fatal ? 0.7 : 0.28),
        wx: (Math.random() - 0.5) * 1.4 - n.z * 1.1,
        wy: fatal ? 1.8 : 0.65,
        wz: (Math.random() - 0.5) * 0.8 + n.x * 1.2,
        thudded: false,
      },
    ];
  }

  function updateBodies(dt) {
    if (!state.bodies) return;
    const floor = 0.055 + restHeight() * 0.22;
    const g = CONFIG.feedback.gravity;
    for (const body of state.bodies) {
      body.vy -= g * dt;
      body.mesh.position.x += body.vx * dt;
      body.mesh.position.y += body.vy * dt;
      body.mesh.position.z += body.vz * dt;
      body.mesh.rotation.x += body.wx * dt;
      body.mesh.rotation.y += body.wy * dt;
      body.mesh.rotation.z += body.wz * dt;
      body.vx *= Math.max(0, 1 - 0.42 * dt);
      body.vz *= Math.max(0, 1 - 0.42 * dt);
      body.wx *= Math.max(0, 1 - 1.15 * dt);
      body.wy *= Math.max(0, 1 - 0.85 * dt);
      body.wz *= Math.max(0, 1 - 0.95 * dt);
      if (body.mesh.position.y <= floor) {
        body.mesh.position.y = floor;
        if (body.vy < -0.6 && !body.thudded) {
          body.thudded = true;
          state.thud = true;
        }
        body.vy *= -CONFIG.feedback.bounce;
        body.vx *= 0.7;
        body.vz *= 0.7;
        body.wz *= 0.52;
        if (Math.abs(body.vy) < 0.32) body.vy = 0;
      }
    }
    syncClipPlanes();
  }

  function consumeThud() {
    const hit = state.thud;
    state.thud = false;
    return hit;
  }

  function setSplitProgress(t) {
    if (state.bodies) return;
    if (!state.left || !state.right) return;
    const boost = state.perfectSplit ? CONFIG.feedback.perfectSplitBoost : 1;
    const d = CONFIG.feedback.splitDistance * boost * t;
    const tilt = CONFIG.feedback.splitTilt * (state.fatalSplit ? 1.8 : 1) * t;
    const yaw = CONFIG.feedback.splitYaw * (state.perfectSplit ? 1.15 : 1) * t;
    const hy = restHeight();
    const drop = (state.fatalSplit ? 0.16 : 0.03) * t;
    const n = state.cutNormal || new THREE.Vector3(1, 0, 0);
    state.left.position.set(-n.x * d, hy - n.y * d * 0.55 - drop, -n.z * d);
    state.right.position.set(n.x * d, hy + n.y * d * 0.55 - drop, n.z * d);
    state.left.rotation.z = tilt * n.x;
    state.right.rotation.z = -tilt * n.x;
    state.left.rotation.x = -tilt * n.y;
    state.right.rotation.x = tilt * n.y;
    state.left.rotation.y = yaw;
    state.right.rotation.y = -yaw;
    syncClipPlanes();
  }

  function clearDebris() {
    for (const item of debrisItems) {
      debrisRoot.remove(item.mesh);
    }
    debrisItems.length = 0;
    debrisMat?.dispose();
    debrisMat = null;
  }

  function burstDebris(ratio, perfect, fatal) {
    clearDebris();
    if (!state.type) return;
    const ext = objectExtents(state.type, state.length);
    const cutX = state.cutPoint ? state.cutPoint.x : 0;
    const cutY = restHeight() + (state.cutPoint ? state.cutPoint.y : 0);
    const count = perfect ? 28 : fatal ? 22 : 16;
    const color = DEBRIS_COLORS[state.type] || "#f3e6d0";
    debrisMat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      emissive: color,
      emissiveIntensity: 0.18,
    });
    for (let i = 0; i < count; i += 1) {
      const box = i % 3 !== 0;
      const mesh = new THREE.Mesh(box ? debrisBoxGeo : debrisGeo, debrisMat);
      const size = 0.55 + Math.random() * 1.25;
      mesh.scale.setScalar(size);
      mesh.position.set(
        cutX + (Math.random() - 0.5) * 0.12,
        cutY + (Math.random() - 0.5) * ext.height * 0.35,
        (Math.random() - 0.5) * ext.depth * 0.5,
      );
      mesh.castShadow = true;
      debrisRoot.add(mesh);
      debrisItems.push({
        mesh,
        vx: (Math.random() - 0.5) * 2.4,
        vy: 0.85 + Math.random() * 2.1,
        vz: (Math.random() - 0.5) * 1.8,
        life: 0.75 + Math.random() * 0.7,
        age: 0,
        spin: (Math.random() - 0.5) * 12,
        size,
      });
    }
  }

  function showSliceFlash() {
    if (!state.type || !state.cutPoint || !state.cutNormal) return;
    const ext = objectExtents(state.type, state.length);
    const world = state.cutPoint.clone();
    world.y += restHeight();
    sliceFlash.position.copy(world);
    sliceFlash.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), state.cutNormal);
    const span = Math.max(0.28, Math.min(ext.length, ext.height, ext.depth) * 0.9);
    sliceFlash.scale.set(span, span, 1);
    sliceFlash.visible = true;
    state.flash = 1;
  }

  function updateDebris(dt) {
    for (const item of debrisItems) {
      item.age += dt;
      item.vy -= 6.8 * dt;
      item.mesh.position.x += item.vx * dt;
      item.mesh.position.y += item.vy * dt;
      item.mesh.position.z += item.vz * dt;
      item.mesh.rotation.z += item.spin * dt;
      if (item.mesh.position.y < 0.03) {
        item.mesh.position.y = 0.03;
        item.vy *= -0.22;
        item.vx *= 0.72;
        item.vz *= 0.72;
      }
      const remain = Math.max(0, 1 - item.age / item.life);
      item.mesh.scale.setScalar(item.size * remain);
    }
    for (let i = debrisItems.length - 1; i >= 0; i -= 1) {
      if (debrisItems[i].age >= debrisItems[i].life) {
        debrisRoot.remove(debrisItems[i].mesh);
        debrisItems.splice(i, 1);
      }
    }
    if (!debrisItems.length && debrisMat) {
      debrisMat.dispose();
      debrisMat = null;
    }
  }

  function getScreenBounds(width, height) {
    if (!state.type) return null;
    const ext = objectExtents(state.type, state.length);
    const hy = ext.height / 2;
    const points = [
      new THREE.Vector3(-ext.length / 2, hy, 0),
      new THREE.Vector3(ext.length / 2, hy, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, ext.height, 0),
      new THREE.Vector3(0, hy, -ext.depth / 2),
      new THREE.Vector3(0, hy, ext.depth / 2),
    ];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const world = new THREE.Vector3();
    for (const point of points) {
      world.copy(point).project(camera);
      const sx = (world.x * 0.5 + 0.5) * width;
      const sy = (-world.y * 0.5 + 0.5) * height;
      minX = Math.min(minX, sx);
      maxX = Math.max(maxX, sx);
      minY = Math.min(minY, sy);
      maxY = Math.max(maxY, sy);
    }
    const pad = 6;
    return {
      x: minX - pad,
      y: minY - pad,
      width: Math.max(8, maxX - minX + pad * 2),
      height: Math.max(8, maxY - minY + pad * 2),
    };
  }

  const raycaster = new THREE.Raycaster();

  function screenToRay(point, width, height) {
    const ndc = new THREE.Vector2((point.x / width) * 2 - 1, -(point.y / height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return {
      origin: raycaster.ray.origin.clone(),
      dir: raycaster.ray.direction.clone(),
    };
  }

  function evaluateScreenCut(stroke, width, height) {
    if (!state.type || !stroke) return { hit: false, reason: "invalid" };

    const dx = stroke.end.x - stroke.start.x;
    const dy = stroke.end.y - stroke.start.y;
    const length = Math.hypot(dx, dy);
    if (length < CONFIG.cut.minStrokeLength) return { hit: false, reason: "too_short" };

    const rayA = screenToRay(stroke.start, width, height);
    const rayB = screenToRay(stroke.end, width, height);
    const normal = new THREE.Vector3().crossVectors(rayA.dir, rayB.dir);
    if (normal.lengthSq() < 1e-8) return { hit: false, reason: "too_flat" };
    normal.normalize();
    if (Math.abs(normal.x) >= Math.abs(normal.y) ? normal.x < 0 : normal.y < 0) {
      normal.negate();
    }

    const hy = restHeight();
    const d = normal.dot(camera.position) - normal.y * hy;
    const ext = objectExtents(state.type, state.length);
    const hx = state.length / 2;
    const hh = ext.height / 2;
    const hd = ext.depth / 2;
    let minDot = Infinity;
    let maxDot = -Infinity;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const v = normal.x * sx * hx + normal.y * sy * hh + normal.z * sz * hd;
          minDot = Math.min(minDot, v);
          maxDot = Math.max(maxDot, v);
        }
      }
    }
    if (d < minDot || d > maxDot) return { hit: false, reason: "miss" };

    const point = normal.clone().multiplyScalar(d);
    const worldHit = point.clone();
    worldHit.y += hy;
    const toHit = worldHit.clone().sub(camera.position);
    if (rayA.dir.dot(toHit) < 0 && rayB.dir.dot(toHit) < 0) return { hit: false, reason: "miss" };

    const screen = worldHit.clone().project(camera);
    return {
      hit: true,
      axis: "plane",
      nx: normal.x,
      ny: normal.y,
      nz: normal.z,
      d,
      point: { x: point.x, y: point.y, z: point.z },
      cutX: (screen.x * 0.5 + 0.5) * width,
      cutY: (-screen.y * 0.5 + 0.5) * height,
      start: { ...stroke.start },
      end: { ...stroke.end },
    };
  }

  function setStrokeBlade(stroke, width, height) {
    if (!stroke) {
      strokeBlade.visible = false;
      return;
    }
    const rayA = screenToRay(stroke.start, width, height);
    const rayB = screenToRay(stroke.end, width, height);
    const hitZ0 = (ray) => {
      if (Math.abs(ray.dir.z) < 1e-4) return null;
      const t = -ray.origin.z / ray.dir.z;
      if (t < 0.05) return null;
      return ray.origin.clone().addScaledVector(ray.dir, t);
    };
    const p1 = hitZ0(rayA);
    const p2 = hitZ0(rayB);
    if (!p1 || !p2) {
      strokeBlade.visible = false;
      return;
    }
    const dir = p2.clone().sub(p1);
    const len = dir.length();
    if (len < 0.12) {
      strokeBlade.visible = false;
      return;
    }
    dir.multiplyScalar(1 / len);
    const mid = p1.clone().add(p2).multiplyScalar(0.5);
    mid.y = Math.max(restHeight() + 0.06, mid.y);
    strokeBlade.position.copy(mid);
    strokeBlade.scale.set(1, 1, len);
    strokeBlade.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    strokeBlade.visible = true;
  }

  function getCenterScreen(width, height) {
    const world = new THREE.Vector3(0, restHeight(), 0).project(camera);
    return {
      x: (world.x * 0.5 + 0.5) * width,
      y: (-world.y * 0.5 + 0.5) * height,
    };
  }

  function mat(color, extras = {}) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0, ...extras });
  }

  function addBox(parent, w, h, d, color, x, y, z, rotY = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function clearDressing() {
    const keep = [...dressing.children];
    for (const child of keep) disposeObject(child);
  }

  function pileFruit(x, z, y) {
    const colors = ["#d43a32", "#e07020", "#f0d040", "#6aaa38", "#c42838"];
    for (let i = 0; i < 5; i += 1) {
      const fruit = new THREE.Mesh(
        new THREE.SphereGeometry(0.13 + (i % 3) * 0.02, 10, 8),
        mat(colors[i]),
      );
      fruit.position.set(
        x + (i % 2) * 0.26 - 0.12,
        y + (i > 2 ? 0.16 : 0),
        z + Math.floor(i / 2) * 0.18 - 0.1,
      );
      fruit.castShadow = true;
      dressing.add(fruit);
    }
  }

  function buildFruitDressing() {
    const awningMap = makeAwningTexture();
    const valance = new THREE.Mesh(
      new THREE.PlaneGeometry(7.6, 0.72),
      new THREE.MeshStandardMaterial({
        map: awningMap,
        roughness: 0.82,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    );
    valance.position.set(0, 1.26, -2.72);
    dressing.add(valance);
    addBox(dressing, 7.6, 0.08, 0.12, "#5a2810", 0, 1.64, -2.7);

    for (const x of [-2.7, 2.7]) {
      addBox(dressing, 1.05, 0.62, 0.78, "#8a4a22", x, 0.31, -1.95, x > 0 ? -0.12 : 0.12);
      pileFruit(x, -1.95, 0.72);
    }
    addBox(dressing, 0.7, 0.42, 0.55, "#6e3a18", -1.55, 0.22, -2.45, 0.3);
    pileFruit(-1.55, -2.45, 0.52);
    addBox(dressing, 0.7, 0.42, 0.55, "#7a4620", 1.6, 0.22, -2.5, -0.28);
    pileFruit(1.6, -2.5, 0.52);

    for (let i = 0; i < 5; i += 1) {
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 8, 6),
        mat("#ffe6a0", { emissive: "#ffb040", emissiveIntensity: 0.85 }),
      );
      bulb.position.set(-1.6 + i * 0.8, 1.18, -2.58);
      dressing.add(bulb);
    }
  }

  function buildGardenDressing() {
    addBox(dressing, 8.4, 0.08, 0.08, "#f3efe4", 0, 0.52, -3.15);
    for (let i = -12; i <= 12; i += 1) {
      addBox(dressing, 0.07, 0.62, 0.05, "#f4f0e6", i * 0.32, 0.31, -3.15);
    }

    const bushMat = mat("#2f6a28");
    for (const [x, z, s] of [
      [-3.35, -3.55, 0.95],
      [-2.2, -3.95, 1.15],
      [2.45, -3.85, 1.05],
      [3.45, -3.25, 0.78],
      [-0.15, -4.15, 1.35],
    ]) {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), bushMat);
      bush.position.set(x, s * 0.32, z);
      bush.scale.set(s, s * 0.7, s);
      bush.castShadow = true;
      dressing.add(bush);
    }

    const bloomColors = ["#e85068", "#f0c430", "#fff8ee", "#e06828"];
    for (let i = 0; i < 10; i += 1) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.28, 6), mat("#2f6a28"));
      const x = -3.05 + (i % 5) * 1.5;
      const z = -2.05 - (i % 2) * 0.22;
      stem.position.set(x, 0.16, z);
      dressing.add(stem);
      const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), mat(bloomColors[i % 4]));
      bloom.position.set(x, 0.32, z);
      dressing.add(bloom);
    }

    addBox(dressing, 0.22, 0.38, 0.16, "#6aaa38", 2.85, 0.2, -1.55, 0.4);
    addBox(dressing, 0.28, 0.08, 0.2, "#4a7a32", 2.85, 0.42, -1.55, 0.4);
  }

  function buildDeskDressing() {
    const pane = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.35),
      mat("#9fd0f4", { emissive: "#7eb8e8", emissiveIntensity: 0.35 }),
    );
    pane.position.set(-1.15, 1.22, -5.12);
    dressing.add(pane);
    addBox(dressing, 2.55, 0.08, 0.08, "#f7f2e6", -1.15, 1.92, -5.08);
    addBox(dressing, 2.55, 0.08, 0.08, "#f7f2e6", -1.15, 0.52, -5.08);
    addBox(dressing, 0.08, 1.48, 0.08, "#f7f2e6", -2.35, 1.22, -5.08);
    addBox(dressing, 0.08, 1.48, 0.08, "#f7f2e6", 0.05, 1.22, -5.08);
    addBox(dressing, 0.06, 1.48, 0.06, "#f7f2e6", -1.15, 1.22, -5.08);

    addBox(dressing, 0.72, 1.15, 0.22, "#6a4a2a", -2.85, 0.58, -2.35, 0.18);
    addBox(dressing, 0.14, 0.95, 0.18, "#c43a32", -3.12, 0.52, -2.28, 0.18);
    addBox(dressing, 0.14, 0.82, 0.18, "#2a5a9a", -2.62, 0.46, -2.4, 0.18);
    addBox(dressing, 0.14, 0.7, 0.18, "#e0a028", -2.38, 0.4, -2.32, 0.18);

    addBox(dressing, 0.85, 0.02, 0.6, "#f7f1de", 2.55, 0.07, -1.55, -0.35);
    addBox(dressing, 0.18, 0.22, 0.18, "#c8a070", 2.95, 0.16, -1.15);
    for (let i = 0; i < 3; i += 1) {
      const pencil = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.28, 6),
        mat(["#e0a028", "#c43a32", "#2a5a9a"][i]),
      );
      pencil.position.set(2.9 + i * 0.05, 0.34, -1.15);
      pencil.rotation.z = -0.15 + i * 0.12;
      dressing.add(pencil);
    }

    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.26, 10, 1, true),
      mat("#f3e6d0", { side: THREE.DoubleSide, emissive: "#ffe8b0", emissiveIntensity: 0.4 }),
    );
    shade.position.set(2.28, 0.82, -1.42);
    shade.rotation.z = 0.28;
    dressing.add(shade);
    addBox(dressing, 0.05, 0.62, 0.05, "#c5ccd2", 2.35, 0.42, -1.4);
    addBox(dressing, 0.22, 0.04, 0.22, "#d8d0c4", 2.35, 0.1, -1.4);
  }

  function buildVegDressing() {
    addBox(dressing, 7.4, 0.12, 1.1, "#5a3a18", 0, 0.06, -2.55);
    const leaf = mat("#3a8a32");
    for (let i = 0; i < 8; i += 1) {
      const plant = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), leaf);
      plant.position.set(-2.8 + i * 0.8, 0.28, -2.45 - (i % 2) * 0.15);
      plant.scale.set(1, 0.7, 1);
      dressing.add(plant);
    }
    addBox(dressing, 0.38, 0.22, 0.55, "#8a8a90", 2.7, 0.16, -1.55, 0.4);
    addBox(dressing, 0.08, 0.42, 0.08, "#c5ccd2", 2.7, 0.42, -1.55);
  }

  function buildPastryDressing() {
    addBox(dressing, 1.1, 0.08, 1.1, "#f7f1de", -2.55, 0.72, -2.15);
    addBox(dressing, 0.12, 0.72, 0.12, "#d8c0a0", -2.9, 0.36, -1.85);
    addBox(dressing, 0.12, 0.72, 0.12, "#d8c0a0", -2.2, 0.36, -2.45);
    const cake = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 16), mat("#c45b6c"));
    cake.position.set(-2.55, 0.9, -2.15);
    dressing.add(cake);
    addBox(dressing, 0.95, 1.05, 0.55, "#6a4a2a", 2.65, 0.55, -2.05, -0.2);
    addBox(dressing, 0.7, 0.55, 0.08, "#ffb060", 2.65, 0.72, -1.74, -0.2);
    addBox(dressing, 0.55, 0.08, 0.4, "#f4ead8", 1.55, 0.08, -1.55, 0.3);
  }

  function buildCandyDressing() {
    const jars = ["#ff6a8a", "#70d0f0", "#ffe070"];
    for (let i = 0; i < 3; i += 1) {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.42, 12), mat(jars[i], { roughness: 0.35 }));
      jar.position.set(-2.6 + i * 0.55, 0.28, -2.15);
      dressing.add(jar);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12), mat("#fff8ee"));
      lid.position.set(-2.6 + i * 0.55, 0.5, -2.15);
      dressing.add(lid);
    }
    for (let i = 0; i < 4; i += 1) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 6), mat("#f4ead8"));
      stick.position.set(2.35 + i * 0.12, 0.22, -1.55);
      stick.rotation.z = 0.4;
      dressing.add(stick);
      const candy = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), mat(["#e04870", "#70d0f0", "#ffe070", "#c070f0"][i]));
      candy.position.set(2.42 + i * 0.12, 0.4, -1.55);
      dressing.add(candy);
    }
    addBox(dressing, 0.7, 0.08, 0.45, "#fff0f6", 2.55, 0.08, -1.55, -0.2);
  }

  function layoutWall(themeId) {
    if (themeId === "flower") {
      wall.scale.set(1.5, 0.28, 1);
      wall.position.set(0, 0.18, -6.6);
    } else if (themeId === "stationery") {
      wall.scale.set(1.15, 1.08, 1);
      wall.position.set(0, 2.05, -5.35);
    } else if (themeId === "veg") {
      wall.scale.set(1.4, 0.32, 1);
      wall.position.set(0, 0.22, -6.4);
    } else if (themeId === "candy") {
      wall.scale.set(1.18, 0.92, 1);
      wall.position.set(0, 1.15, -5.2);
    } else {
      wall.scale.set(1.12, 0.84, 1);
      wall.position.set(0, 1.05, -5.15);
    }
  }

  function setTheme(themeId) {
    const theme = CONFIG.themes[themeId] || CONFIG.themes.fruit;
    renderer.setClearColor(theme.clear, 1);
    scene.background.set(theme.clear);
    scene.fog.color.set(theme.fog);
    hemi.color.set(theme.hemiSky);
    hemi.groundColor.set(theme.hemiGround);
    if (boardMap) boardMap.dispose();
    boardMap = makeThemeBoard(themeId);
    board.material.map = boardMap;
    board.material.color.set(theme.board);
    board.material.roughness =
      themeId === "flower" ? 0.96 : themeId === "stationery" ? 0.74 : themeId === "candy" ? 0.62 : themeId === "pastry" ? 0.7 : 0.88;
    board.material.needsUpdate = true;
    if (wallMap) wallMap.dispose();
    wallMap = makeThemeWall(themeId);
    wall.material.map = wallMap;
    wall.material.color.set("#ffffff");
    wall.material.needsUpdate = true;
    layoutWall(themeId);
    if (groundMap) groundMap.dispose();
    groundMap = makeThemeGround(themeId);
    ground.material.map = groundMap;
    ground.material.color.set("#ffffff");
    ground.material.needsUpdate = true;
    clearDressing();
    if (themeId === "flower") buildGardenDressing();
    else if (themeId === "stationery") buildDeskDressing();
    else if (themeId === "veg") buildVegDressing();
    else if (themeId === "pastry") buildPastryDressing();
    else if (themeId === "candy") buildCandyDressing();
    else buildFruitDressing();
    spot.color.set(
      themeId === "flower" ? "#f4ffe8" : themeId === "stationery" ? "#fff4dc" : themeId === "candy" ? "#ffd0e8" : themeId === "veg" ? "#e8ffc8" : "#ffd8a8",
    );
    rim.color.set(
      themeId === "flower" ? "#b8e0ff" : themeId === "stationery" ? "#ffe8c8" : themeId === "candy" ? "#ffb0d0" : themeId === "veg" ? "#c8e090" : "#ffb070",
    );
  }

  const heatGlow = new THREE.Color().setHSL(0.06, 0.75, 0.42);

  function setHeat(combo) {
    if (!state.materials) return;
    const intensity = Math.min(0.18, Math.max(0, combo) * 0.022);
    for (const mat of [state.materials.side, state.materials.face, state.materials.outer]) {
      /** 深色/冷色物体（如茄子）直接叠加暖橙会糊成一片，先和材质自身颜色混一下，弱化色相冲突。 */
      mat.emissive.copy(mat.color).lerp(heatGlow, 0.25);
      mat.emissiveIntensity = intensity;
    }
  }

  function fitCamera() {
    const spec = CONFIG.scene;
    const dir = new THREE.Vector3(...spec.cameraPos).sub(lookAt).normalize();
    const vFov = (spec.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const distH = (spec.baseLength * 0.5 * spec.fitMargin) / Math.max(0.08, Math.tan(hFov / 2));
    const distV = (0.95 * spec.fitMargin) / Math.max(0.08, Math.tan(vFov / 2));
    const distDefault = new THREE.Vector3(...spec.cameraPos).distanceTo(lookAt);
    cameraHome.copy(lookAt).addScaledVector(dir, Math.max(distH, distV, distDefault));
    camera.position.copy(cameraHome);
    camera.lookAt(lookAt);
  }

  function resize(width, height, dpr) {
    const pixelRatio = Math.min(dpr, CONFIG.scene.maxPixelRatio);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    fitCamera();
  }

  function update(dt, extra = {}) {
    const slow = Boolean(extra.slowMo);
    const fxDt = slow ? dt * CONFIG.feedback.slowMoScale : dt;
    const bodyDt = slow ? dt * CONFIG.feedback.slowMoBody : dt;
    state.clock += dt;
    if (state.whole && state.dropT < 1) {
      state.dropT = Math.min(1, state.dropT + dt / CONFIG.scene.dropDuration);
      const bounce = easeOut(state.dropT);
      const overshoot = bounce > 0.85 ? Math.sin((bounce - 0.85) / 0.15 * Math.PI) * 0.04 : 0;
      state.whole.position.y =
        restHeight() + CONFIG.scene.dropHeight * (1 - bounce) + overshoot;
    } else if (state.whole) {
      state.whole.position.y = restHeight() + (state.inspect ? 0.08 : 0) + Math.sin(state.clock * 2.2) * 0.012;
      state.whole.position.z = state.inspect ? 1.05 : 0;
    }
    if (state.shake > 0) {
      state.shake = Math.max(0, state.shake - fxDt * 4.5);
    }
    if (state.heroSplit) {
      state.hero = Math.min(1, state.hero + fxDt * 1.7);
    } else {
      state.hero = Math.max(0, state.hero - dt * 2.4);
    }
    if (state.flash > 0) {
      state.flash = Math.max(0, state.flash - dt * 3.4);
      sliceFlash.material.opacity = state.flash * 0.82;
      if (state.flash <= 0) sliceFlash.visible = false;
    }
    updateDebris(bodyDt);
    updateBodies(bodyDt);
  }

  function setInspect(on) {
    state.inspect = Boolean(on);
    if (state.inspect) lookAt.set(0, -0.28, 0.35);
    else lookAt.set(...CONFIG.scene.lookAt);
    fitCamera();
  }

  function setShowcase(on) {
    state.showcase = Boolean(on);
  }

  function render() {
    const heroPos = new THREE.Vector3(...CONFIG.scene.heroPos);
    const base = cameraHome.clone().lerp(heroPos, easeOut(state.hero) * 0.85);
    if (state.showcase && state.shake <= 0) {
      base.x += Math.sin(state.clock * 0.32) * 0.26;
      base.y += Math.sin(state.clock * 0.48) * 0.08;
    }
    if (state.shake > 0) {
      const mag = state.shakeMag * state.shake;
      camera.position.set(
        base.x + (Math.random() - 0.5) * mag * 2,
        base.y + (Math.random() - 0.5) * mag,
        base.z + (Math.random() - 0.5) * mag,
      );
    } else {
      camera.position.copy(base);
    }
    camera.lookAt(lookAt);
    renderer.render(scene, camera);
  }

  setTheme("fruit");

  return {
    spawn,
    split,
    setSplitProgress,
    clearObject,
    getScreenBounds,
    evaluateScreenCut,
    setStrokeBlade,
    getCenterScreen,
    setHeat,
    setTheme,
    setShowcase,
    setInspect,
    consumeThud,
    resize,
    update,
    render,
  };
}
