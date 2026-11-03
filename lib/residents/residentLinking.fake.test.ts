import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const audits = vi.hoisted(() => [] as { action: string; newValue?: Record<string, unknown> }[]);
vi.mock("@/lib/audit", () => ({
  createAuditLog: async (_a: unknown, entry: (typeof audits)[number]) => {
    audits.push(entry);
    return true;
  },
  notifyAdmins: async () => undefined,
  alertAdminsOfAuditFailure: async () => undefined,
}));
const mails = vi.hoisted(() => [] as { to: string; subject: string; html: string; fromName?: string; replyTo?: string }[]);
const mailState = vi.hoisted(() => ({ fail: false }));
vi.mock("@/lib/email/sendEmail", () => ({
  sendEmail: async (m: (typeof mails)[number]) => {
    if (mailState.fail) return false;
    mails.push(m);
    return true;
  },
}));
vi.mock("@/lib/residents/linkReservation", () => ({ findLinkableReservationIdByEmail: async () => null, linkStayToReservationIfMissing: async () => undefined }));
const families = vi.hoisted(() => ({} as Record<string, unknown>));
vi.mock("@/lib/family/access", () => ({ loadActiveFamilyOfStudent: async (_a: unknown, id: string) => families[id] ?? null }));
vi.mock("@/lib/residences/notifyResidenceTeam", () => ({ notifyResidenceTeam: async () => undefined }));
vi.mock("@/lib/notifications/createNotification", () => ({ createNotification: async () => undefined }));
vi.mock("@/lib/stayChange/recipients", () => ({ loadActiveFamilyUserIds: async () => [] }));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { issueResidentInvite, loadInviteStatusByStay } from "@/lib/residents/residentInvitations";
import { activateResidentStay } from "@/lib/residents/activateResidentStay";
import { declineResidentInvitation, sendInviteOtpByToken, sendInviteOtpForStay, verifyInviteOtpByToken, verifyInviteOtpForStay, peekResidentInvitation } from "@/lib/residents/inviteVerification";
import { setResidentEmail } from "@/lib/residents/setResidentEmail";
import { resolveLinkRequest } from "@/lib/residents/linkRequestsResidence";
import { submitLinkRequest, submitMissingResidence } from "@/lib/residents/linkRequestsStudent";
import { hashOtp } from "@/lib/residents/inviteRules";
import { regenerateHouseCode } from "@/lib/residents/linkRequestsResidence";

const R = "res-1";
const OWNER = "owner";
const STUDENT_USER = "u-ana";
const STUDENT = "sp-ana";

function world(extra: Partial<Record<string, Row[]>> = {}): Record<string, Row[]> {
  return {
    residence_users: [{ id: "ru", residence_id: R, user_id: OWNER, role: "owner", is_active: true }],
    residences: [{ id: R, name: "Casa Sur", status: "verified_active" }],
    residence_private_details: [{ residence_id: R, responsible_contact: "contacto@casasur.com", house_code: "AB3K7M" }],
    users: [
      { id: STUDENT_USER, email: "ana@mail.com" },
      { id: "u-otra", email: "otra@mail.com" },
    ],
    student_profiles: [
      { id: STUDENT, user_id: STUDENT_USER, is_minor: false, first_name: "Ana", last_initial: "P." },
      { id: "sp-otra", user_id: "u-otra", is_minor: false },
    ],
    resident_stays: [
      { id: "stay-1", residence_id: R, invite_email: "ana@mail.com", invite_name: "Ana Pérez", invite_phone: "5491112345678", student_profile_id: null, is_current: true, status: "pending_activation" },
    ],
    resident_stay_invitations: [],
    resident_link_requests: [],
    guardian_stay_confirmations: [],
    missing_residence_requests: [],
    ...extra,
  } as Record<string, Row[]>;
}
/** Emulación de las dos funciones SQL atómicas de la 0064 (la base real las ejecuta como un solo UPDATE). */
const rpc = {
  consume_invite_otp_attempt: (a: Record<string, unknown>, t: Record<string, Row[]>) => {
    const row = t.resident_stay_invitations.find((r) => r.id === a.p_invitation_id && !r.used_at && !r.revoked_at);
    const code = Number(row?.otp_code_attempts ?? 0);
    const total = Number(row?.otp_attempts ?? 0);
    if (!row || code >= Number(a.p_max_code) || total >= Number(a.p_max_total)) return { data: -1, error: null };
    row.otp_attempts = total + 1;
    row.otp_code_attempts = code + 1;
    return { data: Number(a.p_max_code) - (code + 1), error: null };
  },
  register_invite_otp_send: (a: Record<string, unknown>, t: Record<string, Row[]>) => {
    const row = t.resident_stay_invitations.find((r) => r.id === a.p_invitation_id && !r.used_at && !r.revoked_at);
    const n = Number(row?.otp_send_count ?? 0);
    if (!row || n >= Number(a.p_max_sends)) return { data: false, error: null };
    row.otp_send_count = n + 1;
    return { data: true, error: null };
  },
};
const mk = (tables: Record<string, Row[]>, opts: Record<string, unknown> = {}) => {
  const m = createInMemorySupabase(tables, { rpc, ...opts });
  return Object.assign(m.client, { tables: m.tables });
};
const tokenOf = (link: string) => new URL(link).searchParams.get("invite")!;

