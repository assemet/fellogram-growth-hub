-- An optional short line each store can add under the "reward collected" message (plain text, one line).
-- The app validates it too (no links, handles or addresses); the CHECK below is a second line of defence.
-- Safe to run more than once.
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS redeem_note text;
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_redeem_note_check;
ALTER TABLE public.stores ADD CONSTRAINT stores_redeem_note_check
  CHECK (redeem_note IS NULL OR (char_length(redeem_note) <= 120 AND redeem_note !~ '[\r\n]'));

NOTIFY pgrst, 'reload schema';
