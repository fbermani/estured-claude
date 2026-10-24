import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Fee `paid` cuya reserva sigue en `pending_estured_fee`: el pago se registró pero la reserva no se confirmó (Ciclo 71, DR8). */
export type UnconfirmedPaidFee = {
  id: string;
  paidAt: string | null;
  feeAmountArs: number;
  residenceName: string | null;
  studentFirstName: string | null;
  studentLastInitial: string | null;
};

type Row = {
  id: string;
  paid_at: string | null;
  fee_amount_ars: number | string;
  reservations: {
    status: string;
    residences: { name: string } | null;
    student_profiles: { first_name: string; last_initial: string } | null;
  } | null;
};

/**
 * Sin límite artificial: son casos excepcionales y ninguno puede quedar fuera de la vista. Hint de FK explícito (trampa
 * bidireccional reservations ↔ estured_fee_payments, MEMORY.md §10). Si la consulta falla devuelve `failed: true` para que la
 * pantalla no muestre "todo bien" cuando en realidad no pudo mirar.
 */
export async function loadUnconfirmedPaidFees(admin: SupabaseClient): Promise<{ items: UnconfirmedPaidFee[]; failed: boolean }> {
  const { data, error } = await admin
    .from("estured_fee_payments")
    .select(
      "id, paid_at, fee_amount_ars, reservations!estured_fee_payments_reservation_id_fkey!inner(status, residences(name), student_profiles(first_name, last_initial))",
    )
    .eq("status", "paid")
    .not("reservation_id", "is", null)
    .eq("reservations.status", "pending_estured_fee")
    .order("paid_at", { ascending: true, nullsFirst: false });
  if (error) {
    console.error("[admin-payments] unconfirmed paid fees query failed:", error);
    return { items: [], failed: true };
  }
  const rows = (data as unknown as Row[]) ?? [];
  return {
    failed: false,
    items: rows.map((r) => ({
      id: r.id,
      paidAt: r.paid_at,
      feeAmountArs: Number(r.fee_amount_ars),
      residenceName: r.reservations?.residences?.name ?? null,
      studentFirstName: r.reservations?.student_profiles?.first_name ?? null,
      studentLastInitial: r.reservations?.student_profiles?.last_initial ?? null,
    })),
  };
}
