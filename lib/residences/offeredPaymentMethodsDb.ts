import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONTACT_OFFER, offeredReservationCollection, type ReservationCollectionOffer } from "@/lib/residences/offeredPaymentMethods";

/**
 * Oferta de cobro de la reserva para la solicitud del estudiante (DR63 (c)). Se lee con service role porque
 * `residence_collection_accounts` tiene RLS SIN policies (dato sensible). NO se lee `details` ni `pending_details`: el filtro
 * `details is not null` alcanza para saber que hay datos aprobados (el check de la tabla garantiza que no es vacío), y lo único que
 * sale de acá son claves y nombres de medio.
 *
 * Nunca lanza: ante migración 0102 sin aplicar o un fallo de lectura se devuelve `contact` (la residencia coordina; es el
 * comportamiento anterior a DR63). `failed` avisa al que llama que la respuesta es un valor por defecto, no la verdad.
 */

const SCHEMA_MISSING_CODES = new Set(["42703", "42P01", "PGRST204", "PGRST205"]);

export async function loadReservationCollectionOffer(
  admin: SupabaseClient,
  residenceId: string,
): Promise<{ offer: ReservationCollectionOffer; failed: boolean }> {
  const residence = await admin
    .from("residences")
    .select("reservation_payment_modes, accepted_payment_methods")
    .eq("id", residenceId)
    .maybeSingle();
  if (residence.error) {
    const missing = residence.error.code != null && SCHEMA_MISSING_CODES.has(residence.error.code);
    if (!missing) console.error("[collection-offer] residence read failed:", residence.error.code, residence.error.message);
    return { offer: CONTACT_OFFER, failed: !missing };
  }
  if (!residence.data) return { offer: CONTACT_OFFER, failed: true };
  const row = residence.data as { reservation_payment_modes: string[] | null; accepted_payment_methods: string[] | null };
  // Sin «Cobro con medios habilitados» no hace falta leer las cuentas.
  if (!(row.reservation_payment_modes ?? []).includes("enabled_methods")) return { offer: CONTACT_OFFER, failed: false };

  const accounts = await admin
    .from("residence_collection_accounts")
    .select("method_key, method_label")
    .eq("residence_id", residenceId)
    .not("details", "is", null);
  if (accounts.error) {
    const missing = accounts.error.code != null && SCHEMA_MISSING_CODES.has(accounts.error.code);
    if (!missing) console.error("[collection-offer] accounts read failed:", accounts.error.code, accounts.error.message);
    return { offer: CONTACT_OFFER, failed: !missing };
  }
  const approved = ((accounts.data ?? []) as { method_key: string; method_label: string | null }[]).map((a) => ({
    methodKey: a.method_key,
    methodLabel: a.method_label,
  }));
  return {
    offer: offeredReservationCollection({ modes: row.reservation_payment_modes, acceptedMethods: row.accepted_payment_methods, approved }),
    failed: false,
  };
}
