/** Minimal 2D geometry helpers for GGE biplot rendering. */

export interface Pt {
  x: number;
  y: number;
}

/** Andrew's monotone chain convex hull. Returns CCW polygon. */
export function convexHull<T extends Pt>(points: T[]): T[] {
  const pts = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  if (pts.length <= 2) return pts;
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: T[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: T[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/** Spearman rank correlation; expects equal-length arrays of ranks. */
export function spearman(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 2 || a.length !== b.length) return 0;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - meanA;
    const y = b[i] - meanB;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  if (da === 0 || db === 0) return 0;
  return num / Math.sqrt(da * db);
}

/**
 * Which-won-where sector boundaries (Yan et al. 2000): for each edge A->B of a
 * CCW convex hull, the boundary is the ray from the origin along the edge's
 * OUTWARD normal (the perpendicular from the origin to that polygon side).
 * Mirrors gge_biplot.which_won_where on the backend; used only as a fallback
 * when the response does not carry `sector_boundaries`.
 */
export function sectorBoundaryDirections(hull: Pt[]): Pt[] {
  if (hull.length < 3) return [];
  const out: Pt[] = [];
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const m = Math.sqrt(dx * dx + dy * dy);
    if (m < 1e-12) continue;
    out.push({ x: dy / m, y: -dx / m });
  }
  return out;
}
