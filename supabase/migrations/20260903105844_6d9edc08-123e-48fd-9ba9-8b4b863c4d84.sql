REVOKE ALL ON FUNCTION public.is_store_member(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_store_owner(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;