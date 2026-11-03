import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const audits = vi.hoisted(() => [] as { action: string; actorRole: string; newValue?: Record<string, unknown> }[]);
vi.mock("@/lib/audit", () => ({
  createAuditLog: async (_a: unknown, entry: (typeof audits)[number]) => {
    audits.push(entry);
    return true;
  },
}));
const notes = vi.hoisted(() => [] as { userId: string; title: string; body: string }[]);
vi.mock("@/lib/notifications/createNotification", () => ({
  createNotification: async (_a: unknown, n: (typeof notes)[number]) => {
    notes.push(n);
  },
}));
const teamEvents = vi.hoisted(() => [] as { event: string; entityId: string }[]);
vi.mock("@/lib/residences/notifyResidenceTeam", () => ({
  notifyResidenceTeam: async (_a: unknown, p: { event: string; entityId: string }) => {
    teamEvents.push({ event: p.event, entityId: p.entityId });
  },
}));
const family = vi.hoisted(() => ({ ids: [] as string[] }));
vi.mock("@/lib/stayChange/recipients", () => ({
  loadActiveFamilyUserIds: async () => family.ids,
  loadResidenceUserIds: async () => ["owner"],
  shortStudentName: () => "Ana P.",
}));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { decideFreedPlaceByResidence, saveRoomChangeRequestByResidence, updateRoomChangeStatusByResidence } from "@/lib/roomChange/manage";
import { cancelRoomChangeRequestByStudent, createRoomChangeRequestByStudent } from "@/lib/roomChange/student";
import { ROOM_CHANGE_COSTS_NOTICE } from "@/lib/roomChange/rules";

const R = "res-1";
const OTHER_R = "res-2";
const OWNER = "owner";
const STAFF = "staff";
const TYPE = "11111111-1111-4111-8111-111111111111";
const OTHER_TYPE = "22222222-2222-4222-8222-222222222222";

function world(extra: Partial<Record<string, Row[]>> = {}): Record<string, Row[]> {
  return {
    residence_users: [
      { id: "ru1", residence_id: R, user_id: OWNER, role: "owner", is_active: true },
      { id: "ru2", residence_id: R, user_id: STAFF, role: "staff", is_active: true, permissions: { "residents.manage": false, "operations.rooms_availability": false } },
    ],
    room_types: [
      { id: TYPE, residence_id: R, name: "Doble", is_active: true },
      { id: OTHER_TYPE, residence_id: OTHER_R, name: "Simple", is_active: true },
    ],
    student_profiles: [
      { id: "sp-ana", user_id: "u-ana", is_minor: false, first_name: "Ana", last_initial: "P." },
      { id: "sp-otra", user_id: "u-otra", is_minor: false, first_name: "Otra", last_initial: "G." },
      { id: "sp-menor", user_id: "u-menor", is_minor: true, first_name: "Lu", last_initial: "M." },
    ],
    resident_stays: [
      { id: "stay-ana", residence_id: R, student_profile_id: "sp-ana", is_current: true, status: "active", room_type_id: TYPE },
      { id: "stay-menor", residence_id: R, student_profile_id: "sp-menor", is_current: true, status: "active", room_type_id: TYPE },
      { id: "stay-sinres", residence_id: R, student_profile_id: null, is_current: true, status: "pending_activation", room_type_id: TYPE },
    ],
    room_change_requests: [],
    room_change_place_alerts: [],
    profile_availability: [{ id: "pa1", residence_id: R, room_type_id: TYPE, available_count: 0, status: "full" }],
    ...extra,
  } as Record<string, Row[]>;
}

beforeEach(() => {
  audits.length = 0;
  notes.length = 0;
  teamEvents.length = 0;
  family.ids = [];
});

