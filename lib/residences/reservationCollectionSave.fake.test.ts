import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
type AuditEntry = { actorUserId: string | null; actorRole: string; action: string; oldValue?: unknown; newValue?: unknown };
const audits = vi.hoisted(() => [] as AuditEntry[]);
const adminNotices = vi.hoisted(() => [] as { title: string; body: string; entityType: string; entityId: string }[]);
vi.mock("@/lib/audit", () => ({
  createAuditLog: async (_admin: unknown, entry: AuditEntry) => {
    audits.push(entry);
    return true;
  },
  alertAdminsOfAuditFailure: async () => undefined,
  notifyAdmins: async (_admin: unknown, n: { title: string; body: string; entityType: string; entityId: string }) => {
    adminNotices.push(n);
  },
}));
const notifications = vi.hoisted(() => [] as { userId: string; title: string; body: string }[]);
vi.mock("@/lib/notifications/createNotification", () => ({
  createNotification: async (_admin: unknown, n: { userId: string; title: string; body: string }) => {
    notifications.push(n);
  },
}));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { OWNER_ONLY_MESSAGE, ownerPermissions, permissionsFromChecked } from "@/lib/residences/permissions";
import { loadCollectionAccountsForOwner, loadCollectionOverview } from "@/lib/residences/reservationCollectionDb";
import { saveReservationCollection } from "@/lib/residences/reservationCollectionSave";

/**
 * DR63 fase 2a — «Cobro de la reserva»: SOLO el dueño guarda; los datos de cobro van SIEMPRE a `pending_*` (nunca a `details` ni a
 * `method_label`); la auditoría los enmascara; la degradación sin la migración 0102 no rompe.
 */
const NORTE = "res-norte";
const RIO = "res-rio";

function world(extra: Record<string, Row[]> = {}): Record<string, Row[]> {
  return {
    residences: [
      { id: NORTE, reservation_payment_modes: null, accepted_payment_methods: null },
      { id: RIO, reservation_payment_modes: null, accepted_payment_methods: null },
    ],
    residence_collection_accounts: [],
    residence_users: [
      { id: "ru-owner", residence_id: NORTE, user_id: "ricardo", role: "owner", is_active: true },
      // Staff con TODOS los permisos delegables (incluido `profile.edit`): igual no puede.
      { id: "ru-all", residence_id: NORTE, user_id: "staff-todo", role: "staff", is_active: true, permissions: ownerPermissions() },
      { id: "ru-ro", residence_id: NORTE, user_id: "staff-lectura", role: "staff", is_active: true, permissions: permissionsFromChecked([]) },
      // Dueño de OTRA residencia: no vale en Norte.
      { id: "ru-owner-rio", residence_id: RIO, user_id: "otra-duena", role: "owner", is_active: true },
    ],
    ...extra,
  };
}

let fake: ReturnType<typeof createInMemorySupabase>;
const writes = () => fake.log.filter((l) => l.op !== "select");
const accountsOf = (residenceId: string) => fake.tables.residence_collection_accounts.filter((r) => r.residence_id === residenceId);
const residence = (id: string) => fake.tables.residences.find((r) => r.id === id)!;
const save = (actor: string, patch: Partial<Parameters<typeof saveReservationCollection>[1]> = {}) =>
  saveReservationCollection(fake.client, {
    actorUserId: actor,
    residenceId: NORTE,
    modes: ["enabled_methods"],
    methods: ["transfer_ars"],
    accounts: { transfer_ars: { details: "CBU 0170099220000067797370 alias casa.norte" } },
    ...patch,
  });

beforeEach(() => {
  audits.length = 0;
  adminNotices.length = 0;
  notifications.length = 0;
  fake = createInMemorySupabase(world());
});

