import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Tabla ausente (migración 0068 sin aplicar): se degrada a solo lectura sin tildes persistentes. */
export function isMissingChecklistTable(error: { code?: string } | null): boolean {
  return !!error && (error.code === "PGRST205" || error.code === "42P01");
}

export type CheckedByReservation = {
  /** false = la tabla no existe todavía (sonda): la UI muestra el checklist sin tildes persistentes. */
  persistent: boolean;
  byReservation: Map<string, string[]>;
};

/** Lee los ítems tildados de las reservas dadas (con el cliente recibido: usuario con RLS o service role ya acotado). */
export async function loadCheckedItems(client: SupabaseClient, reservationIds: string[]): Promise<CheckedByReservation> {
  const byReservation = new Map<string, string[]>();
  if (reservationIds.length === 0) return { persistent: true, byReservation };
  const { data, error } = await client.from("arrival_checklist_items").select("reservation_id, item_key").in("reservation_id", reservationIds);
  if (error) {
    if (!isMissingChecklistTable(error)) console.error("[arrival] no se pudo leer el checklist:", error);
    return { persistent: false, byReservation };
  }
  for (const row of (data ?? []) as { reservation_id: string; item_key: string }[]) {
    const list = byReservation.get(row.reservation_id) ?? [];
    list.push(row.item_key);
    byReservation.set(row.reservation_id, list);
  }
  return { persistent: true, byReservation };
}
