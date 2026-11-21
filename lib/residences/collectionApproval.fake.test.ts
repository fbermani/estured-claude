import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type AuditEntry = {
  actorUserId: string | null;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  reasonText?: string;
  source?: string;
};
const state = vi.hoisted(() => ({
  audits: [] as AuditEntry[],
  auditOk: true,
  alerts: [] as { action: string }[],
  notifications: [] as { userId: string; title: string; body: string; relatedEntityType?: string; relatedEntityId?: string }[],
  /** Donde createAuditLog escribe además de `audits`: la tabla `audit_logs` del fake (la lee el historial del dueño). */
  sink: null as null | ((entry: AuditEntry, n: number) => void),
  tick: 0,
}));
vi.mock("@/lib/audit", () => ({
  createAuditLog: async (_admin: unknown, entry: AuditEntry) => {
    if (!state.auditOk) return false;
    state.audits.push(entry);
    state.sink?.(entry, ++state.tick);
    return true;
  },
  alertAdminsOfAuditFailure: async (_admin: unknown, p: { action: string }) => {
    state.alerts.push(p);
  },
  notifyAdmins: async () => undefined,
}));
vi.mock("@/lib/notifications/createNotification", () => ({
  createNotification: async (_admin: unknown, n: { userId: string; title: string; body: string }) => {
    state.notifications.push(n);
  },
}));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { approveCollectionAccount, rejectCollectionAccount, STALE_ERROR } from "@/lib/residences/collectionApproval";
import { groupPendingByResidence } from "@/lib/residences/collectionApprovalDb";
import { loadCollectionAccountsForOwner } from "@/lib/residences/reservationCollectionDb";
import { saveReservationCollection } from "@/lib/residences/reservationCollectionSave";

/**
 * DR63 fase 2b — aprobación del admin de los datos de cobro: solo admin/superadmin (rol leído de `user_roles`); aprobar copia lo
 * pendiente a lo vigente; rechazar exige motivo y deja rigiendo lo anterior; ambas son condicionales por `pending_submitted_at`; la
 * auditoría y los avisos nunca llevan el dato de cobro completo.
 */
const NORTE = "res-norte";
const CBU = "CBU 0170099220000067797370 alias casa.norte";
const CBU_NUEVO = "CBU 0140999999999999999999 alias casa.nueva";
const T1 = "2026-11-21T10:00:00.123456+00:00";

function world(accounts: Row[] = []): Record<string, Row[]> {
  return {
    residences: [{ id: NORTE, name: "Residencia Norte", reservation_payment_modes: ["enabled_methods"], accepted_payment_methods: ["transfer_ars"] }],
    residence_collection_accounts: accounts,
    user_roles: [
      { user_id: "admin-1", role: "admin", is_active: true },
      { user_id: "super-1", role: "superadmin", is_active: true },
      { user_id: "admin-baja", role: "admin", is_active: false },
      { user_id: "ricardo", role: "residence_owner", is_active: true },
    ],
    residence_users: [
      { residence_id: NORTE, user_id: "ricardo", role: "owner", is_active: true },
      { residence_id: NORTE, user_id: "staff-1", role: "staff", is_active: true },
    ],
    audit_logs: [],
  };
}

const pendingAccount = (extra: Row = {}): Row => ({
  id: "acc-1",
  residence_id: NORTE,
  method_key: "transfer_ars",
  method_label: null,
  pending_method_label: null,
  details: null,
  pending_details: CBU,
  pending_submitted_at: T1,
  approved_at: null,
  approved_by_user_id: null,
  ...extra,
});

/** Espejo de los CHECK de la migración 0102 (el fake no los aplica): corre sobre cada fila después de cada operación. */
function assertConstraints(rows: Row[]): void {
  for (const r of rows) {
    const label = r.method_label as string | null;
    const pLabel = r.pending_method_label as string | null;
    const details = r.details as string | null;
    const pDetails = r.pending_details as string | null;
    if (r.method_key === "other") expect(label !== null || pLabel !== null, "other sin nombre").toBe(true);
    else {
      expect(label, "etiqueta fuera de other").toBeNull();
      expect(pLabel, "etiqueta pendiente fuera de other").toBeNull();
    }
    expect((details === null && label === null) || r.approved_at != null, "lo vigente exige approved_at").toBe(true);
    expect((pDetails === null && pLabel === null) || r.pending_submitted_at != null, "lo pendiente exige pending_submitted_at").toBe(true);
    if (details !== null) expect(details.trim().length).toBeGreaterThanOrEqual(1);
  }
}

