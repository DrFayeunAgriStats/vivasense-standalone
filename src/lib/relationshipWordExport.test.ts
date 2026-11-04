import { describe, expect, it, vi } from "vitest";
import {
  RELATIONSHIP_WORD_ENDPOINT,
  downloadRelationshipWord,
  hasIntegritySeal,
  relationshipWordFilename,
  relationshipWordPayload,
} from "./relationshipWordExport";

const sealed = {
  analysis_context: "general",
  method: "spearman",
  alpha: 0.1,
  trait_names: ["A", "B"],
  pair_results: [{ trait_1: "A", trait_2: "B", r: 0.5, n: 10, p_raw: 0.1, p_adjusted: 0.1 }],
  multiplicity: { method: "BH", n_hypotheses: 1 },
  warnings: ["w1"],
  phenotypic: { r_matrix: [[1, 0.5], [0.5, 1]] },
  result_integrity: { scheme: "hmac-sha256", digest: "abc" },
};

describe("Relationship Word export payload", () => {
  it("detects the integrity seal", () => {
    expect(hasIntegritySeal(sealed)).toBe(true);
    expect(hasIntegritySeal({ ...sealed, result_integrity: null })).toBe(false);
    expect(hasIntegritySeal({ ...sealed, result_integrity: [] })).toBe(false);
    expect(hasIntegritySeal(null)).toBe(false);
  });

  it("sends the backend response unchanged — every field, including the seal", () => {
    const payload = relationshipWordPayload(sealed);
    expect(payload).toEqual(sealed);
    expect(payload).not.toBe(sealed); // detached copy
  });

  it("refuses to build a payload without a seal", () => {
    const { result_integrity: _drop, ...unsealed } = sealed;
    expect(() => relationshipWordPayload(unsealed)).toThrow(/no VivaSense integrity seal/);
  });

  it("names the file by context and date", () => {
    const d = new Date("2026-11-04T10:00:00Z");
    expect(relationshipWordFilename("general", d)).toBe("vivasense_relationship_general_2026-11-04.docx");
    expect(relationshipWordFilename("genetic", d)).toBe("vivasense_relationship_genetic_2026-11-04.docx");
    expect(relationshipWordFilename("anything", d)).toBe("vivasense_relationship_general_2026-11-04.docx");
  });
});

describe("downloadRelationshipWord", () => {
  it("POSTs the exact sealed result as a blob request and saves the file", async () => {
    const blob = new Blob(["docx"]);
    const request = vi.fn(async () => blob);
    const save = vi.fn();
    const name = await downloadRelationshipWord(sealed, "general", { request: request as never, save });
    expect(request).toHaveBeenCalledWith(RELATIONSHIP_WORD_ENDPOINT, {
      method: "POST", jsonBody: sealed, responseType: "blob", timeoutMs: 180000,
    });
    expect(save).toHaveBeenCalledWith(blob, name);
  });

  it("does not call the backend for an unsealed result", async () => {
    const request = vi.fn();
    await expect(downloadRelationshipWord({ trait_names: [] }, "general", { request: request as never, save: vi.fn() }))
      .rejects.toThrow(/integrity seal/);
    expect(request).not.toHaveBeenCalled();
  });

  it("propagates the backend integrity refusal verbatim and saves nothing", async () => {
    const save = vi.fn();
    const request = vi.fn(async () => { throw new Error("Relationship result integrity check failed"); });
    await expect(downloadRelationshipWord(sealed, "general", { request: request as never, save }))
      .rejects.toThrow("Relationship result integrity check failed");
    expect(save).not.toHaveBeenCalled();
  });
});
