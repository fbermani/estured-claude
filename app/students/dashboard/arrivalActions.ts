"use server";

import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isChecklistKey } from "@/lib/arrival/checklist";
import { isMissingChecklistTable } from "@/lib/arrival/loadChecklist";

export type ToggleChecklistResult = { ok: true } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Reservas cuyo ingreso se puede preparar (DR29): confirmadas o con comprobante en curso/emitido. */
const ALLOWED_STATUSES = ["confirmed", "receipt_pending", "receipt_issued"];

/**
 * Tilda o destilda un ítem del checklist de llegada (DR29). Solo el estudiante dueño de la reserva; el familiar vinculado lo ve en
 * solo lectura. Validación server-side: sesión, reserva propia en estado válido e ítem del catálogo. Escribe con service role tras
 * verificar (la RLS de la migración 0068 refuerza lo mismo).
 */
export async function toggleChecklistItemAction(input: { reservationId: string; itemKey: string; checked: boolean }): Promise<ToggleChecklistResult> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { ok: false, message: "Tu sesión expiró. Volvé a iniciar sesión." };
  if (typeof input?.reservationId !== "string" || !UUID.test(input.reservationId) || !isChecklistKey(input.itemKey) || typeof input.checked !== "boolean") {
    return { ok: false, message: "No pudimos guardar ese cambio. Actualizá la página e intentá de nuevo." };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, message: "No disponible en este momento. Probá más tarde." };

  const { data: reservation } = await admin
    .from("reservations")
    .select("id, status, student_profiles(user_id)")
    .eq("id", input.reservationId)
    .maybeSingle();
  const owner = (reservation as unknown as { student_profiles: { user_id: string | null } | null } | null)?.student_profiles?.user_id;
  if (!reservation || owner !== sessionUser.id) return { ok: false, message: "No encontramos esa reserva en tu cuenta." };
  if (!ALLOWED_STATUSES.includes((reservation as { status: string }).status)) {
    return { ok: false, message: "Esta reserva todavía no permite marcar el checklist." };
  }

  const table = admin.from("arrival_checklist_items");
  const { error } = input.checked
    ? await table.upsert(
        { reservation_id: input.reservationId, item_key: input.itemKey, checked_by: sessionUser.id },
        { onConflict: "reservation_id,item_key", ignoreDuplicates: true },
      )
    : await table.delete().eq("reservation_id", input.reservationId).eq("item_key", input.itemKey);
  if (error) {
    if (isMissingChecklistTable(error)) return { ok: false, message: "El checklist guardable todavía no está disponible. Probá más adelante." };
    console.error("[arrival] toggle checklist:", error);
    return { ok: false, message: "No pudimos guardar el cambio. Probá de nuevo en un momento." };
  }
  return { ok: true };
}
