-- Store-to-store referral and the automatic trial (part 98). Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.store_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_store_id uuid NOT NULL REFERENCES public.stores ON DELETE CASCADE,
  -- A store can be brought by one store only.
  referred_store_id uuid NOT NULL UNIQUE REFERENCES public.stores ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'review', 'rewarded', 'rejected')),
  -- Why the owner should look at it: same_name, same_phone, same_address.
  flags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  reward_after timestamptz,
  rewarded_at timestamptz,
  -- Months actually given to the referrer (the cap can make it smaller than the setting).
  reward_months integer NOT NULL DEFAULT 0 CHECK (reward_months BETWEEN 0 AND 120),
  CHECK (referrer_store_id <> referred_store_id)
);
CREATE INDEX IF NOT EXISTS store_referrals_referrer_idx ON public.store_referrals (referrer_store_id);
CREATE INDEX IF NOT EXISTS store_referrals_due_idx ON public.store_referrals (status, reward_after);

ALTER TABLE public.store_referrals ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.store_referrals TO service_role;
GRANT SELECT ON public.store_referrals TO authenticated;

DROP POLICY IF EXISTS store_referrals_referrer_read ON public.store_referrals;
CREATE POLICY store_referrals_referrer_read ON public.store_referrals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = referrer_store_id AND s.owner_id = auth.uid()));

INSERT INTO public.app_settings (key, value) VALUES
  ('trial_enabled', 'true'),
  ('trial_plan', '"pro"'),
  ('enforce_limits', 'false')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
