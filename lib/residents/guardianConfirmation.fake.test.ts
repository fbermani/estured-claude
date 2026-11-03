import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/audit", () => ({ createAuditLog: async () => true, notifyAdmins: async () => undefined, alertAdminsOfAuditFailure: async () => undefined }));
const mails = vi.hoisted(() => [] as { to: string; subject: string }[]);
vi.mock("@/lib/email/sendEmail", () => ({ sendEmail: async (m: { to: string; subject: string }) => (mails.push(m), true) }));
vi.mock("@/lib/residents/linkReservation", () => ({ findLinkableReservationIdByEmail: async () => null, linkStayToReservationIfMissing: async () => undefined }));
const notes = vi.hoisted(() => [] as { userId: string; title: string; relatedEntityType?: string }[]);
vi.mock("@/lib/notifications/createNotification", () => ({ createNotification: async (_a: unknown, n: (typeof notes)[number]) => void notes.push(n) }));
vi.mock("@/lib/stayChange/recipients", () => ({ loadActiveFamilyUserIds: async () => ["u-fam"] }));
const guardians = vi.hoisted(() => ({ active: true }));
vi.mock("@/lib/family/access", () => ({
  loadActiveFamilyOfStudent: async () => (guardians.active ? { userId: "u-fam", name: "Madre", permissions: {} } : null),
  loadActiveFamilyLink: async (_a: unknown, userId: string) => (guardians.active && userId === "u-fam" ? { linkId: "l", studentProfileId: "sp-val", permissions: {} } : null),
}));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { requestGuardianConfirmation, resolveGuardianConfirmation, runGuardianConfirmationJob } from "@/lib/residents/guardianConfirmation";
import { resolveLinkRequest } from "@/lib/residents/linkRequestsResidence";

const R = "res-1";
const DAY = 24 * 60 * 60 * 1000;

function world(): Record<string, Row[]> {
  return {
    residence_users: [{ id: "ru", residence_id: R, user_id: "owner", role: "owner", is_active: true }],
    residences: [{ id: R, name: "Casa Sur" }],
    users: [{ id: "u-val", email: "val@mail.com" }, { id: "u-fam", email: "mama@mail.com" }],
    student_profiles: [{ id: "sp-val", user_id: "u-val", is_minor: true, first_name: "Valentina", last_initial: "G." }],
    resident_stays: [{ id: "stay-1", residence_id: R, invite_email: "val@mail.com", student_profile_id: null, is_current: true, status: "pending_activation" }],
    resident_stay_invitations: [{ id: "inv-1", resident_stay_id: "stay-1", used_at: null, revoked_at: null, declined_at: null }],
    resident_link_requests: [],
    guardian_stay_confirmations: [],
  };
}
const mk = (t = world()) => {
  const m = createInMemorySupabase(t);
  return Object.assign(m.client, { tables: m.tables });
};
async function request(db: ReturnType<typeof mk>, now = new Date()) {
  const r = await requestGuardianConfirmation(db as never, { origin: "invite", studentProfileId: "sp-val", studentUserId: "u-val", residenceId: R, residentStayId: "stay-1", invitationId: "inv-1", now });
  if (!r.ok) throw new Error(r.error);
  return r.id;
}

beforeEach(() => {
  notes.length = 0;
  mails.length = 0;
  guardians.active = true;
  delete process.env.EMAIL_DOMAIN_VERIFIED;
});

