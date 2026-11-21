import { describe, it, expect, vi, afterEach } from "vitest";
import { vivaSenseRequest } from "../vivasenseApiClient";
import { buildStabilityPayload, buildPcaPayload } from "@/lib/advancedAnalysisApi";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) } }));

afterEach(() => vi.restoreAllMocks());

describe("advanced API contract", () => {
  it("does not send a paid-plan header when running free PCA", async () => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    vi.stubGlobal("fetch", f);
    await vivaSenseRequest("/analysis/pca", { method: "POST", jsonBody: { a: 1 }, retries: 0 });
    const headers = new Headers((f.mock.calls[0][1] as RequestInit).headers);
    expect(headers.has("X-VivaSense-Mode")).toBe(false);
    expect(headers.get("Content-Type")).toBe("application/json");
  });
  it("surfaces the message of a structured 422 detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: { error_code: "RCBD_STRUCTURE_INVALID", message: "not a complete balanced RCBD" } }), { status: 422 })));
    await expect(vivaSenseRequest("/analysis/stability", { method: "POST", jsonBody: {}, retries: 0 })).rejects.toThrow("not a complete balanced RCBD");
  });
  it("surfaces input errors and independent-scientific-validation restrictions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "bad input" }), { status: 422 })));
    await expect(vivaSenseRequest("/x", { method: "POST", jsonBody: {}, retries: 0 })).rejects.toThrow("bad input");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "METHOD_UNAVAILABLE", message: "This method is unavailable pending independent scientific validation." }), { status: 403 })));
    await expect(vivaSenseRequest("/x", { method: "POST", jsonBody: {}, retries: 0 })).rejects.toThrow("METHOD_UNAVAILABLE");
  });
  it("payload builders match the backend request models", () => {
    expect(buildStabilityPayload({ datasetToken: "t", trait: "Y", methods: ["eberhart-russell", "ammi"], excludeInvalid: false })).toEqual(
      { dataset_token: "t", trait_column: "Y", methods: ["eberhart-russell", "ammi"] });
    expect(buildStabilityPayload({ datasetToken: "t", trait: "Y", excludeInvalid: true }).exclude_invalid_observations).toBe(true);
    const p = buildPcaPayload({ datasetToken: "t", traits: ["a", "b"], scale: true, nComponents: null }) as unknown as Record<string, unknown>;
    expect(p.dataset_token).toBe("t"); expect(p.trait_columns).toEqual(["a", "b"]);
  });
});
