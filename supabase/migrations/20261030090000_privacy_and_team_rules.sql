-- Privacy controls and team rules. Safe to run more than once.

-- 1) Team rules the owner controls.
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS staff_can_undo boolean NOT NULL DEFAULT true;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS staff_daily_stamp_limit integer NOT NULL DEFAULT 0;
ALTER TABLE public.stores DROP CONSTRAINT IF EXISTS stores_staff_daily_limit_range;
ALTER TABLE public.stores ADD CONSTRAINT stores_staff_daily_limit_range CHECK (staff_daily_stamp_limit BETWEEN 0 AND 1000);

-- 2) A customer removes their own card for a store (their history stays with the store's records).
CREATE OR REPLACE FUNCTION public.leave_store_program(_store_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _removed integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  DELETE FROM public.customer_memberships WHERE store_id = _store_id AND customer_id = auth.uid();
  GET DIAGNOSTICS _removed = ROW_COUNT;
  RETURN _removed > 0;
END;
$$;

-- 3) A cashier leaves the team (owners cannot: they delete the store instead).
CREATE OR REPLACE FUNCTION public.leave_team(_store_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _removed integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  DELETE FROM public.store_members WHERE store_id = _store_id AND user_id = auth.uid() AND role = 'staff';
  GET DIAGNOSTICS _removed = ROW_COUNT;
  RETURN _removed > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.leave_store_program(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_team(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_store_program(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_team(uuid) TO authenticated;

-- 4) Welcome stamps once per customer per store, even if they leave and rejoin.
CREATE OR REPLACE FUNCTION public.grant_join_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _bonus integer;
  _required integer;
BEGIN
  -- One welcome bonus per customer per store, ever: leaving a store and rejoining must not earn it again.
  IF EXISTS (SELECT 1 FROM public.transactions t WHERE t.store_id = NEW.store_id AND t.customer_id = NEW.customer_id AND t.type = 'join_bonus') THEN
    RETURN NULL;
  END IF;

  SELECT lp.join_bonus_stamps, lp.stamps_required INTO _bonus, _required
  FROM public.loyalty_programs lp WHERE lp.id = NEW.program_id;

  -- Never enough to earn the reward by joining alone.
  _bonus := LEAST(COALESCE(_bonus, 0), GREATEST(COALESCE(_required, 1) - 1, 0));

  IF _bonus > 0 THEN
    UPDATE public.customer_memberships SET stamp_balance = stamp_balance + _bonus WHERE id = NEW.id;
    INSERT INTO public.transactions (store_id, customer_id, type, amount)
    VALUES (NEW.store_id, NEW.customer_id, 'join_bonus', _bonus);
  END IF;
  RETURN NULL;
END;
$$;

-- 5) Daily cap per cashier (based on the referral-aware version with the cooldown setting).
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

-- 6) Cashiers may be barred from undoing stamps (based on the referral-aware undo).
CREATE OR REPLACE FUNCTION public.undo_last_stamp(_store_id uuid, _customer_id uuid)
 RETURNS TABLE(membership_id uuid, stamp_balance integer, stamps_required integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _staff_id uuid := auth.uid();
  _membership public.customer_memberships;
  _tx public.transactions;
  _required integer;
  _new_balance integer;
  _ref public.referrals;
  _bonus public.transactions;
BEGIN
  IF _staff_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT (public.is_store_member(_store_id, _staff_id) OR public.is_store_owner(_store_id, _staff_id)) THEN
    RAISE EXCEPTION 'NOT_STORE_STAFF';
  END IF;

  -- Team rule: the owner can take the undo button away from cashiers.
  IF NOT public.is_store_owner(_store_id, _staff_id)
     AND NOT COALESCE((SELECT s.staff_can_undo FROM public.stores s WHERE s.id = _store_id), true) THEN
    RAISE EXCEPTION 'UNDO_NOT_ALLOWED';
  END IF;

  SELECT * INTO _membership FROM public.customer_memberships
  WHERE customer_memberships.store_id = _store_id AND customer_memberships.customer_id = _customer_id
  FOR UPDATE;
  IF _membership.id IS NULL THEN RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND'; END IF;

  SELECT * INTO _tx FROM public.transactions tx
  WHERE tx.store_id = _store_id AND tx.customer_id = _customer_id AND tx.type = 'stamp_awarded'
    AND tx.created_at > now() - interval '30 minutes'
  ORDER BY tx.created_at DESC LIMIT 1;
  IF _tx.id IS NULL THEN RAISE EXCEPTION 'NOTHING_TO_UNDO'; END IF;
  IF EXISTS (SELECT 1 FROM public.transactions r WHERE r.type = 'stamp_reversed'
             AND (r.metadata->>'reversed_transaction_id') = _tx.id::text) THEN
    RAISE EXCEPTION 'NOTHING_TO_UNDO';
  END IF;

  INSERT INTO public.transactions (store_id, customer_id, staff_id, type, amount, metadata)
  VALUES (_store_id, _customer_id, _staff_id, 'stamp_reversed', _tx.amount,
          jsonb_build_object('reversed_transaction_id', _tx.id));
  UPDATE public.customer_memberships cm SET stamp_balance = GREATEST(0, cm.stamp_balance - _tx.amount)
  WHERE cm.id = _membership.id;

  -- If this stamp qualified a referral, revert it and claw back both bonuses.
  SELECT * INTO _ref FROM public.referrals r WHERE r.qualifying_transaction_id = _tx.id FOR UPDATE;
  IF _ref.id IS NOT NULL THEN
    FOR _bonus IN
      SELECT * FROM public.transactions b
      WHERE b.type = 'referral_reward' AND b.store_id = _store_id
        AND (b.metadata->>'referral_id') = _ref.id::text
        AND NOT EXISTS (SELECT 1 FROM public.transactions x WHERE x.type = 'stamp_reversed'
                        AND (x.metadata->>'reversed_transaction_id') = b.id::text)
    LOOP
      INSERT INTO public.transactions (store_id, customer_id, staff_id, type, amount, metadata)
      VALUES (_store_id, _bonus.customer_id, _staff_id, 'stamp_reversed', _bonus.amount,
              jsonb_build_object('reversed_transaction_id', _bonus.id, 'referral_id', _ref.id));
      UPDATE public.customer_memberships cm SET stamp_balance = GREATEST(0, cm.stamp_balance - _bonus.amount)
      WHERE cm.store_id = _store_id AND cm.customer_id = _bonus.customer_id;
    END LOOP;
    UPDATE public.referrals SET status = 'pending', qualifying_transaction_id = NULL, rewarded_at = NULL
    WHERE id = _ref.id;
  END IF;

  SELECT cm.stamp_balance INTO _new_balance FROM public.customer_memberships cm WHERE cm.id = _membership.id;
  SELECT lp.stamps_required INTO _required FROM public.loyalty_programs lp WHERE lp.id = _membership.program_id;

  membership_id := _membership.id;
  stamp_balance := _new_balance;
  stamps_required := COALESCE(_required, 10);
  RETURN NEXT;
END;
$function$;

NOTIFY pgrst, 'reload schema';
