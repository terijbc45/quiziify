
CREATE TABLE public.post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.user_quizzes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes viewable by authenticated" ON public.post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert own like" ON public.post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own like" ON public.post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.user_quizzes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comments viewable by authenticated" ON public.post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert own comment" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own comment" ON public.post_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Delete own comment" ON public.post_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.seen_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  question_hash text NOT NULL,
  mode text NOT NULL,
  level integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, question_hash)
);
ALTER TABLE public.seen_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own seen select" ON public.seen_questions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own seen insert" ON public.seen_questions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX seen_questions_user_idx ON public.seen_questions(user_id);
