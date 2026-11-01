import { describe, expect, it } from "vitest";
import { canGenerateInvite, canTransition, inviteExpiry, inviteState, validateSignupForm, type InviteRow } from "@/lib/residenceSignup/rules";

const NOW = new Date("2026-11-01T12:00:00Z");
const future = new Date(NOW.getTime() + 3600_000).toISOString();
const past = new Date(NOW.getTime() - 3600_000).toISOString();
const row = (over: Partial<InviteRow> = {}): InviteRow => ({ status: "visit_scheduled", invite_expires_at: future, invite_used_at: null, ...over });

describe("transiciones de la solicitud de alta", () => {
  it("permite el camino received -> in_contact -> visit_scheduled", () => {
    expect(canTransition("received", "in_contact")).toBe(true);
    expect(canTransition("in_contact", "visit_scheduled")).toBe(true);
  });
  it("no deja saltear pasos ni entregar la cuenta a mano", () => {
    expect(canTransition("received", "visit_scheduled")).toBe(false);
    expect(canTransition("visit_scheduled", "account_delivered")).toBe(false);
  });
  it("se puede descartar mientras está activa, pero los estados finales no se mueven", () => {
    expect(canTransition("in_contact", "discarded")).toBe(true);
    expect(canTransition("discarded", "received")).toBe(false);
    expect(canTransition("account_delivered", "discarded")).toBe(false);
  });
  it("la invitación exige visit_scheduled, email confirmado y sin uso previo", () => {
    expect(canGenerateInvite("visit_scheduled", null, past)).toBe(true);
    expect(canGenerateInvite("in_contact", null, past)).toBe(false);
    expect(canGenerateInvite("visit_scheduled", past, past)).toBe(false);
    expect(canGenerateInvite("visit_scheduled", null, null)).toBe(false);
  });
});

describe("estado del enlace de invitación", () => {
  it("válido, vencido, usado e inexistente", () => {
    expect(inviteState(row(), NOW)).toBe("valid");
    expect(inviteState(row({ invite_expires_at: past }), NOW)).toBe("expired");
    expect(inviteState(row({ invite_used_at: past }), NOW)).toBe("used");
    expect(inviteState(row({ status: "account_delivered" }), NOW)).toBe("used");
    expect(inviteState(null, NOW)).toBe("invalid");
  });
  it("una solicitud descartada o retrocedida invalida el enlace", () => {
    expect(inviteState(row({ status: "discarded" }), NOW)).toBe("invalid");
    expect(inviteState(row({ status: "in_contact" }), NOW)).toBe("invalid");
  });
  it("vence a los 7 días", () => {
    expect(inviteExpiry(NOW).getTime() - NOW.getTime()).toBe(7 * 24 * 3600_000);
  });
});

describe("validación del formulario público", () => {
  const ok = { residence_name: "Casa Norte", neighborhood: "Palermo", contact_name: "Ana Gómez", email: " ANA@mail.com ", phone: "+54 9 11 5555 1234" };
  it("acepta lo mínimo y normaliza el email", () => {
    const r = validateSignupForm(ok);
    expect(r.ok && r.value.email).toBe("ana@mail.com");
  });
  it("marca el campo inválido", () => {
    const r = validateSignupForm({ ...ok, email: "x" });
    expect(!r.ok && r.field).toBe("email");
    const b = validateSignupForm({ ...ok, approx_beds: "0" });
    expect(!b.ok && b.field).toBe("approx_beds");
  });
});
