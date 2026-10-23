import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { countResidencePhotos } from "@/lib/residences/countResidencePhotos";
import { deleteResidenceCascade } from "@/lib/testing/deleteResidenceCascade";

/**
 * Ciclo 54 (D12): regla de las 3 fotos propias para publicar. Integración
 * contra estured-dev (crea y borra dos residencias `residencia-test-*`).
 * `reviewResidence` se ejecuta de verdad; solo se simulan la sesión de admin
 * y las APIs de Next que necesitan un request (headers, revalidatePath).
 */
const hasCreds = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

const session = vi.hoisted(() => ({ user: null as null | { id: string; roles: string[] } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/auth/requireAdmin", () => ({ getAdminSession: async () => session.user }));

describe.skipIf(!hasCreds)("fotos propias para publicar (integración)", () => {
  let admin: SupabaseClient;
  let ownerId: string;
  let residenceId: string;
  let otherResidenceId: string;
  const residenceIds: string[] = [];

  async function createResidence(label: string) {
    const { data, error } = await admin
      .from("residences")
      .insert({
        name: `Residencia Test Integración (Ciclo 54 — ${label})`,
        slug: `residencia-test-fotos-${label}-${Date.now()}`,
        property_type: "residencia_estudiantil",
        status: "pending_verification",
        operating_mode: "verified_profile",
        public_area: "Palermo",
        total_capacity: 5,
        created_by: ownerId,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error(`No se pudo crear la residencia de prueba: ${error?.message}`);
    residenceIds.push(data.id);
    return data.id as string;
  }

  async function addPhoto(forResidence: string, status: string, type = "residence_photo") {
    const path = `${forResidence}/test-${crypto.randomUUID()}.jpg`;
    const { error } = await admin.from("files").insert({
      owner_user_id: ownerId,
      related_entity_type: "residences",
      related_entity_id: forResidence,
      bucket: "public-residence-media",
      storage_path: path,
      filename: "test.jpg",
      mime_type: "image/jpeg",
      size_bytes: 1000,
      visibility: "public",
      document_type: type,
      status,
      uploaded_by_user_id: ownerId,
    });
    if (error) throw new Error(`No se pudo insertar el archivo de prueba: ${error.message}`);
  }

  async function approve(id: string) {
    // Importado acá para que los vi.mock de arriba ya estén aplicados.
    const { reviewResidence } = await import("@/app/admin/verifications/actions");
    const fd = new FormData();
    fd.set("action", "approve");
    fd.set("responsible_identity_checked", "on");
    fd.set("address_checked", "on");
    fd.set("photos_match_reality", "on");
    return reviewResidence(id, { status: "idle" }, fd);
  }

  async function statusOf(id: string) {
    const { data } = await admin.from("residences").select("status").eq("id", id).single();
    return data!.status as string;
  }

  beforeAll(async () => {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const { data: owner } = await admin.from("users").select("id").eq("email", "owner.residencia.norte@example.com").single();
    ownerId = owner!.id;
    const { data: adminUser } = await admin.from("users").select("id").eq("email", "admin.operaciones@estured.test").single();
    session.user = { id: adminUser!.id, roles: ["admin"] };
    residenceId = await createResidence("principal");
    otherResidenceId = await createResidence("otra");
  });

  afterAll(async () => {
    if (!admin) return;
    for (const id of residenceIds) {
      await admin.from("files").delete().eq("related_entity_type", "residences").eq("related_entity_id", id);
      await admin.from("audit_logs").delete().eq("entity_type", "residences").eq("entity_id", id);
      await deleteResidenceCascade(admin, id);
    }
  });

  it("countResidencePhotos cuenta solo fotos aprobadas de esa residencia", async () => {
    expect(await countResidencePhotos(admin, residenceId)).toBe(0);
    await addPhoto(residenceId, "approved");
    await addPhoto(residenceId, "pending_review"); // no cuenta
    await addPhoto(residenceId, "rejected"); // no cuenta
    await addPhoto(residenceId, "approved", "residence_rules_document"); // otro tipo: no cuenta
    await addPhoto(otherResidenceId, "approved"); // otra residencia: no cuenta
    expect(await countResidencePhotos(admin, residenceId)).toBe(1);
    expect(await countResidencePhotos(admin, otherResidenceId)).toBe(1);
  });

  it("reviewResidence rechaza aprobar con menos de 3 fotos y deja el estado como estaba", async () => {
    await addPhoto(residenceId, "approved"); // ahora hay 2 aprobadas
    const result = await approve(residenceId);
    expect(result.status).toBe("error");
    expect(result.message).toContain("2 fotos propias");
    expect(await statusOf(residenceId)).toBe("pending_verification");
  });

  it("reviewResidence aprueba y publica con 3 fotos aprobadas", async () => {
    await addPhoto(residenceId, "approved"); // ahora hay 3 aprobadas
    expect(await countResidencePhotos(admin, residenceId)).toBe(3);
    const result = await approve(residenceId);
    expect(result.status).toBe("saved");
    expect(await statusOf(residenceId)).toBe("verified_active");
  });
});
