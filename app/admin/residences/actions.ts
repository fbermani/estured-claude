"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { setResidencePausedByAdmin } from "@/lib/residences/setResidencePausedByAdmin";
import { setOperationalAccessByAdmin } from "@/lib/residences/setOperationalAccessByAdmin";
import { setResidenceLocationByAdmin } from "@/lib/residences/setResidenceLocationByAdmin";
import { geocodeResidenceByAdmin } from "@/lib/residences/geocodeResidence";
import { getAdminSession } from "@/lib/auth/requireAdmin";

export type PauseResidenceActionState = { status: "idle" | "error" | "saved"; message?: string };

async function runToggle(residenceId: string, paused: boolean, reason: string): Promise<PauseResidenceActionState> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) {
    return { status: "error", message: "Tu sesión expiró." };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await setResidencePausedByAdmin(admin, {
    residenceId,
    actorUserId: sessionUser.id,
    actorRole: sessionUser.primaryRole,
    paused,
    reason,
  });
  if (result.status === "error") return { status: "error", message: result.message };

  revalidatePath("/admin/residences");
  return { status: "saved", message: paused ? "Residencia pausada." : "Residencia reactivada." };
}

export async function pauseResidenceAction(
  residenceId: string,
  _prev: PauseResidenceActionState,
  formData: FormData,
): Promise<PauseResidenceActionState> {
  return runToggle(residenceId, true, String(formData.get("reason") ?? ""));
}

export async function reactivateResidenceAction(residenceId: string): Promise<PauseResidenceActionState> {
  return runToggle(residenceId, false, "");
}

export type OperationalAccessActionState = { status: "idle" | "error" | "saved"; message?: string };

async function runOperationalAccessToggle(
  residenceId: string,
  granted: boolean,
  reason: string,
  expiresAt: string | null,
): Promise<OperationalAccessActionState> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) {
    return { status: "error", message: "Tu sesión expiró." };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await setOperationalAccessByAdmin(admin, {
    residenceId,
    actorUserId: sessionUser.id,
    actorRole: sessionUser.primaryRole,
    granted,
    reason,
    expiresAt,
  });
  if (result.status === "error") return { status: "error", message: result.message };

  revalidatePath("/admin/residences");
  return { status: "saved", message: granted ? "Acceso a Gestión Operativa otorgado." : "Acceso a Gestión Operativa revocado." };
}

export async function grantOperationalAccessAction(
  residenceId: string,
  _prev: OperationalAccessActionState,
  formData: FormData,
): Promise<OperationalAccessActionState> {
  const expiresAt = String(formData.get("expires_at") ?? "").trim();
  return runOperationalAccessToggle(residenceId, true, String(formData.get("reason") ?? ""), expiresAt || null);
}

export async function revokeOperationalAccessAction(
  residenceId: string,
  _prev: OperationalAccessActionState,
  formData: FormData,
): Promise<OperationalAccessActionState> {
  return runOperationalAccessToggle(residenceId, false, String(formData.get("reason") ?? ""), null);
}

export type ResidenceLocationActionState = { status: "idle" | "error" | "saved"; message?: string };

/** Carga la coordenada de la residencia para el mapa público. Solo admin. */
export async function updateResidenceLocationAction(
  residenceId: string,
  _prev: ResidenceLocationActionState,
  formData: FormData,
): Promise<ResidenceLocationActionState> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await setResidenceLocationByAdmin(admin, {
    residenceId,
    actorUserId: sessionUser.id,
    actorRole: sessionUser.primaryRole,
    latitude: formData.get("latitude"),
    longitude: formData.get("longitude"),
  });
  if (result.status === "error") return { status: "error", message: result.message };

  revalidatePath(`/admin/residences/${residenceId}`);
  revalidatePath("/residencias", "layout");
  return {
    status: "saved",
    message:
      result.lat === null
        ? "Quitamos la coordenada: el mapa muestra la ubicación aproximada del barrio."
        : `Ubicación guardada: ${result.lat}, ${result.lng}.`,
  };
}

/** DF6: identifica la coordenada desde la dirección de la residencia (Nominatim). Solo admin. */
export async function geocodeResidenceAction(
  residenceId: string,
): Promise<ResidenceLocationActionState> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) return { status: "error", message: "Tu sesión expiró." };
  const admin = getSupabaseAdmin();
  if (!admin) return { status: "error", message: "No disponible en este momento." };

  const result = await geocodeResidenceByAdmin(admin, {
    residenceId,
    actorUserId: sessionUser.id,
    actorRole: sessionUser.primaryRole,
  });
  if (result.status === "error") return { status: "error", message: result.message };
  if (result.status === "not_found")
    return {
      status: "error",
      message: "No pudimos ubicar esa dirección. Revisá que esté completa o cargá la coordenada a mano.",
    };

  revalidatePath(`/admin/residences/${residenceId}`);
  revalidatePath("/residencias", "layout");
  return { status: "saved", message: `Ubicación identificada: ${result.lat}, ${result.lng}. Revisá el pin y corregilo a mano si hace falta.` };
}
