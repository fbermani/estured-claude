import { describe, expect, it } from "vitest";
import {
  canResidenceMoveRoomChange,
  canStudentCancelRoomChange,
  describePreference,
  matchingRequestIds,
  parsePlaceAlertDecision,
  requestMatchesPlace,
  validateRoomChangePreference,
  ROOM_CHANGE_COSTS_NOTICE,
  ROOM_CHANGE_NOTE_MAX,
} from "@/lib/roomChange/rules";

const TYPE_A = "11111111-1111-4111-8111-111111111111";
const TYPE_B = "22222222-2222-4222-8222-222222222222";

const req = (over: Partial<Parameters<typeof requestMatchesPlace>[0]> = {}) => ({
  id: "r1",
  residentStayId: "s1",
  status: "pending",
  preferredRoomTypeId: null as string | null,
  preferredGender: null as string | null,
  ...over,
});

describe("validateRoomChangePreference", () => {
  it("acepta una sola preferencia y normaliza vacíos a null", () => {
    const r = validateRoomChangePreference({ roomTypeId: "", gender: "femenino", note: "  ", reason: "" });
    expect(r).toEqual({ ok: true, value: { roomTypeId: null, gender: "femenino", note: null, reason: null } });
  });
  it("exige al menos una preferencia (tipo, género o nota)", () => {
    const r = validateRoomChangePreference({ roomTypeId: "", gender: "", note: "", reason: "Quiero cambiar" });
    expect(r.ok).toBe(false);
  });
  it("una nota sola alcanza", () => {
    expect(validateRoomChangePreference({ roomTypeId: null, gender: null, note: "3.er piso", reason: null }).ok).toBe(true);
  });
  it("rechaza género inválido, tipo que no es UUID y textos largos", () => {
    expect(validateRoomChangePreference({ roomTypeId: TYPE_A, gender: "sin_especificar", note: "", reason: "" }).ok).toBe(false);
    expect(validateRoomChangePreference({ roomTypeId: "no-uuid", gender: "", note: "x", reason: "" }).ok).toBe(false);
    expect(validateRoomChangePreference({ roomTypeId: TYPE_A, gender: "", note: "x".repeat(ROOM_CHANGE_NOTE_MAX + 1), reason: "" }).ok).toBe(false);
    expect(validateRoomChangePreference({ roomTypeId: TYPE_A, gender: "", note: "", reason: "x".repeat(501) }).ok).toBe(false);
  });
  it("tolera valores que no son texto", () => {
    expect(validateRoomChangePreference({ roomTypeId: 5, gender: {}, note: null, reason: undefined }).ok).toBe(false);
  });
});

