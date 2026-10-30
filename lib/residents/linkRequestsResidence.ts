import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { createNotification } from "@/lib/notifications/createNotification";
import { assertResidencePermission } from "@/lib/residences/access";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { randomInt } from "node:crypto";
import { cleanShortText, HOUSE_CODE_ALPHABET, HOUSE_CODE_LENGTH } from "@/lib/residents/linkRequestRules";
import { linkStayToReservationIfMissing } from "@/lib/residents/linkReservation";
import { checkStudentCanLink } from "@/lib/residents/studentLinkGuards";

/**
 * Cola «Solicitudes de vínculo» y código de casa (DR19, lado residencia). Permiso `residents.manage`, validado acá en el servidor.
 * Aprobar une al estudiante a una estadía sin cuenta de ESTA residencia (o crea una); nunca se aprueba sola.
 */

const GENERIC = "No pudimos completar la acción. Intentá de nuevo.";
const NOT_AVAILABLE = "Esta función todavía no está disponible en este entorno. Avisá a Soporte.";

/** Código de casa aleatorio (CSPRNG). */
export function generateHouseCode(): string {
  let code = "";
  for (let i = 0; i < HOUSE_CODE_LENGTH; i++) code += HOUSE_CODE_ALPHABET[randomInt(0, HOUSE_CODE_ALPHABET.length)];
  return code;
}

/** Genera (o reemplaza) el código de casa. El anterior deja de servir. Reintenta si choca con el de otra residencia. */
export async function regenerateHouseCode(
  admin: SupabaseClient,
  params: { actorUserId: string; residenceId: string },
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, "residents.manage");
  if (!access.ok) return { ok: false, error: access.error };
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateHouseCode();
    const { data, error } = await admin
      .from("residence_private_details")
      .update({ house_code: code })
      .eq("residence_id", params.residenceId)
      .select("residence_id");
    if (error) {
      if (error.code === "23505") continue;
      if (isMissingSchemaError(error)) return { ok: false, error: NOT_AVAILABLE };
      console.error("[residents] regenerateHouseCode failed:", error);
      return { ok: false, error: GENERIC };
    }
    if (!data || data.length === 0) return { ok: false, error: GENERIC };
    await createAuditLog(admin, {
      actorUserId: params.actorUserId,
      actorRole: access.actorRole,
      action: "residence_house_code_regenerated",
      entityType: "residences",
      entityId: params.residenceId,
      newValue: { permission: access.permission },
    });
    return { ok: true, code };
  }
  return { ok: false, error: GENERIC };
}

export type LinkRequestForResidence = {
  id: string;
  createdAt: string;
  message: string | null;
  viaHouseCode: boolean;
  studentName: string;
  studentProfileId: string;
  matchedStayId: string | null;
};

/** Pendientes de la residencia con el nombre corto del estudiante (nombre + inicial). Tolerante a la 0064 sin aplicar. */
export async function loadPendingLinkRequests(admin: SupabaseClient, residenceId: string): Promise<LinkRequestForResidence[]> {
  const { data, error } = await admin
    .from("resident_link_requests")
    .select("id, created_at, message, via_house_code, student_profile_id, matched_stay_id, student_profiles(first_name, last_initial)")
    .eq("residence_id", residenceId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) {
    if (!isMissingSchemaError(error)) console.error("[residents] loadPendingLinkRequests failed:", error);
    return [];
  }
  return ((data ?? []) as unknown as {
    id: string;
    created_at: string;
    message: string | null;
    via_house_code: boolean;
    student_profile_id: string;
    matched_stay_id: string | null;
    student_profiles: { first_name: string; last_initial: string } | null;
  }[]).map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    message: r.message,
    viaHouseCode: r.via_house_code,
    studentProfileId: r.student_profile_id,
    matchedStayId: r.matched_stay_id,
    studentName: r.student_profiles ? `${r.student_profiles.first_name} ${r.student_profiles.last_initial}`.trim() : "Estudiante",
  }));
}

