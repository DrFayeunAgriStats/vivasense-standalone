/**
 * REG-DIAG-02: inspect the generated .docx itself (word/document.xml and
 * media), not just the UI. Every number and sentence in the workspace report
 * model must appear verbatim in the Word document.
 */
import JSZip from "jszip";
import { Packer } from "docx";
import { describe, expect, it } from "vitest";
import fixtures from "@/test/fixtures/regressionDiagnosticsResponses.json";
import {
  INFLUENCE_LEGACY_NOTE, MODEL_FORM_NOTE, RESIDUAL_PLOT_DESCRIPTION, regressionReport, type SimpleRegressionResult,
} from "@/lib/simpleRegression";
import { PLOT_NOT_EMBEDDED_NOTE, buildRegressionDocument } from "@/lib/regressionWordReport";

const influential = fixtures.influential_height_alpha_10 as unknown as SimpleRegressionResult;
const curved = fixtures.curved_leaf_area as unknown as SimpleRegressionResult;
const smallSample = fixtures.small_sample_n4 as unknown as SimpleRegressionResult;

// 1×1 transparent PNG
const PNG = Uint8Array.from(atob(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
), (c) => c.charCodeAt(0));

async function docx(result: SimpleRegressionResult, images = { fitted: PNG, residual: PNG }) {
  const buffer = await Packer.toBuffer(buildRegressionDocument(result, images));
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml")!.async("string");
  // Concatenate text runs per paragraph / cell so assertions read like the document.
  const text = xml
    .replace(/<w:p[ >]/g, "\n$&")
    .replace(/<w:tc>/g, " | ")
    .replace(/<[^>]+>/g, "")
    .replace(/&apos;/g, "'").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  const media = Object.keys(zip.files).filter((f) => f.startsWith("word/media/"));
  return { xml, text, media };
}

describe("Word report contents", () => {
  it("contains every row, table cell and note of the workspace report model verbatim", async () => {
    const { text } = await docx(influential);
    for (const section of regressionReport(influential)) {
      expect(text).toContain(section.title);
      for (const [label, value] of section.rows) {
        expect(text).toContain(label);
        expect(text).toContain(value);
      }
      for (const table of section.tables ?? []) {
        expect(text).toContain(table.caption);
        for (const cell of [...table.columns, ...table.rows.flat()]) if (cell) expect(text).toContain(cell);
      }
      for (const note of section.notes ?? []) expect(text).toContain(note);
    }
  });

  it("reports coefficients, ANOVA df and the flagged data row with the alpha-specific CI level", async () => {
    const { text } = await docx(influential);
    expect(text).toContain("90% CI lower");
    expect(text).toMatch(/Residual\s*\|\s*26\b/);
    expect(text).toMatch(/Total\s*\|\s*27\b/);
    expect(text).toContain("8.01058 on 26 degrees of freedom");
    expect(text).toContain("1 of 28 (data row 30)");
    expect(text).toContain("2p/n = 0.142857");
  });

  it("embeds both plots and states the model-form caution for the curved example", async () => {
    const { text, media } = await docx(curved);
    expect(media).toHaveLength(2);
    expect(text).toContain(MODEL_FORM_NOTE);
    expect(text).toContain(RESIDUAL_PLOT_DESCRIPTION);
    expect(text).not.toMatch(/fits (the data )?well|good fit|adequate fit/i);
  });

  it("says where a plot could not be embedded instead of silently dropping it", async () => {
    const { text, media } = await docx(curved, { fitted: null, residual: null } as never);
    expect(media).toHaveLength(0);
    expect(text).toContain(`Residuals versus fitted values: ${PLOT_NOT_EMBEDDED_NOTE}`);
  });

  it("explains unavailable screening for a very small sample", async () => {
    const { text } = await docx(smallSample);
    expect(text).toContain("needs at least 5 complete observations; this model has 4");
  });

  it("exports an older response without the new fields", async () => {
    const {
      coefficients: _c, residual_standard_error: _r, df_residual: _d, anova_table: _a,
      observation_diagnostics: _o, influence_screening: _i, ...old
    } = influential;
    const { text } = await docx(old as SimpleRegressionResult);
    expect(text).toContain("90% slope confidence interval");
    expect(text).toContain(INFLUENCE_LEGACY_NOTE);
    expect(text).not.toContain("Coefficient estimates");
  });
});