describe("saveRoomChangeRequestByResidence", () => {
  it("el dueño anota el pedido de un residente y deja auditoría; después edita la misma preferencia sin duplicar", async () => {
    const { client, tables } = createInMemorySupabase(world());
    const created = await saveRoomChangeRequestByResidence(client, { actorUserId: OWNER, residenceId: R, residentStayId: "stay-ana", roomTypeId: TYPE, gender: "femenino", note: "3.er piso", reason: "" });
    expect(created.ok).toBe(true);
    expect(tables.room_change_requests).toHaveLength(1);
    expect(tables.room_change_requests[0]).toMatchObject({ origin: "residence", status: "pending", preferred_room_type_id: TYPE, preferred_gender: "femenino", student_profile_id: "sp-ana" });
    expect(audits.map((a) => a.action)).toEqual(["room_change_requested"]);
    expect(notes.some((n) => n.userId === "u-ana")).toBe(true);

    const edited = await saveRoomChangeRequestByResidence(client, { actorUserId: OWNER, residenceId: R, residentStayId: "stay-ana", roomTypeId: "", gender: "mixto", note: "", reason: "ruido" });
    expect(edited.ok).toBe(true);
    expect(tables.room_change_requests).toHaveLength(1);
    expect(tables.room_change_requests[0]).toMatchObject({ preferred_room_type_id: null, preferred_gender: "mixto", reason: "ruido" });
    expect(audits[1].action).toBe("room_change_updated");
  });

  it("un residente sin cuenta también se puede anotar (sin aviso al estudiante)", async () => {
    const { client, tables } = createInMemorySupabase(world());
    const r = await saveRoomChangeRequestByResidence(client, { actorUserId: OWNER, residenceId: R, residentStayId: "stay-sinres", roomTypeId: TYPE, gender: "", note: "", reason: "" });
    expect(r.ok).toBe(true);
    expect(tables.room_change_requests[0].student_profile_id).toBeNull();
    expect(notes).toHaveLength(0);
  });

  it("staff sin el permiso de Residentes no puede; un tipo de otra residencia o una estadía ajena se rechazan", async () => {
    const { client, tables } = createInMemorySupabase(world());
    const denied = await saveRoomChangeRequestByResidence(client, { actorUserId: STAFF, residenceId: R, residentStayId: "stay-ana", roomTypeId: TYPE, gender: "", note: "", reason: "" });
    expect(denied.ok).toBe(false);
    const foreignType = await saveRoomChangeRequestByResidence(client, { actorUserId: OWNER, residenceId: R, residentStayId: "stay-ana", roomTypeId: OTHER_TYPE, gender: "", note: "", reason: "" });
    expect(foreignType.ok).toBe(false);
    const foreignStay = await saveRoomChangeRequestByResidence(client, { actorUserId: OWNER, residenceId: OTHER_R, residentStayId: "stay-ana", roomTypeId: "", gender: "", note: "x", reason: "" });
    expect(foreignStay.ok).toBe(false);
    expect(tables.room_change_requests).toHaveLength(0);
  });

  it("sin la migración 0076 responde con un mensaje claro y no escribe", async () => {
    const { client } = createInMemorySupabase(world(), { missingTables: ["room_change_requests"] });
    const r = await saveRoomChangeRequestByResidence(client, { actorUserId: OWNER, residenceId: R, residentStayId: "stay-ana", roomTypeId: TYPE, gender: "", note: "", reason: "" });
    expect(r).toEqual({ ok: false, error: expect.stringContaining("todavía no está disponible") });
  });
});

