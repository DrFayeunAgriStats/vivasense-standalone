/**
 * VivaSense — Study Management Service (Phase 3)
 *
 * Handles all interactions with the `studies` table in Supabase,
 * including CRUD operations and fetching aggregated statistics.
 */
import { supabase } from '@/integrations/supabase/client'; // Assumes existing client
import type {
  Study,
  NewStudyPayload,
  UpdateStudyPayload,
  StudyWithStats,
} from './studyTypes';

/**
 * Fetches all studies for the current user, including aggregated stats.
 * This version avoids RPC functions and calculates stats on the client-side
 * after fetching the necessary data in a minimal number of queries.
 * @returns A promise that resolves to an array of studies with stats.
 */
export const getStudiesWithStats = async (): Promise<StudyWithStats[]> => {
  const { data: userResponse } = await supabase.auth.getUser();
  if (!userResponse.user) throw new Error('User not authenticated.');
  const userId = userResponse.user.id;

  // 1. Fetch all studies for the user
  const { data: studies, error: studiesError } = await supabase
    .from('studies')
    .select('*')
    .eq('user_id', userId);

  if (studiesError) {
    console.error('Error fetching studies:', studiesError);
    throw studiesError;
  }
  if (!studies) return [];
  if (studies.length === 0) return [];

  // 2. Fetch all analysis history records that are linked to any study for the user.
  // We select only the study_id to minimize data transfer.
  const { data: analyses, error: analysesError } = await supabase
    .from('analysis_history')
    .select('study_id')
    .eq('user_id', userId)
    .not('study_id', 'is', null);

  if (analysesError) {
    // Non-fatal, we can proceed with 0 counts and log the error.
    console.error('Error fetching analysis counts:', analysesError);
    return studies.map((study: Study) => ({ ...study, analysis_count: 0 }));
  }

  // 3. Aggregate counts in TypeScript to avoid database-specific features like groupBy.
  const analysisCounts = new Map<string, number>();
  for (const analysis of analyses) {
    if (analysis.study_id) {
      analysisCounts.set(analysis.study_id, (analysisCounts.get(analysis.study_id) || 0) + 1);
    }
  }

  // 4. Combine studies with their counts
  return studies.map((study: Study) => ({
    ...study,
    analysis_count: analysisCounts.get(study.id) || 0,
  }));
};

/**
 * Fetches a single study by its ID.
 * @param studyId The UUID of the study to fetch.
 * @returns A promise that resolves to the study object.
 */
export const getStudyById = async (studyId: string): Promise<Study | null> => {
  const { data, error } = await supabase
    .from('studies')
    .select('*')
    .eq('id', studyId)
    .single();

  if (error) {
    console.error('Error fetching study by ID:', error);
    // .single() throws if no row is found, handle this gracefully
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data;
};

/**
 * Creates a new study for the current user.
 * @param payload The data for the new study.
 * @returns A promise that resolves to the newly created study object.
 */
export const createStudy = async (payload: NewStudyPayload): Promise<Study> => {
  const { data: userResponse } = await supabase.auth.getUser();
  if (!userResponse.user) throw new Error('User not authenticated.');

  const { data, error } = await supabase
    .from('studies')
    .insert({ ...payload, user_id: userResponse.user.id })
    .select()
    .single();

  if (error) {
    console.error('Error creating study:', error);
    throw error;
  }

  return data;
};

/**
 * Updates an existing study.
 * @param studyId The UUID of the study to update.
 * @param payload The data to update.
 * @returns A promise that resolves to the updated study object.
 */
export const updateStudy = async (studyId: string, payload: UpdateStudyPayload): Promise<Study> => {
  const { data, error } = await supabase
    .from('studies')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', studyId)
    .select()
    .single();

  if (error) {
    console.error('Error updating study:', error);
    throw error;
  }

  return data;
};

/**
 * Deletes a study and all its associated data (cascades).
 * @param studyId The UUID of the study to delete.
 */
export const deleteStudy = async (studyId: string): Promise<void> => {
  const { error } = await supabase.from('studies').delete().eq('id', studyId);

  if (error) {
    console.error('Error deleting study:', error);
    throw error;
  }
};