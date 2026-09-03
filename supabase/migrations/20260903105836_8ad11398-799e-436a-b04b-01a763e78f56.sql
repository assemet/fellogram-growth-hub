REVOKE EXECUTE ON FUNCTION public.is_store_member(UUID, UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_store_owner(UUID, UUID) FROM anon, authenticated;