import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { markAllNotificationsReadForUser, markNotificationReadForUser } from "@/lib/notifications/markRead";

/**
 * H20: marcar como leída solo cambia notificaciones del propio usuario.
 * Integración contra estured-dev con dos usuarios de relleno sin notificaciones propias (así nunca se tocan las de los usuarios demo); las filas de prueba
 * se identifican por un título único y se borran al final (no hay residencias
 * de por medio, así que no aplica `deleteResidenceCascade`).
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("markNotificationRead (integración)", () => {
  let admin: SupabaseClient;
  let userA: string;
  let userB: string;
  const tag = `test-notif-${Date.now()}`;
  let a1: string;
  let a2: string;
  let b1: string;

  const readAt = async (id: string) =>
    (await admin.from("notifications").select("read_at").eq("id", id).single()).data?.read_at as string | null;

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    userA = (await admin.from("users").select("id").eq("email", "ana.jara@estured.test").single()).data!.id;
    userB = (await admin.from("users").select("id").eq("email", "dante.klein@estured.test").single()).data!.id;
    const { data } = await admin
      .from("notifications")
      .insert([
        { user_id: userA, title: `${tag} a1`, body: "test" },
        { user_id: userA, title: `${tag} a2`, body: "test" },
        { user_id: userB, title: `${tag} b1`, body: "test" },
      ])
      .select("id, title");
    a1 = data!.find((n) => n.title.endsWith("a1"))!.id;
    a2 = data!.find((n) => n.title.endsWith("a2"))!.id;
    b1 = data!.find((n) => n.title.endsWith("b1"))!.id;
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.from("notifications").delete().like("title", `${tag}%`);
  });

  it("no puede marcar la notificación de otro usuario", async () => {
    expect(await markNotificationReadForUser(admin, userA, b1)).toBe(0);
    expect(await readAt(b1)).toBeNull();
  });

  it("marca la propia y es idempotente", async () => {
    expect(await markNotificationReadForUser(admin, userA, a1)).toBe(1);
    expect(await readAt(a1)).not.toBeNull();
    expect(await markNotificationReadForUser(admin, userA, a1)).toBe(0);
  });

  it("ignora ids que no son UUID", async () => {
    expect(await markNotificationReadForUser(admin, userA, "no-es-un-uuid")).toBe(0);
    expect(await markNotificationReadForUser(admin, userA, "' or 1=1 --")).toBe(0);
  });

  it("'marcar todo' solo toca las del usuario", async () => {
    await markAllNotificationsReadForUser(admin, userA);
    expect(await readAt(a2)).not.toBeNull();
    expect(await readAt(b1)).toBeNull();
  });
});
