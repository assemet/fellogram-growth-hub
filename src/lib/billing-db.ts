/** The billing tables are not in the generated types yet, so they are reached through a small untyped door. */
export type LooseResult = { data: unknown; error: { message: string } | null };
export type LooseQuery = PromiseLike<LooseResult> & {
  select: (columns?: string) => LooseQuery;
  insert: (row: unknown) => LooseQuery;
  update: (row: unknown) => LooseQuery;
  upsert: (row: unknown, options?: unknown) => LooseQuery;
  eq: (column: string, value: unknown) => LooseQuery;
  lte: (column: string, value: unknown) => LooseQuery;
  gt: (column: string, value: unknown) => LooseQuery;
  order: (column: string, options?: unknown) => LooseQuery;
  limit: (count: number) => LooseQuery;
  maybeSingle: () => LooseQuery;
};
export type LooseDb = { from: (table: string) => LooseQuery };
export async function looseClient(): Promise<LooseDb> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as LooseDb;
}
export function rows(result: LooseResult, label: string): Record<string, unknown>[] {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return (result.data as Record<string, unknown>[] | null) ?? [];
}