beforeEach(() => {
  mailState.fail = false;
  audits.length = 0;
  mails.length = 0;
  for (const k of Object.keys(families)) delete families[k];
});

describe("issueResidentInvite", () => {
  it("manda el mail desde «Residencia X te invita», con reply-to del contacto, y guarda solo el hash", async () => {
    const db = mk(world());
    const r = await issueResidentInvite(db as never, { actorUserId: OWNER, residenceId: R, residentStayId: "stay-1", channel: "email" });
    expect(r.ok && r.emailSent).toBe(true);
    expect(mails[0]).toMatchObject({ to: "ana@mail.com", fromName: "Casa Sur te invita, vía EstuRed", replyTo: "contacto@casasur.com" });
    const row = db.tables.resident_stay_invitations[0];
    expect(row.token_hash).toHaveLength(64);
    expect(JSON.stringify(row)).not.toContain(tokenOf((r as { link: string }).link));
    expect(audits[audits.length - 1]).toMatchObject({ action: "resident_invite_emailed" });
    expect(JSON.stringify(audits[audits.length - 1].newValue)).not.toContain("ana@mail.com");
  });
  it("reenviar invalida el enlace anterior (una sola abierta) y respeta el tiempo de espera", async () => {
    const db = mk(world());
    const a = await issueResidentInvite(db as never, { actorUserId: OWNER, residenceId: R, residentStayId: "stay-1", channel: "email" });
    const tooSoon = await issueResidentInvite(db as never, { actorUserId: OWNER, residenceId: R, residentStayId: "stay-1", channel: "email" });
    expect(tooSoon.ok).toBe(false);
    const b = await issueResidentInvite(db as never, { actorUserId: OWNER, residenceId: R, residentStayId: "stay-1", channel: "whatsapp" });
    expect(a.ok && b.ok).toBe(true);
    const rows = db.tables.resident_stay_invitations;
    expect(rows.filter((x) => !x.revoked_at && !x.used_at)).toHaveLength(1);
    expect(b.ok && b.whatsappUrl).toContain("https://wa.me/5491112345678?text=");
    expect(mails).toHaveLength(1); // WhatsApp no manda mail
  });
  it("exige permiso residents.manage y una estadía de ESTA residencia", async () => {
    const db = mk(world({ residence_users: [{ id: "ru2", residence_id: R, user_id: "staff", role: "staff", is_active: true, permissions: { "residents.manage": false } }] }));
    expect((await issueResidentInvite(db as never, { actorUserId: "staff", residenceId: R, residentStayId: "stay-1", channel: "email" })).ok).toBe(false);
    expect((await issueResidentInvite(db as never, { actorUserId: "intruso", residenceId: R, residentStayId: "stay-1", channel: "email" })).ok).toBe(false);
    const other = mk(world());
    expect((await issueResidentInvite(other as never, { actorUserId: OWNER, residenceId: R, residentStayId: "no-existe", channel: "email" })).ok).toBe(false);
  });
  it("no invita a un mail de un menor sin tutor", async () => {
    const t = world();
    (t.student_profiles[0] as Row).is_minor = true;
    const r = await issueResidentInvite(mk(t) as never, { actorUserId: OWNER, residenceId: R, residentStayId: "stay-1", channel: "email" });
    expect(r.ok).toBe(false);
  });
  it("sin la 0064 avisa con claridad", async () => {
    const db = mk(world(), { missingTables: ["resident_stay_invitations"] });
    const r = await issueResidentInvite(db as never, { actorUserId: OWNER, residenceId: R, residentStayId: "stay-1", channel: "email" });
    expect(r.ok).toBe(false);
    expect((await loadInviteStatusByStay(db as never, ["stay-1"])).size).toBe(0);
  });
});

