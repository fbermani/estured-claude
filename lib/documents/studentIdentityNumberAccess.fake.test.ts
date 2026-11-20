import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  applicationAllowsIdentityNumber,
  grantStudentIdentityNumberAccess,
  IDENTITY_NUMBER_NOT_LOADED_MESSAGE,
} from "@/lib/documents/studentIdentityNumberAccess";
import {
  DOCUMENT_LOG_FAILED_MESSAGE,
  DOCUMENT_NOT_AVAILABLE_MESSAGE,
  DOCUMENT_PERMISSION_MESSAGE,
  DOCUMENT_RESIDENCE_INACTIVE_MESSAGE,
} from "@/lib/documents/residenceDocumentAccess";
import { createInMemorySupabase, type InMemoryOptions, type Row } from "@/lib/testing/inMemorySupabase";

const RES = "res-a";
const OTHER_RES = "res-b";
const RESIDENT = "sp-resident";
const BOOKED = "sp-booked";
const EARLY = "sp-early";
const NOID = "sp-noid";
const NUMBER = "30123456";

function seed(overrides: Partial<Record<string, Row[]>> = {}): Record<string, Row[]> {
  return {
    residence_users: [
      { residence_id: RES, user_id: "owner", role: "owner", is_active: true },
      { residence_id: RES, user_id: "staff-ok", role: "staff", is_active: true, permissions: { "residents.manage": true, "payments.residence": true } },
      { residence_id: RES, user_id: "staff-no", role: "staff", is_active: true, permissions: { "residents.manage": false, "payments.residence": false } },
      { residence_id: OTHER_RES, user_id: "owner-b", role: "owner", is_active: true },
    ],
    residences: [{ id: RES, status: "verified_active" }, { id: OTHER_RES, status: "verified_active" }],
    resident_stays: [{ id: "stay-1", residence_id: RES, student_profile_id: RESIDENT, is_current: true }],
    application_requests: [
      { id: "app-booked", residence_id: RES, student_profile_id: BOOKED, status: "converted_to_reservation" },
      { id: "app-early", residence_id: RES, student_profile_id: EARLY, status: "residence_payment_pending" },
      { id: "app-fee", residence_id: RES, student_profile_id: NOID, status: "converted_to_reservation" },
    ],
    reservations: [
      { id: "r-1", residence_id: RES, application_request_id: "app-booked", status: "confirmed" },
      { id: "r-2", residence_id: RES, application_request_id: "app-fee", status: "pending_estured_fee" },
    ],
    student_identity_documents: [
      { student_profile_id: RESIDENT, document_type: "dni", document_number: NUMBER },
      { student_profile_id: BOOKED, document_type: "passport", document_number: "AB123456" },
      { student_profile_id: EARLY, document_type: "dni", document_number: "40111222" },
      { student_profile_id: NOID, document_type: "dni", document_number: "41222333" },
    ],
    residence_document_access_log: [],
    audit_logs: [],
    ...overrides,
  } as Record<string, Row[]>;
}

const run = (userId: string, residenceId: string, studentProfileId: string, o: Partial<Record<string, Row[]>> = {}, opts: InMemoryOptions = {}) => {
  const db = createInMemorySupabase(seed(o), opts);
  return grantStudentIdentityNumberAccess(db.client, { userId, residenceId, studentProfileId }).then((result) => ({ result, tables: db.tables }));
};

describe("applicationAllowsIdentityNumber (más estricto que DR48)", () => {
  it("solo con la reserva confirmada", () => {
    for (const s of ["confirmed", "receipt_pending", "receipt_issued"]) expect(applicationAllowsIdentityNumber("converted_to_reservation", s)).toBe(true);
    for (const s of ["pending_estured_fee", "estured_fee_processing", "estured_fee_failed", "cancelled_by_student", "expired_fee_unpaid"]) {
      expect(applicationAllowsIdentityNumber("converted_to_reservation", s)).toBe(false);
    }
    expect(applicationAllowsIdentityNumber("converted_to_reservation", null)).toBe(false);
    for (const s of ["submitted", "contact_established", "residence_payment_pending", "residence_payment_reported"]) {
      expect(applicationAllowsIdentityNumber(s, "confirmed")).toBe(false);
    }
  });
});

