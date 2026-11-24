-- Payments with Telegram Stars (part 99). Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.star_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  plan_code text NOT NULL REFERENCES public.plans (code),
  months integer NOT NULL CHECK (months BETWEEN 1 AND 24),
  stars integer NOT NULL CHECK (stars BETWEEN 1 AND 1000000),
  -- created: invoice made, not paid. paid: Telegram confirmed the payment. refunded: money returned.
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'refunded', 'failed')),
  -- Telegram's id for the payment; unique so the same payment can never be counted twice.
  charge_id text UNIQUE,
  payer_telegram_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  -- Set once the plan was actually given. A paid order without it is retried when Telegram resends the update.
  fulfilled_at timestamptz,
  refunded_at timestamptz,
  note text CHECK (note IS NULL OR char_length(note) <= 300)
);
CREATE INDEX IF NOT EXISTS star_payments_store_idx ON public.star_payments (store_id, created_at DESC);

ALTER TABLE public.star_payments ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.star_payments TO service_role;
-- No policies: only the server reads or writes payments.

INSERT INTO public.app_settings (key, value) VALUES
  ('stars_enabled', 'false'),
  ('stars_per_usd', '50')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
