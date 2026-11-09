import { describe, expect, it } from "vitest";
import { createSignupRequest } from "@/lib/residenceSignup/signupRequests";
import type { SignupInput } from "@/lib/residenceSignup/rules";
import type { SupabaseClient } from "@supabase/supabase-js";

const input: SignupInput = {
  residence_name: "Casa Norte",
  address: "Av. Córdoba 1234, CABA",
  contact_name: "Ana Gómez",
  email: "ana@mail.com",
  phone: "+54 9 11 5555 1234",
  instagram_or_web: null,
  approx_beds: null,
};

type Err = { code?: string; message?: string } | null;
/** Cliente simulado: cada `insert` devuelve el siguiente resultado de la cola y deja registrado lo que se intentó guardar. */
function fakeAdmin(results: Err[]) {
  const calls: Record<string, unknown>[] = [];
  const client = { from: () => ({ insert: async (row: Record<string, unknown>) => { calls.push(row); return { error: results.shift() ?? null }; } }) };
  return { admin: client as unknown as SupabaseClient, calls };
}

describe("createSignupRequest", () => {
  it("camino normal: guarda la dirección en `address` y no repite el insert", async () => {
    const { admin, calls } = fakeAdmin([null]);
    expect(await createSignupRequest(admin, input)).toEqual({ ok: true, duplicate: false });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ address: "Av. Córdoba 1234, CABA", source: "web" });
    expect(calls[0]).not.toHaveProperty("neighborhood");
  });

  it("rama pre-0080 (falta la columna `address`): reintenta con la dirección en `neighborhood` y sin `address`", async () => {
    const { admin, calls } = fakeAdmin([{ code: "42703", message: 'column "address" of relation "residence_signup_requests" does not exist' }, null]);
    expect(await createSignupRequest(admin, input)).toEqual({ ok: true, duplicate: false });
    expect(calls).toHaveLength(2);
    expect(calls[1]).not.toHaveProperty("address");
    expect(calls[1]).toMatchObject({ neighborhood: "Av. Córdoba 1234, CABA", residence_name: "Casa Norte", source: "web" });
  });

  it("la dirección larga se acota a 80 caracteres en el esquema viejo (límite de `neighborhood`)", async () => {
    const { admin, calls } = fakeAdmin([{ code: "PGRST204", message: "Could not find the 'address' column of 'residence_signup_requests' in the schema cache" }, null]);
    await createSignupRequest(admin, { ...input, address: "Calle ".repeat(30) });
    expect((calls[1].neighborhood as string).length).toBe(80);
  });

  it("un error de otra columna o de otra clase NO activa el reintento", async () => {
    const { admin, calls } = fakeAdmin([{ code: "42703", message: 'column "otra_cosa" does not exist' }]);
    expect(await createSignupRequest(admin, input)).toEqual({ ok: false, unavailable: true });
    expect(calls).toHaveLength(1);
    const other = fakeAdmin([{ code: "XX000", message: "boom" }]);
    expect(await createSignupRequest(other.admin, input)).toEqual({ ok: false, unavailable: false });
    expect(other.calls).toHaveLength(1);
  });

  it("duplicado activo (23505) es éxito marcado como duplicado", async () => {
    const { admin } = fakeAdmin([{ code: "23505", message: "duplicate key" }]);
    expect(await createSignupRequest(admin, input)).toEqual({ ok: true, duplicate: true });
  });
});
