import { CONFIG } from "./config.js";

function almostEqual(a, b, eps = 0.6) {
  return Math.abs(a - b) < eps;
}

/** 无限直线 p1→p2 与线段 a→b 的交点。不相交则返回 null。 */
function lineIntersectSegment(p1, p2, a, b) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const denom = dx * ey - dy * ex;
  if (Math.abs(denom) < 1e-8) return null;

  const sx = a.x - p1.x;
  const sy = a.y - p1.y;
  const t = (sx * ey - sy * ex) / denom;
  const u = (sx * dy - sy * dx) / denom;
  if (u < -1e-6 || u > 1 + 1e-6) return null;

  return { x: p1.x + t * dx, y: p1.y + t * dy };
}

function uniquePoints(points) {
  const result = [];
  for (const point of points) {
    if (!result.some((other) => almostEqual(other.x, point.x) && almostEqual(other.y, point.y))) {
      result.push(point);
    }
  }
  return result;
}

function lineRectIntersections(start, end, rect) {
  const { x, y, width, height } = rect;
  const corners = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
  const edges = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ];

  const hits = [];
  for (const [a, b] of edges) {
    const hit = lineIntersectSegment(start, end, a, b);
    if (hit) hits.push(hit);
  }
  return uniquePoints(hits);
}

/**
 * 屏幕上这条线有没有划过物体框。任意角度都行。
 */
export function evaluateCut(stroke, sliceObject) {
  if (!stroke || !sliceObject) {
    return { hit: false, reason: "invalid" };
  }

  const { start, end } = stroke;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);

  if (length < CONFIG.cut.minStrokeLength) {
    return { hit: false, reason: "too_short" };
  }

  const intersections = lineRectIntersections(start, end, sliceObject);
  if (intersections.length < 2) {
    return { hit: false, reason: "miss" };
  }

  const chord = Math.hypot(
    intersections[1].x - intersections[0].x,
    intersections[1].y - intersections[0].y,
  );
  if (chord < CONFIG.cut.minChordLength) {
    return { hit: false, reason: "graze" };
  }

  const cutX = (intersections[0].x + intersections[1].x) / 2;
  const cutY = (intersections[0].y + intersections[1].y) / 2;

  return {
    hit: true,
    cutX,
    cutY,
    start: { ...start },
    end: { ...end },
  };
}
