ALTER TABLE public.shifts
ADD COLUMN IF NOT EXISTS shift_period text NULL
CHECK (shift_period IS NULL OR shift_period IN ('day', 'night'));

COMMENT ON COLUMN public.shifts.shift_period IS 'Optional shift period: day, night, or NULL when unspecified.';