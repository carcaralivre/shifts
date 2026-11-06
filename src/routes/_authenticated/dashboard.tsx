import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowLeftRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  Copy,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  ensureCalendarFeed,
  loadDayMarks,
  loadMedicalData,
  loadRevenueGoals,
  saveRevenueGoal,
  removeRecord,
  archiveShiftType,
  archiveHospital,
  saveHospital,
  saveShift,
  saveShifts,
  saveShiftType,
  toggleDayMark,
  type DayMarkType,
  type Hospital,
  type Shift,
  type ShiftPeriod,
  type ShiftType,
} from "@/lib/medical-data";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Agenda e Recebimentos — Meus Plantões" },
      { name: "description", content: "Gerencie sua escala médica e acompanhe os recebimentos mensais." },
      { property: "og:title", content: "Agenda e Recebimentos — Meus Plantões" },
      { property: "og:description", content: "Calendário de plantões e painel financeiro pessoal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});
const colors: Record<string, string> = {
  emerald: "bg-hospital-emerald",
  sage: "bg-hospital-sage",
  olive: "bg-hospital-olive",
  teal: "bg-hospital-teal",
  blue: "bg-hospital-blue",
  gray: "bg-hospital-gray",
  gold: "bg-hospital-gold",
  cocoa: "bg-hospital-cocoa",
  rose: "bg-hospital-rose",
  plum: "bg-hospital-plum",
};
const colorLabels: Record<string, string> = {
  emerald: "verde",
  sage: "sálvia",
  olive: "oliva",
  teal: "petróleo",
  blue: "azul",
  gray: "cinza",
  gold: "dourado",
  cocoa: "marrom",
  rose: "lilás",
  plum: "ameixa",
};
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const brlWhole = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
    .format(v)
    .replace(/\s/g, "");
const monthLabel = (d: Date) => format(d, "MMMM yyyy", { locale: ptBR });
const periodEmoji = (period: ShiftPeriod | null) => (period === "day" ? "☀️" : period === "night" ? "🌙" : "");
const shiftHours = (name: string | undefined) => {
  const m = /(\d+)\s*h/i.exec(name ?? "");
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
};
const dayPeriodRank = (s: Shift) => (s.shift_period === "day" ? 0 : s.shift_period === "night" ? 2 : 1);
function compareShiftsByDay(a: Shift, b: Shift, types: ShiftType[]) {
  const ah = shiftHours(types.find((t) => t.id === a.shift_type_id)?.name);
  const bh = shiftHours(types.find((t) => t.id === b.shift_type_id)?.name);
  return (
    a.shift_date.localeCompare(b.shift_date) ||
    dayPeriodRank(a) - dayPeriodRank(b) ||
    ah - bh ||
    a.id.localeCompare(b.id)
  );
}
function errorMessage(cause: unknown) {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === "object" && cause !== null && "message" in cause && typeof cause.message === "string") {
    if ("code" in cause && cause.code === "23505") return "Já existe um tipo com esse nome neste hospital.";
    return cause.message;
  }
  return "Não foi possível salvar o tipo de plantão.";
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.className = "fixed left-0 top-0 opacity-0";
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand("copy");
    input.remove();
    if (!copied) throw new Error("Não foi possível copiar o link. Tente novamente.");
  }
}

