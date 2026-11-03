import { describe, expect, it } from "vitest";
import {
  buildEditorRows,
  candidateGenders,
  effectiveGenderState,
  genderOfferLabel,
  genderOffers,
  genderRowTitle,
  offerPolicies,
  parseGenderRow,
  pluralizeTypeName,
  policyOfferLabel,
  rollupTypeAvailability,
  roomGendersOfType,
  suggestedRow,
  summarizeRoomsByGender,
  typeCountDrifted,
  type SuggestionRoom,
} from "@/lib/availability/genderAvailability";

const bed = (status: "active" | "out_of_service" = "active", occupied = false) => ({ status, occupied });

describe("nombres por género", () => {
  it("pluraliza el tipo", () => {
    expect(pluralizeTypeName("Doble")).toBe("Dobles");
    expect(pluralizeTypeName("Individual")).toBe("Individuales");
    expect(pluralizeTypeName("Cuádruple")).toBe("Cuádruples");
    expect(pluralizeTypeName("Compartida")).toBe("Compartidas");
    expect(pluralizeTypeName("Doble con baño")).toBe("Dobles con baño");
    expect(pluralizeTypeName("Luz")).toBe("Luces");
  });

  it("arma el título de la fila y la etiqueta pública", () => {
    expect(genderRowTitle("Doble", "masculino")).toBe("Dobles masculinas");
    expect(genderRowTitle("Doble", "femenino")).toBe("Dobles femeninas");
    expect(genderRowTitle("Individual", "sin_especificar")).toBe("Individuales sin género especificado");
    expect(genderOfferLabel("Doble", "femenino")).toBe("Doble femenina");
    expect(genderOfferLabel("Doble", "sin_especificar")).toBe("Doble");
    expect(genderOfferLabel("Doble", null)).toBe("Doble");
    expect(policyOfferLabel("Triple", "solo_hombres")).toBe("Triple masculina");
    expect(policyOfferLabel("Triple", undefined)).toBe("Triple");
  });
});

describe("sugerencia desde habitaciones y camas", () => {
  const rooms: SuggestionRoom[] = [
    { gender: "masculino", beds: [bed(), bed()] }, // libre entera
    { gender: "masculino", beds: [bed("active", true), bed()] }, // 1 libre
    { gender: "femenino", beds: [bed("active", true), bed("active", true)] }, // completa
    { gender: "femenino", beds: [bed("out_of_service"), bed("out_of_service")] }, // fuera de servicio
    { gender: "sin_especificar", beds: [bed()] },
  ];

  it("cuenta camas libres, habitaciones libres enteras y camas fuera de servicio por género", () => {
    const summary = summarizeRoomsByGender(rooms);
    expect(summary.map((s) => s.gender)).toEqual(["masculino", "femenino", "sin_especificar"]);
    expect(summary[0]).toMatchObject({ rooms: 2, beds: 4, freeBeds: 3, freeRooms: 1, outOfServiceBeds: 0 });
    expect(summary[1]).toMatchObject({ rooms: 2, beds: 2, freeBeds: 0, freeRooms: 0, outOfServiceBeds: 2 });
    expect(summary[2]).toMatchObject({ rooms: 1, freeBeds: 1, freeRooms: 1 });
  });

  it("una habitación sin camas activas no cuenta como libre entera", () => {
    expect(summarizeRoomsByGender([{ gender: "mixto", beds: [] }])[0]).toMatchObject({ rooms: 1, beds: 0, freeBeds: 0, freeRooms: 0 });
  });

  it("sugiere disponible con las camas libres, o completa si no hay ninguna", () => {
    const summary = summarizeRoomsByGender(rooms);
    expect(suggestedRow("masculino", summary[0])).toMatchObject({ status: "available_to_confirm", availableCount: 3 });
    expect(suggestedRow("femenino", summary[1])).toMatchObject({ status: "full", availableCount: 0 });
    expect(suggestedRow("mixto", undefined)).toMatchObject({ status: "full", availableCount: 0 });
  });
});

