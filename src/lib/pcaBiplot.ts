/**
 * PCA biplot geometry (Manus PCA audit D07, D12).
 *
 * Two explicitly labelled conventions; the API's two loading types are never mixed:
 *
 *  - "correlation" (default): genotype points are STANDARDISED scores t_k / sqrt(lambda_k) (unit variance per axis);
 *    trait arrows are CORRELATION LOADINGS r_jk = corr(trait j, PC k) (API `correlation_loadings`).  In the full space
 *    each arrow has length 1 and the inner product of two arrows equals the correlation between the traits; in a
 *    plane, arrow length = sqrt(r_ja^2 + r_jb^2) shows how well the trait is represented, and angles approximate
 *    correlations only for well-represented (long) arrows.  A unit circle marks length 1.
 *  - "distance": genotype points are the PC SCORES T = ZV; trait arrows are the unit-length EIGENVECTOR coefficients
 *    V (API `loadings`) multiplied by one disclosed display factor.  Distances between points approximate distances
 *    between genotypes in the (standardised) trait space; arrow angles do NOT approximate trait correlations.
 *
 * Both conventions are drawn with one data-unit-to-pixel scale on both axes (equal physical units), and two
 * different components are always plotted.
 */

export type BiplotConvention = "correlation" | "distance";

export interface BiplotInput {
  eigenvalues?: number[] | null;
  variance_explained: number[];
  loadings: Record<string, number[]>;
  correlation_loadings?: Record<string, number[]> | null;
  scores: { genotype: string; scores: number[] }[];
}

export interface BiplotPoint { genotype: string; x: number; y: number }
export interface BiplotVector { trait: string; x: number; y: number; rawX: number; rawY: number; planeLength: number }

export interface BiplotGeometry {
  convention: BiplotConvention;
  a: number;
  b: number;
  points: BiplotPoint[];
  vectors: BiplotVector[];
  /** Factor applied to every arrow (and the unit circle) for display. */
  arrowScale: number;
  /** Half-width of the square data window, identical on both axes. */
  extent: number;
  /** Radius of the drawn unit circle in data units (correlation convention only). */
  unitCircleRadius: number | null;
  vectorKind: string;
  pointKind: string;
  description: string;
}

/** Two distinct component indices in range; if both requested are equal, the second moves to the next component. */
export function distinctComponents(a: number, b: number, nComponents: number): [number, number] | null {
  if (nComponents < 2) return null;
  const ca = Math.min(Math.max(0, a), nComponents - 1);
  let cb = Math.min(Math.max(0, b), nComponents - 1);
  if (cb === ca) cb = ca === 0 ? 1 : 0;
  return [ca, cb];
}

export function buildBiplot(result: BiplotInput, aReq: number, bReq: number, convention: BiplotConvention): BiplotGeometry | null {
  const nc = result.variance_explained.length;
  const pair = distinctComponents(aReq, bReq, nc);
  if (!pair) return null;
  const [a, b] = pair;
  const ev = result.eigenvalues ?? [];
  const useCorrelation = convention === "correlation" && !!result.correlation_loadings && ev.length > Math.max(a, b);
  const conv: BiplotConvention = useCorrelation ? "correlation" : "distance";

  const sa = useCorrelation ? Math.sqrt(ev[a]) : 1;
  const sb = useCorrelation ? Math.sqrt(ev[b]) : 1;
  const points = result.scores.map((s) => ({ genotype: s.genotype, x: (s.scores[a] ?? 0) / sa, y: (s.scores[b] ?? 0) / sb }));
  const source = useCorrelation ? result.correlation_loadings! : result.loadings;
  const raw = Object.entries(source).map(([trait, v]) => ({ trait, rawX: v[a] ?? 0, rawY: v[b] ?? 0 }));

  const maxPoint = Math.max(1e-12, ...points.flatMap((p) => [Math.abs(p.x), Math.abs(p.y)]));
  const maxArrow = Math.max(1e-12, ...raw.map((r) => Math.hypot(r.rawX, r.rawY)), useCorrelation ? 1 : 0);
  // One factor for all arrows so that their relative lengths and angles are preserved.
  const arrowScale = (0.85 * maxPoint) / maxArrow;
  const vectors = raw.map((r) => ({ ...r, x: r.rawX * arrowScale, y: r.rawY * arrowScale, planeLength: Math.hypot(r.rawX, r.rawY) }));
  const unitCircleRadius = useCorrelation ? arrowScale : null;
  const extent = 1.12 * Math.max(maxPoint, ...vectors.map((v) => Math.max(Math.abs(v.x), Math.abs(v.y))), unitCircleRadius ?? 0);

  const fmt = (v: number) => Number(v.toPrecision(3)).toString();
  const vectorKind = useCorrelation
    ? "correlation loadings (correlation of each trait with the plotted components)"
    : "eigenvector coefficients (unit-length loadings)";
  const pointKind = useCorrelation ? "standardised scores (score / √eigenvalue)" : "principal-component scores";
  const description = useCorrelation
    ? `Correlation biplot. Points are ${pointKind}; arrows are ${vectorKind}, drawn from the origin and multiplied by ${fmt(arrowScale)} for display, with the dashed circle marking correlation 1. ` +
      "Arrow length shows how well a trait is represented in this plane (1 = fully). The angle between two long arrows approximates the correlation between those traits; for short arrows it does not. " +
      "Both axes use the same scale."
    : `Distance biplot. Points are ${pointKind}; arrows are ${vectorKind} multiplied by ${fmt(arrowScale)} for display. ` +
      "Distances between points approximate distances between genotypes in the analysed trait space. Arrow angles are NOT trait correlations. Both axes use the same scale.";
  return { convention: conv, a, b, points, vectors, arrowScale, extent, unitCircleRadius, vectorKind, pointKind, description };
}

/** Nice tick values within [-extent, extent]. */
export function biplotTicks(extent: number, count = 5): number[] {
  const raw = (2 * extent) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const ticks: number[] = [];
  for (let t = Math.ceil(-extent / step) * step; t <= extent + 1e-12; t += step) ticks.push(Number(t.toPrecision(12)));
  return ticks;
}
