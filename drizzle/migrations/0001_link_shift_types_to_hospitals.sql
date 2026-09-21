ALTER TABLE public.shift_types ADD COLUMN hospital_id uuid REFERENCES public.hospitals(id) ON DELETE RESTRICT;
CREATE INDEX shift_types_hospital_idx ON public.shift_types(hospital_id);