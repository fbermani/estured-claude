/**
 * Seed de la PREAPERTURA para estured-dev (docs/23_PREAPERTURA.md): deja datos para ver cada pantalla con cosas reales.
 *   - Estudiantes 18+ con la comunidad pública tildada: 3 por defecto (el carrusel muestra reales + ejemplos rotulados) u 8 con `--many`
 *     (con 5 o más los ejemplos se apagan; con 12 desaparecen del todo). Países/provincias, carreras de la lista cerrada, hábitos e intereses variados.
 *   - 3 estudiantes SIN consentimiento de comunidad (no aparecen en el carrusel) y 1 con el perfil incompleto (Mi lugar invita a completar).
 *   - 1 menor invitado (16) con su familiar vinculado (invitación canjeada, vínculo pendiente de aprobación): para ver Mi lugar del familiar.
 *   - 2 solicitudes de residencia (estado «recibida»): suman al cupo de fundadoras (se suman a lo que ya haya en la base).
 *
 * Uso (siempre contra estured-dev; se niega a correr contra producción):
 *   node --env-file=.env.local scripts/seed-preapertura-dev.mjs            # SIMULACIÓN: dice qué haría, no escribe nada
 *   node --env-file=.env.local scripts/seed-preapertura-dev.mjs --apply    # crea lo que falte (idempotente: no duplica)
 *   node --env-file=.env.local scripts/seed-preapertura-dev.mjs --apply --many   # 8 estudiantes con comunidad en vez de 3
 *   node --env-file=.env.local scripts/seed-preapertura-dev.mjs --borrar [--apply]   # borra TODO lo de preapertura de prueba (simulación sin --apply)
 *
 * Identificables: mails `seed-preap-*@estured.test` (este seed) y `test-preap-*@estured.test` (cuentas autogeneradas al enviar vacío el
 * registro en desarrollo). `--borrar` también limpia las solicitudes `seed-preap-*`, `test-fund-*` y `test-resi-*` de residencias.
 * CONTRASEÑA DE DEV de todas las cuentas del seed: la constante DEV_PASSWORD de abajo (solo estured-dev; no existe en producción).
 *
 * REQUIERE la migración 0080 aplicada en estured-dev.
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const DEV_PASSWORD = "Preap-Dev-2026-Aa1!";
const SEED_PREFIX = "seed-preap-";
const DOMAIN = "estured.test";
const CONSENT_VERSION = "v0.1-borrador-preapertura";

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const MANY = args.has("--many");
const DELETE = args.has("--borrar");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });
const log = (...a) => console.log(APPLY ? "" : "[simulación]", ...a);

const probe = await admin.from("preapertura_estudiantes").select("id", { head: true, count: "exact" });
if (probe.error) {
  console.error(`✗ La tabla preapertura_estudiantes no existe (${probe.error.code}). Aplicá antes db/migrations/0080_preapertura.sql en el SQL Editor de estured-dev.`);
  process.exit(1);
}

// ---------------------------------------------------------------------------------------------------------------- borrar
async function listUsersByPrefix(prefixes) {
  const out = [];
  for (let page = 1; page < 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    out.push(...data.users.filter((u) => prefixes.some((p) => (u.email ?? "").startsWith(p) && (u.email ?? "").endsWith(`@${DOMAIN}`))));
    if (data.users.length < 1000) break;
  }
  return out;
}

if (DELETE) {
  const users = await listUsersByPrefix([SEED_PREFIX, "test-preap-"]);
  // Los estudiantes primero: el vínculo familiar referencia al familiar sin cascada.
  users.sort((a, b) => Number(/fam/.test(a.email)) - Number(/fam/.test(b.email)));
  const { data: reqs } = await admin.from("residence_signup_requests").select("id, email").or("email.like.seed-preap-%,email.like.test-fund-%,email.like.test-resi-%");
  log(`Borraría ${users.length} cuentas (${SEED_PREFIX}* y test-preap-*) y ${reqs?.length ?? 0} solicitudes de residencia de prueba.`);
  if (APPLY) {
    for (const u of users) {
      const { error } = await admin.auth.admin.deleteUser(u.id);
      console.log(error ? `✗ ${u.email}: ${error.message}` : `borrada ${u.email}`);
    }
    if (reqs?.length) await admin.from("residence_signup_requests").delete().in("id", reqs.map((r) => r.id));
    console.log("✓ Listo.");
  }
  process.exit(0);
}

// ---------------------------------------------------------------------------------------------------------------- datos
const adult = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const ageOf = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  const now = new Date();
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d)) age -= 1;
  return age;
};

// Listas cerradas de lib/preapertura/options.ts (si cambian allá, ajustar acá).
const COMMUNITY = [
  { tag: "lucia", first_name: "Lucía", birth: adult(2005, 3, 10), country: "Uruguay", province: null, university: "UBA", career: "Medicina", habits: ["Madrugo", "Estudio en silencio"], interests: ["Lectura", "Cine"], entry_month: 3, room_type: "individual" },
  { tag: "joaquin", first_name: "Joaquín", birth: adult(2004, 8, 22), country: "Argentina", province: "Salta", university: "UTN", career: "Ingeniería en Sistemas", habits: ["Hago deporte", "Me acuesto tarde"], interests: ["Deportes", "Gaming"], entry_month: 3, room_type: "shared" },
  { tag: "valeria", first_name: "Valeria", birth: adult(2003, 1, 15), country: "Perú", province: null, university: "UADE", career: "Arquitectura", habits: ["Me gusta cocinar", "Orden ante todo"], interests: ["Arte", "Fotografía"], entry_month: 2, room_type: "any" },
  { tag: "tomas", first_name: "Tomás", birth: adult(2006, 11, 5), country: "Paraguay", province: null, university: "UCA", career: "Derecho", habits: ["Prefiero la calma", "No fumo"], interests: ["Viajes", "Idiomas"], entry_month: 4, room_type: "individual" },
  { tag: "agustina", first_name: "Agustina", birth: adult(2002, 6, 30), country: "Argentina", province: "Córdoba", university: "Universidad de Belgrano", career: "Psicología", habits: ["Muy sociable", "Música para estudiar"], interests: ["Series", "Música"], entry_month: 3, room_type: "shared" },
  { tag: "mateo", first_name: "Mateo", birth: adult(2005, 9, 18), country: "Chile", province: null, university: "UBA", career: "Economía", habits: ["Trabajo y estudio", "Madrugo"], interests: ["Tecnología", "Emprendimiento"], entry_month: 1, room_type: "individual" },
  { tag: "camila", first_name: "Camila", birth: adult(2004, 4, 2), country: "Colombia", province: null, university: "Universidad de Palermo", career: "Diseño Gráfico", habits: ["Me acuesto tarde", "Música para estudiar"], interests: ["Arte", "Naturaleza"], entry_month: 3, room_type: "any" },
  { tag: "bruno", first_name: "Bruno", birth: adult(2001, 12, 12), country: "Argentina", province: "Mendoza", university: "Universidad Austral", career: "Medicina", habits: ["Estudio en silencio", "No fumo"], interests: ["Lectura", "Naturaleza"], entry_month: 4, room_type: "shared" },
];
const NO_CONSENT = [
  { tag: "sin-1", first_name: "Nadia", birth: adult(2003, 5, 9), country: "Bolivia", province: null, university: "UBA", career: "Derecho", habits: ["Madrugo", "No fumo"], interests: ["Cine", "Series"], entry_month: 3, room_type: "individual" },
  { tag: "sin-2", first_name: "Ramiro", birth: adult(2004, 2, 27), country: "Argentina", province: "Tucumán", university: "UTN", career: "Ingeniería en Sistemas", habits: ["Hago deporte", "Muy sociable"], interests: ["Deportes", "Música"], entry_month: 2, room_type: "any" },
  { tag: "sin-3", first_name: "Sofía", birth: adult(2005, 7, 14), country: "Ecuador", province: null, university: "UCA", career: "Psicología", habits: ["Prefiero la calma", "Orden ante todo"], interests: ["Lectura", "Idiomas"], entry_month: 4, room_type: "shared" },
];
const INCOMPLETE = { tag: "incompleto", birth: adult(2002, 10, 3) };
const MINOR = { tag: "menor", first_name: "Valentín", birth: adult(new Date().getUTCFullYear() - 16, 5, 20), country: "Paraguay", university: "UBA", career: "Arquitectura", habits: ["Madrugo", "No fumo"], interests: ["Cine", "Música"], entry_month: 3, room_type: "individual" };

const emailOf = (tag) => `${SEED_PREFIX}${tag}@${DOMAIN}`;
const reals = MANY ? COMMUNITY : COMMUNITY.slice(0, 3);

// -------------------------------------------------------------------------------------------------------------- helpers
async function existingUserId(email) {
  const { data } = await admin.from("users").select("id").eq("email", email).maybeSingle();
  return data?.id ?? null;
}

async function createAuth(email) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: DEV_PASSWORD, email_confirm: true });
  if (error) throw new Error(`${email}: ${error.message}`);
  return data.user.id;
}

/** Mismo alta que `createStudentAccount` (lib/preapertura/accounts.ts): auth + users + rol + perfil + visibilidad + consentimientos + preapertura. */
async function createStudent(spec, { consentComunidad, minor = false, invitedBy = null, createdAt = null }) {
  const email = emailOf(spec.tag);
  if (await existingUserId(email)) return { skipped: true, email };
  const id = await createAuth(email);
  const age = ageOf(spec.birth);
  const must = async (q) => {
    const { error } = await q;
    if (error) throw new Error(`${email}: ${error.message}`);
  };
  await must(admin.from("users").insert({ id, email, primary_role: "student" }));
  await must(admin.from("user_roles").insert({ user_id: id, role: "student", scope_type: "global" }));
  const { data: profile, error: pe } = await admin
    .from("student_profiles")
    .insert({ user_id: id, first_name: spec.first_name ?? "", last_name: "", last_initial: "", birth_date: spec.birth, display_age: age, nationality: null, origin_city: null, study_institution_private: null, is_minor: minor })
    .select("id")
    .single();
  if (pe) throw new Error(`${email}: ${pe.message}`);
  await must(admin.from("student_visibility_settings").insert({ student_profile_id: profile.id, is_individual_profile_visible: false }));
  const base = { user_id: id, version: CONSENT_VERSION, ip_address: null, user_agent: "seed-preapertura-dev" };
  const consents = [
    { ...base, consent_type: "terms", metadata: { source: "seed" } },
    { ...base, consent_type: "privacy", metadata: { source: "seed" } },
  ];
  if (!minor) consents.push({ ...base, consent_type: "search_visibility_to_verified_residences", metadata: { source: "seed", bundled_with_terms: true } });
  await must(admin.from("consents").insert(consents));
  const year = new Date().getUTCFullYear() + 1;
  const profileCols = spec.country
    ? {
        first_name: spec.first_name, country: spec.country, province: spec.province ?? null, university: spec.university, career: spec.career,
        entry_month: spec.entry_month, entry_year: year, entry_unsure: false, room_type: spec.room_type, habits: spec.habits, interests: spec.interests,
      }
    : {};
  await must(
    admin.from("preapertura_estudiantes").insert({
      user_id: id, role: "student", birth_date: spec.birth, consent_c: !minor, consent_comunidad: consentComunidad, invited_by_user_id: invitedBy,
      ...profileCols, ...(createdAt ? { created_at: createdAt } : {}),
    }),
  );
  return { id, profileId: profile.id, email };
}

