import type { Metadata } from "next";
import Link from "next/link";
import { formatDate } from "@/lib/dates/format";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { cmd } from "@/components/admin/ui/tokens";
import { QueueLayout } from "@/components/admin/ui/QueueLayout";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { pluralize } from "@/lib/format/plural";
import { loadCollectionApprovalDetail, loadCollectionApprovalQueue } from "@/lib/residences/collectionApprovalDb";
import { CollectionApprovalDetail } from "@/app/admin/collection-approvals/CollectionApprovalDetail";

export const metadata: Metadata = { title: "Cobros de reserva" };
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Cola de aprobación de los datos de cobro de la reserva (DR63 (j) 5, `docs/03` §7.3): una fila por residencia con medios pendientes.
 * Solo admin y superadmin. Muestra los datos de cobro completos del detalle; nunca van a otro rol.
 */
export default async function CollectionApprovalsPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  await requireAdmin();
  const { id } = await searchParams;
  const selectedId = id && UUID_RE.test(id) ? id : null;
  const admin = getSupabaseAdmin();
  const queue = admin ? await loadCollectionApprovalQueue(admin) : ({ ok: false } as const);
  const rows = queue.ok && queue.ready ? queue.rows : [];
  const activeId = selectedId ?? rows[0]?.residenceId ?? null;
  const detail = admin && activeId && queue.ok && queue.ready ? await loadCollectionApprovalDetail(admin, activeId) : null;

  return (
    <QueueLayout
      explicit={Boolean(selectedId)}
      backHref="/admin/collection-approvals"
      queue={
        <>
          <div className="border-b p-4" style={{ borderColor: cmd.border }}>
            <h1 className="text-lg font-bold" style={{ color: cmd.onSurface }}>
              Cobros de reserva
            </h1>
            <p className="text-xs" style={{ color: cmd.outline }}>
              {queue.ok && queue.ready ? `${pluralize(rows.length, "residencia", "residencias")} con datos por aprobar` : "Datos de cobro por aprobar"}
            </p>
          </div>
          {!queue.ok ? (
            <p role="alert" className="p-4 text-sm" style={{ color: cmd.rose }}>
              No pudimos cargar la cola. Probá de nuevo en unos minutos.
            </p>
          ) : !queue.ready ? (
            <p className="p-4 text-sm" style={{ color: cmd.outline }}>
              El cobro de la reserva todavía no está disponible en este entorno.
            </p>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm" style={{ color: cmd.outline }}>
              No hay datos de cobro esperando aprobación.
            </p>
          ) : (
            <ul>
              {rows.map((r) => (
                <li key={r.residenceId} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                  <Link
                    href={`/admin/collection-approvals?id=${r.residenceId}`}
                    className="block px-4 py-3"
                    style={r.residenceId === activeId ? { backgroundColor: cmd.onPrimaryContainer } : undefined}
                  >
                    <div className="flex items-center justify-between">
                      <AdminBadge tone="amber">{pluralize(r.pendingCount, "medio", "medios")}</AdminBadge>
                      <span className="text-xs" style={{ color: cmd.outline }}>
                        {r.oldestSubmittedAt ? formatDate(r.oldestSubmittedAt) : "—"}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-bold" style={{ color: cmd.onSurface }}>
                      {r.name}
                    </p>
                    <p className="text-xs" style={{ color: cmd.outline }}>
                      {r.publicArea ?? "Zona sin definir"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      }
      detail={
        detail && detail.ok && detail.ready ? (
          <CollectionApprovalDetail key={detail.residence.id} residence={detail.residence} methods={detail.methods} />
        ) : detail && !detail.ok ? (
          <p role="alert" className="text-sm" style={{ color: cmd.rose }}>
            {detail.notFound ? "No encontramos esa residencia." : "No pudimos cargar los datos de cobro. Probá de nuevo en unos minutos."}
          </p>
        ) : (
          <p className="text-sm" style={{ color: cmd.outline }}>
            Seleccioná una residencia de la lista para revisar sus datos de cobro.
          </p>
        )
      }
    />
  );
}