describe("activación con enlace personal", () => {
  async function invite(db: ReturnType<typeof mk>, channel: "email" | "whatsapp" = "email") {
    const r = await issueResidentInvite(db as never, { actorUserId: OWNER, residenceId: R, residentStayId: "stay-1", channel });
    if (!r.ok) throw new Error(r.error);
    return tokenOf(r.link);
  }
  it("canal mail: el clic alcanza, queda activa y el enlace no se puede reusar", async () => {
    const db = mk(world());
    const token = await invite(db);
    const r = await activateResidentStay(db as never, { actorUserId: STUDENT_USER, rawToken: token });
    expect(r.ok).toBe(true);
    expect(db.tables.resident_stays[0]).toMatchObject({ student_profile_id: STUDENT, status: "active", invite_phone: null });
    expect(db.tables.resident_stay_invitations[0].used_at).toBeTruthy();
    expect(audits[audits.length - 1]).toMatchObject({ action: "resident_stay_activated", newValue: { via: "token_email" } });
    const again = await activateResidentStay(db as never, { actorUserId: STUDENT_USER, rawToken: token });
    expect(again.ok).toBe(false);
  });
  it("otro mail no activa aunque tenga el enlace", async () => {
    const db = mk(world());
    const token = await invite(db);
    const r = await activateResidentStay(db as never, { actorUserId: "u-otra", rawToken: token });
    expect(r.ok).toBe(false);
    expect(db.tables.resident_stays[0].student_profile_id).toBeNull();
  });
  it("canal WhatsApp: exige verificar el mail con el código antes de activar", async () => {
    const db = mk(world());
    const token = await invite(db, "whatsapp");
    expect((await activateResidentStay(db as never, { actorUserId: STUDENT_USER, rawToken: token })).ok).toBe(false);
    expect((await sendInviteOtpByToken(db as never, { rawToken: token })).ok).toBe(true);
    expect(mails[mails.length - 1].to).toBe("ana@mail.com");
    const code = /(\d{6})/.exec(mails[mails.length - 1].html)![1];
    expect((await verifyInviteOtpByToken(db as never, { rawToken: token, code: "000000" })).ok).toBe(false);
    expect((await verifyInviteOtpByToken(db as never, { rawToken: token, code })).ok).toBe(true);
    expect((await activateResidentStay(db as never, { actorUserId: STUDENT_USER, rawToken: token })).ok).toBe(true);
  });
  it("estadía sin mail: el código va al mail que escribe la persona y debe ser el de su cuenta", async () => {
    const t = world();
    Object.assign(t.resident_stays[0], { invite_email: null });
    const db = mk(t);
    const token = await invite(db, "whatsapp");
    await sendInviteOtpByToken(db as never, { rawToken: token, email: "otra@mail.com" });
    const code = /(\d{6})/.exec(mails[mails.length - 1].html)![1];
    await verifyInviteOtpByToken(db as never, { rawToken: token, code });
    expect((await activateResidentStay(db as never, { actorUserId: STUDENT_USER, rawToken: token })).ok).toBe(false); // verificó otra@, es la cuenta de ana@
    expect((await activateResidentStay(db as never, { actorUserId: "u-otra", rawToken: token })).ok).toBe(true);
  });
  it("el código se bloquea tras 5 intentos fallidos", async () => {
    const db = mk(world());
    const token = await invite(db, "whatsapp");
    await sendInviteOtpByToken(db as never, { rawToken: token });
    const code = /(\d{6})/.exec(mails[mails.length - 1].html)![1];
    for (let i = 0; i < 5; i++) await verifyInviteOtpByToken(db as never, { rawToken: token, code: "000000" });
    const r = await verifyInviteOtpByToken(db as never, { rawToken: token, code });
    expect(r.ok).toBe(false);
  });
  it("token vencido o inventado da mensaje accionable", async () => {
    const db = mk(world());
    const token = await invite(db);
    db.tables.resident_stay_invitations[0].expires_at = "2020-01-01T00:00:00Z";
    const r = await activateResidentStay(db as never, { actorUserId: STUDENT_USER, rawToken: token });
    expect(r.ok === false && r.error).toMatch(/venci/i);
    const fake = await peekResidentInvitation(db as never, "x".repeat(43));
    expect(fake.ok).toBe(false);
  });
  it("menor sin tutor vinculado: se bloquea y la invitación NO se consume; con tutor, queda pendiente de su confirmación (DR32)", async () => {
    const t = world();
    Object.assign(t.student_profiles[0], { is_minor: true });
    // La invitación se emite antes de que exista la cuenta del menor (la residencia no sabe la edad): la cuenta aparece después.
    const account = t.users.shift()!;
    const db = mk(t);
    const token = await invite(db);
    db.tables.users.unshift(account);
    const blocked = await activateResidentStay(db as never, { actorUserId: STUDENT_USER, rawToken: token });
    expect(blocked.ok === false && blocked.error).toMatch(/familiar o tutor/i);
    expect(db.tables.resident_stay_invitations[0].used_at).toBeFalsy();
    families[STUDENT] = { userId: "fam", name: "Madre", permissions: {} };
    const pending = await activateResidentStay(db as never, { actorUserId: STUDENT_USER, rawToken: token });
    expect(pending.ok && pending.pendingGuardian).toBe(true);
    expect(db.tables.resident_stays[0].student_profile_id).toBeNull();
    expect(db.tables.resident_stay_invitations[0].used_at).toBeFalsy();
  });
  it("una sola estadía vigente por estudiante", async () => {
    const t = world();
    t.resident_stays.push({ id: "stay-0", residence_id: "otra", invite_email: null, student_profile_id: STUDENT, is_current: true, status: "active" });
    const db = mk(t);
    const token = await invite(db);
    const r = await activateResidentStay(db as never, { actorUserId: STUDENT_USER, rawToken: token });
    expect(r.ok === false && r.error).toMatch(/estadía vigente/i);
  });
});

