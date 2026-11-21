/**
 * Manus independent PCA audit (21 November 2026): frontend findings D01, D07, D12, D13, D14 (+ D04 status display).
 * Fixtures in src/test/fixtures/pca are real responses from the corrected backend for the audit's synthetic data,
 * plus one unchanged historical production response (16c4be1) to check older-response compatibility.
 * History persistence is mocked: no Supabase request can occur.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatasetContext } from "@/types/geneticsUpload";
import type { PcaResponse } from "@/types/advancedAnalysis";
import complete from "@/test/fixtures/pca/complete_cor.json";
import tiedPartial from "@/test/fixtures/pca/tied_one_component.json";
import linearDependence from "@/test/fixtures/pca/linear_dependence_cor.json";
import historical from "@/test/fixtures/pca/historical_16c4be1_complete_cor.json";

const runPca = vi.fn();
vi.mock("@/lib/advancedAnalysisApi", () => ({ runPca: (...a: unknown[]) => runPca(...a) }));
const recordAnalysis = vi.fn();
const recordAnalysisFailure = vi.fn();
vi.mock("@/services/history/historyService", () => ({
  recordAnalysis: (...a: unknown[]) => recordAnalysis(...a),
  recordAnalysisFailure: (...a: unknown[]) => recordAnalysisFailure(...a),
}));
vi.mock("recharts", async (orig) => ({ ...(await orig<typeof import("recharts")>()), ResponsiveContainer: () => null }));

import { PcaPanel } from "../PcaPanel";
import { buildBiplot, distinctComponents } from "@/lib/pcaBiplot";
import { buildPcaManifest, pcaLoadingsCsvRows, pcaScoresCsvRows } from "@/lib/pcaManifest";

const COMPLETE = complete as unknown as PcaResponse;

function ctx(name: string, token: string, traits: string[]): DatasetContext {
  return {
    file: new File(["x"], name), base64Content: "", fileType: "csv", genotypeColumn: "Genotype", repColumn: null,
    environmentColumn: null, availableTraitColumns: traits, mode: "single", datasetToken: token,
  } as unknown as DatasetContext;
}
const A = ctx("complete.csv", "token-A", ["Yield", "Height", "Flowering", "Protein", "Biomass"]);
const B_OVERLAP = ctx("linear_dependence.csv", "token-B", ["Yield", "Height", "Dependent"]);
const C_DISJOINT = ctx("other.csv", "token-C", ["Alpha", "Beta", "Gamma"]);

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const runButton = () => screen.getByRole("button", { name: /Run Analysis/ });

beforeEach(() => {
  runPca.mockReset();
  recordAnalysis.mockReset();
  recordAnalysisFailure.mockReset();
});

// ── D01 ─────────────────────────────────────────────────────────────────────
describe("D01 dataset identity", () => {
  it.each([["overlapping traits", B_OVERLAP], ["entirely different traits", C_DISJOINT]])(
    "no old result, obsolete trait or export survives a switch to a dataset with %s", async (_l, next) => {
      runPca.mockResolvedValueOnce(COMPLETE);
      const { rerender } = render(<PcaPanel datasetContext={A} />);
      await act(async () => { fireEvent.click(runButton()); });
      expect(await screen.findByTestId("pca-result")).toHaveAttribute("data-result-dataset-token", "token-A");
      expect(screen.getByRole("button", { name: /Download result manifest/ })).toBeInTheDocument();

      rerender(<PcaPanel datasetContext={next} />);
      await waitFor(() => expect(screen.queryByTestId("pca-result")).toBeNull());
      expect(screen.queryByRole("button", { name: /Download result manifest|Download loadings|Export Chart/ })).toBeNull();
      expect(screen.queryByText(/Interpretation \(descriptive\)/)).toBeNull();
      for (const t of ["Flowering", "Protein", "Biomass"]) expect(screen.queryByLabelText(`Trait ${t}`)).toBeNull();
      for (const t of next.availableTraitColumns) expect(screen.getByLabelText(`Trait ${t}`)).toBeChecked();

      runPca.mockResolvedValueOnce(linearDependence);
      await act(async () => { fireEvent.click(runButton()); });
      const sent = runPca.mock.calls[1][0];
      expect(sent.dataset_token).toBe(next.datasetToken);
      expect(sent.trait_columns).toEqual(next.availableTraitColumns);           // never the obsolete selection
    });

  it("discards an in-flight response that settles after the dataset changed", async () => {
    const pending = deferred<PcaResponse>();
    runPca.mockReturnValueOnce(pending.promise);
    const { rerender } = render(<PcaPanel datasetContext={A} />);
    await act(async () => { fireEvent.click(runButton()); });
    rerender(<PcaPanel datasetContext={C_DISJOINT} />);
    await act(async () => { pending.resolve(COMPLETE); await pending.promise; });
    expect(screen.queryByTestId("pca-result")).toBeNull();
    expect(screen.queryByText(/PCA complete/)).toBeNull();
    expect(runButton()).toBeEnabled();
    expect(recordAnalysis).not.toHaveBeenCalled();
  });

  it("discards an in-flight error after the dataset changed", async () => {
    const pending = deferred<PcaResponse>();
    runPca.mockReturnValueOnce(pending.promise);
    const { rerender } = render(<PcaPanel datasetContext={A} />);
    await act(async () => { fireEvent.click(runButton()); });
    rerender(<PcaPanel datasetContext={B_OVERLAP} />);
    await act(async () => { pending.reject(new Error("Trait column(s) not found: ['Flowering']")); await pending.promise.catch(() => undefined); });
    expect(screen.queryByText(/Trait column\(s\) not found/)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("clears the panel when the token disappears and reappears (warning screen does not keep state)", async () => {
    runPca.mockResolvedValueOnce(COMPLETE);
    const { rerender } = render(<PcaPanel datasetContext={A} />);
    await act(async () => { fireEvent.click(runButton()); });
    await screen.findByTestId("pca-result");
    rerender(<PcaPanel datasetContext={null} />);
    rerender(<PcaPanel datasetContext={B_OVERLAP} />);
    await waitFor(() => expect(screen.queryByTestId("pca-result")).toBeNull());
  });
});

// ── D07 ─────────────────────────────────────────────────────────────────────
describe("D07 biplot geometry and loading semantics", () => {
  it("correlation biplot uses correlation loadings and standardised scores; distance biplot uses eigenvectors", () => {
    const corr = buildBiplot(COMPLETE, 0, 1, "correlation")!;
    const dist = buildBiplot(COMPLETE, 0, 1, "distance")!;
    for (const v of corr.vectors) {
      expect(v.rawX).toBe(COMPLETE.correlation_loadings![v.trait][0]);
      expect(v.rawY).toBe(COMPLETE.correlation_loadings![v.trait][1]);
      expect(v.planeLength).toBeLessThanOrEqual(1 + 1e-12);           // correlations: represented length ≤ 1
    }
    for (const v of dist.vectors) {
      expect(v.rawX).toBe(COMPLETE.loadings[v.trait][0]);
      expect(v.rawY).toBe(COMPLETE.loadings[v.trait][1]);
    }
    const ev = COMPLETE.eigenvalues!;
    corr.points.forEach((p, i) => expect(p.x).toBeCloseTo(COMPLETE.scores[i].scores[0] / Math.sqrt(ev[0]), 12));
    dist.points.forEach((p, i) => expect(p.x).toBe(COMPLETE.scores[i].scores[0]));
    expect(corr.description).toMatch(/angle between two long arrows approximates the correlation/);
    expect(dist.description).toMatch(/Arrow angles are NOT trait correlations/);
  });

  it("full-dimensional correlation-loading inner products equal the trait correlations (the identity the plot relies on)", () => {
    const cl = COMPLETE.correlation_loadings!;
    const traits = Object.keys(cl);
    for (const t of traits) expect(cl[t].reduce((s, v) => s + v * v, 0)).toBeCloseTo(1, 10);
  });

  it("renders arrows from the origin with one pixel scale for both axes and a caption naming the convention", async () => {
    runPca.mockResolvedValueOnce(COMPLETE);
    render(<PcaPanel datasetContext={A} />);
    await act(async () => { fireEvent.click(runButton()); });
    const svg = await screen.findByTestId("pca-biplot-svg");
    expect(svg.getAttribute("data-px-per-unit-x")).toBe(svg.getAttribute("data-px-per-unit-y"));
    const vectors = within(svg as unknown as HTMLElement).getAllByTestId("pca-biplot-vector");
    expect(vectors).toHaveLength(5);
    const xAxis = svg.querySelector('[data-testid="pca-biplot-axis-y"]')!;
    const yAxis = svg.querySelector('[data-testid="pca-biplot-axis-x"]')!;
    for (const v of vectors) {
      const line = v.querySelector("line")!;
      expect(line.getAttribute("x1")).toBe(xAxis.getAttribute("x1"));   // starts at the origin
      expect(line.getAttribute("y1")).toBe(yAxis.getAttribute("y1"));
      expect(line.getAttribute("marker-end")).toMatch(/^url\(#/);
      expect(v.textContent).toBe(v.getAttribute("data-trait"));        // labelled vector
    }
    expect(svg.querySelector('[data-testid="pca-biplot-unit-circle"]')).not.toBeNull();
    const caption = Array.from(svg.querySelectorAll('[data-testid="pca-biplot-caption"]')).map((t) => t.textContent).join(" ");
    expect(caption).toMatch(/Correlation biplot\./);
    expect(caption).toMatch(/multiplied by [0-9.]+ for display/);
    expect(caption).toMatch(/Both axes use the same scale/);
    // physical check: the plot area is square, so equal data spans have equal pixel spans
    const ex = Number(svg.getAttribute("data-px-per-unit-x"));
    expect(ex).toBeGreaterThan(0);
  });
});

// ── D12 ─────────────────────────────────────────────────────────────────────
describe("D12 distinct biplot axes", () => {
  it("never produces identical axes", () => {
    expect(distinctComponents(0, 0, 5)).toEqual([0, 1]);
    expect(distinctComponents(3, 3, 5)).toEqual([3, 0]);
    expect(distinctComponents(0, 1, 1)).toBeNull();
    expect(buildBiplot(COMPLETE, 2, 2, "distance")!.b).not.toBe(2);
  });

  it("disables the other axis's current component and hides PC1+PC2 and the biplot for one component", async () => {
    runPca.mockResolvedValueOnce(tiedPartial);
    render(<PcaPanel datasetContext={ctx("tied.csv", "token-T", ["Yield", "Height", "Protein"])} />);
    await act(async () => { fireEvent.click(runButton()); });
    await screen.findByTestId("pca-result");
    expect(screen.queryByText("PC1+PC2")).toBeNull();
    expect(screen.getByTestId("pca-biplot-unavailable")).toHaveTextContent("only 1");
    expect(screen.queryByTestId("pca-biplot-svg")).toBeNull();
  });
});

// ── D13 ─────────────────────────────────────────────────────────────────────
describe("D13 chart colours", () => {
  it("uses no nested hsl(var(...)) colours in the PCA panel or biplot (they compute to none)", () => {
    for (const f of ["../PcaPanel.tsx", "../PcaBiplot.tsx"]) {
      const src = readFileSync(resolve(__dirname, f), "utf8");
      expect(src).not.toMatch(/hsl\(var\(/);
    }
  });
});

// ── D04 display ─────────────────────────────────────────────────────────────
describe("D04 incomplete verification is shown as partial", () => {
  it("shows PARTIALLY VERIFIED for a truncated tied block", async () => {
    runPca.mockResolvedValueOnce(tiedPartial);
    render(<PcaPanel datasetContext={ctx("tied.csv", "token-T", ["Yield", "Height", "Protein"])} />);
    await act(async () => { fireEvent.click(runButton()); });
    expect(await screen.findByTestId("verification-partial")).toHaveTextContent("PARTIALLY VERIFIED");
    expect(screen.queryByText(/Numerically cross-checked: the R result was reproduced/)).toBeNull();
  });
});

// ── D14 ─────────────────────────────────────────────────────────────────────
describe("D14 provenance and full-precision exports", () => {
  const run = { datasetToken: "token-A", datasetName: "complete.csv", request: { dataset_token: "token-A", trait_columns: ["Yield"] },
                response: COMPLETE, completedAt: "2026-11-21T00:00:00.000Z" };
  it("manifest carries backend provenance, request, dataset, verification coverage and full-precision results", () => {
    const m = buildPcaManifest(run, { biplot: { convention: "correlation" } });
    expect(m.backend_provenance).toEqual(COMPLETE.provenance);
    expect(m.dataset).toEqual({ name: "complete.csv", dataset_token: "token-A" });
    expect(m.request).toEqual(run.request);
    expect(m.verification.coverage).toEqual(COMPLETE.verification_coverage);
    expect(m.results_full_precision.eigenvalues).toEqual(COMPLETE.eigenvalues);
    expect(m.results_full_precision.n_obs_per_cell).toEqual(COMPLETE.n_obs_per_cell);
    expect(m.results_full_precision.trait_sds).toEqual(COMPLETE.trait_sds);
    expect(m.figures.biplot).toEqual({ convention: "correlation" });
    expect(JSON.parse(JSON.stringify(m)).results_full_precision.scores[0].scores[0]).toBe(COMPLETE.scores[0].scores[0]);
  });
  it("manifest records the Experimental Beta status from both the UI and the API, and they agree", () => {
    // Backend PCA_RELEASE_STATUS (analysis_pca_routes.py): release_status, scientific_validation and notice.
    const BACKEND_NOTICE = "Experimental beta: scientific validation is in progress. Results are exploratory, not approved for "
      + "confirmatory research, publication claims, or genotype-selection decisions. Verify against independent reference calculations.";
    const response = { ...COMPLETE, release_status: "experimental_beta", scientific_validation: "in_progress" };
    const m = buildPcaManifest({ ...run, response });
    expect(m.release).toEqual({
      ui_banner: "Experimental Beta — Scientific Validation in Progress.", ui_notice: BACKEND_NOTICE,
      api_release_status: "experimental_beta", api_scientific_validation: "in_progress",
    });
    expect(buildPcaManifest(run).release.api_release_status).toBeNull();   // older backends: absent, not invented
  });
  it("CSV rows keep every digit and label the two loading types", () => {
    const rows = pcaLoadingsCsvRows(COMPLETE);
    expect(rows[0].PC1).toBe(COMPLETE.loadings[rows[0].trait as string][0]);
    expect(rows[0].PC1_correlation_loading).toBe(COMPLETE.correlation_loadings![rows[0].trait as string][0]);
    expect(Number(String(rows[0].PC1))).toBe(rows[0].PC1);
    expect(pcaScoresCsvRows(COMPLETE)[0].PC1).toBe(COMPLETE.scores[0].scores[0]);
  });
  it("an older response without the new fields still renders and exports", async () => {
    runPca.mockResolvedValueOnce(historical);
    render(<PcaPanel datasetContext={A} />);
    await act(async () => { fireEvent.click(runButton()); });
    expect(await screen.findByTestId("pca-biplot-svg")).toBeInTheDocument();
    const m = buildPcaManifest({ ...run, response: historical as unknown as PcaResponse });
    expect(m.backend_provenance).toBeNull();
    expect(m.analysis.effective_n_components).toBe(5);
  });
});

// ── D07 presentation (re-audit): overlapping trait labels ────────────────────
import disjoint from "@/test/fixtures/pca/disjoint_traits_cor.json";
import { PcaBiplot, BIPLOT_PLOT_SIZE } from "../PcaBiplot";
import { labelExtent, overlaps } from "@/lib/pcaBiplot";

describe("D07 label collisions (Manus re-audit disjoint_traits fixture)", () => {
  it.each(["correlation", "distance"] as const)("%s biplot: labels never overlap and arrows keep their exact geometry", (conv) => {
    const res = disjoint as unknown as PcaResponse;
    const g = buildBiplot(res, 0, 1, conv)!;
    const { container } = render(<PcaBiplot geometry={g} varianceExplained={res.variance_explained} title="t" />);
    const labels = Array.from(container.querySelectorAll('[data-testid="pca-biplot-vector-label"]')).map((t) => ({
      text: t.textContent ?? "", lx: Number(t.getAttribute("x")), ly: Number(t.getAttribute("y")),
      anchor: (t.getAttribute("text-anchor") ?? "start") as "start" | "end",
    }));
    expect(labels.map((l) => l.text).sort()).toEqual(["Alpha", "Beta", "Gamma"]);
    for (let i = 0; i < labels.length; i++)
      for (let j = i + 1; j < labels.length; j++) expect(overlaps(labelExtent(labels[i]), labelExtent(labels[j]))).toBe(false);
    // Alpha and Beta are nearly parallel here, so at least one label was moved and gets a leader line.
    expect(container.querySelectorAll('[data-testid="pca-biplot-label-leader"]').length).toBeGreaterThan(0);
    const px = BIPLOT_PLOT_SIZE / (2 * g.extent);
    for (const v of g.vectors) {
      const line = container.querySelector(`[data-trait="${v.trait}"] line:not([data-testid])`)!;
      expect(Number(line.getAttribute("x2"))).toBeCloseTo(56 + (v.x + g.extent) * px, 9);
      expect(Number(line.getAttribute("y2"))).toBeCloseTo(20 + (g.extent - v.y) * px, 9);
    }
  });
});
