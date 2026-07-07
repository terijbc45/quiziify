
-- =========================================================
-- CDC Curriculum Engine — Phase 1: schema + seed
-- =========================================================

-- Streams enum for class 11-12
DO $$ BEGIN
  CREATE TYPE public.cdc_stream AS ENUM ('Science','Management','Humanities','Education','Law');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cdc_question_type AS ENUM ('MCQ','short','long','numerical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cdc_difficulty AS ENUM ('easy','medium','hard');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cdc_progress_status AS ENUM ('not_started','in_progress','mastered');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Admins ----------
CREATE TABLE IF NOT EXISTS public.cdc_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cdc_admins TO authenticated;
GRANT ALL ON public.cdc_admins TO service_role;
ALTER TABLE public.cdc_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authed can read admins" ON public.cdc_admins FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.is_cdc_admin(_user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.cdc_admins WHERE user_id = _user)
$$;

-- ---------- Classes ----------
CREATE TABLE IF NOT EXISTS public.cdc_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade INT NOT NULL CHECK (grade BETWEEN 8 AND 12),
  stream public.cdc_stream,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (grade, stream)
);
GRANT SELECT ON public.cdc_classes TO authenticated;
GRANT ALL ON public.cdc_classes TO service_role;
ALTER TABLE public.cdc_classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "classes readable" ON public.cdc_classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage classes" ON public.cdc_classes FOR ALL TO authenticated
  USING (public.is_cdc_admin(auth.uid())) WITH CHECK (public.is_cdc_admin(auth.uid()));

-- ---------- Subjects ----------
CREATE TABLE IF NOT EXISTS public.cdc_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.cdc_classes(id) ON DELETE CASCADE,
  subject_name TEXT NOT NULL,
  subject_code TEXT,
  is_compulsory BOOLEAN NOT NULL DEFAULT true,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, subject_name)
);
GRANT SELECT ON public.cdc_subjects TO authenticated;
GRANT ALL ON public.cdc_subjects TO service_role;
ALTER TABLE public.cdc_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subjects readable" ON public.cdc_subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage subjects" ON public.cdc_subjects FOR ALL TO authenticated
  USING (public.is_cdc_admin(auth.uid())) WITH CHECK (public.is_cdc_admin(auth.uid()));

-- ---------- Chapters ----------
CREATE TABLE IF NOT EXISTS public.cdc_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.cdc_subjects(id) ON DELETE CASCADE,
  chapter_number INT NOT NULL,
  chapter_title TEXT NOT NULL,
  order_index INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subject_id, chapter_number)
);
CREATE INDEX IF NOT EXISTS idx_cdc_chapters_subject ON public.cdc_chapters(subject_id, order_index);
GRANT SELECT ON public.cdc_chapters TO authenticated;
GRANT ALL ON public.cdc_chapters TO service_role;
ALTER TABLE public.cdc_chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chapters readable" ON public.cdc_chapters FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage chapters" ON public.cdc_chapters FOR ALL TO authenticated
  USING (public.is_cdc_admin(auth.uid())) WITH CHECK (public.is_cdc_admin(auth.uid()));

-- ---------- Topics ----------
CREATE TABLE IF NOT EXISTS public.cdc_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES public.cdc_chapters(id) ON DELETE CASCADE,
  topic_title TEXT NOT NULL,
  learning_objectives TEXT[] NOT NULL DEFAULT '{}',
  order_index INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cdc_topics_chapter ON public.cdc_topics(chapter_id, order_index);
GRANT SELECT ON public.cdc_topics TO authenticated;
GRANT ALL ON public.cdc_topics TO service_role;
ALTER TABLE public.cdc_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "topics readable" ON public.cdc_topics FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage topics" ON public.cdc_topics FOR ALL TO authenticated
  USING (public.is_cdc_admin(auth.uid())) WITH CHECK (public.is_cdc_admin(auth.uid()));