function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["medical-data"], queryFn: loadMedicalData });
  const hospitals = data?.hospitals ?? [];
  const shiftTypes = data?.shiftTypes ?? [];
  const shifts = data?.shifts ?? [];
  const [section, setSection] = useState<"agenda" | "settings">("agenda");
  const [scheduleMonth, setScheduleMonth] = useState(startOfMonth(new Date()));
  const [paymentMonth, setPaymentMonth] = useState(startOfMonth(new Date()));
  const [finMode, setFinMode] = useState<"pay" | "gen">("pay");
  const [shiftOpen, setShiftOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [newShiftDate, setNewShiftDate] = useState<string | null>(null);
  const [hospitalOpen, setHospitalOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
  const [editingType, setEditingType] = useState<ShiftType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    table: "hospitals" | "shift_types" | "shifts";
    id: string;
    label: string;
  } | null>(null);
  const [feedStatus, setFeedStatus] = useState<"idle" | "copying" | "copied" | "error">("idle");
  const refresh = () => qc.invalidateQueries({ queryKey: ["medical-data"] });
  const { data: goals = [] } = useQuery({ queryKey: ["revenue-goals"], queryFn: loadRevenueGoals });
  const defaultGoal = goals.find((g) => g.month === "default")?.amount ?? null;
  const monthKey = format(paymentMonth, "yyyy-MM");
  const monthGoal = goals.find((g) => g.month === monthKey)?.amount ?? null;
  async function setGoal(month: string, amount: number | null) {
    await saveRevenueGoal(month, amount);
    await qc.invalidateQueries({ queryKey: ["revenue-goals"] });
  }
  const [hiddenHospitals, setHiddenHospitals] = useState<string[]>([]);
  const monthly = shifts
    .filter((s) => isSameMonth(parseISO(s.shift_date), scheduleMonth) && !hiddenHospitals.includes(s.hospital_id))
    .sort((a, b) => compareShiftsByDay(a, b, shiftTypes));
  const receivables = shifts.filter((s) => {
    const h = hospitals.find((x) => x.id === s.hospital_id);
    return h && isSameMonth(addMonths(parseISO(s.shift_date), finMode === "gen" ? 0 : h.payment_delay), paymentMonth);
  });
  const receivableGroups = hospitals
    .map((h) => ({ hospital: h, items: receivables.filter((s) => s.hospital_id === h.id) }))
    .filter((g) => g.items.length)
    .sort((a, b) => a.items[0]!.shift_date.localeCompare(b.items[0]!.shift_date));
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const { data: dayMarks = {} } = useQuery({ queryKey: ["day-marks"], queryFn: loadDayMarks });
  async function toggleMark(ds: string, mark: DayMarkType | null) {
    const next: DayMarkType | null = mark === null ? "gray" : mark === "gray" ? "red" : null;
    qc.setQueryData<Record<string, DayMarkType>>(["day-marks"], (old) => {
      const copy = { ...(old ?? {}) };
      if (next) copy[ds] = next;
      else delete copy[ds];
      return copy;
    });
    await toggleDayMark(ds, next);
    await qc.invalidateQueries({ queryKey: ["day-marks"] });
  }
  const total = receivables.reduce((sum, s) => sum + Number(s.base_amount) + Number(s.variable_amount), 0);
  async function logout() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/", replace: true });
  }
  async function copyFeed() {
    if (feedStatus === "copying") return;
    setFeedStatus("copying");
    try {
      const token = data?.feedToken ?? (await ensureCalendarFeed());
      const url = `https://plantao.cabservicosmedicos.com.br/api/public/calendar/${token}`;
      await copyText(url);
      if (!data?.feedToken) await refresh();
      setFeedStatus("copied");
      window.setTimeout(() => setFeedStatus("idle"), 3000);
    } catch {
      setFeedStatus("error");
    }
  }
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-3 border-b border-sidebar-border bg-sidebar px-3 py-2 text-sidebar-foreground sm:px-6">
        <button type="button" className="flex items-center gap-3 text-left" onClick={() => setSection("agenda")}>
          <CalendarDays size={20} strokeWidth={1.5} />
          <span className="font-display text-xl font-semibold">Meus Plantões</span>
        </button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            onClick={() => setSection(section === "settings" ? "agenda" : "settings")}
            className={
              section === "settings"
                ? "bg-sidebar-accent text-sidebar-foreground"
                : "text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
            }
          >
            <Settings strokeWidth={1.5} />
            <span className="hidden sm:inline">Configurações</span>
          </Button>
          <Button
            variant="ghost"
            onClick={logout}
            className="text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut strokeWidth={1.5} />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>
      <div className="mx-auto max-w-[1200px]">
        <main className="min-w-0 p-3 sm:p-6">
          {section === "agenda" ? (
            <div className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
              <section className="min-w-0">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="font-display text-2xl font-semibold">Agenda de plantões</h1>
                    <p className="mt-1 text-sm text-muted-foreground">Sua escala mensal por hospital.</p>
                  </div>
                  <Button
                    onClick={() => {
                      setEditingShift(null);
                      setNewShiftDate(null);
                      setShiftOpen(true);
                    }}
                    disabled={!hospitals.length || !shiftTypes.length}
                  >
                    <Plus strokeWidth={1.5} />
                    Novo plantão
                  </Button>
                </div>
                <MonthNav date={scheduleMonth} setDate={setScheduleMonth} />
                {hospitals.length > 1 && (
                  <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filtrar hospitais">
                    {hospitals.map((h) => {
                      const visible = !hiddenHospitals.includes(h.id);
                      return (
                        <Button
                          key={h.id}
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-pressed={visible}
                          aria-label={`${visible ? "Ocultar" : "Mostrar"} ${h.name}`}
                          onClick={() =>
                            setHiddenHospitals((c) => (visible ? [...c, h.id] : c.filter((id) => id !== h.id)))
                          }
                          className={visible ? "" : "opacity-40"}
                        >
                          <span className={`size-3 shrink-0 rounded-full ${colors[h.color]}`} />
                          {h.name}
                        </Button>
                      );
                    })}
                  </div>
                )}
                <Calendar
                  month={scheduleMonth}
                  shifts={monthly}
                  hospitals={hospitals}
                  dayMarks={dayMarks}
                  onEdit={(s) => {
                    setEditingShift(s);
                    setShiftOpen(true);
                  }}
                  onNewDay={(ds) => {
                    setEditingShift(null);
                    setNewShiftDate(ds);
                    setShiftOpen(true);
                  }}
                  onToggleMark={(ds, marked) => {
                    toggleMark(ds, marked);
                  }}
                />
                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="font-display text-lg font-semibold">Plantões do mês</h2>
                    <span className="text-sm text-muted-foreground">
                      {monthly.length} {monthly.length === 1 ? "plantão" : "plantões"}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {monthly.map((s) => (
                      <ShiftRow
                        key={s.id}
                        shift={s}
                        hospital={hospitals.find((h) => h.id === s.hospital_id)}
                        type={shiftTypes.find((t) => t.id === s.shift_type_id)}
                        onEdit={() => {
                          setEditingShift(s);
                          setShiftOpen(true);
                        }}
                        onDelete={() => setDeleteTarget({ table: "shifts", id: s.id, label: "este plantão" })}
                      />
                    ))}
                    {!monthly.length && <Empty text="Nenhum plantão neste mês." />}
                  </div>
                </div>
              </section>
              <aside className="min-w-0 border-t pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <div className="mb-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-display text-2xl font-semibold">
                      {finMode === "pay" ? "Recebimentos" : "Geração"}
                    </h2>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-11 sm:min-h-9"
                      aria-label={finMode === "pay" ? "Ver geração do mês" : "Ver recebimentos do mês"}
                      onClick={() => setFinMode((m) => (m === "pay" ? "gen" : "pay"))}
                    >
                      <ArrowLeftRight strokeWidth={1.5} />
                      {finMode === "pay" ? "Geração" : "Recebimentos"}
                    </Button>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {finMode === "pay" ? "Conforme a regra de cada hospital." : "Quanto você trabalhou no mês."}
                  </p>
                </div>
                <MonthNav date={paymentMonth} setDate={setPaymentMonth} minDate={new Date(2026, 8, 1)} />
                <div className="mt-4 rounded-xl bg-sidebar p-5 text-sidebar-foreground">
                  <p className="text-sm text-sidebar-muted">{finMode === "pay" ? "Total previsto" : "Total gerado"}</p>
                  <p className="mt-2 font-mono text-3xl font-semibold">{brl(total)}</p>
                  <p className="mt-3 text-xs text-sidebar-muted">
                    {finMode === "pay" ? "Pagamento em" : "Plantões de"} {monthLabel(paymentMonth)}
                  </p>
                  <GoalLine
                    key={monthKey}
                    total={total}
                    goal={monthGoal ?? defaultGoal}
                    custom={monthGoal !== null}
                    onSave={(v) => setGoal(monthKey, v)}
                  />
                </div>
                <div className="mt-6 space-y-3">
                  {receivableGroups.map(({ hospital, items }) => (
                    <PaymentGroup
                      key={hospital.id}
                      hospital={hospital}
                      items={items}
                      open={openGroups.includes(hospital.id)}
                      onToggle={() =>
                        setOpenGroups((c) =>
                          c.includes(hospital.id) ? c.filter((id) => id !== hospital.id) : [...c, hospital.id],
                        )
                      }
                    />
                  ))}
                  {!receivableGroups.length && (
                    <Empty text={finMode === "pay" ? "Nenhum recebimento previsto." : "Nenhum plantão neste mês."} />
                  )}
                </div>
              </aside>
            </div>
          ) : (
            <SettingsView
              hospitals={hospitals}
              types={shiftTypes}
              shifts={shifts}
              onHospital={(h) => {
                setEditingHospital(h);
                setHospitalOpen(true);
              }}
              onType={(t) => {
                setEditingType(t);
                setTypeOpen(true);
              }}
              onDelete={(x) => setDeleteTarget(x)}
              onEditShift={(s) => {
                setEditingShift(s);
                setShiftOpen(true);
              }}
              onFeed={copyFeed}
              feedStatus={feedStatus}
              defaultGoal={defaultGoal}
              onGoal={(v) => setGoal("default", v)}
            />
          )}
        </main>
      </div>
      <ShiftDialog
        open={shiftOpen}
        onOpenChange={setShiftOpen}
        shift={editingShift}
        initialDate={newShiftDate ?? undefined}
        hospitals={hospitals}
        types={shiftTypes}
        onSaved={refresh}
        onDelete={() => {
          if (editingShift) {
            setShiftOpen(false);
            setDeleteTarget({ table: "shifts", id: editingShift.id, label: "este plantão" });
          }
        }}
      />
      <HospitalDialog open={hospitalOpen} onOpenChange={setHospitalOpen} hospital={editingHospital} onSaved={refresh} />
      <TypeDialog
        open={typeOpen}
        onOpenChange={setTypeOpen}
        value={editingType}
        hospitals={hospitals}
        onSaved={refresh}
      />
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              {deleteTarget?.table === "hospitals"
                ? `Deseja excluir o hospital ${deleteTarget.label}? Ele e seus tipos deixam de aparecer para novos plantões, mas os plantões já lançados continuam no calendário, na lista e nos cálculos.`
                : deleteTarget?.table === "shift_types"
                ? `Deseja excluir o tipo ${deleteTarget.label}? Ele deixa de aparecer para novos plantões, mas os plantões já lançados continuam no calendário, na lista e nos cálculos.`
                : `Deseja excluir ${deleteTarget?.label}? Esta ação não pode ser desfeita.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deleteTarget) {
                  if (deleteTarget.table === "shift_types") await archiveShiftType(deleteTarget.id);
                  else if (deleteTarget.table === "hospitals") await archiveHospital(deleteTarget.id);
                  else await removeRecord(deleteTarget.table, deleteTarget.id);
                  setDeleteTarget(null);
                  await refresh();
                }
              }}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
function MonthNav({ date, setDate, minDate }: { date: Date; setDate: (d: Date) => void; minDate?: Date | undefined }) {
  const canGoBack = !minDate || date > minDate;
  return (
    <div className="flex h-11 items-center justify-between rounded-lg border bg-surface px-2">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Mês anterior"
        disabled={!canGoBack}
        onClick={() => setDate(subMonths(date, 1))}
      >
        <ChevronLeft strokeWidth={1.5} />
      </Button>
      <span className="font-display text-base font-semibold capitalize">{monthLabel(date)}</span>
      <Button variant="ghost" size="icon" aria-label="Próximo mês" onClick={() => setDate(addMonths(date, 1))}>
        <ChevronRight strokeWidth={1.5} />
      </Button>
    </div>
  );
}
function Calendar({
  month,
  shifts,
  hospitals,
  dayMarks,
  onEdit,
  onNewDay,
  onToggleMark,
}: {
  month: Date;
  shifts: Shift[];
  hospitals: Hospital[];
  dayMarks: Record<string, DayMarkType>;
  onEdit: (s: Shift) => void;
  onNewDay: (ds: string) => void;
  onToggleMark: (ds: string, marked: DayMarkType | null) => void;
}) {
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const blanks = getDay(days[0] ?? month);
  const today = format(new Date(), "yyyy-MM-dd");
  return (
    <div className="mt-4 rounded-xl border bg-surface p-3 sm:p-4">
      <div className="grid grid-cols-7 items-stretch">
        {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"].map((d) => (
          <span key={d} className="py-2 text-center text-[11px] font-medium text-muted-foreground">
            {d}
          </span>
        ))}
        {Array.from({ length: blanks }).map((_, i) => (
          <span key={`b${i}`} />
        ))}
        {days.map((day) => {
          const ds = format(day, "yyyy-MM-dd");
          const dayShifts = shifts.filter((s) => s.shift_date === ds);
          const mark = dayMarks[ds] ?? null;
          return (
            <div
              key={ds}
              onClick={() => onNewDay(ds)}
              onContextMenu={(event) => {
                event.preventDefault();
                onToggleMark(ds, mark);
              }}
              role="button"
              aria-label={`Adicionar plantão em ${ds}`}
              title={
                mark === "gray"
                  ? "Marcado em cinza · botão direito deixa avermelhado"
                  : mark === "red"
                    ? "Marcado para atenção · botão direito remove a marcação"
                    : "Botão direito marca o dia para atenção"
              }
              className={`min-h-16 min-w-0 border-t p-1 transition-colors duration-100 sm:min-h-20 sm:p-2 ${mark === "gray" ? "bg-foreground/10 hover:bg-foreground/15" : mark === "red" ? "bg-destructive/20 hover:bg-destructive/25" : "hover:bg-surface-raised"}`}
            >
              <span
                className={`font-mono text-xs ${ds === today ? "inline-flex size-5 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground" : ""}`}
              >
                {format(day, "d")}
              </span>
              <div className="mt-1 space-y-1">
                {dayShifts.map((s) => {
                  const h = hospitals.find((x) => x.id === s.hospital_id);
                  const total = Number(s.base_amount) + Number(s.variable_amount);
                  const period = periodEmoji(s.shift_period);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      title={`${s.is_pending ? "🚨 Pendente · " : ""}${h?.name ?? "Hospital"}${period ? ` ${period}` : ""} · ${brl(total)}`}
                      aria-label={`Editar plantão ${h?.name ?? "Hospital"} em ${ds}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(s);
                      }}
                      className={`w-full cursor-pointer rounded text-foreground transition-opacity duration-100 hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-current ${s.is_pending ? "bg-destructive text-destructive-foreground" : colors[h?.color ?? "emerald"]}`}
                    >
                      <span className={`flex min-w-0 items-center justify-center gap-1 px-1 py-1 sm:justify-between`}>
                        <span className="min-w-0 text-center text-[9px] font-medium leading-3 [overflow-wrap:anywhere] sm:truncate sm:text-left sm:text-[10px]">
                          {h?.name ?? "Hospital"}
                        </span>
                        <span className="hidden shrink-0 font-mono text-[9px] leading-3 sm:inline">
                          {brlWhole(total)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function ShiftRow({
  shift,
  hospital,
  type,
  onEdit,
  onDelete,
}: {
  shift: Shift;
  hospital: Hospital | undefined;
  type: ShiftType | undefined;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const period = periodEmoji(shift.shift_period);
  return (
    <article className="flex items-center gap-3 rounded-xl border bg-surface px-4 py-3">
      <span className={`h-10 w-1 rounded-full ${colors[hospital?.color ?? "emerald"]}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {shift.is_pending && <>🚨 </>}
          {type?.name ?? "Plantão"} · {hospital?.name ?? "Hospital"}
          {period && <> {period}</>}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {format(parseISO(shift.shift_date), "dd 'de' MMMM", { locale: ptBR })}
        </p>
      </div>
      <p className="hidden font-mono text-sm sm:block">
        {brl(Number(shift.base_amount) + Number(shift.variable_amount))}
      </p>
      <Button variant="ghost" size="icon" aria-label="Editar plantão" onClick={onEdit}>
        <Pencil strokeWidth={1.5} />
      </Button>
      <Button variant="ghost" size="icon" aria-label="Excluir plantão" onClick={onDelete}>
        <Trash2 strokeWidth={1.5} />
      </Button>
    </article>
  );
}
function PaymentGroup({
  hospital,
  items,
  open,
  onToggle,
}: {
  hospital: Hospital;
  items: Shift[];
  open: boolean;
  onToggle: () => void;
}) {
  const sum = items.reduce((acc, s) => acc + Number(s.base_amount) + Number(s.variable_amount), 0);
  return (
    <section className="rounded-xl border bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-current"
      >
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground ${open ? "rotate-180" : ""}`}
          strokeWidth={1.5}
        />
        <span className={`size-3 shrink-0 rounded-full ${colors[hospital.color]}`} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{hospital.name}</span>
        <span className="shrink-0 font-mono text-sm font-semibold">{brl(sum)}</span>
      </button>
      {open && (
        <div className="px-4 pb-2">
          {items.map((s) => (
            <PaymentRow key={s.id} shift={s} hospital={hospital} showHospital={false} />
          ))}
          <p className="border-t py-2 text-right text-xs text-muted-foreground">
            {items.length === 1 ? "1 plantão" : `${items.length} plantões`} ·{" "}
            <span className="font-mono">{brl(sum)}</span>
          </p>
        </div>
      )}
    </section>
  );
}

function PaymentRow({
  shift,
  hospital,
  showHospital = true,
}: {
  shift: Shift;
  hospital: Hospital | undefined;
  showHospital?: boolean;
}) {
  const period = periodEmoji(shift.shift_period);
  const dateText = `Plantão em ${format(parseISO(shift.shift_date), "dd/MM/yyyy")}`;
  const label = showHospital ? (hospital?.name ?? "Hospital") : dateText;
  return (
    <article className="border-b py-3">
      <div className="flex justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            {shift.is_pending && <>🚨 </>}
            {label}
            {period && <> {period}</>}
          </p>
          {showHospital && <p className="mt-1 text-xs text-muted-foreground">{dateText}</p>}
        </div>
        <p className="font-mono text-sm font-medium">
          {brl(Number(shift.base_amount) + Number(shift.variable_amount))}
        </p>
      </div>
      <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
        <span>Fixo {brl(Number(shift.base_amount))}</span>
        <span>Variável {brl(Number(shift.variable_amount))}</span>
      </div>
    </article>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{text}</div>;
}
function SettingsView({
  hospitals,
  types,
  shifts,
  onHospital,
  onType,
  onDelete,
  onEditShift,
  onFeed,
  feedStatus,
  defaultGoal,
  onGoal,
}: {
  hospitals: Hospital[];
  types: ShiftType[];
  shifts: Shift[];
  onHospital: (v: Hospital | null) => void;
  onType: (v: ShiftType | null) => void;
  onDelete: (v: { table: "hospitals" | "shift_types"; id: string; label: string }) => void;
  onEditShift: (s: Shift) => void;
  onFeed: () => void;
  feedStatus: "idle" | "copying" | "copied" | "error";
  defaultGoal: number | null;
  onGoal: (v: number | null) => Promise<void>;
}) {
  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">Hospitais, valores e sincronização.</p>
      </div>
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Hospitais</h2>
          <Button variant="outline" onClick={() => onHospital(null)}>
            <Plus strokeWidth={1.5} />
            Adicionar
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {hospitals.filter((h) => !h.archived).map((h) => (
            <article key={h.id} className="rounded-xl border bg-surface p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className={`size-3 rounded-full ${colors[h.color]}`} />
                  <div>
                    <p className="text-sm font-medium">{h.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Dia {h.payment_day} · M+{h.payment_delay}
                    </p>
                  </div>
                </div>
                <div className="flex">
                  <Button variant="ghost" size="icon" aria-label="Editar hospital" onClick={() => onHospital(h)}>
                    <Pencil strokeWidth={1.5} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Excluir hospital"
                    onClick={() => onDelete({ table: "hospitals", id: h.id, label: h.name })}
                  >
                    <Trash2 strokeWidth={1.5} />
                  </Button>
                </div>
              </div>
            </article>
          ))}
          {!hospitals.some((h) => !h.archived) && <Empty text="Cadastre seu primeiro hospital." />}
        </div>
      </section>
      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Tipos de plantão</h2>
          <Button variant="outline" onClick={() => onType(null)} disabled={!hospitals.length}>
            <Plus strokeWidth={1.5} />
            Adicionar
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {types.filter((t) => !t.archived).map((t) => (
            <article key={t.id} className="rounded-xl border bg-surface p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {hospitals.find((h) => h.id === t.hospital_id)?.name ?? "Hospital não definido"}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">
                    {brl(Number(t.base_amount))} {t.has_variable ? "+ produção" : ""}
                  </p>
                </div>
                <div className="flex">
                  <Button variant="ghost" size="icon" aria-label="Editar tipo" onClick={() => onType(t)}>
                    <Pencil strokeWidth={1.5} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Excluir tipo"
                    onClick={() => onDelete({ table: "shift_types", id: t.id, label: t.name })}
                  >
                    <Trash2 strokeWidth={1.5} />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <DefaultGoalSection key={defaultGoal ?? "none"} value={defaultGoal} onSave={onGoal} />
      <section className="mb-8">
        <h2 className="font-display text-lg font-semibold">Calendário externo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Copie seu link privado para assinar no Google Agenda ou Apple Calendar.
        </p>
        <Button className="mt-4" variant="outline" onClick={onFeed} disabled={feedStatus === "copying"}>
          {feedStatus === "copying" ? (
            <Loader2 className="animate-spin" strokeWidth={1.5} />
          ) : feedStatus === "copied" ? (
            <Check strokeWidth={1.5} />
          ) : (
            <Copy strokeWidth={1.5} />
          )}{" "}
          {feedStatus === "copying"
            ? "Gerando link..."
            : feedStatus === "copied"
              ? "Link copiado"
              : "Copiar link privado"}
        </Button>
        <p
          aria-live="polite"
          className={`mt-2 text-sm ${feedStatus === "error" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {feedStatus === "copied"
            ? "Pronto. O link foi copiado para a área de transferência."
            : feedStatus === "error"
              ? "Não foi possível copiar. Verifique a permissão do navegador e tente novamente."
              : ""}
        </p>
      </section>
      <PasswordSection />
      <ShiftsTableSection shifts={shifts} hospitals={hospitals} types={types} onEdit={onEditShift} />
    </div>
  );
}
function ShiftDialog({
  open,
  onOpenChange,
  shift,
  initialDate,
  hospitals,
  types,
  onSaved,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  shift: Shift | null;
  initialDate?: string | undefined;
  hospitals: Hospital[];
  types: ShiftType[];
  onSaved: () => Promise<unknown>;
  onDelete?: () => void;
}) {
  const initialHospital = shift?.hospital_id ?? hospitals.find((h) => !h.archived)?.id ?? "";
  const [hospitalId, setHospitalId] = useState(initialHospital);
  const availableTypes = types.filter(
    (t) => shift?.shift_type_id === t.id || (!t.archived && t.hospital_id === hospitalId),
  );
  const [typeId, setTypeId] = useState(shift?.shift_type_id ?? availableTypes[0]?.id ?? "");
  const [dates, setDates] = useState([shift?.shift_date ?? format(new Date(), "yyyy-MM-dd")]);
  const [shiftPeriod, setShiftPeriod] = useState<ShiftPeriod | null>(shift?.shift_period ?? null);
  const [pending, setPending] = useState(shift?.is_pending ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    const nextHospital = shift?.hospital_id ?? hospitals.find((h) => !h.archived)?.id ?? "";
    const nextTypes = types.filter(
      (t) => shift?.shift_type_id === t.id || (!t.archived && t.hospital_id === nextHospital),
    );
    setHospitalId(nextHospital);
    setTypeId(shift?.shift_type_id ?? nextTypes[0]?.id ?? "");
    setDates([shift?.shift_date ?? initialDate ?? format(new Date(), "yyyy-MM-dd")]);
    setShiftPeriod(shift?.shift_period ?? null);
    setPending(shift?.is_pending ?? false);
    setSaving(false);
    setError("");
  }, [open, shift, initialDate, hospitals, types]);
  function chooseHospital(id: string) {
    setHospitalId(id);
    setTypeId(types.find((t) => !t.archived && t.hospital_id === id)?.id ?? "");
  }
  function updateDate(index: number, value: string) {
    setDates((current) => current.map((date, i) => (i === index ? value : date)));
    setError("");
  }
  const selectedType = types.find((t) => t.id === typeId);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || !selectedType) return;
    if (dates.some((date) => !date)) {
      setError("Preencha todas as datas.");
      return;
    }
    if (new Set(dates).size !== dates.length) {
      setError("Não repita a mesma data.");
      return;
    }
    const f = new FormData(e.currentTarget);
    const shared = {
      hospital_id: hospitalId,
      shift_type_id: typeId,
      base_amount: Number(f.get("base") || selectedType.base_amount || 0),
      variable_amount: selectedType.has_variable ? Number(f.get("variable") || 0) : 0,
      notes: String(f.get("notes") || "") || null,
      shift_period: shiftPeriod,
      is_pending: pending,
    };
    setSaving(true);
    setError("");
    try {
      if (shift) await saveShift({ ...shared, shift_date: dates[0] ?? shift.shift_date, id: shift.id });
      else await saveShifts(dates.map((shiftDate) => ({ ...shared, shift_date: shiftDate })));
      await onSaved();
      onOpenChange(false);
    } catch (cause) {
      setError(errorMessage(cause));
      setSaving(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{shift ? "Editar plantão" : "Novo plantão"}</DialogTitle>
          <DialogDescription>Informe a escala e os valores deste plantão.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>{dates.length === 1 ? "Data" : "Datas"}</Label>
            {dates.map((date, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  aria-label={`Data ${index + 1}`}
                  type="date"
                  value={date}
                  onChange={(event) => updateDate(index, event.target.value)}
                  disabled={saving}
                  required
                />
                {!shift && index === 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Adicionar outra data"
                    onClick={() => setDates((current) => [...current, ""])}
                    disabled={saving}
                  >
                    <Plus strokeWidth={1.5} />
                  </Button>
                )}
                {!shift && index > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover data ${index + 1}`}
                    onClick={() => setDates((current) => current.filter((_, i) => i !== index))}
                    disabled={saving}
                  >
                    <Trash2 strokeWidth={1.5} />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Hospital</Label>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Hospital">
              {hospitals.filter((h) => !h.archived || h.id === shift?.hospital_id).map((h) => {
                const selected = h.id === hospitalId;
                return (
                  <Button
                    key={h.id}
                    type="button"
                    variant="outline"
                    aria-pressed={selected}
                    onClick={() => chooseHospital(h.id)}
                    disabled={saving}
                    className={`min-h-11 h-auto justify-start whitespace-normal px-3 py-2 text-left ${selected ? "border-foreground bg-surface-raised text-foreground" : ""}`}
                  >
                    <span className={`size-3 shrink-0 rounded-full ${colors[h.color]}`} />
                    <span className="min-w-0 flex-1">{h.name}</span>
                    {selected && <Check className="shrink-0" strokeWidth={1.5} />}
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tipo de plantão</Label>
            {availableTypes.length ? (
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de plantão">
                {availableTypes.map((t) => {
                  const selected = t.id === typeId;
                  return (
                    <Button
                      key={t.id}
                      type="button"
                      variant="outline"
                      aria-pressed={selected}
                      onClick={() => setTypeId(t.id)}
                      disabled={saving}
                      className={`min-h-11 h-auto justify-start whitespace-normal px-3 py-2 text-left ${selected ? "border-foreground bg-surface-raised text-foreground" : ""}`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block">{t.name}</span>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {brl(Number(t.base_amount))}
                        </span>
                      </span>
                      {selected && <Check className="shrink-0" strokeWidth={1.5} />}
                    </Button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                Cadastre um tipo para este hospital.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>
              Situação <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Button
              type="button"
              variant="outline"
              aria-pressed={pending}
              onClick={() => setPending((v) => !v)}
              disabled={saving}
              className={`w-full ${pending ? "border-destructive bg-destructive/10 text-destructive" : ""}`}
            >
              <span aria-hidden="true">🚨</span>Pendente
            </Button>
          </div>
          <div className="space-y-2">
            <Label>
              Período <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Período do plantão">
              <Button
                type="button"
                variant="outline"
                aria-pressed={shiftPeriod === "day"}
                onClick={() => setShiftPeriod((current) => (current === "day" ? null : "day"))}
                disabled={saving}
                className={shiftPeriod === "day" ? "border-foreground bg-surface-raised text-foreground" : ""}
              >
                <span aria-hidden="true">☀️</span>Diurno
              </Button>
              <Button
                type="button"
                variant="outline"
                aria-pressed={shiftPeriod === "night"}
                onClick={() => setShiftPeriod((current) => (current === "night" ? null : "night"))}
                disabled={saving}
                className={shiftPeriod === "night" ? "border-foreground bg-surface-raised text-foreground" : ""}
              >
                <span aria-hidden="true">🌙</span>Noturno
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor fixo">
              <Input
                key={`${shift?.id ?? "new"}-${typeId}`}
                name="base"
                type="number"
                min="0"
                step="0.01"
                defaultValue={
                  shift && shift.shift_type_id === typeId ? shift.base_amount : (selectedType?.base_amount ?? 0)
                }
                disabled={saving}
              />
            </Field>
            {selectedType?.has_variable && (
              <Field label="Produção variável">
                <Input
                  key={`variable-${shift?.id ?? "new"}-${typeId}`}
                  name="variable"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={shift && shift.shift_type_id === typeId ? shift.variable_amount : 0}
                  disabled={saving}
                />
              </Field>
            )}
          </div>
          <Field label="Observações">
            <Input name="notes" defaultValue={shift?.notes ?? ""} disabled={saving} />
          </Field>
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <DialogFooter>
            {shift && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => onDelete()}
                disabled={saving}
                className="mr-auto"
              >
                <Trash2 strokeWidth={1.5} />
                Excluir
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !hospitalId || !typeId}>
              {saving ? (
                <>
                  <Loader2 className="animate-spin" strokeWidth={1.5} />
                  Salvando...
                </>
              ) : dates.length > 1 ? (
                `Salvar ${dates.length} plantões`
              ) : (
                "Salvar plantão"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function HospitalDialog({
  open,
  onOpenChange,
  hospital,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  hospital: Hospital | null;
  onSaved: () => Promise<unknown>;
}) {
  const [color, setColor] = useState("emerald");
  useEffect(() => {
    if (open) setColor(hospital?.color ?? "emerald");
  }, [open, hospital]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{hospital ? "Editar hospital" : "Novo hospital"}</DialogTitle>
          <DialogDescription>Defina a identificação e a regra de pagamento.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const payload = {
              name: String(f.get("name")),
              color,
              payment_day: Number(f.get("day")),
              payment_delay: Number(f.get("delay")),
            };
            await saveHospital(hospital ? { ...payload, id: hospital.id } : payload);
            onOpenChange(false);
            await onSaved();
          }}
        >
          <Field label="Nome">
            <Input name="name" defaultValue={hospital?.name ?? ""} required />
          </Field>
          <Field label="Cor">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Cor do hospital">
              {Object.entries(colors).map(([name, className]) => {
                const selected = color === name;
                return (
                  <Button
                    key={name}
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Selecionar cor ${colorLabels[name] ?? name}`}
                    aria-pressed={selected}
                    onClick={() => setColor(name)}
                    className={selected ? "border-foreground bg-surface-raised" : ""}
                  >
                    <span className={`flex size-6 items-center justify-center rounded-full ${className}`}>
                      {selected && <Check className="size-4 text-primary-foreground" strokeWidth={1.5} />}
                    </span>
                  </Button>
                );
              })}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dia do pagamento">
              <Input name="day" type="number" min="1" max="31" defaultValue={hospital?.payment_day ?? 10} />
            </Field>
            <Field label="Defasagem">
              <Select name="delay" defaultValue={String(hospital?.payment_delay ?? 1)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">M+0</SelectItem>
                  <SelectItem value="1">M+1</SelectItem>
                  <SelectItem value="2">M+2</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Salvar hospital</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function TypeDialog({
  open,
  onOpenChange,
  value,
  hospitals,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: ShiftType | null;
  hospitals: Hospital[];
  onSaved: () => Promise<unknown>;
}) {
  const [variable, setVariable] = useState(false);
  const [hospitalId, setHospitalId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (open) {
      setVariable(value?.has_variable ?? false);
      setHospitalId(value?.hospital_id ?? hospitals.find((h) => !h.archived)?.id ?? "");
      setSaving(false);
      setError("");
    }
  }, [open, value, hospitals]);
  function parseAmount(raw: string) {
    const normalized = raw.trim().replace(/\s/g, "");
    return Number(normalized.includes(",") ? normalized.replace(/\./g, "").replace(",", ".") : normalized);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    const baseAmount = parseAmount(String(f.get("base") ?? ""));
    if (!hospitalId) {
      setError("Selecione um hospital.");
      return;
    }
    if (!name) {
      setError("Informe o nome do tipo de plantão.");
      return;
    }
    if (!Number.isFinite(baseAmount) || baseAmount < 0) {
      setError("Informe uma remuneração base válida.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { hospital_id: hospitalId, name, base_amount: baseAmount, has_variable: variable };
      await saveShiftType(value ? { ...payload, id: value.id } : payload);
      await onSaved();
      onOpenChange(false);
    } catch (cause) {
      setError(errorMessage(cause));
      setSaving(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{value ? "Editar tipo" : "Novo tipo de plantão"}</DialogTitle>
          <DialogDescription>Defina o hospital e a remuneração padrão deste formato.</DialogDescription>
        </DialogHeader>
        <form key={value?.id ?? "new"} className="space-y-4" noValidate onSubmit={submit}>
          <Field label="Hospital">
            <Select value={hospitalId} onValueChange={setHospitalId} disabled={saving}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um hospital" />
              </SelectTrigger>
              <SelectContent>
                {hospitals.filter((h) => !h.archived || h.id === value?.hospital_id).map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nome">
            <Input name="name" defaultValue={value?.name ?? ""} disabled={saving} required />
          </Field>
          <Field label="Remuneração base">
            <Input
              name="base"
              type="text"
              inputMode="decimal"
              defaultValue={value?.base_amount ?? 0}
              disabled={saving}
              required
            />
          </Field>
          <div className="flex items-center justify-between rounded-lg border bg-surface p-3">
            <div>
              <Label htmlFor="variable">Produção variável</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Permite informar um valor adicional somente neste tipo.
              </p>
            </div>
            <Switch id="variable" checked={variable} onCheckedChange={setVariable} disabled={saving} />
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !hospitalId}>
              {saving ? (
                <>
                  <Loader2 className="animate-spin" strokeWidth={1.5} />
                  Salvando...
                </>
              ) : (
                "Salvar tipo"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
type SortKey = "date" | "hospital" | "type" | "period" | "value" | "created";
type SortDir = "asc" | "desc";
const sortDefault: Record<SortKey, SortDir> = {
  date: "desc",
  hospital: "asc",
  type: "asc",
  period: "asc",
  value: "desc",
  created: "desc",
};
function sortShifts(rows: Shift[], key: SortKey, dir: SortDir, hospitals: Hospital[], types: ShiftType[]) {
  const name = (s: Shift) => hospitals.find((h) => h.id === s.hospital_id)?.name ?? "";
  const typeName = (s: Shift) => types.find((t) => t.id === s.shift_type_id)?.name ?? "";
  const value = (s: Shift) => Number(s.base_amount) + Number(s.variable_amount);
  const periodRank = (s: Shift) => (s.shift_period === "day" ? 0 : s.shift_period === "night" ? 1 : 2);
  const cmp = (a: Shift, b: Shift) => {
    switch (key) {
      case "date":
        return a.shift_date.localeCompare(b.shift_date);
      case "hospital":
        return name(a).localeCompare(name(b), "pt-BR");
      case "type":
        return typeName(a).localeCompare(typeName(b), "pt-BR");
      case "period":
        return periodRank(a) - periodRank(b);
      case "value":
        return value(a) - value(b);
      default:
        return a.created_at.localeCompare(b.created_at);
    }
  };
  return [...rows].sort((a, b) => {
    const r = cmp(a, b);
    return r !== 0 ? r * (dir === "asc" ? 1 : -1) : dir === "asc" ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
  });
}
function SortableTh({
  label,
  sortKey,
  active,
  dir,
  onSort,
  align,
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  dir: SortDir;
  onSort: (k: SortKey) => void;
  align?: "right";
}) {
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={`px-3 py-2 ${align === "right" ? "text-right" : ""}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Ordenar por ${label}`}
        className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground ${active ? "text-foreground" : ""}`}
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ChevronUp size={12} strokeWidth={1.5} />
          ) : (
            <ChevronDown size={12} strokeWidth={1.5} />
          )
        ) : (
          <ChevronsUpDown size={12} strokeWidth={1.5} className="opacity-40" />
        )}
      </button>
    </th>
  );
}
function ShiftsTableSection({
  shifts,
  hospitals,
  types,
  onEdit,
}: {
  shifts: Shift[];
  hospitals: Hospital[];
  types: ShiftType[];
  onEdit: (s: Shift) => void;
}) {
  const [month, setMonth] = useState("all");
  const [hospitalId, setHospitalId] = useState("all");
  const [typeId, setTypeId] = useState("all");
  const [period, setPeriod] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  function chooseSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(sortDefault[key]);
    }
  }
  const months = Array.from(new Set(shifts.map((s) => s.shift_date.slice(0, 7))))
    .sort()
    .reverse();
  const filtered = sortShifts(
    shifts.filter(
      (s) =>
        (month === "all" || s.shift_date.startsWith(month)) &&
        (hospitalId === "all" || s.hospital_id === hospitalId) &&
        (typeId === "all" || s.shift_type_id === typeId) &&
        (period === "all" || (s.shift_period ?? "none") === period),
    ),
    sortKey,
    sortDir,
    hospitals,
    types,
  );
  const sum = filtered.reduce((acc, s) => acc + Number(s.base_amount) + Number(s.variable_amount), 0);
  const selectClass = "h-9 w-full rounded-md border bg-surface px-2 text-sm";
  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="font-display text-lg font-semibold">Todos os plantões</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Clique no título de uma coluna para ordenar por ela. Clique em um plantão para editar.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <Label htmlFor="filter-month">Mês</Label>
          <select id="filter-month" value={month} onChange={(e) => setMonth(e.target.value)} className={selectClass}>
            <option value="all">Todos</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {format(parseISO(`${m}-01`), "MMMM yyyy", { locale: ptBR })}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="filter-hospital">Hospital</Label>
          <select
            id="filter-hospital"
            value={hospitalId}
            onChange={(e) => setHospitalId(e.target.value)}
            className={selectClass}
          >
            <option value="all">Todos</option>
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="filter-type">Tipo</Label>
          <select id="filter-type" value={typeId} onChange={(e) => setTypeId(e.target.value)} className={selectClass}>
            <option value="all">Todos</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="filter-period">Período</Label>
          <select id="filter-period" value={period} onChange={(e) => setPeriod(e.target.value)} className={selectClass}>
            <option value="all">Todos</option>
            <option value="day">☀️ Diurno</option>
            <option value="night">🌙 Noturno</option>
            <option value="none">Sem período</option>
          </select>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border bg-surface">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <SortableTh label="Data" sortKey="date" active={sortKey === "date"} dir={sortDir} onSort={chooseSort} />
              <SortableTh
                label="Hospital"
                sortKey="hospital"
                active={sortKey === "hospital"}
                dir={sortDir}
                onSort={chooseSort}
              />
              <SortableTh label="Tipo" sortKey="type" active={sortKey === "type"} dir={sortDir} onSort={chooseSort} />
              <SortableTh
                label="Período"
                sortKey="period"
                active={sortKey === "period"}
                dir={sortDir}
                onSort={chooseSort}
              />
              <SortableTh
                label="Valor"
                sortKey="value"
                active={sortKey === "value"}
                dir={sortDir}
                onSort={chooseSort}
                align="right"
              />
              <SortableTh
                label="Cadastrado em"
                sortKey="created"
                active={sortKey === "created"}
                dir={sortDir}
                onSort={chooseSort}
              />
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const h = hospitals.find((x) => x.id === s.hospital_id);
              const t = types.find((x) => x.id === s.shift_type_id);
              return (
                <tr
                  key={s.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Editar plantão ${h?.name ?? "Hospital"} em ${format(parseISO(s.shift_date), "dd/MM/yyyy")}`}
                  onClick={() => onEdit(s)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onEdit(s);
                    }
                  }}
                  className="cursor-pointer border-b last:border-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-current hover:bg-surface-raised"
                >
                  <td className="px-3 py-2 font-mono text-xs">{format(parseISO(s.shift_date), "dd/MM/yyyy")}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      {s.is_pending && <span aria-label="Pendente">🚨</span>}
                      <span className={`size-2.5 shrink-0 rounded-full ${colors[h?.color ?? "emerald"]}`} />
                      {h?.name ?? "Hospital"}
                    </span>
                  </td>
                  <td className="px-3 py-2">{t?.name ?? "Plantão"}</td>
                  <td className="px-3 py-2">{periodEmoji(s.shift_period) || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {brl(Number(s.base_amount) + Number(s.variable_amount))}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {format(parseISO(s.created_at), "dd/MM/yyyy HH:mm")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length && (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhum plantão com esses filtros.</p>
        )}
      </div>
      <p className="mt-2 text-right text-xs text-muted-foreground">
        {filtered.length === 1 ? "1 plantão" : `${filtered.length} plantões`} ·{" "}
        <span className="font-mono">{brl(sum)}</span>
      </p>
    </section>
  );
}

function parseMoney(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t.replace(/[R$\s.]/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}
function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    if (next.length < 6) {
      setStatus("error");
      setMessage("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (next !== confirm) {
      setStatus("error");
      setMessage("A confirmação não confere com a nova senha.");
      return;
    }
    setStatus("saving");
    try {
      const { error } = await supabase.auth.updateUser({ password: next, current_password: current });
      if (error) throw error;
      setStatus("saved");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (caught) {
      setStatus("error");
      setMessage(
        caught instanceof Error && caught.message
          ? "Não foi possível trocar a senha. Confira a senha atual e tente novamente."
          : "Não foi possível trocar a senha. Confira a senha atual e tente novamente.",
      );
    }
  }
  return (
    <section className="mb-8">
      <h2 className="font-display text-lg font-semibold">Senha</h2>
      <p className="mt-1 text-sm text-muted-foreground">Troque a senha da sua conta.</p>
      <form onSubmit={submit} noValidate className="mt-4 max-w-sm space-y-3">
        <div>
          <Label htmlFor="current-password">Senha atual</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => {
              setCurrent(e.target.value);
              setStatus("idle");
              setMessage("");
            }}
            className="mt-1"
            required
          />
        </div>
        <div>
          <Label htmlFor="new-password">Nova senha</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => {
              setNext(e.target.value);
              setStatus("idle");
              setMessage("");
            }}
            className="mt-1"
            required
          />
        </div>
        <div>
          <Label htmlFor="confirm-password">Confirmar nova senha</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value);
              setStatus("idle");
              setMessage("");
            }}
            className="mt-1"
            required
          />
        </div>
        <Button type="submit" variant="outline" disabled={status === "saving" || !current || !next || !confirm}>
          {status === "saving" ? (
            <Loader2 className="animate-spin" strokeWidth={1.5} />
          ) : status === "saved" ? (
            <Check strokeWidth={1.5} />
          ) : null}
          Salvar nova senha
        </Button>
      </form>
      <p
        aria-live="polite"
        className={`mt-2 text-sm ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}
      >
        {status === "error" ? message : status === "saved" ? "Senha atualizada." : ""}
      </p>
    </section>
  );
}
function DefaultGoalSection({ value, onSave }: { value: number | null; onSave: (v: number | null) => Promise<void> }) {
  const [text, setText] = useState(value === null ? "" : String(value).replace(".", ","));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = parseMoney(text);
    if (Number.isNaN(n)) {
      setStatus("error");
      return;
    }
    setStatus("saving");
    try {
      await onSave(n);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }
  return (
    <section className="mb-8">
      <h2 className="font-display text-lg font-semibold">Meta de faturamento</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Meta mensal padrão. Você pode ajustar um mês específico no painel de recebimentos.
      </p>
      <form onSubmit={submit} noValidate className="mt-4 flex max-w-sm items-end gap-2">
        <div className="flex-1">
          <Label htmlFor="default-goal">Valor mensal</Label>
          <Input
            id="default-goal"
            inputMode="decimal"
            placeholder="Ex.: 20000"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setStatus("idle");
            }}
            className="mt-1 font-mono"
          />
        </div>
        <Button type="submit" variant="outline" disabled={status === "saving"}>
          {status === "saving" ? (
            <Loader2 className="animate-spin" strokeWidth={1.5} />
          ) : status === "saved" ? (
            <Check strokeWidth={1.5} />
          ) : null}
          Salvar
        </Button>
      </form>
      <p
        aria-live="polite"
        className={`mt-2 text-sm ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}
      >
        {status === "error" ? "Valor inválido ou erro ao salvar." : status === "saved" ? "Meta salva." : ""}
      </p>
    </section>
  );
}
function GoalLine({
  total,
  goal,
  custom,
  onSave,
}: {
  total: number;
  goal: number | null;
  custom: boolean;
  onSave: (v: number | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(custom && goal !== null ? String(goal).replace(".", ",") : "");
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = parseMoney(text);
    if (Number.isNaN(n)) return;
    setSaving(true);
    try {
      await onSave(n);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }
  if (editing)
    return (
      <form onSubmit={submit} noValidate className="mt-4 flex items-center gap-2 border-t border-sidebar-border pt-3">
        <Input
          aria-label="Meta deste mês"
          autoFocus
          inputMode="decimal"
          placeholder="Vazio = meta padrão"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-8 bg-transparent font-mono text-xs text-sidebar-foreground"
        />
        <Button
          type="submit"
          size="sm"
          variant="ghost"
          disabled={saving}
          className="text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          {saving ? <Loader2 className="animate-spin" strokeWidth={1.5} /> : <Check strokeWidth={1.5} />}
        </Button>
      </form>
    );
  const remaining = goal === null ? 0 : Math.max(goal - total, 0);
  const pct = goal ? Math.min((total / goal) * 100, 100) : 0;
  return (
    <div className="mt-4 border-t border-sidebar-border pt-3 text-xs text-sidebar-muted">
      {goal === null ? (
        <button type="button" onClick={() => setEditing(true)} className="hover:text-sidebar-foreground">
          Definir meta deste mês
        </button>
      ) : (
        <>
          <div className="h-1 overflow-hidden rounded-full bg-sidebar-accent">
            <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span>
              Meta <span className="font-mono">{brlWhole(goal)}</span>
              {custom ? " · deste mês" : ""}
            </span>
            <span className="flex items-center gap-1">
              {remaining > 0 ? (
                <>
                  Faltam <span className="font-mono">{brlWhole(remaining)}</span>
                </>
              ) : (
                "Meta atingida"
              )}
              <button
                type="button"
                aria-label="Ajustar meta deste mês"
                onClick={() => setEditing(true)}
                className="ml-1 rounded p-1 hover:text-sidebar-foreground"
              >
                <Pencil size={12} strokeWidth={1.5} />
              </button>
            </span>
          </div>
        </>
      )}
    </div>
  );
}