describe("géneros candidatos de un tipo", () => {
  it("son los de sus habitaciones, en orden", () => {
    expect(candidateGenders(["femenino", "masculino", "femenino"], { policy: "mixto", capacityPerRoom: 2 })).toEqual(["masculino", "femenino"]);
  });

  it("sin habitaciones, cae al género del tipo o a mixto/sin género según la capacidad", () => {
    expect(candidateGenders([], { policy: "solo_mujeres", capacityPerRoom: 2 })).toEqual(["femenino"]);
    expect(candidateGenders([], { policy: null, capacityPerRoom: 2 })).toEqual(["mixto"]);
    expect(candidateGenders([], { policy: null, capacityPerRoom: 1 })).toEqual(["sin_especificar"]);
  });

  it("el género efectivo de las habitaciones hereda el del tipo si no tienen uno propio", () => {
    expect(roomGendersOfType([{ gender: "sin_especificar" }, { gender: "femenino" }, {}], { policy: "solo_hombres", capacityPerRoom: 2 })).toEqual([
      "masculino",
      "femenino",
      "masculino",
    ]);
  });
});

describe("filas del editor", () => {
  const summaries = summarizeRoomsByGender([
    { gender: "masculino", beds: [bed(), bed()] },
    { gender: "femenino", beds: [bed("active", true)] },
  ]);

  it("usa lo guardado, sugiere lo que no está guardado y deja las obsoletas al final", () => {
    const rows = buildEditorRows({
      candidates: ["masculino", "femenino"],
      stored: [
        { gender: "femenino", status: "paused_by_residence", availableCount: null, availableFrom: "2027-03-01", notesPublic: "Marzo" },
        { gender: "mixto", status: "full", availableCount: 0, availableFrom: null, notesPublic: null },
      ],
      summaries,
    });
    expect(rows.map((r) => [r.gender, r.stored, r.obsolete])).toEqual([
      ["masculino", false, false],
      ["femenino", true, false],
      ["mixto", true, true],
    ]);
    expect(rows[0].draft).toMatchObject({ status: "available_to_confirm", availableCount: 2 });
    expect(rows[0].suggestedCount).toBe(2);
    expect(rows[1].draft).toMatchObject({ status: "paused_by_residence", availableFrom: "2027-03-01" });
  });
});

describe("validación de una fila", () => {
  const ok = { status: "available_to_confirm", count: "3", from: "2027-03-01", note: " Entrada en marzo " };

  it("acepta una fila válida y normaliza los vacíos a null", () => {
    expect(parseGenderRow("masculino", ok, "Dobles masculinas")).toEqual({
      ok: true,
      row: { gender: "masculino", status: "available_to_confirm", availableCount: 3, availableFrom: "2027-03-01", notesPublic: "Entrada en marzo" },
    });
    expect(parseGenderRow("mixto", { status: "paused_by_residence", count: "", from: "", note: "" }, "x")).toEqual({
      ok: true,
      row: { gender: "mixto", status: "paused_by_residence", availableCount: null, availableFrom: null, notesPublic: null },
    });
  });

  it("completa fuerza la cantidad en 0", () => {
    const r = parseGenderRow("mixto", { status: "full", count: "4", from: "", note: "" }, "x");
    expect(r.ok && r.row.availableCount).toBe(0);
  });

  it("rechaza estados, cantidades, fechas y notas inválidos con mensaje accionable", () => {
    const bad = (raw: Partial<typeof ok>) => parseGenderRow("mixto", { ...ok, ...raw }, "Dobles mixtas");
    expect(bad({ status: "not_updated" })).toMatchObject({ ok: false, error: expect.stringContaining("estado válido") });
    expect(bad({ status: "paused_by_admin" }).ok).toBe(false);
    expect(bad({ count: "-1" }).ok).toBe(false);
    expect(bad({ count: "2.5" }).ok).toBe(false);
    expect(bad({ count: "abc" }).ok).toBe(false);
    expect(bad({ count: "1000" }).ok).toBe(false);
    expect(bad({ count: "0" })).toMatchObject({ ok: false, error: expect.stringContaining("completa") });
    expect(bad({ from: "2027-02-30" }).ok).toBe(false);
    expect(bad({ from: "01/03/2027" }).ok).toBe(false);
    expect(bad({ note: "x".repeat(301) }).ok).toBe(false);
  });
});

