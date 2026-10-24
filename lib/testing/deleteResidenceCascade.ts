import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaError } from "@/lib/stayChange/schema";

/**
 * SOLO PARA TESTS de integración (no importar desde código de producción;
 * sin `server-only` a propósito para poder usarlo desde Vitest).
 *
 * Borra una residencia de test y todo lo que cuelga de ella respetando las
 * FK circulares / sin cascade (reservations <-> estured_fee_payments /
 * booking_receipts, renovaciones, support_cases, application_snapshots...).
 * Un `residences.delete()` pelado falla en silencio por FK y deja en la base
 * de dev una "Residencia Test Integración" con reservas y pagos huérfanos
 * (H26: rompía las pantallas demo).
 *
 * LANZA error ante el primer paso que falle, así el `afterAll` del test falla
 * en voz alta en vez de dejar residuo.
 *
 * Mantener sincronizado con `scripts/cleanup-test-residences.mjs` (mismo orden
 * de borrado, verificado contra la base de dev) y con la limpieza de
 * `scripts/seed-demo-data.mjs`. Si una tabla nueva tiene FK directa a
 * `residence_id` sin cascade, agregarla en los tres lados.
 */
export async function deleteResidenceCascade(admin: SupabaseClient, residenceId: string): Promise<void> {
  const fail = (label: string, message: string): never => {
    throw new Error(`[deleteResidenceCascade] ${label} (residencia ${residenceId}): ${message}`);
  };
  const ok = async (label: string, query: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await query;
    if (error) fail(label, error.message);
  };
  const okIfTableExists = async (label: string, query: PromiseLike<{ error: { code?: string; message: string } | null }>) => {
    const { error } = await query;
    if (error && !isMissingSchemaError(error)) fail(label, error.message);
  };
  const ids = async (
    label: string,
    query: PromiseLike<{ data: { id: string }[] | null; error: { message: string } | null }>,
  ): Promise<string[]> => {
    const { data, error } = await query;
    if (error) fail(label, error.message);
    return (data ?? []).map((row) => row.id);
  };

  // Defensa propia: este helper usa service role y borra todo lo que cuelga de la residencia. Solo se
  // permite sobre residencias creadas por tests (slug `residencia-test-*`, igual que el script de limpieza).
  const { data: target, error: targetError } = await admin.from("residences").select("slug").eq("id", residenceId).maybeSingle();
  if (targetError) fail("lookup de la residencia", targetError.message);
  if (!target) return; // ya no existe: nada que limpiar.
  if (!String(target.slug).startsWith("residencia-test-")) {
    fail("guard", `la residencia "${target.slug}" no es de test (slug sin prefijo residencia-test-); me niego a borrarla`);
  }

  // DR3 (Ciclo 59): avisos "Quiero cambiar" y salidas anticipadas de esta residencia (las FK de solicitudes/listas
  // hacia el aviso son ON DELETE SET NULL). Antes de estadías y reservas, que ellos referencian.
  // (Si la migración 0044 todavía no se aplicó en esta base, las tablas no existen: se omite.)
  await okIfTableExists("stay_early_exits", admin.from("stay_early_exits").delete().eq("residence_id", residenceId));
  await okIfTableExists("stay_change_intents", admin.from("stay_change_intents").delete().eq("current_residence_id", residenceId));
  await ok("resident_stays", admin.from("resident_stays").delete().eq("residence_id", residenceId));
  await ok("support_cases", admin.from("support_cases").delete().eq("residence_id", residenceId));

  const appIds = await ids(
    "select application_requests",
    admin.from("application_requests").select("id").eq("residence_id", residenceId),
  );
  if (appIds.length) {
    const reservationIds = await ids(
      "select reservations",
      admin.from("reservations").select("id").in("application_request_id", appIds),
    );
    if (reservationIds.length) {
      const offerIds = await ids(
        "select renewal_offers",
        admin.from("renewal_offers").select("id").in("reservation_id", reservationIds),
      );
      if (offerIds.length) {
        await ok(
          "renewal_offers: anular refs",
          admin
            .from("renewal_offers")
            .update({ estured_fee_payment_id: null, renewal_receipt_id: null, external_residence_payment_id: null })
            .in("id", offerIds),
        );
        await ok("renewal_receipts", admin.from("renewal_receipts").delete().in("renewal_offer_id", offerIds));
        await ok(
          "estured_fee_payments (renovación)",
          admin.from("estured_fee_payments").delete().in("renewal_offer_id", offerIds),
        );
        await ok(
          "external_residence_payments (renovación)",
          admin.from("external_residence_payments").delete().in("renewal_offer_id", offerIds),
        );
        await ok("renewal_offers", admin.from("renewal_offers").delete().in("id", offerIds));
      }
      await ok("renewal_requests", admin.from("renewal_requests").delete().in("reservation_id", reservationIds));

      const receiptIds = await ids(
        "select booking_receipts",
        admin.from("booking_receipts").select("id").in("reservation_id", reservationIds),
      );
      if (receiptIds.length) {
        await ok(
          "audit_logs (booking_receipts)",
          admin.from("audit_logs").delete().eq("entity_type", "booking_receipts").in("entity_id", receiptIds),
        );
      }
      await ok(
        "audit_logs (reservations)",
        admin.from("audit_logs").delete().eq("entity_type", "reservations").in("entity_id", reservationIds),
      );
      await ok(
        "reservations: anular ciclo FK",
        admin.from("reservations").update({ estured_fee_payment_id: null, booking_receipt_id: null }).in("id", reservationIds),
      );
      await ok("booking_receipts", admin.from("booking_receipts").delete().in("reservation_id", reservationIds));
      await ok("estured_fee_payments", admin.from("estured_fee_payments").delete().in("reservation_id", reservationIds));
      const paymentIds = await ids(
        "select external_residence_payments",
        admin.from("external_residence_payments").select("id").in("application_request_id", appIds),
      );
      if (paymentIds.length) {
        await ok(
          "external_residence_payments: soltar reserva",
          admin.from("external_residence_payments").update({ reservation_id: null }).in("id", paymentIds),
        );
      }
      await ok("reservations", admin.from("reservations").delete().in("id", reservationIds));
    }
    await ok(
      "external_residence_payments",
      admin.from("external_residence_payments").delete().in("application_request_id", appIds),
    );
    await ok(
      "application_requests: soltar propuesta familiar",
      admin.from("application_requests").update({ family_proposal_id: null }).in("id", appIds),
    );
  }
  await ok(
    "family_application_proposals",
    admin.from("family_application_proposals").delete().eq("residence_id", residenceId),
  );
  await ok("waitlist_entries", admin.from("waitlist_entries").delete().eq("residence_id", residenceId));
  await ok("application_requests", admin.from("application_requests").delete().eq("residence_id", residenceId));
  // Después de las solicitudes: application_requests.snapshot_original_id referencia al snapshot.
  await ok("application_snapshots", admin.from("application_snapshots").delete().eq("residence_id", residenceId));

  await ok("residences", admin.from("residences").delete().eq("id", residenceId));
}
