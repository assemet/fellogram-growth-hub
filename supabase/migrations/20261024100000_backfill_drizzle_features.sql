-- Backfill: objects that were only recorded in drizzle/migrations (reward redemption, referrals,
-- referral-aware undo). Everything is guarded, so on a database that already has them this changes
-- nothing; on one rebuilt from supabase/migrations alone it adds what is missing.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE UNIQUE INDEX IF NOT EXISTS redemptions_token_hash_key ON public.redemptions(token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS referrals_store_referred_key
  ON public.referrals(store_id, referred_customer_id) WHERE referred_customer_id IS NOT NULL;

DO $backfill$
BEGIN
  -- Table first: the referral functions declare variables of its row type.
  IF to_regclass('public.referral_links') IS NULL THEN
    EXECUTE $fn$
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
$fn$;
  END IF;

  IF to_regprocedure('public.create_redemption(uuid)') IS NULL THEN
    EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.create_redemption(_reward_id uuid)
RETURNS TABLE(redemption_id uuid, token text, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  _uid uuid := auth.uid();
  _reward public.rewards;
  _balance integer;
  _token text;
  _id uuid;
  _exp timestamptz := now() + interval '5 minutes';
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO _reward FROM public.rewards r WHERE r.id = _reward_id AND r.active;
  IF _reward.id IS NULL THEN RAISE EXCEPTION 'REWARD_NOT_FOUND'; END IF;
  SELECT cm.stamp_balance INTO _balance FROM public.customer_memberships cm
   WHERE cm.store_id = _reward.store_id AND cm.customer_id = _uid;
  IF _balance IS NULL THEN RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND'; END IF;
  IF _balance < _reward.stamps_required THEN RAISE EXCEPTION 'NOT_ENOUGH_STAMPS'; END IF;

  -- Only one live token per customer per store
  UPDATE public.redemptions SET status = 'expired'
   WHERE customer_id = _uid AND store_id = _reward.store_id AND status = 'pending';

  _token := encode(gen_random_bytes(24), 'hex');
  INSERT INTO public.redemptions (store_id, customer_id, reward_id, token_hash, expires_at)
  VALUES (_reward.store_id, _uid, _reward.id, encode(digest(_token, 'sha256'), 'hex'), _exp)
  RETURNING id INTO _id;

  redemption_id := _id; token := _token; expires_at := _exp;
  RETURN NEXT;
END; $$;
$fn$;
  END IF;

  IF to_regprocedure('public.redeem_reward(uuid, text)') IS NULL THEN
    EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.redeem_reward(_store_id uuid, _token text)
RETURNS TABLE(redemption_id uuid, customer_id uuid, reward_name text, stamps_deducted integer, stamp_balance integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  _staff uuid := auth.uid();
  _r public.redemptions;
  _reward public.rewards;
  _new integer;
BEGIN
  IF _staff IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT (public.is_store_member(_store_id, _staff) OR public.is_store_owner(_store_id, _staff)) THEN
    RAISE EXCEPTION 'NOT_STORE_STAFF';
  END IF;

  SELECT * INTO _r FROM public.redemptions rd
   WHERE rd.token_hash = encode(digest(coalesce(_token, ''), 'sha256'), 'hex')
   FOR UPDATE;
  IF _r.id IS NULL OR _r.store_id <> _store_id THEN RAISE EXCEPTION 'TOKEN_INVALID'; END IF;
  IF _r.status = 'used' THEN RAISE EXCEPTION 'TOKEN_USED'; END IF;
  IF _r.status <> 'pending' OR _r.expires_at < now() THEN
    UPDATE public.redemptions SET status = 'expired' WHERE id = _r.id AND status = 'pending';
    RAISE EXCEPTION 'TOKEN_EXPIRED';
  END IF;

  SELECT * INTO _reward FROM public.rewards WHERE id = _r.reward_id;

  UPDATE public.customer_memberships cm
     SET stamp_balance = cm.stamp_balance - _reward.stamps_required
   WHERE cm.store_id = _store_id AND cm.customer_id = _r.customer_id
     AND cm.stamp_balance >= _reward.stamps_required
  RETURNING cm.stamp_balance INTO _new;
  IF _new IS NULL THEN RAISE EXCEPTION 'NOT_ENOUGH_STAMPS'; END IF;

  UPDATE public.redemptions SET status = 'used', used_at = now() WHERE id = _r.id;

  INSERT INTO public.transactions (store_id, customer_id, staff_id, type, amount, related_reward_id, metadata)
  VALUES (_store_id, _r.customer_id, _staff, 'reward_redeemed', _reward.stamps_required, _reward.id,
          jsonb_build_object('redemption_id', _r.id));

  redemption_id := _r.id; customer_id := _r.customer_id; reward_name := _reward.name;
  stamps_deducted := _reward.stamps_required; stamp_balance := _new;
  RETURN NEXT;
END; $$;
$fn$;
  END IF;

  IF to_regprocedure('public.get_referral_code(uuid)') IS NULL THEN
    EXECUTE $fn$
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
$fn$;
  END IF;

  IF to_regprocedure('public.accept_referral(text)') IS NULL THEN
    EXECUTE $fn$
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
$fn$;
  END IF;

  -- Older undo_last_stamp does not take back referral rewards.
  IF to_regprocedure('public.undo_last_stamp(uuid, uuid)') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.oid = to_regprocedure('public.undo_last_stamp(uuid, uuid)')
                    AND pg_get_functiondef(p.oid) ILIKE '%referral%') THEN
    EXECUTE $fn$
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
$fn$;
  END IF;
END
$backfill$;

REVOKE ALL ON FUNCTION public.create_redemption(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_reward(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_referral_code(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_referral(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_redemption(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_referral_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_referral(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
