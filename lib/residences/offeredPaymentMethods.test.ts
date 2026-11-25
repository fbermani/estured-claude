import { describe, expect, it } from "vitest";
import { isPaymentMethodKey } from "@/lib/payments/paymentMethods";
import {
  ALTERNATIVE_PREFERENCE_KEY,
  COLLECTION_ALTERNATIVE_LABEL,
  COLLECTION_ALTERNATIVE_RESIDENCE_LABEL,
  COLLECTION_LIABILITY_NOTICE,
  COLLECTION_PREFERENCE_NOTICE,
  collectionAlternativeNotice,
  contactCollectionNotice,
  methodsPreferenceNotice,
  offeredReservationCollection,
  resolvePreferredPaymentMethod,
  type ReservationCollectionOffer,
} from "@/lib/residences/offeredPaymentMethods";

const approved = (...keys: string[]) => keys.map((methodKey) => ({ methodKey, methodLabel: null }));

describe("offeredReservationCollection", () => {
  it("sin configurar (null o vacío) es contacto", () => {
    expect(offeredReservationCollection({ modes: null, acceptedMethods: null, approved: [] })).toEqual({ kind: "contact" });
    expect(offeredReservationCollection({ modes: [], acceptedMethods: ["cash"], approved: approved("cash") })).toEqual({ kind: "contact" });
  });

  it("solo contacto directo es contacto aunque haya medios cargados", () => {
    const offer = offeredReservationCollection({ modes: ["whatsapp_direct"], acceptedMethods: ["cash"], approved: approved("cash") });
    expect(offer).toEqual({ kind: "contact" });
  });

  it("con medios habilitados ofrece los aceptados con datos aprobados, en orden de catálogo", () => {
    const offer = offeredReservationCollection({
      modes: ["enabled_methods"],
      acceptedMethods: ["uala", "mercadopago", "cash"],
      approved: approved("uala", "cash", "mercadopago"),
    });
    expect(offer).toEqual({
      kind: "methods",
      methods: [
        { key: "cash", label: "Efectivo" },
        { key: "mercadopago", label: "MercadoPago" },
        { key: "uala", label: "Ualá" },
      ],
    });
  });

  it("con ambas opciones activas ofrece los medios", () => {
    const offer = offeredReservationCollection({
      modes: ["enabled_methods", "whatsapp_direct"],
      acceptedMethods: ["transfer_ars"],
      approved: approved("transfer_ars"),
    });
    expect(offer.kind).toBe("methods");
  });

  it("un medio aceptado sin datos aprobados (solo pendiente o sin fila) no se ofrece", () => {
    const offer = offeredReservationCollection({
      modes: ["enabled_methods"],
      acceptedMethods: ["mercadopago", "uala"],
      approved: approved("mercadopago"),
    });
    expect(offer).toEqual({ kind: "methods", methods: [{ key: "mercadopago", label: "MercadoPago" }] });
  });

  it("un medio con datos aprobados pero que la residencia ya no acepta no se ofrece", () => {
    const offer = offeredReservationCollection({ modes: ["enabled_methods"], acceptedMethods: ["cash"], approved: approved("cash", "belo") });
    expect(offer).toEqual({ kind: "methods", methods: [{ key: "cash", label: "Efectivo" }] });
  });

  it("con medios habilitados pero ninguno aprobado degrada a contacto", () => {
    expect(offeredReservationCollection({ modes: ["enabled_methods"], acceptedMethods: ["cash"], approved: [] })).toEqual({ kind: "contact" });
    expect(offeredReservationCollection({ modes: ["enabled_methods"], acceptedMethods: [], approved: approved("cash") })).toEqual({ kind: "contact" });
  });

  it("«Otro» usa el nombre aprobado y sin nombre no se ofrece", () => {
    const withLabel = offeredReservationCollection({
      modes: ["enabled_methods"],
      acceptedMethods: ["other"],
      approved: [{ methodKey: "other", methodLabel: "Giro Rapipago" }],
    });
    expect(withLabel).toEqual({ kind: "methods", methods: [{ key: "other", label: "Giro Rapipago" }] });
    const withoutLabel = offeredReservationCollection({
      modes: ["enabled_methods"],
      acceptedMethods: ["other"],
      approved: [{ methodKey: "other", methodLabel: "  " }],
    });
    expect(withoutLabel).toEqual({ kind: "contact" });
  });

  it("ignora claves que no son del catálogo", () => {
    const offer = offeredReservationCollection({ modes: ["enabled_methods"], acceptedMethods: ["bitcoin", "cash"], approved: approved("bitcoin", "cash") });
    expect(offer).toEqual({ kind: "methods", methods: [{ key: "cash", label: "Efectivo" }] });
  });

  it("no expone datos de cobro: solo clave y nombre", () => {
    const offer = offeredReservationCollection({ modes: ["enabled_methods"], acceptedMethods: ["cash"], approved: approved("cash") });
    expect(JSON.stringify(offer)).not.toMatch(/details/i);
    if (offer.kind === "methods") expect(Object.keys(offer.methods[0]).sort()).toEqual(["key", "label"]);
  });
});

