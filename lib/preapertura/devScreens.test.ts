import { describe, expect, it, vi } from "vitest";
import { DEV_SCREENS, DEV_STATES, devPrepareHref, isCurrentDevScreen } from "@/lib/preapertura/devScreens";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServer: async () => { throw new Error("no debería tocar la sesión"); } }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => { throw new Error("no debería tocar la base"); } }));
vi.mock("@/lib/preapertura/flag", () => ({ isPreaperturaOn: () => true }));

import { GET } from "@/app/(preapertura)/dev-preapertura/preparar/route";

const params = (q: string) => new URLSearchParams(q);

describe("mapa de pantallas del navegador «Pantallas (dev)»", () => {
  it("rutas únicas, estados válidos y cada enlace pasa por /dev-preapertura/preparar", () => {
    expect(new Set(DEV_SCREENS.map((s) => s.path)).size).toBe(DEV_SCREENS.length);
    expect(new Set(DEV_SCREENS.map((s) => s.id)).size).toBe(DEV_SCREENS.length);
    for (const s of DEV_SCREENS) {
      expect(DEV_STATES).toContain(s.state);
      expect(devPrepareHref(s)).toBe(`/dev-preapertura/preparar?estado=${s.state}&next=${encodeURIComponent(s.path)}`);
    }
  });
  it("cubre las pantallas del flujo: entrada, paso 1, perfil, familiar, Mi lugar (4 variantes), fundadoras, datos, éxito y legales", () => {
    const paths = DEV_SCREENS.map((s) => s.path.split("?")[0]);
    for (const p of ["/", "/preregistro", "/preregistro/perfil", "/preregistro/familiar", "/mi-lugar", "/fundadoras", "/register/residence", "/consentimientos"]) expect(paths).toContain(p);
    expect(paths.filter((p) => p === "/mi-lugar")).toHaveLength(4);
    expect(DEV_SCREENS.filter((s) => s.path.startsWith("/register/residence?dev=")).length).toBeGreaterThanOrEqual(2);
  });
  it("reconoce la pantalla actual por ruta y variante", () => {
    const at = (path: string, q = "") => DEV_SCREENS.find((s) => isCurrentDevScreen(s, path, params(q)))?.id;
    expect(at("/")).toBe("entrada");
    expect(at("/register/residence")).toBe("datos");
    expect(at("/register/residence", "dev=lleno")).toBe("exito-lleno");
    expect(at("/mi-lugar", "v=fam-pend")).toBe("lugar-fam-pend");
    expect(at("/ruta-ajena")).toBeUndefined();
  });
});

describe("ruta /dev-preapertura/preparar", () => {
  const call = (qs: string) => GET(new Request(`http://localhost:3000/dev-preapertura/preparar?${qs}`));
  it("FUERA de desarrollo (producción y tests) es un 404 y no toca sesión ni base", async () => {
    for (const env of ["production", "test"]) {
      vi.stubEnv("NODE_ENV", env);
      const res = await call("estado=anon&next=%2F");
      expect(res.status).toBe(404);
    }
    vi.unstubAllEnvs();
  });
  it("en desarrollo rechaza destinos que no son pantallas del flujo (nada de redirects abiertos) y estados inválidos", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect((await call("estado=anon&next=https%3A%2F%2Fevil.example")).status).toBe(400);
    expect((await call("estado=anon&next=%2Fadmin")).status).toBe(400);
    expect((await call("estado=root&next=%2F")).status).toBe(400);
    vi.unstubAllEnvs();
  });
});
