import { auditEntityLabel } from "@/lib/format/auditActionLabels";
import { formatDate } from "@/lib/dates/format";
import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ScrollTable } from "@/components/ui/ScrollTable";
import { Select } from "@/components/ui/Input";
import { cmd } from "@/components/admin/ui/tokens";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { DocumentAccessButton } from "@/components/admin/ui/DocumentAccessButton";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const metadata: Metadata = { title: "Administración de documentos" };
export const dynamic = "force-dynamic";

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  student_identity: "Identidad estudiante",
  student_academic_proof: "Comprobante académico",
  student_family_authorization: "Autorización familiar",
  student_payment_proof_to_residence: "Comprobante de pago a residencia",
  family_identity: "Identidad familiar",
  residence_responsible_identity: "Identidad responsable residencia",
  residence_coordinator_identity: "Identidad coordinador",
  residence_signed_checklist: "Checklist firmado",
  residence_terms_acceptance: "Aceptación de términos",
  residence_payment_receipt: "Comprobante de pago",
  estured_fee_fiscal_receipt: "Factura fiscal",
  residence_photo: "Foto de residencia",
  residence_rules_document: "Reglamento de residencia",
  other: "Otro",
};

const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  uploaded: "Subido",
  pending_review: "Pendiente de revisión",
  approved: "Aprobado",
  rejected: "Rechazado",
  expired: "Vencido",
  archived: "Archivado",
};

const SENSITIVE_TYPES = new Set(Object.keys(DOCUMENT_TYPE_LABELS).filter((t) => t !== "residence_photo"));

