import { check, type Db } from "@/lib/db";

export type PersonName = { name: string | null; username: string | null };

/** Display names for a set of user ids (profiles are readable by signed-in users). Chunked to keep URLs short. */
export async function loadNames(supabase: Db, ids: string[]): Promise<Map<string, PersonName>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const result = new Map<string, PersonName>();
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 80) chunks.push(unique.slice(i, i + 80));
  // Five requests at a time: fast for big stores without hammering the API.
  for (let i = 0; i < chunks.length; i += 5) {
    const results = await Promise.all(
      chunks.slice(i, i + 5).map(async (chunk) =>
        check(await supabase.from("profiles").select("id, first_name, last_name, username").in("id", chunk), "PROFILES_LOOKUP_FAILED"),
      ),
    );
    for (const { data } of results) {
      for (const row of (data ?? []) as { id: string; first_name: string | null; last_name: string | null; username: string | null }[]) {
        const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
        result.set(row.id, { name: name || null, username: row.username ?? null });
      }
    }
  }
  return result;
}

/**
 * Folds a name for searching, mirroring public.normalize_search_text in the database: lower case, no accents,
 * Arabic diacritics and letter variants merged (أ إ آ → ا, ى → ي, ة → ه), Turkish ı/İ → i, Russian ё/й → е/и.
 */
export function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670\u0640\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, "")
    .replace(/ı/g, "i")
    .replace(/ٱ/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

/** The words typed (a leading @ is ignored): every word must appear in the name or username, in any order. */
export function searchTokens(query: string): string[] {
  return normalizeForSearch(query.replace(/^\s*@/, "")).split(" ").filter(Boolean);
}

export function matchesPerson(person: PersonName | undefined, query: string): boolean {
  const tokens = searchTokens(query);
  if (tokens.length === 0) return true;
  const haystack = normalizeForSearch(`${person?.name ?? ""} ${person?.username ?? ""}`);
  return tokens.every((token) => haystack.includes(token));
}
