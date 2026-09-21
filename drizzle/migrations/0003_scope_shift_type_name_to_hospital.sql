ALTER TABLE public.shift_types DROP CONSTRAINT shift_types_user_id_name_key;
ALTER TABLE public.shift_types ADD CONSTRAINT shift_types_user_hospital_name_key UNIQUE (user_id, hospital_id, name);