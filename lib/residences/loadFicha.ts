import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { loadGenderAvailability } from "@/lib/availability/genderAvailabilityDb";
import { buildGalleryPhotos, loadPhotoMeta } from "@/lib/residences/photoMetaDb";
import { loadResidencePromotions } from "@/lib/residences/promotions";
import { loadVacancyOutlooks } from "@/lib/residences/vacancy";
import { pickActivePromotion, todayIso } from "@/lib/applications/reservationMoney";
import { computeCapacity } from "@/lib/residences/occupancy";
import { effectiveRoomGender, policyFromGender, summarizeTypeGenders } from "@/lib/residences/roomGender";
import { findPreviewResidence, findPublicResidence, type ResidenceRow } from "@/lib/residences/fichaResidence";

/**
 * Carga de datos de la ficha de una residencia (ficha pública y vista previa del equipo comparten esta lectura y el mismo render,
 * `components/residences/ficha/FichaView.tsx`). Cada consulta chequea su `error`: se registra y la ficha degrada (sin fotos, sin tipos,
 * etc.) en vez de caerse. El filtro de estado vive en `fichaResidence.ts`: la pública exige `verified_active`; la vista previa solo se
 * habilita tras comprobar el vínculo con la residencia.
 */
async function buildFichaData(admin: SupabaseClient, residence: ResidenceRow) {
  const [roomTypesRes, roomsRes, sectionsRes, photosRes, rulesFileRes, photoMeta, promotionsRes] = await Promise.all([
    admin
      .from("room_types")
      .select(
        "id, name, monthly_price_usd, capacity_per_room, gender_policy, bathroom_type, profile_availability(status, available_count, hidden_from_search_at)",
      )
      .eq("residence_id", residence.id)
      .eq("is_active", true),
    // "*": degrada sin error si la migración 0057 (rooms.gender) aún no está aplicada.
    admin.from("rooms").select("*").eq("residence_id", residence.id).eq("is_active", true),
    admin.from("residence_profile_sections").select("section_type, content").eq("residence_id", residence.id),
    admin
      .from("files")
      .select("id, storage_path")
      .eq("related_entity_type", "residences")
      .eq("related_entity_id", residence.id)
      .eq("document_type", "residence_photo")
      .eq("status", "approved")
      .order("created_at", { ascending: true }),
    // Reglamento en PDF: mismo mecanismo que las fotos (queda "approved"
    // cuando no requiere revisión, o tras aprobarse) — se genera un signed
    // URL de solo lectura, sin pasar por el flujo de "acceso justificado"
    // (ese flujo es para documentación interna sensible tipo DNI; el
    // reglamento es contenido público por diseño, mismo nivel de
    // confianza que el resumen de reglas en texto, ya público hoy).
    admin
      .from("files")
      .select("storage_path")
      .eq("related_entity_type", "residences")
      .eq("related_entity_id", residence.id)
      .eq("document_type", "residence_rules_document")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // DR18 (tanda 2): clasificación de fotos (degrada a «todo general» sin la 0059).
    loadPhotoMeta(admin, [residence.id]),
    // DR18 (tanda 3): promociones de tarifa (degrada a «sin promociones» sin la 0060).
    loadResidencePromotions(admin, residence.id),
  ]);
  if (roomTypesRes.error) console.error("[ficha] no se pudieron leer los tipos de habitación:", roomTypesRes.error);
  if (sectionsRes.error) console.error("[ficha] no se pudieron leer las secciones del perfil:", sectionsRes.error);
  if (photosRes.error) console.error("[ficha] no se pudieron leer las fotos:", photosRes.error);
  if (rulesFileRes.error) console.error("[ficha] no se pudo leer el reglamento:", rulesFileRes.error);

  const sectionMap = Object.fromEntries((sectionsRes.data ?? []).map((s) => [s.section_type, s.content]));
  const typeNames = new Map((roomTypesRes.data ?? []).map((rt) => [rt.id as string, rt.name as string]));
  const photos = buildGalleryPhotos(
    (photosRes.data ?? []) as { id: string; storage_path: string }[],
    photoMeta.byFileId,
    (path) => admin.storage.from("public-residence-media").getPublicUrl(path).data.publicUrl,
    typeNames,
  );
  // Plazas declaradas (Verificado): van en la bajada de «Habitaciones» de la franja «Lo esencial». Sin porcentaje ni «quedan N».
  const capacityPlaces = computeCapacity(
    (roomTypesRes.data ?? []).map((rt) => ({ id: rt.id as string, capacity_per_room: rt.capacity_per_room as number | null })),
    ((roomsRes.data ?? []) as { room_type_id: string }[]).map((r) => ({ room_type_id: r.room_type_id })),
  );

  // Lecturas que dependen del resultado anterior (ids de tipos, archivo del reglamento) pero no entre sí: en paralelo (auditoría 2026-11-19, R19-09).
  const roomTypeIds = (roomTypesRes.data ?? []).map((rt) => rt.id as string);
  const rulesPath = rulesFileRes.data?.storage_path as string | undefined;
  const [vacancyByType, rulesPdfUrl, genderAvailability] = await Promise.all([
    // Mes vacío confirmado: la ocupación futura por tipo solo se lee si la residencia configuró un % de mes vacío.
    Number(residence.empty_month_charge_percent) > 0
      ? loadVacancyOutlooks(admin, residence.id, roomTypeIds, todayIso())
      : Promise.resolve({} as Awaited<ReturnType<typeof loadVacancyOutlooks>>),
    rulesPath
      ? admin.storage
          .from("private-residence-documents")
          .createSignedUrl(rulesPath, 600)
          .then(({ data: signed, error: signedError }) => {
            if (signedError) console.error("[ficha] no se pudo firmar el reglamento:", signedError);
            return signed?.signedUrl ?? null;
          })
      : Promise.resolve(null),
    // profile_availability tiene unique(room_type_id) — PostgREST devuelve un objeto singular en el embed, no un array.
    // Disponibilidad por género (migración 0075): sin ella no hay detalle por género (queda por tipo).
    loadGenderAvailability(admin, roomTypeIds),
  ]);
  const normalizedRoomTypes = (roomTypesRes.data ?? []).map((rt) => {
    // Género por habitación (0057). Sin la columna o sin habitaciones: queda el género del tipo.
    const genders = ((roomsRes.data ?? []) as { room_type_id: string; gender?: string | null }[])
      .filter((r) => r.room_type_id === rt.id)
      .map((r) =>
        effectiveRoomGender({ roomGender: r.gender, typePolicy: rt.gender_policy, capacityPerRoom: rt.capacity_per_room }),
      );
    return { rt, genders };
  }).map(({ rt, genders }) => ({
    ...rt,
    // Promoción vigente de mayor % para este tipo (no se apilan); `monthly_price_usd` sigue siendo la tarifa de lista.
    promotion: pickActivePromotion(promotionsRes.promotions, rt.id, todayIso()),
    vacancy: vacancyByType[rt.id as string] ?? null,
    genderSummary: new Set(genders).size > 1 ? summarizeTypeGenders(genders) : null,
    gender_policy: new Set(genders).size === 1 ? (policyFromGender(genders[0]) ?? rt.gender_policy) : rt.gender_policy,
    profile_availability: rt.profile_availability as unknown as {
      status: string;
      available_count: number | null;
      hidden_from_search_at: string | null;
    } | null,
    genderRows: genderAvailability.byType.get(rt.id as string) ?? [],
  }));


  return { residence, roomTypes: normalizedRoomTypes, sectionMap, photos, rulesPdfUrl, capacityPlaces };
}

