import type { SupabaseClient } from "@supabase/supabase-js";

/** Cliente Supabase falso para tests de push: encadena filtros y resuelve con `handler` (solo para tests). */
export type Call = {
  table: string;
  action: "select" | "insert" | "update" | "upsert";
  payload?: unknown;
  filters: Record<string, unknown>;
  returning: boolean;
  head: boolean;
};
export type Result = { data?: unknown; error?: { code?: string; message?: string } | null; count?: number | null };

export function makeFakeAdmin(handler: (call: Call) => Result | Promise<Result>) {
  const calls: Call[] = [];
  const admin = {
    from(table: string) {
      const call: Call = { table, action: "select", filters: {}, returning: false, head: false };
      const run = async () => {
        calls.push(call);
        const r = await handler(call);
        return { data: r.data ?? null, error: r.error ?? null, count: r.count ?? null };
      };
      const b: Record<string, unknown> = {
        select: (_cols?: string, opts?: { head?: boolean }) => {
          if (call.action !== "select") call.returning = true;
          if (opts?.head) call.head = true;
          return b;
        },
        insert: (payload: unknown) => ((call.action = "insert"), (call.payload = payload), b),
        update: (payload: unknown) => ((call.action = "update"), (call.payload = payload), b),
        upsert: (payload: unknown) => ((call.action = "upsert"), (call.payload = payload), b),
        eq: (k: string, v: unknown) => ((call.filters[k] = v), b),
        is: (k: string, v: unknown) => ((call.filters[`${k}:is`] = v), b),
        in: (k: string, v: unknown) => ((call.filters[`${k}:in`] = v), b),
        order: () => b,
        limit: () => b,
        maybeSingle: run,
        single: run,
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => run().then(resolve, reject),
      };
      return b;
    },
  } as unknown as SupabaseClient;
  return { admin, calls };
}