describe("updateRoomChangeStatusByResidence", () => {
  const open = (extra: Row = {}): Row => ({ id: "rq1", residence_id: R, resident_stay_id: "stay-ana", student_profile_id: "sp-ana", origin: "student", status: "pending", ...extra });

  it("pasa a en gestión, vuelve a pendiente y cierra; avisa al estudiante cuando lo pidió él", async () => {
    const { client, tables } = createInMemorySupabase(world({ room_change_requests: [open()] }));
    expect((await updateRoomChangeStatusByResidence(client, { actorUserId: OWNER, residenceId: R, requestId: "rq1", to: "offered" })).ok).toBe(true);
    expect(tables.room_change_requests[0].status).toBe("offered");
    expect(notes.at(-1)?.userId).toBe("u-ana");
    expect((await updateRoomChangeStatusByResidence(client, { actorUserId: OWNER, residenceId: R, requestId: "rq1", to: "pending" })).ok).toBe(true);
    expect((await updateRoomChangeStatusByResidence(client, { actorUserId: OWNER, residenceId: R, requestId: "rq1", to: "resolved" })).ok).toBe(true);
    expect(tables.room_change_requests[0]).toMatchObject({ status: "resolved", closed_reason: "resolved_by_residence" });
    // Cerrado: no se reabre.
    expect((await updateRoomChangeStatusByResidence(client, { actorUserId: OWNER, residenceId: R, requestId: "rq1", to: "pending" })).ok).toBe(false);
  });

  it("no toca pedidos de otra residencia, estados inventados ni sin permiso", async () => {
    const { client, tables } = createInMemorySupabase(world({ room_change_requests: [open()] }));
    expect((await updateRoomChangeStatusByResidence(client, { actorUserId: OWNER, residenceId: OTHER_R, requestId: "rq1", to: "resolved" })).ok).toBe(false);
    expect((await updateRoomChangeStatusByResidence(client, { actorUserId: OWNER, residenceId: R, requestId: "rq1", to: "borrado" })).ok).toBe(false);
    expect((await updateRoomChangeStatusByResidence(client, { actorUserId: STAFF, residenceId: R, requestId: "rq1", to: "resolved" })).ok).toBe(false);
    expect(tables.room_change_requests[0].status).toBe("pending");
  });
});