let fake: ReturnType<typeof createInMemorySupabase>;
const accounts = () => fake.tables.residence_collection_accounts;
const account = (id = "acc-1") => accounts().find((r) => r.id === id);
const writes = () => fake.log.filter((l) => l.op !== "select");
function boot(rows: Row[] = [pendingAccount()]) {
  fake = createInMemorySupabase(world(rows));
  state.sink = (entry, n) =>
    fake.tables.audit_logs.push({
      id: `a-${n}`,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      new_value: entry.newValue,
      reason_text: entry.reasonText ?? null,
      created_at: new Date(Date.UTC(2026, 10, 21, 12, 0, n)).toISOString(),
    });
}
const approve = (actor = "admin-1", patch: Partial<Parameters<typeof approveCollectionAccount>[1]> = {}) =>
  approveCollectionAccount(fake.client, { actorUserId: actor, residenceId: NORTE, methodKey: "transfer_ars", expectedSubmittedAt: T1, ...patch });
const reject = (actor = "admin-1", reason: unknown = "El alias no coincide con el titular.", patch: Partial<Parameters<typeof rejectCollectionAccount>[1]> = {}) =>
  rejectCollectionAccount(fake.client, { actorUserId: actor, residenceId: NORTE, methodKey: "transfer_ars", expectedSubmittedAt: T1, reason, ...patch });

beforeEach(() => {
  state.audits.length = 0;
  state.alerts.length = 0;
  state.notifications.length = 0;
  state.auditOk = true;
  state.tick = 0;
  boot();
});

describe("aprobar y rechazar: quién puede", () => {
  it("rechaza a quien no es admin ni superadmin, sin escribir nada", async () => {
    for (const actor of ["ricardo", "staff-1", "admin-baja", "desconocido"]) {
      expect(await approve(actor)).toEqual({ ok: false, error: "No tenés permiso para esta acción." });
      expect(await reject(actor)).toEqual({ ok: false, error: "No tenés permiso para esta acción." });
    }
    expect(writes()).toEqual([]);
    expect(state.audits).toEqual([]);
    expect(state.notifications).toEqual([]);
    expect(account()?.details).toBeNull();
  });

  it("admin y superadmin pueden", async () => {
    expect((await approve("super-1")).ok).toBe(true);
    expect(state.audits[0].actorRole).toBe("superadmin");
    boot();
    state.audits.length = 0;
    expect((await approve("admin-1")).ok).toBe(true);
    expect(state.audits[0].actorRole).toBe("admin");
  });
});

describe("aprobar", () => {
  it("copia lo pendiente a lo vigente, limpia lo pendiente y marca quién y cuándo", async () => {
    const res = await approve();
    expect(res).toEqual({ ok: true, methodKey: "transfer_ars", method: "Transferencia en pesos" });
    const row = account()!;
    expect(row).toMatchObject({ details: CBU, pending_details: null, pending_method_label: null, pending_submitted_at: null, approved_by_user_id: "admin-1" });
    expect(typeof row.approved_at).toBe("string");
    assertConstraints(accounts());
  });

  it("es condicional por lo que el admin vio: si el dueño cambió los datos, no aprueba nada", async () => {
    const stale = await approve("admin-1", { expectedSubmittedAt: "2026-11-21T09:00:00+00:00" });
    expect(stale).toEqual({ ok: false, error: STALE_ERROR });
    expect(writes()).toEqual([]);
    expect(account()?.details).toBeNull();
    expect(state.audits).toEqual([]);
  });

  it("si el dueño edita entre la lectura y la escritura, el UPDATE condicional no toca la fila", async () => {
    // Simula la carrera: la lectura devuelve la fila vigente, pero el dueño reescribe `pending_submitted_at` antes del UPDATE.
    const original = fake.client.from.bind(fake.client);
    let first = true;
    (fake.client as unknown as { from: (t: string) => unknown }).from = (table: string) => {
      const q = original(table) as { update: (p: Row) => unknown };
      if (table !== "residence_collection_accounts") return q;
      const update = q.update.bind(q);
      q.update = (payload: Row) => {
        if (first) {
          first = false;
          account()!.pending_submitted_at = "2026-11-21T10:05:00+00:00";
          account()!.pending_details = CBU_NUEVO;
        }
        return update(payload);
      };
      return q;
    };
    expect(await approve()).toEqual({ ok: false, error: STALE_ERROR });
    expect(account()).toMatchObject({ details: null, pending_details: CBU_NUEVO });
  });

  it("no aprueba un medio que ya no tiene cambios pendientes, ni uno que no existe", async () => {
    boot([pendingAccount({ pending_details: null, pending_submitted_at: null, details: CBU, approved_at: T1 })]);
    expect((await approve()).ok).toBe(false);
    expect(await approve("admin-1", { methodKey: "cash" })).toEqual({ ok: false, error: "No encontramos ese medio de cobro." });
    expect(await approve("admin-1", { methodKey: "inventado" })).toEqual({ ok: false, error: "No encontramos ese medio de cobro." });
  });

  it("un cambio posterior reemplaza lo vigente (rige lo nuevo, no lo viejo)", async () => {
    boot([pendingAccount({ details: CBU, approved_at: T1, pending_details: CBU_NUEVO })]);
    await approve();
    expect(account()).toMatchObject({ details: CBU_NUEVO, pending_details: null });
  });

  it("«Otro»: un cambio solo de nombre no pisa los datos aprobados", async () => {
    boot([pendingAccount({ method_key: "other", method_label: "Lemon", details: "usuario lemon", approved_at: T1, pending_details: null, pending_method_label: "Lemon Cash" })]);
    const res = await approve("admin-1", { methodKey: "other" });
    expect(res).toMatchObject({ ok: true, method: "Lemon Cash" });
    expect(account()).toMatchObject({ details: "usuario lemon", method_label: "Lemon Cash", pending_method_label: null, pending_submitted_at: null });
    assertConstraints(accounts());
  });

  it("«Otro» en primera carga: copia datos y nombre", async () => {
    boot([pendingAccount({ method_key: "other", pending_method_label: "Lemon", pending_details: "usuario lemon" })]);
    await approve("admin-1", { methodKey: "other" });
    expect(account()).toMatchObject({ details: "usuario lemon", method_label: "Lemon", pending_details: null });
    assertConstraints(accounts());
  });

  it("avisa al dueño (no al staff) y no incluye el dato de cobro", async () => {
    await approve();
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0]).toMatchObject({ userId: "ricardo", title: "Datos de cobro aprobados", relatedEntityType: "residence_collection_accounts", relatedEntityId: NORTE });
    expect(state.notifications[0].body).toContain("Transferencia en pesos");
    expect(JSON.stringify(state.notifications)).not.toContain("0170099220000067797370");
  });
});

