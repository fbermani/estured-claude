import { describe, expect, it } from "vitest";
import { buildCompletionPanel } from "@/lib/residences/completionPanel";

const faq = (ready: number) => ({ essentialReady: ready, essentialTotal: 6 });

describe("buildCompletionPanel", () => {
  it("con todo pendiente muestra las tres filas y se ve", () => {
    const p = buildCompletionPanel({ hasOwnRegulation: false, faq: faq(2), published: false });
    expect(p.rows.map((r) => [r.key, r.state])).toEqual([
      ["regulation", "todo"],
      ["faq", "todo"],
      ["share", "locked"],
    ]);
    expect(p.pendingCount).toBe(2);
    expect(p.show).toBe(true);
  });
  it("los enlaces llevan a regulation y faq; lo hecho no lleva enlace", () => {
    const p = buildCompletionPanel({ hasOwnRegulation: false, faq: faq(0), published: true });
    expect(p.rows.find((r) => r.key === "regulation")).toMatchObject({ href: "regulation", cta: "Completar ahora" });
    expect(p.rows.find((r) => r.key === "faq")).toMatchObject({ href: "faq", detail: "0 de 6 esenciales listas." });
    const done = buildCompletionPanel({ hasOwnRegulation: true, faq: faq(6), published: true });
    expect(done.rows.filter((r) => r.key !== "share").every((r) => r.href === null && r.state === "done")).toBe(true);
  });
  it("si solo falta una, igual se ve", () => {
    expect(buildCompletionPanel({ hasOwnRegulation: true, faq: faq(3), published: true }).show).toBe(true);
    expect(buildCompletionPanel({ hasOwnRegulation: false, faq: faq(6), published: true }).show).toBe(true);
  });
  it("con reglamento y preguntas completos no se ve, aunque compartir esté disponible", () => {
    const p = buildCompletionPanel({ hasOwnRegulation: true, faq: faq(6), published: true });
    expect(p.show).toBe(false);
    expect(p.pendingCount).toBe(0);
    expect(p.rows.find((r) => r.key === "share")?.state).toBe("ready");
  });
  it("compartir sin publicar se activa al publicar: sin enlace, nunca pendiente, sin fechas", () => {
    const share = buildCompletionPanel({ hasOwnRegulation: true, faq: faq(6), published: false }).rows.find((r) => r.key === "share");
    expect(share).toMatchObject({ state: "locked", href: null, cta: null });
    expect(share?.detail).toBe("Se activa cuando tu residencia se publique.");
  });
  it("sin catálogo de preguntas la fila no se muestra y no cuenta", () => {
    const p = buildCompletionPanel({ hasOwnRegulation: true, faq: null, published: true });
    expect(p.rows.some((r) => r.key === "faq")).toBe(false);
    expect(p.show).toBe(false);
  });
  it("el copy no promete disponibilidad ni garantías", () => {
    const text = buildCompletionPanel({ hasOwnRegulation: false, faq: faq(0), published: true })
      .rows.map((r) => `${r.detail} ${r.reason}`)
      .join(" ");
    expect(text).not.toMatch(/garantiz|garantía|asegurad|mediaci/i);
  });
});
