-- Join a store's active loyalty program (idempotent per store)
CREATE OR REPLACE FUNCTION public.join_store_program(_store_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _program_id uuid;
  _membership_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id AND active) THEN
    RAISE EXCEPTION 'STORE_NOT_FOUND';
  END IF;

  SELECT id INTO _program_id
  FROM public.loyalty_programs
  WHERE store_id = _store_id AND active
  ORDER BY created_at
  LIMIT 1;

  IF _program_id IS NULL THEN
    RAISE EXCEPTION 'PROGRAM_NOT_FOUND';
  END IF;

  SELECT id INTO _membership_id
  FROM public.customer_memberships
  WHERE store_id = _store_id AND customer_id = _user_id
  LIMIT 1;

  IF _membership_id IS NOT NULL THEN
    RETURN _membership_id;
  END IF;

  INSERT INTO public.customer_memberships (store_id, program_id, customer_id)
  VALUES (_store_id, _program_id, _user_id)
  RETURNING id INTO _membership_id;

  RETURN _membership_id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_store_program(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_store_program(uuid) TO authenticated;

-- Award a stamp: staff/owner only, writes ledger + balance atomically
CREATE OR REPLACE FUNCTION public.award_stamp(_store_id uuid, _customer_id uuid, _amount integer DEFAULT 1)
RETURNS TABLE (membership_id uuid, stamp_balance integer, stamps_required integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _staff_id uuid := auth.uid();
  _amt integer := GREATEST(1, LEAST(5, COALESCE(_amount, 1)));
  _membership public.customer_memberships;
  _required integer;
BEGIN
  IF _staff_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT (public.is_store_member(_store_id, _staff_id) OR public.is_store_owner(_store_id, _staff_id)) THEN
    RAISE EXCEPTION 'NOT_STORE_STAFF';
  END IF;

  SELECT * INTO _membership
  FROM public.customer_memberships
  WHERE store_id = _store_id AND customer_id = _customer_id
  FOR UPDATE;

  IF _membership.id IS NULL THEN
    RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND';
  END IF;

  INSERT INTO public.transactions (store_id, customer_id, staff_id, type, amount)
  VALUES (_store_id, _customer_id, _staff_id, 'stamp_awarded', _amt);

  UPDATE public.customer_memberships
  SET stamp_balance = stamp_balance + _amt,
      last_visit_at = now()
  WHERE id = _membership.id
  RETURNING customer_memberships.stamp_balance INTO stamp_balance;

  SELECT lp.stamps_required INTO _required
  FROM public.loyalty_programs lp
  WHERE lp.id = _membership.program_id;

  membership_id := _membership.id;
  stamps_required := COALESCE(_required, 10);
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.award_stamp(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_stamp(uuid, uuid, integer) TO authenticated;