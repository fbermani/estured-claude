/**
 * ¿La solicitud está "en curso" desde el punto de vista del admin? (UX03/H-contador)
 *
 * Mismo universo para el contador y el filtro de /admin/applications. Se
 * basa en el estado VISIBLE (`getVisibleStatus`: la reserva manda sobre la
 * solicitud, docs/04 §2.2) y en la tabla «Cuenta como solicitud activa» de
 * docs/04 §5.2. No inventa estados.
 *
 * - Con reserva asociada: en curso mientras el estado no sea terminal ni
 *   de reserva ya confirmada (confirmed / receipt_*): no queda nada por
 *   seguir. `disputed` cuenta como en curso (docs/04 §5.2: «depende del caso»;
 *   hay un reclamo abierto).
 * - Sin reserva: en curso solo los estados «Sí» de docs/04 §5.2 (más
 *   `disputed`). Borrador y pausada NO cuentan (docs/04 §5.2).
 */
import type { VisibleStatus } from "@/lib/applications/visibleStatus";

const ACTIVE_APPLICATION_STATUSES = new Set([
  "submitted",
  "queued_for_place",
  "under_review",
  "contact_established",
  "offer_pending_student_acceptance",
  "conditions_accepted",
  "residence_payment_pending",
  "residence_payment_reported",
  "disputed",
]);

const SETTLED_RESERVATION_KEYS = new Set(["confirmed", "receipt_pending", "receipt_issued"]);

export function isInProgressApplication(visible: Pick<VisibleStatus, "key" | "isClosed" | "source">, applicationStatus: string): boolean {
  if (visible.source === "reservation") {
    return !visible.isClosed && !SETTLED_RESERVATION_KEYS.has(visible.key);
  }
  return ACTIVE_APPLICATION_STATUSES.has(applicationStatus);
}
