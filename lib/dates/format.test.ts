import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./format";
import { formatDateOnly } from "./formatDateOnly";

describe("formatDate / formatDateTime (hora de Buenos Aires)", () => {
  it("no corre el día cuando el instante cae de noche en Argentina", () => {
    // 2026-07-30T01:30Z = 29/07 22:30 en Buenos Aires
    expect(formatDate("2026-07-30T01:30:00Z")).toBe("29/07/2026");
  });
  it("la fecha con hora no muestra segundos", () => {
    expect(formatDateTime("2026-07-29T12:26:31Z")).toMatch(/^29\/07\/2026,? 09:26$/);
  });
  it("vacío o inválido → guion", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDateTime("no-es-fecha")).toBe("—");
  });
});

describe("formatDateOnly", () => {
  it("rechaza fechas con mes o día fuera de rango y texto de más", () => {
    expect(formatDateOnly("2027-13-45")).toBe("—");
    expect(formatDateOnly("2027-00-10")).toBe("—");
    expect(formatDateOnly("2027-05-10xyz")).toBe("—");
  });

  it("formato único DD/MM/AAAA", () => {
    expect(formatDateOnly("2026-09-01")).toBe("01/09/2026");
    expect(formatDateOnly(undefined)).toBe("—");
  });
});
