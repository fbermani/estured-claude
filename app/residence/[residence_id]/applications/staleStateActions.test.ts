import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * H06 (revisión) — las acciones de la residencia sobre una solicitud no pisan un estado que cambió
 * mientras tanto (el job de vencimiento, otra pestaña): el UPDATE va condicionado al estado esperado
 * y, si no devuelve fila, la acción responde con un error amable y no deja efectos colaterales.
 * Cliente Supabase falso: el SELECT inicial devuelve el estado "viejo" que vio la pantalla, y los
 * UPDATE condicionados se evalúan contra el estado real.
 */
const state = vi.hoisted(() => ({
  readStatus: "contact_established",
  actualStatus: "expired_no_student_payment",
  updates: [] as { values: Record<string, unknown>; filters: [string, unknown][] }[],
  inserts: [] as { table: string; row: unknown }[],
  deletes: [] as { table: string; filters: [string, unknown][] }[],
  paymentsCreated: 0,
  reactivations: 0,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: async () => ({ id: "owner-1" }) }));
vi.mock("@/lib/residences/access", () => ({
  assertResidencePermission: async () => ({ ok: true, actorRole: "residence_owner" }),
  assertResidenceOwner: async () => ({ ok: true, actorRole: "residence_owner" }),
}));
vi.mock("@/lib/audit", () => ({ createAuditLog: async () => true }));
vi.mock("@/lib/applications/roomTypeQueue", () => ({ promoteNextQueuedApplication: async () => undefined }));
vi.mock("@/lib/applications/residencePayment", () => ({
  createPendingResidencePayment: async () => {
    state.paymentsCreated += 1;
  },
}));
vi.mock("@/lib/applications/reactivatePausedApplications", () => ({
  reactivatePausedApplications: async () => {
    state.reactivations += 1;
    return { reactivatedCount: 0 };
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from(table: string) {
      const q = { op: "select" as "select" | "update" | "insert" | "delete", values: {} as Record<string, unknown>, filters: [] as [string, unknown][] };
      const resolve = (): { data: unknown; error: null } => {
        if (table === "application_negotiation_proposals" && q.op === "insert") return { data: { id: "prop-1" }, error: null };
        if (table === "application_negotiation_proposals" && q.op === "delete") {
          state.deletes.push({ table, filters: q.filters });
          return { data: null, error: null };
        }
        if (table === "residence_users") return { data: { id: "ru-1" }, error: null };
        if (table === "application_snapshots") return { data: { exchange_rate_ars_per_usd: 1500 }, error: null };
        if (table === "application_requests" && q.op === "select") {
          return {
            data: {
              id: "app-1",
              status: state.readStatus,
              residence_id: "res-1",
              student_profile_id: "sp-1",
              proposal_count: 0,
              snapshot_original_id: "snap-1",
              room_type_id: null,
              payment_deadline_at: null,
            },
            error: null,
          };
        }
        if (table === "application_requests" && q.op === "update") {
          state.updates.push({ values: q.values, filters: q.filters });
          const statusFilter = q.filters.find(([k]) => k === "status");
          const matches = !statusFilter || statusFilter[1] === state.actualStatus;
          return { data: matches ? { id: "app-1" } : null, error: null };
        }
        return { data: null, error: null };
      };
      const chain: Record<string, unknown> = {
        select: () => chain,
        update: (values: Record<string, unknown>) => {
          q.op = "update";
          q.values = values;
          return chain;
        },
        insert: (row: unknown) => {
          q.op = "insert";
          state.inserts.push({ table, row });
          return chain;
        },
        delete: () => {
          q.op = "delete";
          return chain;
        },
        eq: (k: string, v: unknown) => {
          q.filters.push([k, v]);
          return chain;
        },
        in: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => resolve(),
        single: async () => resolve(),
        then: (onFulfilled: (v: unknown) => unknown) => Promise.resolve(resolve()).then(onFulfilled),
      };
      return chain;
    },
  }),
}));

import {
  enableResidencePayment,
  establishContact,
  markUnderReview,
  rejectApplication,
} from "@/app/residence/[residence_id]/applications/actions";
import { sendNegotiationProposal } from "@/app/residence/[residence_id]/applications/[id]/negotiation/actions";

const STALE = "La solicitud ya cambió de estado, actualizá la página.";

