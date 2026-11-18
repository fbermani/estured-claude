/**
 * Vista «Lista» de /search en mobile: por debajo de 480 px (ancho de la propia tarjeta) la tarjeta pasa a una disposición
 * horizontal compacta (miniatura a la izquierda, nombre y precio a la derecha, el resto a ancho completo). Como el navegador no
 * se abre en CI, el test fija la ESTRUCTURA: la lista lleva miniatura + clases `@max-[480px]/card` y oculta el carrusel por debajo
 * de 480 px; la grilla y la lista ancha (≥ 480 px) no cambian.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Residence } from "@/types/domain";
import { SearchResultCard } from "@/components/residences/SearchResultCard";

const residence = {
  id: "r1",
  slug: "residencia-norte",
  name: "Residencia Norte",
  zone: "Palermo",
  photos: ["/foto-1.jpg", "/foto-2.jpg"],
  verificationStatus: "verified_active",
  promotionPercent: 10,
  priceFromUsd: 400,
  priceFromListUsd: 440,
  services: ["Wi-Fi"],
  commonAreas: [],
  nearUniversities: [],
  roomTypes: [{ type: "Individual", priceUsd: 400, available: true }],
  availabilityMode: "real_by_place",
} as unknown as Residence;

const render = (layout: "grid" | "list", over: Partial<Residence> = {}) =>
  renderToStaticMarkup(createElement(SearchResultCard, { residence: { ...residence, ...over }, arsPerUsd: 1480, layout }));

describe("SearchResultCard: Lista compacta por debajo de 480 px", () => {
  it("la lista lleva miniatura, columnas horizontales y el texto en `contents` por debajo de 480 px", () => {
    const html = render("list");
    expect(html).toContain("data-card-thumb");
    expect(html).toContain("grid-cols-[7.5rem_minmax(0,1fr)]");
    expect(html).toContain("contents @min-[480px]/card:grid");
    expect(html).toContain("@max-[480px]/card:col-start-2");
    expect(html).toContain("@max-[480px]/card:col-span-2");
    expect(html).toContain("col-span-2 @min-[480px]/card:col-span-1");
  });

  it("la miniatura se oculta desde 480 px y el carrusel solo se ve desde 480 px; la miniatura usa solo la primera foto", () => {
    const html = render("list");
    const thumb = html.slice(html.indexOf("data-card-thumb"), html.indexOf("Foto 1 de 2"));
    expect(thumb).toContain("@min-[480px]/card:hidden");
    expect(thumb).toContain("foto-1.jpg");
    expect(thumb).not.toContain("foto-2.jpg");
    expect(html).toContain("hidden @min-[480px]/card:block");
  });

  it("la miniatura muestra el sello como ícono (con texto accesible) y la promo", () => {
    const thumb = render("list").split("data-card-thumb")[1].split("Foto 1 de 2")[0];
    expect(thumb).toContain("Residencia Verificada");
    expect(thumb).toContain("sr-only");
    expect(thumb).toContain("−10%");
  });

  it("sin fotos, la miniatura dibuja el placeholder de marca", () => {
    const html = render("list", { photos: [] });
    expect(html).toContain("data-card-thumb");
    expect(html).toContain("sin fotos cargadas");
  });

  it("la grilla no cambia: sin miniatura ni clases de la disposición compacta", () => {
    const html = render("grid");
    expect(html).not.toContain("data-card-thumb");
    expect(html).not.toContain("@max-[480px]/card");
    expect(html).not.toContain("contents");
    expect(html).not.toContain("hidden @min-[480px]/card:block");
    expect(html).toContain("grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr_auto]");
  });

  it("la lista conserva la disposición actual desde 480 px", () => {
    const html = render("list");
    expect(html).toContain("@min-[480px]/card:grid-cols-[11.5rem_minmax(0,1fr)]");
    expect(html).toContain("@min-[640px]/card:grid-cols-[15.5rem_minmax(0,1fr)]");
    expect(html).toContain("@min-[480px]/card:row-span-2");
  });
});
