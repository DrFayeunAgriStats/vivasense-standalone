import { describe, expect, it } from "vitest";
import { adaptPersistentRcbdResponse, type PersistentRcbdMetadata } from "../persistenceRcbdApi";

describe("adaptPersistentRcbdResponse", () => {
  it("preserves the governed A1 scientific fields and durable identity", () => {
    const meta: PersistentRcbdMetadata = {
      study_id: "study-1",
      dataset_id: "dataset-1",
      dataset_version_id: "dv-1",
      analysis_run_id: "run-1",
      prepare_outcome: "FINALIZED",
      run_outcome: "FINALIZED",
      run_status: "COMPLETE",
    };

    const response = adaptPersistentRcbdResponse(
      {
        yield: {
          design: "rcbd",
          grand_mean: 15,
          n_genotypes: 3,
          n_reps: 3,
          anova_table: {
            source: ["rep", "genotype", "Residuals"],
            df: [2, 2, 4],
            ss: [4.6666666667, 96, 1.3333333333],
            ms: [2.3333333333, 48, 0.3333333333],
            f_value: [7, 144, null],
            p_value: [0.049382716049, 0.00018765246763, null],
          },
          treatment_decision: {
            rule: "p_value <= alpha",
            alpha: 0.05,
            p_value: 0.00018765246763,
            estimable: true,
            significant: true,
          },
          mean_separation_status: {
            alpha: 0.05,
            method: "Tukey HSD",
            status: "success",
            reason_code: "tukey_hsd_success",
            residual_df: 4,
            residual_ms: 0.3333333333,
            omnibus_p_value: 0.00018765246763,
          },
          mean_separation: {
            se: [0.3333333333, 0.3333333333, 0.3333333333],
            mean: [19, 15, 11],
            test: "Tukey HSD",
            alpha: 0.05,
            group: ["a", "b", "c"],
            genotype: ["T3", "T2", "T1"],
          },
          analysis_settings: {
            inferential_alpha: 0.05,
            diagnostic_alpha: 0.05,
          },
          rcbd_design_profile: {
            n_treatments: 3,
            n_blocks: 3,
            complete: true,
          },
        },
      },
      ["yield"],
      meta,
    );

    expect(response.persistence).toEqual(meta);
    expect(response.dataset_summary).toMatchObject({
      n_genotypes: 3,
      n_reps: 3,
      n_traits: 1,
      mode: "single",
    });
    expect(response.summary_table[0]).toMatchObject({
      trait: "yield",
      grand_mean: 15,
      status: "success",
    });

    const result = response.trait_results.yield.analysis_result?.result;
    expect(result?.treatment_decision).toMatchObject({
      estimable: true,
      significant: true,
      alpha: 0.05,
      p_value: 0.00018765246763,
    });
    expect(result?.mean_separation?.genotype).toEqual(["T3", "T2", "T1"]);
    expect(result?.mean_separation?.group).toEqual(["a", "b", "c"]);
    expect(response.analysis_settings).toEqual({
      inferential_alpha: 0.05,
      diagnostic_alpha: 0.05,
    });
  });
});
