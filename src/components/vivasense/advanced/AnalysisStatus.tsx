import { AlertTriangle, ShieldAlert, ShieldCheck, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Shared status displays for the multi-environment / multivariate modules.
 * Rule: a result whose independent cross-check did not agree (or was not run) is never shown as a validated conclusion;
 * every exclusion, method error and caution returned by the backend is displayed verbatim.
 */

export function VerificationBanner({
  status, reasons, subject = "This result",
}: { status?: string | null; reasons?: string[] | null; subject?: string }) {
  if (status === "verified") {
    return (
      <div className="flex items-start gap-2 rounded-md border border-emerald-300/70 bg-emerald-50/50 p-3 text-xs text-emerald-900 dark:bg-emerald-900/10 dark:text-emerald-100">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Numerically cross-checked: the R result was reproduced by an independent implementation. This is a computational check only; it
          is not a statistical review of the method (the module is still pre-release).
        </span>
      </div>
    );
  }
  if (status === "partially_verified") {
    // Manus PCA audit D04: incomplete verification is never presented as fully verified.
    return (
      <Card className="border-amber-400 bg-amber-50/60 dark:bg-amber-900/10" data-testid="verification-partial">
        <CardContent className="p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-amber-800"><ShieldAlert className="h-4 w-4" />PARTIALLY VERIFIED — not fully cross-checked</p>
          <p className="mt-1 text-muted-foreground">
            {reasons?.length ? reasons.join(" ") : `${subject} could only be partly verified.`}{" "}
            Everything the independent cross-check could test agreed with the R engine, but its coverage was incomplete. Do not treat the
            unverified parts as validated.
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="border-red-400 bg-red-50/60 dark:bg-red-900/10">
      <CardContent className="p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-red-700"><ShieldAlert className="h-4 w-4" />UNVERIFIED — not for publication or decisions</p>
        <p className="mt-1 text-muted-foreground">
          {reasons?.length ? reasons.join(" ") : `${subject} carries no verification status.`}{" "}
          The numbers are the R engine's, but the independent cross-check did not pass or was not performed. Do not treat them as validated.
        </p>
      </CardContent>
    </Card>
  );
}

export function NoticeList({
  title, items, tone = "amber",
}: { title: string; items?: string[] | null; tone?: "amber" | "red" | "blue" }) {
  const list = (items ?? []).filter(Boolean);
  if (list.length === 0) return null;
  const cls = {
    amber: "border-amber-300/70 bg-amber-50/40 dark:bg-amber-900/10",
    red: "border-red-300/70 bg-red-50/40 dark:bg-red-900/10",
    blue: "border-sky-300/70 bg-sky-50/40 dark:bg-sky-900/10",
  }[tone];
  const Icon = tone === "blue" ? Info : AlertTriangle;
  return (
    <Card className={cls}>
      <CardContent className="p-4 text-sm">
        <p className="mb-1 flex items-center gap-2 font-semibold"><Icon className="h-4 w-4" />{title}</p>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          {list.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      </CardContent>
    </Card>
  );
}

export function MethodErrorsNotice({ errors }: { errors?: Record<string, string> | null }) {
  const items = Object.entries(errors ?? {}).map(([m, reason]) => `${m} was requested but NOT computed: ${reason}`);
  return <NoticeList title="Requested methods that were not computed" items={items} tone="red" />;
}
