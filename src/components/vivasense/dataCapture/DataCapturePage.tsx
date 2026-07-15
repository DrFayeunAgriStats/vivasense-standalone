/**
 * Data Capture (VivaCollect) — top-level module.
 * Workflow: Studies → Fieldbook → Plot data entry. Connects to the real
 * Supabase tables; no mock data. Owns navigation + data loading for its children.
 */
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, AlertTriangle, RotateCw, ChevronRight, ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { StudySetupModal } from "./StudySetupModal";
import {
  listStudiesWithProgress, listPlots, listTraitDefinitions,
} from "@/services/dataCapture/dataCaptureService";
import type { Plot, TraitDefinition, StudyWithProgress } from "@/types/dataCapture";
import { StudyCaptureCard } from "./StudyCaptureCard";
import { FieldbookView } from "./FieldbookView";
import { PlotEntryPanel } from "./PlotEntryPanel";

type View = "studies" | "fieldbook" | "plot";
type Status = "loading" | "error" | "ready" | "signedout";

export function DataCapturePage() {
  const { user, profile } = useAuth();
  const currentUserId = user?.id ?? null;
  const currentUserName = profile?.full_name ?? user?.email ?? null;

  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [studies, setStudies] = useState<StudyWithProgress[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const [view, setView] = useState<View>("studies");
  const [study, setStudy] = useState<StudyWithProgress | null>(null);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [traits, setTraits] = useState<TraitDefinition[]>([]);
  const [plotIndex, setPlotIndex] = useState(0);
  const [studyLoading, setStudyLoading] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    listStudiesWithProgress()
      .then((rows) => { if (active) { setStudies(rows); setStatus("ready"); } })
      .catch((e) => { if (active) { setErrorMsg((e as Error).message); setStatus("error"); } });
    return () => { active = false; };
  }, [reloadKey]);

  const openStudy = async (s: StudyWithProgress) => {
    setStudy(s);
    setStudyLoading(true);
    setView("fieldbook");
    try {
      const [p, t] = await Promise.all([listPlots(s.id), listTraitDefinitions(s.id)]);
      setPlots(p);
      setTraits(t);
    } catch (e) {
      setErrorMsg((e as Error).message);
    } finally {
      setStudyLoading(false);
    }
  };

  const openPlot = (plot: Plot) => {
    const idx = plots.findIndex((p) => p.id === plot.id);
    setPlotIndex(Math.max(0, idx));
    setView("plot");
  };

  const onStatusChanged = (plotId: string, s: Plot["status"]) => {
    setPlots((prev) => prev.map((p) => (p.id === plotId ? { ...p, status: s, updated_at: new Date().toISOString(), observer_id: currentUserId, observer_name: currentUserName } : p)));
  };

  const currentPlot = plots[plotIndex] ?? null;
  const studyList = useMemo(() => studies, [studies]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Data Capture</h1>
            <p className="text-sm text-muted-foreground">Collect experimental data in the field, ready for analysis.</p>
          </div>
        </div>
        {view === "studies" && status === "ready" && (
          <Button size="sm" onClick={() => setSetupOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> New study</Button>
        )}
      </header>

      <StudySetupModal isOpen={setupOpen} onClose={() => setSetupOpen(false)} onCreated={() => setReloadKey((k) => k + 1)} />


      {/* Breadcrumb */}
      {view !== "studies" && (
        <nav className="mb-4 flex items-center gap-1 text-sm text-muted-foreground">
          <button onClick={() => { setView("studies"); setStudy(null); }} className="hover:text-foreground">Studies</button>
          {study && (<><ChevronRight className="h-3.5 w-3.5" /><button onClick={() => setView("fieldbook")} className="hover:text-foreground max-w-[40vw] truncate">{study.title}</button></>)}
          {view === "plot" && currentPlot && (<><ChevronRight className="h-3.5 w-3.5" /><span className="text-foreground">Plot #{currentPlot.plot_number}</span></>)}
        </nav>
      )}

      {/* Studies view */}
      {view === "studies" && (
        <>
          {status === "loading" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
            </div>
          )}
          {status === "error" && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <AlertTriangle className="h-9 w-9 text-destructive/70" />
              <p className="text-sm font-medium text-foreground">Couldn’t load studies.</p>
              <p className="text-xs text-muted-foreground">{errorMsg}</p>
              <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}><RotateCw className="mr-1.5 h-4 w-4" /> Try again</Button>
            </div>
          )}
          {status === "signedout" && <p className="py-12 text-center text-sm text-muted-foreground">Sign in to collect data.</p>}
          {status === "ready" && (
            studyList.length === 0 ? (
              <div className="py-12 text-center">
                <ClipboardList className="mx-auto h-9 w-9 text-muted-foreground/40" />
                <p className="mt-2 text-sm text-muted-foreground">No studies yet.</p>
                <p className="text-xs text-muted-foreground/70">Set up a study to start collecting field data.</p>
                <Button size="sm" className="mt-4" onClick={() => setSetupOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> Set up study</Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {studyList.map((s) => <StudyCaptureCard key={s.id} study={s} onContinue={openStudy} />)}
              </div>
            )
          )}
        </>
      )}

      {/* Fieldbook view */}
      {view === "fieldbook" && study && (
        studyLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : (
          <FieldbookView plots={plots} currentUserId={currentUserId} onOpenPlot={openPlot} />
        )
      )}

      {/* Plot entry view */}
      {view === "plot" && study && currentPlot && (
        <PlotEntryPanel
          plot={currentPlot}
          studyTitle={study.title}
          traits={traits}
          currentUserName={currentUserName}
          hasPrev={plotIndex > 0}
          hasNext={plotIndex < plots.length - 1}
          onPrev={() => setPlotIndex((i) => Math.max(0, i - 1))}
          onNext={() => setPlotIndex((i) => Math.min(plots.length - 1, i + 1))}
          onBack={() => setView("fieldbook")}
          onStatusChanged={onStatusChanged}
        />
      )}

      {view === "plot" && !currentPlot && (
        <div className="py-12 text-center">
          <Button variant="outline" onClick={() => setView("fieldbook")}><ArrowLeft className="mr-1.5 h-4 w-4" /> Back to fieldbook</Button>
        </div>
      )}
    </div>
  );
}
