const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * Extracts a store id from whatever a customer scans or pastes:
 * a t.me link with ?startapp=join_<id>, "join_<id>", an app URL ending in /join/<id>, or a bare id.
 */
export function parseStoreCode(raw: string): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  const patterns = [
    new RegExp(`startapp=join_(${UUID})`, "i"),
    new RegExp(`^join_(${UUID})$`, "i"),
    new RegExp(`/join/(${UUID})(?:[/?#]|$)`, "i"),
    new RegExp(`^(${UUID})$`, "i"),
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1].toLowerCase();
  }
  return null;
}
