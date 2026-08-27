/**
 * Phase B — one authoritative ANOVA submission path.
 *
 * The Genetics & Breeding form used to submit its own ANOVA request, inferring
 * the design as `repValue ? "rcbd" : "crd"`. Two code paths that build
 * different payloads for the same analysis cannot both be authoritative: one of
 * them silently produced a weaker request (no factorial, no split-plot, no
 * alpha). These tests pin that only the governed path remains.
 *
 * The source-level assertions below are deliberate. The retired branch is a
 * *construction site*, and the regression worth preventing is someone
 * reinstating a second payload builder — which is visible in the source long
 * before it is visible in behaviour.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GENETICS_ANALYSIS_OPTIONS } from "../../VivaSenseGeneticsForm";

const readSource = (relative: string) =>
  readFileSync(resolve(process.cwd(), relative), "utf-8");

describe("Genetics & Breeding form", () => {
  it("no longer offers ANOVA as one of its analyses", () => {
    expect(GENETICS_ANALYSIS_OPTIONS.map((o) => o.value)).not.toContain("anova");
  });

  it("still offers its own genetics analyses", () => {
    const values = GENETICS_ANALYSIS_OPTIONS.map((o) => o.value);
    expect(values).toContain("variance_components");
    expect(values).toContain("correlations");
    expect(values).toContain("regression");
  });
});

describe("VivaSenseWorkspace no longer builds an ANOVA payload", () => {
  const source = readSource("src/pages/VivaSenseWorkspace.tsx");

  it("does not infer the design from whether a rep column is filled", () => {
    expect(source).not.toMatch(/design_type:\s*repValue\s*\?/);
  });

  it("does not construct an analyze-upload request with module 'anova'", () => {
    // The retired branch throws instead of calling analyzeUpload.
    expect(source).not.toMatch(/module:\s*"anova"/);
  });

  it("directs ANOVA to the governed module instead", () => {
    expect(source).toMatch(/Experimental Design \/ ANOVA module/);
  });
});

describe("the governed panel is the only ANOVA request builder", () => {
  it("AnovaModulePanel delegates construction to buildAnovaRequest", () => {
    const panel = readSource(
      "src/components/vivasense/genetics-params/AnovaModulePanel.tsx"
    );
    expect(panel).toMatch(/buildAnovaRequest\(/);
    // No inline payload literal competing with the builder.
    expect(panel).not.toMatch(/design_type:\s*effectiveDesign/);
  });

  it("only anovaDesigns.ts assembles design_type + column roles", () => {
    const designs = readSource(
      "src/components/vivasense/genetics-params/anovaDesigns.ts"
    );
    expect(designs).toMatch(/design_type: design/);
    expect(designs).toMatch(/main_plot_column: active\.main_plot/);
  });
});
