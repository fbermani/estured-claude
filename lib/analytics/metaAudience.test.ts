import { describe, expect, it, vi } from "vitest";
import { pixelIdForViewer } from "@/lib/analytics/metaAudience";

const NOW = new Date("2026-11-27T15:00:00Z");
const ID = "1234567890";

/** Doble de la consulta `student_profiles.select(...).eq("user_id", …).maybeSingle()`. */
function fakeAdmin(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn(async () => result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { client: { from } as never, from, eq };
}

describe("Meta Pixel: quién queda afuera de la medición", () => {
  it("sin ID configurado no hay pixel ni consulta", async () => {
    const admin = fakeAdmin({ data: null, error: null });
    expect(await pixelIdForViewer(null, "u1", admin.client, NOW)).toBeNull();
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("sin sesión se mide (no se sabe la edad)", async () => {
    const admin = fakeAdmin({ data: null, error: null });
    expect(await pixelIdForViewer(ID, null, admin.client, NOW)).toBe(ID);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("un estudiante menor con sesión no se mide", async () => {
    const admin = fakeAdmin({ data: { birth_date: "2009-11-28" }, error: null });
    expect(await pixelIdForViewer(ID, "u1", admin.client, NOW)).toBeNull();
    expect(admin.from).toHaveBeenCalledWith("student_profiles");
    expect(admin.eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("al cumplir 18 vuelve a medirse (sale de la fecha, no de un flag guardado)", async () => {
    const admin = fakeAdmin({ data: { birth_date: "2008-11-27" }, error: null });
    expect(await pixelIdForViewer(ID, "u1", admin.client, NOW)).toBe(ID);
  });

  it("un perfil de estudiante sin fecha de nacimiento no se mide", async () => {
    const admin = fakeAdmin({ data: { birth_date: null }, error: null });
    expect(await pixelIdForViewer(ID, "u1", admin.client, NOW)).toBeNull();
  });

  it("una cuenta sin perfil de estudiante (familiar o residencia) se mide", async () => {
    const admin = fakeAdmin({ data: null, error: null });
    expect(await pixelIdForViewer(ID, "u1", admin.client, NOW)).toBe(ID);
  });

  it("si la consulta falla o no hay cliente, no se mide", async () => {
    const admin = fakeAdmin({ data: null, error: { message: "boom" } });
    expect(await pixelIdForViewer(ID, "u1", admin.client, NOW)).toBeNull();
    expect(await pixelIdForViewer(ID, "u1", null, NOW)).toBeNull();
  });
});
