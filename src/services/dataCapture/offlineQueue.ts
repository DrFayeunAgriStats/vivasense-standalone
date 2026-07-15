/**
 * Data Capture — offline write queue.
 *
 * When an autosave fails (offline / network error), the change is queued in
 * localStorage and replayed automatically once connectivity returns. Only
 * trait observations are queued; they upsert by (plot_id, trait_id) so replaying
 * a stale queue is safe (last write wins).
 */
import { saveObservation } from "./dataCaptureService";
import type { TraitValue } from "@/types/dataCapture";

const KEY = "vivacollect:queue:v1";

export interface QueuedObservation {
  plotId: string;
  studyId: string;
  traitId: string;
  value: TraitValue;
  queuedAt: number;
}

function read(): QueuedObservation[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedObservation[]) : [];
  } catch {
    return [];
  }
}

function write(items: QueuedObservation[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // storage full / unavailable — nothing else we can safely do
  }
}

export function queueSize(): number {
  return read().length;
}

/** Add (or replace the pending entry for the same plot+trait) to the queue. */
export function enqueueObservation(op: Omit<QueuedObservation, "queuedAt">): void {
  const items = read().filter((q) => !(q.plotId === op.plotId && q.traitId === op.traitId));
  items.push({ ...op, queuedAt: Date.now() });
  write(items);
}

/**
 * Attempt to persist every queued observation. Successful items are removed;
 * items that still fail remain for the next attempt. Returns how many synced.
 */
export async function flushQueue(): Promise<number> {
  const items = read();
  if (items.length === 0) return 0;

  const remaining: QueuedObservation[] = [];
  let synced = 0;
  for (const op of items) {
    try {
      await saveObservation({ plotId: op.plotId, studyId: op.studyId, traitId: op.traitId, value: op.value });
      synced += 1;
    } catch {
      remaining.push(op);
    }
  }
  write(remaining);
  return synced;
}
