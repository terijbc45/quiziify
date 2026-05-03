CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.date_captions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.date_captions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own captions select" ON public.date_captions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own captions insert" ON public.date_captions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own captions update" ON public.date_captions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own captions delete" ON public.date_captions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_date_captions_updated_at
BEFORE UPDATE ON public.date_captions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();