import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeFakeAdmin, type Call } from "@/lib/push/fakeAdmin";

const sendNotification = vi.fn();
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification: (...a: unknown[]) => sendNotification(...a) } }));
vi.mock("next/server", () => ({
  after: () => {
    throw new Error("fuera de un request");
  },
}));

const IN_WINDOW = new Date("2026-11-20T15:00:00Z"); // 12:00 AR
const BEFORE_NINE = new Date("2026-11-20T09:00:00Z"); // 6:00 AR
const ROW = { id: "n1", user_id: "u1", category: "payments_fee" };

function withVapid() {
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
  process.env.VAPID_SUBJECT = "https://estured.example";
}

async function load() {
  vi.resetModules();
  return import("@/lib/push/dispatch");
}

const statusUpdates = (calls: Call[]) =>
  calls.filter((c) => c.table === "notifications" && c.action === "update").map((c) => (c.payload as { push_status: string }).push_status);

function handlerFor(overrides: Partial<Record<string, (c: Call) => object>> = {}) {
  return (c: Call) => {
    const o = overrides[`${c.table}:${c.action}`];
    if (o) return o(c);
    if (c.table === "user_roles") return { data: [{ role: "student" }] };
    if (c.table === "push_preferences") return { data: [] };
    if (c.table === "push_subscriptions" && c.action === "select") return { data: [{ id: "s1", endpoint: "https://fcm.googleapis.com/x", p256dh: "k", auth: "a" }] };
    if (c.table === "notifications" && c.head) return { count: 4 };
    return {};
  };
}

beforeEach(() => {
  sendNotification.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  withVapid();
});
afterEach(() => {
  delete process.env.VAPID_PRIVATE_KEY;
});

describe("dispatchNotificationPush", () => {
  it("sin claves VAPID no hace nada (degrada a solo in-app)", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    const { dispatchNotificationPush } = await load();
    const { admin, calls } = makeFakeAdmin(handlerFor());
    await dispatchNotificationPush(admin, ROW, IN_WINDOW);
    expect(calls).toHaveLength(0);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("antes de las 9:00 de Argentina deja el aviso en cola y no envía", async () => {
    const { dispatchNotificationPush } = await load();
    const { admin, calls } = makeFakeAdmin(handlerFor());
    await dispatchNotificationPush(admin, ROW, BEFORE_NINE);
    expect(statusUpdates(calls)).toEqual(["queued"]);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("dentro de la ventana envía un payload genérico con el contador de no leídas", async () => {
    sendNotification.mockResolvedValue({});
    const { dispatchNotificationPush } = await load();
    const { admin, calls } = makeFakeAdmin(handlerFor());
    await dispatchNotificationPush(admin, ROW, IN_WINDOW);
    expect(sendNotification).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(sendNotification.mock.calls[0][1] as string);
    expect(Object.keys(payload).sort()).toEqual(["badge", "body", "tag", "title", "url"]);
    expect(payload.badge).toBe(4);
    expect(payload.tag).toBe("estured-payments_fee");
    expect(statusUpdates(calls)).toEqual(["sent"]);
  });

  it("omite si el usuario apagó la categoría", async () => {
    const { dispatchNotificationPush } = await load();
    const { admin, calls } = makeFakeAdmin(handlerFor({ "push_preferences:select": () => ({ data: [{ category: "payments_fee", enabled: false }] }) }));
    await dispatchNotificationPush(admin, ROW, IN_WINDOW);
    expect(sendNotification).not.toHaveBeenCalled();
    expect(statusUpdates(calls)).toEqual(["skipped"]);
  });

  it("no manda push de categorías admin_* a un usuario sin rol admin", async () => {
    const { dispatchNotificationPush } = await load();
    const { admin, calls } = makeFakeAdmin(handlerFor());
    await dispatchNotificationPush(admin, { ...ROW, category: "admin_requests" }, IN_WINDOW);
    expect(sendNotification).not.toHaveBeenCalled();
    expect(statusUpdates(calls)).toEqual(["skipped"]);
  });

  it("revoca la suscripción ante 410 y marca failed", async () => {
    sendNotification.mockRejectedValue({ statusCode: 410 });
    const { dispatchNotificationPush } = await load();
    const { admin, calls } = makeFakeAdmin(handlerFor());
    await dispatchNotificationPush(admin, ROW, IN_WINDOW);
    const revoke = calls.find((c) => c.table === "push_subscriptions" && c.action === "update");
    expect((revoke?.payload as { revoked_at: string }).revoked_at).toBeTruthy();
    expect(statusUpdates(calls)).toEqual(["failed"]);
  });

  it("un error de red no lanza ni revoca", async () => {
    sendNotification.mockRejectedValue(new Error("timeout"));
    const { dispatchNotificationPush } = await load();
    const { admin, calls } = makeFakeAdmin(handlerFor());
    await expect(dispatchNotificationPush(admin, ROW, IN_WINDOW)).resolves.toBeUndefined();
    expect(calls.some((c) => c.table === "push_subscriptions" && c.action === "update")).toBe(false);
  });

  it("nunca lanza aunque la base falle", async () => {
    const { dispatchNotificationPush } = await load();
    const admin = { from: () => { throw new Error("db caída"); } } as never;
    await expect(dispatchNotificationPush(admin, ROW, IN_WINDOW)).resolves.toBeUndefined();
  });
});

describe("flushQueuedPush", () => {
  const queued = [
    { id: "a", user_id: "u1", category: "deadlines", read_at: null },
    { id: "b", user_id: "u1", category: "deadlines", read_at: "2026-11-20T10:00:00Z" },
    { id: "c", user_id: "u1", category: "deadlines", read_at: null },
  ];

  it("antes de las 9:00 no envía nada", async () => {
    const { flushQueuedPush } = await load();
    const { admin, calls } = makeFakeAdmin(handlerFor());
    expect(await flushQueuedPush(admin, BEFORE_NINE)).toEqual({ sent: 0, skipped: 0 });
    expect(calls).toHaveLength(0);
  });

  it("omite lo ya leído, no reenvía lo que otra corrida tomó y cuenta lo enviado", async () => {
    sendNotification.mockResolvedValue({});
    const { flushQueuedPush } = await load();
    const { admin, calls } = makeFakeAdmin(
      handlerFor({
        "notifications:select": (c) => (c.head ? { count: 2 } : { data: queued }),
        // Cierre atómico: la corrida solapada ya tomó «c».
        "notifications:update": (c) => {
          const status = (c.payload as { push_status: string }).push_status;
          if (status === "sending") return { data: c.filters.id === "c" ? [] : [{ id: c.filters.id }] };
          return {};
        },
      }),
    );
    const result = await flushQueuedPush(admin, IN_WINDOW);
    expect(result).toEqual({ sent: 1, skipped: 1 });
    expect(sendNotification).toHaveBeenCalledTimes(1);
    expect(statusUpdates(calls)).toEqual(["sending", "sent", "skipped", "sending"]);
  });

  it("sin migración 0101 (columna inexistente) degrada en silencio", async () => {
    const { flushQueuedPush } = await load();
    const { admin } = makeFakeAdmin(() => ({ error: { code: "42703", message: "column does not exist" } }));
    expect(await flushQueuedPush(admin, IN_WINDOW)).toEqual({ sent: 0, skipped: 0 });
  });
});