describe("rechazar", () => {
  it("exige un motivo de al menos 10 caracteres y no toca nada sin él", async () => {
    for (const reason of [null, "", "   ", "corto", "x".repeat(301)]) {
      expect((await reject("admin-1", reason)).ok).toBe(false);
    }
    expect(writes()).toEqual([]);
    expect(account()?.pending_details).toBe(CBU);
  });

  it("con datos aprobados antes, limpia lo pendiente y siguen rigiendo los anteriores", async () => {
    boot([pendingAccount({ details: CBU, approved_at: T1, approved_by_user_id: "admin-1", pending_details: CBU_NUEVO })]);
    const res = await reject();
    expect(res.ok).toBe(true);
    expect(account()).toMatchObject({ details: CBU, pending_details: null, pending_method_label: null, pending_submitted_at: null });
    assertConstraints(accounts());
  });

  it("sin datos aprobados nunca, borra la fila: el medio queda «Sin datos» (y «Otro» no viola el CHECK de nombre)", async () => {
    boot([pendingAccount({ method_key: "other", pending_method_label: "Lemon", pending_details: "usuario lemon" })]);
    expect((await reject("admin-1", "No podemos aceptar billeteras sin titular.", { methodKey: "other" })).ok).toBe(true);
    expect(accounts()).toEqual([]);
    boot();
    await reject();
    expect(accounts()).toEqual([]);
  });

  it("es condicional por lo que el admin vio", async () => {
    expect(await reject("admin-1", "El alias no coincide con el titular.", { expectedSubmittedAt: "2026-11-21T09:00:00+00:00" })).toEqual({ ok: false, error: STALE_ERROR });
    expect(account()?.pending_details).toBe(CBU);
    expect(writes()).toEqual([]);
  });

  it("avisa al dueño sin el motivo ni el dato; el motivo queda en la auditoría", async () => {
    await reject("admin-1", "El alias no coincide con el titular.");
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0]).toMatchObject({ userId: "ricardo", title: "Datos de cobro rechazados" });
    expect(JSON.stringify(state.notifications)).not.toContain("0170099220000067797370");
    expect(state.audits[0]).toMatchObject({ action: "residence_collection_account_rejected", reasonText: "El alias no coincide con el titular.", source: "admin" });
  });
});

describe("auditoría enmascarada", () => {
  it("aprobar y rechazar no dejan el CBU ni el alias completos (viejo ni nuevo) en la auditoría ni en los avisos", async () => {
    boot([pendingAccount({ details: CBU, approved_at: T1, pending_details: CBU_NUEVO })]);
    await approve();
    boot([pendingAccount({ details: CBU, approved_at: T1, pending_details: CBU_NUEVO })]);
    await reject();
    const all = JSON.stringify({ a: state.audits, n: state.notifications });
    for (const secret of ["0170099220000067797370", "casa.norte", "0140999999999999999999", "casa.nueva"]) expect(all).not.toContain(secret);
    expect(all).toContain("•••• ");
    expect(state.audits.map((a) => a.action)).toEqual(["residence_collection_account_approved", "residence_collection_account_rejected"]);
  });

  it("un dato corto (4 caracteres o menos) no aparece ni enmascarado", async () => {
    boot([pendingAccount({ pending_details: "ab12" })]);
    await approve();
    expect(JSON.stringify(state.audits)).not.toContain("ab12");
  });

  it("si la auditoría falla, la operación queda hecha y se avisa a los admin", async () => {
    state.auditOk = false;
    const res = await approve();
    expect(res.ok).toBe(true);
    expect(account()?.details).toBe(CBU);
    expect(state.alerts).toEqual([{ action: "residence_collection_account_approved", entityType: "residences", entityId: NORTE }]);
  });
});

