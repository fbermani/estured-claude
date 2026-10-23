import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { deleteResidenceCascade } from "@/lib/testing/deleteResidenceCascade";
import { getResidencePrivateDetails, saveResidencePrivateDetails } from "@/lib/residences/privateDetails";

/**
 * Ciclo 56: datos privados de la residencia en `residence_private_details` (migración 0043).
 * Integración contra estured-dev con una residencia `residencia-test-*` verificada (visible para anon).
 * Requiere 0043 aplicada.
 */
const hasCreds = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

describe.skipIf(!hasCreds)("residence_private_details (integración)", () => {
  let admin: SupabaseClient;
  let anon: SupabaseClient;
  let residenceId: string;
  const PHONE = "+54 9 11 7777-0000";

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { data, error } = await admin
      .from("residences")
      .insert({
        name: "Residencia Test Privacidad (Ciclo 56)",
        slug: `residencia-test-private-details-${Date.now()}`,
        status: "verified_active",
        operating_mode: "verified_profile",
        public_area: "Palermo",
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`No se pudo crear la residencia de prueba: ${error?.message}`);
    residenceId = data.id;
  });

  afterAll(async () => {
    if (!admin || !residenceId) return;
    await deleteResidenceCascade(admin, residenceId);
  });

  it("el trigger crea la fila privada vacía al insertar la residencia", async () => {
    const details = await getResidencePrivateDetails(admin, residenceId);
    expect(details).not.toBeNull();
    expect(details?.responsible_contact).toBeNull();
    expect(details?.quality_visibility_status).toBe("normal_visibility");
  });

  it("guarda con upsert solo los campos del patch y los lee con el service role", async () => {
    expect(await saveResidencePrivateDetails(admin, residenceId, { responsible_contact: PHONE, responsible_name: "Test" })).toBeNull();
    expect(await saveResidencePrivateDetails(admin, residenceId, { operational_access_reason: "motivo interno" })).toBeNull();
    const details = await getResidencePrivateDetails(admin, residenceId);
    expect(details).toMatchObject({ responsible_contact: PHONE, responsible_name: "Test", operational_access_reason: "motivo interno" });
  });

  it("la anon key NO ve el contacto del responsable ni la tabla privada, pero sí la residencia verificada", async () => {
    const { data: pub } = await anon.from("residences").select("id, name, public_area").eq("id", residenceId).maybeSingle();
    expect(pub?.name).toContain("Privacidad");

    const { data: all } = await anon.from("residences").select("*").eq("id", residenceId).maybeSingle();
    expect(JSON.stringify(all)).not.toContain(PHONE);
    expect(all).not.toHaveProperty("responsible_contact");

    const { data: privateRows } = await anon.from("residence_private_details").select("*").eq("residence_id", residenceId);
    expect(privateRows ?? []).toEqual([]);
    const { error: contactError } = await anon.from("residences").select("responsible_contact").eq("id", residenceId);
    expect(contactError).not.toBeNull();
  });

  it("borrar la residencia borra la fila privada (ON DELETE CASCADE)", async () => {
    await deleteResidenceCascade(admin, residenceId);
    const { data } = await admin.from("residence_private_details").select("residence_id").eq("residence_id", residenceId);
    expect(data ?? []).toEqual([]);
  });
});
