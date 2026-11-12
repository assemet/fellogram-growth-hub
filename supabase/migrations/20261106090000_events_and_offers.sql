-- Stamp events (multiplied stamps for a limited time) and offers (single-use coupons with an expiry).
-- Safe to run more than once. The award_stamp function below is the latest version from
-- 20261030090000_privacy_and_team_rules.sql plus the event multiplier; undo keeps working because the transaction
-- stores the multiplied amount.

-- ---------------------------------------------------------------------------
-- 1) Stamp events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stamp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
  multiplier integer NOT NULL CHECK (multiplier BETWEEN 2 AND 5),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stamp_events_window CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '366 days')
);
CREATE INDEX IF NOT EXISTS stamp_events_store_idx ON public.stamp_events (store_id, starts_at, ends_at);
ALTER TABLE public.stamp_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stamp_events FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stamp_events TO authenticated;
GRANT ALL ON public.stamp_events TO service_role;
DROP POLICY IF EXISTS "stamp_events_select" ON public.stamp_events;
CREATE POLICY "stamp_events_select" ON public.stamp_events FOR SELECT TO authenticated
  USING (active OR public.is_store_owner(store_id, auth.uid()));
DROP POLICY IF EXISTS "stamp_events_owner_manage" ON public.stamp_events;
CREATE POLICY "stamp_events_owner_manage" ON public.stamp_events FOR ALL TO authenticated
  USING (public.is_store_owner(store_id, auth.uid())) WITH CHECK (public.is_store_owner(store_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- 2) Offers and their single-use redemptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 80),
  details text CHECK (details IS NULL OR char_length(details) <= 300),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  max_uses_per_customer integer NOT NULL DEFAULT 1 CHECK (max_uses_per_customer BETWEEN 1 AND 10),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offers_window CHECK (ends_at > starts_at AND ends_at <= starts_at + interval '366 days')
);
CREATE INDEX IF NOT EXISTS offers_store_idx ON public.offers (store_id, starts_at, ends_at);
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.offers FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offers TO authenticated;
GRANT ALL ON public.offers TO service_role;
DROP POLICY IF EXISTS "offers_select" ON public.offers;
CREATE POLICY "offers_select" ON public.offers FOR SELECT TO authenticated
  USING (active OR public.is_store_owner(store_id, auth.uid()));
DROP POLICY IF EXISTS "offers_owner_manage" ON public.offers;
CREATE POLICY "offers_owner_manage" ON public.offers FOR ALL TO authenticated
  USING (public.is_store_owner(store_id, auth.uid())) WITH CHECK (public.is_store_owner(store_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.offer_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.offers ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'expired')),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  staff_id uuid REFERENCES auth.users ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS offer_redemptions_customer_idx ON public.offer_redemptions (customer_id, offer_id, status);
ALTER TABLE public.offer_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.offer_redemptions FROM anon, authenticated;
GRANT SELECT ON public.offer_redemptions TO authenticated;
GRANT ALL ON public.offer_redemptions TO service_role;
DROP POLICY IF EXISTS "offer_redemptions_select" ON public.offer_redemptions;
CREATE POLICY "offer_redemptions_select" ON public.offer_redemptions FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.is_store_owner(store_id, auth.uid()) OR public.is_store_member(store_id, auth.uid()));

-- The customer asks for a short-lived single-use code for an offer.
CREATE OR REPLACE FUNCTION public.create_offer_redemption(_offer_id uuid)
RETURNS TABLE(out_redemption_id uuid, out_token text, out_expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  _uid uuid := auth.uid();
  _offer public.offers;
  _used integer;
  _token text;
  _id uuid;
  _exp timestamptz := now() + interval '5 minutes';
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO _offer FROM public.offers o WHERE o.id = _offer_id AND o.active;
  IF _offer.id IS NULL THEN RAISE EXCEPTION 'OFFER_NOT_FOUND'; END IF;
  IF now() < _offer.starts_at OR now() >= _offer.ends_at THEN RAISE EXCEPTION 'OFFER_NOT_ACTIVE'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customer_memberships cm WHERE cm.store_id = _offer.store_id AND cm.customer_id = _uid) THEN
    RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND';
  END IF;
  SELECT count(*) INTO _used FROM public.offer_redemptions r
   WHERE r.offer_id = _offer.id AND r.customer_id = _uid AND r.status = 'used';
  IF _used >= _offer.max_uses_per_customer THEN RAISE EXCEPTION 'OFFER_ALREADY_USED'; END IF;

  UPDATE public.offer_redemptions r SET status = 'expired'
   WHERE r.customer_id = _uid AND r.offer_id = _offer.id AND r.status = 'pending';

  _token := encode(gen_random_bytes(24), 'hex');
  INSERT INTO public.offer_redemptions (offer_id, store_id, customer_id, token_hash, expires_at)
  VALUES (_offer.id, _offer.store_id, _uid, encode(digest(_token, 'sha256'), 'hex'), _exp)
  RETURNING id INTO _id;

  out_redemption_id := _id; out_token := _token; out_expires_at := _exp;
  RETURN NEXT;
