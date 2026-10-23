import { Icon } from "@/components/ui/Icon";
import {
  findUniversitiesByName,
  haversineDistanceKm,
  type BuenosAiresUniversity,
} from "@/lib/data/buenosAiresUniversities";
import { getApproxZoneCoordinates } from "@/lib/data/caBarrioCentroids";

const WIDTH = 400;
const HEIGHT = 260;
const PADDING = 36;

function project(
  coord: { lat: number; lng: number },
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
) {
  const latRange = Math.max(bounds.maxLat - bounds.minLat, 0.01);
  const lngRange = Math.max(bounds.maxLng - bounds.minLng, 0.01);
  const x = PADDING + ((coord.lng - bounds.minLng) / lngRange) * (WIDTH - 2 * PADDING);
  const y = PADDING + ((bounds.maxLat - coord.lat) / latRange) * (HEIGHT - 2 * PADDING);
  return { x, y };
}

/**
 * Mapa compacto e ilustrativo (SVG propio, sin dependencia de un
 * proveedor externo de mapas/API key): ubica la residencia con su pin
 * EXACTO (la dirección y la ubicación son públicas, decisión del dueño
 * 2026-10-23) y las universidades cercanas ya configuradas por la
 * residencia, con distancia en línea recta calculada por Haversine
 * sobre `lib/data/buenosAiresUniversities.ts`. Si la residencia no
 * tiene coordenada (`source: "neighborhood"`), se ubica en el centro
 * del barrio y se dice que es aproximada.
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

  const points = [residenceCoord, ...universities];
  const bounds = {
    minLat: Math.min(...points.map((p) => p.lat)),
    maxLat: Math.max(...points.map((p) => p.lat)),
    minLng: Math.min(...points.map((p) => p.lng)),
    maxLng: Math.max(...points.map((p) => p.lng)),
  };
  const residencePos = project(residenceCoord, bounds);

  return (
    <div className="overflow-hidden rounded-card border-[1.5px] border-line bg-paper shadow-card">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full bg-cream-2" role="img" aria-label={`Mapa aproximado de ${residenceName} y universidades cercanas`}>
        <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="var(--color-cream-2)" />
        {withDistance.map((u: BuenosAiresUniversity & { distanceKm: number }) => {
          const pos = project(u, bounds);
          return (
            <g key={u.name}>
              <line x1={residencePos.x} y1={residencePos.y} x2={pos.x} y2={pos.y} stroke="var(--color-line-2)" strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={pos.x} cy={pos.y} r={6} fill="var(--color-blue-tint)" stroke="var(--color-blue-ink)" strokeWidth={1.5} />
              <circle cx={pos.x} cy={pos.y} r={2} fill="var(--color-blue-ink)" />
            </g>
          );
        })}
        <circle cx={residencePos.x} cy={residencePos.y} r={10} fill="var(--color-orange-tint)" stroke="var(--color-orange)" strokeWidth={2} />
        <circle cx={residencePos.x} cy={residencePos.y} r={3.5} fill="var(--color-orange)" />
      </svg>

      <div className="space-y-2.5 p-4">
        <p className="flex items-center gap-1.5 text-xs font-bold text-orange-700">
          <span className="h-2 w-2 rounded-full bg-orange" aria-hidden />
          {isExact ? residenceName : `${residenceName} — ubicación aproximada: barrio ${zone}`}
        </p>
        {address && <p className="text-sm font-semibold text-ink">{address}, {zone}</p>}
        {withDistance.length > 0 ? (
          <ul className="space-y-1.5">
            {withDistance.map((u) => (
              <li key={u.name} className="flex items-center justify-between gap-3 text-xs text-ink-soft">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-ink" aria-hidden />
                  {u.name}
                </span>
                <span className="shrink-0 font-semibold text-ink-faint">~{u.distanceKm.toFixed(1)} km</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-ink-faint">Esta residencia todavía no cargó universidades cercanas.</p>
        )}
        <p className="flex items-start gap-1.5 pt-1 text-[11px] leading-relaxed text-ink-faint">
          <Icon name="info" className="mt-0.5 shrink-0 text-sm" />
          {isExact
            ? "Distancias aproximadas en línea recta desde la residencia."
            : "La residencia todavía no cargó su ubicación exacta. Distancias aproximadas en línea recta desde el centro del barrio."}
        </p>
      </div>
    </div>
  );
}
