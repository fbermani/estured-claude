import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * DR63 (j) 3 (migración 0102) y 0104: `external_residence_payments.instructions_snapshot` (alias/CBU congelados), `admin_alert_sent_at` y
 * `dispute_reason` (texto libre de la residencia, puede traer contacto) NO son
 * legibles con la API: un JWT de usuario autenticado (`authenticated`) y la anon key reciben «permission denied» (42501). Solo las lee el
 * service role, por server action, para el estudiante de la solicitud, el familiar pagador de un menor y el dueño.
 * Integración contra estured-dev: crea un usuario de auth descartable con contraseña conocida, inicia sesión con la anon key y lo borra al final.
 * Incluye un CONTROL POSITIVO: sin él, una clave mal puesta o una sesión nula también darían error y el test pasaría en falso.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(url && anon && service);

describe.skipIf(!hasCreds)("instructions_snapshot no es legible con la API (integración)", () => {
  let admin: SupabaseClient;
  let userClient: SupabaseClient;
  let anonClient: SupabaseClient;
  let userId: string | undefined;

  beforeAll(async () => {
    admin = createClient(url!, service!, { auth: { persistSession: false } });
    const email = `test-snapshot-${Date.now()}-${Math.floor(Math.random() * 1e6)}@estured.test`;
    const password = `Tmp-${Math.random().toString(36).slice(2)}-Aa1!`;
    const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !created.user) throw new Error(`fixture usuario: ${error?.message}`);
    userId = created.user.id;
    userClient = createClient(url!, anon!, { auth: { persistSession: false } });
    const { data: session, error: signInError } = await userClient.auth.signInWithPassword({ email, password });
    if (signInError || !session.session) throw new Error(`sesión del usuario de prueba: ${signInError?.message}`);
    anonClient = createClient(url!, anon!, { auth: { persistSession: false } });
  });

  afterAll(async () => {
    if (admin && userId) await admin.auth.admin.deleteUser(userId);
  });

  it("control positivo: la sesión existe y puede leer columnas concedidas (sin error)", async () => {
    const { data: who } = await userClient.auth.getUser();
    expect(who.user?.id).toBe(userId);
    const granted = await userClient.from("external_residence_payments").select("id, status, student_reported_paid_at, expected_amount_usd").limit(1);
    expect(granted.error).toBeNull();
  });

  it("un JWT de usuario autenticado recibe permission denied (42501) al pedir instructions_snapshot", async () => {
    const { error } = await userClient.from("external_residence_payments").select("instructions_snapshot").limit(1);
    expect(error?.code).toBe("42501");
  });

  it("también al pedirlo junto con columnas concedidas", async () => {
    const { error } = await userClient.from("external_residence_payments").select("id, status, instructions_snapshot").limit(1);
    expect(error?.code).toBe("42501");
  });

  it("admin_alert_sent_at (marca interna del job) tampoco es legible", async () => {
    const { error } = await userClient.from("external_residence_payments").select("admin_alert_sent_at").limit(1);
    expect(error?.code).toBe("42501");
  });

  it("dispute_reason (texto libre de la residencia, 0104) tampoco es legible con la API", async () => {
    const alone = await userClient.from("external_residence_payments").select("dispute_reason").limit(1);
    expect(alone.error?.code).toBe("42501");
    const mixed = await userClient.from("external_residence_payments").select("id, status, dispute_reason").limit(1);
    expect(mixed.error?.code).toBe("42501");
    const anonRead = await anonClient.from("external_residence_payments").select("dispute_reason").limit(1);
    expect(anonRead.error).not.toBeNull();
  });

  it("el service role sí lee dispute_reason (la residencia lo ve por el panel, server-side)", async () => {
    const { error } = await admin.from("external_residence_payments").select("dispute_reason").limit(1);
    expect(error).toBeNull();
  });

  it("la anon key no lee ni las columnas concedidas ni el snapshot", async () => {
    const snapshot = await anonClient.from("external_residence_payments").select("instructions_snapshot").limit(1);
    expect(snapshot.error).not.toBeNull();
    const granted = await anonClient.from("external_residence_payments").select("id, status").limit(1);
    // La anon key no tiene SELECT sobre esta tabla (0081): error de permisos, nunca filas.
    expect(granted.data ?? []).toEqual([]);
  });

  it("el service role sí lee el snapshot (es el único camino)", async () => {
    const { error } = await admin.from("external_residence_payments").select("instructions_snapshot").limit(1);
    expect(error).toBeNull();
  });
});
