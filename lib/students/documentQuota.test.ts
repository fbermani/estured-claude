import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  STUDENT_DOCUMENT_MAX_BYTES,
  STUDENT_DOCUMENT_MAX_FILES,
  exceedsDocumentQuota,
  studentDocumentUsage,
} from "@/lib/students/documentQuota";
import type { SupabaseClient } from "@supabase/supabase-js";

function adminWith(result: { data: { size_bytes: number }[] | null; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "limit"]) chain[m] = () => (m === "limit" ? Promise.resolve(result) : chain);
  return { from: () => chain } as unknown as SupabaseClient;
}

describe("cuota de documentos del estudiante (SEG14-03)", () => {
  it("bajo cupo: admite el archivo", () => {
    expect(exceedsDocumentQuota({ files: 3, bytes: 1_000_000 }, 5_000_000)).toBe(false);
  });
  it("al alcanzar la cantidad máxima: rechaza el siguiente", () => {
    expect(exceedsDocumentQuota({ files: STUDENT_DOCUMENT_MAX_FILES, bytes: 0 }, 1)).toBe(true);
    expect(exceedsDocumentQuota({ files: STUDENT_DOCUMENT_MAX_FILES - 1, bytes: 0 }, 1)).toBe(false);
  });
  it("sobrepasar los bytes acumulados: rechaza", () => {
    expect(exceedsDocumentQuota({ files: 2, bytes: STUDENT_DOCUMENT_MAX_BYTES - 1 }, 2)).toBe(true);
  });
  it("recuento posterior (sin archivo entrante): solo rechaza si el total ya excede", () => {
    expect(exceedsDocumentQuota({ files: STUDENT_DOCUMENT_MAX_FILES, bytes: 10 })).toBe(false);
    expect(exceedsDocumentQuota({ files: STUDENT_DOCUMENT_MAX_FILES + 1, bytes: 10 })).toBe(true);
  });
  it("studentDocumentUsage suma cantidad y bytes, y devuelve null si falla", async () => {
    expect(await studentDocumentUsage(adminWith({ data: [{ size_bytes: 10 }, { size_bytes: 5 }], error: null }), "p")).toEqual({ files: 2, bytes: 15 });
    expect(await studentDocumentUsage(adminWith({ data: null, error: { code: "x" } }), "p")).toBeNull();
  });
});
