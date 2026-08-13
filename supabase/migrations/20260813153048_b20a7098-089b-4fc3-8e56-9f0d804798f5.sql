DROP POLICY IF EXISTS "Admins can read admin list" ON public.cdc_admins;
CREATE POLICY "Users can read own admin row"
ON public.cdc_admins FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_cdc_admin(_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.cdc_admins WHERE user_id = _user)
$$;

GRANT SELECT ON public.cdc_admins TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_cdc_admin(uuid) TO authenticated;