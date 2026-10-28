/**
 * Seed demo del dinero (DR18 tanda 3, migración 0060): sobre residencias verificadas ya cargadas,
 *  - con matrícula: descuento de matrícula (50 % por 60 días) y pago inicial «solo la matrícula» en la primera;
 *  - sin matrícula ni depósito fijo: depósito de 1 mes de renta;
 *  - una promoción de renta («Promo de temporada», 15 %, 30 días) en la primera residencia.
 * Idempotente (no duplica la promoción). Requiere la migración 0060 aplicada en estured-dev. No toca solicitudes existentes.
 *
 * Uso: node --env-file=.env.local scripts/seed-demo-money.mjs
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

const iso = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const { data: residences, error } = await admin
  .from("residences")
  .select("id, slug, enrollment_fee_mode, deposit_usd")
  .eq("status", "verified_active")
  .order("created_at", { ascending: true });
if (error) {
  console.error("✗ no se pudieron leer las residencias:", error.message);
  process.exit(1);
}

let firstWithEnrollment = true;
let firstResidence = true;
for (const r of residences ?? []) {
  if (r.enrollment_fee_mode) {
    const patch = firstWithEnrollment
      ? { enrollment_discount_percent: 50, enrollment_discount_until: iso(60), reservation_initial_payment_mode: "enrollment_only", reservation_initial_payment_usd: null }
      : { enrollment_discount_percent: 100, enrollment_discount_until: null };
    firstWithEnrollment = false;
    const { error: e } = await admin.from("residences").update(patch).eq("id", r.id);
    if (e) {
      console.error("✗", r.slug, e.message, "(¿aplicaste la migración 0060?)");
      process.exit(1);
    }
    console.log("✓", r.slug, "descuento de matrícula", patch.enrollment_discount_percent + "%");
  } else if (r.deposit_usd == null) {
    const { error: e } = await admin.from("residences").update({ deposit_mode: "one_month" }).eq("id", r.id);
    if (e) {
      console.error("✗", r.slug, e.message, "(¿aplicaste la migración 0060?)");
      process.exit(1);
    }
    console.log("✓", r.slug, "depósito de 1 mes de renta");
  }
  if (firstResidence) {
    firstResidence = false;
    const { data: existing } = await admin
      .from("residence_promotions")
      .select("id")
      .eq("residence_id", r.id)
      .eq("label", "Promo de temporada")
      .limit(1);
    if (!existing || existing.length === 0) {
      const { error: e } = await admin
        .from("residence_promotions")
        .insert({ residence_id: r.id, label: "Promo de temporada", discount_percent: 15, starts_on: iso(-1), ends_on: iso(30) });
      if (e) {
        console.error("✗", r.slug, e.message);
        process.exit(1);
      }
      console.log("✓", r.slug, "promoción 15 % por 30 días");
    }
  }
}
