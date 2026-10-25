import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const audits = vi.hoisted(() => [] as { actorUserId: string | null; actorRole: string; action: string }[]);
vi.mock("@/lib/audit", () => ({
  createAuditLog: async (_admin: unknown, entry: (typeof audits)[number]) => {
    audits.push(entry);
    return true;
  },
  alertAdminsOfAuditFailure: async () => undefined,
}));
vi.mock("@/lib/notifications/createNotification", () => ({ createNotification: async () => undefined }));
vi.mock("@/lib/exchange/rate", () => ({ getCurrentExchangeRate: async () => ({ arsPerUsd: 1500 }) }));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { PERMISSION_DENIED_MESSAGE, permissionsFromChecked, ownerPermissions } from "@/lib/residences/permissions";
import { addResidentNote } from "@/lib/residents/addResidentNote";
import { updateStayDetails } from "@/lib/residents/updateStayDetails";
import { createResidentStay } from "@/lib/residents/createResidentStay";
import { endResidentStay } from "@/lib/residents/endResidentStay";
import { updateAvailability } from "@/lib/availability/updateAvailability";
import { renameRoom, setBedStatus, assignStayToBed } from "@/lib/residences/roomManagement";
import { notifyWaitlistAvailability } from "@/lib/waitlist-entries/notifyWaitlistAvailability";
import { removeFromWaitlistByResidence } from "@/lib/waitlist-entries/removeFromWaitlistByResidence";
import { createRenewalOffer } from "@/lib/renewals/createRenewalOffer";
import { sendRenewalOffer } from "@/lib/renewals/sendRenewalOffer";
import { recordRenewalResidencePaymentReceived } from "@/lib/renewals/recordRenewalResidencePaymentReceived";
import { recordResidencePaymentReceived } from "@/lib/reservations/recordResidencePaymentReceived";
import { answerResidenceQuestion, hideResidenceQuestion, restoreResidenceQuestion } from "@/lib/faq/moderateResidenceQuestion";
import { respondStayChangeIntent } from "@/lib/stayChange/respondStayChangeIntent";

/**
 * DR11 — cada acción delegable rechaza al staff SIN el permiso (por llamada directa, sin pasar por la interfaz), no escribe nada, acepta
 * con el permiso y audita con el rol real. Cliente Supabase en memoria. El permiso de A no vale en B.
 */
const NORTE = "res-norte";
const RIO = "res-rio";

const SIN_NADA = permissionsFromChecked([]); // "Solo lectura"
/** Staff con un único permiso encendido. */
const only = (key: string) => permissionsFromChecked([key]);