describe("lo que ve el dueño después de la revisión", () => {
  const owner = async () => {
    const res = await loadCollectionAccountsForOwner(fake.client, NORTE);
    if (!res.ok || !res.ready) throw new Error("lectura del dueño falló");
    return res.accounts;
  };

  it("tras aprobar el estado es «Aprobado»", async () => {
    await approve();
    expect((await owner())[0]).toMatchObject({ methodKey: "transfer_ars", state: "approved", details: CBU, pendingDetails: null, rejectedReason: null });
  });

  it("tras rechazar un medio con datos aprobados: «Rechazado» con el motivo, y siguen los datos vigentes", async () => {
    boot([pendingAccount({ details: CBU, approved_at: T1, pending_details: CBU_NUEVO })]);
    await reject("admin-1", "El alias no coincide con el titular.");
    expect((await owner())[0]).toMatchObject({ state: "rejected", details: CBU, rejectedReason: "El alias no coincide con el titular." });
  });

  it("tras rechazar una primera carga (fila borrada) el medio igual aparece «Rechazado» con el motivo", async () => {
    await reject("admin-1", "Falta el nombre del titular de la cuenta.");
    expect(accounts()).toEqual([]);
    expect(await owner()).toEqual([expect.objectContaining({ methodKey: "transfer_ars", state: "rejected", details: null, rejectedReason: "Falta el nombre del titular de la cuenta." })]);
  });

  it("si el dueño vuelve a enviar después del rechazo, el medio pasa a «Pendiente» y el motivo viejo deja de mostrarse", async () => {
    boot([pendingAccount({ details: CBU, approved_at: T1, pending_details: CBU_NUEVO })]);
    await reject("admin-1", "El alias no coincide con el titular.");
    const saved = await saveReservationCollection(fake.client, {
      actorUserId: "ricardo",
      residenceId: NORTE,
      modes: ["enabled_methods"],
      methods: ["transfer_ars"],
      accounts: { transfer_ars: { details: "CBU 0140999999999999999999 alias casa.corregida" } },
    });
    expect(saved.ok).toBe(true);
    expect((await owner())[0]).toMatchObject({ state: "pending", rejectedReason: null });
  });

  it("si el dueño guarda sin cambiar nada tras un rechazo, el rechazo sigue visible (no hubo ningún cambio nuevo)", async () => {
    boot([pendingAccount({ details: CBU, approved_at: T1, pending_details: CBU_NUEVO })]);
    await reject("admin-1", "El alias no coincide con el titular.");
    await saveReservationCollection(fake.client, {
      actorUserId: "ricardo",
      residenceId: NORTE,
      modes: ["enabled_methods"],
      methods: ["transfer_ars"],
      // Mismo valor aprobado: no hay nada que aprobar ni se escribe nada.
      accounts: { transfer_ars: { details: CBU } },
    });
    expect((await owner())[0]).toMatchObject({ state: "rejected", rejectedReason: "El alias no coincide con el titular." });
  });
});

describe("cola: agrupar por residencia", () => {
  it("agrupa, cuenta y ordena por la espera más larga", () => {
    const rows = [
      { residence_id: "b", pending_submitted_at: "2026-11-20T10:00:00Z" },
      { residence_id: "a", pending_submitted_at: "2026-11-19T10:00:00Z" },
      { residence_id: "b", pending_submitted_at: "2026-11-18T10:00:00Z" },
      { residence_id: "fantasma", pending_submitted_at: "2026-11-01T10:00:00Z" },
    ];
    const info = new Map([
      ["a", { name: "Alfa", public_area: "Palermo", status: "verified_active" }],
      ["b", { name: "Beta", public_area: null, status: "draft" }],
    ]);
    expect(groupPendingByResidence(rows, info)).toEqual([
      { residenceId: "b", name: "Beta", publicArea: null, status: "draft", pendingCount: 2, oldestSubmittedAt: "2026-11-18T10:00:00Z" },
      { residenceId: "a", name: "Alfa", publicArea: "Palermo", status: "verified_active", pendingCount: 1, oldestSubmittedAt: "2026-11-19T10:00:00Z" },
    ]);
  });
});
