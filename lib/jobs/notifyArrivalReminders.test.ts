import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const sendEmail = vi.fn();
const createNotification = vi.fn();
vi.mock("@/lib/email/sendEmail", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }));
vi.mock("@/lib/notifications/createNotification", () => ({ createNotification: (...a: unknown[]) => createNotification(...a) }));
vi.mock("@/lib/guides/picks", () => ({ resolveGuides: () => [{ slug: "02-llegada" }] }));

import { notifyArrivalReminders } from "./notifyArrivalReminders";

type Opts = {
  probeError?: { code: string } | null;
  insertError?: { code: string } | null;
  startDate: string;
  links?: string[]; // user_ids de familiares con vínculo activo
  userRow?: Record<string, unknown> | null;
};

function fakeAdmin(o: Opts) {
  const inserts: Record<string, unknown>[] = [];
  const deletes: string[] = [];
  const admin = {
    from(table: string) {
      let op = "select";
      let channel = "";
      const chain: Record<string, unknown> = {};
      const result = () => {
        if (table === "arrival_reminder_sends") {
          if (op === "insert") return { error: o.insertError ?? null };
          if (op === "delete") {
            deletes.push(channel);
            return { error: null };
          }
          return { data: [], error: o.probeError ?? null };
        }
        if (table === "reservations")
          return {
            data: [{ id: "r1", start_date: o.startDate, student_profile_id: "sp1", residences: { name: "Casa X" }, student_profiles: { user_id: "stu", first_name: "Lu" } }],
            error: null,
          };
        if (table === "family_links") return { data: (o.links ?? []).map((u) => ({ family_members: { user_id: u } })), error: null };
        if (table === "users") return { data: o.userRow === undefined ? { email: "a@b.co", is_active: true, is_blocked: false } : o.userRow, error: null };
        return { data: null, error: null };
      };
      for (const m of ["select", "in", "gte", "lte", "eq", "limit"]) chain[m] = (...args: unknown[]) => {
        if (m === "eq" && args[0] === "channel") channel = String(args[1]);
        return chain;
      };
      chain.insert = (row: Record<string, unknown>) => {
        op = "insert";
        inserts.push(row);
        return chain;
      };
      chain.delete = () => {
        op = "delete";
        return chain;
      };
      chain.maybeSingle = () => Promise.resolve(result());
      chain.then = (res: (v: unknown) => unknown) => Promise.resolve(result()).then(res);
      return chain;
    },
  };
  return { admin: admin as never, inserts, deletes };
}

// 2026-11-02 12:00Z = 09:00 AR. start_date a 7 días = 2026-11-09.
const NOW = new Date("2026-11-02T12:00:00Z");

beforeEach(() => {
  sendEmail.mockReset().mockResolvedValue(true);
  createNotification.mockReset();
  delete process.env.EMAIL_DOMAIN_VERIFIED;
});

describe("notifyArrivalReminders", () => {
  it("a) 23505 en el claim → no envía", async () => {
    const { admin } = fakeAdmin({ startDate: "2026-11-09", insertError: { code: "23505" } });
    expect((await notifyArrivalReminders(admin, NOW)).sentCount).toBe(0);
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("b) familiar solo en t7/t2 y con vínculo activo", async () => {
    const t7 = fakeAdmin({ startDate: "2026-11-09", links: ["fam"] });
    expect((await notifyArrivalReminders(t7.admin, NOW)).sentCount).toBe(2); // estudiante + familiar
    const t14 = fakeAdmin({ startDate: "2026-11-16", links: ["fam"] });
    expect((await notifyArrivalReminders(t14.admin, NOW)).sentCount).toBe(1); // solo estudiante
    const t0 = fakeAdmin({ startDate: "2026-11-02", links: ["fam"] });
    expect((await notifyArrivalReminders(t0.admin, NOW)).sentCount).toBe(1);
    const sinVinculo = fakeAdmin({ startDate: "2026-11-09", links: [] });
    expect((await notifyArrivalReminders(sinVinculo.admin, NOW)).sentCount).toBe(1);
  });

  it("c) tabla ausente → 0 envíos", async () => {
    const { admin } = fakeAdmin({ startDate: "2026-11-09", probeError: { code: "42P01" } });
    expect((await notifyArrivalReminders(admin, NOW)).sentCount).toBe(0);
    expect(createNotification).not.toHaveBeenCalled();
  });

  it("d) EMAIL_DOMAIN_VERIFIED apagado → sin mail; encendido → mail", async () => {
    const off = fakeAdmin({ startDate: "2026-11-09" });
    await notifyArrivalReminders(off.admin, NOW);
    expect(sendEmail).not.toHaveBeenCalled();
    process.env.EMAIL_DOMAIN_VERIFIED = "true";
    const on = fakeAdmin({ startDate: "2026-11-09" });
    await notifyArrivalReminders(on.admin, NOW);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("antes de las 9 AR no hace nada", async () => {
    const { admin } = fakeAdmin({ startDate: "2026-11-09" });
    expect((await notifyArrivalReminders(admin, new Date("2026-11-02T11:59:00Z"))).sentCount).toBe(0);
  });

  it("f) mail que falla → se borra el claim del canal email", async () => {
    process.env.EMAIL_DOMAIN_VERIFIED = "true";
    sendEmail.mockResolvedValue(false);
    const { admin, deletes } = fakeAdmin({ startDate: "2026-11-09" });
    await notifyArrivalReminders(admin, NOW);
    expect(deletes).toEqual(["email"]);
  });

  it("usuario inactivo o bloqueado no recibe", async () => {
    const { admin } = fakeAdmin({ startDate: "2026-11-09", userRow: { email: "a@b.co", is_active: false, is_blocked: false } });
    expect((await notifyArrivalReminders(admin, NOW)).sentCount).toBe(0);
  });
});
