import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const audits = vi.hoisted(() => [] as { actorRole: string; action: string; oldValue?: unknown; newValue?: unknown }[]);
vi.mock("@/lib/audit", () => ({
  createAuditLog: async (_a: unknown, e: (typeof audits)[number]) => {
    audits.push(e);
    return true;
  },
}));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { PERMISSION_DENIED_MESSAGE, permissionsFromChecked } from "@/lib/residences/permissions";
import { FEATURED_MIGRATION_PENDING_MESSAGE, loadFeaturedCandidates, saveFeaturedFaq } from "@/lib/faq/featured";
import { getPublicCatalogFaq } from "@/lib/faq/residenceCatalog";
import { getPublicAnsweredQuestions } from "@/lib/faq/getPublicAnsweredQuestions";

const NORTE = "res-norte";
const OTRA = "res-otra";

const cat = (n: number, extra: Row = {}): Row => ({
  id: `FAQ-${String(n).padStart(2, "0")}`,
  category: "antes_de_reservar",
  question_text: `¿Pregunta del catálogo número ${n}?`,
  suggested_answer: `Respuesta ${n}.`,
  owner: "estured",
  display_order: n * 10,
  is_active: true,
  ...extra,
});
const item = (residence: string, n: number, extra: Row = {}): Row => ({
  id: `it-${residence}-${n}`,
  residence_id: residence,
  predefined_question_id: `FAQ-${String(n).padStart(2, "0")}`,
  is_selected: true,
  answer_override: null,
  is_featured: false,
  featured_order: null,
  ...extra,
});
const free = (id: string, residence: string, extra: Row = {}): Row => ({
  id,
  residence_id: residence,
  question: `Pregunta libre ${id} de un visitante`,
  answer: `Respuesta ${id}`,
  status: "answered",
  answered_at: "2026-11-01T10:00:00Z",
  is_featured: false,
  featured_order: null,
  ...extra,
});

function world(extra: Record<string, Row[]> = {}): Record<string, Row[]> {
  return {
    residence_users: [
      { id: "ru-owner", residence_id: NORTE, user_id: "ricardo", role: "owner", is_active: true },
      { id: "ru-ro", residence_id: NORTE, user_id: "solo-lectura", role: "staff", is_active: true, permissions: permissionsFromChecked([]) },
      { id: "ru-faq", residence_id: NORTE, user_id: "faq-staff", role: "staff", is_active: true, permissions: permissionsFromChecked(["faq.manage"]) },
      { id: "ru-otro", residence_id: OTRA, user_id: "otro-dueno", role: "owner", is_active: true },
    ],
    residence_faq_predefined_questions: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => cat(n)),
    residence_faq_items: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => item(NORTE, n)),
    residence_faq_questions: [free("q1", NORTE), free("q2", NORTE)],
    ...extra,
  };
}
type Db = ReturnType<typeof createInMemorySupabase>;
const asAdmin = (db: Db) => db.client as never;
const save = (db: Db, refs: unknown, actor = "ricardo") => saveFeaturedFaq(asAdmin(db), { actorUserId: actor, residenceId: NORTE, refs });
const featuredIds = (db: Db) =>
  [
    ...db.tables.residence_faq_items.filter((r) => r.is_featured).map((r) => ({ id: r.predefined_question_id as string, order: r.featured_order as number })),
    ...db.tables.residence_faq_questions.filter((r) => r.is_featured).map((r) => ({ id: r.id as string, order: r.featured_order as number })),
  ].sort((a, b) => a.order - b.order);

beforeEach(() => {
  audits.length = 0;
});

