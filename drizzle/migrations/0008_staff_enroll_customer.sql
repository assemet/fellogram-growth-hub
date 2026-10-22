-- Lets store staff/owners create a customer's card at the counter when the customer
-- shows their personal QR but has not joined yet (join + first stamp in one step).
-- Idempotent: returns the existing membership if the customer already has a card.
CREATE OR REPLACE FUNCTION public.staff_enroll_customer(_store_id uuid, _customer_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _staff_id uuid := auth.uid();
  _program_id uuid;
  _membership_id uuid;
BEGIN
  IF _staff_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT (public.is_store_member(_store_id, _staff_id) OR public.is_store_owner(_store_id, _staff_id)) THEN
    RAISE EXCEPTION 'NOT_STORE_STAFF';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id AND active) THEN
    RAISE EXCEPTION 'STORE_NOT_FOUND';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _customer_id) THEN
    RAISE EXCEPTION 'CUSTOMER_NOT_FOUND';
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
  WHERE store_id = _store_id AND customer_id = _customer_id
  LIMIT 1;

  IF _membership_id IS NOT NULL THEN
    RETURN _membership_id;
  END IF;

  INSERT INTO public.customer_memberships (store_id, program_id, customer_id)
  VALUES (_store_id, _program_id, _customer_id)
  RETURNING id INTO _membership_id;

  RETURN _membership_id;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_enroll_customer(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.staff_enroll_customer(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.staff_enroll_customer(uuid, uuid) TO authenticated;