export type FichaData = Awaited<ReturnType<typeof buildFichaData>>;

/**
 * Una sola lectura por request: `generateMetadata` y la página la llaman con el mismo `slug` y `cache` evita repetir las ~6 consultas
 * (por eso los argumentos son primitivos). Solo residencias `verified_active`.
 */
async function loadPublicFichaUncached(slug: string): Promise<FichaData | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const residence = await findPublicResidence(admin, slug);
  return residence ? buildFichaData(admin, residence) : null;
}

/**
 * Segundos que la ficha pública se sirve desde caché (auditoría de costos 2026-11-21, C1). Solo guarda datos públicos de la
 * residencia (sin nada de la sesión: lo personal se lee aparte en `FichaView`). Un cambio de ficha, cupo o precio tarda hasta este
 * tiempo en verse en la ficha pública. El reglamento va con enlace firmado de 600 s, que sigue vigente durante todo el caché.
 */
export const PUBLIC_FICHA_REVALIDATE_SECONDS = 60;

const loadPublicFichaCached = unstable_cache(
  (slug: string) => loadPublicFichaUncached(slug),
  ["public-ficha-v1"],
  { revalidate: PUBLIC_FICHA_REVALIDATE_SECONDS, tags: ["catalog", "public-ficha"] },
);

export const loadPublicFicha = cache(async (slug: string): Promise<FichaData | null> => {
  // En tests (`NODE_ENV=test`) no hay caché de Next: se lee directo de la base.
  if (process.env.NODE_ENV === "test") return loadPublicFichaUncached(slug);
  return loadPublicFichaCached(slug);
});

/**
 * Vista previa de la ficha para el equipo de la residencia, en CUALQUIER estado (borrador, cambios pedidos, en verificación, publicada…).
 * Devuelve `null` si quien mira no es del equipo activo de ESA residencia: no se lee nada de la residencia sin ese vínculo.
 */
export const loadPreviewFicha = cache(async (userId: string, residenceId: string): Promise<FichaData | null> => {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const residence = await findPreviewResidence(admin, userId, residenceId);
  return residence ? buildFichaData(admin, residence) : null;
});
