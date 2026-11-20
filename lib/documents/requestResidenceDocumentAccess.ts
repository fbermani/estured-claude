"use server";

import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/security/rateLimit";
import {
  DOCUMENT_NOT_AVAILABLE_MESSAGE,
  grantResidenceDocumentAccess,
  type ResidenceDocumentAccessResult,
} from "@/lib/documents/residenceDocumentAccess";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESIDENCE_DOCUMENT_OPENS_PER_HOUR = 60;

/**
 * DR48: la residencia abre un documento de un residente o de un solicitante con el pago habilitado. Sin motivo, con registro.
 * Se llama desde un componente cliente (no `<form action>`): abre el link firmado en una pestaña nueva solo si todo salió bien.
 * La autorización completa vive en `grantResidenceDocumentAccess` y se deriva de la base.
 */
export async function requestResidenceDocumentAccess(residenceId: string, fileId: string): Promise<ResidenceDocumentAccessResult> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { ok: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  if (typeof residenceId !== "string" || typeof fileId !== "string" || !UUID.test(residenceId) || !UUID.test(fileId)) {
    return { ok: false, error: DOCUMENT_NOT_AVAILABLE_MESSAGE };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: "No disponible en este momento. Probá más tarde." };

  const rate = await consumeRateLimit(
    { bucket: "residence_document_open", key: sessionUser.id, windowSeconds: 3_600, max: RESIDENCE_DOCUMENT_OPENS_PER_HOUR },
    admin,
  );
  if (!rate.ok) return { ok: false, error: "Abriste muchos documentos seguidos. Probá de nuevo en un rato." };

  return grantResidenceDocumentAccess(admin, { userId: sessionUser.id, residenceId, fileId });
}
