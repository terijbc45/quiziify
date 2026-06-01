
-- Profile personalization
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS grade text;

-- Server-side image cache (logos / monuments / etc.)
CREATE TABLE IF NOT EXISTS public.media_cache (
  key text PRIMARY KEY,
  url text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.media_cache TO authenticated;
GRANT ALL ON public.media_cache TO service_role;
ALTER TABLE public.media_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Media cache readable" ON public.media_cache FOR SELECT TO authenticated USING (true);

-- Server-side curriculum cache
CREATE TABLE IF NOT EXISTS public.curriculum_cache (
  key text PRIMARY KEY,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.curriculum_cache TO authenticated;
GRANT ALL ON public.curriculum_cache TO service_role;
ALTER TABLE public.curriculum_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Curriculum cache readable" ON public.curriculum_cache FOR SELECT TO authenticated USING (true);

-- Per-user chapter progress
CREATE TABLE IF NOT EXISTS public.chapter_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  country text NOT NULL,
  grade text NOT NULL,
  subject text NOT NULL,
  chapter text NOT NULL,
  best_score integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, country, grade, subject, chapter)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chapter_progress TO authenticated;
GRANT ALL ON public.chapter_progress TO service_role;
ALTER TABLE public.chapter_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own chapter progress select" ON public.chapter_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own chapter progress insert" ON public.chapter_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own chapter progress update" ON public.chapter_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own chapter progress delete" ON public.chapter_progress FOR DELETE TO authenticated USING (auth.uid() = user_id);
