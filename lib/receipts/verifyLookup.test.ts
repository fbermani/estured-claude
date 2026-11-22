import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { deleteResidenceCascade } from "@/lib/testing/deleteResidenceCascade";
import { lookupPublicReceipt, parseReceiptReference } from "@/lib/receipts/verifyLookup";
import { generateReceiptNumber } from "@/lib/receipts/receiptNumber";
import { clientKeyFromHeaders, createRateLimiter } from "@/lib/receipts/verifyRateLimit";

/**
 * H14 (auditoría 2026-10-20): el número impreso (`ER-2026-XXXXX-XXXXX`) tiene que
 * verificar en /verify, sin filtrar datos personales ni permitir un barrido
 * útil. Parte pura (parseo + límite) y parte de integración (lookup real
 * contra estured-dev con una residencia `residencia-test-*`).
 */
describe("parseReceiptReference", () => {
  it("reconoce el UUID del QR", () => {
    const code = "3f2b8c1e-7a4d-4b6f-9c2a-1d5e8f0a3b7c";
    expect(parseReceiptReference(code)).toEqual({ kind: "code", value: code });
    expect(parseReceiptReference(code.toUpperCase())).toEqual({ kind: "code", value: code });
  });

  it("reconoce el número impreso y lo normaliza", () => {
    expect(parseReceiptReference("ER-2026-586E51")).toEqual({ kind: "number", value: "ER-2026-586E51" });
    expect(parseReceiptReference("  er-2026-586e51 ")).toEqual({ kind: "number", value: "ER-2026-586E51" });
    expect(parseReceiptReference("ER2026586E51")).toEqual({ kind: "number", value: "ER-2026-586E51" });
    expect(parseReceiptReference("ERR-2026-ABC123")).toEqual({ kind: "number", value: "ERR-2026-ABC123" });
    expect(parseReceiptReference("ER%20-2026-586E51")).toEqual({ kind: "number", value: "ER-2026-586E51" });
    // formato nuevo (Crockford, 10 caracteres)
    expect(parseReceiptReference("er-2026-7k3qm-9xj4a")).toEqual({ kind: "number", value: "ER-2026-7K3QM-9XJ4A" });
    expect(parseReceiptReference("ERR-2026-7K3QM9XJ4A")).toEqual({ kind: "number", value: "ERR-2026-7K3QM-9XJ4A" });
  });

  it("rechaza lo que no tiene forma de comprobante", () => {
    for (const bad of ["", "   ", "hola", "ER-26-ABC", "ER-2026-", "x".repeat(100), "'; drop table booking_receipts;--"]) {
      expect(parseReceiptReference(bad)).toBeNull();
    }
    expect(parseReceiptReference(null)).toBeNull();
    expect(parseReceiptReference(undefined)).toBeNull();
  });
});

describe("createRateLimiter", () => {
  it("permite hasta el límite dentro de la ventana y después bloquea", () => {
    const allowed = createRateLimiter({ limit: 3, windowMs: 1000 });
    expect([1, 2, 3].map(() => allowed("ip-a", 100))).toEqual([true, true, true]);
    expect(allowed("ip-a", 200)).toBe(false);
    // otra IP no se ve afectada
    expect(allowed("ip-b", 200)).toBe(true);
  });

  it("vuelve a permitir cuando la ventana pasó", () => {
    const allowed = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(allowed("ip", 0)).toBe(true);
    expect(allowed("ip", 500)).toBe(false);
    expect(allowed("ip", 1500)).toBe(true);
  });
});

