import { afterAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { submitWaitlistSignup } from "@/lib/waitlist/submitWaitlistSignup";

const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("submitWaitlistSignup (integración)", () => {
  const admin: SupabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  // Hash de prueba propio (no una IP real hasheada) para no interferir
  // con tráfico real ni con otras corridas de este mismo test.
  const testIpHash = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const testEmails: string[] = [];

  afterAll(async () => {
    if (testEmails.length === 0) return;
    await admin.from("waitlist_signups").delete().in("email", testEmails);
  });

  function nextEmail() {
    const email = `waitlist-test-${Date.now()}-${testEmails.length}@example.com`;
    testEmails.push(email);
    return email;
  }

  it("inserta sin límite cuando no hay ipHash (sin IP conocida, dev local)", async () => {
    const result = await submitWaitlistSignup(admin, {
      role: "student",
      name: "Test Sin IP",
      email: nextEmail(),
      city: null,
      message: null,
      ipHash: null,
      privacyConsentGiven: true,
    });
    expect(result.ok).toBe(true);
  });

  it("un email duplicado es idempotente (no cuenta como error)", async () => {
    const email = nextEmail();
    const first = await submitWaitlistSignup(admin, {
      role: "student",
      name: "Test Duplicado",
      email,
      city: null,
      message: null,
      ipHash: null,
      privacyConsentGiven: true,
    });
    expect(first.ok).toBe(true);

    const second = await submitWaitlistSignup(admin, {
      role: "student",
      name: "Test Duplicado",
      email,
      city: null,
      message: null,
      ipHash: null,
      privacyConsentGiven: true,
    });
    expect(second.ok).toBe(true);
  });

  it("permite hasta 5 inserts por hora desde el mismo ipHash y rechaza el 6to", async () => {
    for (let i = 0; i < 5; i++) {
      const result = await submitWaitlistSignup(admin, {
        role: "student",
        name: `Test Rate Limit ${i}`,
        email: nextEmail(),
        city: null,
        message: null,
        ipHash: testIpHash,
        privacyConsentGiven: true,
      });
      expect(result.ok).toBe(true);
    }

    const sixth = await submitWaitlistSignup(admin, {
      role: "student",
      name: "Test Rate Limit 6",
      email: nextEmail(),
      city: null,
      message: null,
      ipHash: testIpHash,
      privacyConsentGiven: true,
    });
    expect(sixth.ok).toBe(false);
    if (!sixth.ok) expect(sixth.error).toMatch(/más tarde/i);

    // El 6to intento no debe haber creado una fila (queda igual en 5).
    const { count } = await admin
      .from("waitlist_signups")
      .select("*", { count: "exact", head: true })
      .eq("ip_hash", testIpHash);
    expect(count).toBe(5);
  });

  it("rechaza el insert si no se dio el consentimiento de privacidad", async () => {
    const email = nextEmail();
    const result = await submitWaitlistSignup(admin, {
      role: "student",
      name: "Test Sin Consentimiento",
      email,
      city: null,
      message: null,
      ipHash: null,
      privacyConsentGiven: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/política de privacidad/i);

    // No debe haber insertado la fila.
    const { count } = await admin
      .from("waitlist_signups")
      .select("*", { count: "exact", head: true })
      .eq("email", email);
    expect(count).toBe(0);
  });
});
