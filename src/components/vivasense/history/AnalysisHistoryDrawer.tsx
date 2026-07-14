/**
 * AnalysisHistoryDrawer — read-only side drawer with the full detail of one
 * analysis_history row. No editing this phase. Built on the Radix Dialog
 * primitive (already a dependency) styled as a right-side sheet.
 */
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  analysisLabel, formatDate, formatTime, formatDuration, formatDesign,
} from "@/services/history/historyDashboard";
import type { AnalysisHistoryRecord } from "@/services/history/historyTypes";

interface Props {
  record: AnalysisHistoryRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2 border-b border-border/60 last:border-0">
      <dt className="col-span-1 text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="col-span-2 text-sm text-foreground break-words">{value ?? "—"}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
        {title}
      </h4>
      <dl>{children}</dl>
    </section>
  );
}

/** Pretty-print a JSON object, or a dash when empty. */
function Json({ value }: { value: Record<string, unknown> | null | undefined }) {
  if (!value || Object.keys(value).length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <pre className="overflow-x-auto rounded-md bg-muted/60 p-2 text-xs leading-relaxed text-foreground">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function AnalysisHistoryDrawer({ record: r, open, onOpenChange }: Props) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-xl duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
        >
          {r ? (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-border p-5">
                <div className="min-w-0">
                  <DialogPrimitive.Title className="truncate text-base font-semibold text-foreground">
                    {r.analysis_title || analysisLabel(r.analysis_type)}
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="sr-only">
                    Full details for {r.analysis_title || analysisLabel(r.analysis_type)}
                  </DialogPrimitive.Description>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="text-[11px]">{analysisLabel(r.analysis_type)}</Badge>
                    {r.design_type && (
                      <Badge variant="outline" className="text-[11px]">{formatDesign(r.design_type)}</Badge>
                    )}
                  </div>
                </div>
                <DialogPrimitive.Close
                  className="rounded-sm p-1 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Close details"
                >
                  <X className="h-4 w-4" />
                </DialogPrimitive.Close>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                <Section title="Analysis">
                  <Row label="Type" value={analysisLabel(r.analysis_type)} />
                  <Row label="Design" value={formatDesign(r.design_type)} />
                  <Row label="Status" value={r.analysis_status} />
                  <Row label="Date" value={formatDate(r.created_at)} />
                  <Row label="Time" value={formatTime(r.created_at)} />
                  <Row label="Study" value={r.study_name} />
                </Section>

                <Section title="Dataset">
                  <Row label="Name" value={r.dataset_name} />
                  <Row label="Token" value={r.dataset_token} />
                </Section>

                <Section title="Traits">
                  <Row
                    label={`${r.traits?.length ?? 0} total`}
                    value={
                      r.traits && r.traits.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {r.traits.map((t) => (
                            <Badge key={t} variant="outline" className="text-[11px]">{t}</Badge>
                          ))}
                        </div>
                      ) : "—"
                    }
                  />
                </Section>

                <Section title="Execution">
                  <Row label="Duration" value={formatDuration(r.execution_time_ms)} />
                  <Row label="Backend endpoint" value={
                    r.backend_endpoint
                      ? <code className="text-xs">{r.backend_endpoint}</code>
                      : "—"
                  } />
                  <Row label="Backend version" value={r.backend_version} />
                  <Row label="Frontend version" value={r.frontend_version} />
                </Section>

                <Section title="Parameters">
                  <Json value={r.analysis_parameters} />
                </Section>

                <Section title="Result summary">
                  <Json value={r.result_summary} />
                </Section>

                <Section title="Context">
                  <Row label="Institution" value={r.institution} />
                  <Row label="Country" value={r.country} />
                  <Row label="Role" value={r.user_role} />
                  <Row label="Notes" value={r.notes} />
                </Section>
              </div>
            </>
          ) : (
            <DialogPrimitive.Title className="p-5 text-sm text-muted-foreground">
              No analysis selected.
            </DialogPrimitive.Title>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
