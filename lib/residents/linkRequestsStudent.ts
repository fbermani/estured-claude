import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog, notifyAdmins } from "@/lib/audit";
import { notifyResidenceTeam } from "@/lib/residences/notifyResidenceTeam";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import {
  checkCanRequestLink,
  cleanShortText,
  LINK_REQUEST_MESSAGE_MAX,
  MAX_MISSING_RESIDENCE_REQUESTS,
  normalizeHouseCode,
} from "@/lib/residents/linkRequestRules";

/**
 * Solicitud de vínculo del estudiante alojado que se registra solo (DR19, lado estudiante). Nunca vincula nada: crea una solicitud
 * `pending` que la residencia aprueba o rechaza. Validación en el servidor; la identidad sale de la sesión.
 */

const NOT_AVAILABLE = "Esta función todavía no está disponible en este entorno. Avisá a Soporte.";
const GENERIC = "No pudimos enviar la solicitud. Intentá de nuevo.";
const CODE_INVALID = "Ese código no coincide con ninguna residencia. Revisalo o elegí tu residencia de la lista.";

async function studentProfileOf(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await admin.from("student_profiles").select("id").eq("user_id", userId).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/** Residencia (solo `verified_active`) dueña de un código de casa, o `null`. Nunca revela nada de residencias no publicadas. */
export async function findResidenceByHouseCode(admin: SupabaseClient, rawCode: unknown): Promise<{ id: string; name: string } | null> {
  const code = normalizeHouseCode(rawCode);
  if (!code) return null;
  const { data: priv, error } = await admin.from("residence_private_details").select("residence_id").eq("house_code", code).maybeSingle();
  if (error || !priv) return null;
  const { data: residence } = await admin
    .from("residences")
    .select("id, name, status")
    .eq("id", (priv as { residence_id: string }).residence_id)
    .eq("status", "verified_active")
    .maybeSingle();
  return residence ? { id: (residence as { id: string }).id, name: (residence as { name: string }).name } : null;
}

export async function submitLinkRequest(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId?: string | null; houseCode?: string | null; message?: string | null },
): Promise<{ ok: true; residenceName: string } | { ok: false; error: string }> {
  const studentProfileId = await studentProfileOf(admin, params.actorUserId);
  if (!studentProfileId) return { ok: false, error: "Solo las cuentas de estudiante pueden pedir este vínculo." };

  let residenceId = params.residenceId ?? null;
  let viaHouseCode = false;
  if (params.houseCode && String(params.houseCode).trim()) {
    const found = await findResidenceByHouseCode(admin, params.houseCode);
    if (!found) return { ok: false, error: CODE_INVALID };
    residenceId = found.id;
    viaHouseCode = true;
  }
  if (!residenceId) return { ok: false, error: "Elegí tu residencia o ingresá el código de casa." };

  const { data: residence } = await admin.from("residences").select("id, name").eq("id", residenceId).eq("status", "verified_active").maybeSingle();
  if (!residence) return { ok: false, error: "No encontramos esa residencia. Elegí otra de la lista." };

  const [{ data: current }, { data: pending, error: pendingError }] = await Promise.all([
    admin.from("resident_stays").select("id").eq("student_profile_id", studentProfileId).eq("is_current", true).limit(1),
    admin.from("resident_link_requests").select("id, residence_id").eq("student_profile_id", studentProfileId).eq("status", "pending"),
  ]);
  if (pendingError) {
    if (isMissingSchemaError(pendingError)) return { ok: false, error: NOT_AVAILABLE };
    console.error("[residents] submitLinkRequest read failed:", pendingError);
    return { ok: false, error: GENERIC };
  }
  const pendings = (pending ?? []) as { residence_id: string }[];
  const check = checkCanRequestLink({
    hasCurrentStay: (current ?? []).length > 0,
    pendingTotal: pendings.length,
    pendingInSameResidence: pendings.some((p) => p.residence_id === residenceId),
  });
  if (!check.ok) return check;

  const { data: created, error } = await admin
    .from("resident_link_requests")
    .insert({
      student_profile_id: studentProfileId,
      residence_id: residenceId,
      status: "pending",
      message: cleanShortText(params.message, LINK_REQUEST_MESSAGE_MAX),
      via_house_code: viaHouseCode,
    })
    .select("id")
    .single();
  if (error || !created) {
    if (error?.code === "23505") return { ok: false, error: "Ya le mandaste una solicitud a esa residencia. Esperá su respuesta." };
    console.error("[residents] submitLinkRequest insert failed:", error);
    return { ok: false, error: GENERIC };
  }
  const requestId = (created as { id: string }).id;

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "student",
    action: "resident_link_requested",
    entityType: "resident_link_requests",
    entityId: requestId,
    newValue: { residence_id: residenceId, via_house_code: viaHouseCode },
  });
  await notifyResidenceTeam(admin, { residenceId: residenceId!, event: "new_resident_link_request", entityId: requestId });
  return { ok: true, residenceName: (residence as { name: string }).name };
}

