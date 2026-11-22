/**
 * Copy de cara al estudiante sobre el derecho de revocación del fee (DR6, docs/00 §31).
 *
 * LEGAL_REVIEW_PENDING: estos textos son un BORRADOR DE PRODUCTO que todavía tiene que revisar un asesor legal antes del lanzamiento
 * público. No se rotula como "borrador" en la UI (decisión del dueño): se registra acá y en docs/00 §31 (DR6) / MEMORY.md.
 * Textos legales tocados por DR6 (para el asesor):
 *   1. app/(public)/terms/page.tsx — §17 "Reembolso del fee y derecho de revocación" (usa REVOCATION_TERMS_*).
 *   2. app/students/revocation/page.tsx y RevocationForm.tsx — intro, consecuencias, checkbox, estados en revisión / reintegrada / denegada.
 *   3. app/students/applications/[id]/fee/page.tsx — nota al pie del fee (FEE_PAGE_REVOCATION_NOTE) y su checkbox de "no reembolso" (sin cambios, a revisar).
 *   4. Avisos in-app de resolución (refundedNotification / deniedNotification) y el aviso al estudiante cuando revoca un familiar (revokeEsturedFee, "Se revocó el fee de tu reserva").
 *   5. lib/applications/visibleStatus.ts — helper "Reserva revocada por vos" (sin cambios, a revisar).
 *   5bis. (Ciclo 69, DR6 (i)) REVOCATION_ADULT_STUDENT_ONLY_ERROR y revocationAdultStudentOnlyNote: familiar pagador de un estudiante mayor de edad.
 *   6. docs/10 §15.1 y §15.4 (copy sugerido) y checkbox de renovaciones (RenewalFeePaymentForm, sin cambios).
 * DR65 (b) (2026-11-22, Ola 0 legal): dentro de los 10 días el reintegro es incondicional (sin «uso indebido»); se envía un código de
 * seguimiento por email. El reintegro sigue siendo manual (no automático); lo pagado a la residencia queda fuera.
 */
export const LEGAL_REVIEW_PENDING = true;

export const REVOCATION_PAGE_INTRO =
  "Tenés 10 días corridos desde el pago del fee EstuRed para arrepentirte. No necesitás explicar por qué ni pagar nada. EstuRed te reintegra el fee completo (el 5%) por transferencia. Al registrarlo te enviamos por email un código de seguimiento.";

export const REVOCATION_CONSEQUENCES: readonly string[] = [
  "La reserva se cancela y el comprobante se anula.",
  "EstuRed te reintegra el fee completo (el 5%). El equipo hace la transferencia a mano y te avisa cuando está hecha.",
  "Lo que pagaste directamente a la residencia no lo reintegra EstuRed: se acuerda con la residencia.",
];

export const REVOCATION_UNDERSTANDING_LABEL =
  "Entiendo que la reserva se cancela, que EstuRed me reintegra el fee completo y que lo pagado a la residencia se acuerda con ella.";

export const REVOCATION_SUBMITTED_MESSAGE =
  "Revocación registrada. Tu reserva quedó cancelada. Te enviamos por email un código de seguimiento. Te avisamos acá cuando hagamos el reintegro.";

export const REVOCATION_PENDING_HELPER =
  "Estamos gestionando el reintegro de tu fee. Cuando esté hecho te avisamos acá.";

export const REVOCATION_NOT_ALLOWED_NOTE =
  "Solo el estudiante o quien pagó el fee puede ejercer este derecho.";

/** DR6 (i): error al familiar pagador que intenta revocar la reserva de un estudiante mayor de edad (no revela datos). */
export const REVOCATION_ADULT_STUDENT_ONLY_ERROR =
  "La revocación la tiene que hacer la estudiante desde su cuenta. Si ella necesita ayuda, escribinos a Soporte.";

/** DR6 (i): nota en tercera persona para el familiar pagador cuando el estudiante es mayor de edad (sin botón). */
export function revocationAdultStudentOnlyNote(studentFirstName: string | null): string {
  return `Solo ${studentFirstName?.trim() || "la estudiante"} puede revocar el fee de su reserva; si necesita ayuda, puede escribir a Soporte.`;
}

export const FEE_PAGE_REVOCATION_NOTE =
  "Una vez pagado, tenés 10 días corridos para arrepentirte desde «Botón de arrepentimiento»: EstuRed te reintegra el fee completo. Fuera de ese derecho, el fee no se reembolsa automáticamente ante una cancelación.";

/** Párrafos de /terms §17, subsección "Derecho de revocación del fee EstuRed". */
export const REVOCATION_TERMS_PARAGRAPHS: readonly string[] = [
  "Podés arrepentirte del pago del fee de EstuRed dentro de los 10 días corridos desde que lo pagaste. No necesitás explicar por qué ni pagar nada. Entrá a «Botón de arrepentimiento», al pie del sitio, con tu cuenta. Al registrarlo te enviamos por email un código de seguimiento de tu pedido.",
  "Al ejercerlo, tu reserva queda cancelada y el comprobante emitido se anula. EstuRed te reintegra el fee completo por transferencia, por fuera de la plataforma, dentro de los plazos de ley.",
  "Si la residencia no cumple lo confirmado, escribinos a Soporte. Revisamos el caso y, si corresponde, te reintegramos el fee.",
  "Este derecho aplica únicamente al fee EstuRed. No alcanza a los montos que hayas pagado directamente a la residencia: su devolución se acuerda con la residencia. Nada de esto limita los derechos que te da la ley como consumidor.",
];

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export const REVOCATION_RESOLVED_TITLE = "Resolvimos tu revocación del fee";

/** Aviso in-app al estudiante/pagador cuando se reintegra el fee. No incluye el motivo interno. */
export function refundedNotificationBody(params: { residenceName: string | null; refundedAtIso: string }): string {
  const where = params.residenceName ? ` de ${params.residenceName}` : "";
  return `EstuRed reintegró el fee${where}. Fecha del reintegro: ${formatDay(params.refundedAtIso)}. Podés ver el detalle en «Botón de arrepentimiento».`;
}

/** Aviso in-app cuando se deniega. Incluye solo el mensaje para el estudiante (nunca el motivo interno). */
export function deniedNotificationBody(params: { residenceName: string | null; studentMessage: string | null }): string {
  const where = params.residenceName ? ` de ${params.residenceName}` : "";
  const message = params.studentMessage ? ` Mensaje del equipo: ${params.studentMessage}` : "";
  return `Revisamos tu revocación del fee${where} y no correspondió reintegrarlo.${message}`;
}

export const REFUND_METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Transferencia bancaria",
  digital_wallet: "Billetera virtual",
  other: "Otro medio",
};

/** DR65 (b): código de seguimiento de una revocación, derivado del id de la reserva (estable, sin tabla nueva). */
export function revocationTrackingCode(reservationId: string): string {
  return `ARR-${reservationId.replace(/[^0-9a-f]/gi, "").slice(0, 10).toUpperCase()}`;
}

export const REVOCATION_EMAIL_SUBJECT = "Registramos tu arrepentimiento del fee de EstuRed";
