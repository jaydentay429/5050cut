/**
 * Three.js 场景：相机、灯光、地面、物体生成与切开。
 * WebGL 只出现在这一文件（以及它调用的 catalog / sliceFace）。
 */
import * as THREE from "three";
import { CONFIG } from "./config.js?v=110";
import {
  createMaterials,
  createPlaneCap,
  createWholeObject,
  disposeMaterials,
  objectExtents,
} from "./catalog.js?v=85";
import { fruitEnvMap, fruitStallMaps, isFruitType, worldBackdrop } from "./fruitAssets.js?v=123";
import { getItem } from "./worlds.js?v=102";
import { volumeShareFromObject } from "./meshVolume.js?v=75";
import { makeAwningTexture, makeThemeBoard, makeThemeGround, makeThemeWall } from "./sliceFace.js";

function disposeObject(root) {
  if (!root) return;
  const geos = new Set();
  const mats = new Set();
  root.traverse((node) => {
    if (!node.isMesh) return;
    if (node.geometry && !node.geometry.userData?.shared) geos.add(node.geometry);
    for (const mat of [].concat(node.material)) {
      if (!mat || mat.userData?.persist) continue;
      mats.add(mat);
    }
  });
  for (const geo of geos) geo.dispose();
  for (const mat of mats) {
    mat.envMap = null;
    mat.dispose();
  }
  root.parent?.remove(root);
}

function cutWalkMeshes(root, visit) {
  const proxies = [];
  const rest = [];
  root.traverse((node) => {
    if (!node.isMesh || !node.geometry?.attributes?.position) return;
    if (node.userData.cutProxy) proxies.push(node);
    else rest.push(node);
  });
  for (const node of proxies.length ? proxies : rest) visit(node);
}

function easeOut(t) {
  return 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
}

