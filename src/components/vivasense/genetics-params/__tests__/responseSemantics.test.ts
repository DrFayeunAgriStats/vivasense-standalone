/**
 * W1-INT-04A — response semantics are declared, never inferred.
 *
 * The frontend half of the contract: a per-trait declaration that survives
 * alpha changes, design changes and edits to other traits, and that reaches the
 * wire exactly as the researcher set it. Nothing here may derive a scale from a
 * trait name or from any data value.
 */

import { describe, it, expect } from "vitest";
import { buildAnovaRequest, type ColumnMapping } from "../anovaDesigns";
import {
  RESPONSE_SEMANTIC_OPTIONS,
  type ResponseSemantic,
} from "@/services/geneticsUploadApi";

const ctx = {
  base64Content: "Zm9v",
  fileType: "csv" as const,
  genotypeColumn: "Genotype",
  repColumn: "Rep",
  environmentColumn: null,
  environmentFactorColumns: [],
  mode: "single" as const,
};

const mapping: ColumnMapping = { treatment: "Genotype", rep: "Rep" };
const TRAITS = ["DTF_Days", "PHTF_cm", "Germination_pct", "Survival_prop"];
const ALPHAS = [0.05, 0.01, 0.1] as const;

const build = (
  responseSemantics: Record<string, ResponseSemantic>,
  alpha: (typeof ALPHAS)[number] = 0.05,
  traits: string[] = TRAITS
) =>
  buildAnovaRequest({
    datasetContext: ctx, design: "rcbd", alpha, mapping, traits, responseSemantics,
  });

describe("W1-INT-04A — the four declared states reach the wire", () => {
  it("offers exactly the supported states, defaulting to Unknown first", () => {
    expect(RESPONSE_SEMANTIC_OPTIONS.map((o) => o.value)).toEqual([
      "unknown", "continuous", "count", "percentage", "proportion",
    ]);
    expect(RESPONSE_SEMANTIC_OPTIONS[0].value).toBe("unknown");
  });

  it.each(["continuous", "count", "percentage", "proportion"] as const)(
    "sends %s exactly as declared",
    (semantic) => {
      const request = build({ DTF_Days: semantic });
      expect(request.response_metadata).toEqual({ DTF_Days: { response_type: semantic } });
    }
  );

  // E / F — unknown is the absence of a declaration, not a value to transmit.
  it("omits traits left at Unknown rather than declaring them", () => {
    const request = build({ DTF_Days: "unknown", PHTF_cm: "continuous" });
    expect(request.response_metadata).toEqual({ PHTF_cm: { response_type: "continuous" } });
    expect(request.response_metadata?.DTF_Days).toBeUndefined();
  });

  it("sends no response_metadata at all when nothing is declared", () => {
    expect(build({}).response_metadata).toBeUndefined();
    expect(build({ DTF_Days: "unknown", PHTF_cm: "unknown" }).response_metadata).toBeUndefined();
  });

  // G / H — a suggestive name is not metadata.
  it.each(["Germination_pct", "Survival_prop"])(
    "never derives a scale from the trait name %s",
    (trait) => {
      const request = build({});
      expect(request.response_metadata).toBeUndefined();
      expect(request.trait_columns).toContain(trait);
    }
  );

  it("never defaults a selected trait to continuous", () => {
    const request = build({});
    for (const trait of TRAITS) {
      expect(request.response_metadata?.[trait]).toBeUndefined();
    }
  });

  // keys(response_metadata) must be a subset of trait_columns.
  it("drops declarations for traits that are not selected", () => {
    const request = build({ DTF_Days: "continuous", Removed_trait: "percentage" }, 0.05, ["DTF_Days"]);
    expect(request.response_metadata).toEqual({ DTF_Days: { response_type: "continuous" } });
    expect(Object.keys(request.response_metadata ?? {})).toEqual(
      expect.arrayContaining([])
    );
    for (const key of Object.keys(request.response_metadata ?? {})) {
      expect(request.trait_columns).toContain(key);
    }
  });
});

describe("W1-INT-04A — a declaration is independent of everything else", () => {
  // I — alpha must not move a semantic.
  it.each(ALPHAS)("survives alpha %s unchanged", (alpha) => {
    const request = build({ DTF_Days: "continuous", Germination_pct: "percentage" }, alpha);
    expect(request.response_metadata).toEqual({
      DTF_Days: { response_type: "continuous" },
      Germination_pct: { response_type: "percentage" },
    });
    expect(request.alpha).toBe(alpha);
  });

  it("changes nothing but alpha across 0.05 -> 0.01 -> 0.10 -> 0.05", () => {
    const declared: Record<string, ResponseSemantic> = {
      DTF_Days: "continuous", Survival_prop: "proportion",
    };
    const serialised = ([0.05, 0.01, 0.1, 0.05] as const).map((a) => {
      const { alpha: _a, ...rest } = build(declared, a);
      return JSON.stringify(rest);
    });
    for (const s of serialised) expect(s).toBe(serialised[0]);
  });

  // J — editing trait A must not touch trait B.
  it("leaves other traits untouched when one is changed", () => {
    const before: Record<string, ResponseSemantic> = {
      DTF_Days: "continuous", Germination_pct: "percentage",
    };
    const after = { ...before, DTF_Days: "count" as ResponseSemantic };
    expect(build(after).response_metadata).toEqual({
      DTF_Days: { response_type: "count" },
      Germination_pct: { response_type: "percentage" },
    });
    expect(before.Germination_pct).toBe("percentage");
  });

  it("is independent of the design", () => {
    const declared: Record<string, ResponseSemantic> = { DTF_Days: "percentage" };
    for (const design of ["crd", "rcbd"] as const) {
      const request = buildAnovaRequest({
        datasetContext: ctx, design, alpha: 0.05, mapping,
        traits: ["DTF_Days"], responseSemantics: declared,
      });
      expect(request.response_metadata).toEqual({ DTF_Days: { response_type: "percentage" } });
    }
  });

  it("does not disturb design-role identity (W1-INT-02 stays intact)", () => {
    const withSemantics = build({ DTF_Days: "percentage" });
    const withoutSemantics = build({});
    expect(withSemantics.genotype_column).toBe(withoutSemantics.genotype_column);
    expect(withSemantics.rep_column).toBe(withoutSemantics.rep_column);
    expect(withSemantics.design_type).toBe(withoutSemantics.design_type);
    expect(withSemantics.trait_columns).toEqual(withoutSemantics.trait_columns);
  });
});
