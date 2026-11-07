/**
 * The word typed to confirm deleting an account, in every app language. Comparison ignores case and accents
 * so "SİL" typed on a Turkish keyboard (capital dotted İ) still matches "sil".
 */
export function normalizeWord(input: string): string {
  return input.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const DELETE_WORDS = ["delete", "حذف", "удалить", "eliminar", "sil"].map(normalizeWord);

export function isDeleteWord(input: string): boolean {
  return DELETE_WORDS.includes(normalizeWord(input));
}
