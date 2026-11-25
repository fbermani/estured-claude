import { describe, expect, it, vi } from "vitest";
import { installLogRedaction, redactLogArg } from "@/lib/logging/redactLogArg";

const dbError = { code: "23505", message: "duplicate key value", hint: null, details: "Key (email)=(ana@mail.com) already exists." };

describe("redactLogArg", () => {
  it("quita los valores de la fila y conserva código y mensaje", () => {
    expect(redactLogArg(dbError)).toEqual({ code: "23505", message: "duplicate key value", hint: null, details: "[omitido]" });
  });

  it("limpia un error de base anidado en un objeto", () => {
    expect(JSON.stringify(redactLogArg({ step: "alta", error: dbError }))).not.toContain("ana@mail.com");
  });

  it("limpia un error de base que además es instancia de Error", () => {
    const error = Object.assign(new Error("duplicate key value"), { code: "23505", details: dbError.details, hint: null });
    expect(JSON.stringify(redactLogArg(error))).not.toContain("ana@mail.com");
  });

  it("no toca texto, errores comunes ni null", () => {
    const error = new Error("falló");
    expect(redactLogArg("[x] falló:")).toBe("[x] falló:");
    expect(redactLogArg(error)).toBe(error);
    expect(redactLogArg(null)).toBeNull();
  });

  it("se instala una sola vez sobre la consola", () => {
    const sink = vi.fn();
    const fake = { error: sink, warn: vi.fn(), log: vi.fn(), info: vi.fn(), debug: vi.fn() } as unknown as Console;
    installLogRedaction(fake);
    const wrapped = fake.error;
    installLogRedaction(fake);
    expect(fake.error).toBe(wrapped);
    fake.error("[x]", dbError);
    expect(sink).toHaveBeenCalledWith("[x]", expect.objectContaining({ details: "[omitido]" }));
  });
});
