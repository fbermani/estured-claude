import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));

import { expireWaitlistByMonth } from "@/lib/jobs/expireWaitlistByMonth";

type Row = { id: string; status: string; desired_start_date: string | null; student_profiles: { user_id: string }; residences: { name: string } };

/** Fake mínimo de la cadena de Supabase que usa el job (select/in/not/lt, update/eq/in/select, insert de auditoría y notificaciones). */
function fakeAdmin(rows: Row[]) {
  const notifications: Record<string, unknown>[] = [];
  const admin = {
    from(table: string) {
      if (table === "waitlist_entries") {
        const filters: { statuses?: string[]; ltDate?: string; id?: string } = {};
        let patch: Record<string, unknown> | null = null;
        const chain = {
          select() {
            if (patch) {
              const hit = rows.filter((r) => r.id === filters.id && (filters.statuses ?? []).includes(r.status));
              hit.forEach((r) => Object.assign(r, patch));
              return Promise.resolve({ data: hit.map((r) => ({ id: r.id })), error: null });
            }
            return chain;
          },
          in(_col: string, values: string[]) { filters.statuses = values; return thenable(); },
          not() { return chain; },
          lt(_col: string, v: string) { filters.ltDate = v; return thenable(); },
          update(p: Record<string, unknown>) { patch = p; return chain; },
          eq(_col: string, v: string) { filters.id = v; return chain; },
        };
        function thenable() {
          return Object.assign(chain, {
            then: (resolve: (v: unknown) => void) => {
              const data = rows.filter(
                (r) => (filters.statuses ?? []).includes(r.status) && r.desired_start_date !== null && r.desired_start_date < (filters.ltDate ?? ""),
              );
              resolve({ data, error: null });
            },
          });
        }
        return chain;
      }
      return { insert: (v: Record<string, unknown>) => { if (table === "notifications") notifications.push(v); return Promise.resolve({ error: null }); } };
    },
  } as unknown as SupabaseClient;
  return { admin, notifications };
}

const NOW = new Date("2026-11-07T15:00:00Z");
const row = (id: string, status: string, month: string | null): Row => ({
  id, status, desired_start_date: month, student_profiles: { user_id: `u-${id}` }, residences: { name: "Río de la Plata" },
});

describe("expireWaitlistByMonth", () => {
  it("vence active y retention_check_sent con mes terminado; no toca avisados, mes en curso ni sin mes", async () => {
    const rows = [
      row("a", "active", "2026-10-01"),
      row("b", "retention_check_sent", "2026-09-01"),
      row("c", "availability_notification_sent", "2026-09-01"),
      row("d", "active", "2026-11-01"),
      row("e", "active", null),
    ];
    const { admin, notifications } = fakeAdmin(rows);
    const result = await expireWaitlistByMonth(admin, NOW);
    expect(result.expiredCount).toBe(2);
    expect(rows.map((r) => r.status)).toEqual(["expired", "expired", "availability_notification_sent", "active", "active"]);
    expect((rows[0] as unknown as Record<string, unknown>).removed_reason).toBe("month_passed");
    expect(notifications).toHaveLength(2);
    expect(String(notifications[0].body)).toContain("venció porque pasó el mes elegido");
  });

  it("es idempotente", async () => {
    const rows = [row("a", "active", "2026-10-01")];
    const { admin, notifications } = fakeAdmin(rows);
    await expireWaitlistByMonth(admin, NOW);
    const second = await expireWaitlistByMonth(admin, NOW);
    expect(second.expiredCount).toBe(0);
    expect(notifications).toHaveLength(1);
  });
});
