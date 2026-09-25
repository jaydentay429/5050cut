/**
 * 切开两侧占比。按切面法线方向上模型两端之间的位置，
 * 刀过正中就是对半（玩家看见的「中间」）。
 * 三角面有向体积对开口/薄壳 GLB 会把杯子+吸管判成严重偏心，不能用来打分。
 */
import * as THREE from "three";

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

export function volumeShareFromObject(root, nx, ny, nz, d) {
  if (!root) return null;
  const nlen = Math.hypot(nx, ny, nz) || 1;
  nx /= nlen;
  ny /= nlen;
  nz /= nlen;
  d /= nlen;

  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const mat = new THREE.Matrix4();
  const v = new THREE.Vector3();

  let min = Infinity;
  let max = -Infinity;

  root.traverse((node) => {
    if (!node.isMesh || !node.geometry?.attributes?.position) return;
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
  const span = max - min;
  const left = Math.max(0, Math.min(span, d - min));
  const right = span - left;
  return packShare(left, right);
}
