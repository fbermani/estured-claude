/**
 * Segunda ronda de ajustes de la ficha: condiciones de reserva (solo las que aplican), reglas de casa en el formato del mockup y banda de
 * preguntas con su pill. Se renderizan a HTML estático.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReservationConditions } from "@/components/residences/ficha/ReservationConditions";
import { HouseRules } from "@/components/residences/ficha/HouseRules";
import { FaqBand } from "@/components/residences/ficha/FaqBand";
import type { FichaConditionsInput } from "@/lib/residences/fichaConditions";

const none: FichaConditionsInput = {
  minimumStayMonths: null,
  adjustmentPolicy: null,
  enrollmentFeeMode: null,
  enrollmentFeeUsd: null,
  enrollmentFeeFrequency: "once",
  depositUsd: null,
  emptyMonthChargePercent: null,
  initialPayment: { mode: "one_month", customUsd: null },
};

describe("ReservationConditions", () => {
  it("omite por completo lo que no aplica: nada de «No cobra» ni «A coordinar»", () => {
    const html = renderToStaticMarkup(createElement(ReservationConditions, { conditions: { ...none, adjustmentPolicy: "none" }, arsPerUsd: 1500 }));
    expect(html).toContain("Para reservar");
    expect(html).not.toMatch(/No cobra|coordinar|Matrícula|Depósito|Ajuste|Mes vacío|Documentos/);
  });

  it("lo que aplica va con su valor y la referencia en ARS", () => {
    const html = renderToStaticMarkup(
      createElement(ReservationConditions, { conditions: { ...none, minimumStayMonths: 6, depositUsd: 300 }, arsPerUsd: 1500 }),
    );
    expect(html).toContain("Estadía mínima");
    expect(html).toContain("6 meses");
    expect(html).toContain("Depósito");
    expect(html).toContain("USD 300");
    expect(html).toContain("≈ ARS");
  });
});

describe("HouseRules (formato del mockup)", () => {
  const html = renderToStaticMarkup(
    createElement(HouseRules, {
      rulesSummary: "Silencio: de 23 a 7, para música auriculares\nCocina abierta: de 7 a 23\nMascotas: No se admiten\nCada uno lava lo que usa",
    }),
  );
  it("columna izquierda con el dato leído del texto, sin numeración", () => {
    expect(html).toContain(">23 a 7<");
    expect(html).toContain(">7 a 23<");
    expect(html).toContain(">No<");
    expect(html).not.toContain(">01<");
  });
  it("la regla sin dato lleva un ícono neutro, no un dato inventado", () => {
    expect(html).toContain("Cada uno lava lo que usa");
    expect(html).toContain(">home<");
  });
  it("las reglas de más van en un desplegable", () => {
    const many = renderToStaticMarkup(createElement(HouseRules, { rulesSummary: Array.from({ length: 7 }, (_, i) => `Regla ${i + 1}`).join("\n") }));
    expect(many).toContain("Ver 2 reglas más");
  });
});

describe("FaqBand", () => {
  const items = [{ question: "¿Qué incluye?", answer: "Wifi" }];
  it("muestra el pill «Leé las respuestas rápidas» y el título", () => {
    const html = renderToStaticMarkup(createElement(FaqBand, { headingId: "h", number: "04", items, total: 9, residenceName: "Norte" }));
    expect(html).toContain("Leé las respuestas rápidas");
    expect(html).toContain("Preguntas que más nos hacen");
    expect(html).toContain("Hay 8 respuestas más para leer.");
    expect(html).not.toContain("Hacer una pregunta");
  });
});
