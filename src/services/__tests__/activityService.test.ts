import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), rpc: vi.fn(), request: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getSession: mocks.session }, rpc: mocks.rpc } }));
import { activityModule, recordActivity } from "../activityService";
import { requestWithResilience } from "../httpClient";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ data: { session: { user: { id: "user-a" } } } });
  mocks.rpc.mockResolvedValue({ error: null });
  vi.stubGlobal("fetch", mocks.request);
});

describe("usage recording", () => {
  it("covers the missing modules without emitting dataset tokens", () => {
    expect(activityModule("/genetics/correlation/general")).toBe("correlation");
    expect(activityModule("/analysis/regression?dataset_token=private")).toBe("regression");
    expect(activityModule("/field-layout/generate")).toBe("field_layout");
    expect(activityModule("/persistence/analysis-runs/private-id")).toBe("persistent_analysis");
    expect(activityModule("/health")).toBeNull();
  });
  it("does not submit an event while signed out", async () => {
    mocks.session.mockResolvedValue({ data: { session: null } });
    await recordActivity("correlation", "request_started", "operation");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("records one start and one response across HTTP retries", async () => {
    mocks.request.mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    await requestWithResilience("https://engine.example/analysis/regression", { method: "POST", retries: 1, retryDelayMs: 0 });
    await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(2));
    const events = mocks.rpc.mock.calls.map((call) => call[1]);
    expect(events.map((event) => event.p_event)).toEqual(["request_started", "response_received"]);
    expect(events[0].p_operation_id).toBe(events[1].p_operation_id);
  });
  it("records final request failure without swallowing it", async () => {
    mocks.request.mockRejectedValue(new Error("offline"));
    await expect(requestWithResilience("/field-layout/generate", { method: "POST" })).rejects.toThrow("offline");
    await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(2));
    expect(mocks.rpc.mock.calls[1][1].p_event).toBe("request_failed");
  });
});
