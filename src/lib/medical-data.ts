import { supabase } from "@/integrations/supabase/client";

export type Hospital = { id: string; name: string; color: string; payment_day: number; payment_delay: number };
export type ShiftType = { id: string; hospital_id: string | null; name: string; base_amount: number; has_variable: boolean };
export type ShiftPeriod = "day" | "night";
export type Shift = { id: string; shift_date: string; hospital_id: string; shift_type_id: string; base_amount: number; variable_amount: number; notes: string | null; shift_period: ShiftPeriod | null; is_pending: boolean };

export async function loadMedicalData() {
  const [hospitals, shiftTypes, shifts, feed] = await Promise.all([
    supabase.from("hospitals").select("id,name,color,payment_day,payment_delay").order("name"),
    supabase.from("shift_types").select("id,hospital_id,name,base_amount,has_variable").order("name"),
    supabase.from("shifts").select("id,shift_date,hospital_id,shift_type_id,base_amount,variable_amount,notes,shift_period,is_pending").order("shift_date"),
    supabase.from("calendar_feeds").select("token").maybeSingle(),
  ]);
  const error = hospitals.error ?? shiftTypes.error ?? shifts.error ?? feed.error;
  if (error) throw error;
  return { hospitals: hospitals.data as Hospital[], shiftTypes: shiftTypes.data as ShiftType[], shifts: shifts.data as Shift[], feedToken: feed.data?.token ?? null };
}

async function userId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Sessão expirada.");
  return data.user.id;
}
export async function saveHospital(value: Omit<Hospital, "id"> & { id?: string }) {
  const uid = await userId();
  const payload = { user_id: uid, name: value.name, color: value.color, payment_day: value.payment_day, payment_delay: value.payment_delay };
  const result = value.id ? await supabase.from("hospitals").update(payload).eq("id", value.id) : await supabase.from("hospitals").insert(payload);
  if (result.error) throw result.error;
}
export async function saveShiftType(value: Omit<ShiftType, "id"> & { id?: string }) {
  const uid = await userId();
  const payload = { user_id: uid, hospital_id: value.hospital_id, name: value.name, base_amount: value.base_amount, has_variable: value.has_variable };
  const result = value.id ? await supabase.from("shift_types").update(payload).eq("id", value.id) : await supabase.from("shift_types").insert(payload);
  if (result.error) throw result.error;
}
export async function saveShift(value: Omit<Shift, "id"> & { id?: string }) {
  const uid = await userId();
  const payload = { user_id: uid, shift_date: value.shift_date, hospital_id: value.hospital_id, shift_type_id: value.shift_type_id, base_amount: value.base_amount, variable_amount: value.variable_amount, notes: value.notes, shift_period: value.shift_period, is_pending: value.is_pending };
  const result = value.id ? await supabase.from("shifts").update(payload).eq("id", value.id) : await supabase.from("shifts").insert(payload);
  if (result.error) throw result.error;
}
export async function saveShifts(values: Array<Omit<Shift, "id">>) {
  const uid = await userId();
  const payload = values.map((value) => ({ user_id: uid, shift_date: value.shift_date, hospital_id: value.hospital_id, shift_type_id: value.shift_type_id, base_amount: value.base_amount, variable_amount: value.variable_amount, notes: value.notes, shift_period: value.shift_period, is_pending: value.is_pending }));
  const result = await supabase.from("shifts").insert(payload);
  if (result.error) throw result.error;
}
export async function removeRecord(table: "hospitals" | "shift_types" | "shifts", id: string) {
  const result = await supabase.from(table).delete().eq("id", id);
  if (result.error) throw result.error;
}
export async function ensureCalendarFeed() {
  const uid = await userId();
  const existing = await supabase.from("calendar_feeds").select("token").maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data.token;
  const created = await supabase.from("calendar_feeds").insert({ user_id: uid }).select("token").single();
  if (created.error) throw created.error;
  return created.data.token;
}
export type RevenueGoal = { month: string; amount: number };
export async function loadRevenueGoals() {
  const result = await supabase.from("revenue_goals").select("month,amount");
  if (result.error) throw result.error;
  return (result.data ?? []).map((g) => ({ month: g.month, amount: Number(g.amount) })) as RevenueGoal[];
}
export async function saveRevenueGoal(month: string, amount: number | null) {
  const uid = await userId();
  const result = amount === null
    ? await supabase.from("revenue_goals").delete().eq("user_id", uid).eq("month", month)
    : await supabase.from("revenue_goals").upsert({ user_id: uid, month, amount }, { onConflict: "user_id,month" });
  if (result.error) throw result.error;
}
