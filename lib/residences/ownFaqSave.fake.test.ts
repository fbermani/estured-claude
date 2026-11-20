import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const audits = vi.hoisted(() => [] as { actorRole: string; action: string; oldValue?: unknown; newValue?: unknown }[]);
vi.mock("@/lib/audit", () => ({
  createAuditLog: async (_a: unknown, e: (typeof audits)[number]) => {
    audits.push(e);
    return true;
  },
}));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { PERMISSION_DENIED_MESSAGE, permissionsFromChecked } from "@/lib/residences/permissions";
import { saveOwnFaq } from "@/lib/residences/ownFaqSave";

const NORTE = "res-norte";

function world(extra: Record<string, Row[]> = {}): Record<string, Row[]> {
  return {
    residence_users: [
      { id: "ru-owner", residence_id: NORTE, user_id: "ricardo", role: "owner", is_active: true },
      { id: "ru-ro", residence_id: NORTE, user_id: "solo-lectura", role: "staff", is_active: true, permissions: permissionsFromChecked([]) },
      { id: "ru-faq", residence_id: NORTE, user_id: "faq-staff", role: "staff", is_active: true, permissions: permissionsFromChecked(["faq.manage"]) },
      { id: "ru-perfil", residence_id: NORTE, user_id: "perfil-staff", role: "staff", is_active: true, permissions: permissionsFromChecked(["profile.edit"]) },
    ],
    residence_profile_sections: [],
    ...extra,
  };
}
type Db = ReturnType<typeof createInMemorySupabase>;
const asAdmin = (db: Db) => db.client as never;
const save = (db: Db, items: unknown, actor = "ricardo") => saveOwnFaq(asAdmin(db), { actorUserId: actor, residenceId: NORTE, items });
const stored = (db: Db) => db.tables.residence_profile_sections.find((r) => r.residence_id === NORTE && r.section_type === "faq");

describe("saveOwnFaq", () => {
  beforeEach(() => {
    audits.length = 0;
  });

  it("el dueño guarda los pares, queda auditado con el valor anterior y el nuevo", async () => {
    const db = createInMemorySupabase(world({ residence_profile_sections: [{ residence_id: NORTE, section_type: "faq", content: { items: [{ question: "Vieja", answer: "R" }] } }] }));
    const r = await save(db, [{ question: " ¿Parlantes? ", answer: "Hasta las 23." }]);
    expect(r).toEqual({ ok: true, items: [{ question: "¿Parlantes?", answer: "Hasta las 23." }] });
    expect((stored(db)?.content as { items: unknown[] }).items).toEqual([{ question: "¿Parlantes?", answer: "Hasta las 23." }]);
    expect(audits).toHaveLength(1);
    expect(audits[0].action).toBe("residence_own_faq_updated");
    expect(audits[0].actorRole).toBe("residence_owner");
    expect(audits[0].oldValue).toEqual({ items: [{ question: "Vieja", answer: "R" }] });
  });

  it("crea la sección si no existía y no audita si no cambió nada", async () => {
    const db = createInMemorySupabase(world());
    expect((await save(db, [{ question: "P", answer: "R" }])).ok).toBe(true);
    expect(stored(db)).toBeTruthy();
    audits.length = 0;
    expect((await save(db, [{ question: "P", answer: "R" }])).ok).toBe(true);
    expect(audits).toHaveLength(0);
  });

  it("staff con `profile.edit` puede; con solo `faq.manage` o sin permisos, no", async () => {
    const db = createInMemorySupabase(world());
    expect((await save(db, [{ question: "P", answer: "R" }], "perfil-staff")).ok).toBe(true);
    for (const actor of ["faq-staff", "solo-lectura"]) {
      const denied = await save(db, [{ question: "Otra", answer: "R" }], actor);
      expect(denied).toEqual({ ok: false, error: PERMISSION_DENIED_MESSAGE });
    }
    expect((stored(db)?.content as { items: unknown[] }).items).toEqual([{ question: "P", answer: "R" }]);
  });

  it("alguien sin vínculo con la residencia no guarda", async () => {
    const db = createInMemorySupabase(world());
    expect((await save(db, [{ question: "P", answer: "R" }], "intruso")).ok).toBe(false);
    expect(stored(db)).toBeUndefined();
  });

  it("valida en el servidor: par a medias, texto largo o más del tope no se guardan", async () => {
    const db = createInMemorySupabase(world());
    expect((await save(db, [{ question: "P", answer: "" }])).ok).toBe(false);
    expect((await save(db, [{ question: "P", answer: "a".repeat(501) }])).ok).toBe(false);
    expect((await save(db, Array.from({ length: 6 }, (_, i) => ({ question: `P${i}`, answer: "R" })))).ok).toBe(false);
    expect(stored(db)).toBeUndefined();
    expect(audits).toHaveLength(0);
  });
});
