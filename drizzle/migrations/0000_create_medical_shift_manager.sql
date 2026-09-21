CREATE TABLE public.hospitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'emerald',
  payment_day integer NOT NULL DEFAULT 10 CHECK (payment_day BETWEEN 1 AND 31),
  payment_delay integer NOT NULL DEFAULT 1 CHECK (payment_delay BETWEEN 0 AND 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospitals TO authenticated;
GRANT ALL ON public.hospitals TO service_role;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own hospitals" ON public.hospitals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.shift_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  base_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (base_amount >= 0),
  has_variable boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_types TO authenticated;
GRANT ALL ON public.shift_types TO service_role;
ALTER TABLE public.shift_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own shift types" ON public.shift_types FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  shift_date date NOT NULL,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE RESTRICT,
  shift_type_id uuid NOT NULL REFERENCES public.shift_types(id) ON DELETE RESTRICT,
  base_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (base_amount >= 0),
  variable_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (variable_amount >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own shifts" ON public.shifts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX shifts_user_date_idx ON public.shifts(user_id, shift_date);
CREATE INDEX shifts_hospital_idx ON public.shifts(hospital_id);

CREATE TABLE public.calendar_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_feeds TO authenticated;
GRANT ALL ON public.calendar_feeds TO service_role;
ALTER TABLE public.calendar_feeds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own calendar feed" ON public.calendar_feeds FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);