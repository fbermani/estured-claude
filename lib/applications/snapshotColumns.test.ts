import { describe, expect, it } from "vitest";
import { formatEmptyMonthsCount, withEmptyMonthColumns } from "@/lib/applications/snapshotColumns";

describe("formatEmptyMonthsCount", () => {
  it("usa coma decimal y singular/plural", () => {
    expect(formatEmptyMonthsCount(0.5)).toBe("0,5 mes");
    expect(formatEmptyMonthsCount(1)).toBe("1 mes");
    expect(formatEmptyMonthsCount(1.5)).toBe("1,5 meses");
    expect(formatEmptyMonthsCount(3)).toBe("3 meses");
  });
});

describe("withEmptyMonthColumns", () => {
  it("pide las columnas del mes vacío", async () => {
    const seen: string[] = [];
    const r = await withEmptyMonthColumns<string>("a, b", async (c) => (seen.push(c), { data: "ok", error: null }));
    expect(seen).toEqual(["a, b, empty_months_charge_usd, empty_months_count"]);
    expect(r.data).toBe("ok");
  });
  it("si faltan en este entorno reintenta sin ellas", async () => {
    const seen: string[] = [];
    const r = await withEmptyMonthColumns<string>("a, b", async (c) => {
      seen.push(c);
      return c.includes("empty_months") ? { data: null, error: { code: "42703", message: "column does not exist" } } : { data: "ok", error: null };
    });
    expect(seen).toEqual(["a, b, empty_months_charge_usd, empty_months_count", "a, b"]);
    expect(r.data).toBe("ok");
  });
  it("otros errores se devuelven sin reintentar", async () => {
    let calls = 0;
    const r = await withEmptyMonthColumns<string>("a", async () => (calls++, { data: null, error: { code: "XX000", message: "boom" } }));
    expect(calls).toBe(1);
    expect(r.error?.code).toBe("XX000");
  });
});
