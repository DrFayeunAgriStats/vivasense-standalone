import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  vivaSenseRequest: vi.fn(),
  maybeSingle: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/services/vivasenseApiClient", () => ({
  vivaSenseRequest: mocks.vivaSenseRequest,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: mocks.getSession },
    from: mocks.from,
  },
}));

import { readPersistentRcbdAnalysis } from "../persistenceRcbdApi";

describe("readPersistentRcbdAnalysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "owner-token",
          user: { id: "user-1" },
        },
      },
      error: null,
    });

    mocks.maybeSingle.mockResolvedValue({
      data: {
        requested_design: "rcbd",
        requested_roles: { treatment: "genotype", rep: "rep" },
        selected_traits: ["yield"],
        alpha: 0.05,
        module: "anova",
        mode: "single",
      },
      error: null,
    });

    mocks.vivaSenseRequest.mockResolvedValue({
      analysis_run_id: "run-1",
      study_id: "study-1",
      dataset_id: "dataset-1",
      dataset_version_id: "dv-1",
      run_status: "COMPLETE",
      result_schema_version: "result-v1",
      result_payload: {
        yield: {
          grand_mean: 15,
          n_genotypes: 3,
          n_reps: 3,
          treatment_decision: {
            alpha: 0.05,
            p_value: 0.00018765246763,
            estimable: true,
            significant: true,
            rule: "p_value <= alpha",
          },
          mean_separation: {
            genotype: ["T3", "T2", "T1"],
            mean: [19, 15, 11],
            se: [0.3333333333, 0.3333333333, 0.3333333333],
            group: ["a", "b", "c"],
            alpha: 0.05,
            test: "Tukey HSD",
          },
          analysis_settings: {
            inferential_alpha: 0.05,
            diagnostic_alpha: 0.05,
          },
        },
      },
    });
  });

  it("restores the durable result through GET and never calls the execute route", async () => {
    const restored = await readPersistentRcbdAnalysis("run-1");

    expect(mocks.vivaSenseRequest).toHaveBeenCalledTimes(1);
    expect(mocks.vivaSenseRequest).toHaveBeenCalledWith(
      "/persistence/analysis-runs/run-1",
      expect.objectContaining({
        method: "GET",
        authToken: "owner-token",
      }),
    );

    const requestedPaths = mocks.vivaSenseRequest.mock.calls.map(([path]) => String(path));
    expect(requestedPaths.some((path) => path.includes("/analysis-runs/execute"))).toBe(false);

    expect(mocks.from).toHaveBeenCalledWith("analysis_runs");
    expect(restored.persistence).toMatchObject({
      analysis_run_id: "run-1",
      dataset_version_id: "dv-1",
      run_status: "COMPLETE",
      run_outcome: "RESTORED",
      requested_design: "rcbd",
      requested_roles: { treatment: "genotype", rep: "rep" },
      selected_traits: ["yield"],
      alpha: 0.05,
    });
    expect(restored.trait_results.yield.analysis_result?.result?.grand_mean).toBe(15);
    expect(restored.trait_results.yield.analysis_result?.result?.mean_separation?.group).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("fails closed if immutable AnalysisRun metadata and durable payload traits disagree", async () => {
    mocks.maybeSingle.mockResolvedValueOnce({
      data: {
        requested_design: "rcbd",
        requested_roles: { treatment: "genotype", rep: "rep" },
        selected_traits: ["yield", "missing_trait"],
        alpha: 0.05,
        module: "anova",
        mode: "single",
      },
      error: null,
    });

    await expect(readPersistentRcbdAnalysis("run-1")).rejects.toThrow(
      "Saved AnalysisRun metadata does not match its durable AnalysisResult.",
    );
  });
});
