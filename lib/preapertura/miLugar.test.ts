import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadMiLugar } from "@/lib/preapertura/miLugar";

/** `admin` falso: cada `maybeSingle` consume la siguiente respuesta. */
function fakeAdmin(replies: { data: unknown; error: { code: string } | null }[]) {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => replies.shift()! };
  return { from: () => q } as unknown as SupabaseClient;
}

const studentRow = {
  role: "student", created_at: "2026-11-26T12:00:00Z", first_name: "Lu", country: "Chile", university: "UBA",
  career: "Derecho", entry_month: 3, entry_unsure: false, room_type: "any", habits: [], interests: [],
};

describe("loadMiLugar: número de registro (DR67)", () => {
  it("devuelve el número guardado del estudiante", async () => {
    const data = await loadMiLugar(fakeAdmin([{ data: { ...studentRow, registration_number: 11 }, error: null }]), "u1");
    expect(data.registrationNumber).toBe(11);
  });

  it("sin la columna (0111 sin aplicar) carga igual, sin número", async () => {
    const data = await loadMiLugar(fakeAdmin([{ data: null, error: { code: "42703" } }, { data: studentRow, error: null }]), "u1");
    expect(data).toMatchObject({ role: "student", registrationNumber: null });
  });

  it("familiar y cuenta sin fila no tienen número", async () => {
    const family = await loadMiLugar(
      fakeAdmin([{ data: { ...studentRow, role: "family", registration_number: null }, error: null }, { data: null, error: null }]),
      "u2",
    );
    expect(family).toMatchObject({ role: "family", registrationNumber: null });
    const none = await loadMiLugar(fakeAdmin([{ data: null, error: null }]), "u3");
    expect(none).toMatchObject({ role: null, registrationNumber: null });
  });
});

describe("loadMiLugar: perfil completo (DR67)", () => {
  const load = (row: Record<string, unknown>) => loadMiLugar(fakeAdmin([{ data: row, error: null }]), "u1");

  it("con los 6 obligatorios está completo, aunque falten hábitos e intereses", async () => {
    expect((await load(studentRow)).profileComplete).toBe(true);
  });

  it("«Todavía no sé» cuenta como mes", async () => {
    expect((await load({ ...studentRow, entry_month: null, entry_unsure: true })).profileComplete).toBe(true);
  });

  it("si falta cualquiera de los 6, no está completo", async () => {
    for (const missing of ["first_name", "country", "university", "career", "entry_month", "room_type"]) {
      expect((await load({ ...studentRow, [missing]: null })).profileComplete, missing).toBe(false);
    }
  });
});
