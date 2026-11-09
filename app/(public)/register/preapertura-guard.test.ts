import { describe, expect, it, vi } from "vitest";

/**
 * Con `PREAPERTURA=on` las altas clásicas (`/register/student` desde 14 años y `/register/family`) quedan cortadas EN EL SERVIDOR:
 * una acción de servidor se puede invocar sin pasar por la página, así que el corte no puede depender del redirect de la página.
 * Si el corte fallara, estas acciones tocarían la base: el cliente de admin simulado hace fallar la prueba si se usa.
 */
vi.mock("server-only", () => ({}));
vi.mock("@/lib/preapertura/flag", () => ({ isPreaperturaOn: () => true }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("NEXT_REDIRECT"); } }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: async () => { throw new Error("no debería tocar la sesión"); } }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => { throw new Error("no debería tocar la base"); } }));

import { registerStudent } from "@/app/(public)/register/student/actions";
import { registerFamily } from "@/app/(public)/register/family/actions";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

describe("altas clásicas con la preapertura encendida", () => {
  it("registerStudent (14+) devuelve error y no crea nada, ni siquiera con datos válidos o con invitación", async () => {
    const valid = { first_name: "Ana", last_name: "Paz", birth_date: "2010-01-01", email: "ana@mail.com", phone: "+54 11 5555 1234", password: "Clave-segura-123", accept_terms: "on", accept_privacy: "on" };
    const extras: Record<string, string>[] = [{}, { invite: "token-cualquiera" }];
    for (const extra of extras) {
      const state = await registerStudent({ status: "idle" }, form({ ...valid, ...extra }));
      expect(state.status).toBe("error");
      expect(state.message).toContain("todavía no está abierto");
    }
  });
  it("registerFamily devuelve error y no crea nada", async () => {
    const state = await registerFamily(
      { status: "idle" },
      form({ first_name: "Mar", last_name: "Paz", relationship_type: "madre", phone: "+54 11 5555 1234", email: "mar@mail.com", password: "Clave-segura-123", student_email: "ana@mail.com", accept_terms: "on", accept_privacy: "on" }),
    );
    expect(state.status).toBe("error");
    expect(state.message).toContain("todavía no está abierto");
  });
});