export function createScene(canvas) {
  const coarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !coarse,
    alpha: false,
    powerPreference: coarse ? "low-power" : "default",
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.localClippingEnabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(CONFIG.backgroundColor, 1);
  let gpuLost = false;
  canvas.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    gpuLost = true;
  });
  canvas.addEventListener("webglcontextrestored", () => {
    gpuLost = false;
  });

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
  let viewW = 1;
  let viewH = 1;
  camera.position.set(...CONFIG.scene.cameraPos);
  camera.lookAt(lookAt);
  scene.add(camera);

  const hemi = new THREE.HemisphereLight(
    CONFIG.scene.hemiSky,
    CONFIG.scene.hemiGround,
    CONFIG.scene.hemiIntensity,
  );
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(CONFIG.scene.sunColor, CONFIG.scene.sunIntensity);
  sun.position.set(...CONFIG.scene.sunPos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarse ? 512 : 1024, coarse ? 512 : 1024);
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

  const stallBackdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(16.5, 10.2),
    new THREE.MeshBasicMaterial({ color: "#c47840", depthWrite: false, fog: false, toneMapped: true }),
  );
  stallBackdrop.position.set(0, 0, -5.6);
  stallBackdrop.visible = false;
  stallBackdrop.renderOrder = -1000;
  stallBackdrop.frustumCulled = false;

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
    mango: "#f07818",
    peach: "#f090a0",
    kiwi: "#8a6a38",
    grape: "#6a38a0",
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

  function guideMat(color, opacity) {
    return new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
  }
  const cutGuide = new THREE.Group();
  const cutGuideHalo = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 2.2), guideMat("#140c08", 0.9));
  const cutGuideCore = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 2.2), guideMat("#ffe08a", 1));
  cutGuideHalo.renderOrder = 20;
  cutGuideCore.renderOrder = 21;
  cutGuide.add(cutGuideHalo, cutGuideCore);
  cutGuide.visible = false;
  scene.add(cutGuide);
  let stallPulse = 0;

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
    yaw: 0,
    pitch: 0,
    cutWorldNormal: null,
    seatY: 0,
    themeId: "fruit",
    viewScale: 1,
    playScale: 1,
  };

  function restHeight() {
    if (state.seatY) return state.seatY;
    if (!state.type) return 0;
    return objectExtents(state.type, state.length).height / 2;
  }

  const _spanSize = new THREE.Vector3();

  function worldExtentAlong(dir) {
    const root = state.whole || state.left || state.right;
    const n = dir?.lengthSq?.() ? dir.clone().normalize() : new THREE.Vector3(1, 0, 0);
    if (!root) return CONFIG.scene.fruitAppleLength ?? 0.68;
    root.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(root);
    box.getSize(_spanSize);
    return Math.max(
      0.16,
      Math.abs(n.x) * _spanSize.x + Math.abs(n.y) * _spanSize.y + Math.abs(n.z) * _spanSize.z,
    );
  }

  function computeSeatY(mesh) {
    mesh.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(mesh);
    return mesh.position.y + (0.018 - box.min.y);
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
    state.cutWorldNormal = null;
    state.yaw = 0;
    state.pitch = 0;
    state.seatY = 0;
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
    state.yaw = 0;
    state.pitch = 0;
    state.whole.position.z = 0;
    objectRoot.add(state.whole);
    state.whole.quaternion.identity();
    state.viewScale = 1;
    state.playScale = 1;
    const viewScale = viewItemScale();
    if (viewScale !== 1) state.whole.scale.multiplyScalar(viewScale);
    state.viewScale = viewScale;
    centerOnPivot(state.whole);
    state.whole.position.y = state.seatY + (state.inspect ? 0 : CONFIG.scene.dropHeight);
    dressing.visible = false;
    if (state.inspect) frameInspect();
    else centerOnItem();
  }

  function worldBoxCorners(root) {
    root.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(root);
    const min = box.min;
    const max = box.max;
    return [
      new THREE.Vector3(min.x, min.y, min.z),
      new THREE.Vector3(min.x, min.y, max.z),
      new THREE.Vector3(min.x, max.y, min.z),
      new THREE.Vector3(min.x, max.y, max.z),
      new THREE.Vector3(max.x, min.y, min.z),
      new THREE.Vector3(max.x, min.y, max.z),
      new THREE.Vector3(max.x, max.y, min.z),
      new THREE.Vector3(max.x, max.y, max.z),
    ];
  }

  function convexHull2(points) {
    const pts = points
      .map((p) => ({ x: p.x, y: p.y }))
      .sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
    if (pts.length < 3) return pts;
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lower = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper = [];
    for (let i = pts.length - 1; i >= 0; i -= 1) {
      const p = pts[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    lower.pop();
    upper.pop();
    return lower.concat(upper);
  }

  function meshCutCap(root, localN, d, material) {
    if (!root) return null;
    const n = localN.clone().normalize();
    const hits = [];
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const cutEdge = (p, q, dp, dq) => {
      if (dp * dq >= 0) return;
      const t = dp / (dp - dq);
      hits.push(p.clone().lerp(q, t));
    };
    root.updateWorldMatrix(true, true);
    cutWalkMeshes(root, (node) => {
      const pos = node.geometry.attributes.position;
      const idx = node.geometry.index;
      const toLocal = (out, i) => {
        out.fromBufferAttribute(pos, i);
        out.applyMatrix4(node.matrixWorld);
        out.applyMatrix4(inv);
      };
      const tri = (i0, i1, i2) => {
        toLocal(a, i0);
        toLocal(b, i1);
        toLocal(c, i2);
        const da = n.dot(a) - d;
        const db = n.dot(b) - d;
        const dc = n.dot(c) - d;
        if ((da > 0 && db > 0 && dc > 0) || (da < 0 && db < 0 && dc < 0)) return;
        cutEdge(a, b, da, db);
        cutEdge(b, c, db, dc);
        cutEdge(c, a, dc, da);
      };
      if (idx) {
        for (let i = 0; i < idx.count; i += 3) tri(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
      } else {
        for (let i = 0; i < pos.count; i += 3) tri(i, i + 1, i + 2);
      }
    });
    if (hits.length < 3) return null;
    const origin = n.clone().multiplyScalar(d);
    const tmp = Math.abs(n.y) < 0.92 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(n, tmp).normalize();
    const v = new THREE.Vector3().crossVectors(n, u).normalize();
    const uv = convexHull2(
      hits.map((p) => {
        const o = p.sub(origin);
        return { x: o.dot(u), y: o.dot(v) };
      }),
    );
    if (uv.length < 3) return null;
    const shape = new THREE.Shape();
    shape.moveTo(uv[0].x, uv[0].y);
    for (let i = 1; i < uv.length; i += 1) shape.lineTo(uv[i].x, uv[i].y);
    shape.closePath();
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n));
    mesh.position.copy(origin);
    const geo = mesh.geometry;
    const posAttr = geo.attributes.position;
    const uvAttr = geo.attributes.uv;
    if (posAttr && uvAttr) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < posAttr.count; i += 1) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      const cx = (minX + maxX) * 0.5;
      const cy = (minY + maxY) * 0.5;
      const r = Math.max(maxX - minX, maxY - minY, 1e-4) * 0.5;
      for (let i = 0; i < uvAttr.count; i += 1) {
        uvAttr.setXY(i, 0.5 + (posAttr.getX(i) - cx) / (2 * r), 0.5 + (posAttr.getY(i) - cy) / (2 * r));
      }
      uvAttr.needsUpdate = true;
    }
    return mesh;
  }

  function fruitSeatZ() {
    return state.inspect ? 0 : (CONFIG.scene.fruitZ ?? 0);
  }

  function viewItemScale() {
    const spec = CONFIG.scene;
    const aspect = Math.max(0.35, camera.aspect || 1);
    const vFov = (spec.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const refAspect = spec.itemScaleRefAspect ?? 0.78;
    const refHFov = 2 * Math.atan(Math.tan(vFov / 2) * refAspect);
    if (hFov >= refHFov) return 1;
    return Math.max(spec.portraitItemScaleMin ?? 0.74, hFov / refHFov);
  }

  function centerOnPivot(mesh) {
    if (!mesh) return;
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    const inv = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
    center.applyMatrix4(inv);
    for (const child of mesh.children) child.position.sub(center);
    mesh.updateWorldMatrix(true, true);
    const seated = new THREE.Box3().setFromObject(mesh);
    const halfH = Math.max(0.04, (seated.max.y - seated.min.y) / 2);
    const tableY = CONFIG.scene.tableY ?? 0.02;
    mesh.position.set(0, tableY + halfH, fruitSeatZ());
    state.seatY = mesh.position.y;
    state.halfH = halfH;
    state.holdPos = mesh.position.clone();
  }

  function rotateItem(dx, dy, fromPad = false) {
    if (!state.whole) return;
    const spec = CONFIG.orbit;
    const yaw = fromPad ? spec.padYawPerPx ?? spec.yawPerPx * 2.8 : spec.yawPerPx;
    const pitch = fromPad ? spec.padPitchPerPx ?? spec.pitchPerPx * 2.8 : spec.pitchPerPx;
    camera.updateMatrixWorld();
    const eyeX = new THREE.Vector3();
    const eyeY = new THREE.Vector3();
    const eyeZ = new THREE.Vector3();
    camera.matrixWorld.extractBasis(eyeX, eyeY, eyeZ);
    const pivot = state.holdPos || state.whole.position;
    const qY = new THREE.Quaternion().setFromAxisAngle(eyeY, dx * yaw);
    const qX = new THREE.Quaternion().setFromAxisAngle(eyeX, dy * pitch);
    state.whole.quaternion.premultiply(qY).premultiply(qX);
    state.whole.position.copy(pivot);
  }

  function layoutStallPlane() {
    const dist = 8.2;
    const vFov = (camera.fov * Math.PI) / 180;
    const viewH = 2 * Math.tan(vFov / 2) * dist;
    const viewW = viewH * Math.max(0.2, camera.aspect);
    const map = stallBackdrop.material.map;
    const imgAspect = map?.image ? map.image.width / Math.max(1, map.image.height) : 700 / 450;
    const theme = CONFIG.themes[state.themeId] || {};
    const cover = theme.stallCover ?? CONFIG.scene.stallCover ?? 1.2;
    let planeW = viewW * cover;
    let planeH = planeW / imgAspect;
    if (planeH < viewH * cover) {
      planeH = viewH * cover;
      planeW = planeH * imgAspect;
    }
    stallBackdrop.scale.set(planeW / 16.5, planeH / 10.2, 1);
    stallBackdrop.position.set(0, theme.stallLift ?? CONFIG.scene.stallLift ?? 0, -dist);
  }

  function lockPlayCamera() {
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    const target = state.holdPos || new THREE.Vector3(...CONFIG.scene.lookAt);
    lookAt.copy(target);
    lookAt.y -= CONFIG.scene.fruitScreenLift ?? 0.08;
    cameraHome.set(...CONFIG.scene.cameraPos);
    camera.position.copy(cameraHome);
    camera.lookAt(lookAt);
    layoutStallPlane();
  }

  function centerOnItem() {
    lockPlayCamera();
  }

  function cloneWithClip(source, plane) {
    const clone = source.clone(true);
    clone.traverse((node) => {
      if (!node.isMesh) return;
      if (node.userData.cutProxy) {
        node.visible = false;
        return;
      }
      const wrap = (mat) => {
        const copy = mat.clone();
        copy.clippingPlanes = [plane];
        copy.clipShadows = false;
        copy.side = THREE.FrontSide;
        copy.userData = { ...(copy.userData || {}), spawnClone: true, persist: false };
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

  function split(cut, perfect = false, fatal = false, milestone = false, shares = null) {
    if (!state.type || !state.whole) return;
    const normal = new THREE.Vector3(cut.nx, cut.ny, cut.nz).normalize();
    const point = new THREE.Vector3(cut.point.x, cut.point.y, cut.point.z);
    state.splitAxis = "plane";
    state.cutNormal = normal;
    state.cutPoint = point;
    state.whole.updateWorldMatrix(true, false);
    state.cutWorldNormal = normal.clone().transformDirection(state.whole.matrixWorld).normalize();
    state.clipNeg = new THREE.Plane();
    state.clipPos = new THREE.Plane();
    const left = cloneWithClip(state.whole, state.clipNeg);
    const right = cloneWithClip(state.whole, state.clipPos);
    const capMat = state.materials?.face;
    if (capMat) {
      let capL = null;
      try {
        capL = meshCutCap(state.whole, normal, cut.d, capMat);
      } catch {
        capL = null;
      }
      if (!capL && !getItem(state.type)?.model) {
        capL = createPlaneCap(state.type, state.length, normal, cut.d, capMat);
      }
      if (capL) {
        const capR = capL.clone(true);
        if (capR.geometry) capR.geometry = capL.geometry.clone();
        capL.position.addScaledVector(normal, -0.003);
        capR.position.addScaledVector(normal, 0.003);
        left.add(capL);
        right.add(capR);
      }
    }
    objectRoot.remove(state.whole);
    disposeObject(state.whole);
    state.whole = null;
    state.left = left;
    state.right = right;
    state.perfectSplit = perfect;
    state.fatalSplit = fatal;
    state.heroSplit = false;
    objectRoot.add(state.left, state.right);
    syncClipPlanes();
    state.shakeMag = perfect || fatal ? CONFIG.feedback.perfectShake : CONFIG.feedback.shake;
    state.shake = 1;
    state.hero = 0;
    strokeBlade.visible = false;
    burstDebris(cut.ratio ?? 0.5, perfect, fatal);
    showSliceFlash();
    kickHalves(perfect, fatal, shares, cut);
    setSplitProgress(0);
  }

  const FRUIT_DENSITY = {
    grape: 0.62,
    strawberry: 0.78,
    banana: 0.88,
    apple: 1,
    pear: 1.05,
    orange: 1.08,
    lemon: 1.1,
    peach: 1.02,
    mango: 1.12,
    kiwi: 1.04,
  };

  function kickHalves(perfect, fatal, shares) {
    if (!state.left || !state.right || !state.type) return;
    const base = state.holdPos || new THREE.Vector3(0, restHeight(), 0);
    const n = (state.cutWorldNormal || state.cutNormal || new THREE.Vector3(1, 0, 0)).clone().normalize();
    const along = n.clone();
    along.z *= 0.28;
    along.y = 0;
    if (along.lengthSq() < 0.04) along.set(n.x || 1, 0, 0);
    along.normalize();
    const extent = worldExtentAlong(along);
    const ref = CONFIG.scene.fruitAppleLength ?? 0.68;
    const sizeKick = Math.min(1.45, Math.max(0.62, extent / ref));
    const kick = perfect ? 1.06 : 1;
    const side = CONFIG.feedback.splitKick * kick * sizeKick;
    const leftMass = Math.max(0.22, shares?.leftShare ?? 0.5);
    const rightMass = Math.max(0.22, shares?.rightShare ?? 0.5);
    const dens = FRUIT_DENSITY[state.type] ?? 1;
    const massScale = (m) => 0.88 + 0.12 / Math.sqrt(Math.max(0.38, m));
    const gap = extent * (CONFIG.feedback.splitGapShare ?? 0.1);
    state.left.position.copy(base).addScaledVector(along, -gap);
    state.right.position.copy(base).addScaledVector(along, gap);
    const hinge = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), along);
    if (hinge.lengthSq() < 0.05) hinge.set(0, 0, 1);
    hinge.normalize();
    const open = 0.55;
    state.bodies = [
      {
        mesh: state.left,
        vx: -along.x * side * massScale(leftMass),
        vy: 0,
        vz: -along.z * side * massScale(leftMass) * 0.35,
        wx: -hinge.x * open,
        wy: -0.12,
        wz: -hinge.z * open,
        bounce: 0,
        thudded: true,
        mass: leftMass * dens,
      },
      {
        mesh: state.right,
        vx: along.x * side * massScale(rightMass),
        vy: 0,
        vz: along.z * side * massScale(rightMass) * 0.35,
        wx: hinge.x * open,
        wy: 0.12,
        wz: hinge.z * open,
        bounce: 0,
        thudded: true,
        mass: rightMass * dens,
      },
    ];
  }

  function updateBodies(dt) {
    if (!state.bodies) return;
    const holdY = state.holdPos?.y ?? restHeight();
    const fruitDamp = 1.8;
    for (const body of state.bodies) {
      body.mesh.position.x += body.vx * dt;
      body.mesh.position.y = holdY;
      body.mesh.position.z += body.vz * dt;
      body.mesh.rotation.x += body.wx * dt;
      body.mesh.rotation.y += body.wy * dt;
      body.mesh.rotation.z += body.wz * dt;
      body.vx *= Math.max(0, 1 - 0.42 * dt);
      body.vz *= Math.max(0, 1 - 0.42 * dt);
      body.wx *= Math.max(0, 1 - fruitDamp * dt);
      body.wy *= Math.max(0, 1 - 1.1 * dt);
      body.wz *= Math.max(0, 1 - fruitDamp * dt);
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
    const n = (state.cutWorldNormal || state.cutNormal || new THREE.Vector3(1, 0, 0)).clone().normalize();
    const boost = state.perfectSplit ? CONFIG.feedback.perfectSplitBoost : 1;
    const d = worldExtentAlong(n) * (CONFIG.feedback.splitGapShare ?? 0.1) * boost * t;
    const tilt = CONFIG.feedback.splitTilt * (state.fatalSplit ? 1.8 : 1) * t;
    const yaw = CONFIG.feedback.splitYaw * (state.perfectSplit ? 1.15 : 1) * t;
    const hy = restHeight();
    const drop = (state.fatalSplit ? 0.16 : 0.03) * t;
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
    const juice = isFruitType(state.type);
    const count = juice ? (perfect ? 36 : fatal ? 28 : 22) : perfect ? 28 : fatal ? 22 : 16;
    const color = DEBRIS_COLORS[state.type] || "#f3e6d0";
    debrisMat = new THREE.MeshPhysicalMaterial({
      color,
      roughness: juice ? 0.22 : 0.55,
      metalness: 0,
      clearcoat: juice ? 0.6 : 0,
      emissive: color,
      emissiveIntensity: juice ? 0.08 : 0.18,
    });
    for (let i = 0; i < count; i += 1) {
      const box = juice ? false : i % 3 !== 0;
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
      const spray = juice ? (i % 2 ? 1 : -1) * (0.55 + Math.random() * 1.1) : 0;
      const nrm = state.cutWorldNormal || state.cutNormal;
      debrisItems.push({
        mesh,
        vx: juice
          ? (nrm?.x || 1) * spray + (Math.random() - 0.5) * 0.35
          : (Math.random() - 0.5) * 2.4 + (nrm?.x || 0) * (Math.random() - 0.5),
        vy: juice ? 0.35 + Math.random() * 1.4 : 0.85 + Math.random() * 2.1,
        vz: juice
          ? (nrm?.z || 0) * spray + (Math.random() - 0.5) * 0.3
          : (Math.random() - 0.5) * 1.8,
        life: 0.75 + Math.random() * 0.7,
        age: 0,
        spin: (Math.random() - 0.5) * 12,
        size,
      });
    }
  }

  function showSliceFlash() {
    if (!state.type || !state.cutPoint || !state.cutNormal) return;
    const world = state.cutPoint.clone();
    const host = state.left || state.whole;
    if (host) {
      host.updateWorldMatrix(true, false);
      world.applyMatrix4(host.matrixWorld);
    } else {
      world.y += restHeight();
    }
    sliceFlash.position.copy(world);
    const flashN = state.cutWorldNormal || state.cutNormal;
    sliceFlash.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), flashN);
    const span = worldExtentAlong(flashN);
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
    const host = state.whole || state.left;
    if (!host || !state.type) return null;
    const corners = worldBoxCorners(host);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const point of corners) {
      point.project(camera);
      const sx = (point.x * 0.5 + 0.5) * width;
      const sy = (-point.y * 0.5 + 0.5) * height;
      minX = Math.min(minX, sx);
      maxX = Math.max(maxX, sx);
      minY = Math.min(minY, sy);
      maxY = Math.max(maxY, sy);
    }
    const pad = 18;
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

    const origin = camera.position;
    const worldD = normal.dot(origin);
    const host = state.whole;
    if (host) host.updateWorldMatrix(true, false);
    const offset = host ? host.position.clone() : new THREE.Vector3(0, restHeight(), 0);
    const localN = host
      ? normal.clone().transformDirection(new THREE.Matrix4().copy(host.matrixWorld).invert()).normalize()
      : normal.clone();
    const localD = host
      ? localN.dot(host.worldToLocal(origin.clone()))
      : worldD - normal.dot(offset);

    const corners = host ? worldBoxCorners(host) : null;
    if (corners) {
      let minDot = Infinity;
      let maxDot = -Infinity;
      for (const p of corners) {
        const v = normal.dot(p);
        minDot = Math.min(minDot, v);
        maxDot = Math.max(maxDot, v);
      }
      const pad = 0.05;
      if (worldD < minDot - pad || worldD > maxDot + pad) return { hit: false, reason: "miss" };
    } else {
      const ext = objectExtents(state.type, state.length);
      const hx = state.length / 2;
      const hh = ext.height / 2;
      const hd = ext.depth / 2;
      let minDot = Infinity;
      let maxDot = -Infinity;
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          for (const sz of [-1, 1]) {
            const v = localN.x * sx * hx + localN.y * sy * hh + localN.z * sz * hd;
            minDot = Math.min(minDot, v);
            maxDot = Math.max(maxDot, v);
          }
        }
      }
      if (localD < minDot || localD > maxDot) return { hit: false, reason: "miss" };
    }

    const point = localN.clone().multiplyScalar(localD);
    const worldHit = point.clone();
    if (host) worldHit.applyMatrix4(host.matrixWorld);
    else worldHit.y += restHeight();
    const toHit = worldHit.clone().sub(camera.position);
    if (rayA.dir.dot(toHit) < 0 && rayB.dir.dot(toHit) < 0) return { hit: false, reason: "miss" };

    const screen = worldHit.clone().project(camera);
    return {
      hit: true,
      axis: "plane",
      nx: localN.x,
      ny: localN.y,
      nz: localN.z,
      d: localD,
      point: { x: point.x, y: point.y, z: point.z },
      cutX: (screen.x * 0.5 + 0.5) * width,
      cutY: (-screen.y * 0.5 + 0.5) * height,
      start: { ...stroke.start },
      end: { ...stroke.end },
    };
  }

  function volumeShares(cut) {
    if (!state.whole || !cut) return null;
    return volumeShareFromObject(state.whole, cut.nx, cut.ny, cut.nz, cut.d);
  }

  function setStrokeBlade() {
    strokeBlade.visible = false;
  }

  function extentMidAlong(nx, ny, nz) {
    const host = state.whole;
    if (!host) return null;
    const nlen = Math.hypot(nx, ny, nz) || 1;
    nx /= nlen;
    ny /= nlen;
    nz /= nlen;
    host.updateWorldMatrix(true, true);
    const inv = new THREE.Matrix4().copy(host.matrixWorld).invert();
    const mat = new THREE.Matrix4();
    const v = new THREE.Vector3();
    let min = Infinity;
    let max = -Infinity;
    cutWalkMeshes(host, (node) => {
      const pos = node.geometry.attributes.position;
      mat.multiplyMatrices(inv, node.matrixWorld);
      for (let i = 0; i < pos.count; i += 1) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mat);
        const s = nx * v.x + ny * v.y + nz * v.z;
        if (s < min) min = s;
        if (s > max) max = s;
      }
    });
    if (!Number.isFinite(min) || !(max - min > 1e-8)) return null;
    return { d: (min + max) * 0.5, nx, ny, nz };
  }

  function getGuideScreen(width, height) {
    const host = state.whole;
    if (!host) return getCenterScreen(width, height);
    camera.updateMatrixWorld();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const forward = new THREE.Vector3();
    camera.matrixWorld.extractBasis(right, up, forward);
    const inv = new THREE.Matrix4().copy(host.matrixWorld).invert();
    const localN = right.clone().transformDirection(inv).normalize();
    const mid = extentMidAlong(localN.x, localN.y, localN.z);
    if (!mid) return getCenterScreen(width, height);
    const localPoint = new THREE.Vector3(mid.nx, mid.ny, mid.nz).multiplyScalar(mid.d);
    const world = localPoint.applyMatrix4(host.matrixWorld);
    const projected = world.clone().project(camera);
    const x = (projected.x * 0.5 + 0.5) * width;
    const y = (-projected.y * 0.5 + 0.5) * height;
    const box = getScreenBounds(width, height);
    return {
      x,
      y,
      y0: box ? box.y + 2 : Math.max(36, y - height * 0.22),
      y1: box ? box.y + box.height - 2 : Math.min(height - 72, y + height * 0.22),
    };
  }

  function getCenterScreen(width, height) {
    const world = (state.holdPos || state.whole?.position || new THREE.Vector3(0, restHeight(), 0)).clone().project(camera);
    return {
      x: (world.x * 0.5 + 0.5) * width,
      y: (-world.y * 0.5 + 0.5) * height,
    };
  }

  /** 转盘锚点：永远按桌上苹果的大小/高度，不跟当前物品包围盒走。 */
  function getOrbitAnchor(width, height) {
    camera.updateMatrixWorld();
    const apple = CONFIG.scene.fruitAppleLength ?? 0.68;
    const tableY = CONFIG.scene.tableY ?? 0.02;
    const center = new THREE.Vector3(0, tableY + apple * 0.5, fruitSeatZ());
    const camRight = new THREE.Vector3();
    camera.matrixWorld.extractBasis(camRight, new THREE.Vector3(), new THREE.Vector3());
    const edge = center.clone().addScaledVector(camRight, apple * 0.5);
    const c = center.clone().project(camera);
    const e = edge.clone().project(camera);
    return {
      x: (e.x * 0.5 + 0.5) * width,
      y: (-c.y * 0.5 + 0.5) * height,
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
    valance.position.set(0, 1.42, -3.15);
    dressing.add(valance);
    addBox(dressing, 7.6, 0.08, 0.12, "#5a2810", 0, 1.8, -3.12);

    for (const x of [-2.85, 2.85]) {
      addBox(dressing, 0.95, 0.55, 0.7, "#8a4a22", x, 0.28, -2.65, x > 0 ? -0.12 : 0.12);
      pileFruit(x, -2.65, 0.64);
    }
    addBox(dressing, 0.62, 0.38, 0.5, "#6e3a18", -1.7, 0.2, -2.85, 0.3);
    pileFruit(-1.7, -2.85, 0.48);
    addBox(dressing, 0.62, 0.38, 0.5, "#7a4620", 1.75, 0.2, -2.88, -0.28);
    pileFruit(1.75, -2.88, 0.48);

    for (let i = 0; i < 5; i += 1) {
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 8, 6),
        mat("#ffe6a0", { emissive: "#ffb040", emissiveIntensity: 0.85 }),
      );
      bulb.position.set(-1.6 + i * 0.8, 1.32, -3.02);
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

  function buildKitchenDressing() {
    addBox(dressing, 1.15, 0.08, 0.7, "#d8c0a0", -2.55, 0.08, -1.85, 0.2);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.28, 14), mat("#8a9098", { metalness: 0.45, roughness: 0.35 }));
    pot.position.set(-2.45, 0.28, -1.8);
    dressing.add(pot);
    addBox(dressing, 0.55, 0.42, 0.08, "#f4ead8", 2.55, 0.28, -1.65, -0.25);
    addBox(dressing, 0.18, 0.55, 0.18, "#c45a38", 2.85, 0.32, -1.45);
  }

  function buildNightDressing() {
    for (let i = 0; i < 5; i += 1) {
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 10, 8),
        mat("#ffb060", { emissive: "#ff8020", emissiveIntensity: 0.9 }),
      );
      lamp.position.set(-1.6 + i * 0.8, 1.15, -2.55);
      dressing.add(lamp);
    }
    addBox(dressing, 1.4, 0.55, 0.7, "#3a2460", -2.55, 0.32, -2.15, 0.15);
    addBox(dressing, 0.9, 0.7, 0.55, "#241838", 2.55, 0.4, -2.05, -0.2);
  }

  function buildToysDressing() {
    const colors = ["#e04848", "#3a8ae0", "#f0c430", "#48c070"];
    for (let i = 0; i < 4; i += 1) {
      addBox(dressing, 0.28, 0.28, 0.28, colors[i], -2.55 + i * 0.32, 0.18, -1.85, i * 0.1);
    }
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mat("#e84838"));
    ball.position.set(2.55, 0.2, -1.55);
    dressing.add(ball);
    addBox(dressing, 0.85, 0.45, 0.5, "#ffe08a", 2.7, 0.26, -2.15, -0.2);
  }

  function buildMineralDressing() {
    const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.42, 6), mat("#a8e0ff", { roughness: 0.22, metalness: 0.2 }));
    crystal.position.set(-2.55, 0.28, -2.05);
    dressing.add(crystal);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), mat("#c01838", { roughness: 0.2 }));
    gem.position.set(-2.15, 0.22, -1.75);
    dressing.add(gem);
    addBox(dressing, 0.7, 0.18, 0.28, "#e0b020", 2.45, 0.14, -1.65, 0.3);
    addBox(dressing, 8.2, 0.06, 0.08, "#6a7080", 0, 0.08, -3.05);
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
    } else if (themeId === "candy" || themeId === "toys") {
      wall.scale.set(1.18, 0.92, 1);
      wall.position.set(0, 1.15, -5.2);
    } else if (themeId === "mineral" || themeId === "night") {
      wall.scale.set(1.2, 0.9, 1);
      wall.position.set(0, 1.08, -5.2);
    } else {
      wall.scale.set(1.12, 0.84, 1);
      wall.position.set(0, 1.05, -5.15);
    }
  }

  function setTheme(themeId) {
    const theme = CONFIG.themes[themeId] || CONFIG.themes.fruit;
    const photo = worldBackdrop(themeId);
    const same = state.themeId === themeId && stallBackdrop.material.map === photo;
    state.themeId = themeId;
    if (same) {
      layoutStallPlane();
      return;
    }
    const maps = fruitStallMaps();
    renderer.setClearColor(theme.clear, 1);
    hemi.color.set(theme.hemiSky);
    hemi.groundColor.set(theme.hemiGround);
    scene.fog.color.set(theme.fog);

    stallBackdrop.visible = Boolean(photo);
    if (stallBackdrop.visible) {
      stallBackdrop.material.map = photo;
      stallBackdrop.material.color.set("#ffffff");
      stallBackdrop.material.needsUpdate = true;
      if (!stallBackdrop.parent) camera.add(stallBackdrop);
      layoutStallPlane();
    } else if (stallBackdrop.parent) {
      stallBackdrop.parent.remove(stallBackdrop);
    }
    wall.visible = !photo;
    ground.visible = !photo;
    board.visible = !photo;
    if (maps.env) {
      scene.environment = maps.env;
      if (scene.background?.isColor) scene.background.set(photo ? "#1a100c" : theme.clear);
      else scene.background = new THREE.Color(photo ? "#1a100c" : theme.clear);
      scene.fog.near = 28;
      scene.fog.far = 90;
    } else {
      if (scene.background?.isColor) scene.background.set(theme.clear);
      else scene.background = new THREE.Color(theme.clear);
      scene.fog.near = CONFIG.scene.fogNear;
      scene.fog.far = CONFIG.scene.fogFar;
    }

    dressing.visible = false;
    spot.color.set("#ffd8a8");
    rim.color.set("#ffb070");
    lockPlayCamera();
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

  function frameInspect() {
    lockPlayCamera();
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
    viewW = width;
    viewH = height;
    const pixelRatio = Math.min(dpr, CONFIG.scene.maxPixelRatio);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
    if (state.inspect) frameInspect();
    else centerOnItem();
    if (state.whole) {
      const next = viewItemScale();
      const prev = state.viewScale || 1;
      if (Math.abs(next - prev) > 0.01) {
        state.whole.scale.multiplyScalar(next / prev);
        state.viewScale = next;
        centerOnPivot(state.whole);
      }
    }
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
      const hold = state.holdPos;
      state.whole.position.x = hold?.x ?? 0;
      state.whole.position.z = hold?.z ?? fruitSeatZ();
      state.whole.position.y =
        state.seatY + CONFIG.scene.dropHeight * (1 - bounce) + overshoot;
    } else if (state.whole) {
      const hold = state.holdPos;
      state.whole.position.set(
        hold?.x ?? 0,
        state.seatY + (state.inspect ? 0 : 0),
        hold?.z ?? fruitSeatZ(),
      );
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
    if (stallPulse > 0) {
      stallPulse = Math.max(0, stallPulse - dt * 1.7);
      spot.intensity = 1.15 + stallPulse * 2.6;
    } else {
      spot.intensity = 1.15;
    }
    if (cutGuide.visible) cutGuide.visible = false;
  }

  function layoutCutGuide() {
    const pos = state.holdPos || lookAt;
    cutGuide.position.copy(pos);
    camera.updateMatrixWorld();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const forward = new THREE.Vector3();
    camera.matrixWorld.extractBasis(right, up, forward);
    cutGuide.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), right);
    const span = Math.max(0.9, (state.halfH || 0.34) * 3.35);
    const thick = Math.max(0.85, Math.min(1.35, (state.halfH || 0.34) / 0.34));
    cutGuide.scale.set(thick, span / 2.2, 1);
  }

  function setCutGuide(on) {
    cutGuide.visible = false;
    state.cutGuide = Boolean(on);
  }

  function flashStall() {
    stallPulse = 1;
  }

  function setInspect(on) {
    state.inspect = Boolean(on);
    dressing.visible = false;
    const photo = worldBackdrop(state.themeId);
    stallBackdrop.visible = Boolean(photo);
    if (stallBackdrop.visible) {
      stallBackdrop.material.map = photo;
      camera.add(stallBackdrop);
      layoutStallPlane();
    } else if (stallBackdrop.parent) {
      stallBackdrop.parent.remove(stallBackdrop);
    }
    frameInspect();
  }

  function setShowcase(on) {
    state.showcase = Boolean(on);
  }

  function render() {
    const heroPos = new THREE.Vector3(...CONFIG.scene.heroPos);
    const base = cameraHome.clone().lerp(heroPos, easeOut(state.hero) * 0.85);
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
    if (gpuLost || renderer.getContext()?.isContextLost?.()) return;
    renderer.render(scene, camera);
  }

  function setEnvironment() {
    const env = fruitEnvMap();
    if (env) {
      scene.environment = env;
      renderer.toneMappingExposure = 1.08;
    }
    setTheme(state.themeId || "fruit");
  }

  setTheme("fruit");

  return {
    spawn,
    split,
    setSplitProgress,
    clearObject,
    getScreenBounds,
    evaluateScreenCut,
    volumeShares,
    setStrokeBlade,
    getCenterScreen,
    getGuideScreen,
    getOrbitAnchor,
    setHeat,
    setCutGuide,
    flashStall,
    setTheme,
    setShowcase,
    setInspect,
    setEnvironment,
    rotateItem,
    consumeThud,
    resize,
    update,
    render,
    renderer,
  };
}
