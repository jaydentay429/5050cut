import * as THREE from "three";
import { CONFIG } from "./config.js?v=105";
import { bananaRadiusAt, BOX_TYPES, maxRadius, objectHeight, radiusAt } from "./shapeProfile.js?v=85";
import { makeNoiseBump, makeOuterCapTexture, makeSideTexture, makeSliceTexture } from "./sliceFace.js";
import { cloneFruitModel, fruitEnvMap, fruitModelScale, fruitRestSize, fruitSliceMap, isFruitType } from "./fruitAssets.js?v=126";
import { getItem } from "./worlds.js?v=102";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function enableShadow(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeBodyMaterial(map, spec, type, bump, item) {
  const common = {
    map,
    bumpMap: bump,
    bumpScale: bump ? (type === "orange" ? 0.045 : 0.02) : 0,
    roughness: spec.roughness,
    metalness: 0,
  };
  if (item.glossy) {
    return new THREE.MeshPhysicalMaterial({
      ...common,
      clearcoat: type === "apple" || type === "pear" ? 0.42 : 0.22,
      clearcoatRoughness: 0.48,
    });
  }
  return new THREE.MeshStandardMaterial(common);
}

export function createMaterials(type) {
  const item = getItem(type);
  const spec = CONFIG.catalog[type] || { roughness: 0.6 };
  const sliceMap = item.flesh ? null : fruitSliceMap(type);

  if (item.model) {
    const face = new THREE.MeshPhysicalMaterial({
      color: item.flesh || "#ffffff",
      map: sliceMap,
      roughness: item.flesh ? 0.46 : sliceMap ? 0.28 : 0.88,
      metalness: 0,
      clearcoat: item.flesh ? 0.22 : sliceMap ? 0.55 : 0,
      clearcoatRoughness: item.flesh ? 0.5 : 0.32,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    if (fruitEnvMap()) {
      face.envMap = fruitEnvMap();
      face.envMapIntensity = 0.45;
    }
    const side = new THREE.MeshStandardMaterial({ color: item.tint || "#888888", roughness: spec.roughness ?? 0.6 });
    const outer = new THREE.MeshStandardMaterial({ color: item.tint || "#888888", roughness: spec.roughness ?? 0.6 });
    for (const mat of [side, face, outer]) mat.userData.persist = true;
    return { side, face, outer, textures: [] };
  }

  const sideMap = makeSideTexture(type);
  const outerMap = makeOuterCapTexture(type);
  const faceMap = sliceMap || (item.flesh ? null : makeSliceTexture(type));
  const bump = item.bumpy && !sliceMap && !item.flesh ? makeNoiseBump() : null;

  const side = makeBodyMaterial(sideMap, spec, type, bump, item);
  if (item.tint && !item.model) side.color.set(item.tint);
  const face = new THREE.MeshPhysicalMaterial({
    color: item.flesh || "#ffffff",
    map: faceMap,
    roughness: item.flesh ? 0.46 : sliceMap ? 0.28 : 0.88,
    metalness: 0,
    clearcoat: item.flesh ? 0.22 : sliceMap ? 0.55 : 0,
    clearcoatRoughness: item.flesh ? 0.5 : 0.32,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  if (fruitEnvMap()) {
    face.envMap = fruitEnvMap();
    face.envMapIntensity = 0.45;
  }
  const outer = makeBodyMaterial(outerMap, spec, type, bump, item);
  if (item.tint && !item.model) outer.color.set(item.tint);
  for (const mat of [side, face, outer]) mat.userData.persist = true;

  return {
    side,
    face,
    outer,
    textures: [sideMap, sliceMap ? null : faceMap, outerMap, bump].filter(Boolean),
  };
}

export function disposeMaterials(materials) {
  if (!materials) return;
  for (const key of ["side", "face", "outer"]) {
    materials[key]?.dispose();
  }
  for (const texture of materials.textures || []) {
    texture.dispose();
  }
}

function objectDepth(type, length) {
  const rest = fruitRestSize(type);
  if (rest) return rest.z * fruitModelScale(type, length);
  const item = getItem(type);
  const spec = CONFIG.catalog[type] || {};
  if (item.depth != null) return item.depth;
  if (spec.depth != null) return spec.depth;
  if (item.family === "banana" || type === "banana") {
    const r = spec.radius ?? item.radius ?? 0.22;
    const b = spec.bend ?? item.bend ?? 0.86;
    return r * 2 + b * 0.16;
  }
  if (item.family === "cake") return length * 0.92;
  if (item.family === "capsule") return (item.radius ?? 0.08) * 2;
  if (item.family === "torus") return item.depth ?? length * 0.7;
  return maxRadius(type, length) * 2;
}

function profilePoints(type, length, t0, t1, steps = 36) {
  const pts = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = t0 + (t1 - t0) * (i / steps);
    pts.push(new THREE.Vector2(Math.max(0.012, radiusAt(type, t, length)), t * length));
  }
  return pts;
}

function latheAlongX(points, radial = 40) {
  const geometry = new THREE.LatheGeometry(points, radial);
  geometry.rotateZ(-Math.PI / 2);
  geometry.computeBoundingBox();
  const midX = (geometry.boundingBox.min.x + geometry.boundingBox.max.x) / 2;
  geometry.translate(-midX, 0, 0);
  return geometry;
}

function addFaceDisk(group, radius, x, facingPositiveX, material) {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(Math.max(0.02, radius), 24), material);
  mesh.rotation.y = facingPositiveX ? Math.PI / 2 : -Math.PI / 2;
  mesh.position.x = x + (facingPositiveX ? 0.002 : -0.002);
  group.add(mesh);
}

function addLatheBody(group, type, length, materials) {
  const item = getItem(type);
  const mesh = enableShadow(new THREE.Mesh(latheAlongX(profilePoints(type, length, 0, 1)), materials.side));
  if (item.squashY != null) mesh.scale.y = item.squashY;
  else if (type === "apple") mesh.scale.y = 0.88;
  else if (type === "orange") mesh.scale.y = 0.92;
  if (type === "bread") {
    mesh.scale.y = 1.18;
    mesh.scale.z = 0.78;
  }
  group.add(mesh);
  const r0 = radiusAt(type, 0, length);
  const r1 = radiusAt(type, 1, length);
  if (r0 > 0.035) addFaceDisk(group, r0, -length / 2, false, materials.outer);
  if (r1 > 0.035) addFaceDisk(group, r1, length / 2, true, materials.outer);
}

function stemMat() {
  return new THREE.MeshStandardMaterial({ color: "#4a2e18", roughness: 0.82 });
}

function leafMat(color = "#3a8a32") {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.62, side: THREE.DoubleSide });
}

function addLeaf(group, x, y, z, rotZ, scale = 1, color) {
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), leafMat(color));
  leaf.scale.set(0.35 * scale, 0.1 * scale, 1.15 * scale);
  leaf.position.set(x, y, z);
  leaf.rotation.z = rotZ;
  leaf.castShadow = true;
  group.add(leaf);
  return leaf;
}

function addStem(group, x, y, z = 0, rotZ = 0, height = 0.22) {
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.022, height, 8), stemMat());
  stem.position.set(x, y, z);
  stem.rotation.z = rotZ;
  stem.castShadow = true;
  group.add(stem);
}

function addAppleBits(group, length) {
  const top = maxRadius("apple", length) * 0.78;
  addStem(group, 0.01, top + 0.07, 0.05, 0.12, 0.2);
  addLeaf(group, 0.1, top + 0.14, 0.08, 0.7, 1.35, "#4a9a38");
  const dent = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 10, 8),
    new THREE.MeshStandardMaterial({ color: "#6a1810", roughness: 0.7 }),
  );
  dent.scale.set(1.15, 0.32, 1.15);
  dent.position.set(0, top - 0.02, 0.02);
  group.add(dent);
}

function addPearBits(group, length) {
  const neckR = radiusAt("pear", 0.04, length);
  const x = -length / 2 + 0.03;
  addStem(group, x, neckR + 0.14, 0, 0.4, 0.26);
  addLeaf(group, x + 0.09, neckR + 0.22, 0.03, 0.75, 1.35, "#6aa03a");
  addLeaf(group, x - 0.02, neckR + 0.18, -0.05, -0.55, 1.0, "#4a8a30");
}

