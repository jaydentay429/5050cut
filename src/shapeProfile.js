/**
 * 沿长轴 t∈[0,1] 的半径轮廓。体积积分和旋转体网格共用这一份。
 */

import { CONFIG } from "./config.js?v=105";
import { boxTypeSet, getItem } from "./worlds.js?v=102";
import { fruitModelScale, fruitRestSize } from "./fruitAssets.js?v=123";

export function axisLength(type, requested) {
  const item = getItem(type);
  const appleFull = CONFIG.scene.fruitAppleLength ?? 0.68;
  const lo = CONFIG.scene.fruitScaleMin ?? 0.3;
  const hi = CONFIG.scene.fruitScaleMax ?? 2.75;
  const rel = Math.min(hi, Math.max(lo, item.realScale ?? 1));
  const shrink = Math.min(1, (requested || appleFull) / (CONFIG.scene.baseLength || 1));
  return appleFull * rel * shrink;
}

function sphereRadius(u, length, squash = 1) {
  const R = length * 0.5;
  const x = (u - 0.5) * length;
  const rr = R * R - x * x;
  return rr > 0 ? Math.sqrt(rr) * squash : 0.012;
}

export function bananaRadiusAt(u, radius = CONFIG.catalog.banana?.radius ?? 0.22) {
  const t = Math.min(1, Math.max(0, u));
  const belly = Math.pow(Math.sin(Math.PI * t), 0.58);
  const stem = t < 0.1 ? 0.2 + 0.8 * (t / 0.1) ** 0.75 : 1;
  const blossom = t > 0.8 ? Math.max(0.12, ((1 - t) / 0.2) ** 1.08) : 1;
  return radius * (0.16 + 0.84 * belly) * stem * blossom;
}

function radiusForProfile(profile, u, L, item) {
  if (profile === "apple") return sphereRadius(u, L, 0.97);
  if (profile === "orange") return sphereRadius(u, L, 0.86);
  if (profile === "peach") return sphereRadius(u, L, 0.94);
  if (profile === "kiwi") return sphereRadius(u, L, 0.9);
  if (profile === "mango") {
    const a = L * 0.5;
    const b = L * 0.28;
    const x = (u - 0.5) * L;
    const cheek = 0.72 + 0.28 * Math.sin(Math.PI * u);
    const rr = 1 - (x * x) / (a * a);
    return rr > 0 ? Math.max(0.02, b * Math.sqrt(rr) * cheek) : 0.02;
  }

  if (profile === "lemon") {
    const a = L * 0.5;
    const b = L * 0.32;
    const x = (u - 0.5) * L;
    const nipple = u < 0.08 || u > 0.92 ? 0.72 : 1;
    const rr = 1 - (x * x) / (a * a);
    return rr > 0 ? Math.max(0.02, b * Math.sqrt(rr) * nipple) : 0.02;
  }

  if (profile === "pear") {
    const neck = 0.075;
    const mid = 0.16;
    const belly = 0.38;
    if (u < 0.14) return neck + (mid - neck) * (u / 0.14);
    if (u < 0.36) return mid + (0.2 - mid) * ((u - 0.14) / 0.22);
    if (u < 0.78) {
      const s = (u - 0.36) / 0.42;
      const e = s * s * (3 - 2 * s);
      return 0.2 + (belly - 0.2) * e;
    }
    const s = (u - 0.78) / 0.22;
    return belly * Math.sqrt(Math.max(0, 1 - s * s));
  }

  if (profile === "strawberry") {
    const peak = 0.36;
    if (u < 0.22) {
      const s = u / 0.22;
      return 0.16 + (peak - 0.16) * Math.sin((s * Math.PI) / 2);
    }
    if (u < 0.58) return peak * (1 - (u - 0.22) * 0.06);
    const s = (u - 0.58) / 0.42;
    return Math.max(0.045, peak * 0.96 * Math.sqrt(Math.max(0, 1 - s * s)));
  }

  if (profile === "banana") return bananaRadiusAt(u, item.radius ?? 0.22);

  if (profile === "rose") {
    if (u < 0.82) return 0.03;
    const s = (u - 0.82) / 0.18;
    return 0.03 + 0.04 * Math.pow(Math.sin(s * Math.PI), 0.9);
  }

  if (profile === "tulip") {
    if (u < 0.68) return 0.026;
    const s = (u - 0.68) / 0.32;
    return 0.026 + 0.1 * Math.pow(Math.sin(s * Math.PI), 0.9);
  }

  if (profile === "daisy") {
    if (u < 0.86) return 0.018;
    const s = (u - 0.86) / 0.14;
    return 0.018 + 0.045 * Math.sin(s * Math.PI);
  }

  if (profile === "pencil") {
    if (u < 0.08) return 0.055;
    if (u < 0.84) return 0.07;
    return Math.max(0.012, 0.07 * (1 - (u - 0.84) / 0.16));
  }

  if (profile === "crayon") {
    if (u > 0.82) return Math.max(0.02, 0.12 * (1 - (u - 0.82) / 0.18));
    return 0.12;
  }

  if (profile === "carrot") {
    const peak = 0.13;
    if (u < 0.12) return 0.08 + (peak - 0.08) * (u / 0.12);
    return Math.max(0.02, peak * (1 - (u - 0.12) / 0.88) ** 0.78);
  }

  if (profile === "cucumber") {
    const peak = 0.125;
    if (u < 0.1) return 0.045 + (peak - 0.045) * (u / 0.1);
    if (u > 0.9) return 0.05 + (peak - 0.05) * ((1 - u) / 0.1);
    return peak + 0.008 * Math.sin(u * Math.PI);
  }

  if (profile === "corn") {
    if (u < 0.1) return 0.035 + 0.1 * (u / 0.1);
    if (u > 0.86) return Math.max(0.03, 0.135 * (1 - (u - 0.86) / 0.14) ** 0.72);
    return 0.135;
  }

  if (profile === "eggplant") {
    const peak = 0.22;
    if (u < 0.12) return 0.05 + 0.04 * (u / 0.12);
    if (u < 0.38) return 0.09 + (peak - 0.09) * ((u - 0.12) / 0.26);
    const s = (u - 0.38) / 0.62;
    return Math.max(0.03, peak * Math.sqrt(Math.max(0, 1 - s * s)));
  }

  if (profile === "cake") return L * 0.46;
  if (profile === "bread") {
    const belly = 0.22;
    if (u < 0.14) return 0.09 + (belly - 0.09) * Math.sin((u / 0.14) * (Math.PI / 2));
    if (u > 0.86) return 0.09 + (belly - 0.09) * Math.sin(((1 - u) / 0.14) * (Math.PI / 2));
    return belly + 0.018 * Math.sin((u - 0.14) * Math.PI);
  }
  if (profile === "cheese") return L * 0.22;

  if (profile === "sunflower") {
    if (u < 0.82) return 0.02;
    const s = (u - 0.82) / 0.18;
    return 0.02 + 0.08 * Math.sin(s * Math.PI);
  }

  if (profile === "lollipop") {
    if (u < 0.62) return 0.028;
    const s = (u - 0.62) / 0.38;
    return 0.028 + 0.2 * Math.sin(Math.min(1, s) * Math.PI);
  }

  if (profile === "macaron") return 0.2 * Math.sin(Math.PI * Math.min(1, Math.max(0.04, u)));
  if (profile === "popsicle") return u > 0.78 ? 0.03 : 0.09;

  if (profile === "onigiri") return 0.16;
  if (profile === "chocolate") return 0.04;

  if (profile === "ruler") return 0.02;
  if (profile === "eraser") return 0.09;

  return sphereRadius(u, L, 0.9);
}

