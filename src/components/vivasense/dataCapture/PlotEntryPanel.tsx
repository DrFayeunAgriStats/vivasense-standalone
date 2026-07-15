/**
 * Plot data entry — mobile-first form for one plot.
 *
 * Dynamic traits (rendered by TraitField), immediate validation, per-field
 * autosave with offline queueing, research notebook, photo gallery (preview →
 * upload), GPS capture, and prev/next navigation with a sticky bottom bar.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Plus, Camera, MapPin, StickyNote, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  listObservations, saveObservation, updatePlotStatus, savePlotLocation,
  listNotes, addNote, listPhotos, uploadPhoto, getPhotoUrl,
} from "@/services/dataCapture/dataCaptureService";
import { enqueueObservation, flushQueue } from "@/services/dataCapture/offlineQueue";
import { coerceValue, validateTrait, isPlotComplete } from "@/lib/dataCapture/traitValidation";
import type { Plot, TraitDefinition, TraitValue, PlotNote, PlotPhoto } from "@/types/dataCapture";
import { TraitField, type FieldSaveState } from "./TraitField";

interface Props {
  plot: Plot;
  studyTitle: string;
  traits: TraitDefinition[];
  currentUserName: string | null;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onBack: () => void;
  onStatusChanged: (plotId: string, status: Plot["status"]) => void;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export function PlotEntryPanel(props: Props) {
  const { plot, traits, studyTitle, currentUserName, hasPrev, hasNext } = props;
  const { toast } = useToast();
  const online = useOnlineStatus();

  const [values, setValues] = useState<Record<string, TraitValue>>({});
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saveState, setSaveState] = useState<Record<string, FieldSaveState>>({});
  const [notes, setNotes] = useState<PlotNote[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [photos, setPhotos] = useState<PlotPhoto[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [pendingPhoto, setPendingPhoto] = useState<{ file: File; url: string } | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(
    plot.latitude != null && plot.longitude != null ? { lat: plot.latitude, lng: plot.longitude } : null,
  );
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load observations/notes/photos when the plot changes.
  useEffect(() => {
    let active = true;
    setErrors({}); setSaveState({}); setPendingPhoto(null);
    Promise.all([listObservations(plot.id), listNotes(plot.id), listPhotos(plot.id)])
      .then(([obs, ns, ps]) => {
        if (!active) return;
        const v: Record<string, TraitValue> = {};
        for (const o of obs) v[o.trait_id] = o.value;
        // Auto-fill empty date traits with today.
        for (const t of traits) if (t.trait_type === "date" && v[t.id] == null) v[t.id] = todayIso();
        setValues(v);
        setNotes(ns);
        setPhotos(ps);
      })
      .catch((e) => toast({ title: "Couldn't load plot", description: (e as Error).message, variant: "destructive" }));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plot.id]);

  // Resolve signed URLs for photos.
  useEffect(() => {
    let active = true;
    (async () => {
      const entries = await Promise.all(photos.map(async (p) => [p.id, await getPhotoUrl(p.storage_path)] as const));
      if (active) setPhotoUrls(Object.fromEntries(entries.filter(([, u]) => !!u) as [string, string][]));
    })();
    return () => { active = false; };
  }, [photos]);

  // Flush any queued offline writes when connectivity returns.
  useEffect(() => {
    if (online) flushQueue().catch(() => {});
  }, [online]);

  const orderedTraitIds = useMemo(() => traits.map((t) => t.id), [traits]);

  const persist = useCallback(async (trait: TraitDefinition, value: TraitValue) => {
    setSaveState((s) => ({ ...s, [trait.id]: "saving" }));
    try {
      await saveObservation({ plotId: plot.id, studyId: plot.study_id, traitId: trait.id, value });
      setSaveState((s) => ({ ...s, [trait.id]: "saved" }));
      // Recompute plot status from the latest values.
      setValues((cur) => {
        const complete = isPlotComplete(traits, cur);
        const anyEntered = Object.values(cur).some((v) => v !== null && v !== "");
        const nextStatus: Plot["status"] = complete ? "completed" : anyEntered ? "in_progress" : "not_started";
        if (nextStatus !== plot.status) {
          updatePlotStatus(plot.id, nextStatus)
            .then(() => props.onStatusChanged(plot.id, nextStatus))
            .catch(() => {});
        }
        return cur;
      });
    } catch {
      enqueueObservation({ plotId: plot.id, studyId: plot.study_id, traitId: trait.id, value });
      setSaveState((s) => ({ ...s, [trait.id]: "queued" }));
    }
  }, [plot.id, plot.study_id, plot.status, traits, props]);

  const handleChange = (trait: TraitDefinition, raw: string | boolean | null) => {
    const value = coerceValue(trait, raw);
    setValues((v) => ({ ...v, [trait.id]: value }));
    const result = validateTrait(trait, value);
    setErrors((e) => ({ ...e, [trait.id]: result.error }));
    if (!result.valid) { setSaveState((s) => ({ ...s, [trait.id]: "idle" })); return; }
    // Debounced autosave.
    const prev = timers.current.get(trait.id);
    if (prev) clearTimeout(prev);
    timers.current.set(trait.id, setTimeout(() => void persist(trait, value), 500));
  };

  const focusNext = (traitId: string) => {
    const idx = orderedTraitIds.indexOf(traitId);
    const next = orderedTraitIds[idx + 1];
    if (next) document.getElementById(`trait-${next}`)?.focus();
  };

  const captureGps = () => {
    if (!navigator.geolocation) return toast({ title: "GPS unavailable", description: "This device/browser has no geolocation." });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        setGps({ lat, lng });
        savePlotLocation(plot.id, lat, lng).catch(() => {});
        toast({ title: "Location captured", description: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
      },
      (err) => toast({ title: "Location denied", description: err.message, variant: "destructive" }),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPendingPhoto({ file, url: URL.createObjectURL(file) });
    e.target.value = "";
  };

  const confirmUpload = async () => {
    if (!pendingPhoto) return;
    try {
      const photo = await uploadPhoto({ plotId: plot.id, studyId: plot.study_id, file: pendingPhoto.file, gps: gps ? { latitude: gps.lat, longitude: gps.lng } : null });
      setPhotos((ps) => [photo, ...ps]);
      setPendingPhoto(null);
      toast({ title: "Photo uploaded" });
    } catch (err) {
      toast({ title: "Upload failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const submitNote = async () => {
    const body = noteDraft.trim();
    if (!body) return;
    try {
      const note = await addNote({ plotId: plot.id, studyId: plot.study_id, body, authorName: currentUserName });
      setNotes((n) => [note, ...n]);
      setNoteDraft("");
    } catch (err) {
      toast({ title: "Couldn't save note", description: (err as Error).message, variant: "destructive" });
    }
  };

  const savingCount = Object.values(saveState).filter((s) => s === "saving").length;
  const queuedCount = Object.values(saveState).filter((s) => s === "queued").length;

  return (
    <div className="pb-24 md:pb-4">
      {/* Header */}
      <div className="mb-4">
        <button onClick={props.onBack} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to fieldbook
        </button>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{studyTitle}</p>
            <h2 className="text-xl font-semibold text-foreground">Plot #{plot.plot_number}</h2>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
              {plot.treatment && <span>Treatment: <span className="text-foreground">{plot.treatment}</span></span>}
              {plot.replication != null && <span>Rep: <span className="text-foreground">{plot.replication}</span></span>}
              {plot.genotype && <span>Genotype: <span className="text-foreground">{plot.genotype}</span></span>}
            </div>
          </div>
          <div className="text-right text-xs">
            {!online && <span className="text-amber-600">Offline</span>}
            {online && savingCount > 0 && <span className="inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</span>}
            {online && savingCount === 0 && queuedCount === 0 && <span className="text-emerald-600">✓ All changes saved</span>}
            {queuedCount > 0 && <span className="text-amber-600">{queuedCount} queued</span>}
          </div>
        </div>
      </div>

      {/* Traits */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Traits</CardTitle></CardHeader>
        <CardContent className="pt-0">
          {traits.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No traits defined for this study yet.</p>
          ) : (
            traits.map((t) => (
              <TraitField
                key={t.id}
                def={t}
                value={values[t.id] ?? null}
                error={errors[t.id] ?? null}
                saveState={saveState[t.id] ?? "idle"}
                onChange={(v) => handleChange(t, v as string | boolean | null)}
                onEnterNext={() => focusNext(t.id)}
                onCaptureGps={captureGps}
                onAddPhoto={() => fileInputRef.current?.click()}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Photos */}
      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Camera className="h-4 w-4 text-primary" /> Photos</CardTitle>
          <Button size="sm" variant="outline" className="h-9" onClick={() => fileInputRef.current?.click()}>
            <Plus className="h-4 w-4 mr-1.5" /> Add
          </Button>
        </CardHeader>
        <CardContent>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPickPhoto} />
          {pendingPhoto && (
            <div className="mb-3 rounded-lg border border-border p-2">
              <img src={pendingPhoto.url} alt="Preview" className="max-h-48 rounded-md mx-auto" />
              <div className="mt-2 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setPendingPhoto(null)}><X className="h-4 w-4 mr-1" /> Cancel</Button>
                <Button size="sm" onClick={confirmUpload}>Upload</Button>
              </div>
            </div>
          )}
          {photos.length === 0 && !pendingPhoto ? (
            <p className="text-sm text-muted-foreground">No photos yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((p) => (
                <a key={p.id} href={photoUrls[p.id]} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-md border border-border bg-muted">
                  {photoUrls[p.id] ? <img src={photoUrls[p.id]} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full animate-pulse" />}
                </a>
              ))}
            </div>
          )}
          <div className="mt-3">
            <Button size="sm" variant="outline" className="h-9" onClick={captureGps}>
              <MapPin className="h-4 w-4 mr-1.5" /> {gps ? `${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` : "Capture GPS"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Research notebook */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><StickyNote className="h-4 w-4 text-primary" /> Observations</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={2} placeholder="Add an observation…" className="text-base" />
            <Button onClick={submitNote} disabled={!noteDraft.trim()} className="self-end">Add</Button>
          </div>
          <ul className="mt-3 space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-md border border-border/60 bg-muted/30 p-2.5 text-sm">
                <p className="text-foreground whitespace-pre-wrap">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{n.author_name ?? "—"} · {new Date(n.created_at).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Desktop prev/next */}
      <div className="hidden md:flex items-center justify-between">
        <Button variant="outline" onClick={props.onPrev} disabled={!hasPrev}><ChevronLeft className="h-4 w-4 mr-1" /> Previous Plot</Button>
        <Button variant="outline" onClick={props.onNext} disabled={!hasNext}>Next Plot <ChevronRight className="h-4 w-4 ml-1" /></Button>
      </div>

      {/* Sticky bottom nav (mobile) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
        <Button variant="outline" className="flex-1 h-12" onClick={props.onPrev} disabled={!hasPrev}><ChevronLeft className="h-4 w-4 mr-1" /> Prev</Button>
        <Button variant="outline" className="flex-1 h-12" onClick={props.onNext} disabled={!hasNext}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
      </div>
    </div>
  );
}