function addOrangeBits(group, length) {
  const r = maxRadius("orange", length);
  const navelMat = new THREE.MeshStandardMaterial({ color: "#e07018", roughness: 0.78 });
  const navel = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), navelMat);
  navel.scale.set(1, 0.28, 1);
  navel.position.set(0, r * 0.88, 0.05);
  group.add(navel);
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    const crease = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), navelMat);
    crease.scale.set(0.55, 0.18, 1.4);
    crease.position.set(Math.cos(a) * 0.045, r * 0.9, 0.04 + Math.sin(a) * 0.045);
    crease.rotation.y = a;
    group.add(crease);
  }
  addStem(group, 0, r * 0.96, 0.03, 0.1, 0.1);
}

function addLemonBits(group, length) {
  const tipMat = new THREE.MeshStandardMaterial({ color: "#f5d43a", roughness: 0.48 });
  for (const x of [-length / 2, length / 2]) {
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), tipMat);
    tip.scale.set(1.15, 0.72, 0.72);
    tip.position.x = x + (x < 0 ? -0.01 : 0.01);
    tip.castShadow = true;
    group.add(tip);
  }
}

function addStrawberrySeeds(group, length) {
  const seedMat = new THREE.MeshStandardMaterial({ color: "#f5d24a", roughness: 0.5 });
  for (let i = 0; i < 40; i += 1) {
    const t = 0.08 + (i / 40) * 0.82;
    const a = i * 2.15;
    const r = radiusAt("strawberry", t, length) * 0.96;
    const seed = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), seedMat);
    seed.scale.set(1, 0.5, 1.35);
    seed.position.set((t - 0.5) * length, Math.sin(a) * r * 0.78, Math.cos(a) * r * 0.78);
    group.add(seed);
  }
  const calyxMat = leafMat("#2f7a30");
  const x = -length / 2 + 0.01;
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), calyxMat);
    leaf.scale.set(0.55, 0.12, 1.85);
    leaf.position.set(x - 0.02, Math.sin(a) * 0.16, Math.cos(a) * 0.16);
    leaf.rotation.x = Math.cos(a) * 0.35;
    leaf.rotation.z = Math.PI / 2;
    leaf.rotation.y = a;
    leaf.castShadow = true;
    group.add(leaf);
  }
}

function addRosePetals(group, length, materials) {
  void materials;
  const bloomX = length / 2 - 0.22;
  const outerMat = new THREE.MeshPhysicalMaterial({
    color: "#e24a62",
    roughness: 0.4,
    clearcoat: 0.16,
    clearcoatRoughness: 0.55,
    side: THREE.DoubleSide,
  });
  const midMat = new THREE.MeshPhysicalMaterial({
    color: "#c42848",
    roughness: 0.44,
    side: THREE.DoubleSide,
  });
  const innerMat = new THREE.MeshPhysicalMaterial({
    color: "#8a1830",
    roughness: 0.5,
  });
  const petalGeo = new THREE.SphereGeometry(1, 12, 10);
  const layers = [
    { count: 8, spread: 0.09, scale: [0.2, 0.036, 0.095], x: bloomX, mat: outerMat },
    { count: 7, spread: 0.06, scale: [0.16, 0.03, 0.075], x: bloomX + 0.03, mat: midMat },
    { count: 6, spread: 0.032, scale: [0.12, 0.026, 0.055], x: bloomX + 0.05, mat: innerMat },
  ];
  for (let layer = 0; layer < layers.length; layer += 1) {
    const spec = layers[layer];
    for (let i = 0; i < spec.count; i += 1) {
      const a = (i / spec.count) * Math.PI * 2 + layer * 0.35;
      const petal = new THREE.Mesh(petalGeo, spec.mat);
      petal.scale.set(spec.scale[0], spec.scale[1], spec.scale[2]);
      petal.position.set(spec.x, Math.sin(a) * spec.spread, Math.cos(a) * spec.spread);
      petal.rotation.set(Math.cos(a) * 0.55, a, Math.sin(a) * 0.55);
      petal.castShadow = true;
      group.add(petal);
    }
  }
  const bud = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), innerMat);
  bud.position.set(bloomX + 0.04, 0, 0);
  group.add(bud);

  const calyx = enableShadow(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 8),
      leafMat("#2d6a32"),
    ),
  );
  calyx.scale.set(1.15, 0.7, 0.7);
  calyx.position.set(bloomX - 0.07, 0, 0);
  group.add(calyx);

  const stemStart = -length / 2;
  const stemEnd = bloomX - 0.02;
  const stemLen = Math.max(0.25, stemEnd - stemStart);
  const stem = enableShadow(
    new THREE.Mesh(
      new THREE.BoxGeometry(stemLen, 0.048, 0.048),
      new THREE.MeshStandardMaterial({ color: "#2f8a38", roughness: 0.62 }),
    ),
  );
  stem.position.x = (stemStart + stemEnd) / 2;
  group.add(stem);
  const thornMat = new THREE.MeshStandardMaterial({ color: "#245a28", roughness: 0.7 });
  for (let i = 0; i < 4; i += 1) {
    const thorn = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.04, 6), thornMat);
    thorn.position.set(stemStart + stemLen * (0.25 + i * 0.16), i % 2 === 0 ? 0.03 : -0.02, i % 2 === 0 ? 0.02 : -0.025);
    thorn.rotation.z = i % 2 === 0 ? -0.9 : 0.9;
    group.add(thorn);
  }
  const leafGeo = new THREE.SphereGeometry(0.1, 8, 6);
  const leafA = new THREE.Mesh(leafGeo, leafMat("#2d6a32"));
  leafA.scale.set(1.9, 0.1, 0.48);
  leafA.position.set(stemStart + stemLen * 0.42, 0.06, 0.05);
  leafA.rotation.z = 0.45;
  leafA.rotation.y = 0.35;
  leafA.castShadow = true;
  group.add(leafA);
  const leafB = new THREE.Mesh(leafGeo, leafMat("#3a8a38"));
  leafB.scale.set(1.55, 0.09, 0.4);
  leafB.position.set(stemStart + stemLen * 0.62, 0.045, -0.055);
  leafB.rotation.z = -0.38;
  leafB.rotation.y = -0.3;
  leafB.castShadow = true;
  group.add(leafB);
}

function addTulipBloom(group, length, materials) {
  const bloomX = length / 2 - 0.18;
  const outerMat = new THREE.MeshPhysicalMaterial({
    color: "#e84820",
    roughness: 0.44,
    clearcoat: 0.14,
    clearcoatRoughness: 0.6,
  });
  const innerMat = new THREE.MeshPhysicalMaterial({
    color: "#c03418",
    roughness: 0.5,
  });
  const petalGeo = new THREE.SphereGeometry(0.16, 14, 12);
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    const petal = new THREE.Mesh(petalGeo, outerMat);
    petal.scale.set(1.62, 0.92, 0.58);
    petal.position.set(bloomX, Math.sin(a) * 0.05, Math.cos(a) * 0.05);
    petal.castShadow = true;
    group.add(petal);
  }
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const petal = new THREE.Mesh(petalGeo, innerMat);
    petal.scale.set(1.2, 0.62, 0.42);
    petal.position.set(bloomX + 0.04, Math.sin(a) * 0.03, Math.cos(a) * 0.03);
    group.add(petal);
  }
  const leafGeo = new THREE.SphereGeometry(0.12, 8, 6);
  const leafA = new THREE.Mesh(leafGeo, leafMat("#2f7a32"));
  leafA.scale.set(2.2, 0.14, 0.42);
  leafA.position.set(-length * 0.08, 0.04, 0.07);
  leafA.rotation.z = 0.22;
  leafA.rotation.y = 0.35;
  leafA.castShadow = true;
  group.add(leafA);
  const leafB = new THREE.Mesh(leafGeo, leafMat("#3a8a38"));
  leafB.scale.set(1.8, 0.12, 0.36);
  leafB.position.set(length * 0.04, 0.03, -0.08);
  leafB.rotation.z = -0.18;
  leafB.rotation.y = -0.4;
  leafB.castShadow = true;
  group.add(leafB);
}

