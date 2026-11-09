CREATE TABLE public.payments_received (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, hospital_id, month)
);

GRANT SELECT, INSERT, DELETE ON public.payments_received TO authenticated;
GRANT ALL ON public.payments_received TO service_role;

ALTER TABLE public.payments_received ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own payments_received"
  ON public.payments_received FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own payments_received"
  ON public.payments_received FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own payments_received"
  ON public.payments_received FOR DELETE TO authenticated
  USING (user_id = auth.uid());