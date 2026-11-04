import { describe, expect, it, vi } from "vitest";
import { GENERAL_WORD_ENDPOINT, downloadGeneralWord, generalWordFilename, generalWordPayload, hasIntegritySeal, isGeneralResult } from "./generalWordExport";

const sealed = {
  analysis_context: "general", method: "pearson", alpha: 0.05, trait_names: ["A", "B"],
  pair_results: [{ trait_1: "A", trait_2: "B", r: 0.5, n: 10, estimable: true, p_raw: 0.1, p_adjusted: 0.1, significant_adjusted: false }],
  multiplicity: { n_hypotheses: 1 }, warnings: ["w"], phenotypic: { n_observations: 10, r_matrix: [[1, 0.5], [0.5, 1]] },
  result_integrity: { scheme: "relationship-seal-v1", key_id: "sha256:x", mac: "m" },
};

describe("General Word export", () => {
  it("targets the seal-required General export endpoint", () => {
    expect(GENERAL_WORD_ENDPOINT).toBe("/export/correlation-word/general");
  });
  it("detects seal and General context", () => {
    expect(hasIntegritySeal(sealed)).toBe(true);
    expect(isGeneralResult(sealed)).toBe(true);
    expect(isGeneralResult({ ...sealed, analysis_context: "genetic" })).toBe(false);
  });
  it("sends the backend response unchanged and detached", () => {
    const p = generalWordPayload(sealed);
    expect(p).toEqual(sealed); expect(p).not.toBe(sealed);
  });
  it("refuses unsealed or non-General results without contacting the backend", async () => {
    const { result_integrity: _s, ...unsealed } = sealed;
    const request = vi.fn();
    await expect(downloadGeneralWord(unsealed, { request: request as never, save: vi.fn() })).rejects.toThrow(/integrity seal/);
    await expect(downloadGeneralWord({ ...sealed, analysis_context: "genetic" }, { request: request as never, save: vi.fn() })).rejects.toThrow(/Only a General/);
    expect(request).not.toHaveBeenCalled();
  });
  it("POSTs the sealed result as a blob request and saves it", async () => {
    const blob = new Blob(["docx"]); const request = vi.fn(async () => blob); const save = vi.fn();
    const name = await downloadGeneralWord(sealed, { request: request as never, save });
    expect(request).toHaveBeenCalledWith(GENERAL_WORD_ENDPOINT, { method: "POST", jsonBody: sealed, responseType: "blob", timeoutMs: 180000 });
    expect(save).toHaveBeenCalledWith(blob, name);
    expect(generalWordFilename(new Date("2026-11-05T00:00:00Z"))).toBe("vivasense_general_correlation_2026-11-05.docx");
  });
  it("propagates a backend refusal verbatim and saves nothing", async () => {
    const save = vi.fn();
    const request = vi.fn(async () => { throw new Error("General Word report refused: ... (integrity seal mismatch)"); });
    await expect(downloadGeneralWord(sealed, { request: request as never, save })).rejects.toThrow(/seal mismatch/);
    expect(save).not.toHaveBeenCalled();
  });
});
