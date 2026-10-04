CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE UNIQUE INDEX IF NOT EXISTS redemptions_token_hash_key ON public.redemptions(token_hash);

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

REVOKE ALL ON FUNCTION public.create_redemption(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_reward(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_redemption(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid, text) TO authenticated;