async function createFamily(tag) {
  const email = emailOf(tag);
  const found = await existingUserId(email);
  if (found) return { skipped: true, id: found, email };
  const id = await createAuth(email);
  const must = async (q) => {
    const { error } = await q;
    if (error) throw new Error(`${email}: ${error.message}`);
  };
  await must(admin.from("users").insert({ id, email, primary_role: "family_member" }));
  await must(admin.from("user_roles").insert({ user_id: id, role: "family_member", scope_type: "global" }));
  const { data: member, error } = await admin.from("family_members").insert({ user_id: id, first_name: "", last_name: "", relationship_type: "familiar", phone: null }).select("id").single();
  if (error) throw new Error(`${email}: ${error.message}`);
  const base = { user_id: id, version: CONSENT_VERSION, ip_address: null, user_agent: "seed-preapertura-dev" };
  await must(admin.from("consents").insert([{ ...base, consent_type: "terms", metadata: { source: "seed" } }, { ...base, consent_type: "privacy", metadata: { source: "seed" } }]));
  await must(admin.from("preapertura_estudiantes").insert({ user_id: id, role: "family", consent_c: false, consent_comunidad: false }));
  return { id, memberId: member.id, email };
}

// ------------------------------------------------------------------------------------------------------------------ plan
log(`Plan: ${reals.length} estudiantes con comunidad${MANY ? " (--many)" : ""}, ${NO_CONSENT.length} sin consentimiento, 1 incompleto, 1 menor invitado + familiar, 2 solicitudes de residencia.`);
if (!APPLY) {
  for (const s of reals) log(`  comunidad: ${emailOf(s.tag)} (${s.first_name}, ${s.country}${s.province ? `, ${s.province}` : ""}, ${s.career})`);
  for (const s of NO_CONSENT) log(`  sin consentimiento: ${emailOf(s.tag)}`);
  log(`  incompleto: ${emailOf(INCOMPLETE.tag)}`);
  log(`  menor invitado: ${emailOf(MINOR.tag)} + familiar ${emailOf("familiar")}`);
  log(`  solicitudes: ${emailOf("residencia-1")}, ${emailOf("residencia-2")}`);
  log("Nada se escribió. Agregá --apply para crear lo que falte.");
  process.exit(0);
}

