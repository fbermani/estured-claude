import type { AvailabilityMode, Residence, RoomTypeName, VerificationStatus } from "@/types/domain";
import { withoutOtherUniversity } from "@/lib/data/buenosAiresUniversities";
import { nearestUniversityNames } from "@/lib/residences/nearestUniversities";
import { normalizeAmenityLists } from "@/lib/residences/amenityDetails";

/**
 * Miniatura de la configuración de residencia: arma el `Residence` que consume la tarjeta REAL del catálogo (`SearchResultCard`) a partir de
 * lo que hay hoy en el formulario (servicios, áreas, universidades, tipos y tarifas), la foto de portada real y la disponibilidad ya
 * guardada. Lógica pura. No inventa nada: lo que el formulario no sabe (reseñas, residentes) no se pasa.
 */
const ROOM_NAMES: readonly string[] = ["Individual", "Doble", "Triple", "Cuádruple", "Compartida"];
const GENDERS = ["mixto", "solo_mujeres", "solo_hombres"] as const;

export type PreviewPhoto = { url: string; pending: boolean; isCover?: boolean };
export type PreviewRoomType = { name: string; monthlyPriceUsd: number; roomCount: number; capacityPerRoom: number; genderPolicy?: string };

/** Foto de portada pública: la marcada como portada entre las aprobadas, si no la primera aprobada. Las pendientes no las ve el público. */
export function pickPreviewCover(photos: readonly PreviewPhoto[]): string | null {
  const approved = photos.filter((p) => !p.pending);
  return (approved.find((p) => p.isCover) ?? approved[0])?.url ?? null;
}

export function buildPreviewResidence(input: {
  slug: string;
  name: string;
  zone: string;
  /** `residences.status`: solo «verified_active» lleva el sello de verificada. */
  status: string;
  /** Disponibilidad ya guardada (misma regla que el catálogo: `residenceAvailabilityMode`). */
  availabilityMode: AvailabilityMode;
  description: string;
  services: Iterable<string>;
  commonAreas: Iterable<string>;
  /** Ítems «Otro» ya aprobados (los pendientes y rechazados no los ve el público). */
  approvedExtraServices?: Iterable<string>;
  approvedExtraAreas?: Iterable<string>;
  nearUniversities: Iterable<string>;
  roomTypes: readonly PreviewRoomType[];
  photos: readonly PreviewPhoto[];
  location: { lat: number; lng: number } | null;
}): Residence {
  const verificationStatus: VerificationStatus = input.status === "verified_active" ? "verified_active" : "pending_verification";
  const mode = input.availabilityMode;
  const canRequest = mode !== "full" && mode !== "not_updated" && mode !== "paused_by_residence" && mode !== "paused_by_admin";

  const typed = input.roomTypes.filter((rt) => ROOM_NAMES.includes(rt.name));
  const prices = typed.map((rt) => rt.monthlyPriceUsd).filter((p) => Number.isFinite(p) && p > 0);
  const places = input.roomTypes.reduce((sum, rt) => sum + Math.max(0, rt.roomCount) * Math.max(0, rt.capacityPerRoom), 0);
  const genders = [...new Set(input.roomTypes.map((rt) => rt.genderPolicy).filter((g): g is (typeof GENDERS)[number] => (GENDERS as readonly string[]).includes(g ?? "")))];
  const near = withoutOtherUniversity([...input.nearUniversities]);
  const cover = pickPreviewCover(input.photos);
  const { services, commonAreas } = normalizeAmenityLists({
    services: [...new Set([...input.services, ...(input.approvedExtraServices ?? [])])],
    commonAreas: [...new Set([...input.commonAreas, ...(input.approvedExtraAreas ?? [])])],
  });

  return {
    slug: input.slug,
    name: input.name,
    zone: input.zone || "CABA",
    city: "CABA",
    mode: "perfil_verificado",
    verificationStatus,
    availabilityMode: mode,
    published: input.status === "verified_active",
    priceFromUsd: prices.length > 0 ? Math.min(...prices) : 0,
    matriculaUsd: null,
    depositoUsd: null,
    roomTypes: typed.map((rt) => ({ type: rt.name as RoomTypeName, priceUsd: rt.monthlyPriceUsd, available: canRequest })),
    services,
    commonAreas,
    highlightedRules: [],
    nearUniversities: near,
    cardUniversities: nearestUniversityNames(near, input.location),
    idealFor: "",
    description: input.description,
    photos: cover ? [cover] : [],
    hasWaitlist: mode === "full",
    availabilityHint: mode === "full" ? "waitlist" : mode === "not_updated" ? "not_updated" : null,
    capacityPlaces: places > 0 ? places : undefined,
    latitude: input.location?.lat ?? null,
    longitude: input.location?.lng ?? null,
    ...(genders.length > 0 ? { genderPolicy: genders.length === 1 ? genders[0] : ("mixto" as const), genderPolicies: genders } : {}),
  };
}