describe("confirmación del tutor (DR32)", () => {
  it("al pedir: avisa al tutor y al menor, no vincula nada y solo hay una pendiente", async () => {
    const db = mk();
    await request(db);
    expect(db.tables.resident_stays[0].student_profile_id).toBeNull();
    expect(notes.map((n) => n.userId).sort()).toEqual(["u-fam", "u-val"]);
    expect(notes.find((n) => n.userId === "u-fam")?.relatedEntityType).toBe("guardian_stay_confirmations");
    expect(mails).toHaveLength(0); // sandbox: sin dominio verificado no sale mail
    const again = await requestGuardianConfirmation(db as never, { origin: "invite", studentProfileId: "sp-val", studentUserId: "u-val", residenceId: R, residentStayId: "stay-1" });
    expect(again.ok).toBe(false);
  });

  it("con dominio verificado también sale el mail al tutor", async () => {
    process.env.EMAIL_DOMAIN_VERIFIED = "true";
    await request(mk());
    expect(mails.map((m) => m.to)).toEqual(["mama@mail.com"]);
  });

  it("confirmar: solo el tutor activo; vincula la estadía y consume la invitación", async () => {
    const db = mk();
    const id = await request(db);
    expect((await resolveGuardianConfirmation(db as never, { actorUserId: "u-val", confirmationId: id, decision: "confirm" })).ok).toBe(false); // el menor no puede
    expect(db.tables.resident_stays[0].student_profile_id).toBeNull();
    expect((await resolveGuardianConfirmation(db as never, { actorUserId: "u-fam", confirmationId: id, decision: "confirm" })).ok).toBe(true);
    expect(db.tables.resident_stays[0]).toMatchObject({ student_profile_id: "sp-val", status: "active" });
    expect(db.tables.resident_stay_invitations[0].used_at).toBeTruthy();
    expect(db.tables.guardian_stay_confirmations[0].status).toBe("confirmed");
    expect((await resolveGuardianConfirmation(db as never, { actorUserId: "u-fam", confirmationId: id, decision: "confirm" })).ok).toBe(false); // no se repite
  });

  it("vínculo familiar revocado: no puede responder", async () => {
    const db = mk();
    const id = await request(db);
    guardians.active = false;
    const r = await resolveGuardianConfirmation(db as never, { actorUserId: "u-fam", confirmationId: id, decision: "confirm" });
    expect(r.ok).toBe(false);
    expect(db.tables.resident_stays[0].student_profile_id).toBeNull();
  });

  it("rechazar: no vincula, avisa al menor y la invitación sigue abierta", async () => {
    const db = mk();
    const id = await request(db);
    notes.length = 0;
    expect((await resolveGuardianConfirmation(db as never, { actorUserId: "u-fam", confirmationId: id, decision: "reject" })).ok).toBe(true);
    expect(db.tables.resident_stays[0].student_profile_id).toBeNull();
    expect(db.tables.resident_stay_invitations[0].used_at).toBeNull();
    expect(notes[0].userId).toBe("u-val");
  });

  it("si la residencia vinculó la estadía a otra persona mientras tanto, se cancela y no pisa", async () => {
    const db = mk();
    const id = await request(db);
    db.tables.resident_stay_invitations[0].revoked_at = "2026-11-01T00:00:00Z";
    const r = await resolveGuardianConfirmation(db as never, { actorUserId: "u-fam", confirmationId: id, decision: "confirm" });
    expect(r.ok).toBe(false);
    expect(db.tables.guardian_stay_confirmations[0].status).toBe("cancelled");
    expect(db.tables.resident_stays[0].student_profile_id).toBeNull();
  });

  it("vence a los 7 días: no se puede confirmar y el job avisa a ambos sin activar nada", async () => {
    const db = mk();
    const t0 = new Date("2026-11-02T12:00:00Z");
    const id = await request(db, t0);
    const later = new Date(t0.getTime() + 8 * DAY);
    expect((await resolveGuardianConfirmation(db as never, { actorUserId: "u-fam", confirmationId: id, decision: "confirm", now: later })).ok).toBe(false);
    notes.length = 0;
    expect(await runGuardianConfirmationJob(db as never, later)).toEqual({ expired: 1, reminded: 0 });
    expect(db.tables.guardian_stay_confirmations[0].status).toBe("expired");
    expect(db.tables.resident_stays[0].student_profile_id).toBeNull();
    expect(notes.map((n) => n.userId).sort()).toEqual(["u-fam", "u-val"]);
  });

  it("recordatorio único a los 3 días", async () => {
    const db = mk();
    const t0 = new Date("2026-11-02T12:00:00Z");
    await request(db, t0);
    const day2 = new Date(t0.getTime() + 2 * DAY);
    const day3 = new Date(t0.getTime() + 3 * DAY + 1000);
    expect((await runGuardianConfirmationJob(db as never, day2)).reminded).toBe(0);
    expect((await runGuardianConfirmationJob(db as never, day3)).reminded).toBe(1);
    expect((await runGuardianConfirmationJob(db as never, day3)).reminded).toBe(0);
  });

  it("aprobación de la residencia para un menor: queda pendiente; al confirmar el tutor se crea la estadía activa", async () => {
    const t = world();
    t.resident_stays = [];
    t.resident_link_requests = [{ id: "req-1", student_profile_id: "sp-val", residence_id: R, status: "pending", matched_stay_id: null }];
    const db = mk(t);
    expect((await resolveLinkRequest(db as never, { actorUserId: "owner", residenceId: R, requestId: "req-1", decision: "approve" })).ok).toBe(true);
    expect(db.tables.resident_stays).toHaveLength(0);
    const conf = db.tables.guardian_stay_confirmations[0];
    expect(conf).toMatchObject({ origin: "residence_approval", status: "pending" });
    expect((await resolveGuardianConfirmation(db as never, { actorUserId: "u-fam", confirmationId: conf.id as string, decision: "confirm" })).ok).toBe(true);
    expect(db.tables.resident_stays[0]).toMatchObject({ student_profile_id: "sp-val", status: "active", residence_id: R });
    expect(db.tables.resident_link_requests[0].matched_stay_id).toBe(db.tables.resident_stays[0].id);
  });

  it("aprobación + rechazo del tutor: la solicitud vuelve a quedar rechazada y el menor puede pedir de nuevo", async () => {
    const t = world();
    t.resident_stays = [];
    t.resident_link_requests = [{ id: "req-1", student_profile_id: "sp-val", residence_id: R, status: "pending", matched_stay_id: null }];
    const db = mk(t);
    await resolveLinkRequest(db as never, { actorUserId: "owner", residenceId: R, requestId: "req-1", decision: "approve" });
    const conf = db.tables.guardian_stay_confirmations[0];
    await resolveGuardianConfirmation(db as never, { actorUserId: "u-fam", confirmationId: conf.id as string, decision: "reject" });
    expect(db.tables.resident_link_requests[0].status).toBe("rejected");
    expect(db.tables.resident_stays).toHaveLength(0);
  });

  it("aprobación + vencimiento: el job cierra también la solicitud", async () => {
    const t = world();
    t.resident_stays = [];
    t.resident_link_requests = [{ id: "req-1", student_profile_id: "sp-val", residence_id: R, status: "pending", matched_stay_id: null }];
    const db = mk(t);
    await resolveLinkRequest(db as never, { actorUserId: "owner", residenceId: R, requestId: "req-1", decision: "approve", now: new Date("2026-11-02T12:00:00Z") });
    await runGuardianConfirmationJob(db as never, new Date("2026-11-10T12:00:00Z"));
    expect(db.tables.resident_link_requests[0].status).toBe("rejected");
  });
});
