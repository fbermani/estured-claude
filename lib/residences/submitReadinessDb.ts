import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { countEssentialFaqsReady } from "@/lib/faq/catalog";
import type { CatalogLoad } from "@/lib/faq/residenceCatalog";
import { loadCatalogForResidence } from "@/lib/faq/residenceCatalog";
import { loadCurrentRegulation } from "@/lib/regulations/current";
import type { ReservationCollectionConfig } from "@/lib/residences/reservationCollection";
import { loadReservationCollectionConfig } from "@/lib/residences/reservationCollectionDb";

/**
 * Datos de los requisitos para enviar a revisión (`computeSubmitReadiness`) que NO viajan en el formulario del perfil: viven en otras
 * pantallas (fotos, reglamento, preguntas). Los lee el servidor desde la base, tanto para la pantalla como para el gate del envío.
 */
export type SubmitReadinessExternal = {
  /** Fotos propias subidas, sin las rechazadas. */
  photos: number;
  /** Hay un PDF de reglamento cargado (no rechazado). */
  rulesPdf: boolean;
  /** Versión publicada propia o adaptada del modelo; `null` = no se puede saber en este entorno (migración pendiente). */
  regulationPublished: boolean | null;
  /** Preguntas esenciales listas; `null` = catálogo no disponible en este entorno (migración pendiente). */
  essentialFaqsReady: number | null;
  /** Cobro de la reserva (DR63): solo claves y estados, sin datos de cobro; `null` = migración 0102 pendiente en este entorno (no se exige). */
  reservationCollection: ReservationCollectionConfig | null;
};

/** El reglamento cuenta solo si hay una versión publicada que la residencia hizo suya: ni el modelo base sin adaptar ni un borrador. */
export function regulationPublishedFlag(res: Awaited<ReturnType<typeof loadCurrentRegulation>>): boolean | null {
  if (!res.ok) return null;
  if (!res.view.schemaReady) return null;
  return res.view.versionId !== null && !res.view.isBaseModel;
}

/** Preguntas esenciales listas, o `null` si el catálogo no existe todavía en este entorno. Un fallo real de lectura se maneja aparte. */
export function essentialFaqsReadyCount(catalog: CatalogLoad): number | null {
  if (!catalog.ok) return null;
  return countEssentialFaqsReady(catalog.entries);
}

/**
 * Lee de la base lo que hace falta para el gate. `ok: false` ante un error real de lectura (no se puede afirmar que el requisito se
 * cumple ni que falta: el envío se rechaza con un mensaje de reintento).
 */
export async function loadSubmitReadinessExternal(
  admin: SupabaseClient,
  residenceId: string,
): Promise<({ ok: true } & SubmitReadinessExternal) | { ok: false }> {
  const filesQuery = (documentType: string) =>
    admin
      .from("files")
      .select("id", { count: "exact", head: true })
      .eq("related_entity_type", "residences")
      .eq("related_entity_id", residenceId)
      .eq("document_type", documentType)
      .neq("status", "rejected");
  const [photosRes, pdfRes, regulation, catalog, collection] = await Promise.all([
    filesQuery("residence_photo"),
    filesQuery("residence_rules_document"),
    loadCurrentRegulation(admin, residenceId),
    loadCatalogForResidence(admin, residenceId),
    loadReservationCollectionConfig(admin, residenceId),
  ]);
  if (photosRes.error || pdfRes.error) {
    console.error("[submit-readiness] files read failed:", photosRes.error ?? pdfRes.error);
    return { ok: false };
  }
  if (!regulation.ok) return { ok: false };
  if (!catalog.ok && catalog.reason === "failed") return { ok: false };
  if (!collection.ok) return { ok: false };
  return {
    ok: true,
    photos: photosRes.count ?? 0,
    rulesPdf: (pdfRes.count ?? 0) > 0,
    regulationPublished: regulationPublishedFlag(regulation),
    essentialFaqsReady: essentialFaqsReadyCount(catalog),
    reservationCollection: collection.config,
  };
}
