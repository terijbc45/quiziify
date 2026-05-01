ALTER TABLE public.user_quizzes ADD COLUMN IF NOT EXISTS reposted_from_user UUID;
ALTER TABLE public.user_quizzes ADD COLUMN IF NOT EXISTS reposted_from_post UUID;