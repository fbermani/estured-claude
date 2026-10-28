import { formatDate } from "@/lib/dates/format";
import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cmd } from "@/components/admin/ui/tokens";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { ReviewButtons } from "@/app/admin/custom-amenities/ReviewButtons";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { isMissingSchemaError } from "@/lib/stayChange/schema";
import { KIND_LABELS, type CustomAmenityKind } from "@/lib/residences/customAmenities";

export const metadata: Metadata = { title: "Ítems «Otro» de fichas" };
export const dynamic = "force-dynamic";

interface Row {
  id: string;
  kind: CustomAmenityKind;
  label: string;
  status: "pending" | "approved" | "rejected";
  reject_reason: string | null;
  created_at: string;
  residences: { name: string } | null;
}

/** Cola de moderación de los ítems «Otro» de servicios y áreas comunes (DR18). Pendientes primero; los revisados, para consulta. */
export default async function AdminCustomAmenitiesPage() {
  await requireAdmin();
  const admin = getSupabaseAdmin();
  let rows: Row[] = [];
  let failed = false;
  let schemaReady = true;
  if (admin) {
    const select = "id, kind, label, status, reject_reason, created_at, residences(name)";
    const [pending, reviewed] = await Promise.all([
      admin.from("residence_custom_amenities").select(select).eq("status", "pending").order("created_at", { ascending: true }).limit(100),
      admin.from("residence_custom_amenities").select(select).neq("status", "pending").order("reviewed_at", { ascending: false }).limit(30),
    ]);
    const err = pending.error ?? reviewed.error;
    if (err) {
      if (isMissingSchemaError(err)) schemaReady = false;
      else {
        console.error("[admin/custom-amenities] query failed:", err);
        failed = true;
      }
    }
    rows = [...((pending.data as unknown as Row[]) ?? []), ...((reviewed.data as unknown as Row[]) ?? [])];
  }

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="text-lg font-bold" style={{ color: cmd.onSurface }}>
        Ítems «Otro» de fichas
      </h1>
      <p className="text-xs" style={{ color: cmd.outline }}>
        Servicios y áreas comunes propios que sumaron las residencias. No se muestran en la ficha pública hasta que los apruebes. Rechazá lo que
        sea un dato de contacto, una promesa o algo que no describa un servicio o un área; la residencia ve el motivo.
      </p>
      {!schemaReady ? (
        <p className="mt-6 text-sm" style={{ color: cmd.outline }}>
          Esta función todavía no está disponible: falta aplicar la migración 0058.
        </p>
      ) : failed ? (
        <p className="mt-6 text-sm" style={{ color: cmd.rose }}>
          No pudimos cargar los ítems. Probá de nuevo en unos minutos.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm" style={{ color: cmd.outline }}>
          No hay ítems para revisar.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <AdminCard className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminBadge tone={r.status === "pending" ? "amber" : r.status === "approved" ? "emerald" : "neutral"}>
                        {r.status === "pending" ? "Pendiente" : r.status === "approved" ? "Aprobado" : "Rechazado"}
                      </AdminBadge>
                      <span className="text-xs" style={{ color: cmd.outline }}>
                        {KIND_LABELS[r.kind]} · {r.residences?.name} · {formatDate(r.created_at)}
                      </span>
                    </div>
                    <p className="mt-2 break-words text-sm font-bold" style={{ color: cmd.onSurface }}>
                      {r.label}
                    </p>
                    {r.reject_reason && (
                      <p className="mt-1 break-words text-xs" style={{ color: cmd.onSurfaceVariant }}>
                        Motivo: {r.reject_reason}
                      </p>
                    )}
                  </div>
                  {r.status === "pending" && <ReviewButtons id={r.id} />}
                </div>
              </AdminCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