describe("decideFreedPlaceByResidence", () => {
  const alert = (extra: Row = {}): Row => ({ id: "al1", residence_id: R, bed_id: "bed-1", room_type_id: TYPE, place_label: "Hab. 3 · Cama B (Doble)", status: "pending", deferred_increment: true, ...extra });
  const request = (extra: Row = {}): Row => ({ id: "rq1", residence_id: R, resident_stay_id: "stay-ana", student_profile_id: "sp-ana", origin: "student", status: "pending", ...extra });

  it("ofrecer: el pedido queda en gestión con la plaza, la alerta ofrecida y el estudiante avisado; no se publica", async () => {
    const { client, tables } = createInMemorySupabase(world({ room_change_place_alerts: [alert()], room_change_requests: [request()] }));
    const r = await decideFreedPlaceByResidence(client, { actorUserId: OWNER, residenceId: R, alertId: "al1", decision: "offer", requestId: "rq1" });
    expect(r.ok).toBe(true);
    expect(tables.room_change_place_alerts[0]).toMatchObject({ status: "offered", offered_request_id: "rq1" });
    expect(tables.room_change_requests[0]).toMatchObject({ status: "offered", offered_bed_id: "bed-1", offered_label: "Hab. 3 · Cama B (Doble)" });
    expect(tables.profile_availability[0].available_count).toBe(0);
    expect(notes.at(-1)).toMatchObject({ userId: "u-ana" });
    expect(notes.at(-1)?.body).toContain("Sigue sujeto a disponibilidad");
    // No se puede ofrecer dos veces la misma plaza.
    const again = await decideFreedPlaceByResidence(client, { actorUserId: OWNER, residenceId: R, alertId: "al1", decision: "offer", requestId: "rq1" });
    expect(again.ok).toBe(false);
  });

  it("ofrecer exige elegir un pedido abierto de ESTA residencia", async () => {
    const { client } = createInMemorySupabase(world({ room_change_place_alerts: [alert()], room_change_requests: [request({ residence_id: OTHER_R }), request({ id: "rq2", status: "resolved" })] }));
    expect((await decideFreedPlaceByResidence(client, { actorUserId: OWNER, residenceId: R, alertId: "al1", decision: "offer" })).ok).toBe(false);
    expect((await decideFreedPlaceByResidence(client, { actorUserId: OWNER, residenceId: R, alertId: "al1", decision: "offer", requestId: "rq1" })).ok).toBe(false);
    expect((await decideFreedPlaceByResidence(client, { actorUserId: OWNER, residenceId: R, alertId: "al1", decision: "offer", requestId: "rq2" })).ok).toBe(false);
  });

  it("ignorar: cierra el aviso sin publicar ni tocar la disponibilidad; el pedido ofrecido vuelve a pendiente", async () => {
    const { client, tables } = createInMemorySupabase(
      world({ room_change_place_alerts: [alert({ status: "offered", offered_request_id: "rq1" })], room_change_requests: [request({ status: "offered", offered_bed_id: "bed-1", offered_label: "x" })] }),
    );
    const r = await decideFreedPlaceByResidence(client, { actorUserId: OWNER, residenceId: R, alertId: "al1", decision: "ignore" });
    expect(r.ok).toBe(true);
    expect(tables.room_change_place_alerts[0].status).toBe("ignored");
    expect(tables.room_change_requests[0]).toMatchObject({ status: "pending", offered_bed_id: null });
    expect(tables.profile_availability[0].available_count).toBe(0);
  });

  it("publicar: repone el +1 diferido de la salida (una sola vez) y exige el permiso de disponibilidad", async () => {
    const { client, tables } = createInMemorySupabase(world({ room_change_place_alerts: [alert()] }));
    const denied = await decideFreedPlaceByResidence(client, { actorUserId: STAFF, residenceId: R, alertId: "al1", decision: "publish" });
    expect(denied.ok).toBe(false);
    const r = await decideFreedPlaceByResidence(client, { actorUserId: OWNER, residenceId: R, alertId: "al1", decision: "publish" });
    expect(r.ok).toBe(true);
    expect(tables.room_change_place_alerts[0].status).toBe("published");
    expect(tables.profile_availability[0]).toMatchObject({ available_count: 1, status: "available_to_confirm" });
    const again = await decideFreedPlaceByResidence(client, { actorUserId: OWNER, residenceId: R, alertId: "al1", decision: "publish" });
    expect(again.ok).toBe(false);
    expect(tables.profile_availability[0].available_count).toBe(1);
  });

  it("publicar un aviso que no era una salida no toca el contador", async () => {
    const { client, tables } = createInMemorySupabase(world({ room_change_place_alerts: [alert({ deferred_increment: false, source: "bed_move" })] }));
    expect((await decideFreedPlaceByResidence(client, { actorUserId: OWNER, residenceId: R, alertId: "al1", decision: "publish" })).ok).toBe(true);
    expect(tables.profile_availability[0].available_count).toBe(0);
  });

  it("un aviso de otra residencia no se puede decidir", async () => {
    const { client } = createInMemorySupabase(world({ room_change_place_alerts: [alert({ residence_id: OTHER_R })] }));
    expect((await decideFreedPlaceByResidence(client, { actorUserId: OWNER, residenceId: R, alertId: "al1", decision: "ignore" })).ok).toBe(false);
  });
});

