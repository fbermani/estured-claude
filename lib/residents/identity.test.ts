import { describe, expect, it } from "vitest";
import { normalizeResidentName, normalizeResidentPhone } from "@/lib/residents/identity";
import { buildResidentInviteWhatsappUrl } from "@/lib/residents/inviteMessage";

describe("residente sin mail", () => {
  it("normaliza el nombre", () => {
    expect(normalizeResidentName("  Ana   Pérez ")).toBe("Ana Pérez");
    expect(normalizeResidentName("A")).toBeNull();
    expect(normalizeResidentName(undefined)).toBeNull();
  });
  it("normaliza el teléfono a dígitos", () => {
    expect(normalizeResidentPhone("+54 9 11 1234-5678")).toBe("5491112345678");
    expect(normalizeResidentPhone("12")).toBeNull();
    expect(normalizeResidentPhone("abc")).toBeNull();
  });
  it("el link de WhatsApp con teléfono abre ese chat; sin teléfono, el selector", () => {
    expect(buildResidentInviteWhatsappUrl("hola", "5491112345678")).toBe("https://wa.me/5491112345678?text=hola");
    expect(buildResidentInviteWhatsappUrl("hola")).toBe("https://wa.me/?text=hola");
  });
});
