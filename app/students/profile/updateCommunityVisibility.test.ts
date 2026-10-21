import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * H04 — la action `updateCommunityVisibility` con un cliente Supabase
 * falso: el error de `consents` no deja la visibilidad activada, y el menor
 * se decide por `birth_date`, no por el flag `is_minor`.
 */
const state = vi.hoisted(() => ({
  profile: { id: "sp-1", birth_date: "2000-01-01", is_minor: false } as Record<string, unknown>,
  visibility: null as Record<string, unknown> | null,
  upserts: [] as Record<string, unknown>[],
  consents: [] as Record<string, unknown>[],
  consentError: null as { message: string } | null,
  audits: [] as unknown[],
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "1.2.3.4", "user-agent": "vitest" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: async () => ({ id: "user-1" }) }));
vi.mock("@/lib/audit", () => ({
  createAuditLog: async (_admin: unknown, entry: unknown) => {
    state.audits.push(entry);
    return true;
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from(table: string) {
      const selectChain = (row: () => unknown) => ({
        eq: () => ({ maybeSingle: async () => ({ data: row(), error: null }) }),
      });
      if (table === "student_profiles") return { select: () => selectChain(() => state.profile) };
      if (table === "student_visibility_settings") {
        return {
          select: () => selectChain(() => state.visibility),
          upsert: async (row: Record<string, unknown>) => {
            state.upserts.push(row);
            return { error: null };
          },
        };
      }
      if (table === "consents") {
        return {
          insert: async (row: Record<string, unknown>) => {
            if (state.consentError) return { error: state.consentError };
            state.consents.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`tabla inesperada: ${table}`);
    },
  }),
}));

import { updateCommunityVisibility } from "@/app/students/profile/actions";

function form(fields: Record<string, "on">): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}
const idle = { status: "idle" } as const;

beforeEach(() => {
  state.profile = { id: "sp-1", birth_date: "2000-01-01", is_minor: false };
  state.visibility = null;
  state.upserts = [];
  state.consents = [];
  state.consentError = null;
  state.audits = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("updateCommunityVisibility (H04)", () => {
  it("un adulto activa el perfil y queda el consentimiento versionado", async () => {
    const res = await updateCommunityVisibility(idle, form({ community_master: "on", show_age: "on" }));
    expect(res.status).toBe("saved");
    expect(state.upserts[0]).toMatchObject({ is_individual_profile_visible: true, show_age_to_registered: true });
    expect(state.consents).toHaveLength(1);
    expect(state.consents[0]).toMatchObject({ consent_type: "student_visibility" });
  });

  it("si falla el insert en consents, la visibilidad se revierte y devuelve error", async () => {
    state.consentError = { message: "boom" };
    const res = await updateCommunityVisibility(idle, form({ community_master: "on" }));
    expect(res.status).toBe("error");
    expect(res.message).toMatch(/consentimiento/);
    expect(state.upserts).toHaveLength(2);
    expect(state.upserts[1]).toMatchObject({ is_individual_profile_visible: false });
    expect(state.audits).toHaveLength(0);
  });

  it("si falla consents y antes había una config, se restaura esa config", async () => {
    state.visibility = {
      is_individual_profile_visible: false,
      show_age_to_registered: true,
      show_nationality_to_registered: false,
      show_career_to_registered: false,
      show_origin_city_to_registered: false,
      show_habits_to_registered: false,
      show_interests_to_registered: false,
    };
    state.consentError = { message: "boom" };
    await updateCommunityVisibility(idle, form({ community_master: "on" }));
    expect(state.upserts[1]).toMatchObject({ is_individual_profile_visible: false, show_age_to_registered: true });
  });

  it("apagar la visibilidad no escribe en consents (queda en el audit log)", async () => {
    state.visibility = { is_individual_profile_visible: true, show_age_to_registered: true };
    const res = await updateCommunityVisibility(idle, form({}));
    expect(res.status).toBe("saved");
    expect(state.consents).toHaveLength(0);
    expect(state.audits).toHaveLength(1);
  });

  it("un menor por birth_date no puede activar, aunque el flag is_minor diga false", async () => {
    const d = new Date();
    state.profile = { id: "sp-1", birth_date: `${d.getFullYear() - 15}-06-15`, is_minor: false };
    const res = await updateCommunityVisibility(idle, form({ community_master: "on" }));
    expect(res.status).toBe("error");
    expect(state.upserts).toHaveLength(0);
    expect(state.consents).toHaveLength(0);
  });

  it("quien cumplió 18 puede activar aunque is_minor siga en true", async () => {
    state.profile = { id: "sp-1", birth_date: "2000-01-01", is_minor: true };
    const res = await updateCommunityVisibility(idle, form({ community_master: "on" }));
    expect(res.status).toBe("saved");
  });

  it("sin birth_date se trata como menor", async () => {
    state.profile = { id: "sp-1", birth_date: null, is_minor: false };
    const res = await updateCommunityVisibility(idle, form({ community_master: "on" }));
    expect(res.status).toBe("error");
  });
});
