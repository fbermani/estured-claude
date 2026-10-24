import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { saveFamilyProfile } from "@/lib/family/updateFamilyProfile";
import type { FamilyProfileInput } from "@/lib/family/familyProfile";

/** Cliente falso mínimo: registra cada operación y responde según la "base" simulada (migración 0045 aplicada o no). */
type Op = { table: string; op: string; payload: Record<string, unknown> | null };
type DbError = { code: string; message: string };

function fakeAdmin(opts: { billingError?: DbError; otroError?: DbError; usersError?: DbError }) {
  const ops: Op[] = [];
  const member = { id: "fm-1", first_name: "Martin", last_name: "Fernandez", phone: "111", relationship_type: "padre" };
  const admin = {
    from(table: string) {
      const state: Op = { table, op: "select", payload: null };
      const resolveResult = () => {
        ops.push({ ...state });
        const p = state.payload ?? {};
        if (state.op === "update" && table === "family_members") {
          if ("billing_tax_id" in p && opts.billingError) return { data: null, error: opts.billingError };
          if (p.relationship_type === "otro" && opts.otroError) return { data: null, error: opts.otroError };
        }
        if (state.op === "update" && table === "users" && opts.usersError) return { data: null, error: opts.usersError };
        return { data: null, error: null };
      };
      const builder: Record<string, unknown> = {
        select: () => builder,
        update: (payload: Record<string, unknown>) => {
          state.op = "update";
          state.payload = payload;
          return builder;
        },
        insert: (payload: Record<string, unknown>) => {
          state.op = "insert";
          state.payload = payload;
          return builder;
        },
        eq: () => builder,
        maybeSingle: () => Promise.resolve({ data: member, error: null }),
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(resolveResult()).then(res, rej),
      };
      return builder;
    },
  } as unknown as SupabaseClient;
  return { admin, ops };
}

const input: FamilyProfileInput = {
  firstName: "Martín",
  lastName: "Fernández",
  phone: "+54 9 341 555-0104",
  relationshipType: "otro",
  billingTaxId: "20123456786",
  billingVatCondition: "monotributista",
};
const MISSING_COLUMN = { code: "42703", message: 'column "billing_tax_id" of relation "family_members" does not exist' };
const OLD_CHECK = { code: "23514", message: 'violates check constraint "family_members_relationship_type_check"' };

describe("saveFamilyProfile con un cliente falso", () => {
  it("con la migración aplicada guarda todo y audita sin datos de facturación", async () => {
    const { admin, ops } = fakeAdmin({});
    expect(await saveFamilyProfile(admin, { userId: "u1", input })).toEqual({ ok: true });
    const audit = ops.find((o) => o.table === "audit_logs");
    expect(JSON.stringify(audit?.payload)).not.toContain("20123456786");
  });

  it("sin la 0045 (columnas billing_* ausentes) guarda contacto y devuelve un aviso accionable", async () => {
    const { admin, ops } = fakeAdmin({ billingError: MISSING_COLUMN, otroError: OLD_CHECK });
    const result = await saveFamilyProfile(admin, { userId: "u1", input });
    expect(result).toMatchObject({ ok: true });
    expect(result.ok && result.warning).toMatch(/datos de facturación se podrán guardar/);
    // `otro` se guardó como su equivalente `familiar` y el teléfono quedó sincronizado en `users`.
    expect(ops.some((o) => o.table === "family_members" && o.payload?.relationship_type === "familiar")).toBe(true);
    expect(ops.some((o) => o.table === "users" && o.payload?.phone === input.phone)).toBe(true);
  });

  it("si falla users.phone revierte family_members y devuelve error", async () => {
    const { admin, ops } = fakeAdmin({ usersError: { code: "XX000", message: "boom" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await saveFamilyProfile(admin, { userId: "u1", input });
    expect(result.ok).toBe(false);
    const reverts = ops.filter((o) => o.table === "family_members" && o.op === "update" && o.payload?.phone === "111");
    expect(reverts).toHaveLength(1);
  });

  it("un error de facturación que NO es de esquema se informa (no se oculta)", async () => {
    const { admin } = fakeAdmin({ billingError: { code: "23514", message: "billing_tax_id check" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await saveFamilyProfile(admin, { userId: "u1", input });
    expect(result.ok).toBe(false);
  });
});
