/**
 * VivaSense — Study Management (Phase 3)
 *
 * Modal form to create a new study. Uses the project's shadcn Dialog primitives
 * and react-hook-form (both already dependencies). Delegates persistence to
 * StudyService.createStudy; the parent decides what to do on success.
 */
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { createStudy } from "@/services/studies/StudyService";
import type { NewStudyPayload, Study } from "@/services/studies/studyTypes";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface CreateStudyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newStudy: Study) => void;
}

/** Raw form values — all strings, since inputs yield strings; mapped on submit. */
interface StudyFormValues {
  title: string;
  description: string;
  crop: string;
  research_area: string;
  year: string;
}

/** Trim to a value or null so empty inputs are stored as NULL, not "". */
function orNull(v: string): string | null {
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export const CreateStudyModal = ({ isOpen, onClose, onSuccess }: CreateStudyModalProps) => {
  const {
    register, handleSubmit, reset,
    formState: { isSubmitting, errors },
  } = useForm<StudyFormValues>({
    defaultValues: { title: "", description: "", crop: "", research_area: "", year: "" },
  });

  const submit = handleSubmit(async (formData) => {
    const yearNum = formData.year.trim() ? parseInt(formData.year, 10) : null;
    const payload: NewStudyPayload = {
      title: formData.title.trim(),
      description: orNull(formData.description),
      crop: orNull(formData.crop),
      research_area: orNull(formData.research_area),
      year: yearNum != null && !isNaN(yearNum) ? yearNum : null,
      status: "active",
    };
    const newStudy = await createStudy(payload);
    reset();
    onSuccess(newStudy);
    onClose();
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create new study</DialogTitle>
          <DialogDescription>Group related analyses under a research project.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="study-title">Title <span className="text-destructive">*</span></Label>
            <Input
              id="study-title"
              placeholder="e.g. Cowpea Yield Trial 2026"
              aria-invalid={!!errors.title}
              {...register("title", { required: true })}
            />
            {errors.title && <p className="text-xs text-destructive">A title is required.</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="study-description">Description</Label>
            <Textarea id="study-description" rows={2} placeholder="Optional summary" {...register("description")} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="study-crop">Crop</Label>
              <Input id="study-crop" placeholder="e.g. Maize" {...register("crop")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="study-year">Year</Label>
              <Input id="study-year" type="number" inputMode="numeric" placeholder="2026" {...register("year")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="study-area">Research area</Label>
            <Input id="study-area" placeholder="e.g. Genetics & Breeding" {...register("research_area")} />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={() => { reset(); onClose(); }} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Create study
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
