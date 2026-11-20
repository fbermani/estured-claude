/**
 * Seed aditivo e idempotente: 10 residencias demo para probar /search (barrios, género, precios, promoción,
 * menores, disponibilidad). No borra ni recrea filas existentes (no cambia ningún UUID): upsert por slug,
 * tipos por (residencia, nombre), secciones por (residencia, tipo). Sin fotos: se ve el placeholder de marca con el barrio.
 * Las direcciones y coordenadas son aproximadas por barrio (ficticias).
 *
 * Uso: node --env-file=.env.local scripts/seed-demo-search-residences.mjs   (solo estured-dev)
 */
import "./_assert-dev-project.mjs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan env vars. Correr con --env-file=.env.local");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });
const must = (r, ctx) => {
  if (r.error) throw new Error(`${ctx}: ${r.error.message}`);
  return r.data;
};

const base = must(await admin.from("residences").select("created_by").eq("slug", "residencia-norte-demo").single(), "residencia base");
const ownerId = base.created_by;
const rateRow = (await admin.from("exchange_rates").select("official_exchange_rate_ars_per_usd").order("rate_date", { ascending: false }).limit(1)).data?.[0];
const rate = Number(rateRow?.official_exchange_rate_ars_per_usd ?? 1480);

// status de disponibilidad por tipo: [estado, plazas libres]
const AV = (n) => ["available_to_confirm", n];
const FULL = ["full", 0];
const STALE = ["not_updated", null];

