import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const audits = vi.hoisted(() => [] as { action: string; newValue?: Record<string, unknown> }[]);
vi.mock("@/lib/audit", () => ({
  createAuditLog: async (_a: unknown, entry: (typeof audits)[number]) => {
    audits.push(entry);
    return true;
  },
  alertAdminsOfAuditFailure: async () => undefined,
}));
vi.mock("@/lib/residents/linkReservation", () => ({ findLinkableReservationIdByEmail: async () => null, linkStayToReservationIfMissing: async () => undefined }));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { createResidentStay } from "@/lib/residents/createResidentStay";
import { setResidentEmail } from "@/lib/residents/setResidentEmail";

const R = "res-1";
const world = (extra: Row[] = []): Record<string, Row[]> => ({
  residence_users: [{ id: "ru", residence_id: R, user_id: "owner", role: "owner", is_active: true }],
  room_types: [],
  resident_stays: extra,
});
const client = (tables: Record<string, Row[]>, opts = {}) => {
  const m = createInMemorySupabase(tables, opts);
  return Object.assign(m.client, { tables: m.tables });
};
const base = { actorUserId: "owner", residenceId: R, roomTypeId: null, reservationId: null, startDate: null };

describe("createResidentStay sin mail (DR18 t4)", () => {
  it("carga con nombre y teléfono, sin mail, y audita sin PII", async () => {
    const db = client(world());
    const r = await createResidentStay(db as never, { ...base, inviteEmail: null, inviteName: "Ana  Pérez", invitePhone: "+54 9 11 1234-5678" });
    expect(r.ok).toBe(true);
    const row = db.tables.resident_stays[0];
    expect(row).toMatchObject({ invite_email: null, invite_name: "Ana Pérez", invite_phone: "5491112345678", status: "pending_activation" });
    const last = audits[audits.length - 1];
    expect(last.newValue).toMatchObject({ has_email: false, has_name: true, has_phone: true });
    expect(JSON.stringify(last.newValue)).not.toContain("Ana");
  });
  it("exige mail o nombre, y valida el teléfono", async () => {
    const db = client(world());
    expect((await createResidentStay(db as never, { ...base, inviteEmail: null })).ok).toBe(false);
    expect((await createResidentStay(db as never, { ...base, inviteEmail: null, inviteName: "Ana Pérez", invitePhone: "12" })).ok).toBe(false);
  });
  it("unicidad por nombre dentro de la residencia (sin mail)", async () => {
    const db = client(world([{ id: "s1", residence_id: R, is_current: true, invite_email: null, student_profile_id: null, invite_name: "Ana Pérez" }]));
    const r = await createResidentStay(db as never, { ...base, inviteEmail: null, inviteName: "ana pérez" });
    expect(r.ok).toBe(false);
    expect(db.tables.resident_stays).toHaveLength(1);
  });
  it("sin la 0063: con mail sigue funcionando; sin mail avisa", async () => {
    const opts = { missingColumns: { resident_stays: ["invite_name", "invite_phone"] } };
    const db = client(world(), opts);
    expect((await createResidentStay(db as never, { ...base, inviteEmail: "a@b.com", inviteName: "Ana Pérez", invitePhone: "5491112345678" })).ok).toBe(true);
    expect(db.tables.resident_stays).toHaveLength(1);
    const r = await createResidentStay(client(world(), opts) as never, { ...base, inviteEmail: null, inviteName: "Ana Pérez" });
    expect(r.ok).toBe(false);
  });
});

describe("setResidentEmail", () => {
  const stay = { id: "s1", residence_id: R, is_current: true, invite_email: null, student_profile_id: null, invite_name: "Ana" };
  it("carga el mail y audita solo has_email", async () => {
    const db = client(world([{ ...stay }]));
    expect((await setResidentEmail(db as never, { actorUserId: "owner", residenceId: R, residentStayId: "s1", email: "Ana@B.com" })).ok).toBe(true);
    expect(db.tables.resident_stays[0].invite_email).toBe("ana@b.com");
    expect(audits[audits.length - 1].newValue).toEqual(expect.objectContaining({ has_email: true }));
    expect(JSON.stringify(audits[audits.length - 1].newValue)).not.toContain("ana@b.com");
  });
  it("rechaza mail duplicado, estadías con cuenta/mail y de otra residencia", async () => {
    const db = client(world([{ ...stay }, { id: "s2", residence_id: R, is_current: true, invite_email: "x@y.com", student_profile_id: null }]));
    expect((await setResidentEmail(db as never, { actorUserId: "owner", residenceId: R, residentStayId: "s1", email: "x@y.com" })).ok).toBe(false);
    expect((await setResidentEmail(db as never, { actorUserId: "owner", residenceId: R, residentStayId: "s2", email: "z@y.com" })).ok).toBe(false);
    expect((await setResidentEmail(db as never, { actorUserId: "owner", residenceId: R, residentStayId: "nope", email: "z@y.com" })).ok).toBe(false);
  });
});
