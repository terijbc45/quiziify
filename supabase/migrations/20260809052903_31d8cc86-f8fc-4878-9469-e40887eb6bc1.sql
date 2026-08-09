REVOKE ALL ON FUNCTION public.claim_first_cdc_admin() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.is_cdc_admin(uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.record_learning_activity(uuid, uuid, uuid, text, numeric) FROM anon, authenticated, public;