function world(): Record<string, Row[]> {
  return {
    users: [],
    residence_users: [
      { id: "ru-owner", residence_id: NORTE, user_id: "ricardo", role: "owner", is_active: true },
      { id: "ru-ro", residence_id: NORTE, user_id: "solo-lectura", role: "staff", is_active: true, permissions: SIN_NADA },
      { id: "ru-legacy", residence_id: NORTE, user_id: "legacy", role: "staff", is_active: true, permissions: {} },
      // Todo encendido, pero en RÍO: no vale en Norte.
      { id: "ru-rio", residence_id: RIO, user_id: "solo-rio", role: "staff", is_active: true, permissions: ownerPermissions() },
      { id: "ru-notes", residence_id: NORTE, user_id: "notas", role: "staff", is_active: true, permissions: only("residents.manage") },
      { id: "ru-rooms", residence_id: NORTE, user_id: "cuartos", role: "staff", is_active: true, permissions: only("operations.rooms_availability") },
      { id: "ru-wait", residence_id: NORTE, user_id: "espera", role: "staff", is_active: true, permissions: only("waitlist.manage") },
      { id: "ru-ren", residence_id: NORTE, user_id: "renov", role: "staff", is_active: true, permissions: only("renewals.manage") },
      { id: "ru-pay", residence_id: NORTE, user_id: "pagos", role: "staff", is_active: true, permissions: only("payments.residence") },
      { id: "ru-faq", residence_id: NORTE, user_id: "faq", role: "staff", is_active: true, permissions: only("faq.manage") },
    ],
    resident_stays: [{ id: "stay-1", residence_id: NORTE, is_current: true, room_type_id: "rt-1", student_profile_id: null, reservation_id: null }],
    resident_notes: [],
    room_types: [{ id: "rt-1", residence_id: NORTE }],
    profile_availability: [{ id: "pa-1", room_type_id: "rt-1", status: "available_to_confirm" }],
    rooms: [{ id: "room-1", residence_id: NORTE, label: "101" }],
    beds: [{ id: "bed-1", room_id: "room-1", status: "active" }],
    waitlist_entries: [{ id: "wl-1", residence_id: NORTE, status: "active" }],
    reservations: [{ id: "rsv-1", status: "confirmed", student_profile_id: "stu-1", residence_id: NORTE }],
    renewal_offers: [
      { id: "ro-1", status: "draft", residence_id: NORTE, renewal_request_id: null, student_profile_id: "stu-1" },
      { id: "ro-2", status: "residence_payment_pending", residence_id: NORTE, student_profile_id: "stu-1", fee_base_usd: 1, fee_base_ars: 1, estimated_estured_fee_ars: 1 },
    ],
    student_profiles: [{ id: "stu-1", user_id: "u-stu" }],
    application_requests: [{ id: "app-1", status: "residence_payment_pending", residence_id: NORTE, student_profile_id: "stu-1" }],
    residence_faq_questions: [{ id: "q-1", residence_id: NORTE, status: "pending", answer: null, asked_by_user_id: null, hidden_by_user_id: null }],
    stay_change_intents: [{ id: "int-1", current_residence_id: NORTE, status: "open", student_profile_id: "stu-1" }],
  };
}

let fake: ReturnType<typeof createInMemorySupabase>;
const writes = () => fake.log.filter((l) => l.op !== "select");

