// Borra usuarios de prueba (test-, audit- @estured.test) creados desde <ISO>. Solo dev. Uso: node --env-file=.env.local e2e/tools/cleanup-test-users.mjs <ISO> [--apply]
import "../../scripts/_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";
const since = process.argv[2]; const apply = process.argv.includes("--apply");
if (!since) { console.error("Falta ISO"); process.exit(1); }
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: us } = await a.from("users").select("id,email").gte("created_at", since).or("email.like.test-%@estured.test,email.like.audit-%@estured.test");
console.log("usuarios de prueba:", us?.length);
if (!apply) process.exit(0);
let ok = 0, fail = 0;
for (const u of us ?? []) { const { error } = await a.auth.admin.deleteUser(u.id); if (error) { fail++; console.error(u.email, error.message); } else ok++; }
console.log({ ok, fail });
