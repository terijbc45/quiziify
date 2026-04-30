
-- Add cover_photo_url to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;

-- Add image_url to user_quizzes
ALTER TABLE public.user_quizzes ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Reminder thumbnails: allow file uploads via storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('reminder-thumbs', 'reminder-thumbs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Reminder thumbs publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'reminder-thumbs');

CREATE POLICY "Users upload own reminder thumbs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reminder-thumbs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own reminder thumbs"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'reminder-thumbs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own reminder thumbs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'reminder-thumbs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Quiz images bucket (for user-created question images)
INSERT INTO storage.buckets (id, name, public)
VALUES ('quiz-images', 'quiz-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Quiz images publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'quiz-images');

CREATE POLICY "Users upload own quiz images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'quiz-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own quiz images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'quiz-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Cover photos use the same avatars bucket (already public). Reuse existing policies.
