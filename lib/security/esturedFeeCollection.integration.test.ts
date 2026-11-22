import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * DR64 (migración 0105): cobro del fee EstuRed con medios del catálogo.
 * - `estured_fee_collection_methods` (datos de cobro de EstuRed) es solo service role: RLS sin policies y sin grants. Un JWT de usuario
 *   autenticado y la anon key reciben «permission denied» (42501) al leerla o escribirla.
 * - `estured_fee_payments`: el equipo de la residencia lee la tabla por RLS, así que ninguna de las 12 columnas nuevas se concede (0105 +
 *   0108): el medio elegido, las marcas de «Ya pagué» / «No pude realizar el pago», los datos de cobro congelados, el texto libre y las
 *   marcas del job dan 42501 con la API y las lee solo el service role.
 * Integración contra estured-dev: crea un usuario de auth descartable con contraseña conocida y lo borra al final.
 * Incluye CONTROL POSITIVO: sin él, una sesión nula o una clave mal puesta también darían error y el test pasaría en falso.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCreds = Boolean(url && anon && service);

/** Control positivo: columnas ya existentes que siguen concedidas. */
const GRANTED = ["status", "manual_payment_file_id"];
const PRIVATE = [
  "chosen_method",
  "student_reported_paid_at",
  "student_payment_issue_at",
  "student_payment_issue_resolved_at",
  "instructions_snapshot",
  "student_payment_issue_reason",
  "admin_dispute_reason",
  "admin_disputed_at",
  "admin_disputed_by_user_id",
  "payer_reminder_sent_at",
  "admin_reminder_sent_at",
  "admin_alert_sent_at",
];

describe.skipIf(!hasCreds)("cobro del fee EstuRed: columnas y tabla sin acceso por API (integración)", () => {
  let admin: SupabaseClient;
  let userClient: SupabaseClient;
  let anonClient: SupabaseClient;
  let userId: string | undefined;
  const createdKeys: string[] = [];

  beforeAll(async () => {
    admin = createClient(url!, service!, { auth: { persistSession: false } });
    const email = `test-feecoll-${Date.now()}-${Math.floor(Math.random() * 1e6)}@estured.test`;
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
    if (admin && createdKeys.length > 0) await admin.from("estured_fee_collection_methods").delete().in("method_key", createdKeys);
    if (admin && userId) await admin.auth.admin.deleteUser(userId);
  });

  it("control positivo: la sesión existe y lee columnas concedidas de estured_fee_payments (sin error)", async () => {
    const { data: who } = await userClient.auth.getUser();
    expect(who.user?.id).toBe(userId);
    const granted = await userClient.from("estured_fee_payments").select(["id", ...GRANTED].join(", ")).limit(1);
    expect(granted.error).toBeNull();
  });

  for (const column of PRIVATE) {
    it(`${column} no es legible con la API (42501), ni solo ni junto a columnas concedidas`, async () => {
      const alone = await userClient.from("estured_fee_payments").select(column).limit(1);
      expect(alone.error?.code).toBe("42501");
      const mixed = await userClient.from("estured_fee_payments").select(`id, status, ${column}`).limit(1);
      expect(mixed.error?.code).toBe("42501");
      const anonRead = await anonClient.from("estured_fee_payments").select(column).limit(1);
      expect(anonRead.error).not.toBeNull();
    });
  }

  it("select * sobre estured_fee_payments sigue dando permission denied (no hay grant de tabla)", async () => {
    const { error } = await userClient.from("estured_fee_payments").select("*").limit(1);
    expect(error?.code).toBe("42501");
  });

  it("el service role sí lee las 12 columnas privadas y las concedidas (es el único camino a las privadas)", async () => {
    const { error } = await admin.from("estured_fee_payments").select([...PRIVATE, ...GRANTED].join(", ")).limit(1);
    expect(error).toBeNull();
  });

  it("estured_fee_collection_methods: un JWT de usuario no lee ni escribe (42501)", async () => {
    const read = await userClient.from("estured_fee_collection_methods").select("id").limit(1);
    expect(read.error?.code).toBe("42501");
    const readAll = await userClient.from("estured_fee_collection_methods").select("*").limit(1);
    expect(readAll.error?.code).toBe("42501");
    const insert = await userClient
      .from("estured_fee_collection_methods")
      .insert({ method_key: "belo", details: "x", currency: "ARS" });
    expect(insert.error?.code).toBe("42501");
    const update = await userClient.from("estured_fee_collection_methods").update({ is_enabled: true }).eq("method_key", "belo");
    expect(update.error?.code).toBe("42501");
  });

  it("estured_fee_collection_methods: la anon key no lee filas", async () => {
    const { data, error } = await anonClient.from("estured_fee_collection_methods").select("*").limit(1);
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it("estured_fee_collection_methods: el service role lee y escribe; los CHECK rechazan datos inválidos", async () => {
    const read = await admin.from("estured_fee_collection_methods").select("id").limit(1);
    expect(read.error).toBeNull();

    const key = `test_dr64_${Math.floor(Math.random() * 1e6)}`;
    createdKeys.push(key);
    const ok = await admin.from("estured_fee_collection_methods").insert({ method_key: key, details: "Alias de prueba", currency: "ARS" });
    expect(ok.error).toBeNull();

    // Moneda fuera de ARS/USD.
    const badCurrency = await admin
      .from("estured_fee_collection_methods")
      .insert({ method_key: `${key}_a`, details: "x", currency: "EUR" });
    expect(badCurrency.error?.code).toBe("23514");
    // Clave con forma inválida (mayúsculas).
    const badKey = await admin.from("estured_fee_collection_methods").insert({ method_key: "Mala-Clave", details: "x", currency: "ARS" });
    expect(badKey.error?.code).toBe("23514");
    // Datos vacíos.
    const emptyDetails = await admin.from("estured_fee_collection_methods").insert({ method_key: `${key}_b`, details: "   ", currency: "ARS" });
    expect(emptyDetails.error?.code).toBe("23514");
    // Etiqueta con un medio que no es «other».
    const labelOnNonOther = await admin
      .from("estured_fee_collection_methods")
      .insert({ method_key: `${key}_c`, method_label: "Mi medio", details: "x", currency: "ARS" });
    expect(labelOnNonOther.error?.code).toBe("23514");
    // «other» sin etiqueta.
    const otherWithoutLabel = await admin.from("estured_fee_collection_methods").insert({ method_key: "other", details: "x", currency: "ARS" });
    expect(otherWithoutLabel.error?.code).toBe("23514");
    // Clave repetida.
    const dup = await admin.from("estured_fee_collection_methods").insert({ method_key: key, details: "otra", currency: "USD" });
    expect(dup.error?.code).toBe("23505");

    await admin.from("estured_fee_collection_methods").delete().eq("method_key", key);
    createdKeys.length = 0;
  });
});