function addDaisyHead(group, length) {
  const x = length / 2 - 0.06;
  const petalMat = new THREE.MeshStandardMaterial({
    color: "#fff8ee",
    roughness: 0.58,
    side: THREE.DoubleSide,
  });
  const petalGeo = new THREE.SphereGeometry(1, 10, 8);
  const count = 22;
  const spread = 0.175;
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const petal = new THREE.Mesh(petalGeo, petalMat);
    petal.scale.set(0.195, 0.032, 0.068);
    petal.position.set(x + Math.cos(a) * spread, 0.055, Math.sin(a) * spread);
    petal.rotation.y = -a;
    petal.castShadow = true;
    group.add(petal);
  }
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2 + Math.PI / count;
    const petal = new THREE.Mesh(petalGeo, petalMat);
    petal.scale.set(0.15, 0.028, 0.055);
    petal.position.set(x + Math.cos(a) * (spread * 0.72), 0.062, Math.sin(a) * (spread * 0.72));
    petal.rotation.y = -a;
    group.add(petal);
  }

  const disk = new THREE.Mesh(
    new THREE.SphereGeometry(0.125, 14, 10),
    new THREE.MeshStandardMaterial({ color: "#f5c410", roughness: 0.55 }),
  );
  disk.scale.set(1, 0.34, 1);
  disk.position.set(x, 0.07, 0);
  disk.castShadow = true;
  group.add(disk);
  const inner = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 12, 8),
    new THREE.MeshStandardMaterial({ color: "#e09018", roughness: 0.62 }),
  );
  inner.scale.set(1, 0.42, 1);
  inner.position.set(x, 0.086, 0);
  group.add(inner);

  const sepalMat = leafMat("#3a8a32");
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    const sepal = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), sepalMat);
    sepal.scale.set(0.55, 0.1, 0.22);
    sepal.position.set(x + Math.cos(a) * 0.04, 0.012, Math.sin(a) * 0.04);
    sepal.rotation.y = -a;
    group.add(sepal);
  }
  addLeaf(group, -length * 0.08, 0.05, 0.06, 0.55, 1.25, "#2f7a32");
}

function cylinderAlongX(radiusTop, radiusBottom, length, radial = 16) {
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, length, radial);
  geometry.rotateZ(-Math.PI / 2);
  return geometry;
}

function addPencil(group, length, materials) {
  const r = 0.07;
  const eraserLen = length * 0.09;
  const ferruleLen = length * 0.05;
  const tipLen = length * 0.15;
  const shaftLen = length - eraserLen - ferruleLen - tipLen;
  const eraser = enableShadow(
    new THREE.Mesh(
      cylinderAlongX(0.055, 0.055, eraserLen, 12),
      new THREE.MeshStandardMaterial({ color: "#e890a4", roughness: 0.85 }),
    ),
  );
  eraser.position.x = -length / 2 + eraserLen / 2;
  const ferrule = enableShadow(
    new THREE.Mesh(
      cylinderAlongX(0.074, 0.074, ferruleLen, 16),
      new THREE.MeshStandardMaterial({ color: "#c5ccd2", metalness: 0.82, roughness: 0.28 }),
    ),
  );
  ferrule.position.x = -length / 2 + eraserLen + ferruleLen / 2;
  const shaft = enableShadow(new THREE.Mesh(cylinderAlongX(r, r, shaftLen, 6), materials.side));
  shaft.position.x = -length / 2 + eraserLen + ferruleLen + shaftLen / 2;
  const wood = enableShadow(
    new THREE.Mesh(
      cylinderAlongX(0.014, r, tipLen * 0.72, 10),
      new THREE.MeshStandardMaterial({ color: "#e8d2a0", roughness: 0.7 }),
    ),
  );
  wood.position.x = length / 2 - tipLen + (tipLen * 0.72) / 2;
  const graphite = enableShadow(
    new THREE.Mesh(
      cylinderAlongX(0.006, 0.014, tipLen * 0.28, 10),
      new THREE.MeshStandardMaterial({ color: "#2a2a2a", roughness: 0.4, metalness: 0.15 }),
    ),
  );
  graphite.position.x = length / 2 - (tipLen * 0.28) / 2;
  group.add(eraser, ferrule, shaft, wood, graphite);
}

function addEraser(group, length) {
  const spec = CONFIG.catalog.eraser;
  const h = spec.height;
  const d = spec.depth;
  const pink = new THREE.MeshStandardMaterial({ color: "#f2a4b6", roughness: 0.88 });
  const blue = new THREE.MeshStandardMaterial({ color: "#3a74d4", roughness: 0.62 });
  const end = length * 0.36;
  const left = enableShadow(new THREE.Mesh(new THREE.BoxGeometry(end, h, d), pink));
  left.position.x = -length / 2 + end / 2;
  const right = enableShadow(new THREE.Mesh(new THREE.BoxGeometry(end, h, d), pink));
  right.position.x = length / 2 - end / 2;
  const band = enableShadow(
    new THREE.Mesh(new THREE.BoxGeometry(length * 0.3, h * 1.08, d * 1.08), blue),
  );
  group.add(left, band, right);
  group.rotation.y = 0.32;
}

function addCrayon(group, length) {
  const r = 0.12;
  const tipLen = length * 0.22;
  const wrapLen = length * 0.52;
  const bodyLen = length - tipLen;
  const wax = new THREE.MeshStandardMaterial({ color: "#3a68e8", roughness: 0.46 });
  const paper = new THREE.MeshStandardMaterial({ color: "#f3ead8", roughness: 0.74 });
  const stripe = new THREE.MeshStandardMaterial({ color: "#c43a32", roughness: 0.58 });
  const body = enableShadow(new THREE.Mesh(cylinderAlongX(r, r, bodyLen, 18), wax));
  body.position.x = -length / 2 + bodyLen / 2;
  const wrap = enableShadow(new THREE.Mesh(cylinderAlongX(r * 1.08, r * 1.08, wrapLen, 18), paper));
  wrap.position.x = -length / 2 + bodyLen * 0.48;
  const band = enableShadow(new THREE.Mesh(cylinderAlongX(r * 1.1, r * 1.1, wrapLen * 0.1, 18), stripe));
  band.position.x = wrap.position.x - wrapLen * 0.34;
  const tip = enableShadow(new THREE.Mesh(cylinderAlongX(0.012, r, tipLen, 12), wax));
  tip.position.x = length / 2 - tipLen / 2;
  group.add(body, wrap, band, tip);
}

function addChocolate(group, length) {
  const spec = CONFIG.catalog.chocolate;
  const base = enableShadow(
    new THREE.Mesh(
      new THREE.BoxGeometry(length, spec.height, spec.depth * 0.72),
      new THREE.MeshStandardMaterial({ color: "#3a180c", roughness: 0.55 }),
    ),
  );
  group.add(base);
  const squareMat = new THREE.MeshStandardMaterial({ color: "#5a2a14", roughness: 0.42 });
  const cols = 4;
  const rows = 2;
  const pad = 0.03;
  const cellW = (length - pad * 2) / cols;
  const cellH = (spec.height - pad * 2) / rows;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const square = enableShadow(
        new THREE.Mesh(new THREE.BoxGeometry(cellW * 0.86, cellH * 0.82, 0.04), squareMat),
      );
      square.position.set(
        -length / 2 + pad + cellW * (c + 0.5),
        -spec.height / 2 + pad + cellH * (r + 0.5),
        spec.depth * 0.42,
      );
      group.add(square);
    }
  }
}

function addBox(group, length, type, materials) {
  const spec = CONFIG.catalog[type] || { height: 0.24, depth: 0.24 };
  const maps =
    type === "ruler" || type === "chocolate"
      ? [materials.outer, materials.outer, materials.side, materials.side, materials.face, materials.face]
      : [materials.outer, materials.outer, materials.side, materials.side, materials.side, materials.side];
  const mesh = enableShadow(new THREE.Mesh(new THREE.BoxGeometry(length, spec.height, spec.depth), maps));
  group.add(mesh);
}

function bananaCurve(length, bend, radius = CONFIG.catalog.banana.radius) {
  const by = bend * 0.9;
  const bz = bend * 0.16;
  const minY = -radius;
  const maxY = by + radius * 0.85;
  const oy = -(minY + maxY) / 2;
  const oz = -bz * 0.35;
  return new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-length / 2, oy, oz),
    new THREE.Vector3(0, by + oy, bz + oz),
    new THREE.Vector3(length / 2, oy, oz),
  );
}

class CurveSlice extends THREE.Curve {
  constructor(parent, t0, t1) {
    super();
    this.parent = parent;
    this.t0 = t0;
    this.t1 = t1;
  }

  getPoint(t, target = new THREE.Vector3()) {
    return this.parent.getPoint(this.t0 + (this.t1 - this.t0) * t, target);
  }
}

