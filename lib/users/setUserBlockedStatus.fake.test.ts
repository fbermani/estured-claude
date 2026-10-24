import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn(async () => undefined) }));

import { setUserBlockedStatus } from "@/lib/users/setUserBlockedStatus";

type Result = { data?: unknown; error?: { code: string; message: string } | null };

/** Cliente falso mínimo: cada tabla devuelve un resultado fijo para select y update. */
function fakeAdmin(tables: { users: Result; user_roles: Result; usersUpdate?: Result }) {
  const updates: unknown[] = [];
  const client = {
    from(table: "users" | "user_roles") {
      const result = tables[table];
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: result.data ?? null, error: result.error ?? null }),
        update: (value: unknown) => {
          updates.push(value);
          const u = tables.usersUpdate ?? { data: [{ id: "target" }], error: null };
          return { eq: () => ({ select: async () => ({ data: u.data ?? null, error: u.error ?? null }) }) };
        },
        then: (resolve: (v: unknown) => void) => resolve({ data: result.data ?? null, error: result.error ?? null }),
      };
      return chain;
    },
  };
  return { client: client as never, updates };
}

const base = { actorUserId: "actor", targetUserId: "target", blocked: true, reason: "Motivo válido" };
const targetUser = { is_blocked: false, blocked_reason: null, primary_role: "student" };

describe("setUserBlockedStatus (permisos DR9, cliente falso)", () => {
  it("un admin no bloquea a un superadmin que lo es solo en user_roles", async () => {
    const { client, updates } = fakeAdmin({ users: { data: targetUser }, user_roles: { data: [{ role: "superadmin" }] } });
    const r = await setUserBlockedStatus(client, { ...base, actorRoles: ["admin"] });
    expect(r.status).toBe("error");
    expect(updates).toHaveLength(0);
  });

  it("un superadmin sí bloquea a un admin", async () => {
    const { client, updates } = fakeAdmin({ users: { data: targetUser }, user_roles: { data: [{ role: "admin" }] } });
    const r = await setUserBlockedStatus(client, { ...base, actorRoles: ["superadmin"] });
    expect(r.status).toBe("ok");
    expect(updates).toHaveLength(1);
  });

  it("un admin no desbloquea a otro admin", async () => {
    const { client, updates } = fakeAdmin({ users: { data: { ...targetUser, primary_role: "admin" } }, user_roles: { data: [] } });
    const r = await setUserBlockedStatus(client, { ...base, blocked: false, actorRoles: ["admin"] });
    expect(r.status).toBe("error");
    expect(updates).toHaveLength(0);
  });

  it("falla cerrado si no se pueden leer los roles del objetivo", async () => {
    const { client, updates } = fakeAdmin({
      users: { data: targetUser },
      user_roles: { error: { code: "XX000", message: "timeout" } },
    });
    const r = await setUserBlockedStatus(client, { ...base, actorRoles: ["admin"] });
    expect(r).toEqual({ status: "error", message: "No pudimos verificar los permisos. Probá de nuevo." });
    expect(updates).toHaveLength(0);
  });

  it("falla cerrado si no se puede leer el usuario", async () => {
    const { client } = fakeAdmin({ users: { error: { code: "XX000", message: "rls" } }, user_roles: { data: [] } });
    const r = await setUserBlockedStatus(client, { ...base, actorRoles: ["admin"] });
    expect(r.status).toBe("error");
  });

  it("un admin bloquea a un estudiante", async () => {
    const { client, updates } = fakeAdmin({ users: { data: targetUser }, user_roles: { data: [{ role: "student" }] } });
    const r = await setUserBlockedStatus(client, { ...base, actorRoles: ["admin"] });
    expect(r.status).toBe("ok");
    expect(updates).toHaveLength(1);
  });

  it("error si el update no afecta ninguna fila", async () => {
    const { client } = fakeAdmin({ users: { data: targetUser }, user_roles: { data: [] }, usersUpdate: { data: [] } });
    const r = await setUserBlockedStatus(client, { ...base, actorRoles: ["admin"] });
    expect(r.status).toBe("error");
  });
});
