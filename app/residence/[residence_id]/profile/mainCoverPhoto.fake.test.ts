import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `setMainCoverPhoto` (migración 0097): una sola foto principal por residencia, solo con `profile.edit`, solo fotos aprobadas de ESTA
 * residencia. Cliente Supabase en memoria (no emula el índice único parcial: se verifica que la acción apague la anterior antes de marcar).
 */
const state = vi.hoisted(() => ({ userId: "ricardo", db: null as unknown }));
const audits = vi.hoisted(() => [] as { action: string; newValue?: unknown }[]);

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: async () => (state.userId ? { id: state.userId, email: "x@example.com", primaryRole: "residence_owner", roles: ["residence_owner"] } : null) }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => state.db }));
vi.mock("@/lib/audit", () => ({
  createAuditLog: async (_a: unknown, e: (typeof audits)[number]) => {
    audits.push(e);
    return true;
  },
}));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { PERMISSION_DENIED_MESSAGE, permissionsFromChecked } from "@/lib/residences/permissions";
import { setMainCoverPhoto } from "@/app/residence/[residence_id]/profile/photoMetaActions";

const NORTE = "res-norte";
const OTRA = "res-otra";

const file = (id: string, residence: string, status = "approved"): Row => ({ id, related_entity_type: "residences", related_entity_id: residence, document_type: "residence_photo", status });

function seed(options: Parameters<typeof createInMemorySupabase>[1] = {}, meta: Row[] = []) {
  const db = createInMemorySupabase(
    {
      residence_users: [
        { id: "ru1", residence_id: NORTE, user_id: "ricardo", role: "owner", is_active: true },
        { id: "ru2", residence_id: NORTE, user_id: "solo-lectura", role: "staff", is_active: true, permissions: permissionsFromChecked([]) },
        { id: "ru3", residence_id: NORTE, user_id: "perfil", role: "staff", is_active: true, permissions: permissionsFromChecked(["profile.edit"]) },
        { id: "ru4", residence_id: OTRA, user_id: "otro", role: "owner", is_active: true },
      ],
      files: [file("f1", NORTE), file("f2", NORTE), file("pend", NORTE, "pending_review"), file("rech", NORTE, "rejected"), file("ajena", OTRA)],
      residence_photo_meta: meta,
    },
    options,
  );
  state.db = db.client;
  return db;
}
const mains = (db: ReturnType<typeof seed>) => db.tables.residence_photo_meta.filter((m) => m.is_cover === true).map((m) => m.file_id);

beforeEach(() => {
  state.userId = "ricardo";
  audits.length = 0;
});

describe("setMainCoverPhoto", () => {
  it("el dueño elige la principal: crea la fila si no existía y queda auditado", async () => {
    const db = seed();
    expect(await setMainCoverPhoto(NORTE, "f1")).toEqual({ status: "success", fileId: "f1" });
    expect(db.tables.residence_photo_meta).toEqual([expect.objectContaining({ file_id: "f1", residence_id: NORTE, is_cover: true })]);
    expect(audits[0]).toMatchObject({ action: "residence_cover_photo_set", newValue: { file_id: "f1" } });
  });
  it("elegir otra apaga la anterior (nunca dos principales) y conserva el resto de la clasificación", async () => {
    const db = seed({}, [
      { file_id: "f1", residence_id: NORTE, category: "area", area: "cocina", is_cover: true },
      { file_id: "f2", residence_id: NORTE, category: "general", area: null, is_cover: false },
    ]);
    await setMainCoverPhoto(NORTE, "f2");
    expect(mains(db)).toEqual(["f2"]);
    expect(db.tables.residence_photo_meta.find((m) => m.file_id === "f1")).toMatchObject({ category: "area", area: "cocina", is_cover: false });
  });
  it("null quita la principal", async () => {
    const db = seed({}, [{ file_id: "f1", residence_id: NORTE, category: "general", is_cover: true }]);
    expect(await setMainCoverPhoto(NORTE, null)).toEqual({ status: "success", fileId: null });
    expect(mains(db)).toEqual([]);
  });
  it("no toca la principal de otra residencia", async () => {
    const db = seed({}, [{ file_id: "ajena", residence_id: OTRA, category: "general", is_cover: true }]);
    await setMainCoverPhoto(NORTE, "f1");
    expect(mains(db).sort()).toEqual(["ajena", "f1"]);
  });
  it("el staff con permiso de perfil puede; sin permiso o de otra residencia, no", async () => {
    const db = seed();
    state.userId = "perfil";
    expect((await setMainCoverPhoto(NORTE, "f1")).status).toBe("success");
    state.userId = "solo-lectura";
    expect(await setMainCoverPhoto(NORTE, "f2")).toEqual({ status: "error", message: PERMISSION_DENIED_MESSAGE });
    state.userId = "otro";
    expect((await setMainCoverPhoto(NORTE, "f2")).status).toBe("error");
    expect(mains(db)).toEqual(["f1"]);
  });
  it("sin sesión no hace nada", async () => {
    const db = seed();
    state.userId = "";
    expect((await setMainCoverPhoto(NORTE, "f1")).status).toBe("error");
    expect(db.tables.residence_photo_meta).toHaveLength(0);
  });
  it("rechaza fotos pendientes, borradas, de otra residencia o inexistentes, y deja la principal actual", async () => {
    const db = seed({}, [{ file_id: "f1", residence_id: NORTE, category: "general", is_cover: true }]);
    for (const id of ["pend", "rech", "ajena", "no-existe"]) {
      expect((await setMainCoverPhoto(NORTE, id)).status).toBe("error");
    }
    expect(mains(db)).toEqual(["f1"]);
  });
  it("sin la migración 0097 avisa en español y no rompe", async () => {
    seed({ missingColumns: { residence_photo_meta: ["is_cover"] } });
    const r = await setMainCoverPhoto(NORTE, "f1");
    expect(r).toMatchObject({ status: "error" });
    expect((r as { message: string }).message).toMatch(/todavía no está disponible/);
  });
});
