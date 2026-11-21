/**
 * Lógica PURA del aviso del estudiante sobre el pago de la reserva (DR63 (e), (f), (l)). Sin acceso a datos de cobro: solo estados,
 * fechas, montos informados y si hay comprobante. La usan el job de vencimiento, los recordatorios y las pantallas.
 */

/** Columnas de `external_residence_payments` que importan para el aviso (todas legibles con el cliente de sesión, salvo las marcas `*_sent_at`). */
export type PaymentReportRow = {
  status: string;
  student_reported_paid_at?: string | null;
  student_payment_issue_at?: string | null;
  student_payment_issue_resolved_at?: string | null;
};

/** «No pude realizar el pago» abierto: avisó y la residencia todavía no respondió (DR63 (l)). */
export function isPaymentIssueOpen(row: Pick<PaymentReportRow, "student_payment_issue_at" | "student_payment_issue_resolved_at">): boolean {
  return Boolean(row.student_payment_issue_at) && !row.student_payment_issue_resolved_at;
}

/**
 * ¿Este pago detiene el vencimiento de 48 h de `residence_payment_pending`? (DR63 (f) y (l)). Se decide por las FECHAS, no por el estado:
 * un «Ya pagué» que la residencia después disputó sigue frenado (el estudiante pagó; lo resuelve Soporte).
 */
export function paymentHoldsDeadline(row: PaymentReportRow): boolean {
  return Boolean(row.student_reported_paid_at) || isPaymentIssueOpen(row);
}

/** El pago ya no admite avisos del estudiante: la residencia lo confirmó, venció o está en disputa. */
export function isPaymentClosedForStudent(status: string): boolean {
  return status === "reported_received_by_residence" || status === "expired" || status === "disputed";
}

export type PaymentReportInput = PaymentReportRow & {
  student_proof_file_id?: string | null;
  amount_reported_usd?: number | string | null;
  amount_reported_ars?: number | string | null;
  payment_concept?: string | null;
  payment_method_to_residence?: string | null;
  student_payment_issue_reason?: string | null;
  dispute_reason?: string | null;
};

/** Lo que la pantalla de la residencia muestra del aviso del estudiante. Serializable al cliente; nunca lleva datos de cobro. */
export type PaymentReportView = {
  status: string;
  reportedPaidAt: string | null;
  hasProof: boolean;
  reportedAmountUsd: number | null;
  reportedAmountArs: number | null;
  concept: string | null;
  methodLabel: string | null;
  issueOpen: boolean;
  issueAt: string | null;
  issueReason: string | null;
  disputed: boolean;
  disputeReason: string | null;
};

const num = (v: number | string | null | undefined): number | null => (v === null || v === undefined || v === "" ? null : Number(v));

/** `null` si el estudiante todavía no avisó nada (la pantalla queda como antes). */
export function buildPaymentReportView(row: PaymentReportInput | null | undefined): PaymentReportView | null {
  if (!row) return null;
  const issueOpen = isPaymentIssueOpen(row);
  const reportedPaidAt = row.student_reported_paid_at ?? null;
  const hasProof = Boolean(row.student_proof_file_id);
  const disputed = row.status === "disputed";
  if (!reportedPaidAt && !issueOpen && !hasProof && !disputed) return null;
  return {
    status: row.status,
    reportedPaidAt,
    hasProof,
    reportedAmountUsd: num(row.amount_reported_usd),
    reportedAmountArs: num(row.amount_reported_ars),
    concept: row.payment_concept ?? null,
    methodLabel: row.payment_method_to_residence ?? null,
    issueOpen,
    issueAt: issueOpen ? (row.student_payment_issue_at ?? null) : null,
    issueReason: issueOpen ? (row.student_payment_issue_reason ?? null) : null,
    disputed,
    disputeReason: disputed ? (row.dispute_reason ?? null) : null,
  };
}

/** Largos de los textos libres (docs/07 §16.7 y §16.9; el tope de 200 también es CHECK de la base, 0102). */
export const ISSUE_REASON_MIN = 10;
export const ISSUE_REASON_MAX = 200;
export const DISPUTE_REASON_MIN = 10;
export const DISPUTE_REASON_MAX = 300;

/** Motivo opcional de «No pude realizar el pago»: vacío = sin motivo; si se escribe, de 10 a 200 caracteres. */
export function validateIssueReason(input: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  const text = typeof input === "string" ? input.trim() : "";
  if (text.length === 0) return { ok: true, value: null };
  if (text.length < ISSUE_REASON_MIN) return { ok: false, error: `Si querés contarnos el motivo, escribí al menos ${ISSUE_REASON_MIN} caracteres. Si no, dejalo vacío.` };
  if (text.length > ISSUE_REASON_MAX) return { ok: false, error: `El motivo es demasiado largo (máximo ${ISSUE_REASON_MAX} caracteres).` };
  return { ok: true, value: text };
}

/** Motivo obligatorio de «No recibí el pago»: de 10 a 300 caracteres. */
export function validateDisputeReason(input: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const text = typeof input === "string" ? input.trim() : "";
  if (text.length < DISPUTE_REASON_MIN) return { ok: false, error: `Contanos el motivo en al menos ${DISPUTE_REASON_MIN} caracteres.` };
  if (text.length > DISPUTE_REASON_MAX) return { ok: false, error: `El motivo es demasiado largo (máximo ${DISPUTE_REASON_MAX} caracteres).` };
  return { ok: true, value: text };
}
