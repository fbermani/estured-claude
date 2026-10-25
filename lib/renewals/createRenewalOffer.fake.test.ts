import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/audit", () => ({ createAuditLog: async () => true }));
vi.mock("@/lib/exchange/rate", () => ({ getCurrentExchangeRate: async () => ({ arsPerUsd: 1500 }) }));

import { createRenewalOffer, RENEWAL_CONDITIONS_PERMISSION_MESSAGE } from "@/lib/renewals/createRenewalOffer";
import { permissionsFromChecked } from "@/lib/residences/permissions";
import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";

/**
 * IDOR en `createRenewalOffer` (Ciclo 73, seguridad M3): `renewalRequestId` viaja del cliente. Una solicitud ajena, de otra reserva o ya
 * resuelta se rechaza y no se crea ninguna oferta ni se toca esa solicitud. Cliente en memoria (sin base real).
 */
const RES_A = "res-a";
const RES_B = "res-b";

function world(): Record<string, Row[]> {
  return {
    reservations: [
      { id: "rsv-a", status: "confirmed", student_profile_id: "stu-a", residence_id: RES_A, snapshot_id: "snap-a" },
      { id: "rsv-b", status: "confirmed", student_profile_id: "stu-b", residence_id: RES_B },
    ],
    residence_users: [
      { id: "ru1", residence_id: RES_A, user_id: "owner-a", role: "owner", is_active: true },
      { id: "ru2", residence_id: RES_A, user_id: "staff-a", role: "staff", is_active: true, permissions: permissionsFromChecked(["renewals.manage"]) },
    ],
    renewal_requests: [
      { id: "rr-a", reservation_id: "rsv-a", residence_id: RES_A, status: "notified_to_residence" },
      { id: "rr-a-new", reservation_id: "rsv-a", residence_id: RES_A, status: "created_by_student" },
      { id: "rr-b", reservation_id: "rsv-b", residence_id: RES_B, status: "notified_to_residence" },
      { id: "rr-closed", reservation_id: "rsv-a", residence_id: RES_A, status: "closed_no_offer" },
      { id: "rr-done", reservation_id: "rsv-a", residence_id: RES_A, status: "offer_received" },
      { id: "rr-sup", reservation_id: "rsv-a", residence_id: RES_A, status: "superseded_by_offer" },
    ],
    renewal_offers: [],
    // Condiciones vigentes de la reserva rsv-a (snapshot de la solicitud): tarifa 300, sin matrícula, depósito 200.
    application_snapshots: [{ id: "snap-a", monthly_price_usd: 300, enrollment_fee_usd: null, deposit_usd: 200 }],
  };
}

const base = {
  reservationId: "rsv-a",
  actorUserId: "owner-a",
  periodStartDate: "2027-03-01",
  durationMonths: 6,
  monthlyPriceUsd: 300,
  enrollmentOrRenewalFeeUsd: null,
  depositUsd: null,
  adjustmentPolicy: "none",
  acceptanceDeadlineAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  sendNow: true,
};