function resetState(readStatus: string, actualStatus: string) {
  state.readStatus = readStatus;
  state.actualStatus = actualStatus;
  state.updates = [];
  state.inserts = [];
  state.deletes = [];
  state.paymentsCreated = 0;
  state.reactivations = 0;
}

describe("acciones de la residencia con el estado cambiado de por medio", () => {
  beforeEach(() => resetState("contact_established", "expired_no_student_payment"));

  it("enableResidencePayment: UPDATE condicionado a contact_established, sin pago ni evento si ya cambió", async () => {
    const result = await enableResidencePayment("app-1");
    expect(result).toEqual({ status: "error", message: STALE });
    expect(state.updates[0].filters).toContainEqual(["status", "contact_established"]);
    expect(state.paymentsCreated).toBe(0);
    expect(state.inserts.filter((i) => i.table === "application_status_events")).toHaveLength(0);
  });

  it("enableResidencePayment: si el estado coincide, avanza normalmente", async () => {
    resetState("contact_established", "contact_established");
    const result = await enableResidencePayment("app-1");
    expect(result).toEqual({ status: "saved" });
    expect(state.paymentsCreated).toBe(1);
  });

  it("establishContact: condicionado al estado que se leyó; no pausa a nadie si perdió la carrera", async () => {
    resetState("under_review", "rejected");
    const result = await establishContact("app-1");
    expect(result).toEqual({ status: "error", message: STALE });
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0].filters).toContainEqual(["status", "under_review"]);
    expect(state.inserts.filter((i) => i.table === "application_status_events")).toHaveLength(0);
  });

  it("markUnderReview: condicionado a submitted", async () => {
    resetState("submitted", "expired_no_residence_response");
    const result = await markUnderReview("app-1");
    expect(result).toEqual({ status: "error", message: STALE });
    expect(state.updates[0].filters).toContainEqual(["status", "submitted"]);
  });

  it("rejectApplication: condicionado; si perdió la carrera no deja evento ni reactiva pausadas", async () => {
    resetState("under_review", "expired_no_student_payment");
    const form = new FormData();
    form.set("reason_code", "no_availability");
    const result = await rejectApplication("app-1", { status: "idle" }, form);
    expect(result).toEqual({ status: "error", message: STALE });
    expect(state.updates[0].filters).toContainEqual(["status", "under_review"]);
    expect(state.inserts.filter((i) => i.table === "application_status_events")).toHaveLength(0);
    expect(state.reactivations).toBe(0);
  });

  it("rejectApplication: si el rechazo se guarda, reactiva las pausadas del estudiante", async () => {
    resetState("under_review", "under_review");
    const form = new FormData();
    form.set("reason_code", "no_availability");
    const result = await rejectApplication("app-1", { status: "idle" }, form);
    expect(result).toEqual({ status: "saved" });
    expect(state.reactivations).toBe(1);
  });

  it("sendNegotiationProposal: inserta la propuesta y después actualiza condicionado; si la solicitud ya cambió, borra la propuesta", async () => {
    resetState("contact_established", "expired_no_student_payment");
    const form = new FormData();
    form.set("warning_acknowledged", "on");
    form.set("proposed_monthly_price_usd", "280");
    const result = await sendNegotiationProposal("app-1", { status: "idle" }, form);
    expect(result).toEqual({ status: "error", message: STALE });
    expect(state.inserts.filter((i) => i.table === "application_negotiation_proposals")).toHaveLength(1);
    expect(state.updates[0].filters).toContainEqual(["status", "contact_established"]);
    expect(state.deletes).toEqual([{ table: "application_negotiation_proposals", filters: [["id", "prop-1"]] }]);
    expect(state.inserts.filter((i) => i.table === "application_status_events")).toHaveLength(0);
  });

  it("sendNegotiationProposal: si el estado coincide no borra nada y registra el evento", async () => {
    resetState("contact_established", "contact_established");
    const form = new FormData();
    form.set("warning_acknowledged", "on");
    form.set("proposed_monthly_price_usd", "280");
    await expect(sendNegotiationProposal("app-1", { status: "idle" }, form)).rejects.toThrow(/^REDIRECT:/);
    expect(state.deletes).toHaveLength(0);
    expect(state.inserts.filter((i) => i.table === "application_status_events")).toHaveLength(1);
  });
});
