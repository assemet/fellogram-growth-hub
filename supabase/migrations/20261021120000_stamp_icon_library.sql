-- Stamp icon library: the original CHECK only allowed 6 icons. Allowed ids are now
-- enforced by the application (src/lib/stamp-icons.ts), so adding an icon never needs
-- another migration. The database only guarantees a safe lowercase kebab-case id.
-- The special value 'logo' means "use the store's own logo as the stamp".
ALTER TABLE public.loyalty_programs ADD COLUMN IF NOT EXISTS stamp_icon text NOT NULL DEFAULT 'stamp';

ALTER TABLE public.loyalty_programs
  DROP CONSTRAINT IF EXISTS loyalty_programs_stamp_icon_valid;

ALTER TABLE public.loyalty_programs
  ADD CONSTRAINT loyalty_programs_stamp_icon_valid
  CHECK (stamp_icon ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(stamp_icon) <= 32);
