/**
 * Data Capture (VivaCollect) — shared types.
 * Mirror the Supabase schema in sql/data_capture.sql. No backend logic here.
 */

export type TraitType =
  | "numeric" | "integer" | "decimal" | "dropdown"
  | "text" | "boolean" | "date" | "photo" | "gps";

export type PlotStatus = "not_started" | "in_progress" | "completed";

/** A dynamic form field definition for a study. Drives the trait renderer. */
export interface TraitDefinition {
  id: string;
  study_id: string;
  name: string;
  label: string;
  trait_type: TraitType;
  unit: string | null;
  min_value: number | null;
  max_value: number | null;
  allow_negative: boolean;
  required: boolean;
  options: string[] | null;
  position: number;
  created_at: string;
}

/** A fieldbook row. */
export interface Plot {
  id: string;
  study_id: string;
  plot_number: number;
  replication: number | null;
  block: number | null;
  row_index: number | null;
  col_index: number | null;
  treatment: string | null;
  genotype: string | null;
  factors: Record<string, unknown> | null;
  status: PlotStatus;
  observer_id: string | null;
  observer_name: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

/** A trait value for one plot (one row per plot × trait). */
export interface Observation {
  id: string;
  plot_id: string;
  study_id: string;
  trait_id: string;
  value: TraitValue;
  observer_id: string | null;
  recorded_at: string;
  updated_at: string;
}

/** JSON-serialisable value stored per trait. */
export type TraitValue = number | string | boolean | null;

export interface PlotNote {
  id: string;
  plot_id: string;
  study_id: string;
  body: string;
  author_id: string | null;
  author_name: string | null;
  created_at: string;
}

export interface PlotPhoto {
  id: string;
  plot_id: string;
  study_id: string;
  storage_path: string;
  caption: string | null;
  latitude: number | null;
  longitude: number | null;
  uploaded_by: string | null;
  created_at: string;
}

/** Study row plus derived collection progress for the Data Capture list. */
export interface StudyWithProgress {
  id: string;
  title: string;
  researcher: string | null;
  location: string | null;
  experimental_design: string | null;
  crop: string | null;
  status: string;
  total_plots: number;
  completed_plots: number;
  /** 0–100, integer. */
  progress: number;
  updated_at: string;
}
