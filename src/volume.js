/**
 * 切开后两边体积。几何中点 ≠ 体积中点（梨、草莓、花尤其明显）。
 * 任意平面：nx x + ny y + nz z = d（物体局部坐标）。
 */
import { CONFIG } from "./config.js";
import { BOX_TYPES, maxRadius, objectHeight, radiusAt } from "./shapeProfile.js";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function circleAbove(radius, y) {
  const r = Math.max(0.001, radius);
  if (y <= -r) return Math.PI * r * r;
  if (y >= r) return 0;
  return r * r * Math.acos(y / r) - y * Math.sqrt(r * r - y * y);
}

function packShare(left, right) {
  const total = left + right || 1;
  return {
    left,
    right,
    total,
    leftShare: left / total,
    rightShare: right / total,
  };
}

export function volumeShare(type, ratio, length, axis = "x") {
  const cut = clamp(ratio, 0.001, 0.999);
  const height = objectHeight(type, length);
  if (axis === "y") {
    return volumeSharePlane(type, length, 0, 1, 0, (cut - 0.5) * height);
  }
  return volumeSharePlane(type, length, 1, 0, 0, (cut - 0.5) * length);
}

/** 平面 nx x + ny y + nz z = d 两侧体积。left = 法线负侧。 */
export function volumeSharePlane(type, length, nx, ny, nz, d) {
  const nlen = Math.hypot(nx, ny, nz) || 1;
  nx /= nlen;
  ny /= nlen;
  nz /= nlen;
  d /= nlen;

  let left = 0;
  let right = 0;

  if (BOX_TYPES.has(type)) {
    const spec = CONFIG.catalog[type];
    const hx = length / 2;
    const hy = spec.height / 2;
    const hz = spec.depth / 2;
    const gx = 28;
    const gy = 10;
    const gz = 10;
    const cell = (length / gx) * (spec.height / gy) * (spec.depth / gz);
    for (let i = 0; i < gx; i += 1) {
      const x = -hx + ((i + 0.5) / gx) * length;
      for (let j = 0; j < gy; j += 1) {
        const y = -hy + ((j + 0.5) / gy) * spec.height;
        for (let k = 0; k < gz; k += 1) {
          const z = -hz + ((k + 0.5) / gz) * spec.depth;
          if (nx * x + ny * y + nz * z < d) left += cell;
          else right += cell;
        }
      }
    }
    return packShare(left, right);
  }

  if (type === "cake") {
    const r = length * 0.46;
    const hy = CONFIG.catalog.cake.height / 2;
    const gx = 22;
    const gy = 12;
    const gz = 22;
    const cell = ((2 * r) / gx) * ((2 * hy) / gy) * ((2 * r) / gz);
    for (let i = 0; i < gx; i += 1) {
      const x = -r + ((i + 0.5) / gx) * 2 * r;
      for (let j = 0; j < gy; j += 1) {
        const y = -hy + ((j + 0.5) / gy) * 2 * hy;
        for (let k = 0; k < gz; k += 1) {
          const z = -r + ((k + 0.5) / gz) * 2 * r;
          if (x * x + z * z > r * r) continue;
          if (nx * x + ny * y + nz * z < d) left += cell;
          else right += cell;
        }
      }
    }
    return packShare(left, right);
  }

  const steps = 80;
  const dx = length / steps;
  for (let i = 0; i < steps; i += 1) {
    const t = (i + 0.5) / steps;
    const x = (t - 0.5) * length;
    const r = radiusAt(type, t, length);
    if (r < 0.004) continue;
    const area = Math.PI * r * r;
    const nyz = Math.hypot(ny, nz);
    if (nyz < 1e-5) {
      if (nx * x < d) left += area * dx;
      else right += area * dx;
    } else {
      const delta = (d - nx * x) / nyz;
      const pos = circleAbove(r, delta);
      right += pos * dx;
      left += (area - pos) * dx;
    }
  }
  return packShare(left, right);
}

export function volumeDeviation(type, ratio, length, axis = "x") {
  return Math.abs(volumeShare(type, ratio, length, axis).leftShare - 0.5);
}

export function volumeDeviationPlane(type, length, nx, ny, nz, d) {
  return Math.abs(volumeSharePlane(type, length, nx, ny, nz, d).leftShare - 0.5);
}
