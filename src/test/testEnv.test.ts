import { describe, expect, it } from "vitest";

describe("test environment never targets a real Supabase project", () => {
  it("uses the loopback dummy Supabase URL and key", () => {
    expect(import.meta.env.VITE_SUPABASE_URL).toBe("http://127.0.0.1:9");
    expect(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY).toBe("vitest-dummy-publishable-key");
    expect(String(import.meta.env.VITE_SUPABASE_URL)).not.toMatch(/supabase\.(co|in|com)/);
  });

  it("lets the Supabase client module load", async () => {
    const mod = await import("@/integrations/supabase/client");
    expect(mod.supabase).toBeDefined();
  });
});
