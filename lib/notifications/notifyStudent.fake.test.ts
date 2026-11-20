import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const created: Record<string, unknown>[] = [];
vi.mock("@/lib/notifications/createNotification", () => ({
  createNotification: vi.fn(async (_admin: unknown, entry: Record<string, unknown>) => {
    created.push(entry);
  }),
}));

import { notifyStudentApplicationMilestone, notifyStudentByProfileId, notifyStudentReservationMilestone } from "@/lib/notifications/notifyStudent";

type Row = Record<string, unknown> | null;
/** Cliente falso: cada tabla responde con una fila fija; `throwOn` hace lanzar la lectura de esa tabla. */
function fakeAdmin(rows: Record<string, Row>, throwOn?: string) {
  return {
    from(table: string) {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => {
          if (throwOn === table) throw new Error("boom");
          return { data: rows[table] ?? null, error: null };
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

beforeEach(() => {
  created.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("notifyStudentByProfileId", () => {
  it("avisa al usuario dueño del perfil con la categoría indicada", async () => {
    const admin = fakeAdmin({ student_profiles: { user_id: "u-student" } });
    await notifyStudentByProfileId(admin, "sp-1", { title: "t", body: "b", relatedEntityType: "reservations", relatedEntityId: "r-1", category: "payments_fee" });
    expect(created).toEqual([{ userId: "u-student", title: "t", body: "b", relatedEntityType: "reservations", relatedEntityId: "r-1", category: "payments_fee" }]);
  });

  it("no avisa si no hay perfil o usuario", async () => {
    await notifyStudentByProfileId(fakeAdmin({}), "sp-1", { title: "t", body: "b" });
    await notifyStudentByProfileId(fakeAdmin({}), null, { title: "t", body: "b" });
    expect(created).toHaveLength(0);
  });

  it("un fallo de lectura no propaga la excepción", async () => {
    const admin = fakeAdmin({ student_profiles: { user_id: "u" } }, "student_profiles");
    await expect(notifyStudentByProfileId(admin, "sp-1", { title: "t", body: "b" })).resolves.toBeUndefined();
    expect(created).toHaveLength(0);
  });
});

describe("hitos del estudiante", () => {
  it("solicitud aceptada: requests_reservations, sin prometer disponibilidad", async () => {
    const admin = fakeAdmin({ application_requests: { student_profile_id: "sp-1", residences: { name: "Casa Norte" } }, student_profiles: { user_id: "u-student" } });
    await notifyStudentApplicationMilestone(admin, "app-1", "accepted");
    expect(created[0]).toMatchObject({ userId: "u-student", category: "requests_reservations", relatedEntityType: "application_requests", relatedEntityId: "app-1" });
    expect(String(created[0].body)).toContain("sujeta a confirmación");
  });

  it("fee pendiente: categoría payments_fee y plazo", async () => {
    const admin = fakeAdmin({
      reservations: { student_profile_id: "sp-1", estured_fee_payment_id: "fee-1", residences: { name: "Casa Norte" } },
      estured_fee_payments: { expires_at: "2026-12-01T15:00:00Z" },
      student_profiles: { user_id: "u-student" },
    });
    await notifyStudentReservationMilestone(admin, "res-1", "fee_to_pay");
    expect(created[0]).toMatchObject({ category: "payments_fee", relatedEntityType: "reservations", relatedEntityId: "res-1" });
    expect(String(created[0].body)).toContain("Plazo");
  });

  it("reserva confirmada: requests_reservations", async () => {
    const admin = fakeAdmin({ reservations: { student_profile_id: "sp-1", estured_fee_payment_id: null, residences: { name: "Casa Norte" } }, student_profiles: { user_id: "u-student" } });
    await notifyStudentReservationMilestone(admin, "res-1", "confirmed");
    expect(created[0]).toMatchObject({ category: "requests_reservations", title: "Tu reserva está confirmada" });
  });

  it("un fallo del aviso no propaga la excepción", async () => {
    const admin = fakeAdmin({}, "reservations");
    await expect(notifyStudentReservationMilestone(admin, "res-1", "confirmed")).resolves.toBeUndefined();
    await expect(notifyStudentApplicationMilestone(fakeAdmin({}, "application_requests"), "a", "accepted")).resolves.toBeUndefined();
  });
});