function bananaLobe(angle) {
  return 0.84 + 0.16 * Math.cos(angle * 3);
}

function makeBananaGeometry(curve, radius, t0 = 0, t1 = 1) {
  const tubular = 42;
  const radial = 24;
  const positions = [];
  const uvs = [];
  const indices = [];
  const path = t0 === 0 && t1 === 1 ? curve : new CurveSlice(curve, t0, t1);
  const frames = path.computeFrenetFrames(tubular, false);

  for (let i = 0; i <= tubular; i += 1) {
    const tLocal = i / tubular;
    const tGlobal = t0 + (t1 - t0) * tLocal;
    const r = bananaRadiusAt(tGlobal, radius);
    const p = path.getPoint(tLocal);
    const n = frames.normals[i];
    const b = frames.binormals[i];
    for (let j = 0; j <= radial; j += 1) {
      const u = j / radial;
      const a = u * Math.PI * 2 + Math.PI / 2;
      const rr = r * bananaLobe(a);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      positions.push(p.x + n.x * ca * rr + b.x * sa * rr, p.y + n.y * ca * rr + b.y * sa * rr, p.z + n.z * ca * rr + b.z * sa * rr);
      uvs.push(u, tGlobal);
    }
  }

  for (let i = 0; i < tubular; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const a = i * (radial + 1) + j;
      const next = a + radial + 1;
      indices.push(a, next, a + 1);
      indices.push(next, next + 1, a + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function addBananaStem(group, curve) {
  const pos = curve.getPoint(0);
  const tan = curve.getTangent(0).normalize();
  const stemMat = new THREE.MeshStandardMaterial({ color: "#4a5a16", roughness: 0.92 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.03, 0.12, 8), stemMat);
  stem.position.copy(pos).addScaledVector(tan, -0.05);
  stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan.clone().negate());
  stem.castShadow = true;
  group.add(stem);
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 8, 6),
    new THREE.MeshStandardMaterial({ color: "#3a2c10", roughness: 0.9 }),
  );
  crown.position.copy(pos).addScaledVector(tan, -0.11);
  group.add(crown);
}

function addBanana(group, length, materials, type = "banana") {
  const spec = CONFIG.catalog[type] || CONFIG.catalog.banana;
  const curve = bananaCurve(length, spec.bend, spec.radius);
  const body = enableShadow(new THREE.Mesh(makeBananaGeometry(curve, spec.radius), materials.side));
  group.add(body);
  if (type === "banana") addBananaStem(group, curve);
}

function addCarrotTops(group, length) {
  const x = -length / 2 + 0.02;
  const stemMat = new THREE.MeshStandardMaterial({ color: "#2a7a28", roughness: 0.7 });
  for (let i = 0; i < 7; i += 1) {
    const a = -0.85 + i * 0.28;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, 0.22, 6), stemMat);
    stem.position.set(x - 0.06, 0.1 + Math.abs(Math.sin(a)) * 0.04, Math.sin(a) * 0.05);
    stem.rotation.z = 0.95 + (i % 3) * 0.12;
    stem.rotation.y = a * 0.4;
    stem.castShadow = true;
    group.add(stem);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), leafMat(i % 2 === 0 ? "#2f8a32" : "#4aaa38"));
    leaf.scale.set(1.9, 0.08, 0.42);
    leaf.position.set(x - 0.16, 0.18 + (i % 3) * 0.04, Math.sin(a) * 0.08);
    leaf.rotation.z = 0.85;
    leaf.rotation.y = a;
    leaf.castShadow = true;
    group.add(leaf);
  }
}

function addCucumberBits(group, length) {
  const bumpMat = new THREE.MeshStandardMaterial({ color: "#3a7a28", roughness: 0.7 });
  for (let i = 0; i < 28; i += 1) {
    const t = 0.08 + (i / 28) * 0.84;
    const a = i * 2.4;
    const r = radiusAt("cucumber", t, length);
    const bump = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), bumpMat);
    bump.position.set((t - 0.5) * length, Math.sin(a) * r, Math.cos(a) * r);
    group.add(bump);
  }
}

function addCornKernels(group, length) {
  const cobMat = new THREE.MeshStandardMaterial({ color: "#e0a020", roughness: 0.7 });
  const kernelMats = [
    new THREE.MeshStandardMaterial({ color: "#f6d24a", roughness: 0.52 }),
    new THREE.MeshStandardMaterial({ color: "#ffe56a", roughness: 0.48 }),
    new THREE.MeshStandardMaterial({ color: "#f0c430", roughness: 0.55 }),
  ];
  const rows = 13;
  const around = 12;
  for (let i = 0; i < rows; i += 1) {
    const t = 0.1 + (i / (rows - 1)) * 0.76;
    const r = radiusAt("corn", t, length) * 0.88;
    for (let j = 0; j < around; j += 1) {
      const a = (j / around) * Math.PI * 2 + (i % 2) * 0.26;
      const kernel = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), kernelMats[(i + j) % 3]);
      kernel.scale.set(0.95, 0.78, 1.12);
      kernel.position.set((t - 0.5) * length, Math.sin(a) * r, Math.cos(a) * r);
      kernel.castShadow = true;
      group.add(kernel);
    }
  }
  const silk = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), cobMat);
  silk.scale.set(1.5, 0.5, 0.5);
  silk.position.x = length / 2 - 0.04;
  group.add(silk);
}

function addCornHusk(group, length) {
  const x = -length / 2 + 0.16;
  for (let i = 0; i < 6; i += 1) {
    const a = -1.05 + i * 0.42;
    const husk = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), leafMat(i % 2 === 0 ? "#6aaa38" : "#4a8a28"));
    husk.scale.set(2.8, 0.16, 0.62);
    husk.position.set(x + Math.abs(i - 2.5) * 0.02, 0.03, Math.sin(a) * 0.12);
    husk.rotation.z = 0.48;
    husk.rotation.y = a;
    husk.castShadow = true;
    group.add(husk);
  }
}

function addEggplantCap(group, length) {
  const x = -length / 2 + 0.04;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), leafMat("#2a6a28"));
  cap.scale.set(0.7, 0.45, 0.7);
  cap.position.set(x, 0.02, 0);
  group.add(cap);
  addStem(group, x - 0.02, 0.12, 0, 0.2, 0.14);
}

function addCake(group, length, materials, type = "cake") {
  const h = (CONFIG.catalog[type] || CONFIG.catalog.cake).height;
  const r = length * 0.46;
  const sponge = enableShadow(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h * 0.78, 32), materials.side));
  sponge.position.y = -h * 0.04;
  const frostMat = new THREE.MeshPhysicalMaterial({
    color: "#fff4ea",
    roughness: 0.42,
    clearcoat: 0.2,
  });
  const top = enableShadow(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.03, r * 1.01, h * 0.12, 32), frostMat));
  top.position.y = h * 0.38;
  const drip = enableShadow(new THREE.Mesh(new THREE.TorusGeometry(r * 0.96, 0.028, 8, 28), frostMat));
  drip.rotation.x = Math.PI / 2;
  drip.position.y = h * 0.3;
  const cream = enableShadow(
    new THREE.Mesh(
      new THREE.CylinderGeometry(r * 1.015, r * 1.015, 0.038, 32),
      new THREE.MeshStandardMaterial({ color: "#fff0d8", roughness: 0.7 }),
    ),
  );
  cream.position.y = 0.01;
  const cherry = enableShadow(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 12, 10),
      new THREE.MeshPhysicalMaterial({ color: "#d42838", roughness: 0.32, clearcoat: 0.4 }),
    ),
  );
  cherry.position.y = h * 0.5;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.07, 6), stemMat());
  stem.position.y = h * 0.5 + 0.05;
  stem.rotation.z = 0.18;
  group.add(sponge, cream, top, drip, cherry, stem);
}

