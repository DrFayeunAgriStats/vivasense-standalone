import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AdvancedAnalysisDashboard, isAdvancedMethodReady } from "../AdvancedAnalysisDashboard";
import { AmmiTab } from "../stability/AmmiTab";
import { advancedBetaBanner } from "@/lib/advancedRelease";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) } }));

afterEach(() => vi.unstubAllEnvs());
const ctx = { file: new File(["x"], "d.csv"), base64Content: "", fileType: "csv", genotypeColumn: "G", repColumn: "rep", environmentColumn: "E",
              availableTraitColumns: ["Yield", "Height"], mode: "multi", datasetToken: "tok" } as never;
const UNREVIEWED = ["blup", "cluster", "path-analysis", "selection-index", "trait-association"] as const;

describe("module gating (fail closed)", () => {
  it("everything is closed by default", () => {
    for (const id of ["pca", "stability", ...UNREVIEWED] as const) expect(isAdvancedMethodReady(id)).toBe(false);
  });
  it("only PCA and stability can be opened, each by its own flag", () => {
    vi.stubEnv("VITE_ADVANCED_PCA_BETA", "true");
    expect(isAdvancedMethodReady("pca")).toBe(true);
    expect(isAdvancedMethodReady("stability")).toBe(false);
    vi.stubEnv("VITE_ADVANCED_STABILITY_BETA", "true");
    expect(isAdvancedMethodReady("stability")).toBe(true);
  });
  it("the five unreviewed methods cannot be opened by any flag, a deep link or a click", () => {
    vi.stubEnv("VITE_ADVANCED_PCA_BETA", "true"); vi.stubEnv("VITE_ADVANCED_STABILITY_BETA", "true");
    vi.stubEnv("VITE_ADVANCED_BETA_PRODUCTION", "true"); vi.stubEnv("VITE_ADVANCED_BLUP_BETA", "true");
    for (const id of UNREVIEWED) expect(isAdvancedMethodReady(id)).toBe(false);
    for (const id of UNREVIEWED) {
      const { container, unmount } = render(<AdvancedAnalysisDashboard datasetContext={ctx} initialModule={id} embedded />);
      expect(container.textContent).toContain("Unavailable pending validation");          // still on the module grid
      unmount();
    }
    render(<AdvancedAnalysisDashboard datasetContext={ctx} embedded />);
    for (const b of screen.getAllByRole("button", { name: /Unavailable pending validation/ })) { expect(b).toBeDisabled(); fireEvent.click(b); }
    expect(screen.queryByText(/Back to advanced modules/)).toBeNull();
  });
});

describe("experimental banner", () => {
  it("is shown on the module grid with the exact required wording", () => {
    render(<AdvancedAnalysisDashboard datasetContext={ctx} embedded />);
    expect(screen.getByTestId("advanced-beta-banner").textContent).toContain("Experimental Beta — Scientific Validation in Progress.");
    expect(advancedBetaBanner).toBe("Experimental Beta — Scientific Validation in Progress.");
  });
  it("is shown on an opened method", () => {
    vi.stubEnv("VITE_ADVANCED_PCA_BETA", "true");
    render(<AdvancedAnalysisDashboard datasetContext={ctx} initialModule="pca" embedded />);
    expect(screen.getByTestId("advanced-beta-banner")).toBeTruthy();
    expect(screen.getByText(/Back to advanced modules/)).toBeTruthy();
  });
  it("makes no confirmatory, causal or selection claims in the module descriptions", () => {
    const { container } = render(<AdvancedAnalysisDashboard datasetContext={ctx} embedded />);
    const t = container.textContent ?? "";
    expect(t).not.toMatch(/best genotype|recommended genotype|select the|causes|proves|confirmed stable/i);
  });
});

it("limits the AMMI biplot and ASV wording to the displayed projection", () => {
  render(<AmmiTab trait="Yield" ammi={{
    variance_explained: [60, 25],
    cumulative_variance: [60, 85],
    genotype_scores: [{ genotype: "G1", mean: 10, ipca1: 1, ipca2: 2 }],
    environment_scores: [],
    stability_measure: [{ genotype: "G1", asv: 3, rank: 1 }],
    biplot_data: { genotypes: [{ code: "G1", mean: 10, pc1: 1, pc2: 2 }], environments: [] },
    interpretation: "",
  }} />);
  expect(screen.getByText(/Overall and future stability require more evidence/)).toBeInTheDocument();
  expect(screen.getByText(/This table ranks genotypes by ASV/)).toBeInTheDocument();
  expect(screen.queryByText(/most stable/i)).not.toBeInTheDocument();
});
