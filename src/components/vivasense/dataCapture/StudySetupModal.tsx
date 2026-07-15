/**
 * Study setup — creates a study, generates its fieldbook via the existing
 * field-layout backend (persisted as plot rows), and defines trait_definitions.
 * This is the seeding path that closes the loop: layout → plots → traits →
 * collection. No new backend; reuses POST /field-layout/generate.
 */
import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  createStudyForCapture, generateAndInsertPlots, insertTraitDefinitions,
  type NewTraitInput,
} from "@/services/dataCapture/dataCaptureService";
import type { TraitType } from "@/types/dataCapture";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface TraitDraft {
  label: string;
  trait_type: TraitType;
  unit: string;
  required: boolean;
  min: string;
  max: string;
  options: string;
}

const TRAIT_TYPES: { id: TraitType; label: string }[] = [
  { id: "numeric", label: "Numeric" },
  { id: "integer", label: "Integer" },
  { id: "decimal", label: "Decimal" },
  { id: "dropdown", label: "Dropdown" },
  { id: "text", label: "Text" },
  { id: "boolean", label: "Yes / No" },
  { id: "date", label: "Date" },
  { id: "gps", label: "GPS" },
  { id: "photo", label: "Photo" },
];

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "trait";
const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));
const isNumericType = (t: TraitType) => t === "numeric" || t === "integer" || t === "decimal";

export function StudySetupModal({ isOpen, onClose, onCreated }: Props) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [researcher, setResearcher] = useState("");
  const [location, setLocation] = useState("");
  const [crop, setCrop] = useState("");
  const [design, setDesign] = useState("rcbd");
  const [treatments, setTreatments] = useState("T1, T2, T3, T4");
  const [replications, setReplications] = useState(3);
  const [traits, setTraits] = useState<TraitDraft[]>([
    { label: "Plant Height", trait_type: "numeric", unit: "cm", required: true, min: "0", max: "", options: "" },
  ]);
  const [busy, setBusy] = useState(false);

  const addTrait = () => setTraits((t) => [...t, { label: "", trait_type: "numeric", unit: "", required: false, min: "", max: "", options: "" }]);
  const removeTrait = (i: number) => setTraits((t) => t.filter((_, idx) => idx !== i));
  const patchTrait = (i: number, patch: Partial<TraitDraft>) => setTraits((t) => t.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const reset = () => {
    setTitle(""); setResearcher(""); setLocation(""); setCrop("");
    setDesign("rcbd"); setTreatments("T1, T2, T3, T4"); setReplications(3);
    setTraits([{ label: "Plant Height", trait_type: "numeric", unit: "cm", required: true, min: "0", max: "", options: "" }]);
  };

  const submit = async () => {
    const trts = treatments.split(",").map((s) => s.trim()).filter(Boolean);
    if (!title.trim()) return toast({ title: "Title is required" });
    if (trts.length < 2) return toast({ title: "Add at least 2 treatments" });
    if (replications < 2) return toast({ title: "Replications must be ≥ 2" });
    const namedTraits = traits.filter((t) => t.label.trim());
    if (namedTraits.length === 0) return toast({ title: "Add at least one trait" });

    setBusy(true);
    try {
      const studyId = await createStudyForCapture({
        title: title.trim(),
        researcher: researcher.trim() || null,
        location: location.trim() || null,
        crop: crop.trim() || null,
        experimental_design: design,
      });
      const nPlots = await generateAndInsertPlots(studyId, design, trts, replications);
      const defs: NewTraitInput[] = namedTraits.map((t, i) => ({
        name: slug(t.label),
        label: t.label.trim(),
        trait_type: t.trait_type,
        unit: t.unit.trim() || null,
        min_value: isNumericType(t.trait_type) ? numOrNull(t.min) : null,
        max_value: isNumericType(t.trait_type) ? numOrNull(t.max) : null,
        allow_negative: false,
        required: t.required,
        options: t.trait_type === "dropdown" ? t.options.split(",").map((o) => o.trim()).filter(Boolean) : null,
        position: i + 1,
      }));
      await insertTraitDefinitions(studyId, defs);

      toast({ title: "Study created", description: `${nPlots} plots · ${defs.length} traits` });
      reset();
      onCreated();
      onClose();
    } catch (err) {
      toast({ title: "Couldn't create study", description: (err as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set up a study</DialogTitle>
          <DialogDescription>Generates a randomized fieldbook and traits, ready for data collection.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="s-title">Title <span className="text-destructive">*</span></Label>
            <Input id="s-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Maize Hybrid Trial" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="s-res">Researcher</Label><Input id="s-res" value={researcher} onChange={(e) => setResearcher(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="s-loc">Location</Label><Input id="s-loc" value={location} onChange={(e) => setLocation(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="s-crop">Crop</Label><Input id="s-crop" value={crop} onChange={(e) => setCrop(e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Design</Label>
              <Select value={design} onValueChange={setDesign}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rcbd">RCBD</SelectItem>
                  <SelectItem value="crd">CRD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="space-y-1.5"><Label htmlFor="s-trts">Treatments (comma-separated)</Label><Input id="s-trts" value={treatments} onChange={(e) => setTreatments(e.target.value)} /></div>
            <div className="space-y-1.5 w-24"><Label htmlFor="s-reps">Reps</Label><Input id="s-reps" type="number" min={2} value={replications} onChange={(e) => setReplications(parseInt(e.target.value, 10) || 0)} /></div>
          </div>

          {/* Traits */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Traits to collect</Label>
              <Button type="button" size="sm" variant="ghost" onClick={addTrait}><Plus className="h-4 w-4 mr-1" /> Add trait</Button>
            </div>
            <div className="space-y-2">
              {traits.map((t, i) => (
                <div key={i} className="rounded-md border border-border p-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input value={t.label} onChange={(e) => patchTrait(i, { label: e.target.value })} placeholder="Trait name" className="flex-1" />
                    <Select value={t.trait_type} onValueChange={(v) => patchTrait(i, { trait_type: v as TraitType })}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{TRAIT_TYPES.map((tt) => <SelectItem key={tt.id} value={tt.id}>{tt.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => removeTrait(i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {isNumericType(t.trait_type) && (
                      <>
                        <Input value={t.unit} onChange={(e) => patchTrait(i, { unit: e.target.value })} placeholder="unit" className="w-20 h-9" />
                        <Input value={t.min} onChange={(e) => patchTrait(i, { min: e.target.value })} placeholder="min" type="number" className="w-20 h-9" />
                        <Input value={t.max} onChange={(e) => patchTrait(i, { max: e.target.value })} placeholder="max" type="number" className="w-20 h-9" />
                      </>
                    )}
                    {t.trait_type === "dropdown" && (
                      <Input value={t.options} onChange={(e) => patchTrait(i, { options: e.target.value })} placeholder="options e.g. 0,1,2,3,4,5" className="flex-1 h-9" />
                    )}
                    <label className="inline-flex items-center gap-1.5 text-sm ml-auto">
                      <Checkbox checked={t.required} onCheckedChange={(v) => patchTrait(i, { required: !!v })} /> Required
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />} Create study
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
