
REVOKE ALL ON FUNCTION public.is_cdc_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_cdc_admin(UUID) TO authenticated, service_role;
