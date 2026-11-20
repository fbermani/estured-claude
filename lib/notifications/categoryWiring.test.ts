import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/push/dispatch", () => ({ dispatchNotificationPush: vi.fn(async () => undefined) }));
vi.mock("@/lib/email/sendEmail", () => ({ sendEmail: vi.fn(async () => undefined) }));
vi.mock("@/lib/stayChange/recipients", () => ({ loadActiveFamilyUserIds: vi.fn(async () => ["fam-1"]) }));

import { notifyLinkedFamily } from "@/lib/family/notifyLinkedFamily";
import { notifyResidenceTeam } from "@/lib/residences/notifyResidenceTeam";
import { notifyFamilyReservationMilestone } from "@/lib/family/familyMilestones";

/** Cliente falso: devuelve filas fijas por tabla y registra cada insert en `notifications`. */
function fakeAdmin() {
  const inserts: Record<string, unknown>[] = [];
  const rows: Record<string, unknown> = {
    residences: { name: "Residencia Test" },
    reservations: { id: "res-1", student_profile_id: "sp-1", estured_fee_payment_id: null, residences: { name: "Residencia Test" } },
    student_profiles: { first_name: "Lucía", last_initial: "F" },
  };
  const lists: Record<string, unknown[]> = {
    residence_users: [{ user_id: "owner-1", role: "owner", permissions: null }],
    users: [{ id: "owner-1", email: null, is_active: true, is_blocked: false }],
  };
  const admin = {
    from(table: string) {
      let isInsert = false;
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        insert: (payload: Record<string, unknown>) => {
          isInsert = true;
          if (table === "notifications") inserts.push(payload);
          return builder;
        },
        single: () => Promise.resolve({ data: { id: `n-${inserts.length}` }, error: null }),
        maybeSingle: () => Promise.resolve({ data: rows[table] ?? null, error: null }),
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          Promise.resolve({ data: isInsert ? null : (lists[table] ?? []), error: null }).then(res, rej),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  return { admin, inserts };
}

describe("cableado de categorías de push (DR61)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("notifyLinkedFamily propaga la categoría al insert", async () => {
    const { admin, inserts } = fakeAdmin();
    await notifyLinkedFamily(admin, "sp-1", { title: "t", body: "b", category: "payments_fee" });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({ user_id: "fam-1", category: "payments_fee" });
  });

  it("notifyLinkedFamily sin categoría no manda columna category (solo in-app)", async () => {
    const { admin, inserts } = fakeAdmin();
    await notifyLinkedFamily(admin, "sp-1", { title: "t", body: "b" });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).not.toHaveProperty("category");
  });

  it("notifyResidenceTeam propaga la categoría según el evento", async () => {
    const expiring = fakeAdmin();
    await notifyResidenceTeam(expiring.admin, { residenceId: "r-1", event: "verification_expiring", entityId: "r-1" });
    expect(expiring.inserts[0]).toMatchObject({ user_id: "owner-1", category: "deadlines" });

    // Informativo (no pide acción): solo in-app.
    const approved = fakeAdmin();
    await notifyResidenceTeam(approved.admin, { residenceId: "r-1", event: "verification_approved", entityId: "r-1" });
    expect(approved.inserts[0]).not.toHaveProperty("category");

    const changes = fakeAdmin();
    await notifyResidenceTeam(changes.admin, { residenceId: "r-1", event: "changes_requested", entityId: "r-1" });
    expect(changes.inserts[0]).toMatchObject({ category: "requests_reservations" });

    const joined = fakeAdmin();
    await notifyResidenceTeam(joined.admin, { residenceId: "r-1", event: "team_member_joined", entityId: "r-1" });
    expect(joined.inserts).toHaveLength(1);
    expect(joined.inserts[0]).not.toHaveProperty("category");
  });

  it("notifyFamilyReservationMilestone: fee_to_pay = payments_fee, confirmed = requests_reservations", async () => {
    const fee = fakeAdmin();
    await notifyFamilyReservationMilestone(fee.admin, "res-1", "fee_to_pay");
    expect(fee.inserts[0]).toMatchObject({ category: "payments_fee" });

    const confirmed = fakeAdmin();
    await notifyFamilyReservationMilestone(confirmed.admin, "res-1", "confirmed");
    expect(confirmed.inserts[0]).toMatchObject({ category: "requests_reservations" });

    const expired = fakeAdmin();
    await notifyFamilyReservationMilestone(expired.admin, "res-1", "fee_expired");
    expect(expired.inserts[0]).toMatchObject({ category: "deadlines" });
  });
});
