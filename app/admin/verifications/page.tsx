import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cmd } from "@/components/admin/ui/tokens";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { VerificationDetail } from "@/app/admin/verifications/VerificationDetail";

export const metadata: Metadata = { title: "Validación de residencias" };
export const dynamic = "force-dynamic";

const PENDING_STATUSES = ["pending_verification", "verification_scheduled", "needs_changes"];

const statusBadge: Record<string, { label: string; tone: "amber" | "violet" | "rose" }> = {
  pending_verification: { label: "Nueva", tone: "amber" },
  verification_scheduled: { label: "Visita programada", tone: "violet" },
  needs_changes: { label: "Cambios pedidos", tone: "rose" },
};

export default async function VerificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id: selectedId } = await searchParams;
  const admin = getSupabaseAdmin();

  const queue = admin
    ? (
        await admin
          .from("residences")
          .select("id, name, public_area, status, responsible_name, created_at")
          .in("status", PENDING_STATUSES)
          .order("created_at", { ascending: true })
      ).data ?? []
    : [];

  const activeId = selectedId ?? queue[0]?.id ?? null;

  let detail = null;
  if (admin && activeId) {
    const [{ data: residence }, { data: verification }, { data: sections }, { data: roomTypes }, { data: photos }, { data: rulesFile }] =
      await Promise.all([
        admin.from("residences").select("*").eq("id", activeId).single(),
        admin.from("residence_verifications").select("*").eq("residence_id", activeId).single(),
        admin.from("residence_profile_sections").select("section_type, content").eq("residence_id", activeId),
        admin
          .from("room_types")
          .select("name, monthly_price_usd, profile_availability(available_count)")
          .eq("residence_id", activeId),
        admin
          .from("files")
          .select("storage_path")
          .eq("related_entity_type", "residences")
          .eq("related_entity_id", activeId)
          .eq("document_type", "residence_photo")
          .order("created_at", { ascending: true }),
        admin
          .from("files")
          .select("filename, storage_path, size_bytes")
          .eq("related_entity_type", "residences")
          .eq("related_entity_id", activeId)
          .eq("document_type", "residence_rules_document")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    const rulesFileSignedUrl = rulesFile
      ? (
          await admin.storage
            .from("private-residence-documents")
            .createSignedUrl(rulesFile.storage_path, 3600)
        ).data?.signedUrl ?? null
      : null;

    if (residence && verification) {
      const sectionMap = Object.fromEntries((sections ?? []).map((s) => [s.section_type, s.content]));
      detail = {
        residence,
        verification,
        services: (sectionMap.services?.items as string[]) ?? [],
        nearUniversities: (sectionMap.near_universities?.items as string[]) ?? [],
        rulesSummary: (sectionMap.rules?.summary as string) ?? "",
        roomTypes: (roomTypes ?? []).map((rt) => ({
          name: rt.name,
          priceUsd: Number(rt.monthly_price_usd),
          availableCount:
            (rt.profile_availability as unknown as { available_count: number | null }[])?.[0]
              ?.available_count ?? 0,
        })),
        photoUrls: (photos ?? []).map(
          (p) => admin.storage.from("public-residence-media").getPublicUrl(p.storage_path).data.publicUrl,
        ),
        rulesFile: rulesFile
          ? {
              filename: rulesFile.filename,
              sizeKb: Math.round(rulesFile.size_bytes / 1024),
              signedUrl: rulesFileSignedUrl,
            }
          : null,
      };
    }
  }

  return (
    <div className="flex h-full">
      {/* Cola */}
      <div className="w-96 shrink-0 overflow-y-auto border-r" style={{ borderColor: cmd.border }}>
        <div className="border-b p-4" style={{ borderColor: cmd.border }}>
          <h1 className="text-lg font-bold" style={{ color: cmd.onSurface }}>
            Validación de Residencias
          </h1>
          <p className="text-xs" style={{ color: cmd.outline }}>
            {queue.length} pendientes
          </p>
        </div>
        {queue.length === 0 ? (
          <p className="p-4 text-sm" style={{ color: cmd.outline }}>
            No hay residencias esperando validación.
          </p>
        ) : (
          <ul>
            {queue.map((r) => {
              const badge = statusBadge[r.status] ?? statusBadge.pending_verification;
              const active = r.id === activeId;
              return (
                <li key={r.id} style={{ borderBottom: `1px solid ${cmd.border}` }}>
                  <Link
                    href={`/admin/verifications?id=${r.id}`}
                    className="block px-4 py-3"
                    style={active ? { backgroundColor: cmd.onPrimaryContainer } : undefined}
                  >
                    <div className="flex items-center justify-between">
                      <AdminBadge tone={badge.tone}>{badge.label}</AdminBadge>
                    </div>
                    <p className="mt-1.5 text-sm font-bold" style={{ color: cmd.onSurface }}>
                      {r.name}
                    </p>
                    <p className="text-xs" style={{ color: cmd.outline }}>
                      {r.public_area ?? "Zona sin definir"} · {r.responsible_name}
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
          <VerificationDetail {...detail} />
        ) : (
          <p className="text-sm" style={{ color: cmd.outline }}>
            Seleccioná una residencia de la lista para revisarla.
          </p>
        )}
      </div>
    </div>
  );
}
