import type { Residence } from "@/types/domain";

/** Lo mínimo (`id` = slug: las residencias del catálogo se identifican por él)  que necesita el mapa de /search en el cliente (no se mandan residencias completas). */
export type MapPoint = { id: string; slug: string; name: string; price: number; lat: number; lng: number; zone: string; photo: string | null };

/** Separa las residencias con coordenadas (pines) de las que no (se avisa «N sin ubicación»). */
export function toMapPoints(list: (Pick<Residence, "slug" | "name" | "priceFromUsd" | "latitude" | "longitude" | "zone"> & { photos?: string[] })[]): { points: MapPoint[]; withoutLocation: number } {
  const points: MapPoint[] = [];
  for (const r of list) {
    const lat = r.latitude;
    const lng = r.longitude;
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    points.push({ id: r.slug, slug: r.slug, name: r.name, price: r.priceFromUsd, lat, lng, zone: r.zone, photo: r.photos?.[0] ?? null });
  }
  return { points, withoutLocation: list.length - points.length };
}
