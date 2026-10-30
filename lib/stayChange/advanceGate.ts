import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaError } from "@/lib/stayChange/schema";

/**
 * Preaviso de 48 h (DR3, aclaración del dueño 2026-10-23; SUPUESTO REVERSIBLE a confirmar): el preaviso empieza al
 * presionar "Quiero cambiar" (para menores, cuando el familiar lo confirma). Desde el primer momento el estudiante puede
 * consultar, enviar solicitudes y anotarse en listas de espera, pero una solicitud creada bajo el aviso NO puede avanzar a
 * `residence_payment_pending` (habilitación del pago a la residencia y, después, el fee) antes de que pasen 48 h.
 * Validación server-side en los dos caminos hacia `residence_payment_pending`: `enableResidencePayment` (residencia) y
 * `recordNegotiationResponse` (estudiante acepta). Solo aplica a solicitudes con `stay_change_intent_id` y aviso `open`.
 */
export const STAY_CHANGE_ADVANCE_HOURS = 48;

/** `payment_unlocked_at` de un preaviso que empieza en `noticeStart`. */
export function advanceUnlockAt(noticeStart: Date): Date {
  return new Date(noticeStart.getTime() + STAY_CHANGE_ADVANCE_HOURS * 3_600_000);
}

/**
 * Momento desde el cual la reserva nueva puede avanzar: `payment_unlocked_at` si está guardado; si no, se deriva de
 * `guardian_confirmed_at` (menores) o `created_at`.
 */
export function stayChangeAdvanceAt(intent: {
  created_at: string;
  guardian_confirmed_at: string | null;
  payment_unlocked_at?: string | null;
}): Date {
  if (intent.payment_unlocked_at) return new Date(intent.payment_unlocked_at);
  return advanceUnlockAt(new Date(intent.guardian_confirmed_at ?? intent.created_at));
}

/** "25/10 14:30" en hora de Buenos Aires. */
export function formatAdvanceAt(date: Date): string {
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const pad = (v: string) => v.padStart(2, "0"); // algunas versiones de ICU ignoran "2-digit" en es-AR
  return `${pad(get("day"))}/${pad(get("month"))} ${pad(get("hour"))}:${pad(get("minute"))}`;
}

export function advanceGateMessage(date: Date, audience: "student" | "residence"): string {
  return audience === "student"
    ? `Podés avanzar con la reserva desde ${formatAdvanceAt(date)}. Mientras tanto podés seguir consultando y sumando solicitudes.`
    : `Este estudiante podrá avanzar con la reserva desde ${formatAdvanceAt(date)}.`;
}

export type AdvanceGateResult = { ok: true } | { ok: false; error: string; availableAt?: string };

/** Falla CERRADO si no puede leer el aviso (mejor reintentar que saltear el preaviso). */
export async function checkStayChangeAdvanceGate(
  admin: SupabaseClient,
  params: { applicationId: string; audience: "student" | "residence" },
  now: Date = new Date(),
): Promise<AdvanceGateResult> {
  const { data: application, error } = await admin
    .from("application_requests")
    .select("stay_change_intent_id")
    .eq("id", params.applicationId)
    .maybeSingle();
  if (isMissingSchemaError(error)) return { ok: true }; // migración 0044 sin aplicar: no hay avisos
  if (error) {
    console.error("[stayChange] advance gate: no se pudo leer la solicitud:", error);
    return { ok: false, error: "No pudimos verificar la solicitud. Intentá de nuevo en unos minutos." };
  }
  const intentId = application?.stay_change_intent_id as string | null | undefined;
  if (!intentId) return { ok: true };

  const { data: intent, error: intentError } = await admin
    .from("stay_change_intents")
    .select("status, created_at, guardian_confirmed_at, payment_unlocked_at")
    .eq("id", intentId)
    .maybeSingle();
  if (intentError) {
    console.error("[stayChange] advance gate: no se pudo leer el aviso:", intentError);
    return { ok: false, error: "No pudimos verificar la solicitud. Intentá de nuevo en unos minutos." };
  }
  // La solicitud vive del aviso: si ya no está abierto (cancelado, vencido) no puede avanzar a pago.
  if (!intent || intent.status !== "open") {
    return {
      ok: false,
      error:
        params.audience === "student"
          ? "El aviso de cambio bajo el que enviaste esta solicitud ya no está abierto, así que no puede avanzar a pago."
          : "El estudiante ya no tiene abierto su aviso de cambio: esta solicitud no puede avanzar a pago.",
    };
  }

  const availableAt = stayChangeAdvanceAt({ created_at: intent.created_at as string, guardian_confirmed_at: (intent.guardian_confirmed_at as string | null) ?? null, payment_unlocked_at: (intent.payment_unlocked_at as string | null) ?? null });
  if (now.getTime() < availableAt.getTime()) {
    return { ok: false, error: advanceGateMessage(availableAt, params.audience), availableAt: availableAt.toISOString() };
  }
  return { ok: true };
}
