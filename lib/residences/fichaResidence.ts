import type { SupabaseClient } from "@supabase/supabase-js";
import { assertResidenceAccess } from "@/lib/residences/access";

/**
 * Búsqueda de la fila de la residencia para la ficha. Es el ÚNICO lugar donde se decide si se exige `status = verified_active`:
 *  - Ficha pública (`/residencias/[slug]`): por `slug` y solo `verified_active` (RLS pública + este filtro). No hay forma de saltearlo.
 *  - Vista previa del equipo (`/residence/[id]/preview`): por `id`, en cualquier estado, y SOLO después de comprobar que quien mira
 *    tiene un vínculo activo (dueño o staff) con ESA residencia (`findPreviewResidence`). Sin vínculo no se consulta la fila.
 * Devuelve `null` si no existe, si el estado no corresponde o si no se pudo leer (se registra el error).
 */
// Fila cruda de `residences` (el cliente de Supabase no tiene esquema generado: las columnas llegan como `any`, igual que antes de mover la lectura).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ResidenceRow = any;

export async function findPublicResidence(admin: SupabaseClient, slug: string): Promise<ResidenceRow | null> {
  const { data, error } = await admin.from("residences").select("*").eq("slug", slug).eq("status", "verified_active").maybeSingle();
  if (error) console.error("[ficha] no se pudo leer la residencia:", error);
  return (data as ResidenceRow | null) ?? null;
}

export async function findPreviewResidence(admin: SupabaseClient, userId: string, residenceId: string): Promise<ResidenceRow | null> {
  // Cualquier miembro activo del equipo de ESA residencia puede mirar (solo lectura: no hay casillero, igual que el resto de las pantallas del panel).
  if (!(await assertResidenceAccess(admin, userId, residenceId))) return null;
  const { data, error } = await admin.from("residences").select("*").eq("id", residenceId).maybeSingle();
  if (error) console.error("[ficha] no se pudo leer la residencia (vista previa):", error);
  return (data as ResidenceRow | null) ?? null;
}