function addCheese(group, length) {
  const spec = CONFIG.catalog.cheese;
  const shape = new THREE.Shape();
  const hw = length / 2;
  const hh = spec.height / 2;
  shape.moveTo(-hw, -hh);
  shape.lineTo(hw, -hh);
  shape.quadraticCurveTo(hw * 0.15, hh * 0.15, -hw * 0.05, hh);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: spec.depth,
    bevelEnabled: true,
    bevelThickness: 0.018,
    bevelSize: 0.018,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -spec.depth / 2);
  const cheese = enableShadow(
    new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: "#f0c43a", roughness: 0.68 }),
    ),
  );
  group.add(cheese);
  const holeMat = new THREE.MeshStandardMaterial({ color: "#8a5810", roughness: 0.82 });
  const holes = [
    [-0.08, 0.08, 0.0, 0.07],
    [0.1, 0.04, 0.02, 0.055],
    [-0.02, 0.14, -0.02, 0.062],
    [0.18, 0.06, 0.03, 0.048],
    [-0.18, 0.02, 0.01, 0.042],
  ];
  for (const [x, y, z, r] of holes) {
    const hole = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), holeMat);
    hole.scale.set(1.15, 0.45, 1.15);
    hole.position.set(x, y, z);
    hole.rotation.z = -0.5;
    group.add(hole);
  }
}

function addBreadBits(group, length) {
  const seedMat = new THREE.MeshStandardMaterial({ color: "#6a3a14", roughness: 0.7 });
  const topY = maxRadius("bread", length) * 1.12;
  for (let i = 0; i < 22; i += 1) {
    const seed = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), seedMat);
    seed.scale.set(1, 0.45, 1.6);
    seed.position.set((i / 22 - 0.5) * length * 0.82, topY, ((i * 3) % 7 - 3) * 0.018);
    seed.rotation.y = i * 0.7;
    group.add(seed);
  }
  const slashMat = new THREE.MeshStandardMaterial({ color: "#7a3e18", roughness: 0.82 });
  for (let i = 0; i < 3; i += 1) {
    const slash = new THREE.Mesh(new THREE.BoxGeometry(length * 0.16, 0.008, 0.034), slashMat);
    slash.position.set(-length * 0.2 + i * length * 0.2, topY + 0.002, 0);
    slash.rotation.z = 0.18;
    group.add(slash);
  }
}

function addOnigiri(group, length) {
  const spec = CONFIG.catalog.onigiri;
  const shape = new THREE.Shape();
  const hw = length / 2;
  const hh = spec.height / 2;
  shape.moveTo(0, hh);
  shape.quadraticCurveTo(-hw * 1.05, hh * 0.15, -hw * 0.92, -hh);
  shape.quadraticCurveTo(0, -hh * 1.12, hw * 0.92, -hh);
  shape.quadraticCurveTo(hw * 1.05, hh * 0.15, 0, hh);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: spec.depth,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.035,
    bevelSegments: 3,
  });
  geo.translate(0, 0, -spec.depth / 2);
  const rice = enableShadow(
    new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: "#f4f0e4", roughness: 0.88 })),
  );
  const noriShape = new THREE.Shape();
  noriShape.moveTo(-hw * 0.28, hh * 0.55);
  noriShape.lineTo(-hw * 0.28, -hh * 0.92);
  noriShape.quadraticCurveTo(0, -hh * 1.05, hw * 0.28, -hh * 0.92);
  noriShape.lineTo(hw * 0.28, hh * 0.55);
  noriShape.closePath();
  const noriGeo = new THREE.ExtrudeGeometry(noriShape, {
    depth: 0.05,
    bevelEnabled: false,
  });
  noriGeo.translate(0, 0, spec.depth / 2 + 0.01);
  const nori = enableShadow(
    new THREE.Mesh(noriGeo, new THREE.MeshStandardMaterial({ color: "#1a2a18", roughness: 0.62 })),
  );
  const noriBack = nori.clone();
  noriBack.position.z = -spec.depth - 0.07;
  group.add(rice, nori, noriBack);
}

function addLollipop(group, length) {
  const candy = enableShadow(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 20, 16),
      new THREE.MeshPhysicalMaterial({ color: "#e04870", roughness: 0.28, clearcoat: 0.5 }),
    ),
  );
  candy.position.x = length / 2 - 0.22;
  const stickLen = candy.position.x + length / 2 - 0.16;
  const stick = enableShadow(
    new THREE.Mesh(
      cylinderAlongX(0.028, 0.028, stickLen, 10),
      new THREE.MeshStandardMaterial({ color: "#f4ead8", roughness: 0.7 }),
    ),
  );
  stick.position.x = -length / 2 + stickLen / 2;
  const swirl = enableShadow(
    new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.035, 8, 18),
      new THREE.MeshStandardMaterial({ color: "#fff6ea", roughness: 0.4 }),
    ),
  );
  swirl.position.copy(candy.position);
  swirl.rotation.y = Math.PI / 2;
  group.add(stick, candy, swirl);
}

function addMacaron(group, length) {
  const r = 0.2;
  const shell = new THREE.MeshPhysicalMaterial({
    color: "#f4a0b8",
    roughness: 0.48,
    clearcoat: 0.2,
  });
  const fill = new THREE.MeshStandardMaterial({ color: "#fff0c8", roughness: 0.7 });
  const top = enableShadow(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), shell));
  top.scale.set(1, 0.42, 1);
  top.position.y = 0.055;
  const bot = enableShadow(new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), shell));
  bot.scale.set(1, 0.42, 1);
  bot.position.y = -0.055;
  const cream = enableShadow(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r * 0.86, 0.055, 16), fill));
  group.add(top, bot, cream);
}

function addPopsicle(group, length) {
  const r = 0.1;
  const iceLen = length * 0.7;
  const cylLen = Math.max(0.04, iceLen - r * 2);
  const ice = enableShadow(
    new THREE.Mesh(
      new THREE.CapsuleGeometry(r, cylLen, 8, 16),
      new THREE.MeshPhysicalMaterial({ color: "#ff8098", roughness: 0.32, clearcoat: 0.38 }),
    ),
  );
  ice.rotation.z = -Math.PI / 2;
  ice.position.x = -length / 2 + iceLen / 2 + 0.02;
  const band = enableShadow(
    new THREE.Mesh(
      cylinderAlongX(r * 1.04, r * 1.04, iceLen * 0.28, 16),
      new THREE.MeshPhysicalMaterial({ color: "#70d4f4", roughness: 0.36, clearcoat: 0.3 }),
    ),
  );
  band.position.x = ice.position.x;
  const stick = enableShadow(
    new THREE.Mesh(
      new THREE.BoxGeometry(length * 0.32, 0.045, 0.09),
      new THREE.MeshStandardMaterial({ color: "#e8d0a0", roughness: 0.82 }),
    ),
  );
  stick.position.x = length / 2 - length * 0.14;
  group.add(ice, band, stick);
}

function addSunflowerHead(group, length) {
  const x = length / 2 - 0.08;
  const petalMat = new THREE.MeshStandardMaterial({ color: "#f0c430", roughness: 0.55, side: THREE.DoubleSide });
  const petalGeo = new THREE.SphereGeometry(1, 10, 8);
  const count = 18;
  const spread = 0.2;
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const petal = new THREE.Mesh(petalGeo, petalMat);
    petal.scale.set(0.22, 0.034, 0.07);
    petal.position.set(x + Math.cos(a) * spread, 0.06, Math.sin(a) * spread);
    petal.rotation.y = -a;
    petal.castShadow = true;
    group.add(petal);
  }
  const disk = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 14, 10),
    new THREE.MeshStandardMaterial({ color: "#6a3a10", roughness: 0.72 }),
  );
  disk.scale.set(1, 0.32, 1);
  disk.position.set(x, 0.07, 0);
  disk.castShadow = true;
  group.add(disk);
  addLeaf(group, -length * 0.1, 0.05, 0.05, 0.5, 1.3, "#2f7a32");
}

function addCapsuleItem(group, length, item) {
  const r = item.radius ?? 0.08;
  const cyl = Math.max(0.04, length - r * 2);
  const mesh = enableShadow(
    new THREE.Mesh(
      new THREE.CapsuleGeometry(r, cyl, 6, 14),
      new THREE.MeshPhysicalMaterial({
        color: item.tint || "#cccccc",
        roughness: item.glossy ? 0.32 : 0.58,
        clearcoat: item.glossy ? 0.28 : 0,
      }),
    ),
  );
  mesh.rotation.z = -Math.PI / 2;
  group.add(mesh);
}

function addTorusItem(group, length, item) {
  const R = length * 0.32;
  const tube = Math.max(0.035, (item.height ?? 0.2) * 0.42);
  const mesh = enableShadow(
    new THREE.Mesh(
      new THREE.TorusGeometry(R, tube, 12, 28),
      new THREE.MeshStandardMaterial({ color: item.tint || "#c48a48", roughness: 0.55 }),
    ),
  );
  mesh.rotation.x = Math.PI / 2;
  group.add(mesh);
}

