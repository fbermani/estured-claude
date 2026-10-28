import { describe, expect, it } from "vitest";
import { buildResidentInviteMessage, buildResidentInviteWhatsappUrl } from "./inviteMessage";

describe("inviteMessage", () => {
  it("incluye residencia y link, sin promesas prohibidas", () => {
    const m = buildResidentInviteMessage({ residenceName: "Casa Sur", registerUrl: "https://x.test/register/student" });
    expect(m).toContain("Casa Sur");
    expect(m).toContain("https://x.test/register/student");
    expect(m).not.toMatch(/garant|respaldo|oficial|mediaci/i);
  });
  it("arma wa.me manual codificado", () => {
    const u = buildResidentInviteWhatsappUrl("hola ñ & más");
    expect(u.startsWith("https://wa.me/?text=")).toBe(true);
    expect(u).not.toContain(" ");
  });
});
