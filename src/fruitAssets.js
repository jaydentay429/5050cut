/**
 * 摊位模型 / 切开贴图 / HDRI。路径经 assetUrl，生产可走 CDN。
 */
import * as THREE from "three";
import { GLTFLoader } from "../vendor/GLTFLoader.js";
import { DRACOLoader } from "../vendor/DRACOLoader.js";
import { RGBELoader } from "../vendor/RGBELoader.js";
import { CONFIG } from "./config.js?v=110";
import { t } from "./i18n.js?v=143";
import { assetUrl } from "./assetUrl.js?v=92";
import { getItem, WORLD_BACKDROP, WORLDS } from "./worlds.js?v=102";

export const FRUIT_TYPES = [...WORLDS.fruit.objects];

const MODEL_CACHE = "v=37";
const MAX_LIVE_MODELS = 6;
const PROXY_TRIS = 5000;
const models = {};
const loading = {};
const slices = {};
const recency = [];
let envMap = null;
let stallMap = null;
let woodMap = null;
const worldMaps = {};
let gltfLoader = null;
let dracoLoader = null;
let gpuRenderer = null;
const warmedThemes = new Set();
let prefetchQueue = Promise.resolve();

export function prefetchTheme(themeId, extra = 0) {
  prefetchQueue = prefetchQueue.then(() => runPrefetch(themeId, extra)).catch(() => {});
  return prefetchQueue;
}

async function runPrefetch(themeId, extra = 0) {
  const types = [...(WORLDS[themeId]?.objects || [])];
  const cap = extra || 1;
  const jobs = types.filter((type) => getItem(type)?.model && !models[type] && !loading[type]).slice(0, cap);
  for (const type of jobs) await ensureFruitModel(type);
}

function isCoarse() {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches;
}

function ensureLoader() {
  if (gltfLoader) return gltfLoader;
  dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath("/vendor/draco/");
  dracoLoader.preload();
  gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);
  return gltfLoader;
}

export function isFruitType(type) {
  return FRUIT_TYPES.includes(type);
}

export function fruitRestSize(type) {
  return models[type]?.userData.restSize || null;
}

function saneAxis(n) {
  return Number.isFinite(n) && n > 1e-4 && n < 8 ? n : 1;
}

export function restMedian(size) {
  if (!size) return 0.05;
  const mid = [saneAxis(size.x), saneAxis(size.y), saneAxis(size.z)].sort((a, b) => a - b)[1];
  return Math.max(0.05, mid);
}

export function restLongest(size) {
  if (!size) return 0.05;
  return Math.max(0.05, saneAxis(size.x), saneAxis(size.y), saneAxis(size.z));
}

/** 对照苹果用中间边（粗细）；最长边超过上限就按上限收，避免细长物体撑满镜头。 */
export function fruitModelScale(type, length) {
  const size = fruitRestSize(type);
  if (!size) return 1;
  const appleWorld = CONFIG.scene.fruitAppleLength ?? 0.68;
  const lo = CONFIG.scene.fruitScaleMin ?? 0.3;
  const hi = CONFIG.scene.fruitScaleMax ?? 2.75;
  const rel = Math.min(hi, Math.max(lo, getItem(type).realScale ?? 1));
  const full = appleWorld * rel;
  const shrink = full > 1e-8 ? (length || full) / full : 1;
  const k = Math.max(0.25, shrink);
  const med = restMedian(size);
  const longest = restLongest(size);
  let scale = (full * k) / med;
  const cap = appleWorld * hi * k;
  if (longest * scale > cap) scale = cap / longest;
  return scale;
}

export function fruitRestSpan(type) {
  const rest = fruitRestSize(type);
  if (!rest) return null;
  return restMedian(rest);
}

export function fruitSliceMap(type) {
  return slices[type] || null;
}

export function fruitEnvMap() {
  return envMap;
}

export function fruitStallMaps() {
  return { env: envMap, stall: stallMap || worldMaps.fruit, wood: woodMap, worlds: worldMaps };
}

export function worldBackdrop(themeId) {
  return worldMaps[themeId] || worldMaps.fruit || stallMap;
}

function uploadTexture(map, backdrop = false) {
  if (!map) return;
  if (backdrop) {
    map.generateMipmaps = false;
    map.minFilter = THREE.LinearFilter;
    map.magFilter = THREE.LinearFilter;
  }
  gpuRenderer?.initTexture(map);
}

