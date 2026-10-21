import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReservationStatusInput } from "@/lib/applications/visibleStatus";

export type ReservationInfo = ReservationStatusInput & {
  reservationId: string;
  applicationRequestId: string;
  bookingReceiptId: string | null;
};

/**
 * Lee, para un conjunto de solicitudes, la reserva asociada y el estado
 * del pago del fee — todo lo que `getVisibleStatus` necesita para que
 * las pantallas muestren el estado real (H01). Dos consultas en total,
 * sin importar cuántas solicitudes haya.
 *
 * Acepta tanto el cliente del usuario (estudiante: la RLS ya filtra) como
 * el admin client (residencia/admin: las pantallas ya validaron el
 * acceso antes de llamar). Ante un error de lectura devuelve el mapa
 * vacío para ese tramo: la pantalla cae al rótulo de la solicitud en vez
 * de romperse.
 */
export async function loadReservationInfoByApplication(
  client: SupabaseClient,
  applicationIds: string[],
): Promise<Map<string, ReservationInfo>> {
  const result = new Map<string, ReservationInfo>();
  if (applicationIds.length === 0) return result;

  const { data: reservations, error } = await client
    .from("reservations")
    .select("id, application_request_id, status, cancellation_reason_code, booking_receipt_id, estured_fee_payment_id")
    .in("application_request_id", applicationIds);
  if (error) {
    console.error("[loadReservationInfo] reservations query failed:", error);
    return result;
  }

  const feeIds = (reservations ?? []).map((r) => r.estured_fee_payment_id).filter((id): id is string => !!id);
  const feeStatusById = new Map<string, string>();
  if (feeIds.length > 0) {
    const { data: fees, error: feeError } = await client.from("estured_fee_payments").select("id, status").in("id", feeIds);
    if (feeError) console.error("[loadReservationInfo] estured_fee_payments query failed:", feeError);
    for (const f of fees ?? []) feeStatusById.set(f.id as string, f.status as string);
  }

  for (const r of reservations ?? []) {
    result.set(r.application_request_id as string, {
      reservationId: r.id as string,
      applicationRequestId: r.application_request_id as string,
      status: r.status as string,
      cancellationReasonCode: (r.cancellation_reason_code as string | null) ?? null,
      feePaymentStatus: r.estured_fee_payment_id ? (feeStatusById.get(r.estured_fee_payment_id as string) ?? null) : null,
      hasReceipt: !!r.booking_receipt_id,
      bookingReceiptId: (r.booking_receipt_id as string | null) ?? null,
    });
  }
  return result;
}