describe("grantStudentIdentityNumberAccess", () => {
  it("dueño ve el número de un residente actual: queda registro y auditoría sin el número", async () => {
    const { result, tables } = await run("owner", RES, RESIDENT);
    expect(result).toEqual({ ok: true, documentType: "dni", number: NUMBER });
    expect(tables.residence_document_access_log).toHaveLength(1);
    expect(tables.residence_document_access_log[0]).toMatchObject({
      file_id: null,
      document_type: "identity_number",
      student_profile_id: RESIDENT,
      residence_id: RES,
      user_id: "owner",
      access_basis: "resident",
    });
    const logged = JSON.stringify([tables.residence_document_access_log, tables.audit_logs]);
    expect(logged).not.toContain(NUMBER);
    expect(tables.audit_logs[0]).toMatchObject({ action: "student_identity_number_accessed", entity_id: RESIDENT });
  });

  it("staff con casillero ve el número de un solicitante con reserva confirmada", async () => {
    const { result, tables } = await run("staff-ok", RES, BOOKED);
    expect(result).toEqual({ ok: true, documentType: "passport", number: "AB123456" });
    expect(tables.residence_document_access_log[0]).toMatchObject({ access_basis: "applicant", application_request_id: "app-booked" });
  });

  it("NEGATIVO: otra residencia no lo ve (residente ni reserva ajenos)", async () => {
    for (const sp of [RESIDENT, BOOKED]) {
      const { result, tables } = await run("owner-b", OTHER_RES, sp);
      expect(result).toEqual({ ok: false, error: DOCUMENT_NOT_AVAILABLE_MESSAGE });
      expect(tables.residence_document_access_log).toHaveLength(0);
    }
  });

  it("NEGATIVO: el dueño de A no usa el id de la residencia B para leer", async () => {
    const { result } = await run("owner", OTHER_RES, RESIDENT);
    expect(result.ok).toBe(false);
  });

  it("NEGATIVO: antes de la reserva confirmada no lo ve (pago habilitado, fee pendiente)", async () => {
    for (const sp of [EARLY, NOID]) {
      const { result, tables } = await run("owner", RES, sp);
      expect(result).toEqual({ ok: false, error: DOCUMENT_NOT_AVAILABLE_MESSAGE });
      expect(tables.residence_document_access_log).toHaveLength(0);
    }
  });

  it("NEGATIVO: staff sin casillero no lo ve", async () => {
    const { result, tables } = await run("staff-no", RES, RESIDENT);
    expect(result).toEqual({ ok: false, error: DOCUMENT_PERMISSION_MESSAGE });
    expect(tables.residence_document_access_log).toHaveLength(0);
  });

  it("NEGATIVO: usuario sin vínculo con la residencia no lo ve", async () => {
    const { result } = await run("random-user", RES, RESIDENT);
    expect(result.ok).toBe(false);
  });

  it("residencia no activa: no ve el número de solicitantes, sí el de residentes", async () => {
    const paused = { residences: [{ id: RES, status: "paused" }, { id: OTHER_RES, status: "verified_active" }] };
    expect(await run("owner", RES, BOOKED, paused).then((r) => r.result)).toEqual({ ok: false, error: DOCUMENT_RESIDENCE_INACTIVE_MESSAGE });
    expect((await run("owner", RES, RESIDENT, paused)).result.ok).toBe(true);
  });

  it("vínculo válido pero sin documento cargado: mensaje claro y sin registro", async () => {
    const { result, tables } = await run("owner", RES, RESIDENT, { student_identity_documents: [] });
    expect(result).toEqual({ ok: false, error: IDENTITY_NUMBER_NOT_LOADED_MESSAGE });
    expect(tables.residence_document_access_log).toHaveLength(0);
  });

  it("si el registro falla, no hay número", async () => {
    const { result } = await run("owner", RES, RESIDENT, {}, { failInsert: { residence_document_access_log: { code: "42P01", message: "boom" } } });
    expect(result).toEqual({ ok: false, error: DOCUMENT_LOG_FAILED_MESSAGE });
  });
});
