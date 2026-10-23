/**
 * Matemática de teselas de OpenStreetMap (Web Mercator, teselas de 256 px) para el mapa de la ficha (Ciclo 57).
 * Módulo puro: sin red, sin React. El mapa no usa JS de mapas: solo `<img>` de teselas posicionadas + marcadores.
 */

export const TILE_SIZE = 256;

export type LatLng = { lat: number; lng: number };
export type PixelPoint = { x: number; y: number };

/** Coordenadas "mundo" en píxeles al nivel de zoom `zoom` (origen arriba a la izquierda del mundo). */
export function latLngToWorldPixel(point: LatLng, zoom: number): PixelPoint {
  const scale = TILE_SIZE * 2 ** zoom;
  const lat = Math.max(-85.0511, Math.min(85.0511, point.lat));
  const sin = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((point.lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

/**
 * Zoom más alto (entre `minZoom` y `maxZoom`) con el que todos los puntos entran en una caja de
 * `halfWidthPx` x `halfHeightPx` alrededor de su centro. Con un solo punto devuelve `maxZoom`.
 */
export function chooseZoom(
  points: readonly LatLng[],
  halfWidthPx: number,
  halfHeightPx: number,
  minZoom = 11,
  maxZoom = 16,
): number {
  if (points.length <= 1) return maxZoom;
  for (let zoom = maxZoom; zoom >= minZoom; zoom--) {
    const px = points.map((p) => latLngToWorldPixel(p, zoom));
    const width = Math.max(...px.map((p) => p.x)) - Math.min(...px.map((p) => p.x));
    const height = Math.max(...px.map((p) => p.y)) - Math.min(...px.map((p) => p.y));
    if (width / 2 <= halfWidthPx && height / 2 <= halfHeightPx) return zoom;
  }
  return minZoom;
}

/** Centro (en píxeles mundo) de la caja que contiene los puntos. */
export function boundsCenterPixel(points: readonly LatLng[], zoom: number): PixelPoint {
  const px = points.map((p) => latLngToWorldPixel(p, zoom));
  return {
    x: (Math.max(...px.map((p) => p.x)) + Math.min(...px.map((p) => p.x))) / 2,
    y: (Math.max(...px.map((p) => p.y)) + Math.min(...px.map((p) => p.y))) / 2,
  };
}

export type PositionedTile = {
  key: string;
  url: string;
  /** Desplazamiento de la esquina superior izquierda de la tesela respecto del centro del mapa (px). */
  dx: number;
  dy: number;
};

/** Teselas que cubren `halfWidthPx` x `halfHeightPx` alrededor de `center` (en píxeles mundo). */
export function tilesCovering(center: PixelPoint, zoom: number, halfWidthPx: number, halfHeightPx: number): PositionedTile[] {
  const maxIndex = 2 ** zoom - 1;
  const x0 = Math.floor((center.x - halfWidthPx) / TILE_SIZE);
  const x1 = Math.floor((center.x + halfWidthPx) / TILE_SIZE);
  const y0 = Math.floor((center.y - halfHeightPx) / TILE_SIZE);
  const y1 = Math.floor((center.y + halfHeightPx) / TILE_SIZE);
  const tiles: PositionedTile[] = [];
  for (let tx = x0; tx <= x1; tx++) {
    for (let ty = y0; ty <= y1; ty++) {
      if (ty < 0 || ty > maxIndex) continue;
      const wrappedX = ((tx % (maxIndex + 1)) + maxIndex + 1) % (maxIndex + 1);
      tiles.push({
        key: `${zoom}/${tx}/${ty}`,
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`,
        dx: Math.round(tx * TILE_SIZE - center.x),
        dy: Math.round(ty * TILE_SIZE - center.y),
      });
    }
  }
  return tiles;
}

/** Desplazamiento en píxeles de un punto respecto del centro del mapa. */
export function offsetFromCenter(point: LatLng, center: PixelPoint, zoom: number): PixelPoint {
  const px = latLngToWorldPixel(point, zoom);
  return { x: Math.round(px.x - center.x), y: Math.round(px.y - center.y) };
}
