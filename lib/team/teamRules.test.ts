import { describe, expect, it } from "vitest";
import {
  canRemoveMember,
  checkInviteLimits,
  checkResendAllowed,
  checkResidenceCanInvite,
  isEligibleStaffAccount,
  isTerminalResidenceStatus,
  MAX_SENDS_PER_INVITATION,
  RESEND_COOLDOWN_MINUTES,
  INVITATION_TTL_DAYS,
  invitationExpiry,
  invitationView,
  MAX_INVITATIONS_PER_HOUR,
  MAX_STAFF_PER_RESIDENCE,
  validateInviteEmail,
} from "@/lib/team/teamRules";
import { generateInvitationToken, hashInvitationToken, isPlausibleInvitationToken } from "@/lib/team/invitationToken";
import { buildInvitationEmail, INVITATION_EMAIL_SUBJECT, truncateResidenceName } from "@/lib/team/teamCopy";

describe("validateInviteEmail", () => {
  it("normaliza a minúsculas y recorta", () => {
    expect(validateInviteEmail("  Sofia@Example.COM ")).toEqual({ ok: true, email: "sofia@example.com" });
  });
  it("rechaza vacío, sin arroba y larguísimo", () => {
    for (const bad of ["", "   ", "sin-arroba", "a@b", `${"a".repeat(200)}@x.com`, null, undefined]) {
      expect(validateInviteEmail(bad).ok, String(bad)).toBe(false);
    }
  });
});

describe("invitationView / vencimiento", () => {
  const now = new Date("2026-10-24T12:00:00.000Z");
  it("vence a los 7 días", () => {
    expect(INVITATION_TTL_DAYS).toBe(7);
    expect(invitationExpiry(now).toISOString()).toBe("2026-10-31T12:00:00.000Z");
  });
  it("pendiente vigente, pendiente vencida, aceptada y cancelada", () => {
    expect(invitationView({ status: "pending", expires_at: "2026-10-25T00:00:00.000Z" }, now)).toBe("pending");
    expect(invitationView({ status: "pending", expires_at: "2026-10-24T12:00:00.000Z" }, now)).toBe("expired");
    expect(invitationView({ status: "pending", expires_at: "2026-10-01T00:00:00.000Z" }, now)).toBe("expired");
    expect(invitationView({ status: "accepted", expires_at: "2026-10-01T00:00:00.000Z" }, now)).toBe("accepted");
    expect(invitationView({ status: "cancelled", expires_at: "2027-10-01T00:00:00.000Z" }, now)).toBe("cancelled");
  });
});

describe("checkInviteLimits", () => {
  it("deja invitar por debajo de los topes", () => {
    expect(checkInviteLimits({ activeStaff: 2, pendingInvitations: 1, sentLastHour: 1 }).ok).toBe(true);
  });
  it("frena a las 10 personas de staff contando pendientes", () => {
    const r = checkInviteLimits({ activeStaff: 7, pendingInvitations: 3, sentLastHour: 0 });
    expect(r.ok).toBe(false);
    expect(MAX_STAFF_PER_RESIDENCE).toBe(10);
  });
  it("frena el exceso por hora, incluso en un reenvío (que no suma lugar)", () => {
    expect(checkInviteLimits({ activeStaff: 0, pendingInvitations: 0, sentLastHour: MAX_INVITATIONS_PER_HOUR }).ok).toBe(false);
    expect(checkInviteLimits({ activeStaff: 0, pendingInvitations: 0, sentLastHour: MAX_INVITATIONS_PER_HOUR }, { forResend: true }).ok).toBe(false);
    // Un reenvío con la residencia llena de staff sí se permite (no ocupa un lugar nuevo).
    expect(checkInviteLimits({ activeStaff: 9, pendingInvitations: 1, sentLastHour: 0 }, { forResend: true }).ok).toBe(true);
  });
});

