/**
 * EA-FINAL-01 items 1-2 — Recent Analyses treatment label and factorial
 * replication count, driven by the REAL smoke-kit responses.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null } })) } },
}));

import { RecentAnalysesV3 } from "@/components/vivasense/workspace/v3/RecentAnalysesV3";
import { deriveResultSummary } from "@/services/history/historyMapper";
import { resolveMetrics } from "@/lib/workspace/metricsConfig";
import { governedFactorialReplications, replicationBadgeLabel } from "@/lib/designCounts";

import crd01 from "@/test/fixtures/smokeKit/VS_Smoke_01_CRD.json";
import factCrd02 from "@/test/fixtures/smokeKit/VS_Smoke_02_Factorial_CRD.json";
import rcbd03 from "@/test/fixtures/smokeKit/VS_Smoke_03_RCBD.json";
import factRcbd04 from "@/test/fixtures/smokeKit/VS_Smoke_04_Factorial_RCBD.json";
import split05 from "@/test/fixtures/smokeKit/VS_Smoke_05_SplitPlot_RCBD.json";

type Payload = Record<string, unknown>;

const summaryFor = (response: Payload, designType: string) =>
  deriveResultSummary({
    analysisType: "anova",
    backendEndpoint: "/genetics/analyze-upload?module=anova",
    designType,
    traits: ["y"],
    response,
    status: "success",
  } as never);

const row = (id: string, design: string, result_summary: Record<string, unknown>) => ({
  id,
  user_id: "u",
  created_at: "2026-10-04T00:00:00Z",
  updated_at: "2026-10-04T00:00:00Z",
  session_id: null,
  analysis_type: "anova",
  analysis_title: `${design} run`,
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
  analysis_parameters: {},
  result_summary,
  notes: null,
  favorite: false,
});

/** Each metric renders as <div>value</div><div>LABEL</div> inside one cell. */
const metricCells = () =>
  screen.getAllByText(/^(Treatments|Genotypes|Reps|Traits|Obs\.)$/).map(
    (label) => `${label.previousElementSibling?.textContent} ${label.textContent}`,
  );

describe("EA-FINAL-01 item 1 — Recent Analyses: generic treatment label", () => {
  it.each([
    ["generic Treatment CRD (VS_Smoke_01)", crd01, "crd", "4 Treatments"],
    ["generic Treatment RCBD (VS_Smoke_03)", rcbd03, "rcbd", "5 Treatments"],
  ])("%s shows TREATMENTS, never GENOTYPES", (_name, fixture, design, expected) => {
    const summary = summaryFor(fixture as Payload, design);
    // The persisted key stays the engine's internal name; only the label changes.
    expect(typeof summary.n_genotypes).toBe("number");
    render(<RecentAnalysesV3 rows={[row("1", design, summary)] as never} />);
    expect(metricCells()).toContain(expected);
    expect(screen.queryByText("Genotypes")).toBeNull();
  });

  it("an already-persisted ANOVA row with n_genotypes is labelled Treatments", () => {
    const metrics = resolveMetrics("anova", { n_genotypes: 4, n_traits: 1 }, 5, "crd");
    expect(metrics.find((m) => m.value === "4")?.label).toBe("Treatments");
    expect(metrics.some((m) => m.label === "Genotypes")).toBe(false);
  });

  it("genotype-based modules keep their Genotypes label", () => {
    const metrics = resolveMetrics("genetic_parameters", { n_genotypes: 10 });
    expect(metrics[0]).toMatchObject({ label: "Genotypes", value: "10" });
  });
});

describe("EA-FINAL-01 item 2 — Factorial CRD replication count", () => {
  it("guards the fixture: dataset_summary counts 9 replicate IDs, the design has 3", () => {
    expect((factCrd02 as Payload & { dataset_summary: { n_reps: number } }).dataset_summary.n_reps).toBe(9);
    expect(governedFactorialReplications(factCrd02)).toBe(3);
  });

  it("results header: VS_Smoke_02 shows 3 replications per treatment combination", () => {
    expect(replicationBadgeLabel(factCrd02 as never, "factorial_crd")).toBe(
      "3 replications per treatment combination",
    );
  });

  it("results header: other designs are unchanged", () => {
    expect(replicationBadgeLabel(factRcbd04 as never, "factorial_rcbd")).toBe(
      "3 replications per treatment combination",
    );
    expect(replicationBadgeLabel(rcbd03 as never, "rcbd")).toBe("4 replications");
    expect(replicationBadgeLabel(split05 as never, "split_plot_rcbd")).toBe("4 replications");
    expect(replicationBadgeLabel(crd01 as never, "crd")).toBeNull();
  });

  it("results header: a factorial without a governed profile shows no replication count", () => {
    const noProfile = { dataset_summary: { n_reps: 9 }, trait_results: {} };
    expect(replicationBadgeLabel(noProfile, "factorial_crd")).toBeNull();
  });

  it("Recent Analyses card: VS_Smoke_02 shows 3 REPS, not 9", () => {
    const summary = summaryFor(factCrd02 as Payload, "factorial_crd");
    expect(summary.n_reps).toBe(3);
    render(<RecentAnalysesV3 rows={[row("2", "factorial_crd", summary)] as never} />);
    expect(metricCells()).toContain("3 Reps");
    expect(metricCells()).not.toContain("9 Reps");
  });

  it("Recent Analyses card: a legacy Factorial CRD row holding 9 shows no rep count", () => {
    render(<RecentAnalysesV3 rows={[row("3", "factorial_crd", { n_reps: 9, n_traits: 1 })] as never} />);
    expect(screen.queryByText("Reps")).toBeNull();
    expect(metricCells()).toContain("1 Traits");
  });

  it("Recent Analyses card: one-factor RCBD reps are unchanged", () => {
    const summary = summaryFor(rcbd03 as Payload, "rcbd");
    expect(summary.n_reps).toBe(4);
    expect(summary.n_reps_source).toBeUndefined();
  });
});
