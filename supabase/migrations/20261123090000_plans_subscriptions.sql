-- Plans, platform settings and store subscriptions (part 96). Nothing in the app is locked yet:
-- these tables only hold what the owner edits from /admin and the manual activations he records.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.plans (
  code text PRIMARY KEY CHECK (code ~ '^[a-z][a-z0-9_]{1,23}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  -- Monthly price in US dollars per price-test group, e.g. {"A": 19, "B": 15, "C": 25}.
  prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  max_cashiers integer NOT NULL DEFAULT 1 CHECK (max_cashiers BETWEEN 1 AND 100),
  -- List of feature keys the plan unlocks (the app validates the keys).
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY CHECK (char_length(key) BETWEEN 1 AND 60),
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per period a store holds a plan. It doubles as the log: who activated what, from which source.
-- "Current" = status active and starts_at <= now() < ends_at.
CREATE TABLE IF NOT EXISTS public.store_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores ON DELETE CASCADE,
  plan_code text NOT NULL REFERENCES public.plans (code),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'replaced')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'stars', 'referral', 'gift', 'trial')),
  note text CHECK (note IS NULL OR char_length(note) <= 200),
  created_by uuid REFERENCES auth.users ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS store_subscriptions_store_idx ON public.store_subscriptions (store_id, ends_at DESC);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_subscriptions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.plans, public.app_settings, public.store_subscriptions TO service_role;
GRANT SELECT ON public.plans TO authenticated;
GRANT SELECT ON public.store_subscriptions TO authenticated;

-- Everybody signed in may read the plan list (the comparison screen will need it); only the server writes.
DROP POLICY IF EXISTS plans_read ON public.plans;
CREATE POLICY plans_read ON public.plans FOR SELECT TO authenticated USING (active);
-- A store owner reads the subscriptions of his own stores; settings have no policy (server only).
DROP POLICY IF EXISTS store_subscriptions_owner_read ON public.store_subscriptions;
CREATE POLICY store_subscriptions_owner_read ON public.store_subscriptions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));

INSERT INTO public.plans (code, name, prices, max_cashiers, features, sort) VALUES
  ('free', 'Free', '{"A":0,"B":0,"C":0}', 1, '[]', 0),
  ('starter', 'Starter', '{"A":9,"B":7,"C":12}', 2, '["redeem_note","branding"]', 1),
  ('pro', 'Pro', '{"A":19,"B":15,"C":25}', 5, '["redeem_note","branding","reminders","promotions","analytics","export"]', 2),
  ('business', 'Business', '{"A":39,"B":29,"C":49}', 15, '["redeem_note","branding","reminders","promotions","analytics","export"]', 3)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.app_settings (key, value) VALUES
  ('trial_days', '30'),
  ('trial_extend_days', '14'),
  ('trial_extend_min_stamps', '20'),
  ('referral_enabled', 'true'),
  ('referral_reward_months', '1'),
  ('referral_cap_months', '12'),
  ('referral_release_days', '7'),
  ('pricing_group', '"A"')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
