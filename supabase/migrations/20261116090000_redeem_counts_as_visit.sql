-- A customer who comes in and collects a reward (or uses an offer) was in the store, so that counts as a visit
-- even when no new stamp is given. Without this they could look "absent" and get a reminder right after
-- collecting a reward. Done with small triggers so the redeem functions themselves stay untouched.
-- Only last_visit_at moves; the stamp balance is never touched. Safe to run more than once.
CREATE OR REPLACE FUNCTION public.touch_visit_on_redeem()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status::text = 'used' AND OLD.status::text IS DISTINCT FROM 'used' THEN
    UPDATE public.customer_memberships
       SET last_visit_at = GREATEST(COALESCE(last_visit_at, now()), now())
     WHERE store_id = NEW.store_id AND customer_id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.touch_visit_on_redeem() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS redemptions_touch_visit ON public.redemptions;
CREATE TRIGGER redemptions_touch_visit
  AFTER UPDATE OF status ON public.redemptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_visit_on_redeem();

DROP TRIGGER IF EXISTS offer_redemptions_touch_visit ON public.offer_redemptions;
CREATE TRIGGER offer_redemptions_touch_visit
  AFTER UPDATE OF status ON public.offer_redemptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_visit_on_redeem();

NOTIFY pgrst, 'reload schema';
