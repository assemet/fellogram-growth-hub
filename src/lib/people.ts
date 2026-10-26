import { check, type Db } from "@/lib/db";

export type PersonName = { name: string | null; username: string | null };

/** Display names for a set of user ids (profiles are readable by signed-in users). Chunked to keep URLs short. */
export async function loadNames(supabase: Db, ids: string[]): Promise<Map<string, PersonName>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const result = new Map<string, PersonName>();
  for (let i = 0; i < unique.length; i += 80) {
    const chunk = unique.slice(i, i + 80);
    const { data } = check(
      await supabase.from("profiles").select("id, first_name, last_name, username").in("id", chunk),
      "PROFILES_LOOKUP_FAILED",
    );
    for (const row of (data ?? []) as { id: string; first_name: string | null; last_name: string | null; username: string | null }[]) {
      const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
      result.set(row.id, { name: name || null, username: row.username ?? null });
    }
  }
  return result;
}

/** Case-insensitive match against a person's name and @username. */
export function matchesPerson(person: PersonName | undefined, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = `${person?.name ?? ""} ${person?.username ?? ""}`.toLowerCase();
  return haystack.includes(needle);
}
