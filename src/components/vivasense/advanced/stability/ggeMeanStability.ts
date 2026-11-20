export interface GgePoint {
  genotype: string;
  mean: number;
  pc1: number;
  pc2: number;
}

export interface EnvironmentPoint {
  environment: string;
  mean: number;
  pc1: number;
  pc2: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface AECModel {
  origin: Vec2;
  avgEnvironment: Vec2;
  abscissaUnit: Vec2;
  ordinateUnit: Vec2;
}

export interface GenotypeProjection {
  genotype: string;
  mean: number;
  point: Vec2;
  projectionPoint: Vec2;
  abscissaScore: number;
  ordinateScore: number;
  stabilityDistance: number;
}

export interface IdealRanking {
  genotype: string;
  distance_from_ideal: number;
  rank: number;
}

export interface IdealGenotypeModel {
  idealPoint: Vec2;
  idealAbscissaScore: number;
  idealGenotype: string;
  rankings: IdealRanking[];
  ringRadii: number[];
}

const EPS = 1e-9;

const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y;
const mag = (v: Vec2) => Math.sqrt(v.x * v.x + v.y * v.y);

function normalize(v: Vec2): Vec2 {
  const m = mag(v);
  if (m < EPS) return { x: 1, y: 0 };
  return { x: v.x / m, y: v.y / m };
}

/**
 * Average-environment coordination (Yan 2001; Yan & Tinker 2006).
 * The AEC abscissa passes through the origin and the average-environment
 * marker and points toward it. Projection onto it approximates genotype mean
 * performance by construction, so no data-dependent sign flipping is applied.
 * If the backend supplied the AEC direction, pass it as `direction`.
 */
export function computeAEC(
  environments: EnvironmentPoint[],
  direction?: { pc1: number; pc2: number } | null
): AECModel {
  const n = Math.max(environments.length, 1);
  const avgEnvironment = {
    x: environments.reduce((s, e) => s + e.pc1, 0) / n,
    y: environments.reduce((s, e) => s + e.pc2, 0) / n,
  };

  const abscissaUnit = direction
    ? normalize({ x: direction.pc1, y: direction.pc2 })
    : normalize(avgEnvironment);
  const ordinateUnit = { x: -abscissaUnit.y, y: abscissaUnit.x };

  return {
    origin: { x: 0, y: 0 },
    avgEnvironment,
    abscissaUnit,
    ordinateUnit,
  };
}

export function projectGenotypesToAEC(
  genotypes: GgePoint[],
  aec: AECModel
): GenotypeProjection[] {
  return genotypes.map((g) => {
    const point = { x: g.pc1, y: g.pc2 };
    const abscissaScore = dot(point, aec.abscissaUnit);
    const ordinateScore = dot(point, aec.ordinateUnit);
    const projectionPoint = {
      x: aec.abscissaUnit.x * abscissaScore,
      y: aec.abscissaUnit.y * abscissaScore,
    };
    return {
      genotype: g.genotype,
      mean: g.mean,
      point,
      projectionPoint,
      abscissaScore,
      ordinateScore,
      stabilityDistance: Math.abs(ordinateScore),
    };
  });
}

export function computeIdealGenotype(
  projected: GenotypeProjection[],
  aec: AECModel
): IdealGenotypeModel {
  if (!projected.length) {
    return {
      idealPoint: { x: 0, y: 0 },
      idealAbscissaScore: 0,
      idealGenotype: "",
      rankings: [],
      ringRadii: [0.3, 0.6, 0.9],
    };
  }

  const axisPointByGenotype = new Map(projected.map((p) => [p.genotype, p.projectionPoint]));

  // Ideal genotype: on the AEC abscissa (positive direction) at the length of
  // the longest genotype vector, as in metan::gge and GGEBiplotGUI. This
  // mirrors the backend (gge_biplot.mean_vs_stability).
  const idealLength = Math.max(...projected.map((p) => mag(p.point)));
  const idealPoint = {
    x: aec.abscissaUnit.x * idealLength,
    y: aec.abscissaUnit.y * idealLength,
  };

  const withDistances = projected.map((p) => {
    const dx = p.point.x - idealPoint.x;
    const dy = p.point.y - idealPoint.y;
    return {
      genotype: p.genotype,
      distance_from_ideal: Math.sqrt(dx * dx + dy * dy),
      axisPoint: axisPointByGenotype.get(p.genotype) ?? p.projectionPoint,
      abscissaScore: p.abscissaScore,
      stabilityDistance: p.stabilityDistance,
    };
  });

  withDistances.sort((a, b) => {
    if (Math.abs(a.distance_from_ideal - b.distance_from_ideal) > EPS) {
      return a.distance_from_ideal - b.distance_from_ideal;
    }
    // Tie-breaker: higher mean score then better stability.
    if (Math.abs(a.abscissaScore - b.abscissaScore) > EPS) {
      return b.abscissaScore - a.abscissaScore;
    }
    return a.stabilityDistance - b.stabilityDistance;
  });

  const rankings: IdealRanking[] = withDistances.map((d, i) => ({
    genotype: d.genotype,
    distance_from_ideal: d.distance_from_ideal,
    rank: i + 1,
  }));

  const idealGenotype = rankings[0]?.genotype ?? "";
  const maxDistance = Math.max(...rankings.map((r) => r.distance_from_ideal), 0.1);
  const ringRadii = [0.25, 0.5, 0.75, 1].map((k) => Number((maxDistance * k).toFixed(6)));

  return {
    idealPoint,
    idealAbscissaScore: idealLength,
    idealGenotype,
    rankings,
    ringRadii,
  };
}

export function drawStabilityAxis(aec: AECModel, extent: number): { from: Vec2; to: Vec2 } {
  const span = Math.max(extent, 1) * 1.15;
  return {
    from: { x: -aec.ordinateUnit.x * span, y: -aec.ordinateUnit.y * span },
    to: { x: aec.ordinateUnit.x * span, y: aec.ordinateUnit.y * span },
  };
}

export function drawAbscissaAxis(aec: AECModel, extent: number): { from: Vec2; to: Vec2 } {
  const span = Math.max(extent, 1) * 1.15;
  return {
    from: { x: -aec.abscissaUnit.x * span, y: -aec.abscissaUnit.y * span },
    to: { x: aec.abscissaUnit.x * span, y: aec.abscissaUnit.y * span },
  };
}