type FileRow = {
  id: string;
  filename: string;
  document_type: string;
  status: string;
  visibility: string;
  bucket: string;
  storage_path: string;
  related_entity_type: string;
  related_entity_id: string;
  size_bytes: number;
  created_at: string;
  users: { email: string } | null;
};

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  await requireAdmin();
  const { q, type } = await searchParams;
  const admin = getSupabaseAdmin();

  let files: FileRow[] = [];
  const residenceNames = new Map<string, string>();

  if (admin) {
    let query = admin
      .from("files")
      .select(
        "id, filename, document_type, status, visibility, bucket, storage_path, related_entity_type, related_entity_id, size_bytes, created_at, users!files_uploaded_by_user_id_fkey(email)",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (q) query = query.ilike("filename", `%${q}%`);
    if (type) query = query.eq("document_type", type);
    const { data } = await query;
    files = (data as unknown as FileRow[]) ?? [];

    const residenceIds = Array.from(
      new Set(files.filter((f) => f.related_entity_type === "residences").map((f) => f.related_entity_id)),
    );
    if (residenceIds.length > 0) {
      const { data: residences } = await admin.from("residences").select("id, name").in("id", residenceIds);
      for (const r of residences ?? []) residenceNames.set(r.id, r.name);
    }
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-[28px] font-bold tracking-tight" style={{ color: cmd.onSurface }}>
          Administración de Documentos
        </h1>
        <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
          Metadata de documentos subidos a la plataforma. Ver un documento sensible requiere declarar un motivo, que queda auditado.
        </p>
      </div>

      {/* < md: búsqueda + Select de tipo (sin 15 chips) */}
      <form method="get" className="mb-4 flex flex-col gap-3 md:hidden">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nombre de archivo…"
          aria-label="Buscar por nombre de archivo"
          className="min-h-11 w-full rounded px-3 py-2 text-base"
          style={{ border: `1px solid ${cmd.outline}` }}
        />
        <Select label="Tipo de documento" name="type" defaultValue={type ?? ""}>
          <option value="">Todos</option>
          {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <button type="submit" className="min-h-11 rounded px-4 py-2 text-sm font-bold text-white" style={{ backgroundColor: cmd.primary }}>
          Filtrar
        </button>
      </form>
      <div className="mb-4 hidden flex-wrap items-center gap-3 md:flex">
        <form className="flex items-center gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por nombre de archivo…"
            className="rounded px-3 py-2 text-sm"
            style={{ border: `1px solid ${cmd.outline}` }}
          />
          {type && <input type="hidden" name="type" value={type} />}
          <button type="submit" className="rounded px-4 py-2 text-xs font-bold text-white" style={{ backgroundColor: cmd.primary }}>
            Buscar
          </button>
        </form>
        <div className="flex flex-wrap gap-1.5">
          <Link
            href="/admin/documents"
            className="rounded px-3 py-1.5 text-xs font-bold"
            style={!type ? { backgroundColor: cmd.primary, color: "#fff" } : { backgroundColor: "#fff", color: cmd.onSurfaceVariant, border: `1px solid ${cmd.outline}` }}
          >
            Todos
          </Link>
          {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
            <Link
              key={value}
              href={`/admin/documents?type=${value}`}
              className="rounded px-3 py-1.5 text-xs font-bold"
              style={type === value ? { backgroundColor: cmd.primary, color: "#fff" } : { backgroundColor: "#fff", color: cmd.onSurfaceVariant, border: `1px solid ${cmd.outline}` }}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <AdminCard className="overflow-hidden p-0">
        {files.length === 0 ? (
          <p className="p-6 text-sm" style={{ color: cmd.outline }}>
            No hay documentos que coincidan con la búsqueda.
          </p>
        ) : (
          <>
          <ul className="divide-y md:hidden" style={{ borderColor: cmd.border }} aria-label="Documentos">
            {files.map((f) => {
              const isSensitive = SENSITIVE_TYPES.has(f.document_type);
              const entityLabel =
                f.related_entity_type === "residences"
                  ? residenceNames.get(f.related_entity_id) ?? "Residencia"
                  : auditEntityLabel(f.related_entity_type);
              return (
                <li key={f.id} className="p-4 [&_button]:min-h-11">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 break-all font-bold" style={{ color: cmd.onSurface }}>
                      {f.filename}
                    </p>
                    <div className="shrink-0">
                      <AdminBadge tone={f.status === "approved" ? "emerald" : f.status === "rejected" ? "rose" : "amber"}>
                        {DOCUMENT_STATUS_LABELS[f.status] ?? "En revisión"}
                      </AdminBadge>
                    </div>
                  </div>
                  <p className="mt-1 text-sm" style={{ color: cmd.onSurfaceVariant }}>
                    {DOCUMENT_TYPE_LABELS[f.document_type] ?? f.document_type} · {entityLabel}
                  </p>
                  <p className="mt-1 break-all text-xs" style={{ color: cmd.outline }}>
                    {f.users?.email ?? "—"} · {formatDate(f.created_at)}
                  </p>
                  <div className="mt-2">
                    {isSensitive ? (
                      <DocumentAccessButton fileId={f.id} label="Ver →" />
                    ) : (
                      <a
                        href={admin!.storage.from(f.bucket).getPublicUrl(f.storage_path).data.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center text-xs font-bold underline"
                        style={{ color: cmd.primary }}
                      >
                        Ver (público) →
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="hidden md:block">
          <ScrollTable label="Documentos">
            <table className="w-full text-left text-sm">
              <thead style={{ backgroundColor: cmd.surfaceContainer }}>
                <tr>
                  {["Archivo", "Tipo", "Entidad", "Estado", "Subido por", "Fecha", ""].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide" style={{ color: cmd.outline }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: cmd.border }}>
                {files.map((f) => {
                  const isSensitive = SENSITIVE_TYPES.has(f.document_type);
                  const entityLabel =
                    f.related_entity_type === "residences"
                      ? residenceNames.get(f.related_entity_id) ?? "Residencia"
                      : auditEntityLabel(f.related_entity_type);
                  return (
                    <tr key={f.id}>
                      <td className="whitespace-nowrap px-4 py-3 font-bold" style={{ color: cmd.onSurface }}>
                        {f.filename}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3" style={{ color: cmd.onSurfaceVariant }}>
                        {DOCUMENT_TYPE_LABELS[f.document_type] ?? f.document_type}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3" style={{ color: cmd.onSurfaceVariant }}>
                        {entityLabel}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <AdminBadge tone={f.status === "approved" ? "emerald" : f.status === "rejected" ? "rose" : "amber"}>
                          {DOCUMENT_STATUS_LABELS[f.status] ?? "En revisión"}
                        </AdminBadge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3" style={{ color: cmd.outline }}>
                        {f.users?.email ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3" style={{ color: cmd.outline }}>
                        {formatDate(f.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {isSensitive ? (
                          <DocumentAccessButton fileId={f.id} label="Ver →" />
                        ) : (
                          <a
                            href={admin!.storage.from(f.bucket).getPublicUrl(f.storage_path).data.publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-bold underline"
                            style={{ color: cmd.primary }}
                          >
                            Ver (público) →
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollTable>
          </div>
          </>
        )}
      </AdminCard>
    </div>
  );
}
