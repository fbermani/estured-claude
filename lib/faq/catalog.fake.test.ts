import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const audits = vi.hoisted(() => [] as { actorRole: string; action: string; entityId?: string | null; newValue?: unknown }[]);
vi.mock("@/lib/audit", () => ({
  createAuditLog: async (_a: unknown, e: (typeof audits)[number]) => {
    audits.push(e);
    return true;
  },
}));

import { createInMemorySupabase, type Row } from "@/lib/testing/inMemorySupabase";
import { PERMISSION_DENIED_MESSAGE, permissionsFromChecked } from "@/lib/residences/permissions";
import {
  CATALOG_MIGRATION_PENDING_MESSAGE,
  getPublicCatalogFaq,
  loadCatalogForResidence,
  saveCatalogItem,
} from "@/lib/faq/residenceCatalog";
import { checkCatalogSave, hasUnfilledFields, isEditableOwner, listUnfilledFields } from "@/lib/faq/catalog";

const NORTE = "res-norte";
const OTRA = "res-otra";

const FIJA = { id: "FAQ-02", category: "antes_de_reservar", question_text: "¿Qué pasa cuando envío una solicitud?", suggested_answer: "Enviar una solicitud es gratis.", owner: "estured", display_order: 20, is_active: true };
const CAMPOS = { id: "FAQ-25", category: "convivencia_y_reglas", question_text: "¿Hay toque de queda?", suggested_answer: "{toque_de_queda: No / Sí, cierra a las {hora_cierre}}. Respetá el silencio de {franjas_de_silencio}.", owner: "residence", display_order: 250, is_active: true };
const SIN_CAMPOS = { id: "FAQ-39", category: "que_llevar", question_text: "¿Hay internet?", suggested_answer: "Sí, hay wifi en toda la residencia.", owner: "residence", display_order: 390, is_active: true };
const BAJA = { id: "FAQ-49", category: "privacidad_y_seguridad", question_text: "¿Emergencias?", suggested_answer: "Llamá al número local.", owner: "residence", display_order: 490, is_active: false };

function world(extra: Record<string, Row[]> = {}): Record<string, Row[]> {
  return {
    residence_users: [
      { id: "ru-owner", residence_id: NORTE, user_id: "ricardo", role: "owner", is_active: true },
      { id: "ru-ro", residence_id: NORTE, user_id: "solo-lectura", role: "staff", is_active: true, permissions: permissionsFromChecked([]) },
      { id: "ru-faq", residence_id: NORTE, user_id: "faq-staff", role: "staff", is_active: true, permissions: permissionsFromChecked(["faq.manage"]) },
      { id: "ru-otro", residence_id: OTRA, user_id: "otro-dueno", role: "owner", is_active: true },
    ],
    residence_faq_predefined_questions: [FIJA, CAMPOS, SIN_CAMPOS, BAJA].map((q) => ({ ...q })),
    residence_faq_items: [],
    ...extra,
  };
}
type Db = ReturnType<typeof createInMemorySupabase>;
const asAdmin = (db: Db) => db.client as never;
const save = (db: Db, over: Partial<Parameters<typeof saveCatalogItem>[1]>) =>
  saveCatalogItem(asAdmin(db), { actorUserId: "ricardo", residenceId: NORTE, questionId: "FAQ-39", selected: true, answer: "", ...over });

describe("campos {…} del catálogo", () => {
  it("detecta los pendientes, también anidados", () => {
    expect(hasUnfilledFields("Hola {x}")).toBe(true);
    expect(hasUnfilledFields("Todo completo.")).toBe(false);
    expect(listUnfilledFields(CAMPOS.suggested_answer)).toEqual(["toque_de_queda", "hora_cierre", "franjas_de_silencio"]);
  });
  it("solo las de la residencia son editables", () => {
    expect(isEditableOwner("residence")).toBe(true);
    expect(isEditableOwner("estured")).toBe(false);
    expect(isEditableOwner("mixed" as never)).toBe(false);
  });
  it("las «EstuRed fija» ignoran cualquier edición", () => {
    expect(checkCatalogSave(FIJA as never, { selected: true, answer: "otro texto" })).toEqual({ ok: true, override: null });
  });
  it("sin cambios o igual a la sugerida no genera override", () => {
    expect(checkCatalogSave(SIN_CAMPOS as never, { selected: true, answer: "  " })).toEqual({ ok: true, override: null });
    expect(checkCatalogSave(SIN_CAMPOS as never, { selected: true, answer: SIN_CAMPOS.suggested_answer })).toEqual({ ok: true, override: null });
  });
});