export async function resolveLinkRequest(
  admin: SupabaseClient,
  params: {
    actorUserId: string;
    residenceId: string;
    requestId: string;
    decision: "approve" | "reject";
    /** Solo con `approve`: estadía sin cuenta de esta residencia a la que unirla. Sin ella se usa la que la solicitud ya traía (enlace sin mail) o se crea una nueva. */
    stayId?: string | null;
    note?: string | null;
    now?: Date;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const access = await assertResidencePermission(admin, params.actorUserId, params.residenceId, "residents.manage");
  if (!access.ok) return { ok: false, error: access.error };
  const now = (params.now ?? new Date()).toISOString();

  const { data: request, error: readError } = await admin
    .from("resident_link_requests")
    .select("id, student_profile_id, residence_id, status, matched_stay_id")
    .eq("id", params.requestId)
    .eq("residence_id", params.residenceId)
    .maybeSingle();
  if (readError) {
    if (isMissingSchemaError(readError)) return { ok: false, error: NOT_AVAILABLE };
    console.error("[residents] resolveLinkRequest read failed:", readError);
    return { ok: false, error: GENERIC };
  }
  if (!request) return { ok: false, error: "Esa solicitud no pertenece a esta residencia." };
  const req = request as { id: string; student_profile_id: string; status: string; matched_stay_id: string | null };
  if (req.status !== "pending") return { ok: false, error: "Esa solicitud ya fue resuelta." };

  if (params.decision === "approve") {
    const guard = await checkStudentCanLink(admin, req.student_profile_id);
    if (!guard.ok) return { ok: false, error: guard.error.replace(/^Ya tenés/, "Esta persona ya tiene").replace(/^Para vincular tu estadía necesitás/, "Esta persona es menor de 18 y necesita antes") };
  }

  // 1) Reclamar la solicitud ANTES de tocar ninguna estadía: solo un request gana el `pending → resuelta` (sin estadías huérfanas por doble aprobación).
  const { data: claimed, error: claimError } = await admin
    .from("resident_link_requests")
    .update({
      status: params.decision === "approve" ? "approved" : "rejected",
      resolved_by: params.actorUserId,
      resolved_at: now,
      resolution_note: cleanShortText(params.note, 280),
    })
    .eq("id", req.id)
    .eq("status", "pending")
    .select("id");
  if (claimError) {
    console.error("[residents] resolveLinkRequest claim failed:", claimError);
    return { ok: false, error: GENERIC };
  }
  if (!claimed || claimed.length === 0) return { ok: false, error: "Esa solicitud ya fue resuelta o cambió mientras tanto. Recargá la página." };

  const revertClaim = async () => {
    const { error } = await admin
      .from("resident_link_requests")
      .update({ status: "pending", resolved_by: null, resolved_at: null, resolution_note: null, matched_stay_id: req.matched_stay_id })
      .eq("id", req.id);
    if (error) console.error("[residents] resolveLinkRequest revert failed:", error);
  };

  // 2) Vincular o crear la estadía; si algo falla, se deshace todo y la solicitud vuelve a `pending`.
  let matchedStayId: string | null = null;
  let createdStayId: string | null = null;
  if (params.decision === "approve") {
    const targetStayId = params.stayId || req.matched_stay_id || null;
    if (targetStayId) {
      const { data: stay } = await admin
        .from("resident_stays")
        .select("id, student_profile_id, is_current, residence_id")
        .eq("id", targetStayId)
        .eq("residence_id", params.residenceId)
        .maybeSingle();
      const s = stay as { id: string; student_profile_id: string | null; is_current: boolean } | null;
      if (!s || !s.is_current || s.student_profile_id) {
        await revertClaim();
        return { ok: false, error: "Esa estadía ya no está disponible para unir. Elegí otra o creá una nueva." };
      }
      let { data: linked, error: linkError } = await admin
        .from("resident_stays")
        .update({ student_profile_id: req.student_profile_id, status: "active", invite_phone: null })
        .eq("id", s.id)
        .is("student_profile_id", null)
        .select("id");
      if (linkError && isMissingSchemaError(linkError)) {
        ({ data: linked, error: linkError } = await admin.from("resident_stays").update({ student_profile_id: req.student_profile_id, status: "active" }).eq("id", s.id).is("student_profile_id", null).select("id"));
      }
      if (linkError || !linked || linked.length === 0) {
        if (linkError) console.error("[residents] resolveLinkRequest link failed:", linkError);
        await revertClaim();
        return { ok: false, error: linkError ? GENERIC : "Esa estadía cambió mientras tanto. Recargá la página y probá de nuevo." };
      }
      // La estadía ya tiene dueño: cualquier invitación abierta deja de servir.
      await admin
        .from("resident_stay_invitations")
        .update({ revoked_at: now, revoke_reason: "linked_by_residence" })
        .eq("resident_stay_id", s.id)
        .is("used_at", null)
        .is("revoked_at", null);
      matchedStayId = s.id;
    } else {
      const { data: created, error: createError } = await admin
        .from("resident_stays")
        .insert({
          residence_id: params.residenceId,
          student_profile_id: req.student_profile_id,
          created_by_residence_user_id: params.actorUserId,
          status: "active",
        })
        .select("id")
        .single();
      if (createError || !created) {
        console.error("[residents] resolveLinkRequest create stay failed:", createError);
        await revertClaim();
        return { ok: false, error: GENERIC };
      }
      matchedStayId = createdStayId = (created as { id: string }).id;
    }

    const { error: matchError } = await admin.from("resident_link_requests").update({ matched_stay_id: matchedStayId }).eq("id", req.id);
    if (matchError) {
      console.error("[residents] resolveLinkRequest match failed:", matchError);
      if (createdStayId) await admin.from("resident_stays").delete().eq("id", createdStayId);
      await revertClaim();
      return { ok: false, error: GENERIC };
    }
    await linkStayToReservationIfMissing(admin, { residentStayId: matchedStayId, residenceId: params.residenceId, studentProfileId: req.student_profile_id });
  }

  const { data: residence } = await admin.from("residences").select("name").eq("id", params.residenceId).maybeSingle();
  const residenceName = (residence as { name?: string } | null)?.name ?? "la residencia";
  const { data: studentRow } = await admin.from("student_profiles").select("user_id").eq("id", req.student_profile_id).maybeSingle();
  const studentUserId = (studentRow as { user_id?: string } | null)?.user_id ?? null;

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: access.actorRole,
    action: params.decision === "approve" ? "resident_link_approved" : "resident_link_rejected",
    entityType: "resident_link_requests",
    entityId: req.id,
    newValue: { permission: access.permission, residence_id: params.residenceId, matched_existing_stay: !!matchedStayId && !createdStayId },
  });
  if (studentUserId) {
    await createNotification(admin, {
      userId: studentUserId,
      title: params.decision === "approve" ? `${residenceName} aprobó tu vínculo` : `${residenceName} no aprobó tu solicitud de vínculo`,
      body:
        params.decision === "approve"
          ? "Ya figurás como residente. Podés ver tu estadía en Mi residencia."
          : "Si creés que es un error, hablá con la residencia o escribinos a Soporte.",
      relatedEntityType: "resident_stays",
      relatedEntityId: matchedStayId ?? undefined,
    });
  }
  return { ok: true };
}
