/**
 * 沿长轴 t∈[0,1] 的半径轮廓。体积积分和旋转体网格共用这一份。
 */

import { CONFIG } from "./config.js";

const ROUND = new Set(["apple", "orange"]);

export function axisLength(type, requested) {
  if (ROUND.has(type)) return Math.min(requested * 0.48, 1.12);
  if (type === "pear") return Math.min(requested * 0.72, 1.72);
  if (type === "lemon") return Math.min(requested * 0.54, 1.28);
  if (type === "banana") return Math.min(requested * 0.62, 1.48);
  if (type === "strawberry") return Math.min(requested * 0.46, 1.05);
  if (type === "eraser") return Math.min(requested * 0.4, 0.95);
  if (type === "crayon") return Math.min(requested * 0.52, 1.28);
  if (type === "rose") return requested * 0.78;
  if (type === "tulip" || type === "daisy" || type === "sunflower") return requested * 0.9;
  if (type === "carrot") return Math.min(requested * 0.7, 1.55);
  if (type === "cucumber") return Math.min(requested * 0.78, 1.72);
  if (type === "corn") return Math.min(requested * 0.62, 1.42);
  if (type === "eggplant") return Math.min(requested * 0.7, 1.58);
  if (type === "cake") return Math.min(requested * 0.48, 1.12);
  if (type === "bread") return Math.min(requested * 0.72, 1.65);
  if (type === "cheese") return Math.min(requested * 0.42, 0.98);
  if (type === "onigiri") return Math.min(requested * 0.42, 0.95);
  if (type === "lollipop") return Math.min(requested * 0.72, 1.55);
  if (type === "chocolate") return Math.min(requested * 0.42, 0.98);
  if (type === "macaron") return Math.min(requested * 0.38, 0.88);
  if (type === "popsicle") return Math.min(requested * 0.55, 1.22);
  return requested;
}

function sphereRadius(u, length, squash = 1) {
  const R = length * 0.5;
  const x = (u - 0.5) * length;
  const rr = R * R - x * x;
  return rr > 0 ? Math.sqrt(rr) * squash : 0.012;
}

export function bananaRadiusAt(u, radius = CONFIG.catalog.banana.radius) {
  const t = Math.min(1, Math.max(0, u));
  const belly = Math.pow(Math.sin(Math.PI * t), 0.58);
  const stem = t < 0.1 ? 0.2 + 0.8 * (t / 0.1) ** 0.75 : 1;
  const blossom = t > 0.8 ? Math.max(0.12, ((1 - t) / 0.2) ** 1.08) : 1;
  return radius * (0.16 + 0.84 * belly) * stem * blossom;
}

