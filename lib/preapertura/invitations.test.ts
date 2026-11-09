import { describe, expect, it } from "vitest";
import { hashInviteToken, isPlausibleInviteToken, newInviteToken } from "@/lib/preapertura/invitations";

describe("token de invitación familiar", () => {
  it("el token es largo, apto para URL y distinto cada vez; solo se guarda su hash", () => {
    const a = newInviteToken();
    const b = newInviteToken();
    expect(a.token).not.toBe(b.token);
    expect(isPlausibleInviteToken(a.token)).toBe(true);
    expect(a.hash).toBe(hashInviteToken(a.token));
    expect(a.hash).not.toContain(a.token);
    expect(a.hash).toHaveLength(64);
  });

  it("descarta lo que no tiene forma de token antes de ir a la base", () => {
    for (const bad of ["", "corto", "con espacios y símbolos!!!!!!!!!!", undefined, null, 42, "a".repeat(65)]) {
      expect(isPlausibleInviteToken(bad)).toBe(false);
    }
  });
});
