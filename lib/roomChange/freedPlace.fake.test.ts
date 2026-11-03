import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const teamEvents = vi.hoisted(() => [] as { event: string; entityId: string }[]);
vi.mock("@/lib/residences/notifyResidenceTeam", () => ({
  notifyResidenceTeam: async (_a: unknown, p: { event: string; entityId: string }) => {
    teamEvents.push({ event: p.event, entityId: p.entityId });
  },
}));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { closeRequestsOnStayEnded, onStayMovedToBed, registerFreedPlace } from "@/lib/roomChange/freedPlace";

const R = "res-1";
const TYPE = "type-doble";
const OTHER_TYPE = "type-simple";

function world(extra: Partial<Record<string, Row[]>> = {}): Record<string, Row[]> {
  return {
    room_types: [
      { id: TYPE, residence_id: R, name: "Doble", gender_policy: "solo_mujeres" },
      { id: OTHER_TYPE, residence_id: R, name: "Simple", gender_policy: null },
    ],
    room_change_requests: [],
    room_change_place_alerts: [],
    ...extra,
  } as Record<string, Row[]>;
}
const pending = (extra: Row = {}): Row => ({ id: "rq1", residence_id: R, resident_stay_id: "stay-b", status: "pending", preferred_room_type_id: null, preferred_gender: null, ...extra });

beforeEach(() => {
  teamEvents.length = 0;
});

describe("registerFreedPlace", () => {
  it("sin pedidos pendientes no retiene nada: la plaza sigue el camino de antes", async () => {
    const { client, tables } = createInMemorySupabase(world());
    expect(await registerFreedPlace(client, { residenceId: R, source: "stay_ended", roomTypeId: TYPE, deferredIncrement: true })).toEqual({ held: false });
    expect(tables.room_change_place_alerts).toHaveLength(0);
    expect(teamEvents).toHaveLength(0);
  });

  it("con un pedido que coincide crea el aviso (con el +1 diferido), avisa al equipo y retiene la plaza", async () => {
    const { client, tables } = createInMemorySupabase(world({ room_change_requests: [pending({ preferred_room_type_id: TYPE, preferred_gender: "femenino" })] }));
    const r = await registerFreedPlace(client, { residenceId: R, source: "stay_ended", roomTypeId: TYPE, freedByStayId: "stay-a", deferredIncrement: true });
    expect(r.held).toBe(true);
    expect(tables.room_change_place_alerts[0]).toMatchObject({
      residence_id: R,
      room_type_id: TYPE,
      gender: "femenino",
      source: "stay_ended",
      status: "pending",
      deferred_increment: true,
      freed_by_stay_id: "stay-a",
    });
    expect(teamEvents).toEqual([{ event: "room_change_place_matched", entityId: r.alertId }]);
  });

  it("no retiene si el pedido es de otro tipo, de otro género o es de quien dejó la plaza", async () => {
    const { client } = createInMemorySupabase(
      world({ room_change_requests: [pending({ preferred_room_type_id: OTHER_TYPE }), pending({ id: "rq2", resident_stay_id: "stay-c", preferred_gender: "masculino" }), pending({ id: "rq3", resident_stay_id: "stay-a" })] }),
    );
    expect((await registerFreedPlace(client, { residenceId: R, source: "stay_ended", roomTypeId: TYPE, freedByStayId: "stay-a", deferredIncrement: true })).held).toBe(false);
  });

  it("un pedido ya en gestión no dispara aviso", async () => {
    const { client } = createInMemorySupabase(world({ room_change_requests: [pending({ status: "offered" })] }));
    expect((await registerFreedPlace(client, { residenceId: R, source: "stay_ended", roomTypeId: TYPE })).held).toBe(false);
  });

  it("sin la migración 0076 (o ante un error) nunca lanza ni retiene", async () => {
    const { client } = createInMemorySupabase(world(), { missingTables: ["room_change_requests", "room_change_place_alerts"] });
    expect(await registerFreedPlace(client, { residenceId: R, source: "stay_ended", roomTypeId: TYPE, deferredIncrement: true })).toEqual({ held: false });
  });

  it("si el aviso no se puede guardar, no retiene (la plaza se publica como siempre)", async () => {
    const { client } = createInMemorySupabase(world({ room_change_requests: [pending()] }), { failInsert: { room_change_place_alerts: { code: "XX000", message: "boom" } } });
    expect((await registerFreedPlace(client, { residenceId: R, source: "stay_ended", roomTypeId: TYPE })).held).toBe(false);
    expect(teamEvents).toHaveLength(0);
  });
});

describe("onStayMovedToBed y closeRequestsOnStayEnded", () => {
  it("si le habían ofrecido justo esa cama, el pedido y el aviso quedan resueltos", async () => {
    const { client, tables } = createInMemorySupabase(
      world({
        room_change_requests: [pending({ id: "rq1", resident_stay_id: "stay-a", status: "offered", offered_bed_id: "bed-9" })],
        room_change_place_alerts: [{ id: "al1", residence_id: R, status: "offered", offered_request_id: "rq1" }],
      }),
    );
    await onStayMovedToBed(client, { residenceId: R, residentStayId: "stay-a", newBedId: "bed-9", previousBedId: null, actorUserId: "owner" });
    expect(tables.room_change_requests[0]).toMatchObject({ status: "resolved", closed_reason: "moved" });
    expect(tables.room_change_place_alerts[0].status).toBe("resolved");
  });

  it("si lo mueven a otra cama, el pedido sigue abierto", async () => {
    const { client, tables } = createInMemorySupabase(world({ room_change_requests: [pending({ id: "rq1", resident_stay_id: "stay-a", status: "offered", offered_bed_id: "bed-9" })] }));
    await onStayMovedToBed(client, { residenceId: R, residentStayId: "stay-a", newBedId: "bed-1", previousBedId: null, actorUserId: "owner" });
    expect(tables.room_change_requests[0].status).toBe("offered");
  });

  it("al terminar la estadía, el pedido abierto se cancela solo y la plaza ofrecida vuelve a quedar por decidir", async () => {
    const { client, tables } = createInMemorySupabase(
      world({
        room_change_requests: [pending({ id: "rq1", resident_stay_id: "stay-a", status: "offered" })],
        room_change_place_alerts: [{ id: "al1", residence_id: R, status: "offered", offered_request_id: "rq1" }],
      }),
    );
    await closeRequestsOnStayEnded(client, { residenceId: R, residentStayId: "stay-a" });
    expect(tables.room_change_requests[0]).toMatchObject({ status: "cancelled", closed_reason: "stay_ended" });
    expect(tables.room_change_place_alerts[0]).toMatchObject({ status: "pending", offered_request_id: null });
  });
});
