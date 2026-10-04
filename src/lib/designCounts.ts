import { pl } from "@/lib/utils";

/**
 * Authoritative replication count for a governed factorial response.
 *
 * `dataset_summary.n_reps` is the number of distinct values in the mapped
 * replication column. In a Factorial CRD whose replicate IDs run 1..9 across
 * the treatment combinations that is 9, although each combination is
 * replicated 3 times. The validated design contract states the true count as
 * `factorial_profile.replications`; this reads it and nothing else — never
 * combinations, observations or cell counts.
 *
 * Returns null when no successful trait carries the profile, or when traits
 * disagree (no single honest number to show).
 */
export function governedFactorialReplications(response: unknown): number | null {
  const traitResults = (response as { trait_results?: unknown } | null | undefined)?.trait_results;
  if (!traitResults || typeof traitResults !== "object") return null;
  const counts = new Set<number>();
  for (const trait of Object.values(traitResults as Record<string, unknown>)) {
    const t = trait as { status?: unknown; analysis_result?: { result?: { factorial_profile?: unknown } | null } | null };
    if (t?.status !== "success") continue;
    const profile = t.analysis_result?.result?.factorial_profile as Record<string, unknown> | null | undefined;
    const reps = profile?.replications;
    if (typeof reps === "number" && Number.isFinite(reps) && reps > 0) counts.add(reps);
  }
  return counts.size === 1 ? [...counts][0] : null;
}

/**
 * Replication badge text for the ANOVA results header (EA-FINAL-01).
 *
 * Factorial designs read the governed `factorial_profile.replications` and say
 * what it counts ("3 replications per treatment combination"); with no
 * profile the badge is omitted rather than falling back to the replicate-ID
 * count. Every other design keeps `dataset_summary.n_reps`.
 */
export function replicationBadgeLabel(
  response: { dataset_summary?: { n_reps?: number | null } | null } | null | undefined,
  design: string,
): string | null {
  if (design === "factorial_crd" || design === "factorial_rcbd") {
    const reps = governedFactorialReplications(response);
    return reps != null ? `${pl(reps, "replication")} per treatment combination` : null;
  }
  const reps = response?.dataset_summary?.n_reps;
  return typeof reps === "number" && Number.isFinite(reps) && reps > 0 ? pl(reps, "replication") : null;
}
