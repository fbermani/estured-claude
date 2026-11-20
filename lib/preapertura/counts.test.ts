import { afterAll, describe, expect, it } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getFounderInputs } from "@/lib/preapertura/counts";

/**
 * Cupo real de fundadoras contra `estured-dev` (conteos exactos, sin `limit`). Se mide por DIFERENCIA con el estado previo para no
 * depender de los datos que ya haya. Todo lo creado se borra al final.
 */
const admin = getSupabaseAdmin();
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
let residenceId: string | null = null;

afterAll(async () => {
  if (!admin) return;
  await admin.from("residence_signup_requests").delete().like("email", `test-cupo-%-${stamp}@estured.test`);
  if (residenceId) await admin.from("residences").delete().eq("id", residenceId);
});

describe("getFounderInputs (conteos exactos)", () => {
  it("suma solicitudes no descartadas y no cuenta dos veces la residencia en verificación que sale de una solicitud", async (ctx) => {
    if (!admin) return ctx.skip();
    const before = await getFounderInputs();
    if (!before) return ctx.skip();

    const residence = await admin
      .from("residences")
      .insert({ name: `Residencia Cupo ${stamp}`, slug: `cupo-${stamp}`, city: "CABA", status: "pending_verification" })
      .select("id")
      .single();
    if (residence.error || !residence.data) return ctx.skip();
    residenceId = residence.data.id as string;

    const rows = [
      { tag: "a", residence_id: residenceId, status: "received" }, // vinculada a una ficha en verificación: cuenta una vez
      { tag: "b", residence_id: null, status: "received" },
      { tag: "c", residence_id: null, status: "discarded" }, // descartada: no cuenta
    ].map((r) => ({
      residence_name: `Residencia Cupo ${r.tag} ${stamp}`,
      address: "Calle Falsa 123, CABA",
      contact_name: "Test Cupo",
      email: `test-cupo-${r.tag}-${stamp}@estured.test`,
      phone: "+54 9 11 5555 0000",
      residence_id: r.residence_id,
      status: r.status,
      source: "web",
    }));
    const inserted = await admin.from("residence_signup_requests").insert(rows);
    expect(inserted.error).toBeNull();

    const after = await getFounderInputs();
    expect(after).not.toBeNull();
    // 2 solicitudes no descartadas más; la ficha en verificación vinculada NO suma como «otra»: el total sube 2, no 3.
    expect(after!.externalSignups - before.externalSignups).toBe(2);
    expect(after!.otherInVerification - before.otherInVerification).toBe(0);
  });
});