let fake: ReturnType<typeof createInMemorySupabase>;
beforeEach(() => {
  fake = createInMemorySupabase(world());
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const statusOf = (id: string) => fake.tables.renewal_requests.find((r) => r.id === id)?.status;

describe("createRenewalOffer: renewalRequestId validado en el servidor", () => {
  it("una solicitud abierta de ESTA reserva pasa y queda en offer_received", async () => {
    const r = await createRenewalOffer(fake.client, { ...base, renewalRequestId: "rr-a" });
    expect(r.ok).toBe(true);
    expect(fake.tables.renewal_offers).toHaveLength(1);
    expect(fake.tables.renewal_offers[0]).toMatchObject({ renewal_request_id: "rr-a", reservation_id: "rsv-a" });
    expect(statusOf("rr-a")).toBe("offer_received");
    expect(statusOf("rr-b")).toBe("notified_to_residence");
  });

  it("también acepta una solicitud recién creada por el estudiante", async () => {
    expect((await createRenewalOffer(fake.client, { ...base, renewalRequestId: "rr-a-new" })).ok).toBe(true);
  });

  it("la solicitud de OTRA reserva (otra residencia) se rechaza y no se toca", async () => {
    const r = await createRenewalOffer(fake.client, { ...base, renewalRequestId: "rr-b" });
    expect(r.ok).toBe(false);
    expect(fake.tables.renewal_offers).toHaveLength(0);
    expect(statusOf("rr-b")).toBe("notified_to_residence");
  });

  it("una solicitud inexistente se rechaza", async () => {
    const r = await createRenewalOffer(fake.client, { ...base, renewalRequestId: "no-existe" });
    expect(r.ok).toBe(false);
    expect(fake.tables.renewal_offers).toHaveLength(0);
  });

  it("solicitudes ya resueltas (cerrada sin oferta, con oferta recibida, reemplazada) se rechazan y no cambian de estado", async () => {
    for (const id of ["rr-closed", "rr-done", "rr-sup"]) {
      const before = statusOf(id);
      const r = await createRenewalOffer(fake.client, { ...base, renewalRequestId: id });
      expect(r.ok, id).toBe(false);
      expect(statusOf(id), id).toBe(before);
    }
    expect(fake.tables.renewal_offers).toHaveLength(0);
  });

  it("también se valida cuando la oferta se guarda como borrador (sendNow: false)", async () => {
    const r = await createRenewalOffer(fake.client, { ...base, renewalRequestId: "rr-b", sendNow: false });
    expect(r.ok).toBe(false);
    expect(fake.tables.renewal_offers).toHaveLength(0);
  });

  it("sin solicitud asociada (null) sigue andando", async () => {
    const r = await createRenewalOffer(fake.client, { ...base, renewalRequestId: null });
    expect(r.ok).toBe(true);
  });

  it("si la solicitud cambia de estado entre el chequeo y el update, se deshace la oferta recién creada", async () => {
    // Simula la carrera: la solicitud pasa a cerrada justo después de la lectura (el UPDATE condicional ya no la encuentra).
    const client = fake.client;
    const realFrom = client.from.bind(client);
    let reads = 0;
    (client as unknown as { from: (t: string) => unknown }).from = (table: string) => {
      const q = realFrom(table) as unknown as { maybeSingle: () => unknown };
      if (table === "renewal_requests") {
        const original = q.maybeSingle.bind(q);
        q.maybeSingle = () => {
          reads += 1;
          const out = original();
          fake.tables.renewal_requests.find((r) => r.id === "rr-a")!.status = "closed_no_offer";
          return out;
        };
      }
      return q;
    };
    const r = await createRenewalOffer(client, { ...base, renewalRequestId: "rr-a" });
    expect(reads).toBe(1);
    expect(r.ok).toBe(false);
    expect(fake.tables.renewal_offers).toHaveLength(0);
  });

  it("el staff de la residencia también puede, y una cuenta ajena no", async () => {
    expect((await createRenewalOffer(fake.client, { ...base, actorUserId: "staff-a", renewalRequestId: "rr-a" })).ok).toBe(true);
    const fresh = createInMemorySupabase(world());
    const r = await createRenewalOffer(fresh.client, { ...base, actorUserId: "intruso", renewalRequestId: "rr-a" });
    expect(r).toEqual({ ok: false, error: "No tenés acceso a esta residencia." });
  });
});

describe("createRenewalOffer: cambiar precio, matrícula o depósito exige además applications.send_adjustment (Ciclo 74, revisión)", () => {
  const staff = (permissions: string[]) =>
    createInMemorySupabase({
      ...world(),
      residence_users: [
        { id: "ru1", residence_id: RES_A, user_id: "owner-a", role: "owner", is_active: true },
        { id: "ru2", residence_id: RES_A, user_id: "staff-a", role: "staff", is_active: true, permissions: permissionsFromChecked(permissions) },
      ],
    });
  const asStaff = { ...base, actorUserId: "staff-a", renewalRequestId: null };

  it("staff con solo renewals.manage: una oferta que MANTIENE las condiciones vigentes pasa (con o sin depósito igual al vigente)", async () => {
    for (const patch of [{}, { depositUsd: 200 }, { depositUsd: null, enrollmentOrRenewalFeeUsd: null }]) {
      const f = staff(["renewals.manage"]);
      const r = await createRenewalOffer(f.client, { ...asStaff, ...patch });
      expect(r.ok, JSON.stringify(patch)).toBe(true);
      expect(f.tables.renewal_offers).toHaveLength(1);
    }
  });

  it("staff con solo renewals.manage: otro precio (más alto o más bajo) se rechaza y no crea nada", async () => {
    for (const monthlyPriceUsd of [450, 150, 300.5]) {
      const f = staff(["renewals.manage"]);
      const r = await createRenewalOffer(f.client, { ...asStaff, monthlyPriceUsd });
      expect(r, String(monthlyPriceUsd)).toEqual({ ok: false, error: RENEWAL_CONDITIONS_PERMISSION_MESSAGE });
      expect(f.tables.renewal_offers).toHaveLength(0);
    }
  });

  it("staff con solo renewals.manage: una matrícula o un depósito distintos del vigente se rechazan", async () => {
    for (const patch of [{ enrollmentOrRenewalFeeUsd: 100 }, { depositUsd: 900 }]) {
      const f = staff(["renewals.manage"]);
      const r = await createRenewalOffer(f.client, { ...asStaff, ...patch });
      expect(r, JSON.stringify(patch)).toEqual({ ok: false, error: RENEWAL_CONDITIONS_PERMISSION_MESSAGE });
      expect(f.tables.renewal_offers).toHaveLength(0);
    }
  });

  it("staff con renewals.manage Y applications.send_adjustment puede cambiar las condiciones", async () => {
    const f = staff(["renewals.manage", "applications.send_adjustment"]);
    const r = await createRenewalOffer(f.client, { ...asStaff, monthlyPriceUsd: 450, depositUsd: 900, enrollmentOrRenewalFeeUsd: 100 });
    expect(r.ok).toBe(true);
    expect(f.tables.renewal_offers[0]).toMatchObject({ monthly_price_usd: 450, deposit_usd: 900 });
  });

  it("staff con solo send_adjustment (sin renewals.manage) no puede crear ofertas, ni siquiera iguales a las vigentes", async () => {
    const f = staff(["applications.send_adjustment"]);
    const r = await createRenewalOffer(f.client, asStaff);
    expect(r.ok).toBe(false);
    expect(f.tables.renewal_offers).toHaveLength(0);
  });

  it("el dueño puede cambiar las condiciones sin ningún chequeo extra", async () => {
    const f = staff([]);
    expect((await createRenewalOffer(f.client, { ...base, renewalRequestId: null, monthlyPriceUsd: 999 })).ok).toBe(true);
  });

  it("falla cerrado: si no se pueden leer las condiciones vigentes (reserva sin snapshot), el staff sin send_adjustment no puede ofrecer", async () => {
    const w = world();
    w.reservations[0].snapshot_id = null;
    const f = createInMemorySupabase({
      ...w,
      residence_users: [{ id: "ru2", residence_id: RES_A, user_id: "staff-a", role: "staff", is_active: true, permissions: permissionsFromChecked(["renewals.manage"]) }],
    });
    expect(await createRenewalOffer(f.client, asStaff)).toEqual({ ok: false, error: RENEWAL_CONDITIONS_PERMISSION_MESSAGE });
  });
});
