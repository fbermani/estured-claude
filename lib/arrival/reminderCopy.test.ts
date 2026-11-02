import { describe, expect, it } from "vitest";
import { buildReminderCopy } from "./reminderCopy";

const KEYS = ["t14", "t7", "t2", "t0"] as const;
const FORBIDDEN = /garant|mediaci|whatsapp|disponibilidad asegurada/i;

describe("buildReminderCopy", () => {
  it("textos distintos por aviso, con la residencia y sin promesas", () => {
    const titles = new Set<string>();
    for (const key of KEYS) {
      const c = buildReminderCopy({ kind: "student", key, residenceName: "Casa Palermo", guideSlug: "02-llegada" });
      expect(c.body).toContain("Casa Palermo");
      expect(`${c.title} ${c.body} ${c.emailHtml}`).not.toMatch(FORBIDDEN);
      titles.add(c.title);
    }
    expect(titles.size).toBe(4);
  });
  it("t0 menciona Soporte", () => {
    expect(buildReminderCopy({ kind: "student", key: "t0", residenceName: "X" }).body).toContain("Soporte");
  });
  it("familiar: solo lectura, sin pedir tildar", () => {
    const c = buildReminderCopy({ kind: "family", key: "t7", residenceName: "Casa Palermo", studentFirstName: "Lu" });
    expect(c.title).toBe("Lu llega en 7 días");
    expect(c.body).toMatch(/solo lectura/);
    expect(c.body).not.toMatch(/tild(á|a)/i);
    expect(buildReminderCopy({ kind: "family", key: "t2", residenceName: "X" }).title).toBe("Tu familiar llega en 2 días");
    // El asunto del mail nunca lleva el nombre del estudiante.
    expect(c.emailSubject).toBe("Tu familiar llega en 7 días");
  });
  it("mail enlaza guía 02 y la tarjeta; sin guía omite el enlace", () => {
    const c = buildReminderCopy({ kind: "student", key: "t7", residenceName: "X", guideSlug: "02-llegada", baseUrl: "https://x.test/" });
    expect(c.emailHtml).toContain("https://x.test/guias/02-llegada");
    expect(c.emailHtml).toContain("https://x.test/students/dashboard");
    expect(buildReminderCopy({ kind: "student", key: "t7", residenceName: "X" }).emailHtml).not.toContain("/guias/");
  });
  it("escapa HTML del nombre de la residencia", () => {
    expect(buildReminderCopy({ kind: "student", key: "t2", residenceName: "<b>x</b>" }).emailHtml).not.toContain("<b>x");
  });
});
