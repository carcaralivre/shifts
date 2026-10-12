ALTER TABLE public.shift_types DROP CONSTRAINT shift_types_hospital_id_fkey;
ALTER TABLE public.shift_types ADD CONSTRAINT shift_types_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospitals(id) ON DELETE CASCADE;
ALTER TABLE public.shifts DROP CONSTRAINT shifts_hospital_id_fkey;
ALTER TABLE public.shifts ADD CONSTRAINT shifts_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospitals(id) ON DELETE CASCADE;
ALTER TABLE public.shifts DROP CONSTRAINT shifts_shift_type_id_fkey;
ALTER TABLE public.shifts ADD CONSTRAINT shifts_shift_type_id_fkey FOREIGN KEY (shift_type_id) REFERENCES public.shift_types(id) ON DELETE CASCADE;