"use server";

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createAuditLog } from "@/lib/audit";
import { getAdminSession } from "@/lib/auth/requireAdmin";

export type DocumentAccessResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Acceso justificado a un documento sensible (docs/09 §18.2): genera el
 * signed URL solo después de registrar un motivo declarado, con su
 * propio audit log (`document_accessed`) — nunca un simple "se
 * accedió". Llamada directamente desde componentes cliente (no como
 * `<form action>` ligado): necesitamos abrir el link en una pestaña
 * nueva solo si el motivo fue válido, no redirigir la página actual.
 */
export async function requestDocumentAccess(fileId: string, reason: string): Promise<DocumentAccessResult> {
  const sessionUser = await getAdminSession();
  if (!sessionUser) {
    return { ok: false, error: "No tenés permiso para esta acción." };
  }

  const trimmedReason = reason.trim();
  if (trimmedReason.length < 10) {
    return { ok: false, error: "Escribí un motivo de al menos 10 caracteres." };
  }

  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: "No disponible en este momento." };

  const { data: file } = await admin.from("files").select("bucket, storage_path").eq("id", fileId).maybeSingle();
  if (!file) return { ok: false, error: "Ese documento ya no existe." };

  const { data: signed, error: signError } = await admin.storage.from(file.bucket).createSignedUrl(file.storage_path, 300);
  if (signError || !signed) return { ok: false, error: "No pudimos generar el link del documento." };

  const { error: logError } = await admin.from("document_access_log").insert({
    file_id: fileId,
    admin_user_id: sessionUser.id,
    reason_text: trimmedReason,
  });
  if (logError) {
    console.error("[document-access] log insert failed:", logError);
    return { ok: false, error: "No pudimos registrar el acceso. Intentá de nuevo." };
  }

  await createAuditLog(admin, {
    actorUserId: sessionUser.id,
    actorRole: sessionUser.roles.includes("superadmin") ? "superadmin" : "admin",
    action: "document_accessed",
    entityType: "files",
    entityId: fileId,
    reasonText: trimmedReason,
    source: "admin",
  });

  return { ok: true, url: signed.signedUrl };
}