describe("resolvePreferredPaymentMethod", () => {
  const methods: ReservationCollectionOffer = {
    kind: "methods",
    methods: [
      { key: "mercadopago", label: "MercadoPago" },
      { key: "transfer_ars", label: "Transferencia en pesos" },
    ],
  };
  const contact: ReservationCollectionOffer = { kind: "contact" };

  it("ausente o vacío (sin preferencia) guarda null", () => {
    expect(resolvePreferredPaymentMethod(null, methods)).toEqual({ ok: true, value: null });
    expect(resolvePreferredPaymentMethod(undefined, methods)).toEqual({ ok: true, value: null });
    expect(resolvePreferredPaymentMethod("", methods)).toEqual({ ok: true, value: null });
    expect(resolvePreferredPaymentMethod("   ", contact)).toEqual({ ok: true, value: null });
  });

  it("una clave ofrecida se guarda", () => {
    expect(resolvePreferredPaymentMethod("mercadopago", methods)).toEqual({ ok: true, value: "mercadopago" });
    expect(resolvePreferredPaymentMethod(" transfer_ars ", methods)).toEqual({ ok: true, value: "transfer_ars" });
  });

  it("una clave que no es del catálogo es error (formulario adulterado)", () => {
    for (const bad of ["bitcoin", "MERCADOPAGO", "cash; drop table", "__proto__", "coordinar"]) {
      expect(resolvePreferredPaymentMethod(bad, methods).ok).toBe(false);
    }
  });

  it("un valor que no es texto es error", () => {
    expect(resolvePreferredPaymentMethod(42, methods).ok).toBe(false);
    expect(resolvePreferredPaymentMethod({ key: "cash" }, methods).ok).toBe(false);
    expect(resolvePreferredPaymentMethod(["cash"], methods).ok).toBe(false);
  });

  it("una clave del catálogo que ya no se ofrece guarda null sin error", () => {
    expect(resolvePreferredPaymentMethod("cash", methods)).toEqual({ ok: true, value: null });
  });

  it("con oferta de contacto, cualquier clave válida guarda null", () => {
    expect(resolvePreferredPaymentMethod("mercadopago", contact)).toEqual({ ok: true, value: null });
  });

  describe("«Otro» (DR66 (b))", () => {
    it("con medios ofrecidos se guarda la clave reservada, también con espacios", () => {
      expect(resolvePreferredPaymentMethod("alternative", methods)).toEqual({ ok: true, value: ALTERNATIVE_PREFERENCE_KEY });
      expect(resolvePreferredPaymentMethod("  alternative ", methods)).toEqual({ ok: true, value: "alternative" });
    });
    it("con oferta de contacto no hay selector: guarda null sin error", () => {
      expect(resolvePreferredPaymentMethod("alternative", contact)).toEqual({ ok: true, value: null });
    });
    it("no se confunde con la clave `other` del catálogo ni acepta variantes", () => {
      expect(ALTERNATIVE_PREFERENCE_KEY).not.toBe("other");
      expect(isPaymentMethodKey(ALTERNATIVE_PREFERENCE_KEY)).toBe(false);
      for (const bad of ["Alternative", "alternativo", "alternative;", "otro"]) {
        expect(resolvePreferredPaymentMethod(bad, methods).ok).toBe(false);
      }
    });
    it("la clave cumple el CHECK de la base", () => {
      expect(ALTERNATIVE_PREFERENCE_KEY).toMatch(/^[a-z][a-z0-9_]{1,39}$/);
    });
    it("texto exacto del dueño, con variante para el familiar de un menor y sin WhatsApp", () => {
      expect(COLLECTION_ALTERNATIVE_LABEL).toBe("Otro");
      expect(collectionAlternativeNotice(false)).toBe("La residencia se pondrá en contacto con vos para definir una forma de pago alternativa.");
      expect(collectionAlternativeNotice(true)).toContain("familiar vinculado");
      for (const text of [collectionAlternativeNotice(false), collectionAlternativeNotice(true), COLLECTION_ALTERNATIVE_RESIDENCE_LABEL]) {
        expect(text).not.toMatch(/whatsapp/i);
      }
      expect(COLLECTION_ALTERNATIVE_RESIDENCE_LABEL).toBe("Otro: coordinar forma de pago alternativa");
    });
  });

  it("el mensaje de error es accionable y sin jerga", () => {
    const res = resolvePreferredPaymentMethod("bitcoin", methods);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/Recargá la página/);
  });
});

describe("textos", () => {
  it("copy al estudiante sin WhatsApp (DR66 (b))", () => {
    for (const isMinor of [false, true]) {
      expect(contactCollectionNotice(isMinor)).not.toMatch(/whatsapp/i);
      expect(methodsPreferenceNotice(isMinor)).not.toMatch(/whatsapp/i);
    }
    expect(COLLECTION_PREFERENCE_NOTICE).not.toMatch(/whatsapp/i);
  });

  it("el contacto con un menor va al familiar vinculado y no promete contacto al menor", () => {
    expect(contactCollectionNotice(true)).toMatch(/familiar vinculado/);
    expect(contactCollectionNotice(true)).not.toMatch(/te va a escribir/);
    expect(contactCollectionNotice(false)).toBe("La residencia te va a escribir para coordinar el pago de la reserva.");
  });

  it("la línea bajo los chips no promete datos al menor ni garantiza nada", () => {
    expect(methodsPreferenceNotice(true)).toMatch(/familiar vinculado/);
    expect(methodsPreferenceNotice(true)).not.toMatch(/te llegan|te va a escribir/);
    expect(methodsPreferenceNotice(false)).toBe("Si la residencia acepta tu solicitud, te indica cómo pagar.");
    for (const text of [methodsPreferenceNotice(true), methodsPreferenceNotice(false)]) expect(text).not.toMatch(/garantiz|mediaci/i);
  });

  it("el aviso de responsabilidad no custodia fondos ni se hace responsable, y no usa copy prohibido", () => {
    expect(COLLECTION_LIABILITY_NOTICE).toMatch(/no custodia fondos/);
    expect(COLLECTION_LIABILITY_NOTICE).toMatch(/ni se responsabiliza/);
    for (const text of [COLLECTION_LIABILITY_NOTICE, contactCollectionNotice(true), contactCollectionNotice(false)]) {
      expect(text).not.toMatch(/garantiz|mediaci/i);
    }
  });
});
