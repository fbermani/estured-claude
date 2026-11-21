import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
type AuditEntry = { actorUserId: string | null; actorRole: string; action: string; newValue?: unknown };
const audits = vi.hoisted(() => [] as AuditEntry[]);
vi.mock("@/lib/audit", () => ({
  createAuditLog: async (_admin: unknown, entry: AuditEntry) => {
    audits.push(entry);
    return true;
  },
}));
vi.mock("@/lib/regulations/gate", () => ({ assertRegulationAccepted: async () => ({ ok: true }) }));
vi.mock("@/lib/stayChange/advanceGate", () => ({ checkStayChangeAdvanceGate: async () => ({ ok: true }) }));
const notices = vi.hoisted(() => [] as { mode: string; methodLabel: string | null; isMinor: boolean }[]);
vi.mock("@/lib/applications/notifyCollectionEnabled", () => ({
  notifyCollectionEnabled: async (_admin: unknown, p: { mode: string; methodLabel: string | null; isMinor: boolean }) => {
    notices.push(p);
  },
}));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { OWNER_ONLY_MESSAGE, ownerPermissions, permissionsFromChecked } from "@/lib/residences/permissions";
import { chooseResidencePaymentCollectionCore, enableResidencePaymentCore } from "@/lib/applications/enableResidencePayment";

/**
 * DR63 fase 4 — la residencia habilita el pago y define cómo cobrar la reserva. Cliente en memoria: el rol del actor sale de
 * `residence_users` real. Los rechazos no escriben nada; el congelado sale de los datos APROBADOS, nunca de los pendientes.
 */
const NORTE = "res-norte";
const CBU = "CBU 0170099220000067797370 alias casa.norte";

function world(over: { residence?: Row; applicationExtra?: Row; accounts?: Row[]; snapshot?: Row } = {}): Record<string, Row[]> {
  return {
    residences: [
      { id: NORTE, name: "Norte", reservation_payment_modes: ["enabled_methods"], accepted_payment_methods: ["transfer_ars", "mercadopago"], ...over.residence },
    ],
    residence_collection_accounts: over.accounts ?? [
      { id: "a1", residence_id: NORTE, method_key: "transfer_ars", method_label: null, details: CBU, pending_details: "CBU NUEVO 9999999999999999" },
      // Solo pendiente: no se ofrece.
      { id: "a2", residence_id: NORTE, method_key: "mercadopago", method_label: null, details: null, pending_details: "alias.pendiente" },
    ],
    application_snapshots: [
      { id: "snap-1", reservation_payment_amount_usd: 300, reservation_payment_amount_ars: 450000, monthly_price_usd: 300, exchange_rate_ars_per_usd: 1500, ...over.snapshot },
    ],
    application_requests: [
      {
        id: "app-1",
        status: "contact_established",
        residence_id: NORTE,
        student_profile_id: "sp-1",
        proposal_count: 0,
        snapshot_original_id: "snap-1",
        snapshot_final_id: null,
        contact_target: "student",
        payment_deadline_at: "2030-01-01T00:00:00.000Z",
        preferred_payment_method: "transfer_ars",
        collection_mode: null,
        ...over.applicationExtra,
      },
    ],
    external_residence_payments: [],
    application_status_events: [],
    residence_users: [
      { id: "ru-owner", residence_id: NORTE, user_id: "ricardo", role: "owner", is_active: true },
      { id: "ru-staff", residence_id: NORTE, user_id: "staff-pagos", role: "staff", is_active: true, permissions: permissionsFromChecked(["payments.residence"]) },
      { id: "ru-staff2", residence_id: NORTE, user_id: "staff-todo", role: "staff", is_active: true, permissions: ownerPermissions() },
      { id: "ru-ro", residence_id: NORTE, user_id: "staff-lectura", role: "staff", is_active: true, permissions: permissionsFromChecked([]) },
    ],
  };
}

let fake: ReturnType<typeof createInMemorySupabase>;
const writes = () => fake.log.filter((l) => l.op !== "select");
const app = () => fake.tables.application_requests[0];
const payments = () => fake.tables.external_residence_payments;
const run = (actor: string, input?: unknown) => enableResidencePaymentCore(fake.client, { actorUserId: actor, applicationId: "app-1", input });
const boot = (w = world()) => {
  fake = createInMemorySupabase(w);
};

beforeEach(() => {
  audits.length = 0;
  notices.length = 0;
  boot();
});

