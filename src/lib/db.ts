import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/** The signed-in user's Supabase client (row-level security applies). */
export type Db = SupabaseClient<Database>;

/**
 * Supabase queries return `{ data, error }` and never throw. Ignoring `error` turns a failed
 * query into "no rows", which looked like "store not found" or "no cards yet" to users.
 * Wrap every query result with `check` so failures surface as real errors.
 */
export function check<T extends { error: { message: string } | null }>(result: T, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result;
}

export function throwIfError(error: { message: string } | null | undefined, label: string): void {
  if (error) throw new Error(`${label}: ${error.message}`);
}
