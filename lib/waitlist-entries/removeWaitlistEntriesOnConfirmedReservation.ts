import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import { isMissingSchemaError } from "@/lib/stayChange/schema";

export type RemovedWaitlistEntry = { id: string; residenceId: string; residenceName: string };

/**
 * Docs/06 §27.8, docs/08 §6.10 ("sale automáticamente si confirma
 * reserva en otra residencia") — se llama desde `confirmAfterFeePaid` y
 * `confirmRenewalAfterFeePaid` al confirmar. Nunca lanza (mismo criterio
 * que `createAuditLog`): no debe poder tumbar la confirmación de una
 * reserva real por un problema en la lista de espera.
 *
 * Ciclo 58 (decisión del dueño 2026-10-23): además de anular los pedidos,
 * (1) deja esas residencias en los FAVORITOS del estudiante
 * (`student_favorites`, sin duplicar) para que decida si las mantiene o las
 * quita desde `/students/favorites`, y (2) le manda UNA notificación in-app
 * (tipo `student_favorites`, enlace a esa pantalla) con cuáles se anularon y
 * por qué. Devuelve las entradas anuladas (vacío ante cualquier error).
 */
export async function removeWaitlistEntriesOnConfirmedReservation(
  admin: SupabaseClient,
  params: { studentProfileId: string; reason?: "reservation" | "renewal" },
): Promise<RemovedWaitlistEntry[]> {
  const buildRemoval = (preserveStayChange: boolean) => {
    let removal = admin
      .from("waitlist_entries")
      .update({ status: "removed_due_to_confirmed_reservation", removed_at: new Date().toISOString() })
      .eq("student_profile_id", params.studentProfileId)
      .in("status", ["active", "availability_notification_sent", "retention_check_sent"]);
    // DR3 (docs/04 §12bis.4, supuesto): confirmar una RENOVACIÓN no anula las listas creadas bajo el aviso "Quiero
    // cambiar" (DR2 habla de confirmar una reserva). Una reserva nueva sí las anula todas.
    if (preserveStayChange) removal = removal.is("stay_change_intent_id", null);
    return removal.select("id, residence_id, residences(name)");
  };
  const preserve = (params.reason ?? "reservation") === "renewal";
  let { data: entries, error } = await buildRemoval(preserve);
  // Migración 0044 sin aplicar: la columna no existe, no hay nada que preservar.
  if (preserve && isMissingSchemaError(error)) ({ data: entries, error } = await buildRemoval(false));
  if (error) {
    console.error("[waitlist] removeWaitlistEntriesOnConfirmedReservation failed:", error);
    return [];
  }
  const removed: RemovedWaitlistEntry[] = (entries ?? []).map((entry) => {
    const residence = entry.residences as unknown as { name: string | null } | null;
    return { id: entry.id as string, residenceId: entry.residence_id as string, residenceName: residence?.name ?? "una residencia" };
  });
  for (const entry of removed) {
    await createAuditLog(admin, {
      actorUserId: null,
      actorRole: "system",
      action: "waitlist_entry_removed_confirmed_reservation",
      entityType: "waitlist_entries",
      entityId: entry.id,
      source: "system",
    });
  }
  if (removed.length === 0) return removed;

  await keepRemovedResidencesAsFavorites(admin, params.studentProfileId, removed);
  await notifyStudent(admin, params.studentProfileId, removed, params.reason ?? "reservation");
  return removed;
}

async function keepRemovedResidencesAsFavorites(
  admin: SupabaseClient,
  studentProfileId: string,
  removed: RemovedWaitlistEntry[],
): Promise<void> {
  const { data: profile, error: profileError } = await admin
    .from("student_profiles")
    .select("user_id")
    .eq("id", studentProfileId)
    .maybeSingle();
  if (profileError || !profile) {
    console.error("[waitlist] no se pudo leer el perfil para guardar favoritos:", profileError);
    return;
  }
  const residenceIds = [...new Set(removed.map((r) => r.residenceId))];
  // Sin duplicar: `unique (student_profile_id, residence_id)` + ignoreDuplicates deja intactos los que ya eran favoritos.
  const { error } = await admin.from("student_favorites").upsert(
    residenceIds.map((residenceId) => ({
      student_profile_id: studentProfileId,
      residence_id: residenceId,
      added_by_role: "student",
      added_by_user_id: profile.user_id,
    })),
    { onConflict: "student_profile_id,residence_id", ignoreDuplicates: true },
  );
  if (error) console.error("[waitlist] no se pudieron guardar los favoritos:", error);
}

async function notifyStudent(
  admin: SupabaseClient,
  studentProfileId: string,
  removed: RemovedWaitlistEntry[],
  reason: "reservation" | "renewal",
): Promise<void> {
  const { data: profile } = await admin.from("student_profiles").select("user_id").eq("id", studentProfileId).maybeSingle();
  if (!profile) return;
  const names = [...new Set(removed.map((r) => r.residenceName))];
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
  const cause = reason === "renewal" ? "confirmaste la renovación de tu estadía" : "confirmaste una reserva";
  await createNotification(admin, {
    userId: profile.user_id as string,
    title: "Anulamos tus pedidos de lista de espera",
    body:
      `Como ${cause}, anulamos tu lugar en la lista de espera de: ${list}. ` +
      "Dejamos esas residencias en tus favoritos: entrá para decidir si las mantenés o las quitás.",
    relatedEntityType: "student_favorites",
  });
}