describe("activación sin enlace (mail + código)", () => {
  it("el mail coincidente solo NO alcanza; con el código verificado sí", async () => {
    const db = mk(world());
    expect((await activateResidentStay(db as never, { actorUserId: STUDENT_USER, residentStayId: "stay-1" })).ok).toBe(false);
    expect((await sendInviteOtpForStay(db as never, { userId: STUDENT_USER, residentStayId: "stay-1" })).ok).toBe(true);
    const code = /(\d{6})/.exec(mails[mails.length - 1].html)![1];
    expect((await activateResidentStay(db as never, { actorUserId: STUDENT_USER, residentStayId: "stay-1" })).ok).toBe(false); // todavía sin verificar
    expect((await verifyInviteOtpForStay(db as never, { userId: STUDENT_USER, residentStayId: "stay-1", code })).ok).toBe(true);
    const r = await activateResidentStay(db as never, { actorUserId: STUDENT_USER, residentStayId: "stay-1" });
    expect(r.ok).toBe(true);
    expect(audits[audits.length - 1].newValue).toEqual({ via: "email_code" });
  });
  it("no se pide código para una estadía de otro mail", async () => {
    const db = mk(world());
    expect((await sendInviteOtpForStay(db as never, { userId: "u-otra", residentStayId: "stay-1" })).ok).toBe(false);
    expect(mails).toHaveLength(0);
  });
  it("un hash de OTP robado de otra invitación no sirve", () => {
    expect(hashOtp("123456", "a")).not.toBe(hashOtp("123456", "b"));
  });
});

