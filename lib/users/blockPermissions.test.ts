import { describe, expect, it } from "vitest";
import { canBlockUser } from "./blockPermissions";

const base = { actorUserId: "a", targetUserId: "t" };

describe("canBlockUser (DR9)", () => {
  it("nadie se bloquea a sí mismo, ni un superadmin", () => {
    const r = canBlockUser({ ...base, targetUserId: "a", actorRoles: ["superadmin"], targetRoles: ["superadmin"] });
    expect(r.allowed).toBe(false);
  });
  it("un admin bloquea usuarios no administrativos", () => {
    for (const role of ["student", "family_member", "residence_owner", "residence_staff", "registered_user"]) {
      expect(canBlockUser({ ...base, actorRoles: ["admin"], targetRoles: [role] }).allowed).toBe(true);
    }
  });
  it("un admin no bloquea a un admin ni a un superadmin", () => {
    expect(canBlockUser({ ...base, actorRoles: ["admin"], targetRoles: ["admin"] }).allowed).toBe(false);
    expect(canBlockUser({ ...base, actorRoles: ["admin"], targetRoles: ["superadmin"] }).allowed).toBe(false);
  });
  it("criterio conservador: un rol admin en cualquiera de las fuentes cuenta como administrativo", () => {
    expect(canBlockUser({ ...base, actorRoles: ["admin"], targetRoles: ["student", "admin"] }).allowed).toBe(false);
    expect(canBlockUser({ ...base, actorRoles: ["admin"], targetRoles: [null, "superadmin"] }).allowed).toBe(false);
  });
  it("un superadmin bloquea a admins y superadmins", () => {
    expect(canBlockUser({ ...base, actorRoles: ["superadmin"], targetRoles: ["admin"] }).allowed).toBe(true);
    expect(canBlockUser({ ...base, actorRoles: ["superadmin"], targetRoles: ["superadmin"] }).allowed).toBe(true);
  });
  it("quien no es admin no bloquea a nadie", () => {
    expect(canBlockUser({ ...base, actorRoles: ["student"], targetRoles: ["student"] }).allowed).toBe(false);
    expect(canBlockUser({ ...base, actorRoles: [], targetRoles: ["student"] }).allowed).toBe(false);
  });
});
