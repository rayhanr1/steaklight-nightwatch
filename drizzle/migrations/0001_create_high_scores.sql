CREATE TABLE public.high_scores (
  user_id uuid PRIMARY KEY,
  best_score integer NOT NULL DEFAULT 0 CHECK (best_score >= 0),
  best_level integer NOT NULL DEFAULT 0 CHECK (best_level >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.high_scores TO authenticated;
GRANT ALL ON public.high_scores TO service_role;
ALTER TABLE public.high_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players read own high score" ON public.high_scores FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Players add own high score" ON public.high_scores FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Players update own high score" ON public.high_scores FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);