describe("«no soy yo»", () => {
  it("revoca la invitación y la residencia lo ve", async () => {
    const db = mk(world());
    const inv = await issueResidentInvite(db as never, { actorUserId: OWNER, residenceId: R, residentStayId: "stay-1", channel: "email" });
    const token = tokenOf((inv as { link: string }).link);
    expect((await declineResidentInvitation(db as never, { rawToken: token })).ok).toBe(true);
    expect((await activateResidentStay(db as never, { actorUserId: STUDENT_USER, rawToken: token })).ok).toBe(false);
    expect((await loadInviteStatusByStay(db as never, ["stay-1"])).get("stay-1")?.state).toBe("declined");
    expect(audits.some((a) => a.action === "resident_invite_declined")).toBe(true);
  });
});

describe("corregir el mail (setResidentEmail)", () => {
  it("cambia el mail de una estadía sin cuenta, invalida el enlace anterior y reenvía", async () => {
    const db = mk(world());
    const inv = await issueResidentInvite(db as never, { actorUserId: OWNER, residenceId: R, residentStayId: "stay-1", channel: "email" });
    const oldToken = tokenOf((inv as { link: string }).link);
    const r = await setResidentEmail(db as never, { actorUserId: OWNER, residenceId: R, residentStayId: "stay-1", email: "ana.nueva@mail.com" });
    expect(r.ok && r.emailSent).toBe(true);
    expect(db.tables.resident_stays[0].invite_email).toBe("ana.nueva@mail.com");
    expect(mails[mails.length - 1].to).toBe("ana.nueva@mail.com");
    expect(audits.some((a) => a.action === "resident_stay_email_changed")).toBe(true);
    const peek = await peekResidentInvitation(db as never, oldToken);
    expect(peek.ok).toBe(false);
  });
  it("no cambia el mail si ya hay cuenta vinculada o si es el mismo", async () => {
    const t = world();
    Object.assign(t.resident_stays[0], { student_profile_id: STUDENT });
    expect((await setResidentEmail(mk(t) as never, { actorUserId: OWNER, residenceId: R, residentStayId: "stay-1", email: "x@mail.com" })).ok).toBe(false);
    expect((await setResidentEmail(mk(world()) as never, { actorUserId: OWNER, residenceId: R, residentStayId: "stay-1", email: "ANA@mail.com" })).ok).toBe(false);
  });
});