describe("saveReservationCollection: quién puede", () => {
  it("rechaza al staff, aunque tenga profile.edit, sin escribir nada", async () => {
    for (const actor of ["staff-todo", "staff-lectura"]) {
      const res = await save(actor);
      expect(res).toEqual({ ok: false, error: OWNER_ONLY_MESSAGE });
    }
    expect(writes()).toEqual([]);
    expect(audits).toEqual([]);
  });

  it("rechaza a quien no tiene vínculo, y al dueño de otra residencia", async () => {
    expect((await save("desconocido")).ok).toBe(false);
    expect((await save("otra-duena")).ok).toBe(false);
    expect(writes()).toEqual([]);
  });

  it("el dueño guarda", async () => {
    const res = await save("ricardo");
    expect(res).toEqual({ ok: true, modes: ["enabled_methods"], methods: ["transfer_ars"], pendingChanges: 1 });
    expect(residence(NORTE).reservation_payment_modes).toEqual(["enabled_methods"]);
    expect(residence(NORTE).accepted_payment_methods).toEqual(["transfer_ars"]);
    // No toca la otra residencia.
    expect(residence(RIO).reservation_payment_modes).toBeNull();
  });
});

describe("saveReservationCollection: los datos van SIEMPRE a pending_*", () => {
  it("la primera carga escribe solo pending_details y pending_submitted_at; details y method_label quedan nulos", async () => {
    await save("ricardo");
    const [row] = accountsOf(NORTE);
    expect(row.method_key).toBe("transfer_ars");
    expect(row.pending_details).toBe("CBU 0170099220000067797370 alias casa.norte");
    expect(row.pending_submitted_at).toEqual(expect.any(String));
    expect(row.updated_by_user_id).toBe("ricardo");
    expect(row.details ?? null).toBeNull();
    expect(row.method_label ?? null).toBeNull();
    // Ninguna escritura incluye details ni method_label.
    for (const w of writes().filter((l) => l.table === "residence_collection_accounts")) {
      const payload = w.payload as Row;
      expect("details" in payload).toBe(false);
      expect("method_label" in payload).toBe(false);
    }
  });

  it("editar datos ya aprobados deja los aprobados intactos y suma el cambio pendiente", async () => {
    fake = createInMemorySupabase(
      world({
        residence_collection_accounts: [
          { id: "acc-1", residence_id: NORTE, method_key: "transfer_ars", details: "CBU viejo aprobado", method_label: null, pending_details: null, pending_method_label: null, approved_at: "2026-11-01T00:00:00Z" },
        ],
      }),
    );
    const res = await save("ricardo", { accounts: { transfer_ars: { details: "CBU nuevo" } } });
    expect(res.ok).toBe(true);
    const row = accountsOf(NORTE)[0];
    expect(row.details).toBe("CBU viejo aprobado");
    expect(row.pending_details).toBe("CBU nuevo");
    expect(row.pending_submitted_at).toEqual(expect.any(String));
  });

  it("volver al valor aprobado limpia el cambio pendiente", async () => {
    fake = createInMemorySupabase(
      world({
        residence_collection_accounts: [
          { id: "acc-1", residence_id: NORTE, method_key: "transfer_ars", details: "CBU aprobado", pending_details: "CBU a medias", pending_submitted_at: "2026-11-02T00:00:00Z", approved_at: "2026-11-01T00:00:00Z" },
        ],
      }),
    );
    const res = await save("ricardo", { accounts: { transfer_ars: { details: "CBU aprobado" } } });
    expect(res).toMatchObject({ ok: true, pendingChanges: 0 });
    const row = accountsOf(NORTE)[0];
    expect(row.details).toBe("CBU aprobado");
    expect(row.pending_details).toBeNull();
    expect(row.pending_submitted_at).toBeNull();
    expect(notifications).toEqual([]);
  });

  it("guardar de nuevo lo mismo no escribe la cuenta ni avisa de nuevo", async () => {
    await save("ricardo");
    fake.log.length = 0;
    audits.length = 0;
    notifications.length = 0;
    const res = await save("ricardo");
    expect(res).toMatchObject({ ok: true, pendingChanges: 0 });
    expect(writes().filter((l) => l.table === "residence_collection_accounts")).toEqual([]);
    expect(audits).toEqual([]);
    expect(notifications).toEqual([]);
  });

  it("un medio que ya tiene datos no obliga a mandarlos otra vez", async () => {
    await save("ricardo");
    const res = await save("ricardo", { accounts: {} });
    expect(res).toMatchObject({ ok: true, pendingChanges: 0 });
  });

  it("«Otro» guarda el nombre en pending_method_label", async () => {
    const res = await save("ricardo", { methods: ["other"], accounts: { other: { details: "Cuenta DNI: casa.norte", label: "  Cuenta DNI " } } });
    expect(res.ok).toBe(true);
    const row = accountsOf(NORTE)[0];
    expect(row.pending_method_label).toBe("Cuenta DNI");
    expect(row.method_label ?? null).toBeNull();
    expect(row.pending_details).toBe("Cuenta DNI: casa.norte");
  });
});

