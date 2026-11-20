import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * SOLO PARA TESTS de integración (sin `server-only` a propósito).
 *
 * Las server actions que ejercitan los tests generan filas que el `afterAll` del test no conoce:
 * `notifications` (related_entity_type/id apuntan a entidades que el test borra, y quedan como links rotos
 * en el panel del usuario demo) y `support_cases` (p. ej. revocación del fee, con residence_id nulo).
 *
 * Llamar en `afterAll` DESPUÉS de borrar las entidades, pasando el instante en que arrancó el test
 * (`const startedAt = new Date().toISOString()` en el `beforeAll`). Solo toca filas creadas desde entonces:
 * - support_cases con descripción de "Residencia Test Integración" o cuya entidad relacionada ya no existe;
 * - notifications cuyo `related_entity_type` es una tabla y la entidad ya no existe (huérfanas).
 */
const ENTITY_TABLES = [
  "renewal_requests",
  "renewal_offers",
  "reservations",
  "application_requests",
  "waitlist_entries",
  "stay_change_intents",
  "family_application_proposals",
  "booking_receipts",
  "resident_stays",
] as const;

export async function cleanupTestSideEffects(admin: SupabaseClient, sinceIso: string): Promise<void> {
  const { error: casesError } = await admin
    .from("support_cases")
    .delete()
    .gte("created_at", sinceIso)
    .ilike("description", "%Residencia Test Integraci%");
  if (casesError) throw new Error(`[cleanupTestSideEffects] support_cases: ${casesError.message}`);

  const { data: notes, error } = await admin
    .from("notifications")
    .select("id, related_entity_type, related_entity_id")
    .gte("created_at", sinceIso)
    .not("related_entity_id", "is", null);
  if (error) throw new Error(`[cleanupTestSideEffects] notifications: ${error.message}`);

  const orphanIds: string[] = [];
  for (const table of ENTITY_TABLES) {
    const rows = (notes ?? []).filter((n) => n.related_entity_type === table);
    if (!rows.length) continue;
    const entityIds = [...new Set(rows.map((n) => n.related_entity_id as string))];
    const { data: alive, error: aliveError } = await admin.from(table).select("id").in("id", entityIds);
    if (aliveError) continue; // tabla inexistente en esta base: se omite
    const aliveSet = new Set((alive ?? []).map((r) => r.id as string));
    for (const n of rows) if (!aliveSet.has(n.related_entity_id as string)) orphanIds.push(n.id as string);
  }
  for (let i = 0; i < orphanIds.length; i += 100) {
    const { error: delError } = await admin.from("notifications").delete().in("id", orphanIds.slice(i, i + 100));
    if (delError) throw new Error(`[cleanupTestSideEffects] borrar notifications: ${delError.message}`);
  }
}
