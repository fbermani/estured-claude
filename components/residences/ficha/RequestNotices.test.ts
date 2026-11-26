import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RequestNotices } from "@/components/residences/ficha/RequestNotices";
import type { FichaRoomType } from "@/components/residences/ficha/types";

const type = (id: string, over: Partial<FichaRoomType> = {}): FichaRoomType => ({
  id,
  name: id,
  priceUsd: 200,
  arsRounded: 300000,
  subtitle: "",
  state: "not_updated",
  ...over,
});

const render = (roomTypes: FichaRoomType[]) =>
  renderToStaticMarkup(createElement(RequestNotices, { mode: "student", roomTypes, slot: null, windowNotice: null, studentName: null }));

const OPEN = "Podés enviar tu solicitud de reserva igual, pero no te asegura el lugar.";
const BLOCKED = "Por ahora no recibe solicitudes de reserva.";

describe("RequestNotices: disponibilidad sin actualizar (DR69)", () => {
  it("días 30 a 45: avisa y aclara que se puede enviar", () => {
    const html = render([type("a")]);
    expect(html).toContain(OPEN);
    expect(html).not.toContain(BLOCKED);
  });

  it("desde el día 45: dice que no recibe solicitudes", () => {
    const html = render([type("a", { staleBlocked: true }), type("b", { state: "full" })]);
    expect(html).toContain(BLOCKED);
    expect(html).not.toContain(OPEN);
  });

  it("si queda un tipo que admite solicitudes, no muestra el bloqueo general", () => {
    const html = render([type("a", { staleBlocked: true }), type("b", { state: "available" })]);
    expect(html).not.toContain(BLOCKED);
  });
});
