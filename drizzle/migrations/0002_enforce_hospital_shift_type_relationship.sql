CREATE OR REPLACE FUNCTION public.validate_shift_type_hospital()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.hospital_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.hospitals h
    WHERE h.id = NEW.hospital_id AND h.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Shift type must belong to a hospital owned by the same user';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_shift_type_hospital_before_write
BEFORE INSERT OR UPDATE OF hospital_id, user_id ON public.shift_types
FOR EACH ROW EXECUTE FUNCTION public.validate_shift_type_hospital();

CREATE OR REPLACE FUNCTION public.validate_shift_hospital_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.shift_types st
    JOIN public.hospitals h ON h.id = NEW.hospital_id
    WHERE st.id = NEW.shift_type_id
      AND st.hospital_id = NEW.hospital_id
      AND st.user_id = NEW.user_id
      AND h.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Shift type must belong to the selected hospital';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_shift_hospital_type_before_write
BEFORE INSERT OR UPDATE OF hospital_id, shift_type_id, user_id ON public.shifts
FOR EACH ROW EXECUTE FUNCTION public.validate_shift_hospital_type();