describe("requestMatchesPlace", () => {
  it("«me da igual» (sin preferencia de tipo ni género) coincide con cualquier plaza", () => {
    expect(requestMatchesPlace(req(), { roomTypeId: TYPE_A, gender: "mixto" })).toBe(true);
  });
  it("respeta el tipo pedido", () => {
    expect(requestMatchesPlace(req({ preferredRoomTypeId: TYPE_A }), { roomTypeId: TYPE_A, gender: "mixto" })).toBe(true);
    expect(requestMatchesPlace(req({ preferredRoomTypeId: TYPE_A }), { roomTypeId: TYPE_B, gender: "mixto" })).toBe(false);
  });
  it("respeta el género pedido y no avisa por una plaza sin género definido", () => {
    expect(requestMatchesPlace(req({ preferredGender: "femenino" }), { roomTypeId: TYPE_A, gender: "femenino" })).toBe(true);
    expect(requestMatchesPlace(req({ preferredGender: "femenino" }), { roomTypeId: TYPE_A, gender: "masculino" })).toBe(false);
    expect(requestMatchesPlace(req({ preferredGender: "femenino" }), { roomTypeId: TYPE_A, gender: "mixto" })).toBe(false);
    expect(requestMatchesPlace(req({ preferredGender: "femenino" }), { roomTypeId: TYPE_A, gender: "sin_especificar" })).toBe(false);
    expect(requestMatchesPlace(req({ preferredGender: "femenino" }), { roomTypeId: TYPE_A, gender: null })).toBe(false);
    // Sin preferencia de género sí coincide aunque la plaza no tenga género.
    expect(requestMatchesPlace(req(), { roomTypeId: TYPE_A, gender: null })).toBe(true);
  });
  it("solo los pedidos pendientes (uno en gestión ya lo está viendo la residencia)", () => {
    expect(requestMatchesPlace(req({ status: "offered" }), { roomTypeId: TYPE_A, gender: "mixto" })).toBe(false);
    expect(requestMatchesPlace(req({ status: "cancelled" }), { roomTypeId: TYPE_A, gender: "mixto" })).toBe(false);
  });
  it("nunca avisa a quien dejó la plaza", () => {
    expect(requestMatchesPlace(req({ residentStayId: "s1" }), { roomTypeId: TYPE_A, gender: "mixto" }, "s1")).toBe(false);
    expect(requestMatchesPlace(req({ residentStayId: "s2" }), { roomTypeId: TYPE_A, gender: "mixto" }, "s1")).toBe(true);
  });
  it("matchingRequestIds devuelve solo los que coinciden", () => {
    const ids = matchingRequestIds(
      [req({ id: "a", preferredRoomTypeId: TYPE_A }), req({ id: "b", preferredRoomTypeId: TYPE_B }), req({ id: "c" })],
      { roomTypeId: TYPE_A, gender: "mixto" },
    );
    expect(ids).toEqual(["a", "c"]);
  });
});

describe("transiciones", () => {
  it("la residencia mueve pendiente ⇄ en gestión y cierra; lo cerrado no se reabre", () => {
    expect(canResidenceMoveRoomChange("pending", "offered")).toBe(true);
    expect(canResidenceMoveRoomChange("offered", "pending")).toBe(true);
    expect(canResidenceMoveRoomChange("offered", "resolved")).toBe(true);
    expect(canResidenceMoveRoomChange("pending", "cancelled")).toBe(true);
    expect(canResidenceMoveRoomChange("pending", "pending")).toBe(false);
    expect(canResidenceMoveRoomChange("resolved", "pending")).toBe(false);
    expect(canResidenceMoveRoomChange("cancelled", "offered")).toBe(false);
  });
  it("el estudiante solo cancela un pedido abierto", () => {
    expect(canStudentCancelRoomChange("pending")).toBe(true);
    expect(canStudentCancelRoomChange("offered")).toBe(true);
    expect(canStudentCancelRoomChange("resolved")).toBe(false);
    expect(canStudentCancelRoomChange("cancelled")).toBe(false);
  });
  it("decisiones válidas", () => {
    expect(parsePlaceAlertDecision("offer")).toBe("offer");
    expect(parsePlaceAlertDecision("publish")).toBe("publish");
    expect(parsePlaceAlertDecision("ignore")).toBe("ignore");
    expect(parsePlaceAlertDecision("delete")).toBeNull();
    expect(parsePlaceAlertDecision(null)).toBeNull();
  });
});

describe("copy", () => {
  it("el texto de costos no promete disponibilidad ni garantías y aclara que no se cobra", () => {
    const t = ROOM_CHANGE_COSTS_NOTICE.toLowerCase();
    expect(t).toContain("sujeto a la disponibilidad");
    expect(t).toContain("costos");
    expect(t).toContain("no cobra");
    expect(t).not.toMatch(/garantiz|asegurad|mediaci/);
  });
  it("describePreference arma una etiqueta escaneable", () => {
    expect(describePreference({ typeName: "Doble", gender: "femenino", note: "3.er piso" })).toBe("Doble · Femenina · 3.er piso");
    expect(describePreference({ typeName: null, gender: null, note: null })).toBe("Sin preferencia");
  });
});
