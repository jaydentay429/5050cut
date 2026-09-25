/**
 * 摊位模型 / 切开贴图 / HDRI。路径经 assetUrl，生产可走 CDN。
 */
import * as THREE from "three";
import { GLTFLoader } from "../vendor/GLTFLoader.js";
import { DRACOLoader } from "../vendor/DRACOLoader.js";
import { RGBELoader } from "../vendor/RGBELoader.js";
import { CONFIG } from "./config.js?v=97";
import { assetUrl } from "./assetUrl.js?v=91";
import { getItem, WORLD_BACKDROP, WORLDS } from "./worlds.js?v=96";

export const FRUIT_TYPES = [...WORLDS.fruit.objects];

const MODEL_CACHE = "v=35";
const models = {};
const loading = {};
const slices = {};
let envMap = null;
let stallMap = null;
let woodMap = null;
const worldMaps = {};
let gltfLoader = null;
let gpuRenderer = null;
const warmedThemes = new Set();
let warmupChain = Promise.resolve();

export function isFruitType(type) {
  return FRUIT_TYPES.includes(type);
}

export function fruitRestSize(type) {
  return models[type]?.userData.restSize || null;
}

function saneAxis(n) {
  return Number.isFinite(n) && n > 1e-4 && n < 8 ? n : 1;
}

/** 对照苹果用「中间那条边」：细长物体按粗细，不按最长边硬拉成苹果那么长。 */
export function restMedian(size) {
  if (!size) return 0.05;
  const mid = [saneAxis(size.x), saneAxis(size.y), saneAxis(size.z)].sort((a, b) => a - b)[1];
  return Math.max(0.05, mid);
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

function yieldFrame() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

export async function ensureFruitModel(type) {
  const item = getItem(type);
  if (!item?.model) return null;
  if (models[type]) return models[type];
  if (!loading[type]) {
    if (!gltfLoader) {
      const draco = new DRACOLoader();
      draco.setDecoderPath("./vendor/draco/");
      gltfLoader = new GLTFLoader();
      gltfLoader.setDRACOLoader(draco);
    }
    loading[type] = gltfLoader
      .loadAsync(`${assetUrl(item.model)}?${MODEL_CACHE}`)
      .then((gltf) => {
        models[type] = normalizeFruitRoot(gltf.scene, item);
        uploadModelGpu(models[type]);
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

/** 空闲时只解下一件，避免一摊十个 GLB 把主线程卡死。 */
export function warmupModel(type) {
  if (!type || models[type] || loading[type]) return warmupChain;
  warmupChain = warmupChain.then(async () => {
    try {
      await ensureFruitModel(type);
    } catch {
      /* 单个失败不阻断预热 */
    }
    await yieldFrame();
  });
  return warmupChain;
}

/** 空闲时预热当前摊 + 摊图。不一次拉完全部模型。 */
export function warmupThemeModels(themeId) {
  if (!themeId || warmedThemes.has(themeId)) return warmupChain;
  warmedThemes.add(themeId);
  warmupChain = warmupChain.then(async () => {
    await ensureWorldBackdrop(themeId);
    const types = WORLDS[themeId]?.objects || [];
    for (const type of types) {
      try {
        await ensureFruitModel(type);
      } catch {
        /* 单个失败不阻断预热 */
      }
      await yieldFrame();
    }
  });
  return warmupChain;
}

export async function preloadFruitAssets(renderer, onProgress) {
  gpuRenderer = renderer || null;
  const texLoader = new THREE.TextureLoader();
  const jobs = [];
  FRUIT_TYPES.forEach((type) => {
    const item = getItem(type);
    if (item.slice && !item.flesh) jobs.push({ kind: "slice", type, file: item.slice });
  });
  jobs.push({ kind: "hdr" });
  jobs.push({ kind: "world", id: "fruit", file: WORLD_BACKDROP.fruit });
  jobs.push({ kind: "wood" });
  jobs.push({ kind: "apple" });
  let done = 0;
  const total = jobs.length;
  const tick = (label) => {
    done += 1;
    onProgress?.({ ratio: done / total, label });
  };

  await Promise.all(
    FRUIT_TYPES.map(async (type) => {
      const item = getItem(type);
      if (item.slice && !item.flesh) {
        try {
          const map = await texLoader.loadAsync(assetUrl(item.slice));
          map.colorSpace = THREE.SRGBColorSpace;
          map.anisotropy = 8;
          uploadTexture(map);
          slices[type] = map;
        } catch (err) {
          console.warn("fruit slice failed", type, err);
        }
        tick("切开贴图");
      }
    }),
  );

  try {
    const hdr = await new RGBELoader().loadAsync(assetUrl("assets/env/abandoned_greenhouse_1k.hdr"));
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
  tick("灯光");

  await ensureWorldBackdrop("fruit");
  tick("摊位");
  try {
    woodMap = await texLoader.loadAsync(assetUrl("assets/env/wood_table_diff_1k.jpg"));
    woodMap.colorSpace = THREE.SRGBColorSpace;
    woodMap.wrapS = THREE.RepeatWrapping;
    woodMap.wrapT = THREE.RepeatWrapping;
    woodMap.repeat.set(2.2, 1.4);
    woodMap.anisotropy = 8;
  } catch (err) {
    console.warn("wood board failed", err);
  }
  tick("桌面");
  await ensureFruitModel("apple");
  tick("苹果");
  if (woodMap) uploadTexture(woodMap);
}

export function cloneFruitModel(type, length) {
  const src = models[type];
  if (!src) return null;
  const clone = src.clone(true);
  const size = src.userData.restSize;
  const span = restMedian(size);
  const appleWorld = CONFIG.scene.fruitAppleLength ?? 0.68;
  const lo = CONFIG.scene.fruitScaleMin ?? 0.3;
  const hi = CONFIG.scene.fruitScaleMax ?? 2.75;
  const rel = Math.min(hi, Math.max(lo, getItem(type).realScale ?? 1));
  const full = appleWorld * rel;
  const shrink = full > 1e-8 ? length / full : 1;
  clone.scale.setScalar((full * Math.max(0.25, shrink)) / span);
  clone.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    const mats = [].concat(node.material);
    const copies = mats.map((mat) => {
      const copy = mat.clone();
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

function boxVolume(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  return Math.max(1e-8, size.x * size.y * size.z);
}

function normalizeFruitRoot(scene, item) {
  let source = scene;
  if (item.modelPick) {
    const found = scene.getObjectByName(item.modelPick);
    if (found) source = found;
  } else if (!item.keepRoot) {
    const meshes = [];
    scene.traverse((node) => {
      if (node.isMesh) meshes.push(node);
    });
    if (meshes.length > 2) {
      meshes.sort((a, b) => boxVolume(b) - boxVolume(a));
      source = meshes[1] || meshes[0];
    }
  }

  const wrap = new THREE.Group();
  wrap.add(source.clone(true));
  if (!item.keepUpright) alignLongestToX(wrap);
  const faceYaw = item.faceYaw ?? -Math.PI / 2;
  wrap.rotation.y = faceYaw;
  wrap.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(wrap);
  wrap.position.sub(box.getCenter(new THREE.Vector3()));
  wrap.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(wrap).getSize(new THREE.Vector3());
  if (Math.max(size.x, size.y, size.z) > 8) size.set(1, 1, 1);
  wrap.userData.restSize = size.clone();
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
