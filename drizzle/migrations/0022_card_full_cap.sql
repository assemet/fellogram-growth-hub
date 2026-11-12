-- Stamp cap: the balance may run past one full card (the extra carries over to the next card), but not past two.
-- award_stamp is replaced in full: it is the previous definition (events + referrals + cashier limits) plus the cap.
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

  -- A card that already holds two full rewards takes no more stamps until one is redeemed.
  SELECT lp.stamps_required INTO _required FROM public.loyalty_programs lp WHERE lp.id = _membership.program_id;
  IF _membership.stamp_balance >= COALESCE(_required, 10) * 2 THEN RAISE EXCEPTION 'CARD_FULL'; END IF;

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
