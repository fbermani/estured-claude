/**
 * Crea (o promueve) un usuario admin de EstuRed.
 *
 * Uso:
 *   node --env-file=.env.local scripts/create-admin.mjs <email> <password>
 *
 * - Crea el usuario en Supabase Auth pre-confirmado (si no existe).
 * - Crea la fila en public.users con primary_role=admin.
 * - Asigna el rol admin en user_roles.
 * - Audita el alta (source: admin).
 *
 * Los roles admin viven en user_roles — no existe tabla admin_users
 * (docs/06 §5.1, nota de alcance).
 */
import { createClient } from "@supabase/supabase-js";

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Uso: node --env-file=.env.local scripts/create-admin.mjs <email> <password>");
  process.exit(1);
}
if (password.length < 12) {
  console.error("La contraseña de un admin debe tener al menos 12 caracteres.");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (correr con --env-file=.env.local).");
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});

const { data: created, error: createError } =
  await admin.auth.admin.createUser({ email, password, email_confirm: true });

let userId = created?.user?.id;
if (createError) {
  if (createError.code === "email_exists") {
    const { data: byEmail } = await admin
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    userId = byEmail?.id;
    if (!userId) {
      console.error("El email existe en Auth pero no en public.users — revisar manualmente.");
      process.exit(1);
    }
    console.log("El usuario ya existía; se promueve a admin.");
  } else {
    console.error("Error creando usuario:", createError.message);
    process.exit(1);
  }
}

const { error: userError } = await admin.from("users").upsert({
  id: userId,
  email: email.toLowerCase(),
  primary_role: "admin",
});
if (userError) {
  console.error("Error en public.users:", userError.message);
  process.exit(1);
}

const { error: roleError } = await admin.from("user_roles").upsert(
  { user_id: userId, role: "admin", scope_type: "global", scope_id: null },
  { onConflict: "user_id,role,scope_type,scope_id" },
);
if (roleError && roleError.code !== "23505") {
  console.error("Error en user_roles:", roleError.message);
  process.exit(1);
}

await admin.from("audit_logs").insert({
  actor_user_id: null,
  actor_role: "system",
  action: "admin_user_created",
  entity_type: "users",
  entity_id: userId,
  is_system_action: true,
  source: "admin",
  new_value: { email: email.toLowerCase(), role: "admin" },
});

console.log(`✓ Admin listo: ${email} (${userId})`);
console.log("  Ya puede entrar en /login → redirige a /admin/dashboard.");
