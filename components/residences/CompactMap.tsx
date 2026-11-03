import { formatBlocks } from "@/lib/residences/distance";
import { Icon } from "@/components/ui/Icon";
import {
  findUniversitiesByName,
  haversineDistanceKm,
  type BuenosAiresUniversity,
} from "@/lib/data/buenosAiresUniversities";
import { getApproxZoneCoordinates } from "@/lib/data/caBarrioCentroids";
import { MapTiles } from "@/components/residences/MapTiles";
import { abbreviateUniversity } from "@/lib/residences/universityLabel";
import {
  boundsCenterPixel,
  chooseZoom,
  offsetFromCenter,
  tilesCovering,
} from "@/lib/maps/osmTiles";

// Caja (en px) en la que tienen que entrar la residencia y sus universidades al elegir el zoom: pensada para
// el mapa más chico (mobile, ~343 x 214 px) con 30 px de margen, así nada queda fuera de cuadro en ningún ancho.
const FIT_HALF_WIDTH = 140;
const FIT_HALF_HEIGHT = 75;
// Alcance de teselas que se dibujan alrededor del centro: cubre el mapa más ancho (desktop, ~760 x 290 px).
const COVER_HALF_WIDTH = 420;
const COVER_HALF_HEIGHT = 160;
// Radio de la zona cuando solo se conoce el barrio (sin coordenada propia de la residencia).
const NEIGHBORHOOD_RADIUS_M = 600;

function metersPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

function osmLink(point: { lat: number; lng: number }): string {
  return `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=16/${point.lat}/${point.lng}`;
}

/**
 * Mapa de la ficha: teselas reales de OpenStreetMap + marcadores propios, sin JS de mapas ni API key.
 *
 * Ubica la residencia con su pin EXACTO (la dirección y la ubicación son públicas, decisión del dueño
 * 2026-10-23) y las universidades cercanas ya configuradas por la residencia, numeradas, con la distancia en
 * línea recta (Haversine sobre `lib/data/buenosAiresUniversities.ts`). Sin coordenada propia
 * (`source: "neighborhood"`) se dibuja una zona alrededor del centro del barrio y se dice que es aproximada.
 *
 * ⚠ Antes del lanzamiento masivo hay que reemplazar `tile.openstreetmap.org` por un proveedor de teselas OSM
 * con clave (la política de uso de OSM no admite tráfico de producción intenso). Es el único lugar que arma
 * las URLs: `tilesCovering` en `lib/maps/osmTiles.ts` (ver `docs/15` §23).
 */
