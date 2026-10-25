import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getOwnerResidenceCards } from "@/lib/residences/ownerDashboard";

/** Cliente de pura forma: `residence_users` devuelve las filas dadas; cualquier otra consulta devuelve vacío / 0. */
function chain(result: unknown) {
  const p: unknown = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") return (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej);
      return () => p;
    },
  });
  return p;
}

function adminWith(links: unknown[]) {
  return {
    from: (table: string) => chain(table === "residence_users" ? { data: links, error: null } : { data: [], count: 0, error: null }),
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
  } as never;
}

const links = [
  { role: "owner", residences: { id: "res-a", name: "Norte", public_area: "Palermo", status: "verified_active", tagline: null } },
  { role: "staff", residences: { id: "res-b", name: "Río", public_area: "Belgrano", status: "verified_active", tagline: null } },
];

describe("getOwnerResidenceCards (DR10)", () => {
  it("sin opciones trae todas las residencias con el rol de la persona en cada una", async () => {
    const cards = await getOwnerResidenceCards(adminWith(links), "user-1");
    expect(cards.map((c) => [c.residenceId, c.role])).toEqual([
      ["res-a", "owner"],
      ["res-b", "staff"],
    ]);
  });

  it("con ownerOnly: true deja solo las residencias donde es dueña (para el PDF)", async () => {
    const cards = await getOwnerResidenceCards(adminWith(links), "user-1", { ownerOnly: true });
    expect(cards.map((c) => c.residenceId)).toEqual(["res-a"]);
  });

  it("con ownerOnly: true y solo vínculos de staff no hay tarjetas", async () => {
    expect(await getOwnerResidenceCards(adminWith([links[1]]), "user-1", { ownerOnly: true })).toEqual([]);
  });

  it("un rol desconocido se trata como staff (mínimo privilegio) y no entra en ownerOnly", async () => {
    const raro = [{ ...links[0], role: "superuser" }];
    expect(await getOwnerResidenceCards(adminWith(raro), "user-1", { ownerOnly: true })).toEqual([]);
    expect((await getOwnerResidenceCards(adminWith(raro), "user-1"))[0].role).toBe("staff");
  });
});
