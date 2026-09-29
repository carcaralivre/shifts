CREATE TABLE public.revenue_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  month text NOT NULL CHECK (month = 'default' OR month ~ '^\d{4}-\d{2}$'),
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.revenue_goals TO authenticated;
GRANT ALL ON public.revenue_goals TO service_role;
ALTER TABLE public.revenue_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own revenue goals" ON public.revenue_goals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);