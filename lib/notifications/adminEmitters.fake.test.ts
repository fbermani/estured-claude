import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const created: Record<string, unknown>[] = [];
vi.mock("@/lib/notifications/createNotification", () => ({
  createNotification: vi.fn(async (_admin: unknown, entry: Record<string, unknown>) => {
    created.push(entry);
  }),
}));

import { notifyAdminsSafe } from "@/lib/notifications/notifyAdminsSafe";
import { createSignupRequest } from "@/lib/residenceSignup/signupRequests";
import { stageProfileEdit } from "@/lib/residences/profileEdits";
import type { SignupInput } from "@/lib/residenceSignup/rules";

const ID = "00000000-0000-4000-8000-000000000001";

/** Cliente falso: inserta y devuelve un id; `user_roles` devuelve dos admin; `failRoles` hace lanzar esa lectura. */
function fakeAdmin(opts: { failRoles?: boolean } = {}) {
  return {
    from(table: string) {
      const builder: Record<string, unknown> = {
        select: () => builder,
        insert: () => builder,
        update: () => builder,
        eq: () => builder,
        single: async () => ({ data: { id: ID }, error: null }),
        in: async () => {
          if (opts.failRoles) throw new Error("boom");
          return { data: table === "user_roles" ? [{ user_id: "a1" }, { user_id: "a2" }, { user_id: "a1" }] : [], error: null };
        },
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(res, rej),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

const signupInput: SignupInput = {
  residence_name: "Casa Norte",
  address: "Av. Córdoba 1234, CABA",
  contact_name: "Ana Gómez",
  email: "ana@mail.com",
  phone: "+54 9 11 5555 1234",
  instagram_or_web: null,
  approx_beds: null,
};

beforeEach(() => {
  created.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("notifyAdminsSafe", () => {
  it("avisa a cada admin una vez con la categoría por defecto admin_requests", async () => {
    await notifyAdminsSafe(fakeAdmin(), { title: "t", body: "b", entityType: "support_cases", entityId: ID });
    expect(created.map((c) => c.userId)).toEqual(["a1", "a2"]);
    expect(created.every((c) => c.category === "admin_requests")).toBe(true);
  });

  it("un fallo al leer los admin no propaga la excepción", async () => {
    await expect(notifyAdminsSafe(fakeAdmin({ failRoles: true }), { title: "t", body: "b", entityType: "support_cases", entityId: ID })).resolves.toBeUndefined();
    expect(created).toHaveLength(0);
  });
});

describe("emisores de admin", () => {
  it("solicitud de alta de residencia: categoría admin_signups y entidad de la solicitud", async () => {
    expect(await createSignupRequest(fakeAdmin(), signupInput)).toEqual({ ok: true, duplicate: false });
    expect(created).toHaveLength(2);
    expect(created[0]).toMatchObject({ category: "admin_signups", relatedEntityType: "residence_signup_requests", relatedEntityId: ID });
  });

  it("edición de perfil pendiente: categoría admin_requests", async () => {
    const result = await stageProfileEdit(fakeAdmin(), { residenceId: ID, fieldGroup: "services" as never, oldValue: {}, newValue: {}, submittedByUserId: ID });
    expect(result).toEqual({ ok: true });
    expect(created[0]).toMatchObject({ category: "admin_requests", relatedEntityType: "residence_profile_edits", relatedEntityId: ID });
  });

  it("si el aviso falla, la mutación igual termina bien", async () => {
    expect(await createSignupRequest(fakeAdmin({ failRoles: true }), signupInput)).toEqual({ ok: true, duplicate: false });
    const result = await stageProfileEdit(fakeAdmin({ failRoles: true }), { residenceId: ID, fieldGroup: "services" as never, oldValue: {}, newValue: {}, submittedByUserId: ID });
    expect(result).toEqual({ ok: true });
  });
});
