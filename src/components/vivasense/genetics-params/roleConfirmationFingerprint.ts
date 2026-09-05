/**
 * W1-UI-04 — Experimental role confirmation fingerprint.
 *
 * Deliberately narrower than W1-INT-06's `canonicalAnalysisFingerprint`
 * (analysisIdentity.ts): that fingerprint answers "does this result still
 * describe the current scientific state", and includes every field capable
 * of changing model structure, numerical output or report content. This one
 * answers a different question — "has the researcher explicitly confirmed
 * THIS experimental structure" — and its input type has no way to even
 * accept alpha, trait selection or response semantics: changing those does
 * not change the experimental structure the researcher already reviewed and
 * confirmed, so they must never force a reconfirmation.
 */

import { activeMapping, type ColumnMapping, type GovernedDesignType } from "./anovaDesigns";

export interface RoleConfirmationInputs {
  datasetToken: string | null;
  design: GovernedDesignType;
  mapping: ColumnMapping;
}

/**
 * Canonical, deterministic fingerprint of the confirmed experimental
 * structure: dataset identity + design + the design's active structural-role
 * mapping. Built with `activeMapping`, so a role left over from a previous
 * design selection (inert, never sent to the backend) cannot affect it
 * either — the same guarantee `canonicalAnalysisFingerprint` and
 * `buildAnovaRequest` already rely on.
 */
export function canonicalRoleConfirmationFingerprint(inputs: RoleConfirmationInputs): string {
  const active = activeMapping(inputs.design, inputs.mapping);
  const structuralMapping: [string, string, string, string, string, string] = [
    active.treatment ?? "",
    active.rep ?? "",
    active.factor_a ?? "",
    active.factor_b ?? "",
    active.main_plot ?? "",
    active.sub_plot ?? "",
  ];
  return JSON.stringify([inputs.datasetToken, inputs.design, structuralMapping]);
}
