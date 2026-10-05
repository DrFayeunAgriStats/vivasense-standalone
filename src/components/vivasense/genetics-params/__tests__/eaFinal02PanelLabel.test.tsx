/**
 * EA-FINAL-02 — the collapsible detail panel's label names what that panel
 * actually contains, not what the analysis page as a whole presents.
 *
 * One-factor CRD / RCBD: the panel holds the ANOVA table AND the mean separation.
 * Factorial CRD / RCBD and Split-Plot RCBD: their mean separation is rendered by
 * the governed panels above; the collapsible holds the ANOVA table only.
 *
 * Driven by the REAL smoke-kit responses; CRD and RCBD go through the full
 * AnovaModulePanel, the two-factor designs through AcademicResultsPanel with the
 * exact props AnovaModulePanel passes for them.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatasetContext } from "@/types/geneticsUpload";

vi.setConfig({ testTimeout: 30000 });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } },
}));
vi.mock("@/services/history/historyService", () => ({
  recordAnalysis: vi.fn(),
  recordAnalysisFailure: vi.fn(),
}));
vi.mock("@/services/persistenceRcbdApi", () => ({
  runPersistentRcbdAnalysis: vi.fn(),
  downloadPersistentRcbdReport: vi.fn(),
}));
vi.mock("@/services/geneticsUploadApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/geneticsUploadApi")>()),
  analyzeUpload: vi.fn(),
}));

import { AcademicResultsPanel } from "../AcademicResultsPanel";
import { detailedStatsLabel } from "../feBeta02";
import { AnovaModulePanel } from "../AnovaModulePanel";
import { analyzeUpload } from "@/services/geneticsUploadApi";
import { runPersistentRcbdAnalysis } from "@/services/persistenceRcbdApi";

import crd01 from "@/test/fixtures/smokeKit/VS_Smoke_01_CRD.json";
import factCrd02 from "@/test/fixtures/smokeKit/VS_Smoke_02_Factorial_CRD.json";
import rcbd03 from "@/test/fixtures/smokeKit/VS_Smoke_03_RCBD.json";
import factRcbd04 from "@/test/fixtures/smokeKit/VS_Smoke_04_Factorial_RCBD.json";
import split05 from "@/test/fixtures/smokeKit/VS_Smoke_05_SplitPlot_RCBD.json";

type Payload = Record<string, any>;
const resultOf = (p: Payload) => (Object.values(p.trait_results as Record<string, any>)[0] as any).analysis_result.result;

const BOTH = "View ANOVA Table & Mean Separation";
const ANOVA_ONLY = "View ANOVA Table";

const dataset = (treatment: string, rep: string, trait: string): DatasetContext => ({
  file: new File(["x"], `${trait}.csv`, { type: "text/csv" }),
  base64Content: "eA==",
  fileType: "csv",
  genotypeColumn: treatment,
  repColumn: rep,
  environmentColumn: null,
  availableTraitColumns: [trait],
  mode: "single",
  datasetToken: `token-${trait}`,
  columns: [treatment, rep, trait],
  availableColumns: [treatment, rep, trait],
  nRows: 2,
  dataPreview: [
    { [treatment]: "T1", [rep]: "B1", [trait]: 1 },
    { [treatment]: "T2", [rep]: "B1", [trait]: 2 },
  ],
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("detailedStatsLabel", () => {
  it("names the panel by its contents", () => {
    expect(detailedStatsLabel({ domainNeutral: true, hasAnova: true, hasMeanSeparation: true })).toBe(BOTH);
    expect(detailedStatsLabel({ domainNeutral: true, hasAnova: true, hasMeanSeparation: false })).toBe(ANOVA_ONLY);
    expect(detailedStatsLabel({ domainNeutral: true, hasAnova: false, hasMeanSeparation: true })).toBe("View Mean Separation");
  });

  it("leaves the legacy non-ANOVA label unchanged", () => {
    expect(detailedStatsLabel({ domainNeutral: false, hasAnova: true, hasMeanSeparation: true })).toBe("Show Detailed Statistics");
  });
});

describe("one-factor designs: the panel holds ANOVA and mean separation", () => {
  it("CRD (VS_Smoke_01) keeps 'View ANOVA Table & Mean Separation' and opens to both tables", async () => {
    vi.mocked(analyzeUpload).mockResolvedValue(crd01 as never);
    render(<AnovaModulePanel datasetContext={dataset("treatment", "", "plant_height_cm")} />);
    fireEvent.click(await screen.findByLabelText("plant_height_cm"));
    fireEvent.click(screen.getByRole("button", { name: /Run Analysis/i }));
    await screen.findByRole("heading", { name: /ANOVA Results/ });

    expect(screen.queryByText(ANOVA_ONLY, { exact: true })).toBeNull();
    fireEvent.click(screen.getByText(BOTH, { exact: true }));
    expect(screen.getByText("ANOVA Table")).toBeInTheDocument();
    expect(screen.getByText(/^Mean Separation \(/)).toBeInTheDocument();
  });

  it("RCBD (VS_Smoke_03) keeps 'View ANOVA Table & Mean Separation' and opens to both tables", async () => {
    vi.mocked(runPersistentRcbdAnalysis).mockResolvedValue(rcbd03 as never);
    render(<AnovaModulePanel datasetContext={dataset("genotype", "rep", "fresh_leaf_yield")} />);
    fireEvent.click(await screen.findByLabelText("fresh_leaf_yield"));
    fireEvent.click(screen.getByRole("button", { name: /Run Analysis/i }));
    await screen.findByRole("heading", { name: /ANOVA Results — Randomized Complete Block Design \(RCBD\)/ });

    expect(screen.queryByText(ANOVA_ONLY, { exact: true })).toBeNull();
    fireEvent.click(screen.getByText(BOTH, { exact: true }));
    expect(screen.getByText("ANOVA Table")).toBeInTheDocument();
    expect(screen.getByText(/^Mean Separation \(/)).toBeInTheDocument();
  });
});

describe("two-factor designs: the panel holds the ANOVA table only", () => {
  // Exactly the props AnovaModulePanel passes for governed Factorial / Split-Plot:
  // mean separation and descriptive stats are rendered by the governed panels.
  const renderTwoFactor = (payload: Payload) => {
    const r = resultOf(payload);
    return render(
      <AcademicResultsPanel
        moduleLabel="ANOVA"
        domainNeutral
        inferentialAlpha={0.05}
        anovaTable={r.anova_table}
        meanSeparation={undefined}
        descriptiveStats={undefined}
      />
    );
  };

  it.each([
    ["Factorial CRD (VS_Smoke_02)", factCrd02],
    ["Factorial RCBD (VS_Smoke_04)", factRcbd04],
    ["Split-Plot RCBD (VS_Smoke_05)", split05],
  ])("%s is labelled 'View ANOVA Table' and contains no mean separation", (_name, payload) => {
    const { container } = renderTwoFactor(payload as Payload);
    expect(screen.queryByText(BOTH)).toBeNull();
    fireEvent.click(screen.getByText(ANOVA_ONLY, { exact: true }));
    expect(screen.getByText("ANOVA Table")).toBeInTheDocument();
    expect(within(container).queryByText(/Mean Separation/)).toBeNull();
    expect(within(container).getAllByRole("table")).toHaveLength(1);
  });
});