describe("solicitud de vínculo", () => {
  it("el estudiante manda una solicitud (por lista o por código) y respeta los frenos", async () => {
    const db = mk(world());
    expect((await submitLinkRequest(db as never, { actorUserId: STUDENT_USER, residenceId: R, message: " Vivo en la 3B " })).ok).toBe(true);
    expect(db.tables.resident_link_requests[0]).toMatchObject({ status: "pending", message: "Vivo en la 3B", via_house_code: false });
    expect((await submitLinkRequest(db as never, { actorUserId: STUDENT_USER, residenceId: R })).ok).toBe(false); // ya hay una a esa residencia
    expect((await submitLinkRequest(mk(world()) as never, { actorUserId: STUDENT_USER, houseCode: "zzzzzz" })).ok).toBe(false);
    const viaCode = mk(world());
    expect((await submitLinkRequest(viaCode as never, { actorUserId: STUDENT_USER, houseCode: "ab3-k7m" })).ok).toBe(true);
    expect(viaCode.tables.resident_link_requests[0].via_house_code).toBe(true);
    expect(audits.some((a) => a.action === "resident_link_requested")).toBe(true);
  });
  it("tope de 3 pendientes y nada si ya tiene estadía vigente", async () => {
    const t = world({
      residences: [
        { id: R, name: "Casa Sur", status: "verified_active" },
        { id: "r2", name: "Dos", status: "verified_active" },
        { id: "r3", name: "Tres", status: "verified_active" },
        { id: "r4", name: "Cuatro", status: "verified_active" },
        { id: "rx", name: "Borrador", status: "draft" },
      ],
    });
    const db = mk(t);
    for (const id of [R, "r2", "r3"]) expect((await submitLinkRequest(db as never, { actorUserId: STUDENT_USER, residenceId: id })).ok).toBe(true);
    expect((await submitLinkRequest(db as never, { actorUserId: STUDENT_USER, residenceId: "r4" })).ok).toBe(false);
    expect((await submitLinkRequest(mk(t) as never, { actorUserId: STUDENT_USER, residenceId: "rx" })).ok).toBe(false); // no publicada
    const housed = world();
    housed.resident_stays.push({ id: "s-x", residence_id: R, student_profile_id: STUDENT, is_current: true, invite_email: null });
    expect((await submitLinkRequest(mk(housed) as never, { actorUserId: STUDENT_USER, residenceId: R })).ok).toBe(false);
  });
  it("la residencia aprueba creando la estadía, o uniéndola a una pendiente; nunca sola", async () => {
    const t = world({ resident_link_requests: [{ id: "req-1", student_profile_id: STUDENT, residence_id: R, status: "pending" }] });
    const db = mk(t);
    // Un staff sin permiso no puede.
    const noPerm = mk(world({ residence_users: [{ id: "ru2", residence_id: R, user_id: "staff", role: "staff", is_active: true, permissions: { "residents.manage": false } }], resident_link_requests: [{ id: "req-1", student_profile_id: STUDENT, residence_id: R, status: "pending" }] }));
    expect((await resolveLinkRequest(noPerm as never, { actorUserId: "staff", residenceId: R, requestId: "req-1", decision: "approve" })).ok).toBe(false);
    // Une a la estadía cargada con nombre.
    const ok = await resolveLinkRequest(db as never, { actorUserId: OWNER, residenceId: R, requestId: "req-1", decision: "approve", stayId: "stay-1" });
    expect(ok.ok).toBe(true);
    expect(db.tables.resident_stays[0]).toMatchObject({ student_profile_id: STUDENT, status: "active" });
    expect(db.tables.resident_link_requests[0]).toMatchObject({ status: "approved", matched_stay_id: "stay-1", resolved_by: OWNER });
    expect(audits[audits.length - 1]).toMatchObject({ action: "resident_link_approved" });
    expect((await resolveLinkRequest(db as never, { actorUserId: OWNER, residenceId: R, requestId: "req-1", decision: "reject" })).ok).toBe(false); // ya resuelta
  });
  it("crear estadía nueva, rechazar, y no aprobar a quien ya tiene estadía o es menor sin tutor", async () => {
    const mkReq = () => world({ resident_link_requests: [{ id: "req-1", student_profile_id: STUDENT, residence_id: R, status: "pending" }], resident_stays: [] });
    const created = mk(mkReq());
    expect((await resolveLinkRequest(created as never, { actorUserId: OWNER, residenceId: R, requestId: "req-1", decision: "approve" })).ok).toBe(true);
    expect(created.tables.resident_stays[0]).toMatchObject({ student_profile_id: STUDENT, status: "active", residence_id: R });
    const rejected = mk(mkReq());
    expect((await resolveLinkRequest(rejected as never, { actorUserId: OWNER, residenceId: R, requestId: "req-1", decision: "reject", note: "No te conocemos" })).ok).toBe(true);
    expect(rejected.tables.resident_link_requests[0]).toMatchObject({ status: "rejected", resolution_note: "No te conocemos" });
    expect(rejected.tables.resident_stays).toHaveLength(0);
    const minor = mkReq();
    Object.assign(minor.student_profiles[0], { is_minor: true });
    expect((await resolveLinkRequest(mk(minor) as never, { actorUserId: OWNER, residenceId: R, requestId: "req-1", decision: "approve" })).ok).toBe(false);
    const housed = mkReq();
    housed.resident_stays.push({ id: "s-x", residence_id: "otra", student_profile_id: STUDENT, is_current: true, invite_email: null });
    expect((await resolveLinkRequest(mk(housed) as never, { actorUserId: OWNER, residenceId: R, requestId: "req-1", decision: "approve" })).ok).toBe(false);
  });
  it("una solicitud de OTRA residencia no se puede resolver desde esta", async () => {
    const t = world({ resident_link_requests: [{ id: "req-9", student_profile_id: STUDENT, residence_id: "otra", status: "pending" }] });
    expect((await resolveLinkRequest(mk(t) as never, { actorUserId: OWNER, residenceId: R, requestId: "req-9", decision: "approve" })).ok).toBe(false);
  });
});

