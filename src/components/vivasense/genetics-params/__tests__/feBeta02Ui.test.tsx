/**
 * FE-BETA-02 — user-facing behaviour, driven by the REAL smoke-kit responses.
 * The services are mocked at the network boundary only; every rendering and
 * decision path is the production one.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatasetContext } from "@/types/geneticsUpload";

// The full ANOVA panel is a heavy module graph; the first render in a worker can
// exceed the 5 s default when the whole suite runs in parallel.
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

import { AnovaModulePanel } from "../AnovaModulePanel";
import { GovernedFactorialPanel } from "../GovernedFactorialPanel";
import { GovernedSplitPlotPanel } from "../GovernedSplitPlotPanel";
import { analyzeUpload } from "@/services/geneticsUploadApi";
import { runPersistentRcbdAnalysis } from "@/services/persistenceRcbdApi";
import { recordAnalysis, recordAnalysisFailure } from "@/services/history/historyService";
import { RecentAnalysesV3 } from "@/components/vivasense/workspace/v3/RecentAnalysesV3";
import { WorkspaceFooterMetrics } from "@/components/vivasense/workspace/v3/WorkspaceFooterMetrics";
import { Layout } from "@/components/layout/Layout";

import crd01 from "@/test/fixtures/smokeKit/VS_Smoke_01_CRD.json";
import factCrd02 from "@/test/fixtures/smokeKit/VS_Smoke_02_Factorial_CRD.json";
import rcbd03 from "@/test/fixtures/smokeKit/VS_Smoke_03_RCBD.json";
import factRcbd04 from "@/test/fixtures/smokeKit/VS_Smoke_04_Factorial_RCBD.json";
import split05 from "@/test/fixtures/smokeKit/VS_Smoke_05_SplitPlot_RCBD.json";
import refusal06 from "@/test/fixtures/smokeKit/VS_Smoke_06_RCBD_missing_plot.json";
import refusal07 from "@/test/fixtures/smokeKit/VS_Smoke_07_RCBD_text_in_response.json";
import crd08 from "@/test/fixtures/smokeKit/VS_Smoke_08_CRD_blank_cell.json";

type Payload = Record<string, any>;
const resultOf = (p: Payload) => (Object.values(p.trait_results as Record<string, any>)[0] as any).analysis_result.result;

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

const tabSelected = (name: string) => screen.getByRole("tab", { name }).getAttribute("aria-selected") === "true";

describe("1. Block = None resolves to CRD (regression)", () => {
  it("RCBD dataset → new CRD dataset with no block → CRD is selected, not a stale RCBD", async () => {
    const rcbdDataset = dataset("genotype", "rep", "fresh_leaf_yield");
    const crdDataset = dataset("treatment", "", "plant_height_cm");

    const { rerender } = render(<AnovaModulePanel datasetContext={rcbdDataset} />);
    await waitFor(() => expect(tabSelected("RCBD")).toBe(true));

    rerender(<AnovaModulePanel datasetContext={crdDataset} />);
    await waitFor(() => expect(tabSelected("CRD")).toBe(true));
    expect(tabSelected("RCBD")).toBe(false);
  });

  it("a dataset that does map a block still opens on RCBD", async () => {
    render(<AnovaModulePanel datasetContext={dataset("genotype", "rep", "y")} />);
    await waitFor(() => expect(tabSelected("RCBD")).toBe(true));
  });
});

describe("12. beginner run experience (real CRD payload, VS_Smoke_08)", () => {
  it("shows a running state, blocks duplicate submits, then focuses the results heading", async () => {
    let resolveRun!: (value: unknown) => void;
    vi.mocked(analyzeUpload).mockImplementation(
      () => new Promise((resolve) => { resolveRun = resolve; }) as never,
    );
    const scrollSpy = vi.spyOn(HTMLElement.prototype, "scrollIntoView");

    render(<AnovaModulePanel datasetContext={dataset("treatment", "", "plant_height_cm")} />);
    await waitFor(() => expect(tabSelected("CRD")).toBe(true));
    fireEvent.click(await screen.findByLabelText("plant_height_cm"));

    const run = screen.getByRole("button", { name: /Run Analysis/i });
    fireEvent.click(run);

    // Visible running state, with no invented percentage.
    const busy = await screen.findByRole("button", { name: /Running analysis/i });
    expect(busy).toBeDisabled();
    expect(screen.getByRole("status").textContent).toMatch(/Running analysis/);
    expect(screen.getByRole("status").textContent).not.toMatch(/\d+\s?%/);
    fireEvent.click(busy);
    expect(analyzeUpload).toHaveBeenCalledTimes(1);

    await act(async () => { resolveRun(crd08); });

    const heading = await screen.findByRole("heading", { name: /ANOVA Results — Completely Randomized Design \(CRD\)/ });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(scrollSpy).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Run Analysis/i })).toBeEnabled();
    scrollSpy.mockRestore();
  });

  it("scrolls without animation when the user prefers reduced motion", async () => {
    vi.mocked(analyzeUpload).mockResolvedValue(crd01 as never);
    const matchMedia = vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) => ({ matches: /reduced-motion/.test(query), media: query }) as never,
    );
    const scrollSpy = vi.spyOn(HTMLElement.prototype, "scrollIntoView");

    render(<AnovaModulePanel datasetContext={dataset("treatment", "", "plant_height_cm")} />);
    fireEvent.click(await screen.findByLabelText("plant_height_cm"));
    fireEvent.click(screen.getByRole("button", { name: /Run Analysis/i }));
    await screen.findByRole("heading", { name: /ANOVA Results/ });

    await waitFor(() => expect(scrollSpy).toHaveBeenCalled());
    expect(scrollSpy.mock.calls.at(-1)?.[0]).toMatchObject({ behavior: "auto" });
    matchMedia.mockRestore();
    scrollSpy.mockRestore();
  });

  it("names the control so a beginner knows where the ANOVA table is, and opens to the real table", async () => {
    vi.mocked(analyzeUpload).mockResolvedValue(crd01 as never);
    render(<AnovaModulePanel datasetContext={dataset("treatment", "", "plant_height_cm")} />);
    fireEvent.click(await screen.findByLabelText("plant_height_cm"));
    fireEvent.click(screen.getByRole("button", { name: /Run Analysis/i }));
    await screen.findByRole("heading", { name: /ANOVA Results/ });

    expect(screen.queryByText(/Show Detailed Statistics/i)).toBeNull();
    fireEvent.click(screen.getByText(/View ANOVA Table & Mean Separation/i));

    // 2. display_source: "treatment", never the internal "genotype".
    const table = screen.getAllByRole("table")[0];
    expect(within(table).getByText("treatment")).toBeInTheDocument();
    expect(within(table).queryByText(/genotype/i)).toBeNull();
    // The real Tukey letters 4=a, 2=b, 3=bc, 1=c reach the page unchanged.
    const meanTable = screen.getAllByRole("table")[1];
    const letters = within(meanTable).getAllByRole("row").slice(1).map((r) => r.textContent ?? "");
    expect(letters[0]).toMatch(/^4.*a$/);
    expect(letters[1]).toMatch(/^2.*b$/);
    expect(letters[2]).toMatch(/^3.*bc$/);
    expect(letters[3]).toMatch(/^1.*c$/);
  });
});

describe("7. release status in the live results (CRD / RCBD)", () => {
  it("CRD: Early Access, Word download, and no reopening is advertised", async () => {
    vi.mocked(analyzeUpload).mockResolvedValue(crd01 as never);
    render(<AnovaModulePanel datasetContext={dataset("treatment", "", "plant_height_cm")} />);
    fireEvent.click(await screen.findByLabelText("plant_height_cm"));
    fireEvent.click(screen.getByRole("button", { name: /Run Analysis/i }));
    await screen.findByRole("heading", { name: /ANOVA Results/ });

    expect(screen.getAllByText("Early Access · Word report download").length).toBeGreaterThan(0);
    expect(screen.getByText(/Saved-run reopening is currently available for RCBD only/)).toBeInTheDocument();
    expect(screen.queryByText(/saved runs can be reopened/i)).toBeNull();
    expect(screen.queryByText(/Preview · session-only/)).toBeNull();
  });

  it("RCBD: Early Access with durable saved-run reopening; backend disclosure shown (VS_Smoke_03)", async () => {
    vi.mocked(runPersistentRcbdAnalysis).mockResolvedValue(rcbd03 as never);
    render(<AnovaModulePanel datasetContext={dataset("genotype", "rep", "fresh_leaf_yield")} />);
    fireEvent.click(await screen.findByLabelText("fresh_leaf_yield"));
    fireEvent.click(screen.getByRole("button", { name: /Run Analysis/i }));
    await screen.findByRole("heading", { name: /ANOVA Results — Randomized Complete Block Design \(RCBD\)/ });

    expect(screen.getAllByText("Early Access · saved runs can be reopened").length).toBeGreaterThan(0);
    expect(screen.getByText(/RCBD runs saved through the governed workflow can be reopened/)).toBeInTheDocument();
    // 11. Cook's review is worded as screening, not proof (real RCBD counts: 3 at 0.2).
    expect(screen.getByText(/3 observations crossed the Cook's distance screening threshold \(0\.200\)/)).toBeInTheDocument();
    expect(recordAnalysis).toHaveBeenCalledTimes(1);
    const recorded = vi.mocked(recordAnalysis).mock.calls[0][0];
    expect(recorded.parameters?.release_status).toMatchObject({ maturity: "early_access", reopenable: true });
  });
});

describe("10. CRD blank-response disclosure (VS_Smoke_08)", () => {
  it("states original N, analysed N, the excluded row, per-treatment n and unequal replication — once, and not as an outlier", async () => {
    vi.mocked(analyzeUpload).mockResolvedValue(crd08 as never);
    render(<AnovaModulePanel datasetContext={dataset("treatment", "", "plant_height_cm")} />);
    fireEvent.click(await screen.findByLabelText("plant_height_cm"));
    fireEvent.click(screen.getByRole("button", { name: /Run Analysis/i }));
    await screen.findByRole("heading", { name: /ANOVA Results/ });

    expect(screen.getByText("Blank response cells were excluded")).toBeInTheDocument();
    expect(screen.getByText("Original N").nextSibling?.textContent).toBe("16");
    expect(screen.getByText("Analysed N").nextSibling?.textContent).toBe("15");
    expect(screen.getByText("Excluded").nextSibling?.textContent).toBe("row 10 (treatment 3, blank)");
    expect(screen.getByText("Observations per treatment").nextSibling?.textContent).toBe("1 = 4, 2 = 4, 3 = 3, 4 = 4");
    expect(screen.getByText(/Replication is now unequal/)).toBeInTheDocument();
    // The backend sentence is not repeated as a second note.
    expect(screen.queryByText(/Blank response cells in plant_height_cm were excluded/)).toBeNull();
    expect(screen.queryByText(/outlier/i)).toBeNull();
  });

  it("is not shown for a CRD without exclusions (VS_Smoke_01)", async () => {
    vi.mocked(analyzeUpload).mockResolvedValue(crd01 as never);
    render(<AnovaModulePanel datasetContext={dataset("treatment", "", "plant_height_cm")} />);
    fireEvent.click(await screen.findByLabelText("plant_height_cm"));
    fireEvent.click(screen.getByRole("button", { name: /Run Analysis/i }));
    await screen.findByRole("heading", { name: /ANOVA Results/ });
    expect(screen.queryByText("Blank response cells were excluded")).toBeNull();
  });
});

describe("6. structured refusals are readable, specific and not recorded as successes", () => {
  it("VS_Smoke_06 — the missing cell is named; no raw JSON; no empty 'ANOVA Results'", async () => {
    vi.mocked(runPersistentRcbdAnalysis).mockResolvedValue(refusal06 as never);
    render(<AnovaModulePanel datasetContext={dataset("genotype", "rep", "fresh_leaf_yield")} />);
    fireEvent.click(await screen.findByLabelText("fresh_leaf_yield"));
    fireEvent.click(screen.getByRole("button", { name: /Run Analysis/i }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("The design is incomplete")).toBeInTheDocument();
    expect(alert.textContent).toContain("TOC-03");
    expect(alert.textContent).toContain("R2");
    expect(alert.textContent).not.toMatch(/[{}]/);
    expect(screen.queryByRole("heading", { name: /ANOVA Results/ })).toBeNull();
    expect(recordAnalysis).not.toHaveBeenCalled();
    expect(recordAnalysisFailure).toHaveBeenCalledTimes(1);
  });

  it("VS_Smoke_07 — text 'dead' keeps value, treatment and block, with a non-numeric headline", async () => {
    vi.mocked(runPersistentRcbdAnalysis).mockResolvedValue(refusal07 as never);
    render(<AnovaModulePanel datasetContext={dataset("genotype", "rep", "fresh_leaf_yield")} />);
    fireEvent.click(await screen.findByLabelText("fresh_leaf_yield"));
    fireEvent.click(screen.getByRole("button", { name: /Run Analysis/i }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("A response value is not a number")).toBeInTheDocument();
    expect(alert.textContent).toContain("Non-numeric value 'dead' in fresh_leaf_yield at TOC-03 × R3");
    expect(alert.textContent).not.toMatch(/Design structure rejected/);
    expect(alert.textContent).not.toMatch(/[{}]/);
    expect(recordAnalysis).not.toHaveBeenCalled();
  });

  it("a rejected request shows the backend's detail.message, never JSON", async () => {
    vi.mocked(analyzeUpload).mockRejectedValue(new Error("Column 'yield' has text in row 14."));
    render(<AnovaModulePanel datasetContext={dataset("treatment", "", "plant_height_cm")} />);
    fireEvent.click(await screen.findByLabelText("plant_height_cm"));
    fireEvent.click(screen.getByRole("button", { name: /Run Analysis/i }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Column 'yield' has text in row 14.");
  });
});

describe("10b. selection layout is stable", () => {
  it("keeps the validation slot mounted so the controls below do not jump", async () => {
    render(<AnovaModulePanel datasetContext={dataset("treatment", "", "plant_height_cm")} />);
    const slot = (await screen.findByText(/Select at least one response variable/)).closest("div[aria-live]");
    expect(slot).not.toBeNull();
    expect(slot!.className).toMatch(/min-h-/);

    fireEvent.click(await screen.findByLabelText("plant_height_cm"));
    await waitFor(() => expect(screen.queryByText(/Select at least one response variable/)).toBeNull());
    // Same wrapper, still mounted and still reserving its height.
    const stillThere = document.querySelector("div[aria-live='polite'].min-h-\\[2\\.75rem\\]");
    expect(stillThere).not.toBeNull();
  });
});

describe("5/7. Factorial and Split-Plot are Preview, and render the governed hierarchy (real payloads)", () => {
  it("Factorial RCBD (VS_Smoke_04): interaction-first, levels N0, N60, N120 present", () => {
    render(
      <GovernedFactorialPanel
        design="factorial_rcbd"
        result={resultOf(factRcbd04)}
        mapping={{ rep: "rep" }}
        inferentialAlpha={0.05}
      />,
    );
    expect(screen.getAllByText(/interaction governs/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Marginal main-effect mean separation/i)).toBeInTheDocument();
    for (const level of ["N0", "N60", "N120"]) expect(screen.getAllByText(level).length).toBeGreaterThan(0);
  });

  it("Factorial CRD (VS_Smoke_02) renders with its governed panel", () => {
    render(
      <GovernedFactorialPanel design="factorial_crd" result={resultOf(factCrd02)} mapping={{ rep: "" }} inferentialAlpha={0.05} />,
    );
    expect(screen.getByText(/Marginal main-effect mean separation/i)).toBeInTheDocument();
  });

  it("Split-Plot (VS_Smoke_05): Error A / Error B strata are shown", () => {
    render(
      <GovernedSplitPlotPanel
        result={resultOf(split05)}
        mapping={{ rep: "rep", mainPlot: "irrigation", subPlot: "variety" }}
        inferentialAlpha={0.01}
      />,
    );
    expect(screen.getAllByText(/Error A/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Error B/).length).toBeGreaterThan(0);
  });
});

describe("7/8. history: Open action by design family, publication-ready count", () => {
  const row = (id: string, design: string, extra: Record<string, unknown> = {}) => ({
    id,
    user_id: "u",
    session_id: null,
    created_at: "2026-10-03T10:00:00Z",
    analysis_type: "anova",
    analysis_title: `${design} analysis`,
    study_name: null,
    design_type: design,
    dataset_name: `${design}.csv`,
    dataset_token: null,
    traits: ["y"],
    analysis_status: "success" as const,
    execution_time_ms: 1000,
    backend_endpoint: null,
    backend_version: null,
    frontend_version: null,
    institution: null,
    country: null,
    user_role: null,
    analysis_parameters: extra,
    result_summary: {},
    notes: null,
    favorite: false,
  });

  it("only RCBD offers Open; CRD, Factorial and Split-Plot do not, and each shows its status", () => {
    const rows = [
      row("1", "rcbd", { persistence_analysis_run_id: "run-1" }),
      row("2", "crd"),
      row("3", "factorial_crd"),
      row("4", "factorial_rcbd"),
      row("5", "split_plot_rcbd"),
    ];
    render(<RecentAnalysesV3 rows={rows as never} />);

    const openButtons = screen.getAllByRole("button", { name: /^Open/ });
    expect(openButtons).toHaveLength(1);
    expect(screen.getByText("Early Access · saved runs can be reopened")).toBeInTheDocument();
    expect(screen.getByText("Early Access · Word report download")).toBeInTheDocument();
    expect(screen.getAllByText("Preview · session-only")).toHaveLength(3);
  });

  it("the footer shows Preview analyses separately and never as publication-ready", () => {
    render(<WorkspaceFooterMetrics publicationReady={2} previewCount={3} pending={0} studyCount={1} avgRuntimeMs={null} />);
    // Each metric is <div><span>value</span>label</div>.
    expect(screen.getByText("publication-ready").firstChild?.textContent).toBe("2");
    expect(screen.getByText("preview (session-only)").firstChild?.textContent).toBe("3");
  });
});

describe("13. mobile navigation keeps Data Capture and Field Layout reachable", () => {
  it("renders a narrow-screen nav (md:hidden) with the same destinations, beside the desktop-only sidebar", () => {
    render(
      <MemoryRouter initialEntries={["/workspace?module=anova"]}>
        <Layout><div /></Layout>
      </MemoryRouter>,
    );
    const mobile = screen.getByRole("navigation", { name: "Workspace navigation" });
    expect(mobile.className).toContain("md:hidden");
    expect(mobile.className).toContain("overflow-x-auto");

    const hrefs = within(mobile).getAllByRole("link").map((a) => [a.textContent, a.getAttribute("href")]);
    expect(hrefs).toEqual(
      expect.arrayContaining([
        ["Data Capture", "/data-capture"],
        ["Field Layout", "/workspace?module=field-layout"],
        ["Experimental Design", "/workspace?module=anova"],
        ["Research Workspace", "/workspace"],
        ["Help & Learning", "/help"],
      ]),
    );

    // The desktop sidebar is still md-and-up only, so the two never show together.
    const aside = document.querySelector("aside");
    expect(aside?.className).toContain("hidden");
    expect(aside?.className).toContain("md:block");

    expect(within(mobile).getByRole("link", { name: "Experimental Design" })).toHaveAttribute("aria-current", "page");
  });
});
