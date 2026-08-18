/**
 * Control configuration and optional joint-action setup.
 *
 * Mixture membership is never inferred from treatment names: component A,
 * component B and the mixture level are each stated explicitly. Bliss
 * independence is the only implemented method, and the UI says so rather than
 * offering a choice the backend would reject.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Info } from "lucide-react";
import type { ControlPolicy, ResponseDraft } from "@/types/cropProtection";

export interface CotoxicityState {
  enabled: boolean;
  componentA: string;
  componentB: string;
  mixture: string;
  responseKeys: string[];
}

export interface ControlState {
  policy: ControlPolicy;
  highControlMortalityThreshold: string;
}

interface Props {
  control: ControlState;
  onControlChange: (next: ControlState) => void;
  cotoxicity: CotoxicityState;
  onCotoxicityChange: (next: CotoxicityState) => void;
  /** Mortality responses with Abbott enabled — the only valid co-toxicity inputs. */
  eligibleResponses: ResponseDraft[];
  /** Repeated identical control rows reported by a previous attempt, if any. */
  repeatedControlNotice?: string | null;
}

export function BioassayOptionsPanel({
  control,
  onControlChange,
  cotoxicity,
  onCotoxicityChange,
  eligibleResponses,
  repeatedControlNotice,
}: Props) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Control configuration</CardTitle>
          <p className="text-sm text-muted-foreground">
            How the untreated control is handled for mortality correction.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {repeatedControlNotice && (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{repeatedControlNotice}</span>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Repeated control rows</Label>
              <Select
                value={control.policy}
                onValueChange={(value) =>
                  onControlChange({ ...control, policy: value as ControlPolicy })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="require_unique">
                    Require a single control profile
                  </SelectItem>
                  <SelectItem value="deduplicate_identical_replicates">
                    Use one unique 3-replicate control profile
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Repeated identical control blocks are never counted as extra replication. The
                second option collapses exact duplicates; the first stops the analysis so you
                can check the data first.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Warn if control mortality reaches{" "}
                <span className="font-normal text-muted-foreground">(optional, %)</span>
              </Label>
              <Input
                value={control.highControlMortalityThreshold}
                placeholder="e.g. 20"
                onChange={(event) =>
                  onControlChange({
                    ...control,
                    highControlMortalityThreshold: event.target.value,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Raises an advisory warning only. It never invalidates the experiment.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Joint Action / Co-toxicity</CardTitle>
          <p className="text-sm text-muted-foreground">
            Optional. Compares an observed mixture against the Bliss-independence expectation
            of its two components.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={cotoxicity.enabled}
              onCheckedChange={(checked) =>
                onCotoxicityChange({ ...cotoxicity, enabled: checked === true })
              }
            />
            Enable joint-action analysis
          </label>

          {cotoxicity.enabled && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Component A</Label>
                  <Input
                    value={cotoxicity.componentA}
                    placeholder="e.g. AL"
                    onChange={(event) =>
                      onCotoxicityChange({ ...cotoxicity, componentA: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Component B</Label>
                  <Input
                    value={cotoxicity.componentB}
                    placeholder="e.g. CL"
                    onChange={(event) =>
                      onCotoxicityChange({ ...cotoxicity, componentB: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Mixture</Label>
                  <Input
                    value={cotoxicity.mixture}
                    placeholder="e.g. ALCL"
                    onChange={(event) =>
                      onCotoxicityChange({ ...cotoxicity, mixture: event.target.value })
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the treatment levels exactly as written in the Treatment column.
                Mixture membership is not inferred from names.
              </p>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Mortality response(s)</Label>
                {eligibleResponses.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Joint action needs at least one mortality response with Abbott correction
                    enabled. Add one in the previous step.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {eligibleResponses.map((response) => (
                      <label
                        key={response.key}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={cotoxicity.responseKeys.includes(response.key)}
                          onCheckedChange={(checked) =>
                            onCotoxicityChange({
                              ...cotoxicity,
                              responseKeys:
                                checked === true
                                  ? [...cotoxicity.responseKeys, response.key]
                                  : cotoxicity.responseKeys.filter((k) => k !== response.key),
                            })
                          }
                        />
                        {response.id || "(unnamed response)"}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Method</Label>
                  <Select value="bliss" disabled>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bliss">Bliss independence</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Bliss independence is the only implemented method. Sun–Johnson CTC is
                    coming later.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
