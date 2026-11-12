-- Privacy: until now any signed-in user could read every profile (Telegram id, name, username, photo).
-- Now a profile is readable only by:
--   * its owner,
--   * a store's owner/staff, for the customers who joined that store,
--   * a store's owner, for the staff of that store,
--   * a store's staff, for the owner of that store.
-- The server uses the service role for everything else (sign-in, notifications). Safe to run more than once.
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_scoped" ON public.profiles;
CREATE POLICY "profiles_select_scoped" ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.customer_memberships cm
    WHERE cm.customer_id = profiles.id
      AND (public.is_store_owner(cm.store_id, auth.uid()) OR public.is_store_member(cm.store_id, auth.uid()))
  )
  OR EXISTS (
    SELECT 1 FROM public.store_members sm
    WHERE sm.user_id = profiles.id AND public.is_store_owner(sm.store_id, auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.owner_id = profiles.id AND public.is_store_member(s.id, auth.uid())
  )
);

NOTIFY pgrst, 'reload schema';
