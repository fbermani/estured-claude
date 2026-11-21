import { describe, expect, it } from "vitest";
import { buildCollectionView } from "@/lib/applications/collectionChoiceView";
import { buildCollectionChoiceContext } from "@/lib/applications/reservationCollectionChoice";

const snapshot = { reservation_payment_amount_usd: 300, reservation_payment_amount_ars: 450000, monthly_price_usd: 300 };
const methodsCtx = buildCollectionChoiceContext({
  modes: ["enabled_methods", "whatsapp_direct"],
  acceptedMethods: ["transfer_ars"],
  approved: [{ methodKey: "transfer_ars", methodLabel: null }],
});
const base = { ctx: methodsCtx, isMinor: false, isOwner: true, collectionMode: null, preferred: null, snapshot, payment: null };

describe("buildCollectionView", () => {
  it("no aplica fuera de contacto establecido y pago pendiente", () => {
    expect(buildCollectionView({ ...base, status: "submitted" })).toBeNull();
  });
  it("contact_established: elegir, con monto de solo lectura y WhatsApp permitido", () => {
    const v = buildCollectionView({ ...base, status: "contact_established", preferred: "transfer_ars" });
    expect(v).toMatchObject({ phase: "choose", amountUsd: 300, amountArs: 450000, preferredKey: "transfer_ars", whatsappAllowed: true });
  });
  it("solo medios: sin botón de WhatsApp", () => {
    const only = buildCollectionChoiceContext({ modes: ["enabled_methods"], acceptedMethods: ["transfer_ars"], approved: [{ methodKey: "transfer_ars", methodLabel: null }] });
    expect(buildCollectionView({ ...base, ctx: only, status: "contact_established" })?.whatsappAllowed).toBe(false);
  });
  it("pendiente con medios: resumen sin WhatsApp ni datos de cobro", () => {
    const v = buildCollectionView({
      ...base,
      status: "residence_payment_pending",
      collectionMode: "enabled_methods",
      payment: { chosenMethod: "transfer_ars", expectedUsd: 300, expectedArs: 450000 },
    });
    expect(v).toMatchObject({ phase: "chosen", whatsappAllowed: false, chosen: { mode: "enabled_methods", methodLabel: "Transferencia en pesos" } });
    expect(JSON.stringify(v)).not.toMatch(/details|instructions/);
  });
  it("pendiente en contacto directo: WhatsApp permitido", () => {
    expect(buildCollectionView({ ...base, status: "residence_payment_pending", collectionMode: "whatsapp_direct" })).toMatchObject({ phase: "chosen", whatsappAllowed: true });
  });
  it("pendiente sin camino: solicitud anterior (solo contacto directo) = contacto; con medios disponibles hay que elegir", () => {
    const legacy = buildCollectionChoiceContext({ modes: null, acceptedMethods: null, approved: [] });
    expect(buildCollectionView({ ...base, ctx: legacy, status: "residence_payment_pending" })).toMatchObject({ phase: "chosen", whatsappAllowed: true });
    expect(buildCollectionView({ ...base, status: "residence_payment_pending" })).toMatchObject({ phase: "choose", whatsappAllowed: false });
  });
  it("menor: lo marca", () => {
    expect(buildCollectionView({ ...base, isMinor: true, status: "contact_established" })?.isMinor).toBe(true);
  });
});