function uploadModelGpu(root) {
  if (!gpuRenderer || !root) return;
  root.traverse((node) => {
    if (!node.isMesh) return;
    for (const mat of [].concat(node.material)) {
      if (!mat) continue;
      if (mat.map) uploadTexture(mat.map);
      if (mat.normalMap) uploadTexture(mat.normalMap);
      if (mat.roughnessMap) uploadTexture(mat.roughnessMap);
      if (mat.metalnessMap) uploadTexture(mat.metalnessMap);
      if (mat.emissiveMap) uploadTexture(mat.emissiveMap);
      if (mat.aoMap) uploadTexture(mat.aoMap);
    }
  });
}

export function isModelReady(type) {
  return Boolean(models[type]);
}

export async function ensureFruitSlice(type) {
  const item = getItem(type);
  if (!item?.slice || item.flesh || slices[type]) return slices[type] || null;
  try {
    const map = await new THREE.TextureLoader().loadAsync(assetUrl(item.slice));
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = isCoarse() ? 1 : 4;
    uploadTexture(map);
    slices[type] = map;
  } catch (err) {
    console.warn("fruit slice failed", type, err);
  }
  return slices[type] || null;
}

export async function ensureFruitModel(type) {
  const item = getItem(type);
  if (!item?.model) return null;
  if (models[type]) {
    if (item.slice && !item.flesh && !slices[type]) ensureFruitSlice(type);
    return models[type];
  }
  if (!loading[type]) {
    ensureLoader();
    loading[type] = Promise.all([
      gltfLoader.loadAsync(`${assetUrl(item.model)}?${MODEL_CACHE}`),
      item.slice && !item.flesh ? ensureFruitSlice(type) : Promise.resolve(null),
    ])
      .then(([gltf]) => {
        models[type] = normalizeFruitRoot(gltf.scene, item);
        uploadModelGpu(models[type]);
        noteLoaded(type);
        return models[type];
      })
      .catch((err) => {
        console.warn("fruit model failed", type, err);
        delete loading[type];
        return null;
      });
  }
  return loading[type];
}

export async function ensureWorldBackdrop(themeId) {
  const id = themeId || "fruit";
  if (worldMaps[id] || (id === "fruit" && stallMap)) return worldMaps[id] || stallMap;
  const file = WORLD_BACKDROP[id];
  if (!file) return null;
  const texLoader = new THREE.TextureLoader();
  try {
    const map = await texLoader.loadAsync(assetUrl(file));
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 1;
    uploadTexture(map, true);
    worldMaps[id] = map;
    if (id === "fruit") stallMap = map;
    return map;
  } catch (err) {
    console.warn("world backdrop failed", id, err);
    return null;
  }
}

/** 后台并行预热，不挡住当前要切的那一件。 */
export function warmupModel(type) {
  if (!type || models[type] || loading[type]) return Promise.resolve(models[type] || null);
  return ensureFruitModel(type);
}

export async function warmupThemeModels(themeId) {
  if (!themeId || warmedThemes.has(themeId)) return;
  warmedThemes.add(themeId);
  await ensureWorldBackdrop(themeId);
  await prefetchTheme(themeId, 1);
}

export async function preloadFruitAssets(renderer, onProgress) {
  gpuRenderer = renderer || null;
  ensureLoader();
  onProgress?.({ ratio: 0.08, label: t("decoder") });
  await ensureWorldBackdrop("fruit");
  onProgress?.({ ratio: 0.35, label: t("stall") });

  const coarse = isCoarse();
  if (!coarse) {
    try {
      const hdr = await new RGBELoader().loadAsync(assetUrl("/assets/env/abandoned_greenhouse_1k.hdr"));
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      if (renderer) {
        const pmrem = new THREE.PMREMGenerator(renderer);
        envMap = pmrem.fromEquirectangular(hdr).texture;
        hdr.dispose();
        pmrem.dispose();
      } else {
        envMap = hdr;
      }
    } catch (err) {
      console.warn("fruit env failed", err);
    }
  }
  onProgress?.({ ratio: 0.55, label: t("lights") });
  try {
    woodMap = await new THREE.TextureLoader().loadAsync(assetUrl("/assets/env/wood_table_diff_1k.jpg"));
    woodMap.colorSpace = THREE.SRGBColorSpace;
    woodMap.wrapS = THREE.RepeatWrapping;
    woodMap.wrapT = THREE.RepeatWrapping;
    woodMap.repeat.set(2.2, 1.4);
    woodMap.anisotropy = coarse ? 1 : 4;
  } catch (err) {
    console.warn("wood board failed", err);
  }
  onProgress?.({ ratio: 0.75, label: t("table") });
  await ensureFruitModel("apple");
  onProgress?.({ ratio: 0.92, label: t("appleBoot") });
  if (woodMap) uploadTexture(woodMap);
}

