/**
 * Reproduction for the boundary-warning rendering defect.
 *
 * Reported symptom: the amber boundary/truncation panel renders roughly one
 * character per line, producing an extremely tall unreadable block.
 *
 * This test distinguishes the two candidate causes decisively:
 *   - a DATA bug would put one character in each <li>;
 *   - a CSS bug would put whole sentences in each <li> and be invisible here.
 * Whichever it is, the assertions below pin the correct DOM shape.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { readLambda, readSelectionGate } from "../governedTransformation";
import type { ExplorationResponse } from "@/services/rcbdTransformationApi";

/** Exactly what the deployed engine returned for the boundary fixture. */
const BOUNDARY_CANDIDATE = {
  status: "computed",
  transform: "box_cox",
  formula: "(((x + 0)^-2) - 1) / -2",
  lambda: -2.0,
  lambda_profile: {
    search_minimum: -2.0,
    search_maximum: 2.0,
    increment: 0.05,
    profile_interval: [-2.0, 2.0],
    confidence_level: 0.95,
    boundary_hit: true,
    interval_truncated: true,
    exact_vs_approximation: "exact",
  },
  shift: 0.0,
  warnings: [
    "The Box-Cox optimum occurs at the search boundary; the optimum may lie outside the evaluated grid.",
    "The Box-Cox profile interval is truncated by the evaluated search grid.",
  ],
};

/**
 * jsonlite unboxes a length-1 vector, so an R character vector holding ONE
 * warning arrives as a bare string rather than an array of one.
 */
const SINGLE_WARNING_CANDIDATE = {
  ...BOUNDARY_CANDIDATE,
  warnings: "The Box-Cox optimum occurs at the search boundary.",
};

const exploration = (candidate: Record<string, unknown>, reasons: unknown): ExplorationResponse =>
  ({
    transformed_branch_token: "b",
    raw_analysis_token: "r",
    dataset_token: "d",
    module: "anova",
    trait: "Yield",
    original_trait: "Yield",
    sanitized_trait: "Yield",
    design: "rcbd",
    inferential_alpha: 0.05,
    model_frame_identity: "sha256:" + "a".repeat(64),
    eligibility_status: "ineligible_for_selection",
    eligibility_reasons: reasons,
    authority: "exploratory_not_selected_for_inference",
    exploration_available: true,
    user_initiated: true,
    not_selected_for_inference: true,
    response_semantics: { response_type: "continuous" },
    raw_reference: {},
    candidate,
    transformed_evidence: {},
    provenance: {},
  }) as unknown as ExplorationResponse;

describe("boundary warnings — data shape", () => {
  it("keeps each warning as one whole sentence, not one character per entry", () => {
    const lambda = readLambda(BOUNDARY_CANDIDATE)!;
    expect(lambda.warnings).toHaveLength(2);
    for (const w of lambda.warnings) {
      // A per-character split would make every entry length 1.
      expect(w.length).toBeGreaterThan(20);
      expect(w).toMatch(/\s/);
    }
  });

  it("does not silently drop a single warning that jsonlite unboxed to a string", () => {
    const lambda = readLambda(SINGLE_WARNING_CANDIDATE)!;
    expect(lambda.warnings).toHaveLength(1);
    expect(lambda.warnings[0]).toBe("The Box-Cox optimum occurs at the search boundary.");
  });

  it("never explodes an unboxed string into characters", () => {
    const lambda = readLambda(SINGLE_WARNING_CANDIDATE)!;
    expect(lambda.warnings.every((w) => w.length > 1)).toBe(true);
  });
});

describe("eligibility reasons — data shape", () => {
  it("handles an array of reasons", () => {
    const gate = readSelectionGate(
      exploration(BOUNDARY_CANDIDATE, ["lambda_optimum_on_search_boundary", "profile_interval_truncated"])
    );
    expect(gate.reasons).toHaveLength(2);
    expect(gate.blockedExplanation).toMatch(/edge of the evaluated grid/i);
  });

  it("survives a single reason unboxed to a bare string", () => {
    const gate = readSelectionGate(exploration(BOUNDARY_CANDIDATE, "lambda_optimum_on_search_boundary"));
    expect(gate.reasons).toHaveLength(1);
    expect(gate.reasons[0]).toBe("lambda_optimum_on_search_boundary");
    expect(gate.blockedExplanation).toMatch(/edge of the evaluated grid/i);
  });

  it("survives an absent reasons field", () => {
    const gate = readSelectionGate(exploration(BOUNDARY_CANDIDATE, undefined));
    expect(gate.reasons).toEqual([]);
    expect(gate.selectable).toBe(false);
  });
});

describe("boundary warnings — rendered DOM", () => {
  function WarningBlock({ warnings }: { warnings: string[] }) {
    return (
      <div>
        <ul aria-label="warnings">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </div>
    );
  }

  it("renders one list item per warning, each holding a full sentence", () => {
    const lambda = readLambda(BOUNDARY_CANDIDATE)!;
    render(<WarningBlock warnings={lambda.warnings} />);
    const items = screen.getByLabelText("warnings").querySelectorAll("li");
    expect(items).toHaveLength(2);
    items.forEach((li) => {
      expect((li.textContent ?? "").length).toBeGreaterThan(20);
    });
  });

  it("renders a long warning array without one item per character", () => {
    const many = Array.from({ length: 6 }, (_, i) => `Warning ${i + 1}: the evaluated grid boundary was reached during profiling.`);
    render(<WarningBlock warnings={many} />);
    const items = screen.getByLabelText("warnings").querySelectorAll("li");
    expect(items).toHaveLength(6);
    expect(items.length).toBeLessThan(20);
  });
});
