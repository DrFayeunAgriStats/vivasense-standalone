/**
 * VivaSense — Study Management (Phase 3)
 *
 * Lists the current user's studies with per-study analysis counts, and hosts the
 * create-study flow. Data comes solely from StudyService.getStudiesWithStats via
 * react-query; creating a study invalidates the cache so the grid refreshes.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, Plus, AlertTriangle, RotateCw } from "lucide-react";
import { getStudiesWithStats } from "@/services/studies/StudyService";
import { StudyCard } from "./StudyCard";
import { CreateStudyModal } from "./CreateStudyModal";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const StudyGrid = () => {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: studies, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["studies"],
    queryFn: getStudiesWithStats,
  });

  const errorMessage = error instanceof Error ? error.message : "Could not load studies.";

  return (
    <section className="rounded-xl border border-border bg-card/40 p-5 sm:p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Studies</h2>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New Study
        </Button>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="mt-2 h-3 w-full" />
              <div className="mt-4 flex justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertTriangle className="h-9 w-9 text-destructive/70" />
          <div>
            <p className="text-sm font-medium text-foreground">Couldn’t load your studies.</p>
            <p className="mt-1 text-xs text-muted-foreground">{errorMessage}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCw className="mr-1.5 h-4 w-4" /> Try again
          </Button>
        </div>
      ) : !studies || studies.length === 0 ? (
        <div className="py-12 text-center">
          <FolderKanban className="mx-auto h-9 w-9 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">No studies yet.</p>
          <p className="text-xs text-muted-foreground/70">Create your first study to group related analyses.</p>
          <Button size="sm" className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New Study
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {studies.map((study) => (
            <StudyCard key={study.id} study={study} />
          ))}
        </div>
      )}

      <CreateStudyModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["studies"] })}
      />
    </section>
  );
};
