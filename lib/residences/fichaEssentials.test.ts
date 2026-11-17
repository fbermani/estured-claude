import { describe, expect, it } from "vitest";
import { buildEssentialCells, capacityRangeLabel, formatKm, fromPriceLabels, type EssentialsInput } from "@/lib/residences/fichaEssentials";

const base: EssentialsInput = {
  fromPriceUsd: 190,
  arsPerUsd: 1480,
  roomTypes: [{ capacity: 1 }, { capacity: 2 }, { capacity: 3 }],
  minimumStayMonths: 6,
  enrollmentFeeMode: null,
  enrollmentFeeUsd: null,
  nearest: { name: "Universidad de Palermo", km: 1.9 },
};

describe("fromPriceLabels", () => {
  it("escribe USD (nunca US$) y acompaña el monto con su referencia en ARS redondeada", () => {
    const l = fromPriceLabels(190, 1480);
    expect(l.usd).toBe("USD 190");
    expect(l.usdPerMonth).toBe("desde USD 190/mes");
    expect(l.ars).toBe("≈ ARS 281.000");
    expect(Object.values(l).join(" ")).not.toContain("US$");
  });

  it("la referencia sale de la cotización recibida, no de un valor fijo", () => {
    expect(fromPriceLabels(190, 1000).ars).toBe("≈ ARS 190.000");
  });
});

describe("capacityRangeLabel", () => {
  it("rango, valor único y sin dato", () => {
    expect(capacityRangeLabel([1, 3, 2])).toBe("de 1 a 3 personas");
    expect(capacityRangeLabel([2, 2])).toBe("para 2 personas");
    expect(capacityRangeLabel([1])).toBe("para 1 persona");
    expect(capacityRangeLabel([null, null])).toBeUndefined();
    expect(capacityRangeLabel([])).toBeUndefined();
  });

  it("ignora los tipos sin capacidad cargada", () => {
    expect(capacityRangeLabel([null, 2, 4])).toBe("de 2 a 4 personas");
  });
});

describe("formatKm", () => {
  it("usa coma decimal y un decimal", () => {
    expect(formatKm(1.94)).toBe("1,9 km");
    expect(formatKm(12)).toBe("12,0 km");
  });
});

describe("buildEssentialCells", () => {
  it("arma las cuatro celdas en orden con los datos reales", () => {
    const cells = buildEssentialCells(base);
    expect(cells.map((c) => c.key)).toEqual(["desde", "habitaciones", "estadia", "cerca"]);
    const [desde, habitaciones, estadia, cerca] = cells;
    expect(desde).toMatchObject({ label: "Desde", value: "USD 190", unit: "/mes", sub: "≈ ARS 281.000", subIsArs: true });
    expect(habitaciones).toMatchObject({ value: "3 tipos", sub: "de 1 a 3 personas" });
    expect(estadia).toMatchObject({ value: "6 meses", sub: "sin matrícula" });
    expect(cerca).toMatchObject({ value: "1,9 km", sub: "U. de Palermo", title: "Universidad de Palermo" });
    expect(cerca.ariaLabel).toContain("Universidad de Palermo");
  });

  it("el USD de la franja siempre lleva la referencia en ARS", () => {
    for (const c of buildEssentialCells(base)) if (c.value.startsWith("USD")) expect(c.subIsArs).toBe(true);
  });

  it("una celda sin dato se omite en vez de inventar un valor", () => {
    const cells = buildEssentialCells({ ...base, fromPriceUsd: null, minimumStayMonths: null, nearest: null, roomTypes: [] });
    expect(cells).toEqual([]);
  });

  it("singular de tipo y de mes", () => {
    const cells = buildEssentialCells({ ...base, roomTypes: [{ capacity: 2 }], minimumStayMonths: 1 });
    expect(cells.find((c) => c.key === "habitaciones")?.value).toBe("1 tipo");
    expect(cells.find((c) => c.key === "estadia")?.value).toBe("1 mes");
  });

  it("la matrícula solo se afirma «sin matrícula» cuando la residencia declaró que no cobra", () => {
    const sub = (input: Partial<EssentialsInput>) => buildEssentialCells({ ...base, ...input }).find((c) => c.key === "estadia")?.sub;
    expect(sub({ enrollmentFeeMode: null })).toBe("sin matrícula");
    expect(sub({ enrollmentFeeMode: "one_month" })).toBe("con matrícula");
    expect(sub({ enrollmentFeeMode: "manual", enrollmentFeeUsd: 150 })).toBe("con matrícula");
    expect(sub({ enrollmentFeeMode: "manual", enrollmentFeeUsd: null })).toBeUndefined();
  });

  it("sin capacidades cargadas no hay bajada de habitaciones", () => {
    const h = buildEssentialCells({ ...base, roomTypes: [{ capacity: null }, { capacity: null }] }).find((c) => c.key === "habitaciones");
    expect(h?.value).toBe("2 tipos");
    expect(h?.sub).toBeUndefined();
  });
});
