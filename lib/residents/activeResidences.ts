import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/** Residencias activas (`verified_active`) para elegir la propia al registrarse (DR21). Solo id, nombre y barrio públicos. */
export async function listActiveResidencesForPicker(): Promise<{ id: string; name: string; area: string | null }[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const { data, error } = await admin.from("residences").select("id, name, public_area").eq("status", "verified_active").order("name", { ascending: true });
  if (error) console.error("[residents] listActiveResidencesForPicker failed:", error.code, error.message);
  return ((data ?? []) as { id: string; name: string; public_area: string | null }[]).map((r) => ({ id: r.id, name: r.name, area: r.public_area }));
}