END; $$;

-- The cashier scans the code: everything is checked and consumed atomically.
CREATE OR REPLACE FUNCTION public.redeem_offer(_store_id uuid, _token text)
RETURNS TABLE(out_redemption_id uuid, out_customer_id uuid, out_offer_title text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  _staff uuid := auth.uid();
  _r public.offer_redemptions;
  _offer public.offers;
  _used integer;
BEGIN
  IF _staff IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT (public.is_store_member(_store_id, _staff) OR public.is_store_owner(_store_id, _staff)) THEN
    RAISE EXCEPTION 'NOT_STORE_STAFF';
  END IF;

  SELECT * INTO _r FROM public.offer_redemptions rd
   WHERE rd.token_hash = encode(digest(coalesce(_token, ''), 'sha256'), 'hex')
   FOR UPDATE;
  IF _r.id IS NULL OR _r.store_id <> _store_id THEN RAISE EXCEPTION 'TOKEN_INVALID'; END IF;
  IF _r.status = 'used' THEN RAISE EXCEPTION 'TOKEN_USED'; END IF;
  IF _r.status <> 'pending' OR _r.expires_at < now() THEN
    UPDATE public.offer_redemptions SET status = 'expired' WHERE id = _r.id AND status = 'pending';
    RAISE EXCEPTION 'TOKEN_EXPIRED';
  END IF;

  SELECT * INTO _offer FROM public.offers o WHERE o.id = _r.offer_id;
  IF _offer.id IS NULL OR NOT _offer.active OR now() < _offer.starts_at OR now() >= _offer.ends_at THEN
    RAISE EXCEPTION 'OFFER_NOT_ACTIVE';
  END IF;
  SELECT count(*) INTO _used FROM public.offer_redemptions u
   WHERE u.offer_id = _offer.id AND u.customer_id = _r.customer_id AND u.status = 'used';
  IF _used >= _offer.max_uses_per_customer THEN RAISE EXCEPTION 'OFFER_ALREADY_USED'; END IF;

  UPDATE public.offer_redemptions SET status = 'used', used_at = now(), staff_id = _staff WHERE id = _r.id;

  out_redemption_id := _r.id; out_customer_id := _r.customer_id; out_offer_title := _offer.title;
  RETURN NEXT;
END; $$;

REVOKE ALL ON FUNCTION public.create_offer_redemption(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_offer(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_offer_redemption(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_offer(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3) award_stamp with the event multiplier
-- ---------------------------------------------------------------------------
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
  _limit integer;
  _ref public.referrals;
  _ref_bonus integer;
  _welcome_bonus integer;
  _event_id uuid;
  _mult integer := 1;
  _total integer;
BEGIN
  IF _staff_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT (public.is_store_member(_store_id, _staff_id) OR public.is_store_owner(_store_id, _staff_id)) THEN
    RAISE EXCEPTION 'NOT_STORE_STAFF';
  END IF;

  -- Team rule: the owner can cap how many stamps one cashier gives in 24 hours (0 = no cap; owners are exempt).
  IF NOT public.is_store_owner(_store_id, _staff_id) THEN
    SELECT s.staff_daily_stamp_limit INTO _limit FROM public.stores s WHERE s.id = _store_id;
    IF COALESCE(_limit, 0) > 0 AND (
      SELECT count(*) FROM public.transactions t
      WHERE t.store_id = _store_id AND t.staff_id = _staff_id AND t.type = 'stamp_awarded'
        AND t.created_at > now() - interval '24 hours'
    ) >= _limit THEN
      RAISE EXCEPTION 'DAILY_LIMIT_REACHED:%', _limit;
    END IF;
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

  -- Stamp event (double stamps and so on): the best multiplier running right now for this store.
  SELECT e.id, e.multiplier INTO _event_id, _mult
  FROM public.stamp_events e
  WHERE e.store_id = _store_id AND e.active AND now() >= e.starts_at AND now() < e.ends_at
  ORDER BY e.multiplier DESC, e.starts_at DESC
  LIMIT 1;
  IF _event_id IS NULL THEN _mult := 1; END IF;
  _total := _amt * _mult;

  INSERT INTO public.transactions (store_id, customer_id, staff_id, type, amount, metadata)
  VALUES (_store_id, _customer_id, _staff_id, 'stamp_awarded', _total,
          CASE WHEN _event_id IS NULL THEN '{}'::jsonb
               ELSE jsonb_build_object('event_id', _event_id, 'multiplier', _mult, 'base_amount', _amt) END)
  RETURNING id INTO _tx_id;

  UPDATE public.customer_memberships cm SET stamp_balance = cm.stamp_balance + _total, last_visit_at = now()
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

REVOKE ALL ON FUNCTION public.award_stamp(uuid, uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_stamp(uuid, uuid, integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
