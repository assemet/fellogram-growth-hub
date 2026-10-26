-- 1) Configurable stamp cooldown, 2) staff invitations. Safe to run more than once.

-- ---------------------------------------------------------------------------
-- 1) Minutes between two stamps for the same customer (0 = no limit). Was a fixed 15.
-- ---------------------------------------------------------------------------
ALTER TABLE public.loyalty_programs ADD COLUMN IF NOT EXISTS stamp_cooldown_minutes integer NOT NULL DEFAULT 15;
-- award_stamp (below) reads the referral bonus columns; add them if this database never got them.
ALTER TABLE public.loyalty_programs
  ADD COLUMN IF NOT EXISTS referrer_bonus_stamps integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS welcome_bonus_stamps integer NOT NULL DEFAULT 1;

ALTER TABLE public.loyalty_programs DROP CONSTRAINT IF EXISTS loyalty_programs_cooldown_range;
ALTER TABLE public.loyalty_programs ADD CONSTRAINT loyalty_programs_cooldown_range
  CHECK (stamp_cooldown_minutes BETWEEN 0 AND 1440);

-- Based on the referral-aware version (drizzle/migrations/0001_referrals.sql) so referral rewards keep working.
CREATE OR REPLACE FUNCTION public.award_stamp(_store_id uuid, _customer_id uuid, _amount integer DEFAULT 1)
 RETURNS TABLE(membership_id uuid, stamp_balance integer, stamps_required integer, transaction_id uuid)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _staff_id uuid := auth.uid();
  _amt integer := GREATEST(1, LEAST(5, COALESCE(_amount, 1)));
  _membership public.customer_memberships;
  _required integer;
  _last_at timestamptz;
  _tx_id uuid;
  _new_balance integer;
  _cooldown integer;
  _ref public.referrals;
  _ref_bonus integer;
  _welcome_bonus integer;
BEGIN
  IF _staff_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT (public.is_store_member(_store_id, _staff_id) OR public.is_store_owner(_store_id, _staff_id)) THEN
    RAISE EXCEPTION 'NOT_STORE_STAFF';
  END IF;

  SELECT * INTO _membership FROM public.customer_memberships
  WHERE customer_memberships.store_id = _store_id AND customer_memberships.customer_id = _customer_id
  FOR UPDATE;
  IF _membership.id IS NULL THEN RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND'; END IF;

  SELECT COALESCE(lp.stamp_cooldown_minutes, 15) INTO _cooldown
  FROM public.loyalty_programs lp WHERE lp.id = _membership.program_id;
  _cooldown := COALESCE(_cooldown, 15);

  SELECT max(tx.created_at) INTO _last_at FROM public.transactions tx
  WHERE tx.store_id = _store_id AND tx.customer_id = _customer_id AND tx.type = 'stamp_awarded'
    AND NOT EXISTS (SELECT 1 FROM public.transactions r WHERE r.type = 'stamp_reversed'
                    AND (r.metadata->>'reversed_transaction_id') = tx.id::text);
  IF _cooldown > 0 AND _last_at IS NOT NULL AND _last_at > now() - make_interval(mins => _cooldown) THEN
    RAISE EXCEPTION 'COOLDOWN_ACTIVE:%', GREATEST(1, CEIL(EXTRACT(EPOCH FROM (_last_at + make_interval(mins => _cooldown) - now())) / 60));
  END IF;

  INSERT INTO public.transactions (store_id, customer_id, staff_id, type, amount)
  VALUES (_store_id, _customer_id, _staff_id, 'stamp_awarded', _amt)
  RETURNING id INTO _tx_id;

  UPDATE public.customer_memberships cm SET stamp_balance = cm.stamp_balance + _amt, last_visit_at = now()
  WHERE cm.id = _membership.id RETURNING cm.stamp_balance INTO _new_balance;

  SELECT lp.stamps_required, lp.referrer_bonus_stamps, lp.welcome_bonus_stamps
    INTO _required, _ref_bonus, _welcome_bonus
  FROM public.loyalty_programs lp WHERE lp.id = _membership.program_id;

  -- First qualifying stamp of a referred customer: qualify + reward both sides atomically.
  SELECT * INTO _ref FROM public.referrals r
   WHERE r.store_id = _store_id AND r.referred_customer_id = _customer_id AND r.status = 'pending'
   FOR UPDATE;
  IF _ref.id IS NOT NULL THEN
    UPDATE public.referrals SET status = 'qualified', qualifying_transaction_id = _tx_id, rewarded_at = now()
     WHERE id = _ref.id;
    IF COALESCE(_welcome_bonus, 0) > 0 THEN
      UPDATE public.customer_memberships cm SET stamp_balance = cm.stamp_balance + _welcome_bonus
       WHERE cm.id = _membership.id RETURNING cm.stamp_balance INTO _new_balance;
      INSERT INTO public.transactions (store_id, customer_id, staff_id, type, amount, metadata)
      VALUES (_store_id, _customer_id, _staff_id, 'referral_reward', _welcome_bonus,
              jsonb_build_object('referral_id', _ref.id, 'role', 'referred'));
    END IF;
    IF COALESCE(_ref_bonus, 0) > 0 AND EXISTS (SELECT 1 FROM public.customer_memberships
         WHERE store_id = _store_id AND customer_id = _ref.referrer_customer_id) THEN
      UPDATE public.customer_memberships cm SET stamp_balance = cm.stamp_balance + _ref_bonus
       WHERE cm.store_id = _store_id AND cm.customer_id = _ref.referrer_customer_id;
      INSERT INTO public.transactions (store_id, customer_id, staff_id, type, amount, metadata)
      VALUES (_store_id, _ref.referrer_customer_id, _staff_id, 'referral_reward', _ref_bonus,
              jsonb_build_object('referral_id', _ref.id, 'role', 'referrer'));
    END IF;
  END IF;

  membership_id := _membership.id;
  stamp_balance := _new_balance;
  stamps_required := COALESCE(_required, 10);
  transaction_id := _tx_id;
  RETURN NEXT;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2) Staff invitations: the owner creates a single-use link; the invited person opens it in
