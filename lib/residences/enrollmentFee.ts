/**
 * Matrícula de la residencia para mostrar en la ficha (DF4, 2026-10-23, docs/06 §8.1).
 *
 * `residences.enrollment_fee_mode = null` significa "la residencia NO cobra matrícula" (no "no informado"):
 * el perfil de la residencia la deja en `null` cuando el toggle "Cobra matrícula" está apagado, y en todo el
 * código (formulario de solicitud, snapshot, fee) `null` ya equivale a USD 0. Esta función centraliza esa
 * lectura para que la UI diga "No cobra" y no oculte el dato.
 */
export type EnrollmentFeeDisplay =
  | { kind: "none" }
  | { kind: "one_month" }
  | { kind: "fixed"; usd: number };

export function describeEnrollmentFee(conditions: {
  enrollmentFeeMode: "one_month" | "manual" | null;
  enrollmentFeeUsd: number | null;
}): EnrollmentFeeDisplay {
  if (conditions.enrollmentFeeMode === "one_month") return { kind: "one_month" };
  if (conditions.enrollmentFeeMode === "manual" && conditions.enrollmentFeeUsd != null && conditions.enrollmentFeeUsd > 0) {
    return { kind: "fixed", usd: conditions.enrollmentFeeUsd };
  }
  return { kind: "none" };
}
