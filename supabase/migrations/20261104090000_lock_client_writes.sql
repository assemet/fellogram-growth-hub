-- Security: the app never writes these tables from the browser (all writes go through server functions
-- or SECURITY DEFINER functions), but the old grants let any signed-in user write to them directly through
-- the public API. In particular a customer could insert their own membership with any stamp balance and
-- then redeem rewards. Closing that here. Safe to run more than once.

-- 1) Memberships: no direct client writes. join_store_program / award_stamp / redeem_reward keep working
--    because they are SECURITY DEFINER.
DROP POLICY IF EXISTS "memberships_insert_own" ON public.customer_memberships;
REVOKE INSERT, UPDATE, DELETE ON public.customer_memberships FROM anon, authenticated;

-- 2) Profiles: the client may read (staff need customer names) but not write. The server updates profiles with
--    the service role. This also stops a user from claiming someone else's telegram_user_id.
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
