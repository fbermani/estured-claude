import { formatDate } from "@/lib/dates/format";
import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cmd } from "@/components/admin/ui/tokens";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { ProfileEditDetail } from "@/app/admin/profile-edits/ProfileEditDetail";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export const metadata: Metadata = { title: "Ediciones de perfil" };
export const dynamic = "force-dynamic";

const FIELD_GROUP_LABELS: Record<string, string> = {
  photos: "Fotos",
  services: "Servicios",
  rules: "Reglas y reglamento",
  minimum_stay_months: "Mínimo de estadía",
  room_types: "Tipos de habitación",
};

type QueueRow = {
  id: string;
  residence_id: string;
  field_group: string;
  created_at: string;
  residences: { name: string; public_area: string | null } | null;
  users: { email: string } | null;
};

export default async function ProfileEditsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  await requireAdmin();
  const { id: selectedId } = await searchParams;
  const admin = getSupabaseAdmin();

  const queue = admin
    ? (
        (
          await admin
            .from("residence_profile_edits")
            .select(
              "id, residence_id, field_group, created_at, residences(name, public_area), users!residence_profile_edits_submitted_by_fkey(email)",
            )
            .eq("status", "pending_admin_review")
            .order("created_at", { ascending: true })
        ).data as unknown as QueueRow[]
      ) ?? []
    : [];

  const activeId = selectedId ?? queue[0]?.id ?? null;

  let detail: {
    id: string;
    residenceId: string;
    residenceName: string;
    residenceZone: string | null;
    fieldGroup: string;
    oldValue: unknown;
    newValue: unknown;
    submittedByEmail: string | null;
    createdAt: string;
    photoUrls: string[];
    rulesFileId: string | null;
  } | null = null;

  if (admin && activeId) {
    const row = queue.find((r) => r.id === activeId);
    if (row) {
      const { data: full } = await admin
        .from("residence_profile_edits")
        .select("old_value, new_value")
        .eq("id", activeId)
        .single();

      const photoUrls: string[] = [];
      let rulesFileId: string | null = null;
      const newValue = (full?.new_value ?? {}) as Record<string, unknown>;

      if (row.field_group === "photos") {
        const fileIds = (newValue.fileIds as string[]) ?? [];
        if (fileIds.length > 0) {
          const { data: files } = await admin.from("files").select("storage_path").in("id", fileIds);
          for (const f of files ?? []) {
            photoUrls.push(admin.storage.from("public-residence-media").getPublicUrl(f.storage_path).data.publicUrl);
          }
        }
      }
      // El reglamento es un documento privado (docs/09 §18.1) — ya NO
      // se genera el signed URL acá, `DocumentAccessButton` pide el
      // motivo y lo genera recién ahí.
      if (row.field_group === "rules") {
        const rulesFile = newValue.rulesFile as { fileId: string } | null;
        rulesFileId = rulesFile?.fileId ?? null;
      }

      detail = {
        id: row.id,
        residenceId: row.residence_id,
        residenceName: row.residences?.name ?? "Residencia",
        residenceZone: row.residences?.public_area ?? null,
        fieldGroup: row.field_group,
        oldValue: full?.old_value ?? null,
        newValue: full?.new_value ?? null,
        submittedByEmail: row.users?.email ?? null,
        createdAt: row.created_at,
        photoUrls,
        rulesFileId,
      };
    }
  }

  return (
    <div className="flex h-full">
      {/* Cola */}
      <div className="w-96 shrink-0 overflow-y-auto border-r" style={{ borderColor: cmd.border }}>
        <div className="border-b p-4" style={{ borderColor: cmd.border }}>
          <h1 className="text-lg font-bold" style={{ color: cmd.onSurface }}>
            Ediciones de Perfil
          </h1>
          <p className="text-xs" style={{ color: cmd.outline }}>
            {queue.length} pendientes
          </p>
        </div>
        {queue.length === 0 ? (
          <p className="p-4 text-sm" style={{ color: cmd.outline }}>
            No hay ediciones esperando revisión.
          </p>
        ) : (
          <ul>
            {queue.map((r) => {
              const active = r.id === activeId;
              return (
                <li key={r.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                  <Link
                    href={`/admin/profile-edits?id=${r.id}`}
                    className="block px-4 py-3"
                    style={active ? { backgroundColor: cmd.onPrimaryContainer } : undefined}
                  >
                    <div className="flex items-center justify-between">
                      <AdminBadge tone="amber">{FIELD_GROUP_LABELS[r.field_group] ?? r.field_group}</AdminBadge>
                      <span className="text-[11px]" style={{ color: cmd.outline }}>
                        {formatDate(r.created_at)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-bold" style={{ color: cmd.onSurface }}>
                      {r.residences?.name ?? "Residencia"}
                    </p>
                    <p className="text-xs" style={{ color: cmd.outline }}>
                      {r.residences?.public_area ?? "Zona sin definir"} · {r.users?.email ?? "—"}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Detalle */}
      <div className="flex-1 overflow-y-auto p-8">
        {detail ? (
          <ProfileEditDetail key={detail.id} {...detail} />
        ) : (
          <p className="text-sm" style={{ color: cmd.outline }}>
            Seleccioná una edición de la lista para revisarla.
          </p>
        )}
      </div>
    </div>
  );
}