beforeEach(() => {
  fake = createInMemorySupabase(world());
  audits.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

type Call = (actor: string) => Promise<{ ok: boolean; error?: string }>;
const admin = () => fake.client;

/** Cada acción delegable con el único permiso que la habilita (y quién lo tiene). */
const CASES: { name: string; permission: string; allowedUser: string; call: Call }[] = [
  { name: "addResidentNote", permission: "residents.manage", allowedUser: "notas", call: (a) => addResidentNote(admin(), { actorUserId: a, residenceId: NORTE, residentStayId: "stay-1", category: "general", body: "hola" }) },
  { name: "updateStayDetails", permission: "residents.manage", allowedUser: "notas", call: (a) => updateStayDetails(admin(), { actorUserId: a, residenceId: NORTE, residentStayId: "stay-1", expectedEndDate: null, monthlyRateUsd: 100 }) },
  { name: "createResidentStay", permission: "residents.manage", allowedUser: "notas", call: (a) => createResidentStay(admin(), { actorUserId: a, residenceId: NORTE, inviteEmail: "x@example.com", roomTypeId: null, reservationId: null, startDate: null }) },
  { name: "endResidentStay", permission: "residents.manage", allowedUser: "notas", call: (a) => endResidentStay(admin(), { actorUserId: a, residentStayId: "stay-1", endDate: null }) },
  { name: "updateAvailability", permission: "operations.rooms_availability", allowedUser: "cuartos", call: (a) => updateAvailability(admin(), { roomTypeId: "rt-1", actorUserId: a, status: "full", availableCount: null, availableFrom: null, notesPublic: null }) },
  { name: "renameRoom", permission: "operations.rooms_availability", allowedUser: "cuartos", call: (a) => renameRoom(admin(), { actorUserId: a, residenceId: NORTE, roomId: "room-1", label: "102" }) },
  { name: "setBedStatus", permission: "operations.rooms_availability", allowedUser: "cuartos", call: (a) => setBedStatus(admin(), { actorUserId: a, residenceId: NORTE, bedId: "bed-1", status: "out_of_service", reason: "arreglo" }) },
  { name: "assignStayToBed", permission: "operations.rooms_availability", allowedUser: "cuartos", call: (a) => assignStayToBed(admin(), { actorUserId: a, residenceId: NORTE, residentStayId: "stay-1", bedId: "bed-1" }) },
  { name: "notifyWaitlistAvailability", permission: "waitlist.manage", allowedUser: "espera", call: (a) => notifyWaitlistAvailability(admin(), { waitlistEntryId: "wl-1", actorUserId: a }) },
  { name: "removeFromWaitlistByResidence", permission: "waitlist.manage", allowedUser: "espera", call: (a) => removeFromWaitlistByResidence(admin(), { waitlistEntryId: "wl-1", actorUserId: a, reason: null }) },
  { name: "createRenewalOffer", permission: "renewals.manage", allowedUser: "renov", call: (a) => createRenewalOffer(admin(), { reservationId: "rsv-1", renewalRequestId: null, actorUserId: a, periodStartDate: "2027-03-01", durationMonths: 6, monthlyPriceUsd: 300, enrollmentOrRenewalFeeUsd: null, depositUsd: null, adjustmentPolicy: "none", acceptanceDeadlineAt: new Date(Date.now() + 7 * 864e5).toISOString(), sendNow: false }) },
  { name: "sendRenewalOffer", permission: "renewals.manage", allowedUser: "renov", call: (a) => sendRenewalOffer(admin(), { renewalOfferId: "ro-1", actorUserId: a }) },
  { name: "recordRenewalResidencePaymentReceived", permission: "renewals.manage", allowedUser: "renov", call: (a) => recordRenewalResidencePaymentReceived(admin(), { renewalOfferId: "ro-2", actorUserId: a, receivedAmountArs: null, receivedAmountUsd: 1, paymentMethodLabel: "", confirmationAccepted: false, receiptFile: null }) },
  { name: "recordResidencePaymentReceived", permission: "payments.residence", allowedUser: "pagos", call: (a) => recordResidencePaymentReceived(admin(), { applicationId: "app-1", actorUserId: a, receivedAmountArs: null, receivedAmountUsd: 1, paymentMethodLabel: "", confirmationAccepted: false, receiptFile: null }) },
  { name: "answerResidenceQuestion", permission: "faq.manage", allowedUser: "faq", call: (a) => answerResidenceQuestion(admin(), { actorUserId: a, residenceId: NORTE, questionId: "q-1", answer: "Sí, hay lugar en la ficha." }) },
  { name: "hideResidenceQuestion", permission: "faq.manage", allowedUser: "faq", call: (a) => hideResidenceQuestion(admin(), { actorUserId: a, residenceId: NORTE, questionId: "q-1" }) },
  { name: "restoreResidenceQuestion", permission: "faq.manage", allowedUser: "faq", call: (a) => restoreResidenceQuestion(admin(), { actorUserId: a, residenceId: NORTE, questionId: "q-1" }) },
  { name: "respondStayChangeIntent", permission: "residents.manage", allowedUser: "notas", call: (a) => respondStayChangeIntent(admin(), { actorUserId: a, intentId: "int-1", message: "Hola", exitCostsText: "", exitCostsUsd: "", exitConditionsText: "", exitDetailsText: "" }) },
];

describe.each(CASES)("$name requiere $permission", ({ call, allowedUser, permission }) => {
  it("rechaza al staff sin ese permiso (POST directo), sin escribir ni auditar", async () => {
    for (const actor of ["solo-lectura", ...CASES.map((c) => c.allowedUser).filter((u) => u !== allowedUser)]) {
      const result = await call(actor);
      expect(result.ok, actor).toBe(false);
      // respondStayChangeIntent responde distinto a "sin vínculo" pero a quien tiene vínculo sin permiso le dice por qué.
      expect(result.error, actor).toBe(PERMISSION_DENIED_MESSAGE);
    }
    expect(writes()).toHaveLength(0);
    expect(audits).toHaveLength(0);
  });

  it("el permiso de otra residencia no vale: 'no tenés acceso', sin escribir", async () => {
    const result = await call("solo-rio");
    expect(result.ok).toBe(false);
    expect(result.error).not.toBe("");
    expect(result.error).not.toBe(PERMISSION_DENIED_MESSAGE);
    expect(writes()).toHaveLength(0);
  });

  it("alguien sin ningún vínculo no entra", async () => {
    const result = await call("intruso");
    expect(result.ok).toBe(false);
    expect(writes()).toHaveLength(0);
  });

  it("deja pasar el control con el permiso (no devuelve el mensaje de permiso)", async () => {
    for (const actor of [allowedUser, "ricardo", "legacy"]) {
      const result = await call(actor);
      // Puede fallar más adelante por los datos de este escenario mínimo, pero nunca por permiso ni por acceso.
      expect(result.error, `${permission} ${actor}`).not.toBe(PERMISSION_DENIED_MESSAGE);
      expect(result.error ?? "", `${permission} ${actor}`).not.toMatch(/No tenés acceso/);
    }
  });
});

describe("auditoría con el rol real", () => {
  it("lo que hace un staff queda como residence_staff y lo del dueño como residence_owner", async () => {
    expect((await addResidentNote(admin(), { actorUserId: "notas", residenceId: NORTE, residentStayId: "stay-1", category: "general", body: "nota del staff" })).ok).toBe(true);
    expect((await addResidentNote(admin(), { actorUserId: "ricardo", residenceId: NORTE, residentStayId: "stay-1", category: "general", body: "nota del dueño" })).ok).toBe(true);
    expect(audits.map((a) => [a.actorUserId, a.actorRole])).toEqual([
      ["notas", "residence_staff"],
      ["ricardo", "residence_owner"],
    ]);
  });

  it("renombrar una habitación con el permiso de habitaciones audita residence_staff y cambia la fila", async () => {
    expect((await renameRoom(admin(), { actorUserId: "cuartos", residenceId: NORTE, roomId: "room-1", label: "Suite" })).ok).toBe(true);
    expect(fake.tables.rooms[0].label).toBe("Suite");
    expect(audits).toEqual([expect.objectContaining({ action: "room_renamed", actorRole: "residence_staff" })]);
  });

  it("un staff anterior a DR11 (sin permisos guardados, `{}`) conserva lo que ya hacía", async () => {
    // El escenario es mínimo: puede fallar más adelante por los datos, pero nunca por permiso ni por acceso.
    const results = [
      await updateAvailability(admin(), { roomTypeId: "rt-1", actorUserId: "legacy", status: "full", availableCount: null, availableFrom: null, notesPublic: null }),
      await removeFromWaitlistByResidence(admin(), { waitlistEntryId: "wl-1", actorUserId: "legacy", reason: null }),
    ];
    for (const r of results) {
      const error = "error" in r ? String(r.error ?? "") : "";
      expect(error).not.toBe(PERMISSION_DENIED_MESSAGE);
      expect(error).not.toMatch(/No tenés acceso/);
    }
  });
});

describe("el cambio de permisos se refleja al instante (se lee de la base en cada acción)", () => {
  it("si el dueño apaga un permiso, la próxima acción del staff ya se rechaza", async () => {
    const note = () => addResidentNote(admin(), { actorUserId: "notas", residenceId: NORTE, residentStayId: "stay-1", category: "general", body: "x" });
    expect((await note()).ok).toBe(true);
    const row = fake.tables.residence_users.find((r) => r.user_id === "notas")!;
    row.permissions = { ...(row.permissions as object), "residents.manage": false };
    expect(await note()).toEqual({ ok: false, error: PERMISSION_DENIED_MESSAGE });
  });

  it("si se le quita el acceso (vínculo inactivo), pierde todo", async () => {
    fake.tables.residence_users.find((r) => r.user_id === "notas")!.is_active = false;
    const result = await addResidentNote(admin(), { actorUserId: "notas", residenceId: NORTE, residentStayId: "stay-1", category: "general", body: "x" });
    expect(result).toEqual({ ok: false, error: "No tenés acceso a esta residencia." });
  });
});
