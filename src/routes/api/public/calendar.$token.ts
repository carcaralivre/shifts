import { createFileRoute } from "@tanstack/react-router";

function clean(value: string) { return value.replace(/[\\;,\n]/g, " "); }
export const Route = createFileRoute("/api/public/calendar/$token")({
  server: { handlers: { GET: async ({ params }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: feed } = await supabaseAdmin.from("calendar_feeds").select("user_id").eq("token", params.token).maybeSingle();
    if (!feed) return new Response("Calendário não encontrado", { status: 404 });
    const { data } = await supabaseAdmin.from("shifts").select("id,shift_date,base_amount,variable_amount,shift_period,hospitals(name),shift_types(name)").eq("user_id", feed.user_id);
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const events = (data ?? []).map((item) => {
      const date = item.shift_date.replaceAll("-", "");
      const hospital = Array.isArray(item.hospitals) ? item.hospitals[0]?.name : item.hospitals?.name;
      const kind = Array.isArray(item.shift_types) ? item.shift_types[0]?.name : item.shift_types?.name;
      const period = item.shift_period === "day" ? "☀️ " : item.shift_period === "night" ? "🌙 " : "";
      return [`BEGIN:VEVENT`,`UID:${item.id}@plantoes`,`DTSTAMP:${stamp}`,`DTSTART;VALUE=DATE:${date}`,`SUMMARY:${clean(`${period}${hospital ?? "Hospital"} ${kind ?? "Plantão"}`)}`,`DESCRIPTION:${clean(`Valor previsto: R$ ${Number(item.base_amount) + Number(item.variable_amount)}`)}`,`END:VEVENT`].join("\r\n");
    }).join("\r\n");
    const body = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Meus Plantoes//BR\r\nCALSCALE:GREGORIAN\r\nX-WR-TIMEZONE:America/Sao_Paulo\r\nX-WR-CALNAME:Meus Plantões\r\nREFRESH-INTERVAL;VALUE=DURATION:PT1H\r\nX-PUBLISHED-TTL:PT1H\r\n${events}\r\nEND:VCALENDAR`;
    return new Response(body, { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-cache, no-store, must-revalidate", "content-disposition": "inline; filename=plantoes.ics" } });
  } } },
});