describe("«Mi residencia no está»", () => {
  it("guarda nombre y contacto opcional, con tope", async () => {
    const db = mk(world());
    for (let i = 0; i < 3; i++) expect((await submitMissingResidence(db as never, { actorUserId: STUDENT_USER, residenceName: `Casa ${i} Norte` })).ok).toBe(true);
    expect((await submitMissingResidence(db as never, { actorUserId: STUDENT_USER, residenceName: "Otra más" })).ok).toBe(false);
    expect((await submitMissingResidence(mk(world()) as never, { actorUserId: STUDENT_USER, residenceName: "x" })).ok).toBe(false);
    expect(db.tables.missing_residence_requests[0]).toMatchObject({ student_profile_id: STUDENT });
  });
});

describe("OTP endurecido (atómico y con topes persistidos)", () => {
  async function setup() {
    const db = mk(world());
    const inv = await issueResidentInvite(db as never, { actorUserId: OWNER, residenceId: R, residentStayId: "stay-1", channel: "whatsapp" });
    const token = tokenOf((inv as { link: string }).link);
    await sendInviteOtpByToken(db as never, { rawToken: token });
    const code = /(\d{6})/.exec(mails[mails.length - 1].html)![1];
    return { db, token, code };
  }
  const resend = async (db: ReturnType<typeof mk>, token: string) => {
    db.tables.resident_stay_invitations[0].otp_sent_at = "2020-01-01T00:00:00Z"; // salta la espera de 60 s
    return sendInviteOtpByToken(db as never, { rawToken: token });
  };
  it("carrera: 12 intentos en paralelo no pasan el tope de 5 por código, y el código correcto queda bloqueado", async () => {
    const { db, token, code } = await setup();
    await Promise.all(Array.from({ length: 12 }, () => verifyInviteOtpByToken(db as never, { rawToken: token, code: "000000" })));
    expect(db.tables.resident_stay_invitations[0].otp_attempts).toBe(5);
    expect((await verifyInviteOtpByToken(db as never, { rawToken: token, code })).ok).toBe(false);
  });
  it("reenviar NO resetea el acumulado: a los 15 intentos hay que regenerar la invitación", async () => {
    const { db, token } = await setup();
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < 5; i++) await verifyInviteOtpByToken(db as never, { rawToken: token, code: "000000" });
      if (round < 2) expect((await resend(db, token)).ok).toBe(true);
    }
    expect(db.tables.resident_stay_invitations[0].otp_attempts).toBe(15);
    expect((await resend(db, token)).ok).toBe(true); // el envío sigue permitido (hasta 6)…
    const code = /(\d{6})/.exec(mails[mails.length - 1].html)![1];
    const r = await verifyInviteOtpByToken(db as never, { rawToken: token, code });
    expect(r.ok === false && r.error).toMatch(/máximo de intentos|nueva/i); // …pero ya no se puede verificar
  });
  it("tope de códigos enviados por invitación, persistido", async () => {
    const { db, token } = await setup(); // 1 envío
    for (let i = 0; i < 5; i++) expect((await resend(db, token)).ok).toBe(true);
    const sixth = await resend(db, token);
    expect(sixth.ok === false && sixth.error).toMatch(/demasiados códigos/i);
    expect(db.tables.resident_stay_invitations[0].otp_send_count).toBe(6);
  });
  it("si el mail del código no sale, se revierte otp_sent_at", async () => {
    const db = mk(world());
    const inv = await issueResidentInvite(db as never, { actorUserId: OWNER, residenceId: R, residentStayId: "stay-1", channel: "whatsapp" });
    mailState.fail = true;
    const r = await sendInviteOtpByToken(db as never, { rawToken: tokenOf((inv as { link: string }).link) });
    expect(r.ok).toBe(false);
    expect(db.tables.resident_stay_invitations[0].otp_sent_at ?? null).toBeNull();
  });
});