-- ---------- Content chunks ----------
CREATE TABLE IF NOT EXISTS public.cdc_content_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.cdc_topics(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL,
  source_url TEXT,
  source_document_name TEXT,
  page_reference TEXT,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cdc_chunks_topic ON public.cdc_content_chunks(topic_id);
CREATE INDEX IF NOT EXISTS idx_cdc_chunks_verified ON public.cdc_content_chunks(verified);
GRANT SELECT ON public.cdc_content_chunks TO authenticated;
GRANT ALL ON public.cdc_content_chunks TO service_role;
ALTER TABLE public.cdc_content_chunks ENABLE ROW LEVEL SECURITY;
-- Students only see verified chunks; admins see all.
CREATE POLICY "students read verified chunks" ON public.cdc_content_chunks FOR SELECT TO authenticated
  USING (verified = true OR public.is_cdc_admin(auth.uid()));
CREATE POLICY "admins manage chunks" ON public.cdc_content_chunks FOR ALL TO authenticated
  USING (public.is_cdc_admin(auth.uid())) WITH CHECK (public.is_cdc_admin(auth.uid()));

-- ---------- Questions ----------
CREATE TABLE IF NOT EXISTS public.cdc_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.cdc_topics(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type public.cdc_question_type NOT NULL DEFAULT 'MCQ',
  options JSONB,
  correct_answer TEXT NOT NULL,
  difficulty public.cdc_difficulty NOT NULL DEFAULT 'medium',
  source_chunk_id UUID REFERENCES public.cdc_content_chunks(id) ON DELETE SET NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cdc_questions_topic ON public.cdc_questions(topic_id);
GRANT SELECT ON public.cdc_questions TO authenticated;
GRANT ALL ON public.cdc_questions TO service_role;
ALTER TABLE public.cdc_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students read verified questions" ON public.cdc_questions FOR SELECT TO authenticated
  USING (verified = true OR public.is_cdc_admin(auth.uid()));
CREATE POLICY "admins manage questions" ON public.cdc_questions FOR ALL TO authenticated
  USING (public.is_cdc_admin(auth.uid())) WITH CHECK (public.is_cdc_admin(auth.uid()));

-- ---------- Student progress ----------
CREATE TABLE IF NOT EXISTS public.cdc_student_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.cdc_subjects(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES public.cdc_chapters(id) ON DELETE CASCADE,
  topic_id UUID REFERENCES public.cdc_topics(id) ON DELETE CASCADE,
  status public.cdc_progress_status NOT NULL DEFAULT 'not_started',
  last_attempted_at TIMESTAMPTZ,
  accuracy_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, topic_id)
);
CREATE INDEX IF NOT EXISTS idx_cdc_progress_student ON public.cdc_student_progress(student_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cdc_student_progress TO authenticated;
GRANT ALL ON public.cdc_student_progress TO service_role;
ALTER TABLE public.cdc_student_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own progress" ON public.cdc_student_progress FOR ALL TO authenticated
  USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);

CREATE TRIGGER trg_cdc_progress_updated BEFORE UPDATE ON public.cdc_student_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- Learning streaks ----------
CREATE TABLE IF NOT EXISTS public.learning_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  last_active_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.learning_streaks TO authenticated;
GRANT ALL ON public.learning_streaks TO service_role;
ALTER TABLE public.learning_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own streak" ON public.learning_streaks FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_streaks_updated BEFORE UPDATE ON public.learning_streaks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Seed classes
-- =========================================================
INSERT INTO public.cdc_classes (grade, stream) VALUES
  (8, NULL), (9, NULL), (10, NULL),
  (11, 'Science'), (11, 'Management'), (11, 'Humanities'), (11, 'Education'), (11, 'Law'),
  (12, 'Science'), (12, 'Management'), (12, 'Humanities'), (12, 'Education'), (12, 'Law')
ON CONFLICT DO NOTHING;

-- =========================================================
-- Seed subjects
-- =========================================================
DO $seed$
DECLARE
  cls RECORD;
  sub TEXT;
  compulsory_basic TEXT[] := ARRAY['Nepali','English','Mathematics','Science','Social Studies','Health Physical and Creative Education'];
  compulsory_sec   TEXT[] := ARRAY['Nepali','English','Mathematics','Science','Social Studies','Health Population and Environment'];
  optional_sec     TEXT[] := ARRAY['Optional Mathematics','Computer Science','Accountancy','Agriculture','Engineering Drawing'];
  compulsory_11_12 TEXT[] := ARRAY['Compulsory Nepali','Compulsory English','Social Studies and Life Skills'];
  sci_subs         TEXT[] := ARRAY['Physics','Chemistry','Biology','Mathematics','Computer Science'];
  mgmt_subs        TEXT[] := ARRAY['Accountancy','Economics','Business Studies','Marketing','Business Mathematics','Hotel Management','Computer Science'];
  hum_subs         TEXT[] := ARRAY['Sociology','Psychology','Political Science','Economics','History','Geography','Rural Development'];
  edu_subs         TEXT[] := ARRAY['Education','Psychology','Health Education','Instructional Pedagogy','English Education','Nepali Education'];
  law_subs         TEXT[] := ARRAY['Introduction to Law','Constitutional Law','General Code','Legal Studies'];
  i INT;
BEGIN
  FOR cls IN SELECT * FROM public.cdc_classes LOOP
    IF cls.grade = 8 THEN
      i := 0;
      FOREACH sub IN ARRAY compulsory_basic LOOP
        i := i + 1;
        INSERT INTO public.cdc_subjects (class_id, subject_name, is_compulsory, is_optional, order_index)
          VALUES (cls.id, sub, true, false, i) ON CONFLICT DO NOTHING;
      END LOOP;
      INSERT INTO public.cdc_subjects (class_id, subject_name, is_compulsory, is_optional, order_index)
        VALUES (cls.id, 'Optional Subject (School Choice)', false, true, i+1) ON CONFLICT DO NOTHING;

    ELSIF cls.grade IN (9, 10) THEN
      i := 0;
      FOREACH sub IN ARRAY compulsory_sec LOOP
        i := i + 1;
        INSERT INTO public.cdc_subjects (class_id, subject_name, is_compulsory, is_optional, order_index)
          VALUES (cls.id, sub, true, false, i) ON CONFLICT DO NOTHING;
      END LOOP;
      FOREACH sub IN ARRAY optional_sec LOOP
        i := i + 1;
        INSERT INTO public.cdc_subjects (class_id, subject_name, is_compulsory, is_optional, order_index)
          VALUES (cls.id, sub, false, true, i) ON CONFLICT DO NOTHING;
      END LOOP;

    ELSIF cls.grade IN (11, 12) THEN
      i := 0;
      FOREACH sub IN ARRAY compulsory_11_12 LOOP
        i := i + 1;
        INSERT INTO public.cdc_subjects (class_id, subject_name, is_compulsory, is_optional, order_index)
          VALUES (cls.id, sub, true, false, i) ON CONFLICT DO NOTHING;
      END LOOP;
      IF cls.stream = 'Science' THEN
        FOREACH sub IN ARRAY sci_subs LOOP
          i := i + 1;
          INSERT INTO public.cdc_subjects (class_id, subject_name, is_compulsory, is_optional, order_index)
            VALUES (cls.id, sub, false, true, i) ON CONFLICT DO NOTHING;
        END LOOP;
      ELSIF cls.stream = 'Management' THEN
        FOREACH sub IN ARRAY mgmt_subs LOOP
          i := i + 1;
          INSERT INTO public.cdc_subjects (class_id, subject_name, is_compulsory, is_optional, order_index)
            VALUES (cls.id, sub, false, true, i) ON CONFLICT DO NOTHING;
        END LOOP;
      ELSIF cls.stream = 'Humanities' THEN
        FOREACH sub IN ARRAY hum_subs LOOP
          i := i + 1;
          INSERT INTO public.cdc_subjects (class_id, subject_name, is_compulsory, is_optional, order_index)
            VALUES (cls.id, sub, false, true, i) ON CONFLICT DO NOTHING;
        END LOOP;
      ELSIF cls.stream = 'Education' THEN
        FOREACH sub IN ARRAY edu_subs LOOP
          i := i + 1;
          INSERT INTO public.cdc_subjects (class_id, subject_name, is_compulsory, is_optional, order_index)
            VALUES (cls.id, sub, false, true, i) ON CONFLICT DO NOTHING;
        END LOOP;
      ELSIF cls.stream = 'Law' THEN
        FOREACH sub IN ARRAY law_subs LOOP
          i := i + 1;
          INSERT INTO public.cdc_subjects (class_id, subject_name, is_compulsory, is_optional, order_index)
            VALUES (cls.id, sub, false, true, i) ON CONFLICT DO NOTHING;
        END LOOP;
      END IF;
    END IF;
  END LOOP;
END $seed$;
