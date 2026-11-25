"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { saveReservationCollection } from "@/lib/residences/reservationCollectionSave";

export type SaveCollectionResult = { status: "success"; updatedAccounts: number } | { status: "error"; message: string };

/**
 * Guardar el «Cobro de la reserva» (DR63): opciones activas, medios aceptados y datos de cobro. Acción fina: el permiso (SOLO el dueño,
 * ni siquiera el staff con `profile.edit`), la validación, la escritura en `pending_*` y la auditoría con datos enmascarados viven en
 * `lib/residences/reservationCollectionSave`. El cliente solo manda lo que el dueño tocó.
 */
export async function saveReservationCollectionAction(residenceId: string, rawInput: unknown): Promise<SaveCollectionResult> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró. Volvé a iniciar sesión." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento. Probá más tarde." };
  if (typeof residenceId !== "string" || !residenceId) return { status: "error", message: "No encontramos la residencia." };
  if (rawInput === null || typeof rawInput !== "object" || Array.isArray(rawInput)) return { status: "error", message: "Los datos enviados no son válidos." };
  const input = rawInput as { modes?: unknown; methods?: unknown; accounts?: unknown };

  const result = await saveReservationCollection(admin, {
    actorUserId: sessionUser.id,
    residenceId,
    modes: input.modes,
    methods: input.methods,
    accounts: input.accounts,
  });
  if (!result.ok) return { status: "error", message: result.error };

  revalidatePath(`/residence/${residenceId}/collection`);
  revalidatePath(`/residence/${residenceId}/profile`);
  revalidatePath("/residence/dashboard");
  revalidatePath("/residencias/[slug]", "page");
  return { status: "success", updatedAccounts: result.updatedAccounts };
}
