import { formatDayMonthTime } from "@/lib/dates/format";

/**
 * Aviso urgente del fee EstuRed (estudiante y familiar). Puro, sin I/O: recibe lo ya leído
 * (`estured_fee_payments.expires_at`, `payer_user_id`) y decide tono, fecha y quién paga.
 */

const HOUR_MS = 3_600_000;

export type FeeBannerInfo = {
  /** "24/10 14:30", hora de Buenos Aires. */
  absolute: string;
  /** Vence en menos de 24 h. */
  urgent: boolean;
};

/** `null` si no hay plazo, es inválido o ya venció (el aviso solo existe con plazo vigente). */
export function describeFeeBanner(expiresAt: string | null | undefined, now: Date = new Date()): FeeBannerInfo | null {
  if (!expiresAt) return null;
  const deadline = new Date(expiresAt);
  if (Number.isNaN(deadline.getTime())) return null;
  const ms = deadline.getTime() - now.getTime();
  if (ms <= 0) return null;
  return { absolute: formatDayMonthTime(deadline), urgent: ms < 24 * HOUR_MS };
}

export type FeePayerView = "viewer_pays" | "student_pays" | "none";

/**
 * Qué ve el familiar sobre quién paga: él (solo si además tiene el permiso de pagar), el estudiante, o nadie que
 * pueda hacerlo (p. ej. el pagador designado dejó de estar vinculado).
 */
export function resolveFeePayerView(input: {
  payerUserId: string | null | undefined;
  viewerUserId: string;
  studentUserId: string | null | undefined;
  viewerCanPay: boolean;
}): FeePayerView {
  if (input.payerUserId && input.payerUserId === input.viewerUserId) return input.viewerCanPay ? "viewer_pays" : "none";
  if (input.payerUserId && input.studentUserId && input.payerUserId === input.studentUserId) return "student_pays";
  return "none";
}

/** Frase para el familiar según quién paga. `viewer_pays` no lleva nota (tiene CTA propio). */
export function familyFeePayerNote(view: FeePayerView, studentName: string): string | null {
  if (view === "viewer_pays") return null;
  if (view === "student_pays") return `Lo paga ${studentName}.`;
  return `Pedile a ${studentName} que te designe como pagador.`;
}

export type PendingFeeItem = { applicationId: string; residenceName: string; expiresAt: string };

/** Fees con plazo vigente, el que vence antes primero. */
export function sortPendingFees<T extends { expiresAt: string | null }>(items: T[], now: Date = new Date()): (T & { expiresAt: string })[] {
  return items
    .filter((i): i is T & { expiresAt: string } => describeFeeBanner(i.expiresAt, now) !== null)
    .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
}
