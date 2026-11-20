import { describe, expect, it } from "vitest";
import { buildPreviewResidence, pickPreviewCover } from "@/lib/residences/profilePreview";
import { UNIVERSITY_OTHER_NAME } from "@/lib/data/buenosAiresUniversities";

const base = {
  slug: "casa-demo",
  name: "Casa Demo",
  zone: "Palermo",
  status: "draft",
  availabilityMode: "by_room_type_to_confirm" as const,
  description: "Linda",
  services: ["Wifi", "Gimnasio"],
  commonAreas: ["Terraza"],
  nearUniversities: ["UBA - Facultad de Derecho", UNIVERSITY_OTHER_NAME],
  roomTypes: [
    { name: "Doble", monthlyPriceUsd: 400, roomCount: 3, capacityPerRoom: 2, genderPolicy: "mixto" },
    { name: "Individual", monthlyPriceUsd: 550, roomCount: 2, capacityPerRoom: 1, genderPolicy: "solo_mujeres" },
  ],
  photos: [],
  location: null,
};

describe("pickPreviewCover", () => {
  it("prefiere la portada aprobada, si no la primera aprobada, y nunca una pendiente", () => {
    expect(pickPreviewCover([{ url: "a", pending: false, isCover: false }, { url: "b", pending: false, isCover: true }])).toBe("b");
    expect(pickPreviewCover([{ url: "a", pending: false, isCover: false }, { url: "b", pending: false, isCover: false }])).toBe("a");
    expect(pickPreviewCover([{ url: "p", pending: true, isCover: true }])).toBeNull();
    expect(pickPreviewCover([])).toBeNull();
  });
});

describe("buildPreviewResidence", () => {
  it("toma el precio «desde» del tipo más barato y suma las plazas", () => {
    const r = buildPreviewResidence(base);
    expect(r.priceFromUsd).toBe(400);
    expect(r.capacityPlaces).toBe(8);
    expect(r.roomTypes.map((t) => t.type)).toEqual(["Doble", "Individual"]);
  });
  it("el sello de verificada solo con la residencia publicada", () => {
    expect(buildPreviewResidence(base).verificationStatus).toBe("pending_verification");
    expect(buildPreviewResidence({ ...base, status: "verified_active" })).toMatchObject({ verificationStatus: "verified_active", published: true });
  });
  it("usa la foto de portada real o ninguna (la tarjeta pone el fondo de marca)", () => {
    expect(buildPreviewResidence(base).photos).toEqual([]);
    expect(buildPreviewResidence({ ...base, photos: [{ url: "u", pending: false, isCover: true }] }).photos).toEqual(["u"]);
  });
  it("no muestra «Otra universidad o instituto» y pasa servicios y áreas normalizados (Gimnasio va a áreas)", () => {
    const r = buildPreviewResidence(base);
    expect(r.nearUniversities).toEqual(["UBA - Facultad de Derecho"]);
    expect(r.services).toEqual(["Wifi"]);
    expect(r.commonAreas).toEqual(expect.arrayContaining(["Terraza", "Gimnasio"]));
  });
  it("suma los ítems «Otro» aprobados sin repetir", () => {
    const r = buildPreviewResidence({ ...base, approvedExtraServices: ["Bicicletero", "Wifi"], approvedExtraAreas: ["Huerta"] });
    expect(r.services).toEqual(["Wifi", "Bicicletero"]);
    expect(r.commonAreas).toContain("Huerta");
  });
  it("deriva el género de los tipos: uno solo o «mixto» si hay varios", () => {
    const r = buildPreviewResidence(base);
    expect(r.genderPolicy).toBe("mixto");
    expect(r.genderPolicies).toEqual(["mixto", "solo_mujeres"]);
    expect(buildPreviewResidence({ ...base, roomTypes: [base.roomTypes[1]] }).genderPolicy).toBe("solo_mujeres");
  });
  it("la disponibilidad es la guardada: no se inventa", () => {
    expect(buildPreviewResidence({ ...base, availabilityMode: "full" })).toMatchObject({ availabilityMode: "full", hasWaitlist: true, availabilityHint: "waitlist" });
    expect(buildPreviewResidence(base).availabilityHint).toBeNull();
  });
  it("sin tarifas válidas el «desde» queda en 0 (el formulario exige tarifa mayor a 0 al guardar) y sin barrio dice CABA", () => {
    const r = buildPreviewResidence({ ...base, zone: "", roomTypes: [{ name: "Doble", monthlyPriceUsd: 0, roomCount: 1, capacityPerRoom: 2 }] });
    expect(r.priceFromUsd).toBe(0);
    expect(r.zone).toBe("CABA");
  });
});
