/**
 * «Habitaciones y precio»: hasta 3 tipos en grilla; con 4 o más, carrusel horizontal con scroll-snap, flechas accesibles de 44 px y la
 * tarjeta siguiente asomando. Se renderiza a HTML estático dentro del proveedor de selección (el mismo que usa la ficha).
 */
import { createElement, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RoomCards } from "@/components/residences/ficha/RoomCards";
import { ReservationSelectionProvider } from "@/components/residences/reservationSelection";
import type { FichaRoomType } from "@/components/residences/ficha/types";

const Provider = ReservationSelectionProvider as ComponentType<{ children?: ReactNode }>;

const type = (i: number, over: Partial<FichaRoomType> = {}): FichaRoomType => ({
  id: `t${i}`,
  name: `Tipo ${i}`,
  priceUsd: 200 + i,
  arsRounded: (200 + i) * 1480,
  subtitle: "2 personas por habitación",
  state: "available",
  ...over,
});

const render = (types: FichaRoomType[], mode: "guest" | "student" | "team" = "guest") =>
  renderToStaticMarkup(
    createElement(
      Provider,
      null,
      createElement(RoomCards, { roomTypes: types, arsPerUsd: 1480, waitlistTypeIds: [], mode: mode as never, slug: "norte" }),
    ),
  );

describe("RoomCards", () => {
  it("con 3 tipos o menos va en grilla: sin carrusel ni flechas", () => {
    const html = render([type(1), type(2), type(3)]);
    expect(html).toContain("grid");
    expect(html).not.toContain("snap-x");
    expect(html).not.toContain("tipos de habitación anteriores");
  });

  it("con 4 tipos o más es un carrusel con scroll-snap, la tarjeta siguiente asoma y las flechas son accesibles", () => {
    const html = render([type(1), type(2), type(3), type(4)]);
    expect(html).toContain("snap-x");
    expect(html).toContain("snap-mandatory");
    expect(html).toMatch(/w-\[78%\]/);
    expect(html).toContain('aria-label="Ver los tipos de habitación anteriores"');
    expect(html).toContain('aria-label="Ver los tipos de habitación siguientes"');
    expect(html).toContain("size-11");
    expect(html).toContain('tabindex="0"');
    // el scroll es de la tira, no de la página
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("overscroll-x-contain");
  });

  it("cada tarjeta lleva el precio en USD (nunca «US$») con su referencia en ARS, el rótulo de la foto y «Pedir esta habitación»", () => {
    const html = render([type(1)]);
    expect(html).toContain("USD 201");
    expect(html).not.toContain("US$");
    expect(html).toContain("≈ ARS");
    expect(html).toContain("Pedir esta habitación");
    expect(html).toContain("<figcaption");
  });

  it("sin foto del tipo muestra la ilustración de marca (sin <img>)", () => {
    const html = render([type(1)]);
    expect(html).not.toContain("<img");
    const withPhoto = render([type(1, { photoUrl: "https://example.com/a.jpg" })]);
    expect(withPhoto).toContain("<img");
  });

  it("un tipo completo no ofrece pedirlo", () => {
    const html = render([type(1, { state: "full" })], "team");
    expect(html).not.toContain("Pedir esta habitación");
  });
});