describe("canRemoveMember", () => {
  const staff = { userId: "s1", role: "staff" as const, isActive: true };
  it("el dueño quita a un staff activo", () => {
    expect(canRemoveMember({ actorUserId: "o1", actorRole: "owner", target: staff, activeOwnerCount: 1 }).allowed).toBe(true);
  });
  it("el staff no puede quitar a nadie", () => {
    const r = canRemoveMember({ actorUserId: "s2", actorRole: "staff", target: staff, activeOwnerCount: 1 });
    expect(r).toEqual({ allowed: false, error: "Esta acción la puede hacer solo el dueño de la residencia." });
  });
  it("nadie se quita a sí mismo", () => {
    const r = canRemoveMember({ actorUserId: "o1", actorRole: "owner", target: { userId: "o1", role: "owner", isActive: true }, activeOwnerCount: 2 });
    expect(r.allowed).toBe(false);
  });
  it("no se le quita el acceso a un dueño: la residencia nunca queda sin dueño", () => {
    const last = canRemoveMember({ actorUserId: "o2", actorRole: "owner", target: { userId: "o1", role: "owner", isActive: true }, activeOwnerCount: 1 });
    expect(last).toEqual({ allowed: false, error: "La residencia tiene que conservar al menos un dueño." });
    const other = canRemoveMember({ actorUserId: "o2", actorRole: "owner", target: { userId: "o1", role: "owner", isActive: true }, activeOwnerCount: 2 });
    expect(other.allowed).toBe(false);
  });
  it("no existe o ya está inactivo", () => {
    expect(canRemoveMember({ actorUserId: "o1", actorRole: "owner", target: null, activeOwnerCount: 1 }).allowed).toBe(false);
    expect(canRemoveMember({ actorUserId: "o1", actorRole: "owner", target: { ...staff, isActive: false }, activeOwnerCount: 1 }).allowed).toBe(false);
  });
  it("sin rol en la residencia no puede", () => {
    expect(canRemoveMember({ actorUserId: "x", actorRole: null, target: staff, activeOwnerCount: 1 }).allowed).toBe(false);
  });
});

describe("token de invitación", () => {
  it("es aleatorio, plausible y solo se guarda su hash SHA-256", () => {
    const a = generateInvitationToken();
    const b = generateInvitationToken();
    expect(a.token).not.toBe(b.token);
    expect(isPlausibleInvitationToken(a.token)).toBe(true);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.hash).toBe(hashInvitationToken(a.token));
    expect(a.hash).not.toContain(a.token);
    expect(a.hash).not.toBe(b.hash);
  });
  it("descarta formas inválidas", () => {
    for (const bad of ["", "corto", "a".repeat(44), `${"a".repeat(42)}!`, 123, null, undefined]) {
      expect(isPlausibleInvitationToken(bad), String(bad)).toBe(false);
    }
  });
});

describe("email de invitación", () => {
  it("es genérico: nombra la residencia, no incluye datos de personas ni promete nada", () => {
    const m = buildInvitationEmail({ residenceName: "Casa <Norte>", link: "https://estured.vercel.app/register/staff/abc", expiresInDays: 7 });
    expect(m.html).toContain("Casa &lt;Norte&gt;");
    expect(m.html).toContain("https://estured.vercel.app/register/staff/abc");
    expect(m.html).toContain("7 días");
    expect(`${m.subject} ${m.html}`.toLowerCase()).not.toMatch(/garantiz|mediaci|disponibilidad asegurada/);
  });
});

describe("reenvío: espera y tope por invitación (DR10, seguridad M1)", () => {
  const now = new Date("2026-10-24T15:00:00.000Z");
  it("exige RESEND_COOLDOWN_MINUTES desde el último envío", () => {
    expect(RESEND_COOLDOWN_MINUTES).toBe(10);
    expect(checkResendAllowed({ lastSentAt: "2026-10-24T14:55:00.000Z", sendCount: 1 }, now).ok).toBe(false);
    expect(checkResendAllowed({ lastSentAt: "2026-10-24T14:50:00.000Z", sendCount: 1 }, now).ok).toBe(true);
  });
  it("tope de envíos por invitación", () => {
    expect(MAX_SENDS_PER_INVITATION).toBe(5);
    expect(checkResendAllowed({ lastSentAt: "2026-10-24T10:00:00.000Z", sendCount: 4 }, now).ok).toBe(true);
    expect(checkResendAllowed({ lastSentAt: "2026-10-24T10:00:00.000Z", sendCount: 5 }, now).ok).toBe(false);
  });
});

