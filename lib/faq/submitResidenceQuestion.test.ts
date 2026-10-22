import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { submitResidenceQuestion } from "@/lib/faq/submitResidenceQuestion";
import { ANONYMOUS_QUESTIONS_PER_HOUR, MAX_PENDING_PER_RESIDENCE, QUESTIONS_PER_HOUR } from "@/lib/faq/validateFaq";

/**
 * Cliente falso mínimo (sin base): registra los filtros de cada consulta de
 * conteo sobre `residence_faq_questions` y responde según `counts`.
 */
function fakeAdmin(counts: { pending?: number; ip?: number; user?: number; anon?: number }) {
  const inserts: unknown[] = [];
  const countQueries: Record<string, string>[] = [];
  const from = (table: string) => {
    const filters: Record<string, string> = {};
    let head = false;
    let insertRow: unknown = null;
    const b: Record<string, unknown> = {};
    const chain = (name: string) => (col?: string, val?: unknown) => {
      if (col !== undefined) filters[`${name}:${col}`] = String(val);
      return b;
    };
    b.select = (_c?: string, opts?: { head?: boolean }) => {
      head = !!opts?.head;
      return b;
    };
    for (const n of ["eq", "gte", "is"]) b[n] = chain(n);
    b.insert = (row: unknown) => {
      insertRow = row;
      return b;
    };
    b.maybeSingle = async () => ({ data: table === "residences" ? { id: "res-1", name: "Res" } : null });
    b.single = async () => {
      inserts.push(insertRow);
      return { data: { id: "q-1" }, error: null };
    };
    b.then = (resolve: (v: unknown) => void) => {
      if (table === "residence_users") return resolve({ data: [] });
      if (head) {
        countQueries.push(filters);
        const f = filters;
        const count = f["eq:status"] === "pending" ? counts.pending : f["eq:ip_hash"] ? counts.ip : f["eq:asked_by_user_id"] ? counts.user : counts.anon;
        return resolve({ count: count ?? 0 });
      }
      return resolve({ data: [] });
    };
    return b;
  };
  return { client: { from } as unknown as SupabaseClient, inserts, countQueries };
}

const base = { residenceId: "res-1", question: "¿Se aceptan mascotas pequeñas?" };

describe("submitResidenceQuestion (límites, sin base)", () => {
  it("acepta una pregunta válida bajo los límites", async () => {
    const f = fakeAdmin({});
    const r = await submitResidenceQuestion(f.client, { ...base, userId: null, ipHash: "h" });
    expect(r.ok).toBe(true);
    expect(f.inserts).toHaveLength(1);
  });

  it("corta cuando la residencia ya tiene el máximo de pendientes", async () => {
    const f = fakeAdmin({ pending: MAX_PENDING_PER_RESIDENCE });
    const r = await submitResidenceQuestion(f.client, { ...base, userId: null, ipHash: "h" });
    expect(r.ok).toBe(false);
    expect(f.inserts).toHaveLength(0);
  });

  it("corta por IP y por usuario al llegar al límite horario", async () => {
    const byIp = fakeAdmin({ ip: QUESTIONS_PER_HOUR });
    expect((await submitResidenceQuestion(byIp.client, { ...base, userId: null, ipHash: "h" })).ok).toBe(false);
    const byUser = fakeAdmin({ user: QUESTIONS_PER_HOUR });
    expect((await submitResidenceQuestion(byUser.client, { ...base, userId: "u", ipHash: null })).ok).toBe(false);
  });

  it("sin IP ni sesión aplica un límite global (no ninguno)", async () => {
    const ok = fakeAdmin({ anon: ANONYMOUS_QUESTIONS_PER_HOUR - 1 });
    expect((await submitResidenceQuestion(ok.client, { ...base, userId: null, ipHash: null })).ok).toBe(true);
    const blocked = fakeAdmin({ anon: ANONYMOUS_QUESTIONS_PER_HOUR });
    const r = await submitResidenceQuestion(blocked.client, { ...base, userId: null, ipHash: null });
    expect(r.ok).toBe(false);
    expect(blocked.inserts).toHaveLength(0);
    // La consulta global filtra filas sin IP y sin usuario.
    expect(blocked.countQueries.some((q) => q["is:ip_hash"] === "null" && q["is:asked_by_user_id"] === "null")).toBe(true);
  });
});
