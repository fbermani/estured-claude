import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuditLog } from "@/lib/audit";
import { assertResidenceAccess } from "@/lib/residences/access";

/**
 * Nota interna sobre un residente — sección "Notas Internas" de la
 * referencia `estured_admin_modal_perfil_del_residente`. Nunca visible
 * para el residente ni en la comunidad pública; solo el staff/dueño de
 * la residencia la ve (migración 0026).
 */
export async function addResidentNote(
  admin: SupabaseClient,
  params: {
    actorUserId: string;
    residenceId: string;
    residentStayId: string;
    category: "general" | "pagos";
    body: string;
  },
): Promise<{ ok: true; noteId: string } | { ok: false; error: string }> {
  const hasAccess = await assertResidenceAccess(admin, params.actorUserId, params.residenceId);
  if (!hasAccess) return { ok: false, error: "No tenés acceso a esta residencia." };

  const body = params.body.trim();
  if (body.length === 0) return { ok: false, error: "Escribí algo antes de guardar la nota." };
  if (body.length > 2000) return { ok: false, error: "La nota no puede superar los 2000 caracteres." };

  const { data: stay } = await admin
    .from("resident_stays")
    .select("id")
    .eq("id", params.residentStayId)
    .eq("residence_id", params.residenceId)
    .maybeSingle();
  if (!stay) return { ok: false, error: "Ese residente no pertenece a esta residencia." };

  const { data: note, error } = await admin
    .from("resident_notes")
    .insert({
      residence_id: params.residenceId,
      resident_stay_id: params.residentStayId,
      created_by_user_id: params.actorUserId,
      category: params.category,
      body,
    })
    .select("id")
    .single();
  if (error || !note) return { ok: false, error: "No pudimos guardar la nota." };

  await createAuditLog(admin, {
    actorUserId: params.actorUserId,
    actorRole: "residence_owner",
    action: "resident_note_added",
    entityType: "resident_notes",
    entityId: note.id,
    newValue: { resident_stay_id: params.residentStayId, category: params.category },
  });
  return { ok: true, noteId: note.id };
}
