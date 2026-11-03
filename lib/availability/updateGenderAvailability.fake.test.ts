import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const audits = vi.hoisted(() => [] as { actorUserId: string | null; actorRole: string; action: string; newValue?: unknown }[]);
vi.mock("@/lib/audit", () => ({
  createAuditLog: async (_admin: unknown, entry: (typeof audits)[number]) => {
    audits.push(entry);
    return true;
  },
}));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { permissionsFromChecked, PERMISSION_DENIED_MESSAGE } from "@/lib/residences/permissions";
import { updateTypeAvailabilityByGender } from "@/lib/availability/updateGenderAvailability";
import { loadGenderAvailability } from "@/lib/availability/genderAvailabilityDb";

const NORTE = "res-norte";
const raw = (status: string, count: string, from = "", note = "") => ({ status, count, from, note });

function world(overrides: Partial<Record<string, Row[]>> = {}): Record<string, Row[]> {
  return {
    residence_users: [
      { id: "ru-owner", residence_id: NORTE, user_id: "ricardo", role: "owner", is_active: true },
      { id: "ru-ro", residence_id: NORTE, user_id: "solo-lectura", role: "staff", is_active: true, permissions: permissionsFromChecked([]) },
      { id: "ru-rooms", residence_id: NORTE, user_id: "cuartos", role: "staff", is_active: true, permissions: permissionsFromChecked(["operations.rooms_availability"]) },
    ],
    room_types: [
      { id: "rt-doble", residence_id: NORTE, name: "Doble", gender_policy: "mixto", capacity_per_room: 2, is_active: true },
      { id: "rt-otra", residence_id: "res-rio", name: "Doble", gender_policy: "mixto", capacity_per_room: 2, is_active: true },
    ],
    rooms: [
      { id: "r1", residence_id: NORTE, room_type_id: "rt-doble", gender: "masculino", is_active: true },
      { id: "r2", residence_id: NORTE, room_type_id: "rt-doble", gender: "femenino", is_active: true },
    ],
    profile_availability: [
      { id: "pa-1", residence_id: NORTE, room_type_id: "rt-doble", status: "not_updated", available_count: null, hidden_from_search_at: "2026-10-01T00:00:00Z" },
    ],
    profile_availability_genders: [],
    ...overrides,
  } as Record<string, Row[]>;
}

const params = (rows: Parameters<typeof updateTypeAvailabilityByGender>[1]["rows"], actor = "ricardo", roomTypeId = "rt-doble") => ({
  residenceId: NORTE,
  roomTypeId,
  actorUserId: actor,
  rows,
});

let fake: ReturnType<typeof createInMemorySupabase>;
const admin = () => fake.client as never;

beforeEach(() => {
  audits.length = 0;
  fake = createInMemorySupabase(world());
});

