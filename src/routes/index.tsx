import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type FormEvent } from "react";
import { CalendarDays, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ensureAtilioUser, ensureBernardoUser, ensureInitialUser } from "@/lib/auth.functions";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Meus Plantões — Acesso" },
    { name: "description", content: "Acesse sua agenda de plantões e acompanhe seus recebimentos mensais." },
    { property: "og:title", content: "Meus Plantões" },
    { property: "og:description", content: "Agenda médica e controle financeiro em um só lugar." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ]}),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const setup = useServerFn(ensureInitialUser);
  const setupAtilio = useServerFn(ensureAtilioUser);
  const setupBernardo = useServerFn(ensureBernardoUser);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);
  useEffect(() => { void supabase.auth.getSession().then(({ data }) => { if (data.session) void navigate({ to: "/dashboard", replace: true }); else setChecking(false); }); }, [navigate]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const user = username.trim().toLowerCase();
      if (user !== "eduardo" && user !== "felipe" && user !== "atilio" && user !== "bernardo") throw new Error("Usuário ou senha incorretos.");
      if (user === "eduardo") await setup();
      if (user === "atilio") await setupAtilio();
      if (user === "bernardo") await setupBernardo();
      const result = await supabase.auth.signInWithPassword({ email: `${user}@plantoes.local`, password });
      if (result.error) throw new Error("Usuário ou senha incorretos.");
      await navigate({ to: "/dashboard" });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível entrar."); }
    finally { setBusy(false); }
  }
  if (checking) return <main className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="animate-spin text-muted-foreground" size={20} strokeWidth={1.5} aria-label="Carregando"/></main>;
  return <main className="min-h-screen bg-background lg:grid lg:grid-cols-[1.05fr_0.95fr]">
    <section className="hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
      <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"><CalendarDays size={20} strokeWidth={1.5}/></span><span className="font-display text-2xl font-semibold">Meus Plantões</span></div>
      <div className="max-w-lg"><p className="mb-5 text-xs font-medium uppercase text-sidebar-muted">Organização sem ruído</p><h1 className="font-display text-5xl leading-tight">Sua escala e seus recebimentos, com clareza.</h1><p className="mt-6 max-w-md text-base leading-7 text-sidebar-muted">Acompanhe cada plantão, visualize o calendário e saiba exatamente o que receberá a cada mês.</p></div>
      <p className="text-xs text-sidebar-muted">Agenda médica pessoal</p>
    </section>
    <section className="flex min-h-screen items-center justify-center px-3 py-8 sm:px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex items-center gap-3 lg:hidden"><span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground"><CalendarDays size={20} strokeWidth={1.5}/></span><span className="font-display text-xl font-semibold">Meus Plantões</span></div>
        <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Área privada</p><h2 className="font-display text-3xl font-semibold">Bem-vindo de volta</h2><p className="mt-2 text-sm text-muted-foreground">Entre para acessar sua agenda.</p>
        <form className="mt-8 space-y-5" onSubmit={submit}>
          <div className="space-y-2"><Label htmlFor="username">Usuário</Label><Input id="username" value={username} onChange={(e)=>setUsername(e.target.value)} autoComplete="username" required /></div>
          <div className="space-y-2"><Label htmlFor="password">Senha</Label><div className="relative"><Input id="password" type={show?"text":"password"} value={password} onChange={(e)=>setPassword(e.target.value)} autoComplete="current-password" required className="pr-11"/><Button type="button" variant="ghost" size="icon" aria-label={show?"Ocultar senha":"Mostrar senha"} className="absolute right-0 top-0" onClick={()=>setShow(!show)}>{show?<EyeOff strokeWidth={1.5}/>:<Eye strokeWidth={1.5}/>}</Button></div></div>
          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
          <Button className="h-11 w-full" disabled={busy}>{busy&&<Loader2 className="animate-spin" strokeWidth={1.5}/>}Entrar</Button>
        </form>
      </div>
    </section>
  </main>;
}
