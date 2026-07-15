/**
 * Data Capture (VivaCollect) — Supabase data access.
 *
 * Thin layer over the existing Supabase client; no business logic, no mock data.
 * Every table is RLS-scoped to the study owner server-side. All reads/writes go
 * to the real tables defined in sql/data_capture.sql.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  TraitDefinition, Plot, Observation, PlotNote, PlotPhoto,
  StudyWithProgress, PlotStatus, TraitValue,
} from "@/types/dataCapture";

const PHOTO_BUCKET = "plot-photos";

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/** Studies for the current user with derived collection progress. */
export async function listStudiesWithProgress(): Promise<StudyWithProgress[]> {
  const userId = await currentUserId();
  if (!userId) return [];

  const { data: studies, error } = await supabase
    .from("studies")
    .select("id, title, researcher, location, experimental_design, crop, status, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const rows = (studies ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return [];

  // One query for all plot statuses across the user's studies, aggregated client-side.
  const { data: plots, error: plotErr } = await supabase
    .from("plots")
    .select("study_id, status");
  if (plotErr) throw plotErr;

  const totals = new Map<string, { total: number; completed: number }>();
  for (const p of (plots ?? []) as { study_id: string; status: PlotStatus }[]) {
    const t = totals.get(p.study_id) ?? { total: 0, completed: 0 };
    t.total += 1;
    if (p.status === "completed") t.completed += 1;
    totals.set(p.study_id, t);
  }

  return rows.map((s) => {
    const agg = totals.get(s.id as string) ?? { total: 0, completed: 0 };
    const progress = agg.total > 0 ? Math.round((agg.completed / agg.total) * 100) : 0;
    return {
      id: s.id as string,
      title: (s.title as string) ?? "Untitled study",
      researcher: (s.researcher as string) ?? null,
      location: (s.location as string) ?? null,
      experimental_design: (s.experimental_design as string) ?? null,
      crop: (s.crop as string) ?? null,
      status: (s.status as string) ?? "active",
      total_plots: agg.total,
      completed_plots: agg.completed,
      progress,
      updated_at: (s.updated_at as string) ?? "",
    };
  });
}

/** Trait definitions for a study, ordered for form rendering. */
export async function listTraitDefinitions(studyId: string): Promise<TraitDefinition[]> {
  const { data, error } = await supabase
    .from("trait_definitions")
    .select("*")
    .eq("study_id", studyId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as TraitDefinition[];
}

/** Fieldbook plots for a study. */
export async function listPlots(studyId: string): Promise<Plot[]> {
  const { data, error } = await supabase
    .from("plots")
    .select("*")
    .eq("study_id", studyId)
    .order("plot_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Plot[];
}

/** All observations for a plot. */
export async function listObservations(plotId: string): Promise<Observation[]> {
  const { data, error } = await supabase
    .from("observations")
    .select("*")
    .eq("plot_id", plotId);
  if (error) throw error;
  return (data ?? []) as unknown as Observation[];
}

/** Autosave a single trait value (upsert on plot_id + trait_id). */
export async function saveObservation(input: {
  plotId: string; studyId: string; traitId: string; value: TraitValue;
}): Promise<void> {
  const observerId = await currentUserId();
  const row = {
    plot_id: input.plotId,
    study_id: input.studyId,
    trait_id: input.traitId,
    value: input.value,
    observer_id: observerId,
    recorded_at: new Date().toISOString(),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase
    .from("observations")
    .upsert(row as any, { onConflict: "plot_id,trait_id" });
  if (error) throw error;
}

/** Update a plot's collection status (and stamp the observer). */
export async function updatePlotStatus(plotId: string, status: PlotStatus): Promise<void> {
  const observerId = await currentUserId();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase
    .from("plots")
    .update({ status, observer_id: observerId } as any)
    .eq("id", plotId);
  if (error) throw error;
}

/** Store captured GPS on a plot. */
export async function savePlotLocation(plotId: string, latitude: number, longitude: number): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await supabase.from("plots").update({ latitude, longitude } as any).eq("id", plotId);
  if (error) throw error;
}

// ── Research notebook ─────────────────────────────────────────────────────────
export async function listNotes(plotId: string): Promise<PlotNote[]> {
  const { data, error } = await supabase
    .from("plot_notes")
    .select("*")
    .eq("plot_id", plotId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PlotNote[];
}

export async function addNote(input: { plotId: string; studyId: string; body: string; authorName?: string | null }): Promise<PlotNote> {
  const authorId = await currentUserId();
  const row = {
    plot_id: input.plotId, study_id: input.studyId, body: input.body,
    author_id: authorId, author_name: input.authorName ?? null,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.from("plot_notes").insert(row as any).select().single();
  if (error) throw error;
  return data as unknown as PlotNote;
}

// ── Photos (Supabase Storage + plot_photos rows) ─────────────────────────────
export async function listPhotos(plotId: string): Promise<PlotPhoto[]> {
  const { data, error } = await supabase
    .from("plot_photos")
    .select("*")
    .eq("plot_id", plotId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PlotPhoto[];
}

/** Upload a photo to Storage and record it against the plot. */
export async function uploadPhoto(input: {
  plotId: string; studyId: string; file: File; gps?: { latitude: number; longitude: number } | null;
}): Promise<PlotPhoto> {
  const userId = await currentUserId();
  const ext = input.file.name.split(".").pop() || "jpg";
  const path = `${userId}/${input.studyId}/${input.plotId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, input.file, {
    cacheControl: "3600", upsert: false, contentType: input.file.type || undefined,
  });
  if (upErr) throw upErr;

  const row = {
    plot_id: input.plotId, study_id: input.studyId, storage_path: path,
    latitude: input.gps?.latitude ?? null, longitude: input.gps?.longitude ?? null,
    uploaded_by: userId,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.from("plot_photos").insert(row as any).select().single();
  if (error) throw error;
  return data as unknown as PlotPhoto;
}

/** Signed URL for viewing a private photo (1 hour). */
export async function getPhotoUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(storagePath, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}