describe("loadFeaturedCandidates", () => {
  it("ofrece solo lo que hoy se muestra: catálogo seleccionado y completo + libres respondidas", async () => {
    const db = createInMemorySupabase(
      world({
        residence_faq_items: [item(NORTE, 1), item(NORTE, 2, { is_selected: false }), item(NORTE, 3), item(OTRA, 4)],
        residence_faq_predefined_questions: [cat(1), cat(2), cat(3, { owner: "residence", suggested_answer: "Hay {algo} pendiente" }), cat(4)],
        residence_faq_questions: [free("q1", NORTE), free("q2", NORTE, { status: "hidden" }), free("q3", NORTE, { status: "pending", answer: null }), free("q9", OTRA)],
      }),
    );
    const load = await loadFeaturedCandidates(asAdmin(db), NORTE);
    expect(load.ok).toBe(true);
    if (!load.ok) return;
    expect(load.candidates.map((c) => `${c.ref.kind}:${c.ref.id}`)).toEqual(["catalog:FAQ-01", "free:q1"]);
  });
  it("sin la migración 0096 lo informa para degradar", async () => {
    const db = createInMemorySupabase(world(), { missingColumns: { residence_faq_items: ["is_featured", "featured_order"] } });
    expect(await loadFeaturedCandidates(asAdmin(db), NORTE)).toEqual({ ok: false, reason: "schema_pending" });
  });
});

describe("saveFeaturedFaq: permisos", () => {
  it("el dueño y el staff con faq.manage guardan; queda auditado", async () => {
    const db = createInMemorySupabase(world());
    expect(await save(db, [{ kind: "catalog", id: "FAQ-03" }])).toEqual({ ok: true, count: 1 });
    expect(audits[0]).toMatchObject({ action: "residence_faq_featured_updated", actorRole: "residence_owner" });
    expect((await save(db, [{ kind: "catalog", id: "FAQ-04" }], "faq-staff")).ok).toBe(true);
    expect(audits[1].actorRole).toBe("residence_staff");
  });
  it("sin faq.manage o de otra residencia: no guarda nada", async () => {
    const db = createInMemorySupabase(world());
    expect(await save(db, [{ kind: "catalog", id: "FAQ-01" }], "solo-lectura")).toEqual({ ok: false, error: PERMISSION_DENIED_MESSAGE });
    expect((await save(db, [{ kind: "catalog", id: "FAQ-01" }], "otro-dueno")).ok).toBe(false);
    expect(featuredIds(db)).toEqual([]);
    expect(audits).toHaveLength(0);
  });
});