function addClusterItem(group, length, item) {
  const tint = item.tint || "#6a38a0";
  const mat = new THREE.MeshPhysicalMaterial({
    color: tint,
    roughness: 0.35,
    clearcoat: item.glossy ? 0.4 : 0,
  });
  if (item.cluster === "skewer") {
    const stick = enableShadow(
      new THREE.Mesh(
        cylinderAlongX(0.012, 0.012, length, 8),
        new THREE.MeshStandardMaterial({ color: "#d8c090", roughness: 0.7 }),
    ),
    );
    group.add(stick);
    for (let i = 0; i < 3; i += 1) {
      const berry = enableShadow(new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 12), mat));
      berry.position.x = -length * 0.18 + i * 0.22;
      group.add(berry);
    }
    return;
  }
  const r = 0.09;
  const offsets = [
    [-0.16, 0.02, 0],
    [-0.05, -0.04, 0.06],
    [0.06, 0.03, -0.04],
    [0.16, -0.02, 0.03],
    [-0.02, 0.08, 0.02],
    [0.1, 0.06, 0.08],
  ];
  for (const [x, y, z] of offsets) {
    const grape = enableShadow(new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat));
    grape.position.set(x * length * 1.4, y, z);
    group.add(grape);
  }
  addStem(group, -length * 0.28, 0.14, 0, 0.4, 0.16);
}

function addGenericBloom(group, length, item) {
  const bloom = item.bloom || {};
  const stem = enableShadow(
    new THREE.Mesh(
      cylinderAlongX(0.016, 0.022, length * 0.72, 8),
      new THREE.MeshStandardMaterial({ color: "#2f6a28", roughness: 0.7 }),
    ),
  );
  stem.position.x = -length * 0.08;
  group.add(stem);
  const headX = length / 2 - 0.12;
  const petalMat = new THREE.MeshPhysicalMaterial({
    color: bloom.color || item.tint,
    roughness: 0.48,
    side: THREE.DoubleSide,
    clearcoat: 0.15,
  });
  const count = bloom.count || 6;
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const petal = enableShadow(
      new THREE.Mesh(
        bloom.style === "egg"
          ? new THREE.SphereGeometry(0.12, 10, 8)
          : new THREE.SphereGeometry(0.11, 10, 8),
        petalMat,
      ),
    );
    petal.scale.set(bloom.style === "egg" ? 0.55 : 0.7, 0.18, bloom.style === "egg" ? 1.35 : 1.1);
    petal.position.set(headX, Math.sin(a) * 0.08, Math.cos(a) * 0.08);
    petal.rotation.z = bloom.style === "egg" ? 0.55 : 0.2;
    petal.rotation.y = a;
    group.add(petal);
  }
  const inner = enableShadow(
    new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 10, 8),
      new THREE.MeshStandardMaterial({ color: bloom.inner || "#f0c868", roughness: 0.55 }),
    ),
  );
  inner.position.x = headX + 0.02;
  group.add(inner);
}

function addSpikeItem(group, length, item) {
  const stem = enableShadow(
    new THREE.Mesh(
      cylinderAlongX(0.012, 0.018, length, 8),
      new THREE.MeshStandardMaterial({ color: "#2f6a28", roughness: 0.7 }),
    ),
  );
  group.add(stem);
  const bud = new THREE.MeshStandardMaterial({ color: item.tint || "#a070d0", roughness: 0.55 });
  for (let i = 0; i < 18; i += 1) {
    const t = 0.35 + (i / 18) * 0.58;
    const a = i * 1.7;
    const bead = enableShadow(new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), bud));
    bead.position.set((t - 0.5) * length, Math.sin(a) * 0.03, Math.cos(a) * 0.03);
    group.add(bead);
  }
}

function addItemBits(group, type, length) {
  const item = getItem(type);
  for (const bit of item.bits || []) {
    if (bit === "apple") addAppleBits(group, length);
    else if (bit === "pear") addPearBits(group, length);
    else if (bit === "orange") addOrangeBits(group, length);
    else if (bit === "lemon") addLemonBits(group, length);
    else if (bit === "strawberry") addStrawberrySeeds(group, length);
    else if (bit === "tulip") addTulipBloom(group, length, { side: new THREE.MeshStandardMaterial({ color: item.tint }) });
    else if (bit === "daisy") addDaisyHead(group, length);
    else if (bit === "sunflower") addSunflowerHead(group, length);
    else if (bit === "carrot") addCarrotTops(group, length);
    else if (bit === "cucumber") addCucumberBits(group, length);
    else if (bit === "corn") {
      addCornKernels(group, length);
      addCornHusk(group, length);
    } else if (bit === "eggplant") addEggplantCap(group, length);
    else if (bit === "bread") addBreadBits(group, length);
    else if (bit === "stemleaf") {
      const top = maxRadius(type, length) * 0.7;
      addStem(group, -length * 0.08, top + 0.08, 0, 0.2, 0.18);
      addLeaf(group, 0.08, top + 0.12, 0.04, 0.65, 1.2);
    } else if (bit === "fuzz") {
      const mat = new THREE.MeshStandardMaterial({ color: "#6a4a28", roughness: 0.9 });
      for (let i = 0; i < 24; i += 1) {
        const t = 0.1 + (i / 24) * 0.8;
        const a = i * 2.1;
        const r = radiusAt(type, t, length) * 0.92;
        const bump = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), mat);
        bump.position.set((t - 0.5) * length, Math.sin(a) * r, Math.cos(a) * r);
        group.add(bump);
      }
    } else if (bit === "calyx") {
      const x = -length / 2 + 0.02;
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), leafMat("#2f7a30"));
        leaf.scale.set(0.4, 0.1, 1.4);
        leaf.position.set(x, Math.sin(a) * 0.08, Math.cos(a) * 0.08);
        leaf.rotation.z = Math.PI / 2;
        leaf.rotation.y = a;
        group.add(leaf);
      }
    } else if (bit === "tops") addCarrotTops(group, length);
    else if (bit === "stem") addStem(group, 0, maxRadius(type, length) * 0.7, 0, 0.1, 0.14);
    else if (bit === "eyes") {
      const mat = new THREE.MeshStandardMaterial({ color: "#6a4a28", roughness: 0.8 });
      for (let i = 0; i < 8; i += 1) {
        const t = 0.2 + (i / 8) * 0.6;
        const a = i * 2.4;
        const r = radiusAt(type, t, length) * 0.9;
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), mat);
        eye.position.set((t - 0.5) * length, Math.sin(a) * r, Math.cos(a) * r);
        group.add(eye);
      }
    } else if (bit === "chips") {
      const mat = new THREE.MeshStandardMaterial({ color: "#4a2410", roughness: 0.7 });
      for (let i = 0; i < 9; i += 1) {
        const chip = enableShadow(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat));
        chip.scale.set(1, 0.35, 1.1);
        chip.position.set(((i % 3) - 1) * 0.12, 0.06, (Math.floor(i / 3) - 1) * 0.12);
        group.add(chip);
      }
    } else if (bit === "cap") {
      const cap = enableShadow(
        new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 14, 10),
          new THREE.MeshStandardMaterial({ color: "#c45a48", roughness: 0.62 }),
        ),
      );
      cap.scale.set(1.35, 0.55, 1.35);
      cap.position.y = maxRadius(type, length) * 0.55;
      group.add(cap);
    } else if (bit === "beak") {
      const beak = enableShadow(
        new THREE.Mesh(
          new THREE.ConeGeometry(0.05, 0.12, 8),
          new THREE.MeshStandardMaterial({ color: "#e07020", roughness: 0.5 }),
        ),
      );
      beak.rotation.z = -Math.PI / 2;
      beak.position.set(length * 0.28, 0.02, 0.08);
      group.add(beak);
    }
  }
}

