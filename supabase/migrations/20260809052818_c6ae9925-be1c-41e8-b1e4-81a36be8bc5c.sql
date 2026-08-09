-- 1. cdc_admins: only admins can read the admin list
DROP POLICY IF EXISTS "authed can read admins" ON public.cdc_admins;
CREATE POLICY "Admins can read admin list"
ON public.cdc_admins FOR SELECT TO authenticated
USING (public.is_cdc_admin(auth.uid()));

-- 2. Storage: remove broad listing policies; owners can list their own files.
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Quiz images publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Reminder thumbs publicly readable" ON storage.objects;

CREATE POLICY "Users read own avatars"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own quiz images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'quiz-images' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own reminder thumbs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'reminder-thumbs' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 3. Trigger-only SECURITY DEFINER functions must not be callable by API roles
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.claim_first_cdc_admin() FROM anon;
REVOKE ALL ON FUNCTION public.is_cdc_admin(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.record_learning_activity(uuid, uuid, uuid, text, numeric) FROM anon;