import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Contraparte del descuento en `confirmAfterFeePaid.ts` (línea ~96) —
 * cuando una plaza se libera (fin de estadía), repone 1 unidad a la
 * disponibilidad declarada del tipo de habitación (Modo Perfil
 * Verificado, docs/06 §9.4). Antes de este fix (Ciclo 41) no existía
 * ninguna reposición automática: la residencia tenía que entrar a mano
 * a `/availability` a subir el número cada vez que alguien se iba.
 *
 * Si la residencia había pausado la disponibilidad a mano
 * (`paused_by_residence`) no se toca el status, solo el conteo — la
 * pausa es una decisión deliberada que no debe revertirse sola.
 * `available_count` es un número DECLARADO por la residencia (no un
 * espejo estricto de camas físicas — ver docstring de
 * `updateAvailability.ts`), así que esto es un +1 simple, simétrico al
 * -1 existente, no un recálculo desde las camas reales.
 *
 * Nunca lanza: liberar una plaza no debe poder tumbar la operación que
 * la originó por un problema de disponibilidad (mismo criterio que
 * `removeWaitlistEntriesOnConfirmedReservation.ts`).
 */
export async function incrementAvailabilityOnRelease(admin: SupabaseClient, roomTypeId: string): Promise<void> {
  try {
    const { data: availability } = await admin
      .from("profile_availability")
      .select("id, available_count, status")
      .eq("room_type_id", roomTypeId)
      .maybeSingle();
    if (!availability) return;

    const nextCount = (availability.available_count ?? 0) + 1;
    const nextStatus = availability.status === "full" ? "available_to_confirm" : availability.status;

    await admin
      .from("profile_availability")
      .update({ available_count: nextCount, status: nextStatus })
      .eq("id", availability.id);
  } catch (error) {
    console.error("[availability] incrementAvailabilityOnRelease failed:", error);
  }
}
