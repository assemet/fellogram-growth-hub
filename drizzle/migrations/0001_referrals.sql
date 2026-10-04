ALTER TABLE public.loyalty_programs
  ADD COLUMN IF NOT EXISTS referrer_bonus_stamps integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS welcome_bonus_stamps integer NOT NULL DEFAULT 1;

CREATE TABLE public.referral_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, customer_id)
);
GRANT SELECT ON public.referral_links TO authenticated;
GRANT ALL ON public.referral_links TO service_role;
ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY referral_links_select_own ON public.referral_links FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.is_store_owner(store_id, auth.uid()));

-- One referral (and therefore one welcome bonus) per customer per store, ever.
CREATE UNIQUE INDEX IF NOT EXISTS referrals_store_referred_key
  ON public.referrals(store_id, referred_customer_id) WHERE referred_customer_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_referral_code(_store_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _uid uuid := auth.uid(); _code text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customer_memberships WHERE store_id = _store_id AND customer_id = _uid) THEN
    RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.loyalty_programs WHERE store_id = _store_id AND active AND referrals_enabled) THEN
    RAISE EXCEPTION 'REFERRALS_DISABLED';
  END IF;
  SELECT code INTO _code FROM public.referral_links WHERE store_id = _store_id AND customer_id = _uid;
  IF _code IS NULL THEN
    _code := encode(gen_random_bytes(6), 'hex');
    INSERT INTO public.referral_links (store_id, customer_id, code) VALUES (_store_id, _uid, _code)
    ON CONFLICT (store_id, customer_id) DO NOTHING;
    SELECT code INTO _code FROM public.referral_links WHERE store_id = _store_id AND customer_id = _uid;
  END IF;
  RETURN _code;
END; $$;

CREATE OR REPLACE FUNCTION public.accept_referral(_code text)
RETURNS TABLE(store_id uuid, status text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _link public.referral_links; _program_id uuid; _tg_self bigint; _tg_ref bigint;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO _link FROM public.referral_links rl WHERE rl.code = lower(coalesce(_code, ''));
  IF _link.id IS NULL THEN RAISE EXCEPTION 'REFERRAL_INVALID'; END IF;
  store_id := _link.store_id;

  SELECT telegram_user_id INTO _tg_self FROM public.profiles WHERE id = _uid;
  SELECT telegram_user_id INTO _tg_ref FROM public.profiles WHERE id = _link.customer_id;
  IF _link.customer_id = _uid OR (_tg_self IS NOT NULL AND _tg_self = _tg_ref) THEN
    status := 'self'; RETURN NEXT; RETURN;
  END IF;

  SELECT lp.id INTO _program_id FROM public.loyalty_programs lp
   WHERE lp.store_id = _link.store_id AND lp.active AND lp.referrals_enabled ORDER BY lp.created_at LIMIT 1;
  IF _program_id IS NULL THEN status := 'disabled'; RETURN NEXT; RETURN; END IF;

  -- Only brand-new customers of this store can be referred.
  IF EXISTS (SELECT 1 FROM public.customer_memberships cm WHERE cm.store_id = _link.store_id AND cm.customer_id = _uid)
     OR EXISTS (SELECT 1 FROM public.referrals r WHERE r.store_id = _link.store_id AND r.referred_customer_id = _uid) THEN
    status := 'already_member'; RETURN NEXT; RETURN;
  END IF;

  INSERT INTO public.customer_memberships (store_id, program_id, customer_id) VALUES (_link.store_id, _program_id, _uid);
  INSERT INTO public.referrals (store_id, referrer_customer_id, referred_customer_id, referral_code, status)
  VALUES (_link.store_id, _link.customer_id, _uid, _link.code, 'pending');
  status := 'pending'; RETURN NEXT;
END; $$;

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

  SELECT max(tx.created_at) INTO _last_at FROM public.transactions tx
  WHERE tx.store_id = _store_id AND tx.customer_id = _customer_id AND tx.type = 'stamp_awarded'
    AND NOT EXISTS (SELECT 1 FROM public.transactions r WHERE r.type = 'stamp_reversed'
                    AND (r.metadata->>'reversed_transaction_id') = tx.id::text);
  IF _last_at IS NOT NULL AND _last_at > now() - interval '15 minutes' THEN
    RAISE EXCEPTION 'COOLDOWN_ACTIVE:%', GREATEST(1, CEIL(EXTRACT(EPOCH FROM (_last_at + interval '15 minutes' - now())) / 60));
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

REVOKE ALL ON FUNCTION public.get_referral_code(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_referral(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_referral_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_referral(text) TO authenticated;