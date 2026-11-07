-- Store contact details and links, shown to customers on the store page and when they join.
-- Values are normalized by the app before saving; the CHECK constraints are a second line of defence so
-- nothing but a plain phone number, a handle or an http(s) link can ever be stored. Safe to run more than once.
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS telegram_username text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS instagram text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS facebook_url text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS tiktok text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS website_url text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS maps_url text;

ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_contact_phone_check;
ALTER TABLE public.stores ADD CONSTRAINT stores_contact_phone_check CHECK (phone IS NULL OR phone ~ '^\+?[0-9]{6,15}$');
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_contact_whatsapp_check;
ALTER TABLE public.stores ADD CONSTRAINT stores_contact_whatsapp_check CHECK (whatsapp IS NULL OR whatsapp ~ '^\+[1-9][0-9]{6,14}$');
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_contact_address_check;
ALTER TABLE public.stores ADD CONSTRAINT stores_contact_address_check CHECK (address IS NULL OR char_length(address) <= 160);
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_contact_telegram_check;
ALTER TABLE public.stores ADD CONSTRAINT stores_contact_telegram_check CHECK (telegram_username IS NULL OR telegram_username ~ '^[A-Za-z][A-Za-z0-9_]{4,31}$');
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_contact_instagram_check;
ALTER TABLE public.stores ADD CONSTRAINT stores_contact_instagram_check CHECK (instagram IS NULL OR instagram ~ '^[A-Za-z0-9._]{1,30}$');
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_contact_tiktok_check;
ALTER TABLE public.stores ADD CONSTRAINT stores_contact_tiktok_check CHECK (tiktok IS NULL OR tiktok ~ '^[A-Za-z0-9._]{2,24}$');
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_contact_facebook_check;
ALTER TABLE public.stores ADD CONSTRAINT stores_contact_facebook_check CHECK (facebook_url IS NULL OR (facebook_url ~ '^https?://[^[:space:]]+$' AND char_length(facebook_url) <= 300));
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_contact_website_check;
ALTER TABLE public.stores ADD CONSTRAINT stores_contact_website_check CHECK (website_url IS NULL OR (website_url ~ '^https?://[^[:space:]]+$' AND char_length(website_url) <= 300));
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_contact_maps_check;
ALTER TABLE public.stores ADD CONSTRAINT stores_contact_maps_check CHECK (maps_url IS NULL OR (maps_url ~ '^https?://[^[:space:]]+$' AND char_length(maps_url) <= 300));

NOTIFY pgrst, 'reload schema';