export function cloneFruitModel(type, length) {
  const src = models[type];
  if (!src) return null;
  const clone = src.clone(true);
  clone.scale.setScalar(fruitModelScale(type, length));
  let shadowSlots = 0;
  clone.traverse((node) => {
    if (!node.isMesh) return;
    if (node.userData.cutProxy) {
      node.visible = false;
      node.castShadow = false;
      node.receiveShadow = false;
      return;
    }
    shadowSlots += 1;
    node.castShadow = shadowSlots <= 4;
    node.receiveShadow = shadowSlots <= 2;
    const mats = [].concat(node.material);
    const copies = mats.map((mat) => {
      const copy = mat.clone();
      copy.userData = { ...(copy.userData || {}), spawnClone: true };
      const item = getItem(type);
      if (envMap) {
        copy.envMap = envMap;
        copy.envMapIntensity = item.envIntensity ?? (type === "grape" ? 0.45 : type === "strawberry" ? 0.55 : type === "peach" ? 0.32 : 0.85);
        copy.needsUpdate = true;
      }
      if (item.retint) copy.color.set(item.retint);
      if (item.asset === "fallback") {
        copy.color.set("#ffffff");
        copy.bumpMap = copy.map;
        copy.bumpScale = ({ grape: 0.02, peach: 0.06, orange: 0.04, strawberry: 0.03, mango: 0.025 }[type] ?? 0.028);
        copy.roughness = ({ grape: 0.24, peach: 0.78, orange: 0.5, strawberry: 0.4, mango: 0.46 }[type] ?? 0.44);
        copy.side = THREE.DoubleSide;
        if (copy.clearcoat != null) {
          copy.clearcoat = ({ grape: 0.45, strawberry: 0.28, orange: 0.18, mango: 0.16, peach: 0.05 }[type] ?? 0.12);
          copy.clearcoatRoughness = type === "peach" ? 0.78 : type === "grape" ? 0.28 : 0.42;
        }
      }
      if (item.roughnessBoost) copy.roughness = Math.min(1, (copy.roughness ?? 0.5) + item.roughnessBoost);
      if (type === "kiwi") copy.roughness = Math.max(copy.roughness ?? 0.55, 0.78);
      return copy;
    });
    node.material = copies.length === 1 ? copies[0] : copies;
  });
  const item = getItem(type);
  if (item.visualSquash) clone.scale.y *= item.visualSquash;
  return clone;
}

export function disposeCachedModel(type) {
  const root = models[type];
  delete models[type];
  delete loading[type];
  const idx = recency.indexOf(type);
  if (idx >= 0) recency.splice(idx, 1);
  if (!root) return;
  const geos = new Set();
  const mats = new Set();
  root.traverse((node) => {
    if (!node.isMesh) return;
    if (node.geometry) geos.add(node.geometry);
    for (const mat of [].concat(node.material)) {
      if (mat) mats.add(mat);
    }
  });
  for (const geo of geos) geo.dispose();
  for (const mat of mats) {
    mat.envMap = null;
    mat.dispose();
  }
}

function pruneLiveModels(preferType) {
  const types = Object.keys(models);
  if (types.length <= MAX_LIVE_MODELS) return;
  const drop = types.filter((t) => t !== "apple" && t !== preferType);
  drop.sort((a, b) => recency.indexOf(a) - recency.indexOf(b));
  while (Object.keys(models).length > MAX_LIVE_MODELS && drop.length) {
    disposeCachedModel(drop.shift());
  }
}

function noteLoaded(type) {
  const i = recency.indexOf(type);
  if (i >= 0) recency.splice(i, 1);
  recency.push(type);
  pruneLiveModels(type);
}