const RESIDENCES = [
  { slug: "residencia-palermo-soho-demo", name: "Residencia Palermo Soho", area: "Palermo", lat: -34.5889, lng: -58.4306, addr: "Honduras 4800, Palermo (demo)", tagline: "Entre cafés y plazas",
    gender: "mixto", unis: ["UBA - Facultad de Derecho", "Universidad de Palermo (UP)"], services: ["Wifi", "Cocina", "Lavandería", "Limpieza General"], areas: ["Terraza", "Sala de Estudio"],
    ages: [18, 30, false], promo: [10, null],
    types: [["Individual", 1, 520, "privado", AV(2)], ["Doble", 2, 390, "compartido", AV(3)], ["Triple", 3, 310, "compartido", AV(1)]] },
  { slug: "residencia-recoleta-plaza-demo", name: "Residencia Recoleta Plaza", area: "Recoleta", lat: -34.5875, lng: -58.3974, addr: "Junín 1200, Recoleta (demo)", tagline: "Tranquila, a metros de Medicina",
    gender: "solo_mujeres", unis: ["UBA - Facultad de Medicina", "Universidad Católica Argentina (UCA)"], services: ["Wifi", "Cámaras 24 hs", "Área Protegida", "Limpieza de Habitación", "Coordinador Presencial"], areas: ["Sala de Estar", "Comedor", "Patio"],
    ages: [18, 28, false], promo: null,
    types: [["Individual", 1, 600, "privado", AV(1)], ["Doble", 2, 450, "compartido", FULL]] },
  { slug: "casa-almagro-estudiantes-demo", name: "Casa Almagro Estudiantes", area: "Almagro", lat: -34.6097, lng: -58.4192, addr: "Yatay 340, Almagro (demo)", tagline: "Casa de barrio con patio",
    gender: "solo_hombres", unis: ["Universidad Tecnológica Nacional (UTN - FRBA)", "UBA - Facultad de Ciencias Económicas"], services: ["Wifi", "Cocina", "Parrilla", "Lockers Individuales"], areas: ["Patio", "Sala de Juegos"],
    ages: [18, null, false], promo: null,
    types: [["Doble", 2, 260, "compartido", AV(2)], ["Triple", 3, 210, "compartido", AV(4)], ["Cuádruple", 4, 190, "compartido", AV(2)]] },
  { slug: "residencia-caballito-parque-demo", name: "Residencia Caballito Parque", area: "Caballito", lat: -34.6186, lng: -58.4442, addr: "Av. Rivadavia 5100, Caballito (demo)", tagline: "Frente al Parque Rivadavia",
    gender: "mixto", unis: ["Universidad Tecnológica Nacional (UTN - FRBA)", "Universidad Nacional de las Artes (UNA)"], services: ["Wifi", "Cocina", "Gimnasio", "Dispenser de Agua", "Limpieza General"], areas: ["Terraza", "Sala de Estudio", "Comedor"],
    ages: [16, 30, true], promo: [15, "Doble"],
    types: [["Individual", 1, 430, "privado", AV(1)], ["Doble", 2, 320, "compartido", AV(2)], ["Compartida", 5, 220, "compartido", STALE]] },
  { slug: "residencia-balvanera-centro-demo", name: "Residencia Balvanera Centro", area: "Balvanera", lat: -34.6097, lng: -58.4001, addr: "Av. Corrientes 2900, Balvanera (demo)", tagline: "Subte y facultades a la puerta",
    gender: "mixto", unis: ["UBA - Facultad de Ciencias Económicas", "UADE"], services: ["Wifi", "Cocina", "Lavandería", "Cámaras 24 hs"], areas: ["Sala de Estar", "Área de Estudio"],
    ages: [18, 27, false], promo: null,
    types: [["Doble", 2, 240, "compartido", AV(3)], ["Triple", 3, 195, "compartido", AV(2)], ["Cuádruple", 4, 190, "compartido", AV(5)]] },
  { slug: "residencia-belgrano-r-demo", name: "Residencia Belgrano R", area: "Belgrano", lat: -34.5628, lng: -58.4583, addr: "Echeverría 2200, Belgrano (demo)", tagline: "Verde, silenciosa y bien conectada",
    gender: "solo_mujeres", unis: ["Universidad de Belgrano", "Universidad Torcuato Di Tella (UTDT)"], services: ["Wifi", "Cocina", "Limpieza de Habitación", "Área Protegida", "Dispenser de Agua"], areas: ["Patio", "Sala de Estudio", "Terraza"],
    ages: [18, 26, false], promo: [20, null],
    types: [["Individual", 1, 560, "privado", AV(2)], ["Doble", 2, 410, "compartido", AV(1)]] },
  { slug: "casa-san-telmo-demo", name: "Casa San Telmo", area: "San Telmo", lat: -34.6215, lng: -58.3729, addr: "Defensa 1100, San Telmo (demo)", tagline: "Casona histórica para estudiantes",
    gender: "mixto", unis: ["Universidad Nacional de las Artes (UNA)", "Universidad del Salvador (USAL)"], services: ["Wifi", "Cocina", "Parrilla", "Lavandería"], areas: ["Patio", "Sala de Juegos", "Comedor"],
    ages: [18, null, false], promo: null,
    types: [["Individual", 1, 380, "compartido", FULL], ["Doble", 2, 280, "compartido", FULL], ["Triple", 3, 230, "compartido", FULL]] },
  { slug: "residencia-villa-crespo-demo", name: "Residencia Villa Crespo", area: "Villa Crespo", lat: -34.5993, lng: -58.4380, addr: "Thames 900, Villa Crespo (demo)", tagline: "Barrio creativo, a pasos del subte B",
    gender: "solo_hombres", unis: ["UBA - Facultad de Ciencias Económicas", "Universidad Tecnológica Nacional (UTN - FRBA)"], services: ["Wifi", "Cocina", "Gimnasio", "Lockers Individuales"], areas: ["Terraza", "Sala de Estudio"],
    ages: [18, 29, false], promo: null,
    types: [["Individual", 1, 470, "privado", STALE], ["Doble", 2, 330, "compartido", STALE]] },
  { slug: "residencia-nunez-rio-demo", name: "Residencia Núñez Río", area: "Núñez", lat: -34.5453, lng: -58.4597, addr: "Av. del Libertador 7300, Núñez (demo)", tagline: "A minutos de la Costanera",
    gender: "mixto", unis: ["Universidad de Belgrano", "UADE"], services: ["Wifi", "Cocina", "Gimnasio", "Limpieza General", "Cámaras 24 hs", "Dispenser de Agua"], areas: ["Terraza", "Sala de Estar", "Patio"],
    ages: [16, 32, true], promo: [12, "Individual"],
    types: [["Individual", 1, 590, "privado", AV(1)], ["Doble", 2, 440, "compartido", AV(2)], ["Triple", 3, 340, "compartido", AV(2)]] },
  { slug: "casa-colegiales-demo", name: "Casa Colegiales", area: "Colegiales", lat: -34.5736, lng: -58.4486, addr: "Conde 1500, Colegiales (demo)", tagline: "Casa chica y familiar",
    gender: "solo_mujeres", unis: ["Universidad de Palermo (UP)", "Universidad del Salvador (USAL)"], services: ["Wifi", "Cocina", "Lavandería", "Limpieza de Habitación"], areas: ["Patio", "Comedor"],
    ages: [18, 25, false], promo: null,
    types: [["Doble", 2, 300, "compartido", AV(1)], ["Triple", 3, 250, "compartido", AV(2)]] },
];

const desc = (r) =>
  `${r.name} es una residencia estudiantil en ${r.area}, pensada para estudiantes que buscan una convivencia cuidada cerca de sus facultades. ` +
  `${r.tagline}. Cuenta con ${r.services.slice(0, 3).join(", ").toLowerCase()} y espacios comunes para estudiar y compartir. Solicitud sujeta a confirmación.`;

