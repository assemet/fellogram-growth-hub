/**
 * Columns for a grid of stamps with balanced rows: 8 stamps are 4 + 4 (not 5 + 3), 6 are 3 + 3, 10 are 5 + 5,
 * 12 are 4 + 4 + 4. Never more than 5 per row, so every stamp stays a comfortable tap-sized circle.
 */
export function stampColumns(count: number): number {
  const n = Math.max(1, Math.floor(count));
  const rows = Math.ceil(n / 5);
  return Math.ceil(n / rows);
}
