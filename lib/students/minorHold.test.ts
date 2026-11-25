import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { guardianConsentMissing, loadMinorHold, loadPendingGuardianConsents } from "@/lib/students/minorHold";

/**
 * DR65 (e) — integración contra estured-dev (solo lectura). Requiere los seeds demo y `scripts/seed-demo-guardian-consent.mjs`
 * (Martín dio su consentimiento por Valentina, menor).
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("cuenta del menor en espera (integración)", () => {
  let admin: SupabaseClient;
  const ids: Record<string, string | null> = {};

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    for (const email of ["valentina.sosa@example.com", "lucia.fernandez@example.com", "padre.lucia@example.com", "seed-preap-menor@estured.test"]) {
      const { data } = await admin.from("users").select("id").eq("email", email).maybeSingle();
      ids[email] = (data?.id as string | undefined) ?? null;
    }
  });

  it("un mayor nunca está en espera", async () => {
    expect((await loadMinorHold(admin, ids["lucia.fernandez@example.com"]!)).onHold).toBe(false);
  });

  it("un familiar (sin perfil de estudiante) nunca está en espera", async () => {
    expect((await loadMinorHold(admin, ids["padre.lucia@example.com"]!)).onHold).toBe(false);
  });

  it("una menor con vínculo activo y consentimiento de ese familiar sale de la espera", async () => {
    const hold = await loadMinorHold(admin, ids["valentina.sosa@example.com"]!);
    expect(hold.onHold).toBe(false);
    expect(await guardianConsentMissing(admin, hold.studentProfileId!, ids["padre.lucia@example.com"]!)).toBe(false);
    // Otro usuario (sin vínculo) no cuenta como su familiar responsable.
    expect(await guardianConsentMissing(admin, hold.studentProfileId!, ids["lucia.fernandez@example.com"]!)).toBe(true);
    expect(await loadPendingGuardianConsents(admin, ids["padre.lucia@example.com"]!)).toEqual([]);
  });

  it("un menor sin familiar vinculado queda en espera", async () => {
    const minor = ids["seed-preap-menor@estured.test"];
    if (!minor) return; // el seed de preapertura no corrió en este entorno
    expect((await loadMinorHold(admin, minor)).onHold).toBe(true);
  });
});