function addSpecialProp(group, type, length) {
  const item = getItem(type);
  const tint = item.tint || "#cccccc";
  const metal = new THREE.MeshStandardMaterial({ color: "#9aa2aa", roughness: 0.32, metalness: 0.55 });
  const paint = new THREE.MeshStandardMaterial({ color: tint, roughness: item.glossy ? 0.35 : 0.62, metalness: 0.05 });
  const dark = new THREE.MeshStandardMaterial({ color: "#3a2a18", roughness: 0.72 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: tint,
    roughness: 0.12,
    transmission: 0.35,
    thickness: 0.2,
    transparent: true,
    opacity: 0.92,
  });

  const add = (geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    const mesh = enableShadow(new THREE.Mesh(geo, mat));
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.scale.set(sx, sy, sz);
    group.add(mesh);
    return mesh;
  };

  if (type === "juice") {
    add(new THREE.CylinderGeometry(0.16, 0.14, length * 0.85, 18), glass);
    add(new THREE.CylinderGeometry(0.155, 0.135, length * 0.55, 16), paint, 0, -0.04, 0);
    add(cylinderAlongX(0.012, 0.012, length * 0.7, 8), paint, 0.02, 0.22, 0, 0, 0, 0.35);
    add(new THREE.TorusGeometry(0.16, 0.012, 8, 18), metal, 0, length * 0.38, 0, Math.PI / 2, 0, 0);
    return;
  }
  if (type === "fruit_box" || type === "pastry_box") {
    add(new THREE.BoxGeometry(length, length * 0.42, length * 0.72), paint);
    add(new THREE.BoxGeometry(length * 1.02, 0.04, length * 0.74), dark, 0, length * 0.22, 0);
    add(new THREE.BoxGeometry(0.06, 0.02, length * 0.78), new THREE.MeshStandardMaterial({ color: "#e8c040" }), 0, length * 0.25, 0);
    return;
  }
  if (type === "watering_can") {
    add(new THREE.CylinderGeometry(0.16, 0.2, length * 0.7, 16), paint);
    add(new THREE.TorusGeometry(0.14, 0.025, 8, 16, Math.PI), dark, 0, 0.08, -0.18, Math.PI / 2, 0, 0);
    add(new THREE.CylinderGeometry(0.03, 0.05, 0.32, 8), paint, 0.22, 0.12, 0, 0, 0, -0.9);
    add(new THREE.SphereGeometry(0.07, 10, 8), metal, 0.36, 0.22, 0);
    return;
  }
  if (type === "sickle") {
    add(cylinderAlongX(0.03, 0.035, length * 0.55, 8), dark, -length * 0.12);
    add(new THREE.TorusGeometry(0.22, 0.035, 8, 18, Math.PI * 1.15), metal, length * 0.18, 0.08, 0, Math.PI / 2, 0, 0.4);
    return;
  }
  if (type === "hose") {
    add(new THREE.TorusGeometry(length * 0.28, 0.055, 10, 24), paint, 0, 0, 0, Math.PI / 2);
    add(new THREE.CylinderGeometry(0.05, 0.06, 0.18, 10), metal, length * 0.28, 0.04, 0, 0, 0, 1.1);
    return;
  }
  if (type === "fertilizer") {
    add(new THREE.BoxGeometry(length * 0.7, length * 0.85, length * 0.28), paint);
    add(new THREE.BoxGeometry(length * 0.72, 0.08, length * 0.3), dark, 0, length * 0.38, 0);
    return;
  }
  if (type === "rolling_pin") {
    add(cylinderAlongX(0.09, 0.09, length * 0.62, 14), paint);
    add(cylinderAlongX(0.03, 0.03, length * 0.22, 8), dark, -length * 0.4);
    add(cylinderAlongX(0.03, 0.03, length * 0.22, 8), dark, length * 0.4);
    return;
  }
  if (type === "candy_jar") {
    add(new THREE.CylinderGeometry(0.18, 0.16, length * 0.7, 18), glass);
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 16), paint, 0, length * 0.38, 0);
    for (let i = 0; i < 7; i += 1) {
      add(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshStandardMaterial({ color: i % 2 ? "#e04870" : "#48c870" }), (i % 3) * 0.06 - 0.06, -0.08, ((i * 0.4) % 0.12) - 0.06);
    }
    return;
  }
  if (type === "tin") {
    add(new THREE.CylinderGeometry(length * 0.38, length * 0.38, length * 0.28, 24), paint);
    add(new THREE.CylinderGeometry(length * 0.4, length * 0.4, 0.04, 24), metal, 0, length * 0.16, 0);
    return;
  }
  if (type === "scissors") {
    add(new THREE.BoxGeometry(length * 0.55, 0.04, 0.08), metal, 0.08, 0.03, 0, 0, 0, 0.18);
    add(new THREE.BoxGeometry(length * 0.55, 0.04, 0.08), metal, 0.08, -0.03, 0, 0, 0, -0.18);
    add(new THREE.TorusGeometry(0.07, 0.018, 8, 14), dark, -length * 0.28, 0.07, 0);
    add(new THREE.TorusGeometry(0.07, 0.018, 8, 14), dark, -length * 0.28, -0.07, 0);
    return;
  }
  if (type === "inkwell") {
    add(new THREE.CylinderGeometry(0.14, 0.16, 0.16, 16), paint);
    add(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12), glass, 0, 0.1, 0);
    add(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: "#0a1028" }), 0, 0.02, 0);
    return;
  }
  if (type === "cleaver") {
    add(new THREE.BoxGeometry(length * 0.55, length * 0.32, 0.04), metal, 0.1);
    add(cylinderAlongX(0.035, 0.04, length * 0.4, 8), dark, -length * 0.28);
    return;
  }
  if (type === "pan") {
    add(new THREE.CylinderGeometry(length * 0.38, length * 0.4, 0.06, 24), metal);
    add(new THREE.TorusGeometry(length * 0.4, 0.02, 8, 24), metal, 0, 0.04, 0);
    add(cylinderAlongX(0.025, 0.03, length * 0.45, 8), dark, length * 0.42);
    return;
  }
  if (type === "sauce") {
    add(new THREE.CylinderGeometry(0.09, 0.11, length * 0.7, 14), paint);
    add(new THREE.CylinderGeometry(0.03, 0.05, 0.16, 10), dark, 0, length * 0.38, 0);
    return;
  }
  if (type === "paper_bag") {
    add(new THREE.BoxGeometry(length * 0.55, length * 0.7, length * 0.28), paint);
    add(new THREE.BoxGeometry(length * 0.58, 0.04, length * 0.12), dark, 0, length * 0.38, 0.08);
    add(new THREE.BoxGeometry(length * 0.58, 0.04, length * 0.12), dark, 0, length * 0.38, -0.08);
    return;
  }
  if (type === "teddy") {
    add(new THREE.SphereGeometry(0.16, 14, 12), paint, 0, -0.04, 0);
    add(new THREE.SphereGeometry(0.12, 12, 10), paint, 0, 0.16, 0);
    add(new THREE.SphereGeometry(0.05, 8, 6), dark, 0.04, 0.18, 0.1);
    add(new THREE.SphereGeometry(0.05, 8, 6), dark, -0.04, 0.18, 0.1);
    add(new THREE.SphereGeometry(0.045, 8, 6), paint, 0.12, 0.24, 0);
    add(new THREE.SphereGeometry(0.045, 8, 6), paint, -0.12, 0.24, 0);
    return;
  }
  if (type === "hammer") {
    add(cylinderAlongX(0.03, 0.035, length * 0.75, 8), dark);
    add(new THREE.BoxGeometry(0.16, 0.12, 0.1), paint, length * 0.28);
    return;
  }
  if (type === "pickaxe") {
    add(cylinderAlongX(0.03, 0.035, length * 0.8, 8), dark);
    add(new THREE.BoxGeometry(0.42, 0.08, 0.08), metal, length * 0.28, 0.02, 0, 0, 0, 0.15);
    return;
  }
  if (type === "lantern") {
    add(new THREE.BoxGeometry(0.2, 0.28, 0.2), metal);
    add(new THREE.SphereGeometry(0.09, 12, 10), new THREE.MeshStandardMaterial({ color: "#ffe08a", emissive: "#ffb020", emissiveIntensity: 0.6 }));
    add(new THREE.BoxGeometry(0.22, 0.04, 0.22), dark, 0, 0.16, 0);
    add(new THREE.TorusGeometry(0.06, 0.012, 8, 12), metal, 0, 0.22, 0);
    return;
  }
  add(new THREE.BoxGeometry(length * 0.6, length * 0.4, length * 0.4), paint);
}