describe("camino A: cobro con medios habilitados", () => {
  it("el dueño congela medio, monto e instrucciones con los datos APROBADOS", async () => {
    const res = await run("ricardo");
    expect(res).toEqual({ ok: true, residenceId: NORTE });
    expect(app()).toMatchObject({ status: "residence_payment_pending", collection_mode: "enabled_methods", snapshot_final_id: "snap-1" });
    expect(payments()).toHaveLength(1);
    expect(payments()[0]).toMatchObject({
      status: "pending",
      chosen_method: "transfer_ars",
      expected_amount_usd: 300,
      expected_amount_ars: 450000,
      instructions_snapshot: `Transferencia en pesos\n${CBU}`,
    });
    expect(String(payments()[0].instructions_snapshot)).not.toContain("NUEVO");
    expect(notices).toEqual([{ applicationId: "app-1", residenceId: NORTE, studentProfileId: "sp-1", mode: "enabled_methods", methodLabel: "Transferencia en pesos", isMinor: false }]);
  });

  it("la auditoría no lleva el dato de cobro completo", async () => {
    await run("ricardo");
    const entry = audits.find((a) => a.action === "residence_payment_enabled_without_negotiation");
    expect(entry?.newValue).toMatchObject({ collection_mode: "enabled_methods", chosen_method: "transfer_ars", instructions_masked: "•••• orte" });
    expect(JSON.stringify(audits)).not.toContain("0170099220000067797370");
  });

  it("ignora un monto enviado por el cliente: sale del snapshot", async () => {
    await run("ricardo", { collectionMode: "enabled_methods", chosenMethod: "transfer_ars", expectedAmountUsd: 1, amount: 1 });
    expect(payments()[0].expected_amount_usd).toBe(300);
  });

  it("el staff NO puede, aunque tenga todos los permisos, y no se escribe nada", async () => {
    for (const actor of ["staff-pagos", "staff-todo"]) {
      boot();
      expect(await run(actor)).toEqual({ ok: false, error: OWNER_ONLY_MESSAGE });
      expect(writes()).toEqual([]);
    }
  });

  it("staff sin permiso de pagos o ajeno a la residencia: rechazado sin escribir", async () => {
    for (const actor of ["staff-lectura", "extraño"]) {
      boot();
      expect((await run(actor)).ok).toBe(false);
      expect(writes()).toEqual([]);
    }
  });

  it("un medio con datos solo pendientes no se puede elegir", async () => {
    const res = await run("ricardo", { collectionMode: "enabled_methods", chosenMethod: "mercadopago" });
    expect(res.ok).toBe(false);
    expect(writes()).toEqual([]);
  });

  it("un medio fuera de la lista aceptada o del catálogo tampoco", async () => {
    for (const chosenMethod of ["belo", "inventado"]) {
      expect((await run("ricardo", { chosenMethod })).ok).toBe(false);
    }
    expect(writes()).toEqual([]);
  });

  it("monto en cero: no escribe nada", async () => {
    boot(world({ snapshot: { reservation_payment_amount_usd: 0, monthly_price_usd: 0 } }));
    expect((await run("ricardo")).ok).toBe(false);
    expect(writes()).toEqual([]);
  });

  it("si la fila de pago no se puede crear, revierte la solicitud", async () => {
    fake = createInMemorySupabase(world(), { failInsert: { external_residence_payments: { code: "XX000", message: "boom" } } });
    const res = await run("ricardo");
    expect(res.ok).toBe(false);
    expect(app()).toMatchObject({ status: "contact_established", collection_mode: null, snapshot_final_id: null, payment_deadline_at: "2030-01-01T00:00:00.000Z" });
    expect(fake.tables.application_status_events).toHaveLength(0);
  });
});

