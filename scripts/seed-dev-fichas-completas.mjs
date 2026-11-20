/**
 * Seed aditivo e idempotente SOLO PARA DESARROLLO (estured-dev): deja que TODA residencia pública (`verified_active`) muestre en su
 * ficha todas las secciones con contenido, para revisar estructura y diseño. NO va a producción (ahí los datos los carga cada residencia).
 *
 * Reglas: solo completa HUECOS. Nunca sobrescribe un dato existente y nunca borra filas. Los textos son genéricos y no afirman cosas
 * verificables fuera de lo que ya figura. Sin PDF de reglamento.
 *
 * Requisitos para enviar a revisión (DR59, sección 5): deja cada residencia publicada cumpliendo los 9 (datos básicos, servicios y áreas,
 * una regla, reglamento publicado, 3 preguntas esenciales listas, 2 universidades, un tipo de habitación, 3 fotos propias y condiciones).
 * Las FOTOS se completan solo con `--with-photos` (opt-in), copiando objetos de Storage de otra residencia demo que ya tiene (no hay
 * fotos propias de las demo; el dueño ya limpió una vez fotos «prestadas», por eso no se copian por defecto: sin la bandera las demo sin
 * 3 fotos figuran como «falta» en la tabla).
 * No cambia estados: para probar el rechazo del envío usá una residencia en borrador sin completar. `--dry-run` imprime los 9
 * requisitos por residencia (con lo que se completaría).
 *
 * Qué completa (cada parte salta lo que ya tiene):
 *   - Condiciones: estadía mínima (si falta), matrícula / depósito por modo / ninguno (el depósito y la matrícula son excluyentes por
 *     CHECK en la base: `residences_deposit_xor_enrollment`), % de mes vacío distinto y a veces sin, tope de edad en algunas.
 *   - Habitaciones físicas (`rooms`): 2 por tipo en las residencias que no tienen ninguna (alimenta la bajada «N plazas»).
 *   - Reglas de casa estructuradas (`rules.items`, de 2 a 6) + su `summary` derivado.
 *   - Declaración de la comunidad (`community_statement.quote`).
 *   - FAQ del catálogo (`residence_faq_items`): las «EstuRed fija» sin editar y las de la residencia con respuestas armadas SOLO con datos
 *     que la residencia ya tiene cargados (estadía mínima, depósito, matrícula, tipos, servicios, reglas). Con y sin destacadas, y una
 *     pregunta libre respondida en algunas.
 *
 * El reparto es determinístico: por posición del slug (orden alfabético) entre las residencias publicadas.
 * Requiere las migraciones 0096 (FAQ destacadas) y las del catálogo (0054). Uso:
 *   node --env-file=.env.local scripts/seed-dev-fichas-completas.mjs            (aplica)
 *   node --env-file=.env.local scripts/seed-dev-fichas-completas.mjs --dry-run  (solo muestra el plan)
 *   node --env-file=.env.local scripts/seed-dev-fichas-completas.mjs --with-photos  (además copia fotos para llegar a 3, solo dev)
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomUUID } from "node:crypto";

const DRY = process.argv.includes("--dry-run");
/** Copiar fotos de otra residencia demo a las que no tienen 3 (opt-in: el dueño ya limpió fotos «prestadas» una vez, ver clean-reused-sin-fronteras-photos.mjs). */
const WITH_PHOTOS = process.argv.includes("--with-photos");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });
const fail = (msg, err) => {
  console.error("✗", msg, err?.message ?? "");
  process.exit(1);
};

