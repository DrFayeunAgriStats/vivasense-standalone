/** All currently released VivaSense analyses are free.
 * User identity remains for pilot auditing; no subscription or licensing data
 * is stored, read, or sent to the backend. Scientific readiness is separate.
 */
export const BOOK_DATA_CLINIC_URL =
  "https://wa.me/2349022158026?text=Hello%20VivaSense%2C%20I%20want%20to%20book%20a%20Data%20Clinic%20session.";
export const VIVASENSE_USER_KEY = "vivasense_user";
function canStore(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}
export function setVivaSenseUser(identity: string | null): void {
  if (!canStore()) return;
  const trimmed = identity?.trim();
  if (trimmed) window.localStorage.setItem(VIVASENSE_USER_KEY, trimmed);
  else window.localStorage.removeItem(VIVASENSE_USER_KEY);
}
export function getVivaSenseUser(): string | null {
  if (!canStore()) return null;
  return window.localStorage.getItem(VIVASENSE_USER_KEY)?.trim() || null;
}
export function buildModeHeaders(baseHeaders?: HeadersInit): Headers {
  const headers = new Headers(baseHeaders);
  headers.delete("X-VivaSense-Mode");
  const identity = getVivaSenseUser();
  if (identity) headers.set("X-VivaSense-User", identity);
  return headers;
}
