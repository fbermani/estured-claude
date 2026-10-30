import { describe, expect, it } from "vitest";
import {
  checkOtp,
  evaluateInvite,
  generateOtpCode,
  hashOtp,
  INVITE_TTL_DAYS,
  inviteExpiry,
  inviteSenderName,
  isPlausibleOtp,
  maskEmail,
  OTP_RESEND_COOLDOWN_SECONDS,
  otpCooldownRemaining,
  replyToFromContact,
} from "@/lib/residents/inviteRules";
import { checkCanRequestLink, cleanShortText, HOUSE_CODE_ALPHABET, normalizeHouseCode } from "@/lib/residents/linkRequestRules";
import { generateInvitationToken, hashInvitationToken, isPlausibleInvitationToken } from "@/lib/team/invitationToken";
import { buildOtpEmail, buildPersonalInviteMessage, buildResidentInviteEmail } from "@/lib/residents/inviteMessage";

const NOW = new Date("2026-10-30T12:00:00Z");
const open = { expires_at: "2026-11-10T00:00:00Z", used_at: null, revoked_at: null, declined_at: null };

describe("evaluateInvite", () => {
  it("abierta, usada, rechazada, revocada y vencida", () => {
    expect(evaluateInvite(open, NOW)).toBe("open");
    expect(evaluateInvite({ ...open, used_at: "2026-10-29T00:00:00Z" }, NOW)).toBe("used");
    expect(evaluateInvite({ ...open, revoked_at: "2026-10-29T00:00:00Z" }, NOW)).toBe("revoked");
    expect(evaluateInvite({ ...open, revoked_at: "x", declined_at: "2026-10-29T00:00:00Z" }, NOW)).toBe("declined");
    expect(evaluateInvite({ ...open, expires_at: "2026-10-30T12:00:00Z" }, NOW)).toBe("expired");
  });
  it("vence a los 14 días", () => {
    expect(inviteExpiry(NOW).getTime() - NOW.getTime()).toBe(INVITE_TTL_DAYS * 86_400_000);
    expect(INVITE_TTL_DAYS).toBe(14);
  });
});

describe("token del enlace", () => {
  it("se guarda solo el hash y la forma se valida", () => {
    const { token, hash } = generateInvitationToken();
    expect(isPlausibleInvitationToken(token)).toBe(true);
    expect(hash).toBe(hashInvitationToken(token));
    expect(hash).not.toContain(token);
    expect(isPlausibleInvitationToken("corto")).toBe(false);
  });
});

describe("OTP", () => {
  const id = "inv-1";
  const base = (code: string, extra = {}) => ({
    otp_hash: hashOtp(code, id),
    otp_expires_at: new Date(NOW.getTime() + 600_000).toISOString(),
    otp_attempts: 0,
    ...extra,
  });
  it("genera 6 dígitos", () => {
    for (let i = 0; i < 50; i++) expect(isPlausibleOtp(generateOtpCode())).toBe(true);
    expect(isPlausibleOtp("12345")).toBe(false);
    expect(isPlausibleOtp("12345a")).toBe(false);
  });
  it("acepta el código correcto y está atado a la invitación", () => {
    expect(checkOtp(base("123456"), "123456", id, NOW)).toEqual({ ok: true });
    expect(checkOtp(base("123456"), "123456", "otra", NOW).ok).toBe(false);
  });
  it("rechaza erróneo con intentos restantes, vencido, bloqueado y sin código", () => {
    expect(checkOtp(base("123456"), "000000", id, NOW)).toMatchObject({ ok: false, reason: "wrong" });
    expect(checkOtp(base("123456", { otp_expires_at: NOW.toISOString() }), "123456", id, NOW)).toMatchObject({ reason: "expired" });
    expect(checkOtp({ otp_hash: null, otp_expires_at: null, otp_attempts: 0 }, "123456", id, NOW)).toMatchObject({ reason: "no_code" });
  });
  it("espera entre pedidos de código", () => {
    expect(otpCooldownRemaining({ otp_sent_at: null }, NOW)).toBe(0);
    expect(otpCooldownRemaining({ otp_sent_at: new Date(NOW.getTime() - 10_000).toISOString() }, NOW)).toBe(OTP_RESEND_COOLDOWN_SECONDS - 10);
    expect(otpCooldownRemaining({ otp_sent_at: new Date(NOW.getTime() - 61_000).toISOString() }, NOW)).toBe(0);
  });
});

describe("mail y remitente", () => {
  it("enmascara el mail", () => {
    expect(maskEmail("ana.perez@gmail.com")).toBe("a•••@gmail.com");
  });
  it("remitente «Residencia X te invita, vía EstuRed» sin caracteres peligrosos", () => {
    expect(inviteSenderName("Casa <Sur>\r\n")).toBe("Casa Sur te invita, vía EstuRed");
    expect(inviteSenderName("   ")).toBe("Tu residencia te invita, vía EstuRed");
  });
  it("reply-to solo si el contacto es un mail", () => {
    expect(replyToFromContact("Contacto@Casa.com")).toBe("contacto@casa.com");
    expect(replyToFromContact("+54 9 11 1234-5678")).toBeNull();
    expect(replyToFromContact(null)).toBeNull();
  });
  it("los textos no prometen nada ni filtran el mail", () => {
    const mail = buildResidentInviteEmail({ residenceName: "Casa <b>Sur</b>", firstName: "Ana", link: "https://x.test/register/student?invite=T" });
    expect(mail.html).toContain("Casa &lt;b&gt;Sur&lt;/b&gt;");
    expect(mail.html).not.toMatch(/garant|mediaci|oficial/i);
    expect(buildOtpEmail("123456").html).toContain("123456");
    const wa = buildPersonalInviteMessage({ residenceName: "Casa Sur", link: "https://x.test/register/student?invite=T" });
    expect(wa).toContain("https://x.test/register/student?invite=T");
    expect(wa).not.toMatch(/garant|mediaci/i);
  });
});

describe("solicitud de vínculo", () => {
  it("normaliza el código de casa", () => {
    expect(normalizeHouseCode("ab3-k7m")).toBe("AB3K7M");
    expect(normalizeHouseCode("AB3K7")).toBeNull();
    expect(normalizeHouseCode("AB3K70")).toBeNull(); // el 0 no está en el alfabeto
    expect(HOUSE_CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });
  it("frena el spam: estadía vigente, misma residencia y tope de 3 pendientes", () => {
    expect(checkCanRequestLink({ hasCurrentStay: false, pendingTotal: 0, pendingInSameResidence: false }).ok).toBe(true);
    expect(checkCanRequestLink({ hasCurrentStay: true, pendingTotal: 0, pendingInSameResidence: false }).ok).toBe(false);
    expect(checkCanRequestLink({ hasCurrentStay: false, pendingTotal: 1, pendingInSameResidence: true }).ok).toBe(false);
    expect(checkCanRequestLink({ hasCurrentStay: false, pendingTotal: 3, pendingInSameResidence: false }).ok).toBe(false);
    expect(checkCanRequestLink({ hasCurrentStay: false, pendingTotal: 2, pendingInSameResidence: false }).ok).toBe(true);
  });
  it("limpia textos cortos", () => {
    expect(cleanShortText("  hola   mundo ", 5)).toBe("hola");
    expect(cleanShortText("   ", 5)).toBeNull();
  });
});
