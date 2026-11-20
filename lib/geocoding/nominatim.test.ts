import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { buildNominatimUrl, geocodeAddress } from "./nominatim";

afterEach(() => vi.unstubAllGlobals());

describe("nominatim", () => {
  it("arma la consulta con dirección, barrio, ciudad y país", () => {
    const url = new URL(buildNominatimUrl({ addressLine: "Av. Santa Fe 3000", zone: "Palermo" }));
    expect(url.searchParams.get("q")).toBe("Av. Santa Fe 3000, Palermo, Ciudad Autónoma de Buenos Aires, Argentina");
    expect(url.searchParams.get("countrycodes")).toBe("ar");
  });

  it("devuelve lat/lng del primer resultado", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [{ lat: "-34.5845", lon: "-58.4233" }] }));
    expect(await geocodeAddress({ addressLine: "X 1" })).toEqual({ lat: -34.5845, lng: -58.4233 });
  });

  it("degrada a null: sin resultados, HTTP de error, red caída o dirección vacía", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    expect(await geocodeAddress({ addressLine: "X 1" })).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await geocodeAddress({ addressLine: "X 1" })).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await geocodeAddress({ addressLine: "X 1" })).toBeNull();
    expect(await geocodeAddress({ addressLine: "  " })).toBeNull();
  });
});