--    Telegram and becomes cashier staff for that store.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  created_by uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_by uuid REFERENCES auth.users ON DELETE SET NULL,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_invitations_store_idx ON public.staff_invitations(store_id);

ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_invitations_owner_select" ON public.staff_invitations;
CREATE POLICY "staff_invitations_owner_select" ON public.staff_invitations FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id, auth.uid()));
GRANT SELECT ON public.staff_invitations TO authenticated;

CREATE OR REPLACE FUNCTION public.create_staff_invitation(_store_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _token text;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_store_owner(_store_id, _user) THEN RAISE EXCEPTION 'NOT_STORE_OWNER'; END IF;

  IF (SELECT count(*) FROM public.staff_invitations
      WHERE store_id = _store_id AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()) >= 20 THEN
    RAISE EXCEPTION 'TOO_MANY_INVITATIONS';
  END IF;

  INSERT INTO public.staff_invitations (store_id, created_by)
  VALUES (_store_id, _user)
  RETURNING token INTO _token;
  RETURN _token;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_staff_invitation(_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _store uuid;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT store_id INTO _store FROM public.staff_invitations WHERE id = _invitation_id;
  IF _store IS NULL THEN RAISE EXCEPTION 'INVITE_INVALID'; END IF;
  IF NOT public.is_store_owner(_store, _user) THEN RAISE EXCEPTION 'NOT_STORE_OWNER'; END IF;
  UPDATE public.staff_invitations SET revoked_at = now() WHERE id = _invitation_id AND revoked_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_staff_invitation(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _inv public.staff_invitations;
BEGIN
  IF _user IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;

  SELECT * INTO _inv FROM public.staff_invitations WHERE token = _token FOR UPDATE;
  IF _inv.id IS NULL OR _inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'INVITE_INVALID'; END IF;

  -- Already on the team (or the owner opening their own link): nothing to consume.
  IF public.is_store_owner(_inv.store_id, _user) OR public.is_store_member(_inv.store_id, _user) THEN
    RETURN _inv.store_id;
  END IF;

  IF _inv.used_at IS NOT NULL THEN RAISE EXCEPTION 'INVITE_USED'; END IF;
  IF _inv.expires_at < now() THEN RAISE EXCEPTION 'INVITE_EXPIRED'; END IF;

  INSERT INTO public.store_members (store_id, user_id, role)
  VALUES (_inv.store_id, _user, 'staff')
  ON CONFLICT (store_id, user_id) DO NOTHING;

  UPDATE public.staff_invitations SET used_by = _user, used_at = now() WHERE id = _inv.id;
  RETURN _inv.store_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_staff_invitation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_staff_invitation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_staff_invitation(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_staff_invitation(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.revoke_staff_invitation(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_staff_invitation(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_staff_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_staff_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_staff_invitation(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