let created = 0;
let skipped = 0;
const tally = (r) => (r.skipped ? skipped++ : created++);
let n = 0;
const stagger = () => new Date(Date.now() - (30 - n++) * 3_600_000).toISOString(); // alta escalonada: el #N de cada uno es distinto

for (const s of reals) tally(await createStudent(s, { consentComunidad: true, createdAt: stagger() }));
for (const s of NO_CONSENT) tally(await createStudent(s, { consentComunidad: false, createdAt: stagger() }));
tally(await createStudent(INCOMPLETE, { consentComunidad: false, createdAt: stagger() }));

// Menor invitado + familiar: invitación canjeada y vínculo pendiente de aprobación (como el flujo real).
const family = await createFamily("familiar");
tally(family);
const minor = await createStudent(MINOR, { consentComunidad: false, minor: true, invitedBy: family.id, createdAt: stagger() });
tally(minor);
if (!minor.skipped && !family.skipped) {
  const { createHash, randomBytes } = await import("node:crypto");
  const hash = createHash("sha256").update(randomBytes(16)).digest("hex");
  const inv = await admin.from("preapertura_invitaciones").insert({ inviter_user_id: family.id, invitee_email: minor.email, token_hash: hash, redeemed_at: new Date().toISOString(), redeemed_by_user_id: minor.id });
  if (inv.error) throw new Error(`invitación: ${inv.error.message}`);
  const link = await admin.from("family_links").insert({ student_profile_id: minor.profileId, family_member_id: family.memberId, status: "pending_student_approval", requested_by_user_id: family.id });
  if (link.error) throw new Error(`vínculo: ${link.error.message}`);
}

// Solicitudes de residencia (idempotente por el índice único activo de email + nombre: un duplicado = ya estaba).
for (const [i, name] of [["1", "Residencia Seed Palermo"], ["2", "Residencia Seed Caballito"]]) {
  const { error } = await admin.from("residence_signup_requests").insert({
    residence_name: name, address: i === "1" ? "Av. Santa Fe 3200, CABA" : "Av. Rivadavia 5100, CABA", contact_name: `Responsable Seed ${i}`,
    email: emailOf(`residencia-${i}`), phone: `+54 9 11 5555 010${i}`, source: "web",
  });
  if (error && error.code === "23505") skipped++;
  else if (error) throw new Error(`solicitud ${i}: ${error.message}`);
  else created++;
}

console.log(`✓ Listo: ${created} creados, ${skipped} ya existían. Contraseña de dev de las cuentas: ver DEV_PASSWORD en este script. Para limpiar: --borrar --apply.`);
