-- Welcome stamps: the owner can give every NEW customer one or more stamps the moment their
-- card is created (store QR, created at the counter, or via a friend's referral link).
-- 0 = off. A trigger applies it so every way of creating a card behaves the same, exactly once.
ALTER TABLE public.loyalty_programs ADD COLUMN IF NOT EXISTS join_bonus_stamps integer NOT NULL DEFAULT 0;
ALTER TABLE public.loyalty_programs DROP CONSTRAINT IF EXISTS loyalty_programs_join_bonus_range;
ALTER TABLE public.loyalty_programs ADD CONSTRAINT loyalty_programs_join_bonus_range
  CHECK (join_bonus_stamps BETWEEN 0 AND 20);

-- Its own transaction type, so it never counts as a visit, never triggers the stamp cooldown
-- and can never be "undone" by the cashier's undo button.
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'join_bonus';

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

REVOKE ALL ON FUNCTION public.grant_join_bonus() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS customer_memberships_join_bonus ON public.customer_memberships;
CREATE TRIGGER customer_memberships_join_bonus
  AFTER INSERT ON public.customer_memberships
  FOR EACH ROW EXECUTE FUNCTION public.grant_join_bonus();

NOTIFY pgrst, 'reload schema';
