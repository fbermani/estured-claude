import { describe, expect, it } from "vitest";
import {
  allHidden,
  buildCommunityPreview,
  resolveVisibilityUpdate,
  MINOR_VISIBILITY_MESSAGE,
  type VisibilityValues,
} from "@/lib/students/communityVisibilitySettings";

const on = (overrides: Partial<VisibilityValues> = {}): VisibilityValues => ({
  ...allHidden(),
  is_individual_profile_visible: true,
  ...overrides,
});

describe("resolveVisibilityUpdate (H04)", () => {
  it("un menor no puede activar el perfil", () => {
    const res = resolveVisibilityUpdate({ isMinor: true, input: on(), current: null });
    expect(res).toEqual({ ok: false, error: MINOR_VISIBILITY_MESSAGE });
  });

  it("un menor no puede activar un dato suelto aunque el maestro venga apagado", () => {
    const res = resolveVisibilityUpdate({
      isMinor: true,
      input: { ...allHidden(), show_age_to_registered: true },
      current: null,
    });
    expect(res.ok).toBe(false);
  });

  it("un menor que guarda todo apagado queda todo en false", () => {
    const res = resolveVisibilityUpdate({ isMinor: true, input: allHidden(), current: on({ show_age_to_registered: true }) });
    expect(res).toEqual({ ok: true, values: allHidden() });
  });

  it("un adulto puede activar el perfil", () => {
    const res = resolveVisibilityUpdate({ isMinor: false, input: on(), current: null });
    expect(res.ok && res.values.is_individual_profile_visible).toBe(true);
  });

  it("los datos son independientes entre sí", () => {
    const res = resolveVisibilityUpdate({
      isMinor: false,
      input: on({ show_career_to_registered: true, show_interests_to_registered: true }),
      current: null,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.values.show_career_to_registered).toBe(true);
    expect(res.values.show_interests_to_registered).toBe(true);
    expect(res.values.show_age_to_registered).toBe(false);
    expect(res.values.show_nationality_to_registered).toBe(false);
    expect(res.values.show_origin_city_to_registered).toBe(false);
    expect(res.values.show_habits_to_registered).toBe(false);
  });

  it("apagar el maestro conserva las preferencias de datos previas", () => {
    const current = on({ show_age_to_registered: true, show_career_to_registered: true });
    const res = resolveVisibilityUpdate({ isMinor: false, input: allHidden(), current });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.values.is_individual_profile_visible).toBe(false);
    expect(res.values.show_age_to_registered).toBe(true);
    expect(res.values.show_career_to_registered).toBe(true);
  });
});

describe("buildCommunityPreview (H04)", () => {
  const data = {
    firstName: "Lucía",
    age: 19,
    nationality: "Chile",
    countryFlag: "🇨🇱",
    career: "Medicina",
    originCity: "Santiago",
    bio: "Hola",
    habits: ["Madrugador"],
    interests: ["Cine"],
  };

  it("con el maestro apagado se ve como plaza ocupada", () => {
    expect(buildCommunityPreview({ isMinor: false, values: allHidden(), data }).kind).toBe("placeholder");
  });

  it("un menor nunca aparece, ni con valores prendidos", () => {
    expect(buildCommunityPreview({ isMinor: true, values: on({ show_age_to_registered: true }), data }).kind).toBe(
      "placeholder",
    );
  });

  it("solo muestra los datos habilitados", () => {
    const p = buildCommunityPreview({ isMinor: false, values: on({ show_career_to_registered: true }), data });
    expect(p.kind).toBe("profile");
    if (p.kind !== "profile") return;
    expect(p.career).toBe("Medicina");
    expect(p.age).toBeNull();
    expect(p.nationality).toBeNull();
    expect(p.interests).toEqual([]);
  });
});