describe("camino B: contacto directo por WhatsApp", () => {
  const both = { residence: { reservation_payment_modes: ["enabled_methods", "whatsapp_direct"] } };

  it("sin snapshot de instrucciones ni medio; solo queda el modo en la solicitud", async () => {
    boot(world(both));
    expect((await run("ricardo", { collectionMode: "whatsapp_direct" })).ok).toBe(true);
    expect(app()).toMatchObject({ status: "residence_payment_pending", collection_mode: "whatsapp_direct" });
    expect(payments()[0]).not.toHaveProperty("instructions_snapshot");
    expect(payments()[0]).not.toHaveProperty("chosen_method");
    expect(notices[0]).toMatchObject({ mode: "whatsapp_direct", methodLabel: null });
  });

  it("el staff con permiso de pagos sí puede (como antes de DR63)", async () => {
    boot(world(both));
    expect((await run("staff-pagos", { collectionMode: "whatsapp_direct" })).ok).toBe(true);
    expect(app().collection_mode).toBe("whatsapp_direct");
  });

  it("con dos caminos y sin elección pide elegir y no escribe", async () => {
    boot(world(both));
    const res = await run("ricardo");
    expect(res.ok).toBe(false);
    expect(writes()).toEqual([]);
  });

  it("residencia sin configurar: contacto directo, también para el staff", async () => {
    boot(world({ residence: { reservation_payment_modes: null, accepted_payment_methods: null } }));
    expect((await run("staff-pagos")).ok).toBe(true);
    expect(app().collection_mode).toBe("whatsapp_direct");
  });

  it("solo medios activos pero ninguno aprobado: se degrada a contacto directo", async () => {
    boot(world({ accounts: [] }));
    expect((await run("ricardo")).ok).toBe(true);
    expect(app().collection_mode).toBe("whatsapp_direct");
  });

  it("estudiante menor: el aviso va marcado para el familiar vinculado (contact_target)", async () => {
    boot(world({ ...both, applicationExtra: { contact_target: "family_member" } }));
    await run("ricardo", { collectionMode: "whatsapp_direct" });
    expect(notices[0].isMinor).toBe(true);
  });

  it("estudiante mayor: contact_target student", async () => {
    boot(world(both));
    await run("ricardo", { collectionMode: "whatsapp_direct" });
    expect(notices[0].isMinor).toBe(false);
  });
});

describe("estado y degradación", () => {
  it("una solicitud que ya cambió no se pisa", async () => {
    boot(world({ applicationExtra: { status: "expired_no_student_payment" } }));
    expect((await run("ricardo")).ok).toBe(false);
    expect(writes()).toEqual([]);
  });

  it("con propuesta de ajuste enviada no habilita", async () => {
    boot(world({ applicationExtra: { proposal_count: 1 } }));
    expect((await run("ricardo")).ok).toBe(false);
    expect(writes()).toEqual([]);
  });

  it("sin la migración 0102 sigue el flujo anterior sin columnas nuevas", async () => {
    fake = createInMemorySupabase(world(), { missingColumns: { residences: ["reservation_payment_modes"], application_requests: ["collection_mode"] } });
    expect((await run("staff-pagos")).ok).toBe(true);
    expect(app().status).toBe("residence_payment_pending");
    expect(app().collection_mode).toBeNull();
    expect(payments()[0]).not.toHaveProperty("chosen_method");
  });
});

describe("chooseResidencePaymentCollectionCore (tras una propuesta de ajuste)", () => {
  const pendingWorld = (extra: Row = {}, residence: Row = {}) => {
    const w = world({ residence, applicationExtra: { status: "residence_payment_pending", snapshot_final_id: "snap-1", ...extra } });
    w.external_residence_payments = [{ id: "pay-1", application_request_id: "app-1", residence_id: NORTE, status: "pending", chosen_method: null }];
    return w;
  };
  const choose = (actor: string, input?: unknown) => chooseResidencePaymentCollectionCore(fake.client, { actorUserId: actor, applicationId: "app-1", input });

  it("el dueño define el medio, se congela y el plazo se reinicia", async () => {
    boot(pendingWorld());
    const before = Date.now();
    expect((await choose("ricardo")).ok).toBe(true);
    expect(app().collection_mode).toBe("enabled_methods");
    expect(new Date(String(app().payment_deadline_at)).getTime()).toBeGreaterThan(before + 47 * 3600 * 1000);
    expect(payments()[0]).toMatchObject({ chosen_method: "transfer_ars", expected_amount_usd: 300, instructions_snapshot: `Transferencia en pesos\n${CBU}` });
    expect(audits.some((a) => a.action === "residence_payment_collection_chosen")).toBe(true);
  });

  it("el staff no puede en el camino A", async () => {
    boot(pendingWorld());
    expect(await choose("staff-todo")).toEqual({ ok: false, error: OWNER_ONLY_MESSAGE });
    expect(writes()).toEqual([]);
  });

  it("no se puede redefinir un cobro ya fijado", async () => {
    boot(pendingWorld({ collection_mode: "whatsapp_direct" }));
    expect((await choose("ricardo")).ok).toBe(false);
    expect(writes()).toEqual([]);
  });

  it("contacto directo: solo cambia el modo", async () => {
    boot(pendingWorld({}, { reservation_payment_modes: ["enabled_methods", "whatsapp_direct"] }));
    expect((await choose("staff-pagos", { collectionMode: "whatsapp_direct" })).ok).toBe(true);
    expect(app().collection_mode).toBe("whatsapp_direct");
    expect(payments()[0]).not.toHaveProperty("instructions_snapshot");
  });
});
