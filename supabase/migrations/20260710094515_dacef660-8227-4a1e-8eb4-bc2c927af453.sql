
-- Bootstrap: first authenticated caller becomes admin if none exist yet.
CREATE OR REPLACE FUNCTION public.claim_first_cdc_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.cdc_admins) THEN RETURN false; END IF;
  INSERT INTO public.cdc_admins(user_id) VALUES (uid) ON CONFLICT DO NOTHING;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_first_cdc_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_first_cdc_admin() TO authenticated;

-- Record activity: bumps streak + upserts topic progress.
CREATE OR REPLACE FUNCTION public.record_learning_activity(
  _subject_id uuid,
  _chapter_id uuid,
  _topic_id uuid,
  _status text,
  _accuracy numeric DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  today date := (now() AT TIME ZONE 'UTC')::date;
  prev date;
  cur int;
  longest int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  INSERT INTO public.cdc_student_progress(student_id, subject_id, chapter_id, topic_id, status, last_attempted_at, accuracy_percent)
  VALUES (uid, _subject_id, _chapter_id, _topic_id, _status::public.progress_status, now(), _accuracy)
  ON CONFLICT (student_id, topic_id) DO UPDATE
    SET status = EXCLUDED.status,
        last_attempted_at = EXCLUDED.last_attempted_at,
        accuracy_percent = COALESCE(EXCLUDED.accuracy_percent, cdc_student_progress.accuracy_percent),
        updated_at = now();

  SELECT last_active_date, current_streak, longest_streak
    INTO prev, cur, longest
    FROM public.learning_streaks WHERE user_id = uid;

  IF prev IS NULL THEN
    INSERT INTO public.learning_streaks(user_id, current_streak, longest_streak, last_active_date)
    VALUES (uid, 1, 1, today);
  ELSIF prev = today THEN
    -- already counted today
    NULL;
  ELSIF prev = today - INTERVAL '1 day' THEN
    UPDATE public.learning_streaks
      SET current_streak = cur + 1,
          longest_streak = GREATEST(longest, cur + 1),
          last_active_date = today,
          updated_at = now()
      WHERE user_id = uid;
  ELSE
    UPDATE public.learning_streaks
      SET current_streak = 1,
          longest_streak = GREATEST(longest, 1),
          last_active_date = today,
          updated_at = now()
      WHERE user_id = uid;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.record_learning_activity(uuid, uuid, uuid, text, numeric) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_learning_activity(uuid, uuid, uuid, text, numeric) TO authenticated;

-- Unique constraint needed for the upsert above.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cdc_student_progress_student_topic_key'
  ) THEN
    ALTER TABLE public.cdc_student_progress
      ADD CONSTRAINT cdc_student_progress_student_topic_key UNIQUE (student_id, topic_id);
  END IF;
END $$;

-- Sync log for admin dashboard.
CREATE TABLE IF NOT EXISTS public.cdc_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  scope text NOT NULL,
  chunks_added int NOT NULL DEFAULT 0,
  questions_added int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ok',
  error_text text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.cdc_sync_log TO authenticated;
GRANT ALL ON public.cdc_sync_log TO service_role;
ALTER TABLE public.cdc_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read sync log" ON public.cdc_sync_log
  FOR SELECT TO authenticated
  USING (public.is_cdc_admin(auth.uid()));
CREATE POLICY "admins insert sync log" ON public.cdc_sync_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_cdc_admin(auth.uid()));