describe("createRateLimiter: tope de claves y cabeceras", () => {
  it("el tope duro desaloja las claves más viejas aunque no hayan vencido", () => {
    const allowed = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 3 });
    for (const k of ["a", "b", "c", "d"]) expect(allowed(k, 1000)).toBe(true);
    // "a" fue desalojada: vuelve a tener cupo; "d" (reciente) sigue bloqueada
    expect(allowed("a", 1001)).toBe(true);
    expect(allowed("d", 1001)).toBe(false);
  });

  it("clientKeyFromHeaders prefiere cabeceras de plataforma y cae a un bucket compartido", () => {
    const h = (o: Record<string, string>) => ({ get: (n: string) => o[n] ?? null });
    expect(clientKeyFromHeaders(h({ "x-vercel-forwarded-for": "1.1.1.1", "x-forwarded-for": "6.6.6.6, 2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientKeyFromHeaders(h({ "x-real-ip": "3.3.3.3", "x-forwarded-for": "6.6.6.6" }))).toBe("3.3.3.3");
    expect(clientKeyFromHeaders(h({ "x-forwarded-for": "4.4.4.4, 5.5.5.5" }))).toBe("4.4.4.4");
    expect(clientKeyFromHeaders(h({}))).toBe("unknown");
  });
});

describe("lookupPublicReceipt: errores de base", () => {
  it("un error de Supabase se informa como no disponible, no como inexistente", async () => {
    const failing = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { code: "XX000", message: "boom" } }) }) }),
      }),
    } as never;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await lookupPublicReceipt(failing, { kind: "number", value: "ER-2026-586E51" });
    spy.mockRestore();
    expect(result).toEqual({ found: false, unavailable: true });
  });
});