describe("resumen del tipo (rollup)", () => {
  const row = (status: "available_to_confirm" | "full" | "paused_by_residence", availableCount: number | null, availableFrom: string | null = null) => ({
    status,
    availableCount,
    availableFrom,
  });

  it("sin filas no hay resumen", () => {
    expect(rollupTypeAvailability([])).toBeNull();
  });

  it("algún género disponible: disponible, suma las cantidades y toma la fecha más temprana", () => {
    expect(rollupTypeAvailability([row("available_to_confirm", 2, "2027-03-10"), row("available_to_confirm", 3, "2027-03-01"), row("full", 0)])).toEqual({
      status: "available_to_confirm",
      availableCount: 5,
      availableFrom: "2027-03-01",
    });
  });

  it("si un género disponible no informa cantidad, el total queda sin informar; si alguno ya está disponible hoy, sin fecha", () => {
    expect(rollupTypeAvailability([row("available_to_confirm", null), row("available_to_confirm", 3, "2027-03-01")])).toEqual({
      status: "available_to_confirm",
      availableCount: null,
      availableFrom: null,
    });
  });

  it("todos completos (o completos y pausados): completa con cantidad 0", () => {
    expect(rollupTypeAvailability([row("full", 0), row("full", 0)])).toEqual({ status: "full", availableCount: 0, availableFrom: null });
    expect(rollupTypeAvailability([row("full", 0), row("paused_by_residence", null)])).toEqual({ status: "full", availableCount: 0, availableFrom: null });
  });

  it("todos pausados: pausada por la residencia", () => {
    expect(rollupTypeAvailability([row("paused_by_residence", null), row("paused_by_residence", 2)])).toEqual({
      status: "paused_by_residence",
      availableCount: null,
      availableFrom: null,
    });
  });

  it("detecta cuando el total del tipo se movió por una reserva o una salida", () => {
    const rows = [row("available_to_confirm", 2), row("available_to_confirm", 3)];
    expect(typeCountDrifted("available_to_confirm", 5, rows)).toBe(false);
    expect(typeCountDrifted("available_to_confirm", 4, rows)).toBe(true);
    expect(typeCountDrifted("full", 0, rows)).toBe(true);
    expect(typeCountDrifted("not_updated", 1, rows)).toBe(false);
    expect(typeCountDrifted("available_to_confirm", null, rows)).toBe(false);
    expect(typeCountDrifted("available_to_confirm", 5, [])).toBe(false);
  });
});

describe("lo que ve el estudiante", () => {
  it("el estado del tipo manda si es más restrictivo; si el tipo está disponible, cada género muestra el suyo", () => {
    expect(effectiveGenderState("available_to_confirm", "available_to_confirm")).toBe("available");
    expect(effectiveGenderState("available_to_confirm", "full")).toBe("full");
    expect(effectiveGenderState("available_to_confirm", "paused_by_residence")).toBe("paused_by_residence");
    expect(effectiveGenderState("full", "available_to_confirm")).toBe("full");
    expect(effectiveGenderState("not_updated", "available_to_confirm")).toBe("not_updated");
    expect(effectiveGenderState("paused_by_admin", "available_to_confirm")).toBe("paused_by_admin");
    expect(effectiveGenderState(null, "available_to_confirm")).toBe("not_updated");
  });

  it("ordena las ofertas por género y descarta géneros desconocidos", () => {
    const offers = genderOffers("available_to_confirm", [
      { gender: "mixto", status: "available_to_confirm", notesPublic: "  " },
      { gender: "femenino", status: "full", notesPublic: "Lista de espera" },
      { gender: "raro", status: "full" },
      { gender: "masculino", status: "available_to_confirm", availableFrom: "2027-03-01" },
    ]);
    expect(offers.map((o) => [o.gender, o.state, o.note])).toEqual([
      ["masculino", "available", null],
      ["femenino", "full", "Lista de espera"],
      ["mixto", "available", null],
    ]);
  });

  it("deriva las políticas de género sin repetir y sin contar las habitaciones sin género", () => {
    expect(offerPolicies([{ gender: "masculino" }, { gender: "femenino" }, { gender: "masculino" }, { gender: "sin_especificar" }])).toEqual([
      "solo_hombres",
      "solo_mujeres",
    ]);
    expect(offerPolicies([])).toEqual([]);
  });
});
