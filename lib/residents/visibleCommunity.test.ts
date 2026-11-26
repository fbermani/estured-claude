import { describe, expect, it } from "vitest";
import { slugsWithVisibleProfiles, type VisibleProfileRow } from "./communityVisibility";

const row = (slug: string, over: Partial<{ status: string; birth: string | null; visible: boolean | null }> = {}): VisibleProfileRow => {
  const { status = "active", birth = "2000-01-01", visible = true } = over;
  return {
    status,
    residences: { slug },
    student_profiles: {
      birth_date: birth,
      student_visibility_settings: visible === null ? null : { is_individual_profile_visible: visible },
    },
  };
};

describe("slugsWithVisibleProfiles (DR68: botón «Ver comunidad»)", () => {
  it("incluye la residencia con al menos un perfil visible", () => {
    expect(slugsWithVisibleProfiles([row("a"), row("a", { visible: false })])).toEqual(new Set(["a"]));
  });

  it("excluye perfiles ocultos, sin configuración, menores, sin fecha y estadías no activas", () => {
    const rows = [
      row("oculto", { visible: false }),
      row("sin-config", { visible: null }),
      row("menor", { birth: new Date().toISOString().slice(0, 10) }),
      row("sin-fecha", { birth: null }),
      row("pendiente", { status: "pending_activation" }),
    ];
    expect(slugsWithVisibleProfiles(rows).size).toBe(0);
  });

  it("ignora filas sin estudiante o sin residencia", () => {
    expect(slugsWithVisibleProfiles([{ status: "active", residences: null, student_profiles: null }]).size).toBe(0);
  });
});