export function createWholeObject(type, length, materials) {
  const group = new THREE.Group();
  const item = getItem(type);
  const scanned = cloneFruitModel(type, length);
  if (scanned) {
    group.add(scanned);
  } else if (item.family === "banana" || type === "banana") addBanana(group, length, materials, type);
  else if (type === "pencil") addPencil(group, length, materials);
  else if (type === "crayon") addCrayon(group, length);
  else if (type === "eraser") addEraser(group, length);
  else if (type === "ruler" || item.family === "box") addBox(group, length, type, materials);
  else if (type === "chocolate") addChocolate(group, length);
  else if (type === "onigiri") addOnigiri(group, length);
  else if (type === "lollipop" || item.family === "lollipop") addLollipop(group, length);
  else if (type === "macaron") addMacaron(group, length);
  else if (type === "popsicle") addPopsicle(group, length);
  else if (item.family === "cake" || type === "cake") addCake(group, length, materials, type);
  else if (type === "cheese") addCheese(group, length);
  else if (type === "rose" || item.family === "rose") addRosePetals(group, length, materials);
  else if (item.family === "capsule") addCapsuleItem(group, length, item);
  else if (item.family === "torus") addTorusItem(group, length, item);
  else if (item.family === "cluster") addClusterItem(group, length, item);
  else if (item.family === "bloom") addGenericBloom(group, length, item);
  else if (item.family === "spike") addSpikeItem(group, length, item);
  else if (item.family === "prop") addSpecialProp(group, type, length);
  else {
    addLatheBody(group, type, length, materials);
    addItemBits(group, type, length);
  }

  group.position.y = objectHeight(type, length) / 2;
  group.userData = {
    type,
    length,
    radius: maxRadius(type, length),
    height: objectHeight(type, length),
    depth: objectDepth(type, length),
  };
  return group;
}

function planeBasis(normal) {
  const n = normal.clone().normalize();
  const u = new THREE.Vector3();
  if (Math.abs(n.y) < 0.92) u.crossVectors(n, new THREE.Vector3(0, 1, 0));
  else u.crossVectors(n, new THREE.Vector3(1, 0, 0));
  u.normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  return { n, u, v };
}

function projectToPlane(point, origin, u, v) {
  const o = point.clone().sub(origin);
  return { x: o.dot(u), y: o.dot(v) };
}

function uniqueUv(points, eps = 0.0008) {
  const out = [];
  for (const p of points) {
    if (!out.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < eps)) out.push(p);
  }
  return out;
}

function aabbPlaneUv(hx, hy, hz, n, d, origin, u, v) {
  const hits = [];
  const addEdge = (a, b) => {
    const da = n.dot(a) - d;
    const db = n.dot(b) - d;
    if (Math.abs(da) < 1e-6) hits.push(a.clone());
    if (da * db < 0) {
      const t = da / (da - db);
      hits.push(a.clone().lerp(b, t));
    }
  };
  for (const x of [-hx, hx]) {
    for (const y of [-hy, hy]) addEdge(new THREE.Vector3(x, y, -hz), new THREE.Vector3(x, y, hz));
  }
  for (const x of [-hx, hx]) {
    for (const z of [-hz, hz]) addEdge(new THREE.Vector3(x, -hy, z), new THREE.Vector3(x, hy, z));
  }
  for (const y of [-hy, hy]) {
    for (const z of [-hz, hz]) addEdge(new THREE.Vector3(-hx, y, z), new THREE.Vector3(hx, y, z));
  }
  const uv = uniqueUv(hits.map((p) => projectToPlane(p, origin, u, v)));
  if (uv.length < 3) return uv;
  const cx = uv.reduce((s, p) => s + p.x, 0) / uv.length;
  const cy = uv.reduce((s, p) => s + p.y, 0) / uv.length;
  uv.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  return uv;
}

function lathePlaneUv(type, length, n, d, origin, u, v) {
  const nyz = Math.hypot(n.y, n.z);
  const top = [];
  const bot = [];
  const steps = 48;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = (t - 0.5) * length;
    const r = radiusAt(type, t, length);
    if (r < 0.004) continue;
    const h = d - n.x * x;
    const delta = h / nyz;
    if (Math.abs(delta) >= r * 0.998) continue;
    const half = Math.sqrt(Math.max(0, r * r - delta * delta));
    const cy = (n.y / nyz) * delta;
    const cz = (n.z / nyz) * delta;
    const ty = -n.z / nyz;
    const tz = n.y / nyz;
    top.push(projectToPlane(new THREE.Vector3(x, cy + ty * half, cz + tz * half), origin, u, v));
    bot.push(projectToPlane(new THREE.Vector3(x, cy - ty * half, cz - tz * half), origin, u, v));
  }
  if (top.length < 2) return [];
  const ring = top.concat(bot.reverse());
  return uniqueUv(ring, 0.0004);
}

function meshFromUv(uv, origin, u, v, n, material) {
  const shape = new THREE.Shape();
  shape.moveTo(uv[0].x, uv[0].y);
  for (let i = 1; i < uv.length; i += 1) shape.lineTo(uv[i].x, uv[i].y);
  shape.closePath();
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n));
  mesh.position.copy(origin);
  return mesh;
}

export function createPlaneCap(type, length, normal, d, material) {
  const { n, u, v } = planeBasis(normal);
  const nd = d / (n.length() || 1);
  const origin = n.clone().multiplyScalar(nd);

  if (isFruitType(type)) {
    const r = Math.max(0.05, maxRadius(type, length) * 1.05);
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(r, 36), material);
    mesh.position.copy(origin);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n));
    return mesh;
  }

  if (BOX_TYPES.has(type)) {
    const spec = CONFIG.catalog[type];
    const uv = aabbPlaneUv(length / 2, spec.height / 2, spec.depth / 2, n, nd, origin, u, v);
    if (uv.length >= 3) return meshFromUv(uv, origin, u, v, n, material);
  } else if (type === "cake") {
    const r = length * 0.46;
    const hy = CONFIG.catalog.cake.height / 2;
    const uv = aabbPlaneUv(r, hy, r, n, nd, origin, u, v);
    if (uv.length >= 3) return meshFromUv(uv, origin, u, v, n, material);
  } else {
    const nyz = Math.hypot(n.y, n.z);
    if (nyz < 0.06 && Math.abs(n.x) > 0.35) {
      const x = n.x !== 0 ? nd / n.x : 0;
      const t = clamp(x / Math.max(0.08, length) + 0.5, 0.02, 0.98);
      const r = Math.max(0.018, radiusAt(type, t, length));
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(r, 28), material);
      mesh.position.set(x, 0, 0);
      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n));
      return mesh;
    }
    const uv = lathePlaneUv(type, length, n, nd, origin, u, v);
    if (uv.length >= 3) return meshFromUv(uv, origin, u, v, n, material);
  }

  const fallback = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), material);
  fallback.position.copy(origin);
  fallback.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(u, v, n));
  return fallback;
}

export function createHorizontalCap(type, length, yLocal, material) {
  const shape = new THREE.Shape();
  if (BOX_TYPES.has(type)) {
    const spec = CONFIG.catalog[type];
    const hw = length / 2;
    const hd = spec.depth / 2;
    shape.moveTo(-hw, -hd);
    shape.lineTo(hw, -hd);
    shape.lineTo(hw, hd);
    shape.lineTo(-hw, hd);
    shape.closePath();
  } else if (type === "cake") {
    const r = length * 0.46;
    shape.absarc(0, 0, r, 0, Math.PI * 2, false);
  } else {
    const steps = 28;
    const pts = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const r = radiusAt(type, t, length);
      const w = Math.sqrt(Math.max(0, r * r - yLocal * yLocal));
      pts.push({ x: -length / 2 + t * length, w });
    }
    const usable = pts.filter((p) => p.w > 0.004);
    if (usable.length < 2) {
      shape.moveTo(-0.03, -0.03);
      shape.lineTo(0.03, -0.03);
      shape.lineTo(0.03, 0.03);
      shape.lineTo(-0.03, 0.03);
      shape.closePath();
    } else {
      shape.moveTo(usable[0].x, usable[0].w);
      for (let i = 1; i < usable.length; i += 1) shape.lineTo(usable[i].x, usable[i].w);
      for (let i = usable.length - 1; i >= 0; i -= 1) shape.lineTo(usable[i].x, -usable[i].w);
      shape.closePath();
    }
  }
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = yLocal;
  return mesh;
}

export function objectExtents(type, length) {
  return {
    length,
    height: objectHeight(type, length),
    depth: objectDepth(type, length),
  };
}
