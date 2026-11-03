import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mails = vi.hoisted(() => [] as { to: string; html: string }[]);
vi.mock("@/lib/email/sendEmail", () => ({ sendEmail: async (m: { to: string; html: string }) => (mails.push(m), true) }));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { isFamilyEmailVerified, sendFamilyEmailCode, verifyFamilyEmailCode } from "@/lib/family/emailVerification";

const mk = () => {
  const m = createInMemorySupabase({ users: [{ id: "u-fam", email: "mama@mail.com" }] as Row[], family_email_verifications: [] as Row[] });
  return Object.assign(m.client, { tables: m.tables });
};
const codeOf = () => /<strong>(\d{6})<\/strong>/.exec(mails[mails.length - 1].html)![1];
const t0 = new Date("2026-11-02T12:00:00Z");

beforeEach(() => void (mails.length = 0));

describe("verificación del mail del familiar (DR32 addendum)", () => {
  it("el código correcto verifica; antes no está verificado y el hash no guarda el código en claro", async () => {
    const db = mk();
    expect(await isFamilyEmailVerified(db as never, "u-fam")).toBe(false);
    expect((await sendFamilyEmailCode(db as never, "u-fam", t0)).ok).toBe(true);
    expect(mails[0].to).toBe("mama@mail.com");
    expect(JSON.stringify(db.tables.family_email_verifications)).not.toContain(codeOf());
    expect((await verifyFamilyEmailCode(db as never, "u-fam", codeOf(), t0)).ok).toBe(true);
    expect(await isFamilyEmailVerified(db as never, "u-fam")).toBe(true);
  });
  it("código incorrecto no verifica y se bloquea tras 5 intentos", async () => {
    const db = mk();
    await sendFamilyEmailCode(db as never, "u-fam", t0);
    const good = codeOf();
    const bad = good === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect((await verifyFamilyEmailCode(db as never, "u-fam", bad, t0)).ok).toBe(false);
    expect((await verifyFamilyEmailCode(db as never, "u-fam", good, t0)).ok).toBe(false);
    expect(await isFamilyEmailVerified(db as never, "u-fam")).toBe(false);
  });
  it("vence a los 10 minutos y el reenvío respeta los 60 s", async () => {
    const db = mk();
    await sendFamilyEmailCode(db as never, "u-fam", t0);
    expect((await sendFamilyEmailCode(db as never, "u-fam", new Date(t0.getTime() + 30_000))).ok).toBe(false);
    expect((await verifyFamilyEmailCode(db as never, "u-fam", codeOf(), new Date(t0.getTime() + 11 * 60_000))).ok).toBe(false);
  });
  it("sin la migración 0072 falla cerrado", async () => {
    const m = createInMemorySupabase({ users: [{ id: "u-fam", email: "a@b.com" }] as Row[] }, { missingTables: ["family_email_verifications"] });
    expect(await isFamilyEmailVerified(m.client as never, "u-fam")).toBe(false);
    expect((await verifyFamilyEmailCode(m.client as never, "u-fam", "123456", t0)).ok).toBe(false);
  });
});