export function retainPlayModels(currentThemeId, nextThemeId, holdingType) {
  const allow = new Set(["apple"]);
  if (holdingType) allow.add(holdingType);
  for (const id of [currentThemeId, nextThemeId]) {
    for (const t of WORLDS[id]?.objects || []) allow.add(t);
  }
  for (const t of Object.keys(models)) {
    if (!allow.has(t)) disposeCachedModel(t);
  }
  pruneLiveModels(holdingType);
}

export function retainMenuModels() {
  for (const t of Object.keys(models)) {
    if (t !== "apple") disposeCachedModel(t);
  }
}

function attachCutProxy(root) {
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const meshes = [];
  let triTotal = 0;
  root.traverse((node) => {
    if (!node.isMesh || node.userData.cutProxy || !node.geometry?.attributes?.position) return;
    const pos = node.geometry.attributes.position;
    const idx = node.geometry.index;
    const n = idx ? idx.count / 3 : pos.count / 3;
    meshes.push({ node, pos, idx, n });
    triTotal += n;
  });
  if (!triTotal) return;
  const step = Math.max(1, Math.ceil(triTotal / PROXY_TRIS));
  const packed = [];
  const toRoot = (out, node, i, attr) => {
    out.fromBufferAttribute(attr, i);
    out.applyMatrix4(node.matrixWorld);
    out.applyMatrix4(inv);
  };
  const emit = (mesh, t) => {
    let i0;
    let i1;
    let i2;
    if (mesh.idx) {
      const i = t * 3;
      i0 = mesh.idx.getX(i);
      i1 = mesh.idx.getX(i + 1);
      i2 = mesh.idx.getX(i + 2);
    } else {
      i0 = t * 3;
      i1 = t * 3 + 1;
      i2 = t * 3 + 2;
    }
    toRoot(a, mesh.node, i0, mesh.pos);
    toRoot(b, mesh.node, i1, mesh.pos);
    toRoot(c, mesh.node, i2, mesh.pos);
    packed.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  };
  for (const mesh of meshes) {
    for (let t = 0; t < mesh.n; t += step) emit(mesh, t);
  }
  if (packed.length < 9) return;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(packed, 3));
  geo.userData.shared = true;
  const proxy = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
  proxy.visible = false;
  proxy.frustumCulled = false;
  proxy.castShadow = false;
  proxy.receiveShadow = false;
  proxy.userData.cutProxy = true;
  root.add(proxy);
}

function normalizeFruitRoot(scene, item) {
  let source = scene;
  if (item.modelPick) {
    const found = scene.getObjectByName(item.modelPick);
    if (found) source = found;
  }

  const wrap = new THREE.Group();
  wrap.add(source.clone(true));
  wrap.traverse((node) => {
    if (node.isMesh && node.geometry) node.geometry.userData.shared = true;
  });
  if (!item.keepUpright) alignLongestToX(wrap);
  const faceYaw = item.faceYaw ?? -Math.PI / 2;
  wrap.rotation.y = faceYaw;
  wrap.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(wrap);
  wrap.position.sub(box.getCenter(new THREE.Vector3()));
  wrap.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(wrap).getSize(new THREE.Vector3());
  const mx = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(mx) || mx < 1e-4) size.set(1, 1, 1);
  else if (mx > 8) {
    wrap.scale.multiplyScalar(1 / mx);
    wrap.updateMatrixWorld(true);
    new THREE.Box3().setFromObject(wrap).getSize(size);
  }
  wrap.userData.restSize = size.clone();
  attachCutProxy(wrap);
  wrap.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    const mats = [].concat(node.material);
    for (const mat of mats) {
      if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
      mat.envMapIntensity = 0.85;
    }
  });
  return wrap;
}

function alignLongestToX(wrap) {
  wrap.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(wrap);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  wrap.position.sub(center);
  if (size.y >= size.x && size.y >= size.z) wrap.rotation.z = -Math.PI / 2;
  else if (size.z >= size.x && size.z >= size.y) wrap.rotation.y = Math.PI / 2;
  wrap.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(wrap);
  wrap.position.sub(box2.getCenter(new THREE.Vector3()));
  wrap.updateMatrixWorld(true);
}
