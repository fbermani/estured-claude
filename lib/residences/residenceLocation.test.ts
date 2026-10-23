import { describe, expect, it } from "vitest";
import { getResidenceLocation, parseCoordinates } from "@/lib/residences/residenceLocation";
import { CABA_BARRIO_CENTROIDS } from "@/lib/data/caBarrioCentroids";

describe("getResidenceLocation", () => {
  it("con coordenada devuelve la coordenada EXACTA (sin redondeo) marcada como residencia", () => {
    expect(getResidenceLocation({ latitude: -34.581234, longitude: -58.421567, public_area: "Palermo" })).toEqual({
      lat: -34.581234,
      lng: -58.421567,
      source: "residence",
    });
  });

  it("acepta numeric como string (PostgREST)", () => {
    const loc = getResidenceLocation({ latitude: "-34.581234", longitude: "-58.421567", public_area: "Palermo" });
    expect(loc).toEqual({ lat: -34.581234, lng: -58.421567, source: "residence" });
  });

  it("sin coordenadas cae al centro del barrio, marcado neighborhood", () => {
    expect(getResidenceLocation({ latitude: null, longitude: null, public_area: "Recoleta" })).toEqual({
      lat: CABA_BARRIO_CENTROIDS.Recoleta.lat,
      lng: CABA_BARRIO_CENTROIDS.Recoleta.lng,
      source: "neighborhood",
    });
  });

  it("coordenada a medias, no numérica o fuera de rango también cae al barrio", () => {
    expect(getResidenceLocation({ latitude: -34.58, longitude: null, public_area: "Palermo" }).source).toBe("neighborhood");
    expect(getResidenceLocation({ latitude: 120, longitude: -58.4, public_area: "Palermo" }).source).toBe("neighborhood");
    expect(getResidenceLocation({ latitude: Number.NaN, longitude: -58.4, public_area: "Palermo" }).source).toBe("neighborhood");
  });

  it("barrio desconocido o ausente usa el centro de CABA", () => {
    expect(getResidenceLocation({ public_area: "Nunca Existió" }).lat).toBe(CABA_BARRIO_CENTROIDS.Otra.lat);
    expect(getResidenceLocation({}).source).toBe("neighborhood");
  });
});

describe("parseCoordinates", () => {
  it("conserva la precisión (6 decimales) y acepta coma decimal", () => {
    expect(parseCoordinates("-34,5812349", "-58.421567")).toEqual({ ok: true, lat: -34.581235, lng: -58.421567 });
  });

  it("ambos vacíos = quitar la coordenada", () => {
    expect(parseCoordinates("", " ")).toEqual({ ok: true, lat: null, lng: null });
    expect(parseCoordinates(null, undefined)).toEqual({ ok: true, lat: null, lng: null });
  });

  it("rechaza uno solo, no numéricos y fuera de rango", () => {
    expect(parseCoordinates("-34.58", "").ok).toBe(false);
    expect(parseCoordinates("", "-58.4").ok).toBe(false);
    expect(parseCoordinates("abc", "-58.4").ok).toBe(false);
    expect(parseCoordinates("91", "-58.4").ok).toBe(false);
    expect(parseCoordinates("-34.5", "181").ok).toBe(false);
    expect(parseCoordinates("Infinity", "-58.4").ok).toBe(false);
  });
});
