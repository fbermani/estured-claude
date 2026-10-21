import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { deleteResidenceCascade } from "@/lib/testing/deleteResidenceCascade";
import { MAX_RESIDENCES_PER_OWNER, addResidenceForOwner } from "@/lib/residences/addResidenceForOwner";

/**
 * H22: "Sumar otra residencia" para un owner ya logueado. Integración contra
 * estured-dev; las residencias creadas llevan el prefijo de slug
 * `residencia-test-` (lo exige `deleteResidenceCascade`) y se limpian por
 * completo, incluyendo `user_roles`, `consents` y `audit_logs`, que el
 * cascade no cubre.
 */
/** Cliente falso: cada `from(tabla)` devuelve una cadena encadenable que resuelve a lo configurado. */
function fakeAdmin(results: Record<string, { data: unknown; error: { message: string } | null }>, inserts: string[] = []) {
  const chain = (result: unknown): unknown =>
    new Proxy(
      {},
      {
        get: (_t, prop) => {
          if (prop === "then") return (resolve: (v: unknown) => void) => resolve(result);
          return () => chain(result);
        },
      },
    );
  return {
    from: (table: string) => ({
      select: () => chain(results[table] ?? { data: null, error: null }),
      insert: () => {
        inserts.push(table);
        return chain({ data: null, error: null });
      },
    }),
  } as never;
}