describe("saveCatalogItem", () => {
  it("el dueño muestra una pregunta sin campos y queda auditado", async () => {
    audits.length = 0;
    const db = createInMemorySupabase(world());
    const r = await save(db, {});
    expect(r).toEqual({ ok: true, selected: true });
    expect(db.tables.residence_faq_items).toHaveLength(1);
    expect(db.tables.residence_faq_items[0]).toMatchObject({ residence_id: NORTE, predefined_question_id: "FAQ-39", is_selected: true, answer_override: null });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: "residence_faq_catalog_item_saved", actorRole: "residence_owner" });
  });

  it("no permite mostrar con campos sin completar, pero sí guardar el borrador oculta", async () => {
    const db = createInMemorySupabase(world());
    const bad = await save(db, { questionId: "FAQ-25", selected: true, answer: CAMPOS.suggested_answer });
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.error).toMatch(/Completá los datos/);
    expect(db.tables.residence_faq_items).toHaveLength(0);

    const draft = await save(db, { questionId: "FAQ-25", selected: false, answer: "{toque_de_queda}" });
    expect(draft.ok).toBe(true);
    expect(db.tables.residence_faq_items[0].answer_override).toBe("{toque_de_queda}");
  });

  it("con los campos completados se muestra y guarda el override; editar de nuevo actualiza la misma fila", async () => {
    const db = createInMemorySupabase(world());
    expect((await save(db, { questionId: "FAQ-25", answer: "No, podés entrar y salir libremente. Silencio de 23 a 7." })).ok).toBe(true);
    expect((await save(db, { questionId: "FAQ-25", answer: "Sí, cierra a las 23 hs." })).ok).toBe(true);
    expect(db.tables.residence_faq_items).toHaveLength(1);
    expect(db.tables.residence_faq_items[0].answer_override).toBe("Sí, cierra a las 23 hs.");
  });

  it("una «EstuRed fija» se puede mostrar pero nunca guarda override", async () => {
    const db = createInMemorySupabase(world());
    const r = await save(db, { questionId: "FAQ-02", answer: "Prometemos lugar garantizado" });
    expect(r.ok).toBe(true);
    expect(db.tables.residence_faq_items[0].answer_override).toBeNull();
  });

  it("rechaza preguntas inexistentes o dadas de baja", async () => {
    const db = createInMemorySupabase(world());
    expect((await save(db, { questionId: "FAQ-99" })).ok).toBe(false);
    expect((await save(db, { questionId: "FAQ-49" })).ok).toBe(false);
    expect(db.tables.residence_faq_items).toHaveLength(0);
  });

  it("permisos: staff con faq.manage puede; sin permiso, extraño y otra residencia no", async () => {
    const db = createInMemorySupabase(world());
    expect((await save(db, { actorUserId: "faq-staff" })).ok).toBe(true);
    const ro = await save(db, { actorUserId: "solo-lectura", questionId: "FAQ-02" });
    expect(!ro.ok && ro.error).toBe(PERMISSION_DENIED_MESSAGE);
    expect((await save(db, { actorUserId: "otro-dueno", questionId: "FAQ-02" })).ok).toBe(false);
    expect((await save(db, { actorUserId: "nadie", questionId: "FAQ-02" })).ok).toBe(false);
    expect(db.tables.residence_faq_items).toHaveLength(1);
    expect(db.tables.residence_faq_items[0].residence_id).toBe(NORTE);
  });

  it("degrada con gracia si la 0054 no está aplicada", async () => {
    const db = createInMemorySupabase(world(), { missingTables: ["residence_faq_predefined_questions", "residence_faq_items"] });
    const r = await save(db, {});
    expect(!r.ok && r.error).toBe(CATALOG_MIGRATION_PENDING_MESSAGE);
    expect(await loadCatalogForResidence(asAdmin(db), NORTE)).toEqual({ ok: false, reason: "schema_pending" });
    expect(await getPublicCatalogFaq(asAdmin(db), NORTE)).toEqual([]);
  });
});

describe("loadCatalogForResidence / getPublicCatalogFaq", () => {
  it("la pantalla trae solo el catálogo activo con la selección de ESTA residencia", async () => {
    const db = createInMemorySupabase(
      world({
        residence_faq_items: [
          { id: "i1", residence_id: NORTE, predefined_question_id: "FAQ-39", is_selected: true, answer_override: null },
          { id: "i2", residence_id: OTRA, predefined_question_id: "FAQ-02", is_selected: true, answer_override: null },
        ],
      }),
    );
    const r = await loadCatalogForResidence(asAdmin(db), NORTE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entries.map((e) => e.id)).toEqual(["FAQ-02", "FAQ-25", "FAQ-39"]);
    expect(r.entries.find((e) => e.id === "FAQ-39")?.selection?.is_selected).toBe(true);
    expect(r.entries.find((e) => e.id === "FAQ-02")?.selection).toBeNull();
  });

  it("la ficha agrupa por tema, usa el override o la sugerida y omite lo incompleto, oculto o dado de baja", async () => {
    const db = createInMemorySupabase(
      world({
        residence_faq_items: [
          { id: "i1", residence_id: NORTE, predefined_question_id: "FAQ-39", is_selected: true, answer_override: "Wifi en todos los pisos." },
          { id: "i2", residence_id: NORTE, predefined_question_id: "FAQ-02", is_selected: true, answer_override: "texto viejo que no debe verse" },
          { id: "i3", residence_id: NORTE, predefined_question_id: "FAQ-25", is_selected: true, answer_override: null }, // sugerida con campos
          { id: "i4", residence_id: NORTE, predefined_question_id: "FAQ-49", is_selected: true, answer_override: null }, // dada de baja
          { id: "i5", residence_id: OTRA, predefined_question_id: "FAQ-39", is_selected: true, answer_override: "de otra residencia" },
        ],
      }),
    );
    const groups = await getPublicCatalogFaq(asAdmin(db), NORTE);
    expect(groups.map((g) => g.label)).toEqual(["Antes de reservar", "Qué llevar"]);
    expect(groups[0].items).toEqual([{ question: FIJA.question_text, answer: FIJA.suggested_answer }]);
    expect(groups[1].items).toEqual([{ question: SIN_CAMPOS.question_text, answer: "Wifi en todos los pisos." }]);
  });

  it("sin selección no devuelve nada (la ficha no muestra la sección)", async () => {
    const db = createInMemorySupabase(world({ residence_faq_items: [{ id: "i1", residence_id: NORTE, predefined_question_id: "FAQ-39", is_selected: false, answer_override: null }] }));
    expect(await getPublicCatalogFaq(asAdmin(db), NORTE)).toEqual([]);
  });
});