describe("estado de la residencia para invitar y aceptar", () => {
  it("no se invita en borrador, rechazada, suspendida, archivada ni sin estado legible", () => {
    for (const status of ["draft", "rejected", "suspended", "archived", "", null, undefined]) {
      expect(checkResidenceCanInvite(status).ok, String(status)).toBe(false);
    }
    for (const status of ["pending_verification", "verification_scheduled", "verified_active", "needs_changes", "paused_by_residence", "paused_by_admin", "verification_expired"]) {
      expect(checkResidenceCanInvite(status).ok, status).toBe(true);
    }
  });
  it("estados terminales para aceptar (y fallar cerrado si no se lee)", () => {
    for (const status of ["rejected", "suspended", "archived", null, undefined]) expect(isTerminalResidenceStatus(status), String(status)).toBe(true);
    for (const status of ["draft", "pending_verification", "verified_active"]) expect(isTerminalResidenceStatus(status), status).toBe(false);
  });
});

describe("elegibilidad de la cuenta que acepta", () => {
  const ok = { isActive: true, isBlocked: false };
  it("dueño o staff de residencia, activa y no bloqueada", () => {
    expect(isEligibleStaffAccount({ ...ok, roles: ["residence_staff"] })).toBe(true);
    expect(isEligibleStaffAccount({ ...ok, roles: ["residence_owner"] })).toBe(true);
    expect(isEligibleStaffAccount({ ...ok, roles: ["family_member", "residence_owner"] })).toBe(true);
  });
  it("nunca admin, superadmin ni estudiante, aunque tengan rol de residencia", () => {
    for (const extra of ["admin", "superadmin", "student"]) {
      expect(isEligibleStaffAccount({ ...ok, roles: ["residence_staff", extra] }), extra).toBe(false);
    }
  });
  it("sin rol de residencia, inactiva o bloqueada: no", () => {
    expect(isEligibleStaffAccount({ ...ok, roles: ["family_member"] })).toBe(false);
    expect(isEligibleStaffAccount({ ...ok, roles: [] })).toBe(false);
    expect(isEligibleStaffAccount({ isActive: false, isBlocked: false, roles: ["residence_staff"] })).toBe(false);
    expect(isEligibleStaffAccount({ isActive: true, isBlocked: true, roles: ["residence_staff"] })).toBe(false);
    expect(isEligibleStaffAccount({ isActive: null, isBlocked: null, roles: ["residence_staff"] })).toBe(false);
  });
});

describe("email de invitación: el asunto no nombra la residencia", () => {
  it("asunto fijo y nombre acotado y escapado en el cuerpo", () => {
    const mail = buildInvitationEmail({ residenceName: `<b>${"Y".repeat(100)}</b>`, link: "https://x/register/staff/t", expiresInDays: 7 });
    expect(mail.subject).toBe(INVITATION_EMAIL_SUBJECT);
    expect(mail.subject).not.toContain("Y");
    expect(mail.html).not.toContain("<b>");
    expect(mail.html).not.toContain("Y".repeat(70));
  });
  it("truncateResidenceName acota a ~60 con puntos suspensivos y colapsa espacios", () => {
    expect(truncateResidenceName("Casa   Norte")).toBe("Casa Norte");
    const t = truncateResidenceName("A".repeat(100));
    expect(t.length).toBeLessThanOrEqual(60);
    expect(t.endsWith("…")).toBe(true);
  });
});
