import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeAdmin, type Call } from "@/lib/push/fakeAdmin";

let sessionUser: { id: string; roles: string[] } | null = { id: "me", roles: ["student"] };
let adminRef: ReturnType<typeof makeFakeAdmin>["admin"] | null = null;
vi.mock("@/lib/auth/session", () => ({ getSessionUser: async () => sessionUser }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => adminRef }));
vi.mock("@/lib/security/rateLimit", () => ({ consumeRateLimit: async () => ({ ok: true }) }));
vi.mock("@/lib/push/dispatch", () => ({ isPushConfigured: () => true }));

import { setPushPreference, subscribePush, unsubscribePush } from "@/lib/push/actions";

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc";
const KEYS = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA", auth: "tBHItJI5svbpez7KI4CCXB" };
const input = { endpoint: ENDPOINT, ...KEYS, userAgent: "UA" };

function setup(handler: (c: Call) => object) {
  const fake = makeFakeAdmin(handler);
  adminRef = fake.admin;
  return fake.calls;
}

beforeEach(() => {
  sessionUser = { id: "me", roles: ["student"] };
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("subscribePush", () => {
  it("exige sesión", async () => {
    sessionUser = null;
    setup(() => ({}));
    expect((await subscribePush(input)).ok).toBe(false);
  });

  it("rechaza endpoints fuera de los proveedores conocidos y claves inválidas", async () => {
    const calls = setup(() => ({}));
    expect((await subscribePush({ ...input, endpoint: "https://evil.example.com/x" })).ok).toBe(false);
    expect((await subscribePush({ ...input, p256dh: "<script>" })).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("no deja tomar la suscripción de otro usuario sin sus claves (IDOR)", async () => {
    const calls = setup((c) =>
      c.action === "select" && c.filters.endpoint
        ? { data: { id: "s9", user_id: "victim", revoked_at: null, p256dh: "OTRA-CLAVE-123456", auth: "OTRO-AUTH-123456" } }
        : {},
    );
    const result = await subscribePush(input);
    expect(result.ok).toBe(false);
    expect(calls.some((c) => c.action === "update" || c.action === "insert")).toBe(false);
  });

  it("permite que el mismo dispositivo pase a otra cuenta si las claves coinciden", async () => {
    const calls = setup((c) =>
      c.action === "select" && c.filters.endpoint
        ? { data: { id: "s9", user_id: "otra-cuenta", revoked_at: null, ...KEYS } }
        : c.head
          ? { count: 0 }
          : {},
    );
    expect((await subscribePush(input)).ok).toBe(true);
    const update = calls.find((c) => c.action === "update");
    expect(update?.payload).toMatchObject({ user_id: "me", revoked_at: null });
  });

  it("respeta el tope de 10 dispositivos al sumar uno nuevo", async () => {
    const calls = setup((c) => (c.head ? { count: 10 } : {}));
    const result = await subscribePush(input);
    expect(result.ok).toBe(false);
    expect(calls.some((c) => c.action === "insert")).toBe(false);
  });

  it("respeta el tope también al reactivar una fila revocada", async () => {
    const calls = setup((c) =>
      c.action === "select" && c.filters.endpoint
        ? { data: { id: "s9", user_id: "me", revoked_at: "2026-11-01T00:00:00Z", ...KEYS } }
        : c.head
          ? { count: 10 }
          : {},
    );
    expect((await subscribePush(input)).ok).toBe(false);
    expect(calls.some((c) => c.action === "update")).toBe(false);
  });

  it("inserta una suscripción nueva con el usuario de la sesión", async () => {
    const calls = setup((c) => (c.head ? { count: 2 } : {}));
    expect((await subscribePush(input)).ok).toBe(true);
    expect(calls.find((c) => c.action === "insert")?.payload).toMatchObject({ user_id: "me", endpoint: ENDPOINT });
  });
});

describe("unsubscribePush", () => {
  it("filtra siempre por el usuario de la sesión", async () => {
    const calls = setup(() => ({}));
    expect((await unsubscribePush(ENDPOINT)).ok).toBe(true);
    expect(calls[0].filters).toMatchObject({ user_id: "me", endpoint: ENDPOINT });
  });
  it("rechaza un endpoint que no es texto", async () => {
    setup(() => ({}));
    expect((await unsubscribePush({ $ne: null })).ok).toBe(false);
  });
});

describe("setPushPreference", () => {
  it("guarda la preferencia del usuario de la sesión", async () => {
    const calls = setup(() => ({}));
    expect((await setPushPreference("deadlines", false)).ok).toBe(true);
    expect(calls[0].payload).toMatchObject({ user_id: "me", category: "deadlines", enabled: false });
  });
  it("rechaza categorías admin_* para quien no es admin", async () => {
    const calls = setup(() => ({}));
    expect((await setPushPreference("admin_requests", true)).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
  it("acepta admin_* para un admin y rechaza categorías o valores inválidos", async () => {
    sessionUser = { id: "me", roles: ["admin"] };
    setup(() => ({}));
    expect((await setPushPreference("admin_signups", true)).ok).toBe(true);
    expect((await setPushPreference("inventada", true)).ok).toBe(false);
    expect((await setPushPreference("deadlines", "si")).ok).toBe(false);
  });
});
