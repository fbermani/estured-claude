"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { createAuditLog } from "@/lib/audit";
import { MonedApiProvider } from "@/lib/exchange/provider";

export type ExchangeRateActionState = { status: "idle" | "error" | "saved"; message?: string };

/** Fecha de hoy en huso horario de Argentina — misma lógica que lib/exchange/rate.ts. */
function todayArDate(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

const provider = new MonedApiProvider();

/**
 * Docs/09 §25.3 — "Forzar actualización": vuelve a consultar monedapi.ar
 * y pisa la fila automática del día (o la crea si no existe). Nunca toca
 * una fila con override manual — esa sigue teniendo prioridad en
 * `getCurrentExchangeRate()` (docs/06 §20.1).
 */
export async function forceRefreshExchangeRate(): Promise<ExchangeRateActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const today = todayArDate();
  try {
    const fetched = await provider.getReferenceUsdArsRate();
    const { data: existing } = await admin
      .from("exchange_rates")
      .select("id")
      .eq("rate_date", today)
      .eq("manually_overridden", false)
      .maybeSingle();

    if (existing) {
      await admin
        .from("exchange_rates")
        .update({
          official_exchange_rate_ars_per_usd: fetched.arsPerUsd,
          source_name: fetched.source,
          source_url: fetched.sourceUrl,
          rate_type: fetched.rateType,
          fetched_at: fetched.fetchedAt,
        })
        .eq("id", existing.id);
    } else {
      await admin.from("exchange_rates").insert({
        rate_date: today,
        base_currency: "USD",
        quote_currency: "ARS",
        official_exchange_rate_ars_per_usd: fetched.arsPerUsd,
        source_name: fetched.source,
        source_url: fetched.sourceUrl,
        rate_type: fetched.rateType,
        fetched_at: fetched.fetchedAt,
        manually_overridden: false,
      });
    }

    await createAuditLog(admin, {
      actorUserId: sessionUser.id,
      actorRole: "admin",
      action: "exchange_rate_force_refresh",
      entityType: "exchange_rates",
      newValue: { rate_date: today, ars_per_usd: fetched.arsPerUsd, source: fetched.source },
    });
  } catch (error) {
    console.error("[exchange-rate] force refresh failed:", error);
    return { status: "error", message: "No pudimos consultar monedapi.ar. Intentá de nuevo en unos minutos." };
  }

  revalidatePath("/admin/exchange-rate");
  return { status: "saved", message: "Tipo de cambio actualizado desde monedapi.ar." };
}

/** Docs/09 §25.1/25.3 — override manual, motivo obligatorio. */
export async function setExchangeRateOverride(
  _prev: ExchangeRateActionState,
  formData: FormData,
): Promise<ExchangeRateActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const arsPerUsd = Number(formData.get("ars_per_usd"));
  const reason = String(formData.get("reason") ?? "").trim();
  if (!arsPerUsd || arsPerUsd <= 0) return { status: "error", message: "Ingresá un valor válido de ARS por USD." };
  if (reason.length < 5) return { status: "error", message: "El motivo del override es obligatorio." };

  const today = todayArDate();
  const { error } = await admin.from("exchange_rates").insert({
    rate_date: today,
    base_currency: "USD",
    quote_currency: "ARS",
    official_exchange_rate_ars_per_usd: arsPerUsd,
    source_name: "admin_override",
    rate_type: "manual_override",
    manually_overridden: true,
    overridden_by_user_id: sessionUser.id,
    override_reason: reason,
  });
  if (error) {
    console.error("[exchange-rate] override failed:", error);
    return { status: "error", message: "No pudimos guardar el override. Intentá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: "admin",
    action: "exchange_rate_override_set",
    entityType: "exchange_rates",
    newValue: { rate_date: today, ars_per_usd: arsPerUsd },
    reasonText: reason,
  });

  revalidatePath("/admin/exchange-rate");
  return { status: "saved", message: "Override aplicado. Se va a usar en vez del valor automático de hoy." };
}

/** Docs/09 §25.3 — "Quitar override": vuelve a regir el valor automático del día. */
export async function removeExchangeRateOverride(): Promise<ExchangeRateActionState> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const today = todayArDate();
  const { data: overrides } = await admin
    .from("exchange_rates")
    .select("id")
    .eq("rate_date", today)
    .eq("manually_overridden", true);
  if (!overrides || overrides.length === 0) {
    return { status: "error", message: "No hay override activo hoy." };
  }

  await admin
    .from("exchange_rates")
    .delete()
    .in("id", overrides.map((o) => o.id));

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: "admin",
    action: "exchange_rate_override_removed",
    entityType: "exchange_rates",
    oldValue: { rate_date: today },
  });

  revalidatePath("/admin/exchange-rate");
  return { status: "saved", message: "Override eliminado. Vuelve a regir el valor automático." };
}