describe("updateTypeAvailabilityByGender", () => {
  it("el dueño guarda una fila por género, recalcula el resumen del tipo, limpia la ocultación y audita", async () => {
    const result = await updateTypeAvailabilityByGender(
      admin(),
      params({ masculino: raw("available_to_confirm", "2", "2027-03-10", "Entra en marzo"), femenino: raw("full", "") }),
    );
    expect(result).toEqual({ ok: true, rows: 2 });

    const stored = fake.tables.profile_availability_genders;
    expect(stored).toHaveLength(2);
    expect(stored.find((r) => r.gender === "masculino")).toMatchObject({ status: "available_to_confirm", available_count: 2, available_from: "2027-03-10", notes_public: "Entra en marzo" });
    expect(stored.find((r) => r.gender === "femenino")).toMatchObject({ status: "full", available_count: 0 });

    expect(fake.tables.profile_availability[0]).toMatchObject({
      status: "available_to_confirm",
      available_count: 2,
      available_from: "2027-03-10",
      hidden_from_search_at: null,
      last_confirmed_by: "ricardo",
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: "availability_by_gender_updated", actorRole: "residence_owner" });
  });

  it("completa en todos los géneros deja el tipo completo", async () => {
    await updateTypeAvailabilityByGender(admin(), params({ masculino: raw("full", ""), femenino: raw("full", "") }));
    expect(fake.tables.profile_availability[0]).toMatchObject({ status: "full", available_count: 0 });
  });

  it("staff con el permiso puede; sin él, no escribe nada", async () => {
    const denied = await updateTypeAvailabilityByGender(admin(), params({ masculino: raw("full", ""), femenino: raw("full", "") }, "solo-lectura"));
    expect(denied).toEqual({ ok: false, error: PERMISSION_DENIED_MESSAGE });
    expect(fake.log.filter((l) => l.op !== "select")).toHaveLength(0);

    const allowed = await updateTypeAvailabilityByGender(admin(), params({ masculino: raw("full", ""), femenino: raw("full", "") }, "cuartos"));
    expect(allowed.ok).toBe(true);
    expect(audits[0]).toMatchObject({ actorRole: "residence_staff" });
  });

  it("un tipo de otra residencia no se puede tocar (IDOR)", async () => {
    const result = await updateTypeAvailabilityByGender(admin(), params({ mixto: raw("full", "") }, "ricardo", "rt-otra"));
    expect(result.ok).toBe(false);
    expect(fake.tables.profile_availability_genders).toHaveLength(0);
  });

  it("rechaza géneros que el tipo no tiene y filas que faltan", async () => {
    const extra = await updateTypeAvailabilityByGender(admin(), params({ masculino: raw("full", ""), femenino: raw("full", ""), mixto: raw("full", "") }));
    expect(extra).toMatchObject({ ok: false, error: expect.stringContaining("cambiaron") });
    const missing = await updateTypeAvailabilityByGender(admin(), params({ masculino: raw("full", "") }));
    expect(missing).toMatchObject({ ok: false, error: expect.stringContaining("Dobles femeninas") });
    expect(fake.tables.profile_availability_genders).toHaveLength(0);
  });

  it("valida cada fila (cantidad 0 con «disponible» es un error accionable)", async () => {
    const result = await updateTypeAvailabilityByGender(admin(), params({ masculino: raw("available_to_confirm", "0"), femenino: raw("full", "") }));
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("completa") });
    expect(fake.tables.profile_availability_genders).toHaveLength(0);
  });

  it("no pisa una pausa de EstuRed", async () => {
    fake = createInMemorySupabase(
      world({ profile_availability: [{ id: "pa-1", residence_id: NORTE, room_type_id: "rt-doble", status: "paused_by_admin" }] }),
    );
    const result = await updateTypeAvailabilityByGender(admin(), params({ masculino: raw("full", ""), femenino: raw("full", "") }));
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("EstuRed pausó") });
    expect(fake.tables.profile_availability_genders).toHaveLength(0);
  });

  it("quita las filas de géneros que ya no existen en el tipo", async () => {
    fake = createInMemorySupabase(
      world({
        profile_availability_genders: [
          { id: "g-vieja", residence_id: NORTE, room_type_id: "rt-doble", gender: "mixto", status: "available_to_confirm", available_count: 4 },
        ],
      }),
    );
    await updateTypeAvailabilityByGender(admin(), params({ masculino: raw("full", ""), femenino: raw("full", "") }));
    expect(fake.tables.profile_availability_genders.map((r) => r.gender).sort()).toEqual(["femenino", "masculino"]);
  });

  it("sin la migración 0075 devuelve un error claro y no deja el resumen a medias", async () => {
    fake = createInMemorySupabase(world(), { missingTables: ["profile_availability_genders"] });
    const result = await updateTypeAvailabilityByGender(admin(), params({ masculino: raw("full", ""), femenino: raw("full", "") }));
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("todavía no está disponible") });
    expect(fake.tables.profile_availability[0].status).toBe("not_updated");
  });

  it("crea el resumen del tipo si todavía no existía", async () => {
    fake = createInMemorySupabase(world({ profile_availability: [] }));
    const result = await updateTypeAvailabilityByGender(admin(), params({ masculino: raw("available_to_confirm", "1"), femenino: raw("full", "") }));
    expect(result.ok).toBe(true);
    expect(fake.tables.profile_availability).toHaveLength(1);
    expect(fake.tables.profile_availability[0]).toMatchObject({ room_type_id: "rt-doble", status: "available_to_confirm", available_count: 1 });
  });
});

describe("loadGenderAvailability", () => {
  it("degrada sin la migración", async () => {
    fake = createInMemorySupabase(world(), { missingTables: ["profile_availability_genders"] });
    const loaded = await loadGenderAvailability(admin(), ["rt-doble"]);
    expect(loaded.schemaReady).toBe(false);
    expect(loaded.byType.size).toBe(0);
  });

  it("agrupa por tipo y descarta valores desconocidos", async () => {
    fake = createInMemorySupabase(
      world({
        profile_availability_genders: [
          { id: "1", room_type_id: "rt-doble", gender: "masculino", status: "full", available_count: 0 },
          { id: "2", room_type_id: "rt-doble", gender: "raro", status: "full", available_count: 0 },
          { id: "3", room_type_id: "rt-doble", gender: "femenino", status: "not_updated", available_count: 0 },
        ],
      }),
    );
    const loaded = await loadGenderAvailability(admin(), ["rt-doble"]);
    expect(loaded.schemaReady).toBe(true);
    expect(loaded.byType.get("rt-doble")?.map((r) => r.gender)).toEqual(["masculino"]);
  });
});
