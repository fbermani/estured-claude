import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SNAPSHOT_COLUMNS,
  buildAgreedConditions,
  pickSnapshot,
  type AgreedConditions,
  type SnapshotRow,
} from "@/lib/applications/agreedConditions";

type ApplicationSnapshotRefs = {
  id: string;
  snapshot_original_id: string | null;
  snapshot_final_id: string | null;
};

/**
 * Para un conjunto de solicitudes, devuelve las condiciones acordadas
 * (snapshot final si existe, si no el original) — H07. Una sola consulta a
 * `application_snapshots` sin importar cuántas solicitudes haya. Ante un
 * error de lectura devuelve el mapa vacío: la pantalla muestra "—" en vez de
 * caer al precio vigente de `room_types` (que es justo lo que H07 evita).
 */
export async function loadAgreedConditionsByApplication(
  client: SupabaseClient,
  applications: ApplicationSnapshotRefs[],
): Promise<Map<string, AgreedConditions>> {
  const result = new Map<string, AgreedConditions>();
  const snapshotIds = [
    ...new Set(applications.flatMap((a) => [a.snapshot_original_id, a.snapshot_final_id]).filter((x): x is string => !!x)),
  ];
  if (snapshotIds.length === 0) return result;

  const { data, error } = await client.from("application_snapshots").select(SNAPSHOT_COLUMNS).in("id", snapshotIds);
  if (error) {
    console.error("[loadApplicationSnapshots] query failed:", error);
    return result;
  }
  const byId = new Map<string, SnapshotRow>();
  for (const row of (data ?? []) as unknown as (SnapshotRow & { id: string })[]) byId.set(row.id, row);

  for (const app of applications) {
    const snapshot = pickSnapshot(
      app.snapshot_original_id ? byId.get(app.snapshot_original_id) : null,
      app.snapshot_final_id ? byId.get(app.snapshot_final_id) : null,
    );
    const conditions = buildAgreedConditions(snapshot);
    if (conditions) result.set(app.id, conditions);
  }
  return result;
}