// ---------------------------------------------------------------- contenido
/** Reglas de casa (formato de `lib/residences/ruleItems.ts`: lead ≤ 12, title ≤ 40, detail ≤ 120). `faq` = pregunta del catálogo coherente. */
const RULES = [
  { lead: "23 a 7", title: "Silencio", detail: "Para música o videos, auriculares", faq: "FAQ-26", faqAnswer: "Se guarda silencio de 23 a 7 h. Para música o videos, usá auriculares." },
  { lead: "7 a 23", title: "Cocina abierta", detail: "Cada uno lava y guarda lo que usa" },
  { lead: "Libre", title: "Entrada y salida", detail: "Con tu llave, sin horario de llegada" },
  { lead: "No", title: "Mascotas", detail: "Por convivencia en espacios compartidos", faq: "FAQ-28", faqAnswer: "No, la residencia no admite mascotas por la convivencia en los espacios compartidos." },
  { lead: "Hasta 22", title: "Visitas", detail: "Se anuncian en recepción y no pasan la noche", faq: "FAQ-33", faqAnswer: "Sí, hasta las 22 h y avisando en recepción. Las visitas no pasan la noche." },
  { lead: "No", title: "Fumar", detail: "Ni dentro de la casa ni en los espacios comunes", faq: "FAQ-27", faqAnswer: "No se fuma dentro de la casa ni en los espacios comunes." },
  { lead: "Semanal", title: "Limpieza común", detail: "Turnos rotativos para cocina y baños compartidos" },
  { lead: "Aviso", title: "Ausencias largas", detail: "Avisá a la administración si te ausentás más de una semana" },
];
const rulesCountFor = (i) => [2, 4, 3, 6, 5, 4, 3, 5, 6, 2][i % 10];
const rulesFor = (i) => {
  const n = rulesCountFor(i);
  const start = (i * 3) % RULES.length;
  return Array.from({ length: n }, (_, k) => RULES[(start + k) % RULES.length]);
};
const publicRule = ({ lead, title, detail }) => ({ lead, title, detail });
const toSummary = (items) => items.map((r) => `${r.lead} · ${r.title}: ${r.detail}`).join("\n");

const COMMUNITY_QUOTES = [
  "Una casa tranquila para estudiar y compartir, con respeto por los tiempos de cada uno.",
  "Buscamos estudiantes con ganas de convivir: se comparte la cocina, el mate y los horarios de estudio.",
  "Una comunidad chica donde todos se conocen y la convivencia se cuida entre todos.",
  "Espacios compartidos ordenados, turnos claros y buena onda para que estudiar y descansar convivan.",
  "Recibimos estudiantes de distintas carreras y países: la diversidad es parte de la casa.",
  "Un lugar para rendir, descansar y hacer amigos, con reglas simples que ayudan a convivir.",
];

