CREATE TABLE public.day_marks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  mark_date date not null,
  created_at timestamp with time zone not null default now(),
  unique (user_id, mark_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.day_marks TO authenticated;
GRANT ALL ON public.day_marks TO service_role;

ALTER TABLE public.day_marks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own day marks"
ON public.day_marks
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);