describe("estadía SIN mail: el enlace no activa, pide confirmación de la residencia", () => {
  it("enlace + código válidos → solicitud pending apuntada a la estadía; la estadía sigue sin vincular", async () => {
    const t = world();
    Object.assign(t.resident_stays[0], { invite_email: null });
    const db = mk(t);
    const inv = await issueResidentInvite(db as never, { actorUserId: OWNER, residenceId: R, residentStayId: "stay-1", channel: "whatsapp" });
    const token = tokenOf((inv as { link: string }).link);
    await sendInviteOtpByToken(db as never, { rawToken: token, email: "ana@mail.com" });
    await verifyInviteOtpByToken(db as never, { rawToken: token, code: /(\d{6})/.exec(mails[mails.length - 1].html)![1] });
    const r = await activateResidentStay(db as never, { actorUserId: STUDENT_USER, rawToken: token });
    expect(r).toMatchObject({ ok: true, pendingConfirmation: true });
    expect(db.tables.resident_stays[0].student_profile_id).toBeNull();
    expect(db.tables.resident_link_requests[0]).toMatchObject({ status: "pending", matched_stay_id: "stay-1", student_profile_id: STUDENT });
    // La residencia la confirma desde la cola, sin elegir estadía: usa la que trae la solicitud.
    const approved = await resolveLinkRequest(db as never, { actorUserId: OWNER, residenceId: R, requestId: db.tables.resident_link_requests[0].id as string, decision: "approve" });
    expect(approved.ok).toBe(true);
    expect(db.tables.resident_stays[0]).toMatchObject({ student_profile_id: STUDENT, status: "active" });
  });
});

describe("doble aprobación y código de casa", () => {
  it("dos aprobaciones simultáneas crean UNA sola estadía", async () => {
    const t = world({ resident_link_requests: [{ id: "req-1", student_profile_id: STUDENT, residence_id: R, status: "pending", matched_stay_id: null }], resident_stays: [] });
    const db = mk(t);
    const args = { actorUserId: OWNER, residenceId: R, requestId: "req-1", decision: "approve" as const };
    const [a, b] = await Promise.all([resolveLinkRequest(db as never, args), resolveLinkRequest(db as never, args)]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(db.tables.resident_stays).toHaveLength(1);
  });
  it("si falla vincular, la solicitud vuelve a pending", async () => {
    const t = world({ resident_link_requests: [{ id: "req-1", student_profile_id: STUDENT, residence_id: R, status: "pending", matched_stay_id: null }] });
    const db = mk(t);
    const r = await resolveLinkRequest(db as never, { actorUserId: OWNER, residenceId: R, requestId: "req-1", decision: "approve", stayId: "no-existe" });
    expect(r.ok).toBe(false);
    expect(db.tables.resident_link_requests[0].status).toBe("pending");
  });
  it("regenerateHouseCode: reintenta ante colisión (23505) y falla si no hay fila de detalles privados", async () => {
    const db = mk(world(), { failUpdate: { residence_private_details: { code: "23505", message: "duplicate" } } });
    const r = await regenerateHouseCode(db as never, { actorUserId: OWNER, residenceId: R });
    expect(r.ok && r.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(db.tables.residence_private_details[0].house_code).toBe(r.ok && r.code);
    const empty = mk(world({ residence_private_details: [] }));
    expect((await regenerateHouseCode(empty as never, { actorUserId: OWNER, residenceId: R })).ok).toBe(false);
    expect((await regenerateHouseCode(mk(world()) as never, { actorUserId: "intruso", residenceId: R })).ok).toBe(false);
  });
});
