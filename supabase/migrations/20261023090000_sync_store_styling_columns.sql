-- Brings the database in line with the app: these columns were only recorded in
-- drizzle/migrations, so a database built from supabase/migrations alone lacks them and
-- queries that read them fail. Safe to run more than once, whatever state the DB is in.

-- Store card styling
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS card_theme text NOT NULL DEFAULT 'classic';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS brand_primary text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS brand_accent text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS background_tint text;

ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_card_theme_check;
ALTER TABLE public.stores ADD CONSTRAINT stores_card_theme_check
  CHECK (card_theme IN ('classic', 'coffee', 'purple', 'emerald', 'midnight', 'electric', 'sunset'));

ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_brand_primary_hex;
ALTER TABLE public.stores ADD CONSTRAINT stores_brand_primary_hex
  CHECK (brand_primary IS NULL OR brand_primary ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_brand_accent_hex;
ALTER TABLE public.stores ADD CONSTRAINT stores_brand_accent_hex
  CHECK (brand_accent IS NULL OR brand_accent ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_background_tint_hex;
ALTER TABLE public.stores ADD CONSTRAINT stores_background_tint_hex
  CHECK (background_tint IS NULL OR background_tint ~ '^#[0-9A-Fa-f]{6}$');

-- Stamp icon: lowercase kebab-case id; the allowed list is enforced by the app
-- (src/lib/stamp-icons.ts). 'logo' means "use the store's own logo as the stamp".
ALTER TABLE public.loyalty_programs ADD COLUMN IF NOT EXISTS stamp_icon text NOT NULL DEFAULT 'stamp';
ALTER TABLE public.loyalty_programs DROP CONSTRAINT IF EXISTS loyalty_programs_stamp_icon_valid;
ALTER TABLE public.loyalty_programs ADD CONSTRAINT loyalty_programs_stamp_icon_valid
  CHECK (stamp_icon ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(stamp_icon) <= 32);

-- Make the API pick up the new columns immediately.
NOTIFY pgrst, 'reload schema';
