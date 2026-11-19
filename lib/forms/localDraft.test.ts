import { describe, expect, it } from "vitest";
import {
  DRAFT_MAX_AGE_MS,
  DRAFT_VERSION,
  clearDraft,
  draftStorageKey,
  isDraftStale,
  parseDraft,
  readDraft,
  serializeDraft,
  writeDraft,
  type StorageLike,
} from "@/lib/forms/localDraft";

const validate = (d: unknown) => (typeof d === "object" && d !== null && typeof (d as { text?: unknown }).text === "string" ? (d as { text: string }) : null);

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe("draftStorageKey", () => {
  it("separa por usuario y por entidad", () => {
    expect(draftStorageKey("profile", "u1", "r1")).not.toBe(draftStorageKey("profile", "u2", "r1"));
    expect(draftStorageKey("profile", "u1", "r1")).not.toBe(draftStorageKey("profile", "u1", "r2"));
    expect(draftStorageKey("profile", "u1", "r1")).not.toBe(draftStorageKey("regulation", "u1", "r1"));
  });
});

describe("serializeDraft / parseDraft", () => {
  it("ida y vuelta conserva datos, huella y fecha", () => {
    const raw = serializeDraft({ text: "hola" }, "s1", 1000);
    expect(parseDraft(raw, validate, 2000)).toEqual({ v: DRAFT_VERSION, savedAt: 1000, stamp: "s1", data: { text: "hola" } });
  });
  it("ignora JSON roto, vacío o no objeto", () => {
    expect(parseDraft(null, validate)).toBeNull();
    expect(parseDraft("", validate)).toBeNull();
    expect(parseDraft("{no es json", validate)).toBeNull();
    expect(parseDraft("42", validate)).toBeNull();
    expect(parseDraft("null", validate)).toBeNull();
  });
  it("ignora otra versión de formato", () => {
    const raw = JSON.stringify({ v: DRAFT_VERSION + 1, savedAt: 1, stamp: "s", data: { text: "x" } });
    expect(parseDraft(raw, validate, 2)).toBeNull();
  });
  it("ignora un borrador vencido", () => {
    const raw = serializeDraft({ text: "viejo" }, "s", 0);
    expect(parseDraft(raw, validate, DRAFT_MAX_AGE_MS + 1)).toBeNull();
    expect(parseDraft(raw, validate, DRAFT_MAX_AGE_MS)).not.toBeNull();
  });
  it("ignora campos con tipo equivocado y contenido que el validador rechaza", () => {
    expect(parseDraft(JSON.stringify({ v: DRAFT_VERSION, savedAt: "ayer", stamp: "s", data: { text: "x" } }), validate, 5)).toBeNull();
    expect(parseDraft(JSON.stringify({ v: DRAFT_VERSION, savedAt: 1, stamp: 7, data: { text: "x" } }), validate, 5)).toBeNull();
    expect(parseDraft(JSON.stringify({ v: DRAFT_VERSION, savedAt: 1, stamp: "s", data: { otra: 1 } }), validate, 5)).toBeNull();
  });
});

describe("isDraftStale", () => {
  it("es vieja cuando la huella del servidor cambió", () => {
    expect(isDraftStale({ stamp: "a" }, "a")).toBe(false);
    expect(isDraftStale({ stamp: "a" }, "b")).toBe(true);
  });
});

describe("readDraft / writeDraft / clearDraft", () => {
  it("guarda, lee y limpia", () => {
    const s = memoryStorage();
    expect(writeDraft(s, "k", { text: "uno" }, "st", 10)).toBe(true);
    expect(readDraft(s, "k", validate, 20)?.data).toEqual({ text: "uno" });
    clearDraft(s, "k");
    expect(readDraft(s, "k", validate, 20)).toBeNull();
  });
  it("sin almacenamiento no falla: avisa con false/null", () => {
    expect(writeDraft(null, "k", { text: "x" }, "s")).toBe(false);
    expect(readDraft(null, "k", validate)).toBeNull();
    expect(() => clearDraft(null, "k")).not.toThrow();
  });
  it("tolera un almacenamiento que lanza (cuota llena, bloqueado)", () => {
    const roto: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(writeDraft(roto, "k", { text: "x" }, "s")).toBe(false);
    expect(readDraft(roto, "k", validate)).toBeNull();
    expect(() => clearDraft(roto, "k")).not.toThrow();
  });
});