describe("saveFeaturedFaq: selección", () => {
  it("guarda el orden recibido mezclando catálogo y libres (1..n)", async () => {
    const db = createInMemorySupabase(world());
    await save(db, [{ kind: "free", id: "q2" }, { kind: "catalog", id: "FAQ-05" }, { kind: "catalog", id: "FAQ-01" }]);
    expect(featuredIds(db)).toEqual([
      { id: "q2", order: 1 },
      { id: "FAQ-05", order: 2 },
      { id: "FAQ-01", order: 3 },
    ]);
  });
  it("reemplaza la selección anterior (también la de preguntas que ya no se muestran)", async () => {
    const db = createInMemorySupabase(
      world({
        residence_faq_items: [item(NORTE, 1, { is_featured: true, featured_order: 1 }), item(NORTE, 2, { is_selected: false, is_featured: true, featured_order: 2 }), item(NORTE, 3)],
      }),
    );
    await save(db, [{ kind: "catalog", id: "FAQ-03" }]);
    expect(featuredIds(db)).toEqual([{ id: "FAQ-03", order: 1 }]);
    expect(audits[0].oldValue).toEqual({ featured: [{ kind: "catalog", id: "FAQ-01" }] });
  });
  it("una lista vacía quita todas las destacadas", async () => {
    const db = createInMemorySupabase(world({ residence_faq_items: [item(NORTE, 1, { is_featured: true, featured_order: 1 }), item(NORTE, 2)] }));
    expect(await save(db, [])).toEqual({ ok: true, count: 0 });
    expect(featuredIds(db)).toEqual([]);
  });
  it("máximo 6: con 7 no cambia nada", async () => {
    const db = createInMemorySupabase(world({ residence_faq_items: [item(NORTE, 1, { is_featured: true, featured_order: 1 }), ...[2, 3, 4, 5, 6, 7, 8].map((n) => item(NORTE, n))] }));
    const seven = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ kind: "catalog", id: `FAQ-0${n}` }));
    const r = await save(db, seven);
    expect(r).toMatchObject({ ok: false });
    expect(featuredIds(db)).toEqual([{ id: "FAQ-01", order: 1 }]);
    expect((await save(db, seven.slice(0, 6))).ok).toBe(true);
    expect(featuredIds(db)).toHaveLength(6);
  });
  it("rechaza preguntas de otra residencia, ocultas, sin seleccionar o inexistentes", async () => {
    const db = createInMemorySupabase(
      world({
        residence_faq_items: [item(NORTE, 1), item(NORTE, 2, { is_selected: false }), item(OTRA, 3)],
        residence_faq_questions: [free("q1", NORTE, { status: "hidden" }), free("q9", OTRA)],
      }),
    );
    for (const ref of [{ kind: "catalog", id: "FAQ-02" }, { kind: "catalog", id: "FAQ-03" }, { kind: "catalog", id: "FAQ-77" }, { kind: "free", id: "q1" }, { kind: "free", id: "q9" }]) {
      expect(await save(db, [{ kind: "catalog", id: "FAQ-01" }, ref])).toMatchObject({ ok: false });
    }
    expect(featuredIds(db)).toEqual([]);
  });
  it("no toca las destacadas de otra residencia", async () => {
    const db = createInMemorySupabase(world({ residence_faq_items: [item(NORTE, 1), item(OTRA, 2, { is_featured: true, featured_order: 1 })] }));
    await save(db, [{ kind: "catalog", id: "FAQ-01" }]);
    expect(db.tables.residence_faq_items.find((r) => r.residence_id === OTRA)).toMatchObject({ is_featured: true, featured_order: 1 });
  });
  it("sin la migración 0096 avisa en español", async () => {
    const db = createInMemorySupabase(world(), { missingColumns: { residence_faq_items: ["is_featured", "featured_order"] } });
    expect(await save(db, [{ kind: "catalog", id: "FAQ-01" }])).toEqual({ ok: false, error: FEATURED_MIGRATION_PENDING_MESSAGE });
  });
});

describe("lecturas públicas con las destacadas", () => {
  it("el catálogo y las libres traen isFeatured / featuredOrder", async () => {
    const db = createInMemorySupabase(
      world({
        residence_faq_items: [item(NORTE, 1, { is_featured: true, featured_order: 2 }), item(NORTE, 2)],
        residence_faq_questions: [free("q1", NORTE, { is_featured: true, featured_order: 1 })],
      }),
    );
    const groups = await getPublicCatalogFaq(asAdmin(db), NORTE);
    const items = groups.flatMap((g) => g.items);
    expect(items.find((i) => i.question.includes("número 1"))).toMatchObject({ isFeatured: true, featuredOrder: 2 });
    expect(items.find((i) => i.question.includes("número 2"))).toMatchObject({ isFeatured: false, featuredOrder: null });
    expect((await getPublicAnsweredQuestions(asAdmin(db), NORTE))[0]).toMatchObject({ isFeatured: true, featuredOrder: 1 });
  });
  it("sin la migración 0096 la ficha sigue andando sin esos campos", async () => {
    const missing = { residence_faq_items: ["is_featured", "featured_order"], residence_faq_questions: ["is_featured", "featured_order"] };
    const db = createInMemorySupabase(world(), { missingColumns: missing });
    const groups = await getPublicCatalogFaq(asAdmin(db), NORTE);
    expect(groups.flatMap((g) => g.items)).toHaveLength(8);
    const answered = await getPublicAnsweredQuestions(asAdmin(db), NORTE);
    expect(answered).toHaveLength(2);
  });
});