describe("addResidenceForOwner: contacto del responsable (unitario)", () => {
  it("si falta el contacto pide completarlo y no crea nada (nunca usa el email como nombre)", async () => {
    const inserts: string[] = [];
    const admin = fakeAdmin(
      {
        residence_users: { data: [{ residence_id: "r1" }], error: null },
        residences: { data: null, error: null },
        users: { data: { phone: null }, error: null },
      },
      inserts,
    );
    const result = await addResidenceForOwner(admin, {
      ownerUserId: "u1",
      residenceName: "Residencia X",
      propertyType: "residencia_estudiantil",
      zone: "Palermo",
      addressLine: "Calle 1",
      acceptResponsibility: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Completá el contacto");
    expect(inserts).toEqual([]);
  });

  it("el rollback chequea y loguea los errores de los deletes", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const admin = {
      from: (table: string) => {
        const chain = (result: unknown): unknown =>
          new Proxy({}, { get: (_t, prop) => (prop === "then" ? (resolve: (v: unknown) => void) => resolve(result) : () => chain(result)) });
        return {
          select: () =>
            chain(
              table === "residence_users"
                ? { data: [{ residence_id: "r1" }], error: null }
                : table === "residences"
                  ? { data: { responsible_name: "Ricardo", responsible_contact: "+54 9 11 1" }, error: null }
                  : { data: { phone: "+54 9 11 1" }, error: null },
            ),
          // la residencia se crea, falla user_roles y los deletes del rollback también fallan
          insert: () =>
            chain(
              table === "residences"
                ? { data: { id: "new-r" }, error: null }
                : { data: null, error: { message: `insert ${table} falló` } },
            ),
          delete: () => chain({ data: null, error: { message: `delete ${table} falló` } }),
        };
      },
    } as never;
    const result = await addResidenceForOwner(admin, {
      ownerUserId: "u1",
      residenceName: "Residencia X",
      propertyType: "residencia_estudiantil",
      zone: "Palermo",
      addressLine: "Calle 1",
      acceptResponsibility: true,
    });
    expect(result.ok).toBe(false);
    const logged = spy.mock.calls.map((c) => String(c[0]) + String(c[1] ?? "")).join("\n");
    spy.mockRestore();
    expect(logged).toContain("rollback (user_roles) failed");
    expect(logged).toContain("rollback (residences) failed");
  });
});

const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

describe.skipIf(!hasCreds)("addResidenceForOwner (integración)", () => {
  let admin: SupabaseClient;
  let ownerId: string;
  let staffId: string;
  const created: string[] = [];

  const base = (overrides: Partial<Parameters<typeof addResidenceForOwner>[1]> = {}) => ({
    ownerUserId: ownerId,
    residenceName: "Residencia Test Alta Adicional",
    propertyType: "residencia_estudiantil",
    zone: "Palermo",
    addressLine: "Calle Falsa 123",
    acceptResponsibility: true,
    slugPrefix: "residencia-test-",
    ...overrides,
  });

  async function track(result: Awaited<ReturnType<typeof addResidenceForOwner>>) {
    if (result.ok) created.push(result.residenceId);
    return result;
  }

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    ownerId = (await admin.from("users").select("id").eq("email", "owner.residencia.norte@example.com").single()).data!.id;
    staffId = (await admin.from("users").select("id").eq("email", "staff.norte@estured.test").single()).data!.id;
  });

  afterAll(async () => {
    if (!admin) return;
    for (const id of created) {
      await admin.from("audit_logs").delete().eq("entity_type", "residences").eq("entity_id", id);
      await admin.from("consents").delete().eq("related_entity_id", id);
      await admin.from("user_roles").delete().eq("scope_type", "residence").eq("scope_id", id);
      await deleteResidenceCascade(admin, id);
    }
  });

  it("crea la residencia en draft / verified_profile, con owner, verificación, consentimiento y auditoría", async () => {
    const result = await track(await addResidenceForOwner(admin, base()));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const id = result.residenceId;

    const { data: residence } = await admin
      .from("residences")
      .select("status, operating_mode, public_area, city, created_by, responsible_name, responsible_contact, slug")
      .eq("id", id)
      .single();
    expect(residence).toMatchObject({
      status: "draft",
      operating_mode: "verified_profile",
      public_area: "Palermo",
      city: "CABA",
      created_by: ownerId,
    });
    expect(residence!.slug.startsWith("residencia-test-")).toBe(true);
    // el contacto se hereda de la residencia existente del owner
    expect(residence!.responsible_name).toBeTruthy();
    expect(residence!.responsible_contact).toBeTruthy();

    const { data: ru } = await admin.from("residence_users").select("role, is_active").eq("residence_id", id).eq("user_id", ownerId).single();
    expect(ru).toMatchObject({ role: "owner", is_active: true });

    const { data: verification } = await admin.from("residence_verifications").select("status").eq("residence_id", id).single();
    expect(verification!.status).toBe("not_started");

    const { data: consents } = await admin.from("consents").select("consent_type").eq("related_entity_id", id);
    expect((consents ?? []).map((c) => c.consent_type)).toEqual(["residence_responsibility"]);

    const { data: audit } = await admin.from("audit_logs").select("action, actor_user_id").eq("entity_type", "residences").eq("entity_id", id);
    expect(audit).toEqual([{ action: "residence_registered", actor_user_id: ownerId }]);
  });

  it("el staff no puede sumar residencias", async () => {
    const result = await addResidenceForOwner(admin, base({ ownerUserId: staffId }));
    expect(result).toEqual({ ok: false, error: "Solo el responsable (owner) de una residencia puede sumar otra." });
  });

  it("valida los datos del lado del servidor", async () => {
    const cases: [Partial<Parameters<typeof addResidenceForOwner>[1]>, string][] = [
      [{ residenceName: "  " }, "nombre"],
      [{ residenceName: "x".repeat(161) }, "nombre"],
      [{ propertyType: "castillo" }, "tipo de propiedad"],
      [{ zone: "Marte" }, "zona"],
      [{ addressLine: "" }, "dirección"],
      [{ acceptResponsibility: false }, "responsable"],
    ];
    for (const [override, fragment] of cases) {
      const result = await addResidenceForOwner(admin, base(override));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.toLowerCase()).toContain(fragment);
    }
  });

  it("respeta el tope de 10 residencias por owner", async () => {
    const { count } = await admin
      .from("residence_users")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ownerId)
      .eq("role", "owner")
      .eq("is_active", true);
    for (let i = count ?? 0; i < MAX_RESIDENCES_PER_OWNER; i++) {
      expect((await track(await addResidenceForOwner(admin, base({ residenceName: `Residencia Test Tope ${i}` })))).ok).toBe(true);
    }
    const overflow = await track(await addResidenceForOwner(admin, base({ residenceName: "Residencia Test Excedente" })));
    expect(overflow).toEqual({ ok: false, error: `Llegaste al máximo de ${MAX_RESIDENCES_PER_OWNER} residencias por cuenta.` });
  });
});
