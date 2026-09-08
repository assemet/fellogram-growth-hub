CREATE OR REPLACE FUNCTION public.award_stamp(_store_id uuid, _customer_id uuid, _amount integer DEFAULT 1)
 RETURNS TABLE(membership_id uuid, stamp_balance integer, stamps_required integer, transaction_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _staff_id uuid := auth.uid();
  _amt integer := GREATEST(1, LEAST(5, COALESCE(_amount, 1)));
  _membership public.customer_memberships;
  _required integer;
  _last_at timestamptz;
  _tx_id uuid;
  _new_balance integer;
BEGIN
  IF _staff_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT (public.is_store_member(_store_id, _staff_id) OR public.is_store_owner(_store_id, _staff_id)) THEN
    RAISE EXCEPTION 'NOT_STORE_STAFF';
  END IF;

  SELECT * INTO _membership
  FROM public.customer_memberships
  WHERE customer_memberships.store_id = _store_id AND customer_memberships.customer_id = _customer_id
  FOR UPDATE;

  IF _membership.id IS NULL THEN
    RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND';
  END IF;

  SELECT max(tx.created_at) INTO _last_at
  FROM public.transactions tx
  WHERE tx.store_id = _store_id
    AND tx.customer_id = _customer_id
    AND tx.type = 'stamp_awarded';

  IF _last_at IS NOT NULL AND _last_at > now() - interval '15 minutes' THEN
    RAISE EXCEPTION 'COOLDOWN_ACTIVE:%', GREATEST(1, CEIL(EXTRACT(EPOCH FROM (_last_at + interval '15 minutes' - now())) / 60));
  END IF;

  INSERT INTO public.transactions (store_id, customer_id, staff_id, type, amount)
  VALUES (_store_id, _customer_id, _staff_id, 'stamp_awarded', _amt)
  RETURNING id INTO _tx_id;

  UPDATE public.customer_memberships cm
  SET stamp_balance = cm.stamp_balance + _amt,
      last_visit_at = now()
  WHERE cm.id = _membership.id
  RETURNING cm.stamp_balance INTO _new_balance;

  SELECT lp.stamps_required INTO _required
  FROM public.loyalty_programs lp
  WHERE lp.id = _membership.program_id;

  membership_id := _membership.id;
  stamp_balance := _new_balance;
  stamps_required := COALESCE(_required, 10);
  transaction_id := _tx_id;
  RETURN NEXT;
END;
$function$;

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
BEGIN
  IF _staff_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT (public.is_store_member(_store_id, _staff_id) OR public.is_store_owner(_store_id, _staff_id)) THEN
    RAISE EXCEPTION 'NOT_STORE_STAFF';
  END IF;

  SELECT * INTO _membership
  FROM public.customer_memberships
  WHERE customer_memberships.store_id = _store_id AND customer_memberships.customer_id = _customer_id
  FOR UPDATE;

  IF _membership.id IS NULL THEN
    RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND';
  END IF;

  SELECT * INTO _tx
  FROM public.transactions tx
  WHERE tx.store_id = _store_id
    AND tx.customer_id = _customer_id
    AND tx.type = 'stamp_awarded'
    AND tx.created_at > now() - interval '30 minutes'
  ORDER BY tx.created_at DESC
  LIMIT 1;

  IF _tx.id IS NULL THEN
    RAISE EXCEPTION 'NOTHING_TO_UNDO';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.transactions r
    WHERE r.type = 'stamp_reversed'
      AND (r.metadata->>'reversed_transaction_id') = _tx.id::text
  ) THEN
    RAISE EXCEPTION 'NOTHING_TO_UNDO';
  END IF;

  INSERT INTO public.transactions (store_id, customer_id, staff_id, type, amount, metadata)
  VALUES (_store_id, _customer_id, _staff_id, 'stamp_reversed', _tx.amount,
          jsonb_build_object('reversed_transaction_id', _tx.id));

  UPDATE public.customer_memberships cm
  SET stamp_balance = GREATEST(0, cm.stamp_balance - _tx.amount)
  WHERE cm.id = _membership.id
  RETURNING cm.stamp_balance INTO _new_balance;

  SELECT lp.stamps_required INTO _required
  FROM public.loyalty_programs lp
  WHERE lp.id = _membership.program_id;

  membership_id := _membership.id;
  stamp_balance := _new_balance;
  stamps_required := COALESCE(_required, 10);
  RETURN NEXT;
END;
$function$;