/** VivaSense open access policy: no paid tiers or license-code restrictions.
 * Independently unvalidated analyses remain server-disabled.
 */
export const VIVASENSE_ACCESS_POLICY = "free-for-all-released-methods" as const;
export const classifyAnovaRequest = (_analysisType: string, _data: FormData): null => null;
export const classifyGeneticsRequest = (_analysisType: string): null => null;