export function CompactMap({
  residenceName,
  zone,
  nearUniversityNames,
  location,
  address,
}: {
  residenceName: string;
  zone: string;
  nearUniversityNames: string[];
  /** Salida de `getResidenceLocation` (servidor). Sin ella, centro del barrio. */
  location?: { lat: number; lng: number; source: "residence" | "neighborhood" };
  /** Dirección pública de la residencia (`address_line`), si está cargada. */
  address?: string | null;
}) {
  const residenceCoord = location ?? { ...getApproxZoneCoordinates(zone), source: "neighborhood" as const };
  const isExact = residenceCoord.source === "residence";
  const universities = findUniversitiesByName(nearUniversityNames);

  const withDistance = universities
    .map((u) => ({ ...u, distanceKm: haversineDistanceKm(residenceCoord, u) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const points = [residenceCoord, ...withDistance];
  const zoom = chooseZoom(points, FIT_HALF_WIDTH, FIT_HALF_HEIGHT, 12, isExact ? 16 : 15);
  const center = boundsCenterPixel(points, zoom);
  const tiles = tilesCovering(center, zoom, COVER_HALF_WIDTH, COVER_HALF_HEIGHT);
  const residencePos = offsetFromCenter(residenceCoord, center, zoom);
  const zoneRadiusPx = Math.round(NEIGHBORHOOD_RADIUS_M / metersPerPixel(residenceCoord.lat, zoom));

  const ariaLabel = isExact
    ? `Mapa con la ubicación de ${residenceName}${address ? `, en ${address}` : ""}, y las universidades cercanas`
    : `Mapa de la zona de ${residenceName}, barrio ${zone}`;

  return (
    <div className="overflow-hidden rounded-card border-[1.5px] border-line bg-paper shadow-card">
      <div
        role="img"
        aria-label={ariaLabel}
        className="relative h-[214px] overflow-hidden bg-cream-2 sm:h-[290px]"
      >
        <MapTiles tiles={tiles} />
        <div className="absolute left-1/2 top-1/2 h-0 w-0">
          {!isExact && (
            <span
              aria-hidden="true"
              className="absolute rounded-full border-2 border-dashed border-orange bg-orange/15"
              style={{
                left: residencePos.x - zoneRadiusPx,
                top: residencePos.y - zoneRadiusPx,
                width: zoneRadiusPx * 2,
                height: zoneRadiusPx * 2,
              }}
            />
          )}

          {withDistance.map((u: BuenosAiresUniversity & { distanceKm: number }, i) => {
            const pos = offsetFromCenter(u, center, zoom);
            return (
              <span
                key={u.name}
                aria-hidden="true"
                className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-blue-ink text-[11px] font-extrabold text-white shadow-card"
                style={{ left: pos.x, top: pos.y }}
              >
                {i + 1}
              </span>
            );
          })}

          <span
            aria-hidden="true"
            className={`absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white bg-orange text-white shadow-float ${
              isExact ? "h-9 w-9" : "h-3.5 w-3.5"
            }`}
            style={{ left: residencePos.x, top: residencePos.y }}
          >
            {isExact && <Icon name="home" className="text-xl" />}
          </span>
        </div>

        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-1.5 right-1.5 rounded bg-paper/85 px-1.5 py-0.5 text-[10px] text-ink-soft hover:underline"
        >
          © colaboradores de OpenStreetMap
        </a>
      </div>

      <div className="space-y-2.5 p-4 sm:p-5">
        <p className="flex items-start gap-2 text-sm font-bold text-ink">
          <Icon name="location_on" className="mt-0.5 shrink-0 text-lg text-orange-700" />
          <span>
            {isExact ? residenceName : `${residenceName}: ubicación aproximada, barrio ${zone}`}
            {address && <span className="block font-semibold text-ink-soft">{address}, {zone}</span>}
          </span>
        </p>

        {withDistance.length > 0 ? (
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-faint">Universidades cercanas</p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {withDistance.map((u, i) => (
                <li key={u.name} className="flex items-center gap-3 rounded-field border border-line bg-cream px-3 py-2.5 text-sm text-ink">
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-tint text-[11px] font-extrabold text-blue-ink"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug">{abbreviateUniversity(u.name)}</span>
                    {/* Sin el pin de la residencia no se puede medir: se muestran solo los nombres. */}
                    {isExact && (
                      <span className="block text-xs text-ink-soft">
                        {formatBlocks(u.distanceKm)} · {u.distanceKm.toFixed(1).replace(".", ",")} km
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-ink-faint">Esta residencia todavía no cargó universidades cercanas.</p>
        )}

        <p className="flex items-start gap-1.5 pt-1 text-[11px] leading-relaxed text-ink-faint">
          <Icon name="info" className="mt-0.5 shrink-0 text-sm" />
          <span>
            {isExact
              ? "Distancias aproximadas en línea recta desde la residencia (una cuadra son unos 100 m). "
              : "La residencia todavía no cargó su ubicación exacta, por eso no mostramos distancias. "}
            <a
              href={osmLink(residenceCoord)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-forest-700 underline underline-offset-2"
            >
              Ver en OpenStreetMap
            </a>
          </span>
        </p>
      </div>
    </div>
  );
}
