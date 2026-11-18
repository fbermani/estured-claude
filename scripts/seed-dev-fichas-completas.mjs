/**
 * Seed aditivo e idempotente SOLO PARA DESARROLLO (estured-dev): deja que TODA residencia pública (`verified_active`) muestre en su
 * ficha todas las secciones con contenido, para revisar estructura y diseño. NO va a producción (ahí los datos los carga cada residencia).
 *
 * Reglas: solo completa HUECOS. Nunca sobrescribe un dato existente, nunca borra filas y nunca toca fotos ni archivos (las residencias sin
 * fotos quedan sin fotos). Sin PDF de reglamento. Los textos son genéricos y no afirman cosas verificables fuera de lo que ya figura.
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
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
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

// ------------------------------------------------------------------- lectura
const { data: residences, error: resErr } = await admin.from("residences").select("*").eq("status", "verified_active").order("slug", { ascending: true });
if (resErr) fail("no se pudieron leer las residencias:", resErr);
const { data: catalog, error: catErr } = await admin.from("residence_faq_predefined_questions").select("id, owner, suggested_answer, is_active").eq("is_active", true);
if (catErr || !catalog?.length) fail("el catálogo de FAQ no está disponible (migración 0054):", catErr);
const catalogById = new Map(catalog.map((q) => [q.id, q]));
const { error: probe } = await admin.from("residence_faq_items").select("is_featured, featured_order").limit(1);
if (probe) fail("falta la migración 0096 (FAQ destacadas) en estured-dev:", probe);

const stats = { residences: residences.length, residenceUpdates: 0, rooms: 0, rules: 0, community: 0, faqItems: 0, faqFeatured: 0, faqFree: 0 };
const table = [];

for (const [i, r] of residences.entries()) {
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
  row.deposito = eff.deposit_usd != null ? usd(eff.deposit_usd) : eff.deposit_mode ?? "—";
  row.matricula = eff.enrollment_fee_mode ? (eff.enrollment_fee_mode === "one_month" ? "1 mes" : usd(eff.enrollment_fee_usd)) : "—";
  row.mesVacio = Number(eff.empty_month_charge_percent) > 0 ? `${Number(eff.empty_month_charge_percent)}%` : "—";
  row.edad = `${eff.min_resident_age ?? 18}${eff.max_resident_age ? `-${eff.max_resident_age}` : "+"}`;
  row.estaticas = staticFaq + (freeCount ?? 0);
  table.push(row);
}

console.table(table);
console.log(DRY ? "DRY RUN (no se escribió nada):" : "Listo:", stats);
if (!DRY) console.log("Mirá cualquier /residencias/<slug> (capítulos 01 a 07).");
