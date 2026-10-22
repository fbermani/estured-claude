import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const ALERT_THRESHOLD_PERCENT = 15;

export type TariffFieldName = "monthly_price" | "enrollment_fee" | "deposit" | "adjustment_policy" | "initial_payment";

/**
 * Log de auditoría de cambios de tarifa (docs/09 §9, migración 0028) —
 * a diferencia de la revisión de ediciones de perfil (migración 0027),
 * estos cambios se aplican al instante y SOLO se auditan; nunca
 * bloquean el guardado. Nunca lanza (mismo criterio que
 * `createAuditLog`/`createNotification`): una falla acá no debe poder
 * tumbar el guardado real del dueño.
 */
export async function logTariffChange(
  admin: SupabaseClient,
  params: {
    residenceId: string;
    roomTypeId?: string | null;
    changedByUserId: string;
    fieldName: TariffFieldName;
    oldValue: number | string | null;
    newValue: number | string | null;
    currencyCode?: "USD" | "ARS" | null;
  },
): Promise<void> {
  const { oldValue, newValue } = params;
  if (oldValue === newValue) return;
  if ((oldValue === null || oldValue === undefined) && (newValue === null || newValue === undefined)) return;

  // `initial_payment` se guarda como texto legible ("Primer mes" / "Monto fijo USD 450", ver
  // `describeInitialPaymentForLog`): un cambio de modo no tiene variación numérica, así que se audita sin %.
  const isNumeric = params.fieldName !== "adjustment_policy" && params.fieldName !== "initial_payment";
  let variationPercent: number | null = null;
  let alertTriggered = false;

  if (isNumeric) {
    const oldNum = oldValue === null ? null : Number(oldValue);
    const newNum = newValue === null ? null : Number(newValue);
    if (oldNum !== null && newNum !== null && oldNum !== 0 && !Number.isNaN(oldNum) && !Number.isNaN(newNum)) {
      variationPercent = Math.round(((newNum - oldNum) / oldNum) * 1000) / 10;
      alertTriggered = Math.abs(variationPercent) > ALERT_THRESHOLD_PERCENT;
    } else if (oldNum === null || newNum === null) {
      // Alta/baja de un valor que antes no existía (ej. matrícula
      // recién activada) — se audita pero no dispara alerta de
      // variación (no hay base para calcular %).
      alertTriggered = false;
    }
  } else if (params.fieldName === "adjustment_policy") {
    // Cambio de política de ajuste: docs/09 §9.2 lo marca como alerta
    // incondicional (no es un umbral de %).
    alertTriggered = true;
  }

  const { error } = await admin.from("tariff_change_logs").insert({
    residence_id: params.residenceId,
    room_type_id: params.roomTypeId ?? null,
    changed_by: params.changedByUserId,
    field_name: params.fieldName,
    old_value: oldValue === null || oldValue === undefined ? null : String(oldValue),
    new_value: newValue === null || newValue === undefined ? null : String(newValue),
    currency_code: params.currencyCode ?? null,
    variation_percent: variationPercent,
    alert_triggered: alertTriggered,
  });
  if (error) {
    console.error("[tariff-log] insert failed:", error.code, error.message);
  }
}
