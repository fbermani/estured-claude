/**
 * Centroides aproximados de los barrios de `ZONE_OPTIONS`
 * (`lib/residences/options.ts`). Se usan SOLO para ubicar un pin
 * aproximado de la residencia en el mapa compacto de la ficha — nunca
 * la dirección exacta, que es privada hasta confirmar la reserva
 * (docs/10, decisión ya tomada). "Otra" no tiene centroide propio: cae
 * al centro de CABA (Plaza de Mayo) como referencia general.
 */
export const CABA_BARRIO_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  Palermo: { lat: -34.5895, lng: -58.4295 },
  Recoleta: { lat: -34.5875, lng: -58.3928 },
  Belgrano: { lat: -34.5627, lng: -58.4568 },
  "San Telmo": { lat: -34.6212, lng: -58.3731 },
  Centro: { lat: -34.6045, lng: -58.3821 },
  Caballito: { lat: -34.6183, lng: -58.4406 },
  Almagro: { lat: -34.6083, lng: -58.4205 },
  Núñez: { lat: -34.5453, lng: -58.4642 },
  "Villa Crespo": { lat: -34.5989, lng: -58.4396 },
  Otra: { lat: -34.6037, lng: -58.3816 },
};

export function getApproxZoneCoordinates(zone: string): { lat: number; lng: number } {
  return CABA_BARRIO_CENTROIDS[zone] ?? CABA_BARRIO_CENTROIDS.Otra;
}