const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("lookupPublicReceipt (integración)", () => {
  let admin: SupabaseClient;
  let residenceId: string;
  let receiptId: string;
  const verificationCode = crypto.randomUUID();
  const receiptNumber = generateReceiptNumber("booking", 2026);

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

    const { data: owner } = await admin.from("users").select("id").eq("email", "owner.residencia.norte@example.com").single();
    const { data: studentUser } = await admin.from("users").select("id").eq("email", "lucia.fernandez@example.com").single();
    const { data: studentProfile } = await admin.from("student_profiles").select("id").eq("user_id", studentUser!.id).single();

    const { data: residence } = await admin
      .from("residences")
      .insert({
        name: "Residencia Test Integración (Ciclo 47 — verificación pública)",
        slug: `residencia-test-verify-${Date.now()}`,
        property_type: "residencia_estudiantil",
        status: "verified_active",
        operating_mode: "verified_profile",
        public_area: "Palermo",
        total_capacity: 5,
        created_by: owner!.id,
      })
      .select("id")
      .single();
    residenceId = residence!.id;

    const { data: roomType } = await admin
      .from("room_types")
      .insert({ residence_id: residenceId, name: "Individual", monthly_price_usd: 300, monthly_price_ars: 456000 })
      .select("id")
      .single();

    const { data: snapshot } = await admin
      .from("application_snapshots")
      .insert({
        snapshot_type: "original",
        residence_id: residenceId,
        room_type_id: roomType!.id,
        monthly_price_usd: 300,
        monthly_price_ars: 456000,
        exchange_rate_ars_per_usd: 1520,
        exchange_rate_source: "test",
        exchange_rate_date: new Date().toISOString().slice(0, 10),
        initial_duration_months: 6,
        adjustment_policy: "quarterly",
        deposit_excluded_from_fee: true,
      })
      .select("id")
      .single();

    const { data: application } = await admin
      .from("application_requests")
      .insert({
        student_profile_id: studentProfile!.id,
        initiated_by: "student",
        contact_target: "student",
        residence_id: residenceId,
        room_type_id: roomType!.id,
        status: "converted_to_reservation",
        desired_start_date: "2026-08-15",
        initial_duration_months: 6,
        academic_objective: "Objetivo académico de prueba (test de integración).",
        snapshot_original_id: snapshot!.id,
        created_by_user_id: studentUser!.id,
      })
      .select("id")
      .single();
    await admin.from("application_snapshots").update({ application_request_id: application!.id }).eq("id", snapshot!.id);

    const { data: payment } = await admin
      .from("external_residence_payments")
      .insert({
        application_request_id: application!.id,
        residence_id: residenceId,
        student_profile_id: studentProfile!.id,
        status: "reported_received_by_residence",
        reported_received_by_user_id: owner!.id,
        reported_received_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    const { data: reservation } = await admin
      .from("reservations")
      .insert({
        application_request_id: application!.id,
        student_profile_id: studentProfile!.id,
        residence_id: residenceId,
        room_type_id: roomType!.id,
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        start_date: "2026-08-15",
        initial_duration_months: 6,
        academic_objective: "Objetivo académico de prueba (test de integración).",
        snapshot_id: snapshot!.id,
        external_residence_payment_id: payment!.id,
      })
      .select("id")
      .single();

    const { data: receipt } = await admin
      .from("booking_receipts")
      .insert({
        reservation_id: reservation!.id,
        student_profile_id: studentProfile!.id,
        payer_user_id: studentUser!.id,
        residence_id: residenceId,
        status: "issued",
        receipt_number: receiptNumber,
        verification_code: verificationCode,
        qr_code_value: `http://localhost:3000/verify/${verificationCode}`,
        issued_at: new Date().toISOString(),
        receipt_payload: {
          student: { first_name: "Lucía", last_initial: "F." },
          residence: { name: "Residencia Test Integración" },
          room_type: "Individual",
          desired_start_date: "2026-08-15",
          initial_duration_months: 6,
          final_conditions: { monthly_price_usd: 300 },
          estured_fee: { amount_ars: 140500, payer_billing_name: "Lucía Fernández", payer_billing_cuit: "20-12345678-9" },
        },
      })
      .select("id")
      .single();
    receiptId = receipt!.id;
  });

  afterAll(async () => {
    if (!admin || !residenceId) return;
    await deleteResidenceCascade(admin, residenceId);
  });

  it("el número impreso verifica y devuelve solo lo mínimo (sin datos del estudiante)", async () => {
    const reference = parseReceiptReference(receiptNumber)!;
    const result = await lookupPublicReceipt(admin, reference);
    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.status).toBe("valid");
    expect(result.receiptKind).toBe("booking");
    expect(result.receiptNumber).toBe(receiptNumber);
    expect(result.residenceName).toContain("Residencia Test Integración");
    expect(result.detail).toBeNull();
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("Lucía");
    expect(serialized).not.toContain("140500");
    expect(serialized).not.toContain("20-12345678-9");
  });

  it("el código completo (QR) devuelve además nombre con inicial y datos de la estadía, nunca montos ni CUIT", async () => {
    const result = await lookupPublicReceipt(admin, parseReceiptReference(verificationCode)!);
    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.detail?.studentLabel).toBe("Lucía F.");
    expect(result.detail?.studentHidden).toBe(false);
    expect(result.detail?.roomType).toBe("Individual");
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("140500");
    expect(serialized).not.toContain("20-12345678-9");
    expect(serialized).not.toContain("payer");
  });

  it("LEG-005: si el titular es menor (por birth_date), el código completo no muestra su nombre", async () => {
    const { data: minorUser } = await admin.from("users").select("id").eq("email", "valentina.sosa@example.com").maybeSingle();
    const { data: minorProfile } = minorUser
      ? await admin.from("student_profiles").select("id, birth_date").eq("user_id", minorUser.id).maybeSingle()
      : { data: null };
    expect(minorProfile, "falta la estudiante menor demo (Valentina) en estured-dev").toBeTruthy();
    const { data: original } = await admin.from("booking_receipts").select("student_profile_id").eq("id", receiptId).single();
    await admin.from("booking_receipts").update({ student_profile_id: minorProfile!.id }).eq("id", receiptId);
    try {
      const result = await lookupPublicReceipt(admin, parseReceiptReference(verificationCode)!);
      expect(result.found).toBe(true);
      if (!result.found) return;
      expect(result.detail?.studentHidden).toBe(true);
      expect(result.detail?.studentLabel).toBeNull();
      expect(JSON.stringify(result)).not.toContain("Lucía");
      expect(result.residenceName).toContain("Residencia Test Integración");
    } finally {
      await admin.from("booking_receipts").update({ student_profile_id: original!.student_profile_id }).eq("id", receiptId);
    }
  });

  it("un número que no existe devuelve not found", async () => {
    const result = await lookupPublicReceipt(admin, { kind: "number", value: "ER-2026-ZZZZZZ" });
    expect(result).toEqual({ found: false });
  });

  it("anulado y reemitido se informan; los estados no emitidos no se pueden verificar", async () => {
    const reference = parseReceiptReference(receiptNumber)!;

    await admin.from("booking_receipts").update({ status: "voided" }).eq("id", receiptId);
    expect(await lookupPublicReceipt(admin, reference)).toMatchObject({ found: true, status: "voided" });

    await admin.from("booking_receipts").update({ status: "reissued" }).eq("id", receiptId);
    expect(await lookupPublicReceipt(admin, reference)).toMatchObject({ found: true, status: "reissued" });

    await admin.from("booking_receipts").update({ status: "pending_generation" }).eq("id", receiptId);
    expect(await lookupPublicReceipt(admin, reference)).toEqual({ found: false });

    await admin.from("booking_receipts").update({ status: "issued" }).eq("id", receiptId);
  });
});