export function radiusAt(type, t, length) {
  const u = Math.min(1, Math.max(0, t));
  const L = length;

  if (type === "apple") return sphereRadius(u, L, 0.97);
  if (type === "orange") return sphereRadius(u, L, 1.06);

  if (type === "lemon") {
    const a = L * 0.5;
    const b = L * 0.32;
    const x = (u - 0.5) * L;
    const nipple = u < 0.08 || u > 0.92 ? 0.72 : 1;
    const rr = 1 - (x * x) / (a * a);
    return rr > 0 ? Math.max(0.02, b * Math.sqrt(rr) * nipple) : 0.02;
  }

  if (type === "pear") {
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

  if (type === "strawberry") {
    const peak = 0.36;
    if (u < 0.22) {
      const s = u / 0.22;
      return 0.16 + (peak - 0.16) * Math.sin((s * Math.PI) / 2);
    }
    if (u < 0.58) return peak * (1 - (u - 0.22) * 0.06);
    const s = (u - 0.58) / 0.42;
    return Math.max(0.045, peak * 0.96 * Math.sqrt(Math.max(0, 1 - s * s)));
  }

  if (type === "banana") return bananaRadiusAt(u);

  if (type === "rose") {
    if (u < 0.82) return 0.03;
    const s = (u - 0.82) / 0.18;
    return 0.03 + 0.04 * Math.pow(Math.sin(s * Math.PI), 0.9);
  }

  if (type === "tulip") {
    if (u < 0.68) return 0.026;
    const s = (u - 0.68) / 0.32;
    return 0.026 + 0.1 * Math.pow(Math.sin(s * Math.PI), 0.9);
  }

  if (type === "daisy") {
    if (u < 0.86) return 0.018;
    const s = (u - 0.86) / 0.14;
    return 0.018 + 0.045 * Math.sin(s * Math.PI);
  }

  if (type === "pencil") {
    if (u < 0.08) return 0.055;
    if (u < 0.84) return 0.07;
    return Math.max(0.012, 0.07 * (1 - (u - 0.84) / 0.16));
  }

  if (type === "crayon") {
    if (u > 0.82) return Math.max(0.02, 0.12 * (1 - (u - 0.82) / 0.18));
    return 0.12;
  }

  if (type === "carrot") {
    const peak = 0.13;
    if (u < 0.12) return 0.08 + (peak - 0.08) * (u / 0.12);
    return Math.max(0.02, peak * (1 - (u - 0.12) / 0.88) ** 0.78);
  }

  if (type === "cucumber") {
    const peak = 0.125;
    if (u < 0.1) return 0.045 + (peak - 0.045) * (u / 0.1);
    if (u > 0.9) return 0.05 + (peak - 0.05) * ((1 - u) / 0.1);
    return peak + 0.008 * Math.sin(u * Math.PI);
  }

  if (type === "corn") {
    if (u < 0.1) return 0.035 + 0.1 * (u / 0.1);
    if (u > 0.86) return Math.max(0.03, 0.135 * (1 - (u - 0.86) / 0.14) ** 0.72);
    return 0.135;
  }

  if (type === "eggplant") {
    const peak = 0.22;
    if (u < 0.12) return 0.05 + 0.04 * (u / 0.12);
    if (u < 0.38) return 0.09 + (peak - 0.09) * ((u - 0.12) / 0.26);
    const s = (u - 0.38) / 0.62;
    return Math.max(0.03, peak * Math.sqrt(Math.max(0, 1 - s * s)));
  }

  if (type === "cake") return L * 0.46;
  if (type === "bread") {
    const belly = 0.22;
    if (u < 0.14) return 0.09 + (belly - 0.09) * Math.sin((u / 0.14) * (Math.PI / 2));
    if (u > 0.86) return 0.09 + (belly - 0.09) * Math.sin(((1 - u) / 0.14) * (Math.PI / 2));
    return belly + 0.018 * Math.sin((u - 0.14) * Math.PI);
  }
  if (type === "cheese") return L * 0.22;

  if (type === "sunflower") {
    if (u < 0.82) return 0.02;
    const s = (u - 0.82) / 0.18;
    return 0.02 + 0.08 * Math.sin(s * Math.PI);
  }

  if (type === "lollipop") {
    if (u < 0.62) return 0.028;
    const s = (u - 0.62) / 0.38;
    return 0.028 + 0.2 * Math.sin(Math.min(1, s) * Math.PI);
  }

  if (type === "macaron") return 0.2 * Math.sin(Math.PI * Math.min(1, Math.max(0.04, u)));
  if (type === "popsicle") return u > 0.78 ? 0.03 : 0.09;

  if (type === "onigiri") return 0.16;
  if (type === "chocolate") return 0.04;

  if (type === "ruler") return 0.02;
  if (type === "eraser") return 0.09;

  return 0.2;
}

export function maxRadius(type, length) {
  let peak = 0.05;
  for (let i = 0; i <= 40; i += 1) {
    peak = Math.max(peak, radiusAt(type, i / 40, length));
  }
  return peak;
}

export const BOX_TYPES = new Set(["ruler", "eraser", "chocolate", "onigiri", "popsicle", "cheese"]);
