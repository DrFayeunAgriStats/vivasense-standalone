import { supabase } from "@/integrations/supabase/client";

export type ActivityEvent = "visit" | "request_started" | "response_received" | "request_failed";

/** Only fixed module labels leave the browser. No request bodies or dataset URLs. */
export function activityModule(url: string): string | null {
  const parsed = new URL(url, "https://vivasensestat.com");
  const path = parsed.pathname;
  if (path.startsWith("/field-layout/")) return "field_layout";
  if (path.includes("correlation")) return "correlation";
  if (path.includes("regression")) return "regression";
  if (path.startsWith("/persistence/")) return "persistent_analysis";
  const modules = ["pca", "cluster", "stability", "blup", "path-analysis", "selection-index", "trait-association"];
  for (const module of modules) {
    if (path.split("/").includes(module)) return module.replaceAll("-", "_");
  }
  if (path.startsWith("/genetics/")) {
    const module = parsed.searchParams.get("module");
    return module === "anova" ? "anova" : "genetics";
  }
  if (path.startsWith("/crop-protection/")) return "crop_protection";
  return null;
}

/** Client-observed activity, separate from scientific result persistence. */
export async function recordActivity(module: string, event: ActivityEvent, operationId: string): Promise<void> {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) return;
    // The RPC obtains the owner from auth.uid(); retries reuse this operation ID.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { error } = await supabase.rpc("record_usage_event" as never, {
        p_operation_id: operationId, p_module: module, p_event: event,
      } as never);
      if (!error) return;
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  } catch (error) {
    console.warn("[activity] Could not record usage event", error);
  }
}
