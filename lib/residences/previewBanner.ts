import { getVerificationProgress, type VerificationProgress } from "@/lib/residences/verificationStages";

/**
 * Texto del aviso de la vista previa de la ficha (`/residence/[id]/preview`). Función pura. El aviso nunca promete publicación ni plazos:
 *  - Residencia que todavía no se publicó (configuración o en verificación): «Todavía no es pública».
 *  - Residencia ya publicada (`verified_active`): ya es pública, y se aclara que lo que espera revisión de Soporte no se ve.
 *  - Estados fuera del recorrido (pausada, suspendida, archivada): sin afirmar nada sobre si es pública.
 */
export interface PreviewBannerCopy {
  /** Primera frase, en negrita. */
  lead: string;
  /** Resto del aviso. */
  body: string;
  progress: VerificationProgress | null;
}

export function previewBannerCopy(status: string): PreviewBannerCopy {
  const progress = getVerificationProgress(status);
  const lead = "Vista previa de tu ficha.";
  if (status === "verified_active") {
    return { lead, body: "Así la ven los estudiantes. Los cambios que esperan revisión de Soporte todavía no se ven acá.", progress };
  }
  if (progress) {
    return { lead, body: "Así la verán los estudiantes cuando se publique. Todavía no es pública.", progress };
  }
  return { lead, body: "Así se ve con lo último que guardaste.", progress };
}
