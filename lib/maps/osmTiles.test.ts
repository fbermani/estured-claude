import { describe, expect, it } from "vitest";
import {
  boundsCenterPixel,
  chooseZoom,
  latLngToWorldPixel,
  offsetFromCenter,
  tilesCovering,
  TILE_SIZE,
} from "@/lib/maps/osmTiles";

const PALERMO = { lat: -34.5845, lng: -58.4233 };
const UBA_DERECHO = { lat: -34.5811, lng: -58.3919 };
const UBA_MEDICINA = { lat: -34.5998, lng: -58.3958 };

describe("latLngToWorldPixel", () => {
  it("(0, 0) cae en el centro del mundo", () => {
    const p = latLngToWorldPixel({ lat: 0, lng: 0 }, 3);
    expect(p.x).toBeCloseTo(TILE_SIZE * 4, 5);
    expect(p.y).toBeCloseTo(TILE_SIZE * 4, 5);
  });
  it("duplica los píxeles por cada nivel de zoom", () => {
    const a = latLngToWorldPixel(PALERMO, 13);
    const b = latLngToWorldPixel(PALERMO, 14);
    expect(b.x / a.x).toBeCloseTo(2, 5);
    expect(b.y / a.y).toBeCloseTo(2, 5);
  });
  it("más al norte = menos y", () => {
    expect(latLngToWorldPixel({ lat: -34.5, lng: -58.4 }, 14).y).toBeLessThan(latLngToWorldPixel({ lat: -34.6, lng: -58.4 }, 14).y);
  });
});

describe("chooseZoom", () => {
  it("un solo punto usa el zoom máximo", () => {
    expect(chooseZoom([PALERMO], 140, 75)).toBe(16);
  });
  it("aleja el mapa hasta que entren todos los puntos en la caja", () => {
    const pts = [PALERMO, UBA_DERECHO, UBA_MEDICINA];
    const zoom = chooseZoom(pts, 140, 75);
    const px = pts.map((p) => latLngToWorldPixel(p, zoom));
    const width = Math.max(...px.map((p) => p.x)) - Math.min(...px.map((p) => p.x));
    const height = Math.max(...px.map((p) => p.y)) - Math.min(...px.map((p) => p.y));
    expect(width / 2).toBeLessThanOrEqual(140);
    expect(height / 2).toBeLessThanOrEqual(75);
    expect(zoom).toBeGreaterThanOrEqual(11);
    expect(zoom).toBeLessThan(16);
  });
  it("nunca baja del zoom mínimo", () => {
    expect(chooseZoom([PALERMO, { lat: 40, lng: 2 }], 140, 75, 11, 16)).toBe(11);
  });
});

describe("tilesCovering / offsetFromCenter", () => {
  it("cubre el área pedida y el centro cae dentro de alguna tesela", () => {
    const zoom = 14;
    const center = boundsCenterPixel([PALERMO, UBA_DERECHO], zoom);
    const tiles = tilesCovering(center, zoom, 400, 150);
    expect(tiles.length).toBeGreaterThanOrEqual(4);
    const covering = tiles.find((t) => t.dx <= 0 && t.dy <= 0 && t.dx + TILE_SIZE > 0 && t.dy + TILE_SIZE > 0);
    expect(covering).toBeDefined();
    for (const t of tiles) expect(t.url).toMatch(/^https:\/\/tile\.openstreetmap\.org\/14\/\d+\/\d+\.png$/);
  });
  it("el offset de un punto es relativo al centro", () => {
    const zoom = 14;
    const center = boundsCenterPixel([PALERMO, UBA_DERECHO], zoom);
    const a = offsetFromCenter(PALERMO, center, zoom);
    const b = offsetFromCenter(UBA_DERECHO, center, zoom);
    expect(a.x).toBeLessThan(0);
    expect(b.x).toBeGreaterThan(0);
    expect(a.x + b.x).toBeCloseTo(0, -1);
  });
});
