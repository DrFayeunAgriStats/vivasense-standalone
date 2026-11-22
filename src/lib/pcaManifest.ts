/**
 * PCA result manifest and full-precision CSV rows (Manus PCA audit D14).
 *
 * The manifest accompanies the CSV and PNG exports: it carries the full-precision response (including eigenvalues,
 * both loading types, scores, trait means/SDs and per-cell observation counts), the exact request, dataset identity,
 * exclusions, verification coverage, the backend provenance block and the frontend build, plus the biplot settings
 * used for the exported figure.
 */
import type { PcaResponse } from "@/types/advancedAnalysis";
import { advancedBetaBanner, advancedBetaNotice } from "@/lib/advancedRelease";

declare const __VIVASENSE_FRONTEND_COMMIT__: string | undefined;

export function frontendCommit(): string {
  try {
    return typeof __VIVASENSE_FRONTEND_COMMIT__ === "string" && __VIVASENSE_FRONTEND_COMMIT__
      ? __VIVASENSE_FRONTEND_COMMIT__ : "unknown";
  } catch {
    return "unknown";
  }
}

export interface PcaRunForManifest {
  datasetToken: string;
  datasetName: string | null;
  request: Record<string, unknown>;
  response: PcaResponse;
  completedAt: string;
}

export function buildPcaManifest(run: PcaRunForManifest, extras: { biplot?: Record<string, unknown> | null } = {}) {
  const r = run.response;
  return {
    manifest_version: "vivasense-pca-result-manifest-1",
    exported_utc: new Date().toISOString(),
    completed_utc: run.completedAt,
    frontend_commit: frontendCommit(),
    // Release status as shown in the UI and as reported by the API; the two must agree (Experimental Beta).
    release: {
      ui_banner: advancedBetaBanner,
      ui_notice: advancedBetaNotice,
      api_release_status: r.release_status ?? null,
      api_scientific_validation: r.scientific_validation ?? null,
    },
    backend_provenance: r.provenance ?? null,
    dataset: { name: run.datasetName, dataset_token: run.datasetToken },
    request: run.request,
    analysis: {
      matrix: r.matrix ?? null,
      n_traits: r.n_traits,
      n_genotypes: r.n_genotypes,
      rank: r.rank ?? null,
      null_components: r.null_components ?? null,
      requested_n_components: r.requested_n_components ?? null,
      effective_n_components: r.n_components ?? r.variance_explained.length,
      sign_convention: r.sign_convention ?? null,
      environment_context: r.environment_context ?? r.analysis_context ?? null,
      excluded_traits: r.excluded_traits ?? [],
      excluded_genotypes: r.excluded_genotypes ?? [],
      input_notes: r.input_notes ?? [],
      warnings: r.warnings ?? [],
    },
    verification: {
      status: r.verification_status ?? null,
      reasons: r.verification_reasons ?? [],
      coverage: r.verification_coverage ?? null,
    },
    results_full_precision: {
      eigenvalues: r.eigenvalues ?? null,
      variance_explained_pct: r.variance_explained,
      cumulative_variance_pct: r.cumulative_variance,
      broken_stick_pct: r.broken_stick_pct ?? null,
      broken_stick_dimension: r.broken_stick_dimension ?? null,
      eigenvector_loadings: r.loadings,
      correlation_loadings: r.correlation_loadings ?? null,
      scores: r.scores,
      trait_means: r.trait_means ?? null,
      trait_sds: r.trait_sds ?? null,
      n_obs_per_cell: r.n_obs_per_cell ?? null,
    },
    figures: { biplot: extras.biplot ?? null },
    interpretation: r.interpretation,
  };
}

/** Eigenvector loadings plus correlation loadings, unrounded (String(number) round-trips a double). */
export function pcaLoadingsCsvRows(r: PcaResponse): Record<string, unknown>[] {
  return Object.entries(r.loadings).map(([trait, vals]) => ({
    trait,
    ...Object.fromEntries(vals.map((v, i) => [`PC${i + 1}`, v])),
    ...Object.fromEntries((r.correlation_loadings?.[trait] ?? []).map((v, i) => [`PC${i + 1}_correlation_loading`, v])),
  }));
}

export function pcaScoresCsvRows(r: PcaResponse): Record<string, unknown>[] {
  return r.scores.map((s) => ({ genotype: s.genotype, ...Object.fromEntries(s.scores.map((v, i) => [`PC${i + 1}`, v])) }));
}
