import { describe, expect, it } from "vitest";
import {
  MAX_NOTIFY_BATCH,
  describeBatchResult,
  filterBoardEntries,
  isWaitingConfirmed,
  notifiedColumns,
  planNotifyBatch,
} from "@/lib/waitlist-entries/board";

const NOW = new Date("2026-11-10T15:00:00Z");
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const entry = (n: number, status = "active", month: string | null = "2026-12-01") => ({ id: id(n), status, desired_start_date: month });

describe("planNotifyBatch (aviso por lote, DR41)", () => {
  it("avisa solo active y retention_check_sent; ignora el resto con motivo", () => {
    const found = [entry(1), entry(2, "retention_check_sent"), entry(3, "availability_notification_sent"), entry(4, "removed_by_student")];
    const r = planNotifyBatch([id(1), id(2), id(3), id(4), id(5)], found, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.eligible.map((e) => e.id)).toEqual([id(1), id(2)]);
    expect(r.plan.skipped.map((s) => s.entryId)).toEqual([id(3), id(4), id(5)]);
    expect(r.plan.skipped[0].reason).toMatch(/Ya la avisaste/);
  });

  it("ignora las de mes ya terminado y deduplica ids", () => {
    const r = planNotifyBatch([id(1), id(1), id(2)], [entry(1, "active", "2026-09-01"), entry(2, "active", null)], NOW);
    if (!r.ok) throw new Error("debería ser ok");
    expect(r.plan.ids).toHaveLength(2);
    expect(r.plan.eligible.map((e) => e.id)).toEqual([id(2)]);
    expect(r.plan.skipped[0].reason).toMatch(/mes de ingreso/);
  });

  it("rechaza selección vacía, ids inválidos y más del tope", () => {
    expect(planNotifyBatch([], [], NOW).ok).toBe(false);
    expect(planNotifyBatch("x", [], NOW).ok).toBe(false);
    expect(planNotifyBatch(["no-es-uuid"], [], NOW).ok).toBe(false);
    const many = Array.from({ length: MAX_NOTIFY_BATCH + 1 }, (_, i) => id(i + 1));
    const r = planNotifyBatch(many, [], NOW);
    expect(r.ok).toBe(false);
    expect(planNotifyBatch(many.slice(0, MAX_NOTIFY_BATCH), [], NOW).ok).toBe(true);
  });
});

describe("resultado parcial y marca «Decidió esperar»", () => {
  it("describe cuántos salieron y por qué no el resto", () => {
    const text = describeBatchResult({
      notified: 3,
      failed: [{ entryId: id(1), reason: "La entrada cambió mientras tanto." }],
      skipped: [{ entryId: id(2), reason: "Ya la avisaste y está esperando respuesta." }],
    });
    expect(text).toContain("Avisamos a 3 personas.");
    expect(text).toContain("No pudimos con 2");
    expect(describeBatchResult({ notified: 1, failed: [], skipped: [] })).toBe("Avisamos a 1 persona.");
    expect(describeBatchResult({ notified: 0, failed: [], skipped: [] })).toBe("No avisamos a nadie.");
  });

  it("el pill solo aparece en active con waiting_confirmed_at; reavisar lo limpia", () => {
    expect(isWaitingConfirmed({ status: "active", waiting_confirmed_at: "2026-11-05T10:00:00Z" })).toBe(true);
    expect(isWaitingConfirmed({ status: "active", waiting_confirmed_at: null })).toBe(false);
    expect(isWaitingConfirmed({ status: "availability_notification_sent", waiting_confirmed_at: "2026-11-05T10:00:00Z" })).toBe(false);
    expect(notifiedColumns("2026-11-10T15:00:00Z")).toEqual({ notified_at: "2026-11-10T15:00:00Z", waiting_confirmed_at: null });
  });
});

describe("filterBoardEntries", () => {
  const e = (name: string, status: string, month: string | null, confirmed: string | null = null) => ({
    status,
    desired_start_date: month,
    waiting_confirmed_at: confirmed,
    student_profiles: { first_name: name, last_initial: "R" },
  });
  const list = [
    e("Camila", "active", "2026-11-01"),
    e("Mateo", "availability_notification_sent", "2026-12-01"),
    e("Álvaro", "active", null, "2026-11-05T10:00:00Z"),
  ];

  it("busca por nombre sin importar acentos ni mayúsculas", () => {
    expect(filterBoardEntries(list, { q: "alvaro", mes: "all", estado: "all" }, NOW)).toHaveLength(1);
  });
  it("filtra por mes, este mes y cuando haya lugar", () => {
    expect(filterBoardEntries(list, { q: "", mes: "este-mes", estado: "all" }, NOW).map((x) => x.student_profiles!.first_name)).toEqual(["Camila"]);
    expect(filterBoardEntries(list, { q: "", mes: "cuando-haya-lugar", estado: "all" }, NOW)).toHaveLength(1);
    expect(filterBoardEntries(list, { q: "", mes: "2026-12-01", estado: "all" }, NOW)).toHaveLength(1);
  });
  it("filtra por estado: avisados, en espera y decidieron esperar", () => {
    expect(filterBoardEntries(list, { q: "", mes: "all", estado: "avisados" }, NOW)).toHaveLength(1);
    expect(filterBoardEntries(list, { q: "", mes: "all", estado: "en-espera" }, NOW)).toHaveLength(2);
    expect(filterBoardEntries(list, { q: "", mes: "all", estado: "decidieron-esperar" }, NOW)).toHaveLength(1);
  });
});
