CREATE TABLE public.saved_games (user_id uuid PRIMARY KEY, snapshot jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE ON public.saved_games TO authenticated;
GRANT ALL ON public.saved_games TO service_role;
ALTER TABLE public.saved_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players read own save" ON public.saved_games FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "Players insert own save" ON public.saved_games FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "Players update own save" ON public.saved_games FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);