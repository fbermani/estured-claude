import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  applicationAllowsDocuments,
  DOCUMENT_LOG_FAILED_MESSAGE,
  DOCUMENT_NOT_AVAILABLE_MESSAGE,
  DOCUMENT_PERMISSION_MESSAGE,
  grantResidenceDocumentAccess,
} from "@/lib/documents/residenceDocumentAccess";
import { createInMemorySupabase, type InMemoryOptions, type Row } from "@/lib/testing/inMemorySupabase";

const RES = "res-a";
const OTHER_RES = "res-b";
const RESIDENT = "sp-resident";
const APPLICANT = "sp-applicant";
const STRANGER = "sp-stranger";

function seed(overrides: Partial<Record<string, Row[]>> = {}): Record<string, Row[]> {
  return {
    residence_users: [
      { residence_id: RES, user_id: "owner", role: "owner", is_active: true },
      { residence_id: RES, user_id: "staff-ok", role: "staff", is_active: true, permissions: { "residents.manage": true, "payments.residence": true } },
      { residence_id: RES, user_id: "staff-no", role: "staff", is_active: true, permissions: { "residents.manage": false, "payments.residence": false } },
      { residence_id: OTHER_RES, user_id: "owner-b", role: "owner", is_active: true },
    ],
    files: [
      { id: "f-resident", bucket: "student-documents", storage_path: "sp-resident/id.pdf", related_entity_type: "student_profiles", related_entity_id: RESIDENT, document_type: "student_identity" },
      { id: "f-applicant", bucket: "student-documents", storage_path: "sp-applicant/id.pdf", related_entity_type: "student_profiles", related_entity_id: APPLICANT, document_type: "student_identity" },
      { id: "f-stranger", bucket: "student-documents", storage_path: "sp-stranger/id.pdf", related_entity_type: "student_profiles", related_entity_id: STRANGER, document_type: "student_identity" },
      { id: "f-proof", bucket: "payment-proofs", storage_path: "x.pdf", related_entity_type: "application_requests", related_entity_id: "app-1", document_type: "student_payment_proof_to_residence" },
    ],
    resident_stays: [{ id: "stay-1", residence_id: RES, student_profile_id: RESIDENT, is_current: true }],
    application_requests: [
      { id: "app-1", residence_id: RES, student_profile_id: APPLICANT, status: "residence_payment_pending" },
      { id: "app-2", residence_id: RES, student_profile_id: STRANGER, status: "contact_established" },
    ],
    reservations: [],
    residence_document_access_log: [],
    audit_logs: [],
    ...overrides,
  } as Record<string, Row[]>;
}

function setup(overrides: Partial<Record<string, Row[]>> = {}, options: InMemoryOptions = {}) {
  const db = createInMemorySupabase(seed(overrides), options);
  const createSignedUrl = vi.fn(async (path: string, seconds: number) => ({ data: { signedUrl: `https://signed/${path}?t=${seconds}` }, error: null }));
  (db.client as unknown as { storage: unknown }).storage = { from: () => ({ createSignedUrl }) };
  return { ...db, createSignedUrl };
}

describe("applicationAllowsDocuments (estados elegibles, DR48)", () => {
  it("solo con el pago a la residencia habilitado o con la reserva viva", () => {
    expect(applicationAllowsDocuments("residence_payment_pending", null)).toBe(true);
    expect(applicationAllowsDocuments("residence_payment_reported", null)).toBe(true);
    expect(applicationAllowsDocuments("converted_to_reservation", "pending_estured_fee")).toBe(true);
    expect(applicationAllowsDocuments("converted_to_reservation", "confirmed")).toBe(true);
    expect(applicationAllowsDocuments("converted_to_reservation", "cancelled_by_student")).toBe(false);
    expect(applicationAllowsDocuments("converted_to_reservation", "expired_fee_unpaid")).toBe(false);
    expect(applicationAllowsDocuments("converted_to_reservation", null)).toBe(false);
    for (const s of ["submitted", "under_review", "contact_established", "offer_pending_student_acceptance", "conditions_accepted", "rejected", "expired_no_student_payment", "cancelled_by_student"]) {
      expect(applicationAllowsDocuments(s, null)).toBe(false);
    }
  });
});

