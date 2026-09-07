/**
 * W1-INT-09 — Current-session dataset-instance identity.
 *
 * This is NOT a scientific content identity, a dataset-version identity, or a
 * persistent project dataset identity. It identifies exactly one accepted
 * dataset-selection lifecycle within the current in-page frontend session:
 * generated once, in memory, the moment a `DatasetContext` is constructed for
 * governed analysis, and never persisted across a page reload, logout, or
 * route/workspace remount. A genuinely new upload/selection action always
 * produces a NEW instance id -- even when the researcher reselects the exact
 * same physical file -- because it identifies the selection event, not the
 * file's bytes.
 *
 * Deliberately decoupled from `DatasetContext.datasetToken`: that field is a
 * backend operational/cache/capability token (issued by
 * `/genetics/upload-preview` so OTHER stateful endpoints can look up a cached
 * context), and the backend can legitimately return it as `null` on an
 * otherwise-successful 200 response -- `multitrait_upload_routes.py`'s
 * dataset-cache registration is wrapped in a broad `try/except`. W1-INT-06's
 * and W1-UI-04's scientific-identity fingerprints must never treat that
 * operational fallback as "the dataset didn't change": `null`/`undefined`
 * collapse to the same JSON-serialized value, so two different token-less
 * datasets were indistinguishable to those fingerprints (W1-INT-09). This
 * module exists to give them an identity source a backend cache miss cannot
 * collapse.
 */

const DATASET_INSTANCE_ID_MAX_LENGTH = 200;

/**
 * Generate a new dataset-instance identity.
 *
 * Uses `crypto.randomUUID()` exclusively. Deliberately fails closed (throws)
 * rather than falling back to a weaker source of randomness (`Math.random()`,
 * `Date.now()`) if it is unavailable: a predictable or collidable identity
 * would silently reintroduce the exact class of defect this module exists to
 * close. Verified available in both the target browser runtime (secure
 * contexts: HTTPS and localhost) and this project's jsdom test environment.
 */
export function createDatasetInstanceId(): string {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || typeof cryptoObj.randomUUID !== "function") {
    throw new Error(
      "createDatasetInstanceId: crypto.randomUUID() is unavailable in this runtime. " +
        "Refusing to generate a dataset-instance identity from a weaker source of randomness."
    );
  }
  return cryptoObj.randomUUID();
}

/**
 * The one canonical validity check for a dataset-instance identity value.
 * Every gate that decides whether scientific confirmation/analysis may
 * proceed must route through this rather than an ad-hoc truthy check --
 * see W1-INT-09.
 *
 * Rejects: `undefined`, `null`, `""`, whitespace-only strings, non-string
 * types, and unreasonably long values. No coercion is performed.
 */
export function isValidDatasetInstanceId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= DATASET_INSTANCE_ID_MAX_LENGTH
  );
}