export function radiusAt(type, t, length) {
  const u = Math.min(1, Math.max(0, t));
  const item = getItem(type);
  if (item.family === "capsule") {
    const r = item.radius ?? 0.08;
    if (u < 0.12) {
      const s = 1 - u / 0.12;
      return Math.max(0.01, r * Math.sqrt(Math.max(0, 1 - s * s)));
    }
    if (u > 0.88) {
      const s = (u - 0.88) / 0.12;
      return Math.max(0.01, r * Math.sqrt(Math.max(0, 1 - s * s)));
    }
    return r;
  }
  if (item.family === "torus") return (item.height ?? 0.2) * 0.55;
  if (item.family === "cluster") return (item.height ?? 0.28) * 0.7;
  return radiusForProfile(item.profile || type, u, length, item);
}

export function maxRadius(type, length) {
  let peak = 0.05;
  for (let i = 0; i <= 40; i += 1) {
    peak = Math.max(peak, radiusAt(type, i / 40, length));
  }
  return peak;
}

/**
 * 物体竖直方向的总高。catalog.js（建模/摆放）和 volume.js（体积积分）都要用同一份数值，
 * 否则视觉上的切面和算出来的体积占比会对不上。
 */
export function objectHeight(type, length) {
  const rest = fruitRestSize(type);
  if (rest) return rest.y * fruitModelScale(type, length);
  const item = getItem(type);
  const spec = CONFIG.catalog[type] || {};
  if (item.height != null) return item.height;
  if (spec.height != null) return spec.height;
  if (item.family === "banana" || type === "banana") {
    const r = spec.radius ?? item.radius ?? 0.22;
    const b = spec.bend ?? item.bend ?? 0.86;
    return r * 2 + b * 0.9;
  }
  if (item.family === "capsule") return (item.radius ?? 0.08) * 2;
  if (item.family === "torus") return item.height ?? 0.22;
  if (type === "bread") return maxRadius(type, length) * 2.2;
  const squash = item.squashY ?? (type === "apple" ? 0.88 : type === "orange" ? 0.92 : 1);
  return maxRadius(type, length) * 2 * squash;
}

export const BOX_TYPES = boxTypeSet();