const DEPOSIT_TEXT = { half_month: "medio mes de renta", one_month: "un mes de renta", two_months: "dos meses de renta" };
const ADJUSTMENT_TEXT = { monthly: "todos los meses", quarterly: "cada 3 meses", semiannual: "cada 6 meses", annual: "una vez por año" };
const usd = (n) => `USD ${Number(n).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;


// ------------------------------------------------- requisitos para enviar (DR59)
const MIN_PHOTOS = 3;
const MIN_ESSENTIALS = 3;
const MIN_UNIVERSITIES = 2;
/** Orden en que se completan las esenciales (todas del catálogo, dueñas = residencia). */
const ESSENTIAL_IDS = ["FAQ-07", "FAQ-33", "FAQ-36", "FAQ-25", "FAQ-15", "FAQ-09"];
const essentialAnswer = (id, services) =>
  ({
    "FAQ-07": services.length > 0
      ? `Incluye: ${services.slice(0, 8).join(", ").toLowerCase()}. Lo que se paga aparte figura en «Qué incluye y qué se paga aparte».`
      : "Incluye lo que figura en «Qué incluye y qué se paga aparte».",
    "FAQ-33": "Sí, las visitas se avisan en recepción y no pasan la noche. Respondés por lo que haga tu invitado.",
    "FAQ-36": "Llevá ropa de cama, toallas y artículos de higiene personal. La residencia te cuenta al ingresar qué provee.",
    "FAQ-25": "No hay toque de queda: podés entrar y salir con tu llave. Respetá el silencio que figura en las reglas de la casa.",
    "FAQ-15": "Se pide ser estudiante: al ingresar te pueden pedir una constancia de alumno regular.",
    "FAQ-09": "Sí, la administración de la residencia acompaña tu ingreso y atiende consultas por el medio de contacto de la ficha.",
  })[id];
const FALLBACK_UNIVERSITIES = ["UBA - Facultad de Derecho", "UBA - Ciudad Universitaria"];
/** Mismo criterio que `normalizeRegulationText` de la app (el hash identifica el texto exacto). */
const normalizeRegulation = (t) =>
  t.replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/\s+$/g, "")).join("\n").replace(/\n{3,}/g, "\n\n").trim();
const regulationText = (name, ruleItems) =>
  [
    `Reglamento de convivencia de ${name}`,
    "",
    "1. Objeto. Este reglamento ordena la convivencia entre residentes y con la administración de la casa.",
    "2. Convivencia. Cada residente cuida los espacios comunes y respeta el descanso y el estudio de los demás.",
    `3. Reglas de la casa. ${ruleItems.length > 0 ? ruleItems.map((x) => x.title).filter(Boolean).join(", ") : "Las que figuran en la ficha"}: se detallan en la ficha de la residencia.`,
    "4. Visitas. Las visitas se avisan a la administración y cada residente responde por sus invitados.",
    "5. Cuidado de la casa. Los daños causados por un residente o sus invitados se resuelven con la administración.",
    "6. Incumplimientos. Ante un incumplimiento, la administración conversa primero con el residente.",
  ].join("\n");
const DESCRIPTION_FALLBACK = (name, zone) => `${name} es una residencia estudiantil en ${zone || "la Ciudad de Buenos Aires"}, con espacios compartidos y reglas simples de convivencia.`;

// ------------------------------------------------------------------- lectura
const { data: residences, error: resErr } = await admin.from("residences").select("*").eq("status", "verified_active").order("slug", { ascending: true });
if (resErr) fail("no se pudieron leer las residencias:", resErr);
const { data: catalog, error: catErr } = await admin.from("residence_faq_predefined_questions").select("id, owner, suggested_answer, is_active").eq("is_active", true);
if (catErr || !catalog?.length) fail("el catálogo de FAQ no está disponible (migración 0054):", catErr);
const catalogById = new Map(catalog.map((q) => [q.id, q]));
const { error: probe } = await admin.from("residence_faq_items").select("is_featured, featured_order").limit(1);
if (probe) fail("falta la migración 0096 (FAQ destacadas) en estured-dev:", probe);

// Fotos donantes (dev): las de la residencia publicada con más fotos aprobadas; sirven de origen para completar a las que no tienen.
const { data: allPhotos } = await admin
  .from("files")
  .select("id, related_entity_id, bucket, storage_path, filename, mime_type, size_bytes, owner_user_id, uploaded_by_user_id, created_at")
  .eq("related_entity_type", "residences")
  .eq("document_type", "residence_photo")
  .eq("status", "approved")
  .order("created_at", { ascending: true });
const photosByResidence = new Map();
for (const f of allPhotos ?? []) photosByResidence.set(f.related_entity_id, [...(photosByResidence.get(f.related_entity_id) ?? []), f]);
const donorPhotos = [...photosByResidence.values()].filter((l) => l.length >= MIN_PHOTOS).sort((a, b) => b.length - a.length)[0] ?? [];

const stats = { residences: residences.length, residenceUpdates: 0, rooms: 0, rules: 0, community: 0, faqItems: 0, faqFeatured: 0, faqFree: 0, basics: 0, amenities: 0, universities: 0, regulations: 0, essentials: 0, photos: 0 };
const table = [];

for (const [i, r] of residences.entries()) {
  // Residuos de tests de integración (se limpian con scripts/cleanup-test-residences.mjs): no se completan. El índice `i` se conserva
  // para que el reparto determinístico de las demás no cambie.
  if (/(^|-)(test|prueba)(-|$)/.test(r.slug)) continue;
  const row = { slug: r.slug };

  // ---- 1. Condiciones (solo columnas vacías) ----
  const patch = {};
  if (r.minimum_stay_months == null) patch.minimum_stay_months = 6;
  const noMoney = r.deposit_usd == null && r.enrollment_fee_mode == null && r.deposit_mode == null;
  if (noMoney) {
    // Depósito y matrícula son excluyentes (CHECK de la base): se reparte depósito por modo, matrícula (un mes / monto) o ninguno.
    // El reparto es explícito por slug (estable entre corridas); un slug nuevo cae en un ciclo por posición.
    const kinds = {
      "casa-aura": "enr_month",
      "casa-rica": "enr_annual",
      "charlies-hostel": "dep_one",
      "inder-residencia": "none",
      "la-casa-de-cris-almagro": "enr_manual",
      "la-casona-recoleta": "dep_two",
      "las-cabanas": "enr_discount",
      "luco-2340": "dep_half",
      "residencia-family-home": "enr_manual_90",
      "wanna-congreso": "enr_month",
      "wanna-tango": "none",
    };
    const cycle = ["enr_month", "enr_manual", "dep_one", "none", "enr_annual", "dep_two", "enr_discount", "dep_half"];
    switch (kinds[r.slug] ?? cycle[i % cycle.length]) {
      case "enr_month": Object.assign(patch, { enrollment_fee_mode: "one_month", enrollment_fee_frequency: "once" }); break;
      case "enr_manual": Object.assign(patch, { enrollment_fee_mode: "manual", enrollment_fee_usd: 120, enrollment_fee_frequency: "once" }); break;
      case "enr_manual_90": Object.assign(patch, { enrollment_fee_mode: "manual", enrollment_fee_usd: 90, enrollment_fee_frequency: "once" }); break;
      case "enr_annual": Object.assign(patch, { enrollment_fee_mode: "manual", enrollment_fee_usd: 60, enrollment_fee_frequency: "annual" }); break;
      case "enr_discount": Object.assign(patch, { enrollment_fee_mode: "one_month", enrollment_fee_frequency: "once", enrollment_discount_percent: 20 }); break;
      case "dep_one": Object.assign(patch, { deposit_mode: "one_month" }); break;
      case "dep_two": Object.assign(patch, { deposit_mode: "two_months" }); break;
      case "dep_half": Object.assign(patch, { deposit_mode: "half_month" }); break;
      default: break; // ni depósito ni matrícula
    }
  }
  if (r.empty_month_charge_percent == null) {
    const pct = [50, null, 100, 25, null, 75, 50, null, 100, null][i % 10];
    if (pct != null) patch.empty_month_charge_percent = pct;
  }
  if (r.max_resident_age == null && (r.min_resident_age ?? 18) <= 25 && i % 3 === 1) patch.max_resident_age = [25, 28, 30, 35][i % 4];
  if (Object.keys(patch).length > 0) {
    if (!DRY) {
      const { error } = await admin.from("residences").update(patch).eq("id", r.id);
      if (error) fail(`condiciones de ${r.slug}:`, error);
    }
    stats.residenceUpdates++;
  }
  const eff = { ...r, ...patch };

  // ---- 2. Habitaciones físicas (solo si no tiene ninguna) ----
  const { data: types } = await admin.from("room_types").select("id, name").eq("residence_id", r.id).eq("is_active", true).order("monthly_price_usd", { ascending: true });
  const { count: roomCount } = await admin.from("rooms").select("id", { count: "exact", head: true }).eq("residence_id", r.id).eq("is_active", true);
  if ((roomCount ?? 0) === 0 && (types?.length ?? 0) > 0) {
    const inserts = types.flatMap((t) => [1, 2].map((n) => ({ residence_id: r.id, room_type_id: t.id, label: `Habitación ${n}`, sort_order: n })));
    if (!DRY) {
      const { error } = await admin.from("rooms").insert(inserts);
      if (error) fail(`habitaciones de ${r.slug}:`, error);
    }
    stats.rooms += inserts.length;
  }

  // ---- 3. Secciones del perfil ----
  const { data: sections } = await admin.from("residence_profile_sections").select("section_type, content").eq("residence_id", r.id);
  const sec = Object.fromEntries((sections ?? []).map((s) => [s.section_type, s.content ?? {}]));
  const upsertSection = async (section_type, content) => {
    if (DRY) return;
    const { error } = await admin.from("residence_profile_sections").upsert({ residence_id: r.id, section_type, content, requires_admin_review: false }, { onConflict: "residence_id,section_type" });
    if (error) fail(`${section_type} de ${r.slug}:`, error);
  };

  // Reglas de casa: solo si no hay `items` ni `summary` (las existentes se respetan, incluida su derivación del resumen).
  let ruleItems = Array.isArray(sec.rules?.items) ? sec.rules.items : [];
  const hasRulesText = ruleItems.length > 0 || (typeof sec.rules?.summary === "string" && sec.rules.summary.trim());
  if (!hasRulesText) {
    const chosen = rulesFor(i);
    ruleItems = chosen;
    await upsertSection("rules", { ...(sec.rules ?? {}), summary: toSummary(chosen), items: chosen.map(publicRule) });
    stats.rules++;
  }
  row.reglas = ruleItems.length > 0 ? ruleItems.length : "resumen";

  // Declaración de la comunidad.
  if (!(typeof sec.community_statement?.quote === "string" && sec.community_statement.quote.trim())) {
    await upsertSection("community_statement", { ...(sec.community_statement ?? {}), quote: COMMUNITY_QUOTES[i % COMMUNITY_QUOTES.length] });
    stats.community++;
  }

  // ---- 4. FAQ del catálogo (solo residencias sin preguntas elegidas) ----
  const { count: selectedCount } = await admin.from("residence_faq_items").select("id", { count: "exact", head: true }).eq("residence_id", r.id).eq("is_selected", true);
  const { count: freeCount } = await admin.from("residence_faq_questions").select("id", { count: "exact", head: true }).eq("residence_id", r.id).eq("status", "answered");
  const staticFaq = Array.isArray(sec.faq?.items) ? sec.faq.items.length : 0;
  if ((selectedCount ?? 0) === 0) {
    const services = (sec.services?.items ?? []).filter((s) => typeof s === "string");
    const minors = eff.accepts_minors === true;
    const answers = {};
    const ruleFaqs = ruleItems.filter((x) => x?.faq).map((x) => ({ id: x.faq, answer: x.faqAnswer }));
    answers["FAQ-40"] = `El tiempo mínimo de estadía es de ${eff.minimum_stay_months} meses.`;
    answers["FAQ-19"] = eff.deposit_usd != null
      ? `Sí, la residencia pide un depósito de garantía de ${usd(eff.deposit_usd)}. Se paga a la residencia y se coordina con ella.`
      : eff.deposit_mode
        ? `Sí, la residencia pide un depósito de garantía equivalente a ${DEPOSIT_TEXT[eff.deposit_mode]}. Se paga a la residencia y se coordina con ella.`
        : "No, esta residencia no pide depósito de garantía.";
    answers["FAQ-12"] = eff.enrollment_fee_mode === "one_month"
      ? "Es un pago de ingreso equivalente a un mes de renta. Se paga a la residencia, no a EstuRed."
      : eff.enrollment_fee_mode === "manual"
        ? `Es un pago de ingreso de ${usd(eff.enrollment_fee_usd)} (${eff.enrollment_fee_frequency === "annual" ? "se renueva una vez por año" : "se paga una sola vez"}). Se paga a la residencia, no a EstuRed.`
        : "Esta residencia no cobra matrícula de ingreso.";
    if ((types?.length ?? 0) > 0) answers["FAQ-05"] = `Hay habitaciones ${types.map((t) => t.name.toLowerCase()).join(", ")}. Mirá los precios y la disponibilidad de cada tipo en «Habitaciones y precio».`;
    if (services.length > 0) answers["FAQ-07"] = `Incluye: ${services.slice(0, 8).join(", ").toLowerCase()}. Lo que se paga aparte figura en «Qué incluye y qué se paga aparte».`;
    answers["FAQ-21"] = ADJUSTMENT_TEXT[eff.adjustment_policy]
      ? `La residencia puede actualizar la tarifa ${ADJUSTMENT_TEXT[eff.adjustment_policy]}.`
      : "La tarifa no se ajusta durante la estadía inicial.";
    answers["FAQ-13"] = minors
      ? "Sí, se aceptan menores de 18 años con un familiar vinculado en EstuRed."
      : "No, esta residencia recibe a personas mayores de 18 años.";
    for (const f of ruleFaqs) answers[f.id] = f.answer;
    // EstuRed fija (sin edición). FAQ-51 solo si la residencia cobra mes vacío.
    const fixed = ["FAQ-02", "FAQ-10", "FAQ-03", "FAQ-16", "FAQ-44", "FAQ-24", "FAQ-17", ...(Number(eff.empty_month_charge_percent) > 0 ? ["FAQ-51"] : [])];
    const ordered = [
      "FAQ-40", "FAQ-02", "FAQ-19", ...ruleFaqs.slice(0, 1).map((f) => f.id), "FAQ-12", "FAQ-05", "FAQ-07", "FAQ-21", "FAQ-10", ...ruleFaqs.slice(1).map((f) => f.id), "FAQ-13", "FAQ-03", "FAQ-16", "FAQ-44",
      ...(Number(eff.empty_month_charge_percent) > 0 ? ["FAQ-51"] : []), "FAQ-24", "FAQ-17",
    ].filter((id, idx, all) => all.indexOf(id) === idx && catalogById.has(id) && (fixed.includes(id) || answers[id]));
    const n = Math.min(ordered.length, [4, 6, 3, 8, 5, 7, 9, 4, 6, 5][i % 10]);
    const rot = i % 3;
    const picks = [...ordered.slice(rot), ...ordered.slice(0, rot)].slice(0, n);
    // Destacadas: 0 = ninguna (la ficha toma las primeras), 1 = las 3 primeras, 2 = hasta 6.
    const featMode = i % 3;
    const featCount = featMode === 0 ? 0 : featMode === 1 ? Math.min(3, n) : Math.min(6, n);
    const items = picks.map((id, k) => ({
      residence_id: r.id,
      predefined_question_id: id,
      is_selected: true,
      answer_override: catalogById.get(id).owner === "residence" ? answers[id] : null,
      is_featured: k < featCount,
      featured_order: k < featCount ? k + 1 : null,
    }));
    if (!DRY) {
      const { error } = await admin.from("residence_faq_items").upsert(items, { onConflict: "residence_id,predefined_question_id", ignoreDuplicates: true });
      if (error) fail(`FAQ de ${r.slug}:`, error);
    }
    stats.faqItems += items.length;
    stats.faqFeatured += featCount;
    row.faq = `${n}${featCount ? ` (${featCount} dest.)` : " (sin dest.)"}`;

    // Una pregunta libre respondida en algunas (aditivo; no duplica por texto).
    if (i % 4 === 1) {
      const question = "¿Puedo traer mi propia ropa de cama?";
      const { data: ex } = await admin.from("residence_faq_questions").select("id").eq("residence_id", r.id).eq("question", question).maybeSingle();
      if (!ex && !DRY) {
        const { error } = await admin.from("residence_faq_questions").insert({
          residence_id: r.id,
          question,
          status: "answered",
          answer: "Sí, podés traer la tuya. Si preferís no hacerlo, consultá con la administración qué opciones hay.",
          answered_at: new Date().toISOString(),
        });
        if (error) fail(`pregunta libre de ${r.slug}:`, error);
        stats.faqFree++;
      }
    }
  } else {
    row.faq = `ya tenía ${selectedCount}`;
  }

  // ---- 5. Requisitos para enviar a revisión (DR59): completa HUECOS hasta cumplir los 9 ----
  const req = {};
  // 5a. Datos básicos: eslogan y descripción (nombre, barrio y dirección se fijan al registrarse: no se inventan).
  const basicsPatch = {};
  if (!(typeof r.tagline === "string" && r.tagline.trim())) basicsPatch.tagline = `Residencia estudiantil en ${r.public_area || "CABA"}`.slice(0, 80);
  if (!(typeof r.description === "string" && r.description.trim().length > 20)) basicsPatch.description = DESCRIPTION_FALLBACK(r.name, r.public_area);
  if (Object.keys(basicsPatch).length > 0) {
    if (!DRY) {
      const { error } = await admin.from("residences").update(basicsPatch).eq("id", r.id);
      if (error) fail(`datos básicos de ${r.slug}:`, error);
    }
    stats.basics++;
  }
  req.basicos = r.name && r.public_area && r.address_line ? "ok" : "falta nombre/barrio/dirección (no se inventa)";

  // 5b. Servicios, áreas comunes y universidades (mínimos: 1, 1 y 2).
  const services0 = (sec.services?.items ?? []).filter((x) => typeof x === "string");
  const areas0 = (sec.common_areas?.items ?? []).filter((x) => typeof x === "string");
  const unis0 = (sec.near_universities?.items ?? []).filter((x) => typeof x === "string");
  if (services0.length === 0) { await upsertSection("services", { ...(sec.services ?? {}), items: ["Wifi"] }); stats.amenities++; }
  if (areas0.length === 0) { await upsertSection("common_areas", { ...(sec.common_areas ?? {}), items: ["Sala de Estar"] }); stats.amenities++; }
  if (unis0.length < MIN_UNIVERSITIES) {
    const merged = [...unis0, ...FALLBACK_UNIVERSITIES.filter((u) => !unis0.includes(u))].slice(0, Math.max(MIN_UNIVERSITIES, unis0.length));
    await upsertSection("near_universities", { ...(sec.near_universities ?? {}), items: merged });
    stats.universities++;
  }
  const services = services0.length > 0 ? services0 : ["Wifi"];
  req.servicios = `${Math.max(1, services0.length)}/${Math.max(1, areas0.length)}`;
  req.reglas = ruleItems.length > 0 || hasRulesText ? "ok" : "falta";
  req.universidades = Math.max(unis0.length, MIN_UNIVERSITIES);

  // 5c. Reglamento: versión publicada propia (o PDF cargado). Se publica con la función atómica de la 0053.
  const { data: pubReg, error: regErr } = await admin.from("residence_regulation_versions").select("id, source, content").eq("residence_id", r.id).eq("status", "published").maybeSingle();
  if (regErr) fail(`reglamento de ${r.slug}: ¿falta la migración 0053?`, regErr);
  const { count: pdfCount } = await admin.from("files").select("id", { count: "exact", head: true }).eq("related_entity_type", "residences").eq("related_entity_id", r.id).eq("document_type", "residence_rules_document").neq("status", "rejected");
  const regOk = (pubReg && !(pubReg.source === "model" && pubReg.content?.base_model === true)) || (pdfCount ?? 0) > 0;
  if (!regOk) {
    // `created_by_user_id` admite null: las demo sin dueño cargado publican igual (el actor solo queda en el historial).
    const { data: ownerRow } = await admin.from("residence_users").select("user_id").eq("residence_id", r.id).eq("role", "owner").eq("is_active", true).limit(1).maybeSingle();
    const text = normalizeRegulation(regulationText(r.name, ruleItems));
    if (!DRY) {
      const { error } = await admin.rpc("publish_residence_regulation", {
        p_residence_id: r.id,
        p_actor_user_id: ownerRow?.user_id ?? null,
        p_source: "own",
        p_model_version: null,
        p_content: { text },
        p_hash: createHash("sha256").update(text, "utf8").digest("hex"),
      });
      if (error) fail(`publicar reglamento de ${r.slug}:`, error);
    }
    stats.regulations++;
  }
  req.reglamento = "ok";

  // 5d. Preguntas esenciales: al menos 3 elegidas y sin campos {…} (todas son de la residencia).
  const { data: essItems } = await admin.from("residence_faq_items").select("id, predefined_question_id, is_selected, answer_override").eq("residence_id", r.id).in("predefined_question_id", ESSENTIAL_IDS);
  const essBy = new Map((essItems ?? []).map((x) => [x.predefined_question_id, x]));
  const essReady = (x) => x?.is_selected === true && typeof x.answer_override === "string" && x.answer_override.trim() && !/[{}]/.test(x.answer_override);
  let ready = ESSENTIAL_IDS.filter((id) => essReady(essBy.get(id))).length;
  for (const id of ESSENTIAL_IDS) {
    if (ready >= MIN_ESSENTIALS) break;
    if (essReady(essBy.get(id)) || !catalogById.has(id)) continue;
    const existing = essBy.get(id);
    const answer = essentialAnswer(id, services);
    if (!DRY) {
      const { error } = existing
        ? await admin.from("residence_faq_items").update({ is_selected: true, answer_override: answer }).eq("id", existing.id)
        : await admin.from("residence_faq_items").insert({ residence_id: r.id, predefined_question_id: id, is_selected: true, answer_override: answer });
      if (error) fail(`pregunta esencial ${id} de ${r.slug}:`, error);
    }
    ready++;
    stats.essentials++;
  }
  req.esenciales = `${Math.min(ready, ESSENTIAL_IDS.length)}`;

  // 5e. Fotos propias (≥3): en dev se copian objetos de otra residencia demo (nunca desde producción: el guard ya lo impide).
  const have = (photosByResidence.get(r.id) ?? []).length;
  const { count: photoCount } = await admin.from("files").select("id", { count: "exact", head: true }).eq("related_entity_type", "residences").eq("related_entity_id", r.id).eq("document_type", "residence_photo").neq("status", "rejected");
  let photos = photoCount ?? have;
  if (WITH_PHOTOS && photos < MIN_PHOTOS && donorPhotos.length > 0 && donorPhotos[0].related_entity_id !== r.id) {
    for (const donor of donorPhotos.slice(0, MIN_PHOTOS - photos)) {
      if (!DRY) {
        const ext = donor.storage_path.split(".").pop();
        const toPath = `${r.id}/${randomUUID()}.${ext}`;
        const { error: copyErr } = await admin.storage.from(donor.bucket).copy(donor.storage_path, toPath);
        if (copyErr) fail(`copiar foto a ${r.slug}:`, copyErr);
        const { error: insErr } = await admin.from("files").insert({
          owner_user_id: donor.owner_user_id,
          related_entity_type: "residences",
          related_entity_id: r.id,
          bucket: donor.bucket,
          storage_path: toPath,
          filename: donor.filename,
          mime_type: donor.mime_type,
          size_bytes: donor.size_bytes,
          visibility: "public",
          document_type: "residence_photo",
          status: "approved",
          uploaded_by_user_id: donor.uploaded_by_user_id,
        });
        if (insErr) fail(`registrar foto de ${r.slug}:`, insErr);
      }
      photos++;
      stats.photos++;
    }
  }
  req.fotos = photos >= MIN_PHOTOS ? photos : `falta (${photos} de ${MIN_PHOTOS}; usá --with-photos)`;
  req.habitaciones = (types?.length ?? 0) > 0 ? "ok" : "falta";
  // Condiciones: lo que este seed carga (estadía mínima, matrícula XOR depósito, mes vacío) siempre cumple la regla 9.
  req.condiciones = eff.deposit_usd != null && eff.enrollment_fee_mode != null ? "matrícula Y depósito" : "ok";
  row.requisitos = req;
  row.deposito = eff.deposit_usd != null ? usd(eff.deposit_usd) : eff.deposit_mode ?? "—";
  row.matricula = eff.enrollment_fee_mode ? (eff.enrollment_fee_mode === "one_month" ? "1 mes" : usd(eff.enrollment_fee_usd)) : "—";
  row.mesVacio = Number(eff.empty_month_charge_percent) > 0 ? `${Number(eff.empty_month_charge_percent)}%` : "—";
  row.edad = `${eff.min_resident_age ?? 18}${eff.max_resident_age ? `-${eff.max_resident_age}` : "+"}`;
  row.estaticas = staticFaq + (freeCount ?? 0);
  table.push(row);
}

console.table(table.map(({ requisitos, ...rest }) => ({ ...rest, ...Object.fromEntries(Object.entries(requisitos ?? {}).map(([k, v]) => [`req.${k}`, v])) })));
const unmet = table.filter((t) => Object.values(t.requisitos ?? {}).some((v) => typeof v === "string" && (v.startsWith("falta") || v.includes(" Y "))));
if (unmet.length > 0) console.log("Residencias que seguirían sin cumplir algún requisito:", unmet.map((t) => t.slug).join(", "));

// ---- 6. Para probar el rechazo del envío (DR59) usá una residencia en borrador sin completar (p. ej. residencia-prueba-dr22-f307f4). Este seed no cambia estados. ----
console.log(DRY ? "DRY RUN (no se escribió nada):" : "Listo:", stats);
if (!DRY) console.log("Mirá cualquier /residencias/<slug> (capítulos 01 a 07).");
