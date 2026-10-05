import { createServerFn } from "@tanstack/react-start";

export const ensureInitialUser = createServerFn({ method: "POST" }).handler(async () => {
  const password = process.env["INITIAL_USER_PASSWORD"];
  if (!password) throw new Error("A senha inicial não está configurada.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = "eduardo@plantoes.local";
  const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 });
  const existing = data.users.find((user) => user.email === email);
  if (!existing) {
    const { error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
  }
  return { ok: true };
});

export const ensureFelipeUser = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = "felipe@plantoes.local";
  const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 });
  const existing = data.users.find((user) => user.email === email);
  if (existing) return { ok: true, existed: true };
  const { error } = await supabaseAdmin.auth.admin.createUser({ email, password: "1234", email_confirm: true });
  if (error) throw new Error(error.message);
  return { ok: true, existed: false };
});
