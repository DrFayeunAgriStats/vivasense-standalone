import { supabase } from "@/integrations/supabase/client";

// ─ DEVELOPMENT OVERRIDE ─────────────────────────────────────────────
// During active development of Phase 6+ modules, this flag temporarily
// permits all Pro features regardless of subscription status. This is a
// deliberate, reversible override — NOT a permanent security decision.
// To restore gating: change this to `false` (one-line revert).
const TEMP_ALL_FEATURES_PERMITTED = true;
// ────────────────────────────────────────────────────────────────────

export type VivaSenseMode = "free" | "pro";

export const VIVASENSE_MODE_KEY = "vivasense_mode";
export const VIVASENSE_EXPIRES_KEY = "vivasense_pro_expires_at";
export const VIVASENSE_DEFAULT_MODE: VivaSenseMode = "free";
export const BOOK_DATA_CLINIC_URL =
  "https://wa.me/2349022158026?text=Hello%20VivaSense%2C%20I%20want%20to%20book%20a%20Data%20Clinic%20session.";
export const VIVASENSE_MODE_CHANGED_EVENT = "vivasense-mode-changed";

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getProExpiresAt(): string | null {
  if (!canUseLocalStorage()) return null;
  return window.localStorage.getItem(VIVASENSE_EXPIRES_KEY);
}

function applyMode(mode: VivaSenseMode, expiresAt: string | null) {
  if (!canUseLocalStorage()) return;
  window.localStorage.setItem(VIVASENSE_MODE_KEY, mode);
  if (expiresAt) window.localStorage.setItem(VIVASENSE_EXPIRES_KEY, expiresAt);
  else window.localStorage.removeItem(VIVASENSE_EXPIRES_KEY);
  window.dispatchEvent(new Event(VIVASENSE_MODE_CHANGED_EVENT));
}

export function initializeVivaSenseMode(): VivaSenseMode {
  if (!canUseLocalStorage()) return VIVASENSE_DEFAULT_MODE;
  const existing = window.localStorage.getItem(VIVASENSE_MODE_KEY);
  const expires = window.localStorage.getItem(VIVASENSE_EXPIRES_KEY);
  if (existing === "pro" && expires && new Date(expires) > new Date()) return "pro";
  if (existing === "pro") {
    // expired locally — clear
    applyMode("free", null);
    return "free";
  }
  if (existing === "free") return "free";
  window.localStorage.setItem(VIVASENSE_MODE_KEY, VIVASENSE_DEFAULT_MODE);
  return VIVASENSE_DEFAULT_MODE;
}

export function getVivaSenseMode(): VivaSenseMode {
  return initializeVivaSenseMode();
}

export function setVivaSenseMode(mode: VivaSenseMode, expiresAt: string | null = null): void {
  applyMode(mode, expiresAt);
}

export function subscribeVivaSenseMode(cb: (mode: VivaSenseMode) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb(getVivaSenseMode());
  window.addEventListener(VIVASENSE_MODE_CHANGED_EVENT, handler);
  return () => window.removeEventListener(VIVASENSE_MODE_CHANGED_EVENT, handler);
}

/** Calls the edge function to redeem a Pro code for the current authenticated user. */
export async function redeemProCode(code: string): Promise<
  | { ok: true; expires_at: string; already_redeemed?: boolean }
  | { ok: false; error: string }
> {
  const trimmed = code.trim();
  if (!trimmed) return { ok: false, error: "Please enter an access code." };

  const { data, error } = await supabase.functions.invoke("vivasense-pro-redeem", {
    body: { code: trimmed },
  });
  if (error) {
    // supabase-js wraps non-2xx as FunctionsHttpError. Try to surface body.error.
    const ctx: any = (error as any).context;
    try {
      const body = ctx?.body ? await (ctx.body as ReadableStream).getReader().read() : null;
      if (body?.value) {
        const text = new TextDecoder().decode(body.value);
        const parsed = JSON.parse(text);
        return { ok: false, error: parsed?.error || error.message };
      }
    } catch { /* ignore */ }
    return { ok: false, error: error.message || "Could not redeem code." };
  }
  if (!data?.ok || !data?.expires_at) return { ok: false, error: data?.error || "Could not redeem code." };
  setVivaSenseMode("pro", data.expires_at);
  return { ok: true, expires_at: data.expires_at, already_redeemed: !!data.already_redeemed };
}

/** Reads the user's current Pro access row and syncs local mode. Safe to call when signed-out. */
export async function syncProAccessFromServer(): Promise<{ mode: VivaSenseMode; expiresAt: string | null }> {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) {
      // Signed-out: do not touch local mode (keeps URL ?mode=pro & dev overrides intact).
      return { mode: getVivaSenseMode(), expiresAt: getProExpiresAt() };
    }
    const { data, error } = await supabase
      .from("vivasense_pro_access")
      .select("expires_at")
      .eq("user_id", userRes.user.id)
      .maybeSingle();
    if (error) return { mode: getVivaSenseMode(), expiresAt: getProExpiresAt() };
    if (data?.expires_at && new Date(data.expires_at) > new Date()) {
      setVivaSenseMode("pro", data.expires_at);
      return { mode: "pro", expiresAt: data.expires_at };
    }
    setVivaSenseMode("free", null);
    return { mode: "free", expiresAt: null };
  } catch {
    return { mode: getVivaSenseMode(), expiresAt: getProExpiresAt() };
  }
}

export function isProMode(): boolean {
  return getVivaSenseMode() === "pro";
}

export function modeLabel(mode: VivaSenseMode): string {
  return mode === "pro" ? "Pro Mode" : "Free Mode";
}

export class ProFeatureError extends Error {
  code: string;
  featureName: string;
  constructor(featureName: string) {
    super("Upgrade to access this feature");
    this.name = "ProFeatureError";
    this.code = "PRO_FEATURE";
    this.featureName = featureName;
  }
}

export function guardProModule(moduleName: string): void {
  // DEVELOPMENT OVERRIDE: permit all features during active development.
  if (TEMP_ALL_FEATURES_PERMITTED) return;

  const mode = getVivaSenseMode();
  if (mode !== "pro") {
    console.log(`[PRO GUARD] mode = free, blocked module = ${moduleName}`);
    throw new ProFeatureError(moduleName);
  }
}

export function ensureProAccess(featureName: string): void {
  guardProModule(featureName);
}

export function buildModeHeaders(baseHeaders?: HeadersInit): Headers {
  const headers = new Headers(baseHeaders);
  headers.set("X-VivaSense-Mode", getVivaSenseMode());
  return headers;
}

/** @deprecated use redeemProCode (server-validated) */
export function activateProWithCode(_code: string): boolean {
  return false;
}