describe("grantResidenceDocumentAccess", () => {
  it("dueño abre el documento de un residente: link de 300 s, registro y auditoría", async () => {
    const { client, tables, createSignedUrl } = setup();
    const result = await grantResidenceDocumentAccess(client, { userId: "owner", residenceId: RES, fileId: "f-resident" });
    expect(result).toEqual({ ok: true, url: "https://signed/sp-resident/id.pdf?t=300" });
    expect(createSignedUrl).toHaveBeenCalledWith("sp-resident/id.pdf", 300);
    expect(tables.residence_document_access_log).toHaveLength(1);
    expect(tables.residence_document_access_log[0]).toMatchObject({
      file_id: "f-resident",
      residence_id: RES,
      user_id: "owner",
      student_profile_id: RESIDENT,
      actor_role: "residence_owner",
      access_basis: "resident",
      application_request_id: null,
      document_type: "student_identity",
    });
    expect(tables.audit_logs[0]).toMatchObject({ action: "residence_document_accessed", entity_id: "f-resident", actor_user_id: "owner" });
  });

  it("staff con permiso abre el de un solicitante con el pago habilitado", async () => {
    const { client, tables } = setup();
    const result = await grantResidenceDocumentAccess(client, { userId: "staff-ok", residenceId: RES, fileId: "f-applicant" });
    expect(result.ok).toBe(true);
    expect(tables.residence_document_access_log[0]).toMatchObject({ actor_role: "residence_staff", access_basis: "applicant", application_request_id: "app-1" });
  });

  it("staff sin el casillero queda afuera (residente y solicitante) y no se registra ni se firma nada", async () => {
    const { client, tables, createSignedUrl } = setup();
    expect(await grantResidenceDocumentAccess(client, { userId: "staff-no", residenceId: RES, fileId: "f-resident" })).toEqual({ ok: false, error: DOCUMENT_PERMISSION_MESSAGE });
    expect(await grantResidenceDocumentAccess(client, { userId: "staff-no", residenceId: RES, fileId: "f-applicant" })).toEqual({ ok: false, error: DOCUMENT_PERMISSION_MESSAGE });
    expect(tables.residence_document_access_log).toHaveLength(0);
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("staff con solo «Residentes» no abre a un solicitante (el casillero es por vínculo)", async () => {
    const { client } = setup({
      residence_users: [{ residence_id: RES, user_id: "staff-res", role: "staff", is_active: true, permissions: { "residents.manage": true, "payments.residence": false } }],
    });
    expect(await grantResidenceDocumentAccess(client, { userId: "staff-res", residenceId: RES, fileId: "f-resident" })).toMatchObject({ ok: true });
    expect(await grantResidenceDocumentAccess(client, { userId: "staff-res", residenceId: RES, fileId: "f-applicant" })).toEqual({ ok: false, error: DOCUMENT_PERMISSION_MESSAGE });
  });

  it("residencia ajena: el dueño de otra residencia no ve nada (ni pasando el id de la residencia del estudiante)", async () => {
    const { client, createSignedUrl } = setup();
    expect(await grantResidenceDocumentAccess(client, { userId: "owner-b", residenceId: OTHER_RES, fileId: "f-resident" })).toEqual({ ok: false, error: DOCUMENT_NOT_AVAILABLE_MESSAGE });
    expect(await grantResidenceDocumentAccess(client, { userId: "owner-b", residenceId: RES, fileId: "f-resident" })).toEqual({ ok: false, error: "No tenés acceso a esta residencia." });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("solicitante sin pago habilitado o estudiante sin vínculo: mismo mensaje que un archivo inexistente", async () => {
    const { client } = setup();
    expect(await grantResidenceDocumentAccess(client, { userId: "owner", residenceId: RES, fileId: "f-stranger" })).toEqual({ ok: false, error: DOCUMENT_NOT_AVAILABLE_MESSAGE });
    expect(await grantResidenceDocumentAccess(client, { userId: "owner", residenceId: RES, fileId: "no-existe" })).toEqual({ ok: false, error: DOCUMENT_NOT_AVAILABLE_MESSAGE });
  });

  it("estados no elegibles: reserva cancelada o solicitud vencida/rechazada no habilitan", async () => {
    for (const [status, reservation] of [
      ["converted_to_reservation", "cancelled_by_residence"],
      ["expired_no_student_payment", null],
      ["rejected", null],
      ["conditions_accepted", null],
    ] as const) {
      const { client } = setup({
        application_requests: [{ id: "app-1", residence_id: RES, student_profile_id: APPLICANT, status }],
        reservations: reservation ? [{ id: "r-1", residence_id: RES, application_request_id: "app-1", status: reservation }] : [],
      });
      expect(await grantResidenceDocumentAccess(client, { userId: "owner", residenceId: RES, fileId: "f-applicant" })).toEqual({ ok: false, error: DOCUMENT_NOT_AVAILABLE_MESSAGE });
    }
    const { client } = setup({
      application_requests: [{ id: "app-1", residence_id: RES, student_profile_id: APPLICANT, status: "converted_to_reservation" }],
      reservations: [{ id: "r-1", residence_id: RES, application_request_id: "app-1", status: "pending_estured_fee" }],
    });
    expect(await grantResidenceDocumentAccess(client, { userId: "owner", residenceId: RES, fileId: "f-applicant" })).toMatchObject({ ok: true });
  });

  it("archivos que no son documentos de estudiante (otro bucket) no se abren", async () => {
    const { client } = setup();
    expect(await grantResidenceDocumentAccess(client, { userId: "owner", residenceId: RES, fileId: "f-proof" })).toEqual({ ok: false, error: DOCUMENT_NOT_AVAILABLE_MESSAGE });
  });

  it("si falla el registro de la apertura no se genera el link", async () => {
    const { client, createSignedUrl, tables } = setup({}, { failInsert: { residence_document_access_log: { code: "42P01", message: "boom" } } });
    expect(await grantResidenceDocumentAccess(client, { userId: "owner", residenceId: RES, fileId: "f-resident" })).toEqual({ ok: false, error: DOCUMENT_LOG_FAILED_MESSAGE });
    expect(createSignedUrl).not.toHaveBeenCalled();
    expect(tables.audit_logs).toHaveLength(0);
  });
});
