import { describe, expect, it, vi } from "vitest";

/**
 * DR14 (docs/06 §11.5) — una solicitud que nació sin la aceptación del reglamento queda en pausa para la residencia: las acciones que la
 * AVANZAN (marcar en revisión, contactar, habilitar el pago, proponer ajuste, confirmar el pago) se rechazan por POST directo con un mensaje
 * claro y sin escribir nada; rechazarla sigue permitido. Cuando el estudiante acepta, las mismas acciones pasan. Cliente Supabase en memoria.
 */
const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/auth/session", () => ({
  getSessionUser: async () => ({ id: "ricardo", email: "r@example.com", primaryRole: "residence_owner", roles: ["residence_owner"] }),
  hasAnyRole: () => true,
}));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => state.db }));
vi.mock("@/lib/audit", () => ({ createAuditLog: async () => true }));
vi.mock("@/lib/notifications/createNotification", () => ({ createNotification: async () => undefined }));
vi.mock("@/lib/email/sendEmail", () => ({ sendEmail: async () => true }));
vi.mock("@/lib/exchange/rate", () => ({ getCurrentExchangeRate: async () => ({ arsPerUsd: 1500 }) }));
vi.mock("@/lib/family/access", () => ({ loadActiveFamilyLink: async () => null }));
vi.mock("@/lib/applications/roomTypeQueue", () => ({ promoteNextQueuedApplication: async () => undefined }));
vi.mock("@/lib/applications/residencePayment", () => ({ createPendingResidencePayment: async () => undefined }));
vi.mock("@/lib/applications/reactivatePausedApplications", () => ({ reactivatePausedApplications: async () => ({ reactivatedCount: 0 }) }));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { REGULATION_PENDING_FOR_RESIDENCE_MESSAGE } from "@/lib/regulations/gate";
import { acceptRegulationForApplication } from "@/lib/regulations/acceptance";
import { hashRegulationText } from "@/lib/regulations/text";
import { enableResidencePayment, establishContact, markUnderReview, rejectApplication } from "@/app/residence/[residence_id]/applications/actions";
import { sendNegotiationProposal } from "@/app/residence/[residence_id]/applications/[id]/negotiation/actions";
import { recordResidencePaymentReceived } from "@/lib/reservations/recordResidencePaymentReceived";

const NORTE = "res-norte";
const TEXT = `CONVIVENCIA\n\nArt. 1. Silencio\n${"Se guarda silencio desde las 23:00 hasta las 7:00 en toda la residencia. ".repeat(4)}`;

function setup(status = "submitted") {
  const tables: Record<string, Row[]> = {
    residence_users: [{ id: "ru", residence_id: NORTE, user_id: "ricardo", role: "owner", is_active: true }],
    application_requests: [{ id: "app-1", residence_id: NORTE, student_profile_id: "sp-1", status, regulation_acceptance_pending: true, proposal_count: 0, snapshot_original_id: "snap-1" }],
    student_profiles: [{ id: "sp-1", user_id: "lucia", is_minor: false }],
    residence_regulation_versions: [
      { id: "v1", residence_id: NORTE, version_number: 1, source: "own", content: { text: TEXT }, content_hash: hashRegulationText(TEXT), status: "published", published_at: "2026-10-25T00:00:00Z" },
    ],
    application_regulation_acceptances: [],
    application_negotiation_proposals: [],
    application_status_events: [],
    application_snapshots: [{ id: "snap-1", exchange_rate_ars_per_usd: 1500 }],
  };
  const db = createInMemorySupabase(tables);
  state.db = db.client;
  return db;
}

describe("bloqueo de la residencia sin aceptación del reglamento (DR14)", () => {
  it("markUnderReview, establishContact y enableResidencePayment se rechazan con el mensaje y no cambian la solicitud", async () => {
    const db = setup("submitted");
    for (const run of [markUnderReview, establishContact, enableResidencePayment]) {
      expect(await run("app-1")).toEqual({ status: "error", message: REGULATION_PENDING_FOR_RESIDENCE_MESSAGE });
    }
    expect(db.tables.application_requests[0].status).toBe("submitted");
    expect(db.tables.application_status_events).toHaveLength(0);
  });

  it("proponer un ajuste y confirmar el pago a la residencia también se rechazan", async () => {
    const db = setup("contact_established");
    const proposal = await sendNegotiationProposal("app-1", { status: "idle" }, new FormData());
    expect(proposal).toMatchObject({ status: "error", message: REGULATION_PENDING_FOR_RESIDENCE_MESSAGE });
    expect(db.tables.application_negotiation_proposals).toHaveLength(0);
    const payment = await recordResidencePaymentReceived(db.client, {
      applicationId: "app-1",
      actorUserId: "ricardo",
      receivedAmountArs: null,
      receivedAmountUsd: 100,
      paymentMethodLabel: "Transferencia",
      confirmationAccepted: true,
      receiptFile: null,
    });
    expect(payment).toEqual({ ok: false, error: REGULATION_PENDING_FOR_RESIDENCE_MESSAGE });
  });

  it("rechazar la solicitud NO está bloqueado (no la avanza)", async () => {
    setup("submitted");
    const fd = new FormData();
    fd.set("reason_code", "no_availability");
    const result = await rejectApplication("app-1", { status: "idle" }, fd);
    expect((result as { message?: string }).message).not.toBe(REGULATION_PENDING_FOR_RESIDENCE_MESSAGE);
  });

  it("cuando el estudiante acepta, la residencia puede avanzar", async () => {
    const db = setup("submitted");
    expect(await markUnderReview("app-1")).toMatchObject({ status: "error" });
    const accepted = await acceptRegulationForApplication(db.client, { applicationId: "app-1", actorUserId: "lucia", accepted: true, seenHash: hashRegulationText(TEXT) });
    expect(accepted).toEqual({ ok: true });
    expect(await markUnderReview("app-1")).toEqual({ status: "saved" });
    expect(db.tables.application_requests[0].status).toBe("under_review");
  });
});
