import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadActiveFamilyOfStudent } from "@/lib/family/access";

/**
 * Quién puede ver los datos de cobro y avisar el pago de UNA solicitud (DR63 (j) 3 y (m)). Todo se deriva de la BASE, nunca de
 * `sessionUser.roles` ni de lo que mande el cliente:
 *  - `student`: el estudiante dueño de la solicitud (también si es menor).
 *  - `family_payer`: el familiar vinculado ACTIVO de un estudiante MENOR (`contact_target = family_member`, la misma señal que usa la
 *    habilitación del pago) cuyo vínculo no tiene apagado `can_pay_estured_fee`.
 * El staff y el dueño de la residencia, otros estudiantes y el familiar de un adulto no son actores (el familiar de un adulto sigue la
 * solicitud en solo lectura, sin datos de cobro).
 *
 * SUPUESTO REVERSIBLE (docs/13 §4): antes de «Pago recibido» todavía no existe `estured_fee_payments.payer_user_id`, así que «pagador»
 * se aproxima con el permiso `can_pay_estured_fee` del vínculo (por defecto encendido, migración 0004). Falla cerrado si el permiso
 * está explícitamente apagado. Documentado en docs/07 §16.4.
 */

export type PaymentActorRole = "student" | "family_payer";

/** Decisión pura, testeable sin base. */
export function decidePaymentActor(input: {
  userId: string;
  studentUserId: string | null;
  isMinor: boolean;
  familyUserId: string | null;
  /** `permissions.can_pay_estured_fee` del vínculo activo; `undefined` = sin dato (se considera encendido, como el default de 0004). */
  familyCanPay: boolean | undefined;
}): PaymentActorRole | null {
  if (!input.userId) return null;
  if (input.studentUserId && input.studentUserId === input.userId) return "student";
  if (input.isMinor && input.familyUserId && input.familyUserId === input.userId && input.familyCanPay !== false) return "family_payer";
  return null;
}

export type PaymentApplication = {
  id: string;
  status: string;
  residence_id: string;
  student_profile_id: string;
  contact_target: string | null;
  collection_mode: string | null;
  payment_deadline_at?: string | null;
};

export type PaymentActorResolution =
  | { ok: true; role: PaymentActorRole; isMinor: boolean; studentUserId: string; application: PaymentApplication }
  | { ok: false; reason: "not_found" | "not_allowed" | "read_failed" };

const SCHEMA_MISSING = new Set(["42703", "PGRST204"]);

/** Resuelve si `userId` puede actuar sobre el pago de la solicitud. Sin pista de por qué no (no filtra la existencia de solicitudes ajenas). */
export async function resolvePaymentActor(admin: SupabaseClient, userId: string, applicationId: string): Promise<PaymentActorResolution> {
  const { data: app, error } = await admin
    .from("application_requests")
    .select("id, status, residence_id, student_profile_id, contact_target, collection_mode, payment_deadline_at")
    .eq("id", applicationId)
    .maybeSingle();
  if (error) {
    if (!SCHEMA_MISSING.has(error.code ?? "")) console.error("[payment-access] application read failed:", error.code, error.message);
    return { ok: false, reason: "read_failed" };
  }
  if (!app) return { ok: false, reason: "not_found" };
  const application = app as PaymentApplication;

  const { data: profile, error: profileError } = await admin
    .from("student_profiles")
    .select("user_id")
    .eq("id", application.student_profile_id)
    .maybeSingle();
  if (profileError) {
    console.error("[payment-access] student profile read failed:", profileError.code, profileError.message);
    return { ok: false, reason: "read_failed" };
  }
  const studentUserId = (profile?.user_id as string | undefined) ?? null;
  const isMinor = application.contact_target === "family_member";

  // Solo se consulta al familiar si hace falta (menor y el usuario no es el estudiante).
  let familyUserId: string | null = null;
  let familyCanPay: boolean | undefined;
  if (isMinor && studentUserId !== userId) {
    const family = await loadActiveFamilyOfStudent(admin, application.student_profile_id);
    familyUserId = family?.userId ?? null;
    const flag = family?.permissions?.can_pay_estured_fee;
    familyCanPay = typeof flag === "boolean" ? flag : undefined;
  }

  const role = decidePaymentActor({ userId, studentUserId, isMinor, familyUserId, familyCanPay });
  if (!role || !studentUserId) return { ok: false, reason: "not_allowed" };
  return { ok: true, role, isMinor, studentUserId, application };
}