let created = 0;
let existing = 0;
for (const [idx, r] of RESIDENCES.entries()) {
  const found = (await admin.from("residences").select("id").eq("slug", r.slug).maybeSingle()).data;
  const [minAge, maxAge, minors] = r.ages;
  const fields = {
    name: r.name, slug: r.slug, tagline: r.tagline, property_type: "residencia_estudiantil", description: desc(r), status: "verified_active",
    address_line: r.addr, public_area: r.area, city: "CABA", latitude: r.lat, longitude: r.lng, created_by: ownerId,
    minimum_stay_months: 6, adjustment_policy: "quarterly", deposit_usd: 250, empty_month_charge_percent: 50,
    reservation_initial_payment_mode: "one_month", reservation_initial_payment_usd: null,
    min_resident_age: minAge, max_resident_age: maxAge, accepts_minors: minors,
  };
  let residenceId;
  if (found) {
    residenceId = found.id;
    existing += 1;
    must(await admin.from("residences").update(fields).eq("id", residenceId), `update ${r.slug}`);
  } else {
    residenceId = must(await admin.from("residences").insert(fields).select("id").single(), `insert ${r.slug}`).id;
    must(await admin.from("residence_private_details").upsert({ residence_id: residenceId, responsible_name: "Responsable demo", responsible_contact: "+54 9 11 0000-0000" }, { onConflict: "residence_id" }), "private");
    must(await admin.from("residence_verifications").insert({ residence_id: residenceId, status: "not_started" }), "verif");
    created += 1;
  }

  for (const s of [
    { section_type: "services", content: { items: r.services } },
    { section_type: "common_areas", content: { items: r.areas } },
    { section_type: "near_universities", content: { items: r.unis } },
  ]) must(await admin.from("residence_profile_sections").upsert({ residence_id: residenceId, ...s }, { onConflict: "residence_id,section_type" }), `seccion ${s.section_type}`);

  for (const [name, cap, usd, bath, [status, count]] of r.types) {
    const typeFields = { residence_id: residenceId, name, gender_policy: r.gender, bathroom_type: bath, features: [], capacity_per_room: cap, monthly_price_usd: usd, monthly_price_ars: Math.round(usd * rate), is_active: true };
    const ex = (await admin.from("room_types").select("id").eq("residence_id", residenceId).eq("name", name).maybeSingle()).data;
    let typeId;
    if (ex) {
      typeId = ex.id;
      must(await admin.from("room_types").update(typeFields).eq("id", typeId), `update tipo ${name}`);
    } else {
      typeId = must(await admin.from("room_types").insert(typeFields).select("id").single(), `tipo ${name}`).id;
    }
    const avail = { residence_id: residenceId, room_type_id: typeId, status, available_count: count, last_confirmed_by: ownerId, ...(status === "not_updated" ? {} : { available_from: new Date().toISOString().slice(0, 10), last_confirmed_at: new Date().toISOString() }) };
    const exAv = (await admin.from("profile_availability").select("id").eq("room_type_id", typeId).maybeSingle()).data;
    if (exAv) must(await admin.from("profile_availability").update(avail).eq("id", exAv.id), "update disp");
    else must(await admin.from("profile_availability").insert(avail), "disp");
  }

  if (r.promo) {
    const [pct, typeName] = r.promo;
    const label = "Promo de temporada";
    const exP = (await admin.from("residence_promotions").select("id").eq("residence_id", residenceId).eq("label", label).maybeSingle()).data;
    if (!exP) {
      let roomTypeId = null;
      if (typeName) roomTypeId = (await admin.from("room_types").select("id").eq("residence_id", residenceId).eq("name", typeName).single()).data.id;
      const today = new Date();
      const end = new Date(today.getTime() + 45 * 86400000);
      must(await admin.from("residence_promotions").insert({ residence_id: residenceId, room_type_id: roomTypeId, label, discount_percent: pct, starts_on: today.toISOString().slice(0, 10), ends_on: end.toISOString().slice(0, 10), is_active: true }), "promo");
    }
  }

  // Sin fotos a propósito: la ficha y las tarjetas muestran el placeholder de marca con el barrio (ResidencePhoto).
  // Antes se reutilizaban las fotos de Sin Fronteras; se retiró (limpieza: scripts/clean-reused-sin-fronteras-photos.mjs).
  console.log(`✓ ${r.slug} (${r.area}, ${r.gender})`);
}

// Sin Fronteras no tenía coordenadas: punto aproximado del Centro (ficticio) para que aparezca en el mapa.
await admin.from("residences").update({ latitude: -34.6037, longitude: -58.3816 }).eq("slug", "residencia-sin-fronteras-29fefe").is("latitude", null);

console.log(`\nListo: ${created} creadas, ${existing} actualizadas.`);
