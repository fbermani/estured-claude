import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { SupabaseClient } from "@supabase/supabase-js";
import { findPreviewResidence, findPublicResidence } from "@/lib/residences/fichaResidence";
import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";

/**
 * La ficha pública SIEMPRE exige `verified_active`. La vista previa del equipo (`/residence/[id]/preview`) omite ese filtro, pero solo
 * después de comprobar el vínculo activo con ESA residencia. Estos tests fijan las dos reglas.
 */
const residences: Row[] = [
  { id: "r-pub", slug: "publicada", name: "Publicada", status: "verified_active" },
  { id: "r-draft", slug: "borrador", name: "Borrador", status: "draft" },
  { id: "r-pend", slug: "pendiente", name: "Pendiente", status: "pending_verification" },
  { id: "r-changes", slug: "cambios", name: "Con cambios", status: "needs_changes" },
];
const members: Row[] = [
  { residence_id: "r-draft", user_id: "owner-draft", role: "owner", is_active: true },
  { residence_id: "r-draft", user_id: "staff-draft", role: "staff", is_active: true, permissions: {} },
  { residence_id: "r-draft", user_id: "ex-staff", role: "staff", is_active: false },
  { residence_id: "r-pub", user_id: "owner-pub", role: "owner", is_active: true },
  { residence_id: "r-pend", user_id: "owner-pend", role: "owner", is_active: true },
];

function setup() {
  const { client, log } = createInMemorySupabase({ residences, residence_users: members });
  const reads: string[] = [];
  const spy = new Proxy(client as unknown as SupabaseClient, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (table: string) => {
          reads.push(table);
          return target.from(table);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
  return { admin: spy, reads, log };
}

describe("findPublicResidence: la ficha pública solo muestra residencias verified_active", () => {
  it("devuelve la residencia publicada por slug", async () => {
    const { admin } = setup();
    expect(await findPublicResidence(admin, "publicada")).toMatchObject({ id: "r-pub" });
  });

  it("un borrador, una residencia en verificación o con cambios pedidos da null (404)", async () => {
    const { admin } = setup();
    expect(await findPublicResidence(admin, "borrador")).toBeNull();
    expect(await findPublicResidence(admin, "pendiente")).toBeNull();
    expect(await findPublicResidence(admin, "cambios")).toBeNull();
    expect(await findPublicResidence(admin, "no-existe")).toBeNull();
  });

  it("no se puede llegar por id: solo por slug", async () => {
    const { admin } = setup();
    expect(await findPublicResidence(admin, "r-pub")).toBeNull();
  });
});

describe("findPreviewResidence: la vista previa omite el filtro de estado solo para el equipo de esa residencia", () => {
  it("el dueño y el staff activo ven su borrador (cualquier estado)", async () => {
    const { admin } = setup();
    expect(await findPreviewResidence(admin, "owner-draft", "r-draft")).toMatchObject({ id: "r-draft", status: "draft" });
    expect(await findPreviewResidence(admin, "staff-draft", "r-draft")).toMatchObject({ id: "r-draft" });
    expect(await findPreviewResidence(admin, "owner-pend", "r-pend")).toMatchObject({ status: "pending_verification" });
  });

  it("también funciona con una residencia ya publicada", async () => {
    const { admin } = setup();
    expect(await findPreviewResidence(admin, "owner-pub", "r-pub")).toMatchObject({ status: "verified_active" });
  });

  it("quien no es del equipo de ESA residencia recibe null: otra residencia, staff dado de baja o usuario ajeno", async () => {
    const { admin } = setup();
    expect(await findPreviewResidence(admin, "owner-pub", "r-draft")).toBeNull();
    expect(await findPreviewResidence(admin, "owner-draft", "r-pend")).toBeNull();
    expect(await findPreviewResidence(admin, "ex-staff", "r-draft")).toBeNull();
    expect(await findPreviewResidence(admin, "cualquiera", "r-draft")).toBeNull();
  });

  it("sin vínculo ni siquiera se consulta la tabla de residencias (no se lee nada de ella)", async () => {
    const { admin, reads } = setup();
    await findPreviewResidence(admin, "cualquiera", "r-draft");
    expect(reads).not.toContain("residences");
    await findPreviewResidence(admin, "owner-draft", "r-draft");
    expect(reads).toContain("residences");
  });

  it("una residencia inexistente con un vínculo válido a otra da null", async () => {
    const { admin } = setup();
    expect(await findPreviewResidence(admin, "owner-draft", "r-fantasma")).toBeNull();
  });
});
