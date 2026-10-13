/** Early Access mode compatibility. No commercial decision is made here. */
export type VivaSenseMode = "free" | "pro";
export const VIVASENSE_MODE_KEY = "vivasense_mode";
export const VIVASENSE_EXPIRES_KEY = "vivasense_pro_expires_at";
export const VIVASENSE_DEFAULT_MODE: VivaSenseMode = "pro";
export const BOOK_DATA_CLINIC_URL =
  "https://wa.me/2349022158026?text=Hello%20VivaSense%2C%20I%20want%20to%20book%20a%20Data%20Clinic%20session.";
export const VIVASENSE_MODE_CHANGED_EVENT = "vivasense-mode-changed";
export const VIVASENSE_USER_KEY = "vivasense_user";

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getProExpiresAt(): string | null { return null; }

export function initializeVivaSenseMode(): VivaSenseMode {
  if (canUseLocalStorage()) {
    window.localStorage.setItem(VIVASENSE_MODE_KEY, "pro");
    window.localStorage.removeItem(VIVASENSE_EXPIRES_KEY);
  }
  return "pro";
}

export function getVivaSenseMode(): VivaSenseMode { return "pro"; }

export function setVivaSenseMode(
  _mode: VivaSenseMode,
  _expiresAt: string | null = null,
): void {
  if (!canUseLocalStorage()) return;
  window.localStorage.setItem(VIVASENSE_MODE_KEY, "pro");
  window.localStorage.removeItem(VIVASENSE_EXPIRES_KEY);
  window.dispatchEvent(new Event(VIVASENSE_MODE_CHANGED_EVENT));
}

export function subscribeVivaSenseMode(
  cb: (mode: VivaSenseMode) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb("pro");
  window.addEventListener(VIVASENSE_MODE_CHANGED_EVENT, handler);
  return () => window.removeEventListener(VIVASENSE_MODE_CHANGED_EVENT, handler);
}

export async function redeemProCode(_code: string): Promise<
  | { ok: true; expires_at: string; already_redeemed?: boolean }
  | { ok: false; error: string }
> {
  setVivaSenseMode("pro");
  return { ok: true, expires_at: "9999-12-31T23:59:59.999Z", already_redeemed: true };
}

export async function syncProAccessFromServer(): Promise<{
  mode: VivaSenseMode;
  expiresAt: string | null;
}> {
  initializeVivaSenseMode();
  return { mode: "pro", expiresAt: null };
}

export function isProMode(): boolean { return true; }
export function modeLabel(_mode: VivaSenseMode): string { return "Early Access"; }

export class ProFeatureError extends Error {
  code: string;
  featureName: string;
  constructor(featureName: string) {
    super("This feature is unavailable");
    this.name = "ProFeatureError";
    this.code = "PRO_FEATURE";
    this.featureName = featureName;
  }
}

export function guardProModule(_moduleName: string): void {
  // Commercial restrictions are disabled during Early Access.
}
export function ensureProAccess(featureName: string): void { guardProModule(featureName); }

export function setVivaSenseUser(identity: string | null): void {
  if (!canUseLocalStorage()) return;
  const trimmed = identity?.trim();
  if (trimmed) window.localStorage.setItem(VIVASENSE_USER_KEY, trimmed);
  else window.localStorage.removeItem(VIVASENSE_USER_KEY);
}

export function getVivaSenseUser(): string | null {
  if (!canUseLocalStorage()) return null;
  const stored = window.localStorage.getItem(VIVASENSE_USER_KEY)?.trim();
  return stored ? stored : null;
}

export function buildModeHeaders(baseHeaders?: HeadersInit): Headers {
  const headers = new Headers(baseHeaders);
  headers.set("X-VivaSense-Mode", "pro");
  const identity = getVivaSenseUser();
  if (identity) headers.set("X-VivaSense-User", identity);
  return headers;
}

/** @deprecated Commercial activation is disabled during Early Access. */
export function activateProWithCode(_code: string): boolean {
  setVivaSenseMode("pro");
  return true;
}
