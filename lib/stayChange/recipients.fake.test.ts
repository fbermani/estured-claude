import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { loadResidenceUserIds } from "@/lib/stayChange/recipients";
import { permissionsFromChecked } from "@/lib/residences/permissions";
import { createInMemorySupabase } from "@/lib/testing/inMemorySupabase";

const R = "res-1";

describe("loadResidenceUserIds (DR11): avisos de 'Quiero cambiar' según permisos", () => {
  const { client } = createInMemorySupabase({
    residence_users: [
      { residence_id: R, user_id: "dueno", role: "owner", is_active: true },
      { residence_id: R, user_id: "con", role: "staff", is_active: true, permissions: permissionsFromChecked(["residents.manage"]) },
      { residence_id: R, user_id: "sin", role: "staff", is_active: true, permissions: permissionsFromChecked(["faq.manage"]) },
      { residence_id: R, user_id: "inicial", role: "staff", is_active: true, permissions: {} },
      { residence_id: R, user_id: "viejo", role: "staff", is_active: true },
      { residence_id: R, user_id: "inactivo", role: "staff", is_active: false, permissions: permissionsFromChecked(["residents.manage"]) },
      { residence_id: "otra", user_id: "ajeno", role: "owner", is_active: true },
    ],
  });

  it("el dueño siempre y el staff con residents.manage; sin permisos guardados o sin el casillero, no", async () => {
    expect((await loadResidenceUserIds(client, R)).sort()).toEqual(["con", "dueno", "inicial"]);
  });

  it("acepta otro permiso", async () => {
    expect((await loadResidenceUserIds(client, R, "faq.manage")).sort()).toEqual(["dueno", "inicial", "sin"]);
  });
});
