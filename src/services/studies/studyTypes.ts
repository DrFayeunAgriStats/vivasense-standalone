/**
 * VivaSense — Study Management (Phase 3)
 *
 * Shared types for studies and related entities.
 * These types correspond to the `studies` table in the Supabase database.
 */

/** A row as stored in / read from public.studies. */
export interface Study {
  id: string; // uuid
  user_id: string; // uuid
  title: string;
  description: string | null;
  crop: string | null;
  research_area: string | null;
  year: number | null;
  status: 'active' | 'completed' | 'on_hold' | string;
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
}

/** Payload for creating a new study. */
export type NewStudyPayload = Omit<Study, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

/** Payload for updating an existing study. */
export type UpdateStudyPayload = Partial<NewStudyPayload>;

/**
 * Represents a Study combined with aggregated data for display in UI components.
 */
export interface StudyWithStats extends Study {
  analysis_count: number;
}