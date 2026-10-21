import { describe, expect, it } from "vitest";
import {
  CROCKFORD_ALPHABET,
  generateReceiptNumber,
  insertReceiptWithRetry,
  normalizeReceiptNumber,
  randomCrockford,
} from "@/lib/receipts/receiptNumber";

describe("generateReceiptNumber", () => {
  it("usa el formato ER-AAAA-XXXXX-XXXXX con alfabeto Crockford (sin I, L, O, U)", () => {
    for (let i = 0; i < 200; i++) {
      const n = generateReceiptNumber("booking", 2026);
      expect(n).toMatch(/^ER-2026-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
    }
    expect(generateReceiptNumber("renewal", 2026)).toMatch(/^ERR-2026-/);
  });

  it("no repite números en una muestra grande (50 bits: colisión prácticamente imposible)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20000; i++) seen.add(generateReceiptNumber("booking", 2026));
    expect(seen.size).toBe(20000);
  });

  it("randomCrockford cubre todo el alfabeto sin sesgo de módulo", () => {
    // con bytes 0..255 cada símbolo aparece exactamente 8 veces
    const all = Uint8Array.from({ length: 256 }, (_, i) => i);
    const s = randomCrockford(256, () => all);
    for (const c of CROCKFORD_ALPHABET) expect(s.split(c).length - 1).toBe(8);
  });
});

describe("normalizeReceiptNumber", () => {
  it("acepta el formato viejo (6 hex)", () => {
    expect(normalizeReceiptNumber("ER-2026-586E51")).toBe("ER-2026-586E51");
    expect(normalizeReceiptNumber(" er2026586e51 ")).toBe("ER-2026-586E51");
    expect(normalizeReceiptNumber("ERR-2026-DBC043")).toBe("ERR-2026-DBC043");
  });

  it("acepta el formato nuevo con tolerancia al tipeo", () => {
    expect(normalizeReceiptNumber("ER-2026-7K3QM-9XJ4A")).toBe("ER-2026-7K3QM-9XJ4A");
    expect(normalizeReceiptNumber("er 2026 7k3qm9xj4a")).toBe("ER-2026-7K3QM-9XJ4A");
    // Crockford: O→0, I/L→1
    expect(normalizeReceiptNumber("ER-2026-O1LIO-00000")).toBe("ER-2026-01110-00000");
  });

  it("rechaza lo que no es un número de comprobante", () => {
    for (const bad of ["", "hola", "ER-2026-12345", "ER-2026-U3QM9-XJ4AB", "ER-2026-586E5G", "ER-26-586E51", "XX-2026-586E51", "ER-2026-7K3QM-9XJ4A-1"]) {
      expect(normalizeReceiptNumber(bad)).toBeNull();
    }
  });
});

describe("insertReceiptWithRetry", () => {
  it("reintenta ante 23505 con números y códigos nuevos y termina bien", async () => {
    const used: string[] = [];
    const result = await insertReceiptWithRetry<{ id: string }>("booking", async (ids) => {
      used.push(ids.receiptNumber);
      return used.length < 3 ? { data: null, error: { code: "23505" } } : { data: { id: "ok" }, error: null };
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ id: "ok" });
    expect(result.attempts).toBe(3);
    expect(new Set(used).size).toBe(3);
    expect(result.receiptNumber).toBe(used[2]);
  });

  it("se rinde después de 3 intentos y devuelve el error", async () => {
    let calls = 0;
    const result = await insertReceiptWithRetry("booking", async () => {
      calls++;
      return { data: null, error: { code: "23505" } };
    });
    expect(calls).toBe(3);
    expect(result.error?.code).toBe("23505");
  });

  it("no reintenta otros errores", async () => {
    let calls = 0;
    const result = await insertReceiptWithRetry("renewal", async () => {
      calls++;
      return { data: null, error: { code: "23503" } };
    });
    expect(calls).toBe(1);
    expect(result.error?.code).toBe("23503");
  });
});
