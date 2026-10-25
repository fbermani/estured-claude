import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Res = { data: unknown; error: { code?: string; message: string } | null };
let responses: Record<string, Res[]> = {};

function builder(table: string, cols?: string) {
  const b: Record<string, unknown> = {};
  const done = () => {
    const key = table === "residences" ? `residences:${cols?.includes("min_resident_age") ? "age" : "legacy"}` : table;
    return Promise.resolve(responses[key]?.shift() ?? { data: [], error: null });
  };
  for (const m of ["eq", "neq", "in", "order"]) b[m] = () => b;
  b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => done().then(ok, ko);
  return b;
}
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ from: (t: string) => ({ select: (c: string) => builder(t, c) }) }),
}));

import { getCatalogResidencesWithTotal } from "@/lib/residences/catalog";

const row = (id: string, min: number, max: number | null, minors = false) => ({
  id, slug: id, name: id, public_area: null, description: null, min_resident_age: min, max_resident_age: max, accepts_minors: minors,
});

beforeEach(() => {
  responses = {};
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("getCatalogResidencesWithTotal (filtro por edad)", () => {
  it("filtra por edad y devuelve el total sin filtrar", async () => {
    responses["residences:age"] = [{ data: [row("a", 18, 25), row("b", 18, null), row("c", 30, null)], error: null }];
    const r = await getCatalogResidencesWithTotal({ studentAge: 27 });
    expect(r.total).toBe(3);
    expect(r.residences.map((x) => x.slug)).toEqual(["b"]);
  });
  it("sin edad no filtra", async () => {
    responses["residences:age"] = [{ data: [row("a", 18, 25), row("c", 30, null)], error: null }];
    expect((await getCatalogResidencesWithTotal()).residences).toHaveLength(2);
  });
  it("cae al select legacy solo ante columna inexistente", async () => {
    responses["residences:age"] = [{ data: null, error: { code: "42703", message: "column x does not exist" } }];
    responses["residences:legacy"] = [{ data: [{ id: "z", slug: "z", name: "z", public_area: null, description: null }], error: null }];
    const r = await getCatalogResidencesWithTotal({ studentAge: 40 });
    expect(r.total).toBe(1);
    expect(r.residences).toHaveLength(1);
  });
  it("ante otro error no reintenta y devuelve vacío", async () => {
    responses["residences:age"] = [{ data: null, error: { code: "57014", message: "timeout" } }];
    responses["residences:legacy"] = [{ data: [row("a", 18, null)], error: null }];
    expect(await getCatalogResidencesWithTotal()).toEqual({ residences: [], total: 0 });
  });
  it("error en el select legacy devuelve vacío", async () => {
    responses["residences:age"] = [{ data: null, error: { code: "42703", message: "x" } }];
    responses["residences:legacy"] = [{ data: null, error: { message: "boom" } }];
    expect(await getCatalogResidencesWithTotal()).toEqual({ residences: [], total: 0 });
  });
});