describe("saveReservationCollection: validación", () => {
  const cases: [string, Partial<Parameters<typeof saveReservationCollection>[1]>][] = [
    ["sin ninguna opción", { modes: [] }],
    ["opción inexistente", { modes: ["otra"] }],
    ["medios habilitados sin ningún medio", { methods: [] }],
    ["clave fuera del catálogo", { methods: ["bitcoin"], accounts: {} }],
    ["medio repetido", { methods: ["cash", "cash"], accounts: { cash: { details: "x" } } }],
    ["medio aceptado sin datos", { accounts: {} }],
    ["datos vacíos", { accounts: { transfer_ars: { details: "   " } } }],
    ["datos de más de 500 caracteres", { accounts: { transfer_ars: { details: "x".repeat(501) } } }],
    ["«Otro» sin nombre", { methods: ["other"], accounts: { other: { details: "datos" } } }],
    ["«Otro» con nombre de una letra", { methods: ["other"], accounts: { other: { details: "datos", label: "a" } } }],
    ["«Otro» con salto de línea en el nombre", { methods: ["other"], accounts: { other: { details: "datos", label: "Cuenta\nDNI" } } }],
    ["datos con forma inválida", { accounts: { transfer_ars: "texto" } }],
    ["accounts que no es un objeto", { accounts: ["x"] }],
  ];
  for (const [name, patch] of cases) {
    it(`rechaza ${name} y no escribe nada`, async () => {
      const res = await save("ricardo", patch);
      expect(res.ok).toBe(false);
      expect(writes()).toEqual([]);
    });
  }

  it("un error en UN medio frena el guardado de TODOS", async () => {
    const res = await save("ricardo", { methods: ["cash", "belo"], accounts: { cash: { details: "En el hall" } } });
    expect(res.ok).toBe(false);
    expect(writes()).toEqual([]);
    expect(accountsOf(NORTE)).toEqual([]);
  });

  it("solo contacto directo guarda sin datos y deja 0 medios aceptados", async () => {
    fake = createInMemorySupabase(world({ residences: [{ id: NORTE, reservation_payment_modes: ["enabled_methods"], accepted_payment_methods: ["cash"] }, { id: RIO }] }));
    const res = await save("ricardo", { modes: ["whatsapp_direct"], methods: ["cash"], accounts: {} });
    expect(res).toEqual({ ok: true, modes: ["whatsapp_direct"], methods: [], pendingChanges: 0 });
    expect(residence(NORTE).reservation_payment_modes).toEqual(["whatsapp_direct"]);
    expect(residence(NORTE).accepted_payment_methods).toEqual([]);
  });

  it("ambas opciones a la vez", async () => {
    const res = await save("ricardo", { modes: ["whatsapp_direct", "enabled_methods"] });
    expect(res).toMatchObject({ ok: true, modes: ["enabled_methods", "whatsapp_direct"] });
  });

  it("quitar un medio conserva su fila de datos", async () => {
    await save("ricardo", { methods: ["cash", "transfer_ars"], accounts: { cash: { details: "En el hall" }, transfer_ars: { details: "alias.casa" } } });
    await save("ricardo", { methods: ["cash"], accounts: {} });
    expect(accountsOf(NORTE).map((r) => r.method_key).sort()).toEqual(["cash", "transfer_ars"]);
    expect(residence(NORTE).accepted_payment_methods).toEqual(["cash"]);
  });
});