describe("estudiante", () => {
  it("pide para SU estadía activa con constancia del texto de costos; avisa a la residencia y a su familiar", async () => {
    family.ids = ["u-fam"];
    const { client, tables } = createInMemorySupabase(world());
    const r = await createRoomChangeRequestByStudent(client, { actorUserId: "u-ana", confirmed: true, roomTypeId: TYPE, gender: "", note: "", reason: "Ruido" });
    expect(r.ok).toBe(true);
    expect(tables.room_change_requests[0]).toMatchObject({
      resident_stay_id: "stay-ana",
      student_profile_id: "sp-ana",
      origin: "student",
      status: "pending",
      costs_notice_text: ROOM_CHANGE_COSTS_NOTICE,
    });
    expect(tables.room_change_requests[0].costs_acknowledged_at).toBeTruthy();
    expect(teamEvents).toEqual([{ event: "new_room_change_request", entityId: tables.room_change_requests[0].id }]);
    expect(notes.map((n) => n.userId).sort()).toEqual(["u-ana", "u-fam"]);
    expect(audits[0]).toMatchObject({ action: "room_change_requested", actorRole: "student" });
  });

  it("exige la confirmación de costos, una preferencia y un tipo de SU residencia", async () => {
    const { client, tables } = createInMemorySupabase(world());
    expect((await createRoomChangeRequestByStudent(client, { actorUserId: "u-ana", confirmed: false, roomTypeId: TYPE, gender: "", note: "", reason: "" })).ok).toBe(false);
    expect((await createRoomChangeRequestByStudent(client, { actorUserId: "u-ana", confirmed: true, roomTypeId: "", gender: "", note: "", reason: "" })).ok).toBe(false);
    expect((await createRoomChangeRequestByStudent(client, { actorUserId: "u-ana", confirmed: true, roomTypeId: OTHER_TYPE, gender: "", note: "", reason: "" })).ok).toBe(false);
    expect(tables.room_change_requests).toHaveLength(0);
  });

  it("sin estadía activa no puede (un residente sin cuenta activada no cuenta)", async () => {
    const { client } = createInMemorySupabase(world({ resident_stays: [{ id: "s", residence_id: R, student_profile_id: "sp-ana", is_current: true, status: "pending_activation" }] }));
    const r = await createRoomChangeRequestByStudent(client, { actorUserId: "u-ana", confirmed: true, roomTypeId: TYPE, gender: "", note: "", reason: "" });
    expect(r.ok).toBe(false);
  });

  it("menor: sin familiar vinculado no puede; con familiar sí", async () => {
    const { client } = createInMemorySupabase(world());
    const blocked = await createRoomChangeRequestByStudent(client, { actorUserId: "u-menor", confirmed: true, roomTypeId: TYPE, gender: "", note: "", reason: "" });
    expect(blocked).toEqual({ ok: false, error: expect.stringContaining("familiar vinculado") });
    family.ids = ["u-fam"];
    const ok = await createRoomChangeRequestByStudent(client, { actorUserId: "u-menor", confirmed: true, roomTypeId: TYPE, gender: "", note: "", reason: "" });
    expect(ok.ok).toBe(true);
  });

  it("un segundo pedido abierto se rechaza (índice único)", async () => {
    const { client } = createInMemorySupabase(world(), { failInsert: { room_change_requests: { code: "23505", message: "duplicate" } } });
    const r = await createRoomChangeRequestByStudent(client, { actorUserId: "u-ana", confirmed: true, roomTypeId: TYPE, gender: "", note: "", reason: "" });
    expect(r).toEqual({ ok: false, error: expect.stringContaining("en curso") });
  });

  it("cancela solo SU pedido abierto; el de otra persona responde como inexistente; la plaza ofrecida vuelve a quedar por decidir", async () => {
    const { client, tables } = createInMemorySupabase(
      world({
        room_change_requests: [
          { id: "rq1", residence_id: R, resident_stay_id: "stay-ana", student_profile_id: "sp-ana", status: "offered", origin: "student" },
          { id: "rq2", residence_id: R, resident_stay_id: "stay-menor", student_profile_id: "sp-menor", status: "pending", origin: "student" },
        ],
        room_change_place_alerts: [{ id: "al1", residence_id: R, status: "offered", offered_request_id: "rq1" }],
      }),
    );
    expect((await cancelRoomChangeRequestByStudent(client, { actorUserId: "u-ana", requestId: "rq2" })).ok).toBe(false);
    expect(tables.room_change_requests[1].status).toBe("pending");
    expect((await cancelRoomChangeRequestByStudent(client, { actorUserId: "u-ana", requestId: "rq1" })).ok).toBe(true);
    expect(tables.room_change_requests[0]).toMatchObject({ status: "cancelled", closed_reason: "cancelled_by_student" });
    expect(tables.room_change_place_alerts[0]).toMatchObject({ status: "pending", offered_request_id: null });
    expect((await cancelRoomChangeRequestByStudent(client, { actorUserId: "u-ana", requestId: "rq1" })).ok).toBe(false);
  });
});