/** El estudiante retira una solicitud suya todavía pendiente. */
export async function cancelLinkRequest(
  admin: SupabaseClient,
  params: { actorUserId: string; requestId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const studentProfileId = await studentProfileOf(admin, params.actorUserId);
  if (!studentProfileId) return { ok: false, error: "No encontramos tu perfil de estudiante." };
  const { data, error } = await admin
    .from("resident_link_requests")
    .delete()
    .eq("id", params.requestId)
    .eq("student_profile_id", studentProfileId)
    .eq("status", "pending")
    .select("id");
  if (error) {
    console.error("[residents] cancelLinkRequest failed:", error);
    return { ok: false, error: GENERIC };
  }
  if (!data || data.length === 0) return { ok: false, error: "Esa solicitud ya no está pendiente." };
  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "student",
    action: "resident_link_cancelled",
    entityType: "resident_link_requests",
    entityId: params.requestId,
  });
  return { ok: true };
}

/** «Mi residencia no está»: nombre + contacto opcional. Sin PII innecesaria; avisa a los admins. */
export async function submitMissingResidence(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceName: unknown; contact?: unknown },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const studentProfileId = await studentProfileOf(admin, params.actorUserId);
  if (!studentProfileId) return { ok: false, error: "Solo las cuentas de estudiante pueden dejar este aviso." };
  const name = cleanShortText(params.residenceName, 120);
  if (!name || name.length < 2) return { ok: false, error: "Contanos el nombre de tu residencia." };
  const contact = cleanShortText(params.contact, 120);

  const { count, error: countError } = await admin
    .from("missing_residence_requests")
    .select("id", { count: "exact", head: true })
    .eq("student_profile_id", studentProfileId);
  if (countError) {
    if (isMissingSchemaError(countError)) return { ok: false, error: NOT_AVAILABLE };
    console.error("[residents] submitMissingResidence count failed:", countError);
    return { ok: false, error: GENERIC };
  }
  if ((count ?? 0) >= MAX_MISSING_RESIDENCE_REQUESTS) return { ok: false, error: "Ya nos avisaste de varias residencias. Gracias: las estamos revisando." };

  const { data: created, error } = await admin
    .from("missing_residence_requests")
    .insert({ student_profile_id: studentProfileId, residence_name: name, contact })
    .select("id")
    .single();
  if (error || !created) {
    console.error("[residents] submitMissingResidence insert failed:", error);
    return { ok: false, error: GENERIC };
  }
  const id = (created as { id: string }).id;
  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "student",
    action: "missing_residence_reported",
    entityType: "missing_residence_requests",
    entityId: id,
    newValue: { has_contact: !!contact },
  });
  await notifyAdmins(admin, {
    title: "Un estudiante dice que su residencia no está en EstuRed",
    body: `Nombre indicado: ${name.slice(0, 80)}. Podés contactar a la residencia para invitarla.`,
    entityType: "missing_residence_requests",
    entityId: id,
  });
  return { ok: true };
}