describe("saveReservationCollection: auditoría y aviso", () => {
  it("audita con los datos de cobro enmascarados y con el rol del dueño", async () => {
    await save("ricardo", { accounts: { transfer_ars: { details: "CBU 0170099220000067797370 alias casa.norte" } } });
    expect(audits.map((a) => a.action).sort()).toEqual(["residence_collection_account_pending", "residence_reservation_collection_updated"]);
    expect(audits.every((a) => a.actorRole === "residence_owner" && a.actorUserId === "ricardo")).toBe(true);
    const serialized = JSON.stringify(audits);
    expect(serialized).not.toContain("0170099220000067797370");
    expect(serialized).not.toContain("casa.norte");
    expect(serialized).toContain("•••• ");
  });

  it("avisa al dueño sin ningún dato de cobro", async () => {
    await save("ricardo");
    expect(notifications).toHaveLength(1);
    expect(notifications[0].userId).toBe("ricardo");
    expect(notifications[0].body).toContain("Transferencia en pesos");
    expect(JSON.stringify(notifications)).not.toContain("0170099220000067797370");
  });

  it("avisa a los admin que hay datos por aprobar, sin datos de cobro, y no los avisa si no hay nada pendiente", async () => {
    await save("ricardo");
    expect(adminNotices).toHaveLength(1);
    expect(adminNotices[0]).toMatchObject({ title: "Hay datos de cobro pendientes de aprobación", entityType: "residence_collection_accounts", entityId: NORTE });
    expect(adminNotices[0].body).toContain("1 medio");
    expect(JSON.stringify(adminNotices)).not.toContain("0170099220000067797370");
    adminNotices.length = 0;
    // Mismo valor otra vez: nada pendiente nuevo, ningún aviso.
    await save("ricardo");
    expect(adminNotices).toEqual([]);
  });

  it("un dato corto no se muestra ni enmascarado en la auditoría", async () => {
    await save("ricardo", { methods: ["belo"], accounts: { belo: { details: "ab12" } } });
    expect(JSON.stringify(audits)).not.toContain("ab12");
  });
});

describe("lecturas de «Cobro de la reserva»", () => {
  it("el resumen del requisito no trae datos de cobro, solo claves y estados", async () => {
    await save("ricardo", { methods: ["cash", "belo"], accounts: { cash: { details: "En el hall" }, belo: { details: "usuario belo" } } });
    const res = await loadCollectionOverview(fake.client, NORTE);
    expect(res.ok && res.overview?.config).toEqual({
      modes: ["enabled_methods"],
      acceptedMethods: ["cash", "belo"],
      methodsWithData: expect.arrayContaining(["cash", "belo"]),
    });
    expect(res.ok && res.overview?.summary.states).toEqual({ cash: "pending", belo: "pending" });
    expect(JSON.stringify(res)).not.toContain("En el hall");
    expect(JSON.stringify(res)).not.toContain("usuario belo");
  });

  it("la lectura del dueño trae los datos para editarlos", async () => {
    await save("ricardo");
    const res = await loadCollectionAccountsForOwner(fake.client, NORTE);
    expect(res.ok && res.ready && res.accounts[0]).toMatchObject({ methodKey: "transfer_ars", state: "pending", pendingDetails: expect.stringContaining("alias casa.norte") });
  });

  it("sin la migración 0102 (columnas o tabla inexistentes) se degrada a «no disponible» y no rompe", async () => {
    const noColumns = createInMemorySupabase(world(), { missingColumns: { residences: ["reservation_payment_modes"] } });
    expect(await loadCollectionOverview(noColumns.client, NORTE)).toEqual({ ok: true, overview: null });
    const noTable = createInMemorySupabase(world(), { missingTables: ["residence_collection_accounts"] });
    expect(await loadCollectionOverview(noTable.client, NORTE)).toEqual({ ok: true, overview: null });
    expect(await loadCollectionAccountsForOwner(noTable.client, NORTE)).toEqual({ ok: true, ready: false });
    const res = await saveReservationCollection(noTable.client, { actorUserId: "ricardo", residenceId: NORTE, modes: ["whatsapp_direct"], methods: [], accounts: {} });
    expect(res.ok).toBe(false);
  });

  it("«Otro» solo cuenta con datos cuando tiene nombre", async () => {
    fake = createInMemorySupabase(
      world({
        residences: [{ id: NORTE, reservation_payment_modes: ["enabled_methods"], accepted_payment_methods: ["other"] }],
        residence_collection_accounts: [{ id: "a", residence_id: NORTE, method_key: "other", pending_details: "datos", pending_method_label: null, method_label: null }],
      }),
    );
    const res = await loadCollectionOverview(fake.client, NORTE);
    expect(res.ok && res.overview?.config.methodsWithData).toEqual([]);
  });
});
