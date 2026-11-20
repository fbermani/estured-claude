"use server";

import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/security/rateLimit";
import { DOCUMENT_NOT_AVAILABLE_MESSAGE } from "@/lib/documents/residenceDocumentAccess";
import { grantStudentIdentityNumberAccess } from "@/lib/documents/studentIdentityNumberAccess";
import { IDENTITY_DOCUMENT_TYPE_LABELS } from "@/lib/students/identityDocument";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDENTITY_NUMBER_READS_PER_HOUR = 60;

export type RevealedIdentityNumber = { ok: true; typeLabel: string; number: string } | { ok: false; error: string };

/**
 * DR58 fase 2: la residencia pide ver el número de documento de un residente o de un solicitante con reserva confirmada.
 * Por pedido explícito (botón «Ver número»), nunca en la carga de la pantalla. La autorización y el registro viven en
 * `grantStudentIdentityNumberAccess`; acá solo se valida la entrada y se frena el abuso.
 */
export async function requestStudentIdentityNumber(residenceId: string, studentProfileId: string): Promise<RevealedIdentityNumber> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { ok: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };
  if (typeof residenceId !== "string" || typeof studentProfileId !== "string" || !UUID.test(residenceId) || !UUID.test(studentProfileId)) {
    return { ok: false, error: DOCUMENT_NOT_AVAILABLE_MESSAGE };
  }
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: "No disponible en este momento. Probá más tarde." };

  const rate = await consumeRateLimit(
    { bucket: "student_identity_number_read", key: sessionUser.id, windowSeconds: 3_600, max: IDENTITY_NUMBER_READS_PER_HOUR },
    admin,
  );
  if (!rate.ok) return { ok: false, error: "Viste muchos documentos seguidos. Probá de nuevo en un rato." };

  const result = await grantStudentIdentityNumberAccess(admin, { userId: sessionUser.id, residenceId, studentProfileId });
  if (!result.ok) return result;
  return { ok: true, typeLabel: IDENTITY_DOCUMENT_TYPE_LABELS[result.documentType], number: result.number };
}
