ALTER TABLE public.stores ADD COLUMN brand_primary text, ADD COLUMN brand_accent text, ADD COLUMN background_tint text;
ALTER TABLE public.stores ADD CONSTRAINT stores_brand_primary_hex CHECK (brand_primary IS NULL OR brand_primary ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE public.stores ADD CONSTRAINT stores_brand_accent_hex CHECK (brand_accent IS NULL OR brand_accent ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE public.stores ADD CONSTRAINT stores_background_tint_hex CHECK (background_tint IS NULL OR background_tint ~ '^#[0-9A-Fa-f]{6}$');