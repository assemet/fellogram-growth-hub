-- One referral link per referrer and store is shared by every friend they invite, so referrals.referral_code
-- cannot be unique: with the old constraint only the FIRST invited friend was ever recorded and every later one
-- failed on a duplicate key (so the owner's referral statistics stayed at zero or one).
-- A friend is still counted at most once per store (referrals_one_welcome_per_store). Safe to run more than once.
DO $$
DECLARE _name text;
BEGIN
  FOR _name IN
    SELECT c.conname FROM pg_constraint c
     WHERE c.conrelid = 'public.referrals'::regclass AND c.contype = 'u'
       AND pg_get_constraintdef(c.oid) ~* '^UNIQUE \(referral_code\)$'
  LOOP
    EXECUTE format('ALTER TABLE public.referrals DROP CONSTRAINT %I', _name);
  END LOOP;
END $$;

-- A plain index keeps lookups by code fast now that the unique one is gone.
CREATE INDEX IF NOT EXISTS referrals_referral_code_idx ON public.referrals(referral_code);

-- Make sure one friend can never be recorded twice for the same store.
CREATE UNIQUE INDEX IF NOT EXISTS referrals_store_referred_key
  ON public.referrals(store_id, referred_customer_id) WHERE referred_customer_id IS NOT NULL;
