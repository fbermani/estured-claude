import type { CommunityProfileCard } from "@/lib/residents/communityVisibility";

export type PreviewProfile = {
  id: string;
  roomTypeName: string | null;
  firstName: string;
  age: number | null;
  flag: string | null;
  nationality: string | null;
  career: string | null;
  originCity: string | null;
};
export type PreviewSlot = { id: string; roomTypeName: string | null };

/**
 * Datos mínimos para dibujar los perfiles de la comunidad (ficha y modal de /search). El visitante solo recibe un
 * «lugar» por perfil visible (tipo de habitación); los registrados, nombre de pila, edad, origen y carrera.
 */
export function toPreviewData(cards: readonly CommunityProfileCard[], isGuest: boolean): { profiles: PreviewProfile[]; slots: PreviewSlot[] } {
  const visible = cards.filter((c) => c.kind === "profile");
  if (isGuest) return { profiles: [], slots: visible.map((c) => ({ id: c.residentStayId, roomTypeName: c.roomTypeName })) };
  return {
    slots: [],
    profiles: visible.flatMap((c) =>
      c.firstName
        ? [{ id: c.residentStayId, roomTypeName: c.roomTypeName, firstName: c.firstName, age: c.age ?? null, flag: c.countryFlag ?? null, nationality: c.nationality ?? null, career: c.career ?? null, originCity: c.originCity ?? null }]
        : [],
    ),
  };
}
