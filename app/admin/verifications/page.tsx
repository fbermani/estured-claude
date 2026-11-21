import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cmd } from "@/components/admin/ui/tokens";
import { QueueLayout } from "@/components/admin/ui/QueueLayout";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { VerificationDetail } from "@/app/admin/verifications/VerificationDetail";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { countPendingCollectionMethods } from "@/lib/residences/collectionApprovalDb";
import { pluralize } from "@/lib/format/plural";
import {
  QUEUE_CHIPS,
  QUEUE_STATUSES,
  REVIEW_EVENT_ACTIONS,
  queueChipKey,
  sortQueue,
  summarizeQueue,
  wasResubmitted,
} from "@/lib/residences/verificationReview";

export const metadata: Metadata = { title: "Verificación de residencias" };
export const dynamic = "force-dynamic";

export default async function VerificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  await requireAdmin();
  const { id: selectedId } = await searchParams;
  const admin = getSupabaseAdmin();

  const queueRows = admin
    ? (
        await admin
          .from("residences")
          .select("id, name, public_area, status, created_at")
          .in("status", [...QUEUE_STATUSES])
          .order("created_at", { ascending: true })
      ).data ?? []
    : [];
  // Indicio de reenvío (DR5/DR7): el evento más reciente de cada residencia entre "pidió cambios" y "reenvió".
  const latestEventByResidence = new Map<string, string>();
  if (admin && queueRows.length > 0) {
    const { data: events } = await admin
      .from("audit_logs")
      .select("entity_id, action, created_at")
      .eq("entity_type", "residences")
      .in("entity_id", queueRows.map((r) => r.id))
      .in("action", [...REVIEW_EVENT_ACTIONS])
      .order("created_at", { ascending: false });
    for (const e of events ?? []) {
      const id = e.entity_id as string;
      if (!latestEventByResidence.has(id)) latestEventByResidence.set(id, e.action as string);
    }
  }
  // Ciclo 56: el responsable es privado (`residence_private_details`, solo service role).
  const queueResponsibles = new Map<string, string | null>();
  if (admin && queueRows.length > 0) {
    const { data: privateRows } = await admin
      .from("residence_private_details")
      .select("residence_id, responsible_name")
      .in("residence_id", queueRows.map((r) => r.id));
    for (const row of privateRows ?? []) queueResponsibles.set(row.residence_id as string, row.responsible_name as string | null);
  }
  const queue = sortQueue(
    queueRows.map((r) => ({
      ...r,
      responsible_name: queueResponsibles.get(r.id) ?? null,
      resubmitted: wasResubmitted(r.status, latestEventByResidence.get(r.id)),
    })),
  );
  const queueSummary = summarizeQueue(queue.map((r) => r.status));

  const activeId = selectedId ?? queue[0]?.id ?? null;

  let detail = null;
  if (admin && activeId) {
    const [{ data: residence }, { data: privateDetails }, { data: verification }, { data: sections }, { data: roomTypes }, { data: photos, error: photosError }, { data: rulesFile }] =
      await Promise.all([
        admin.from("residences").select("*").eq("id", activeId).single(),
        admin.from("residence_private_details").select("responsible_name, responsible_contact").eq("residence_id", activeId).maybeSingle(),
        admin.from("residence_verifications").select("*").eq("residence_id", activeId).single(),
        admin.from("residence_profile_sections").select("section_type, content").eq("residence_id", activeId),
        admin
          .from("room_types")
          .select("name, monthly_price_usd, profile_availability(available_count)")
          .eq("residence_id", activeId),
        admin
          .from("files")
          .select("storage_path, status")
          .eq("related_entity_type", "residences")
          .eq("related_entity_id", activeId)
          .eq("document_type", "residence_photo")
          .order("created_at", { ascending: true }),
        admin
          .from("files")
          .select("id, filename, size_bytes")
          .eq("related_entity_type", "residences")
          .eq("related_entity_id", activeId)
          .eq("document_type", "residence_rules_document")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    if (photosError) console.error("[admin-verify] no se pudieron leer las fotos de la residencia:", photosError);

    // Ciclo 66 (DR5): indicio "Reenviada tras cambios pedidos" = lo último que pasó fue un reenvío (audit log).
    const { data: lastReviewEvent } = await admin
      .from("audit_logs")
      .select("action, created_at")
      .eq("entity_type", "residences")
      .eq("entity_id", activeId)
      .in("action", [...REVIEW_EVENT_ACTIONS])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const resubmittedAt =
      residence && wasResubmitted(residence.status as string, lastReviewEvent?.action as string | undefined)
        ? (lastReviewEvent?.created_at as string)
        : null;

    // DR63 2b: medios de cobro de la reserva por aprobar de esta residencia (informativo, no bloquea la verificación).
    const collectionPendingCount = await countPendingCollectionMethods(admin, activeId);

    if (residence && verification) {
      const sectionMap = Object.fromEntries((sections ?? []).map((s) => [s.section_type, s.content]));
      detail = {
        residence: {
          ...residence,
          responsible_name: (privateDetails?.responsible_name as string | null) ?? "",
          responsible_contact: (privateDetails?.responsible_contact as string | null) ?? "",
        },
        verification,
        residenceStatus: residence.status as string,
        collectionPendingCount,
        resubmittedAt,
        services: (sectionMap.services?.items as string[]) ?? [],
        nearUniversities: (sectionMap.near_universities?.items as string[]) ?? [],
        rulesSummary: (sectionMap.rules?.summary as string) ?? "",
        roomTypes: (roomTypes ?? []).map((rt) => ({
          name: rt.name,
          priceUsd: Number(rt.monthly_price_usd),
          availableCount:
            (rt.profile_availability as unknown as { available_count: number | null } | null)
              ?.available_count ?? 0,
        })),
        // Mismas fotos que cuentan para la regla de publicación (aprobadas): ver lib/residences/photos.ts.
        // `null` si la lectura falló: el detalle avisa en vez de mostrar "0 de 3".
        approvedPhotoCount: photosError ? null : (photos ?? []).filter((p) => p.status === "approved").length,
        photoUrls: (photos ?? []).map(
          (p) => admin.storage.from("public-residence-media").getPublicUrl(p.storage_path).data.publicUrl,
        ),
        rulesFile: rulesFile
          ? {
              id: rulesFile.id,
              filename: rulesFile.filename,
              sizeKb: Math.round(rulesFile.size_bytes / 1024),
            }
          : null,
      };
    }
  }

  return (
    <QueueLayout
      explicit={Boolean(selectedId)}
      backHref={"/admin/verifications"}
      queue={
        <>
        <div className="border-b p-4" style={{ borderColor: cmd.border }}>
          <h1 className="text-lg font-bold" style={{ color: cmd.onSurface }}>
            Verificación de residencias
          </h1>
          <p className="text-xs" style={{ color: cmd.outline }}>
            {pluralize(queueSummary.toReview, "pendiente", "pendientes")}
            {queueSummary.waitingForResidence > 0 && ` · ${queueSummary.waitingForResidence} esperando a la residencia`}
          </p>
        </div>
        {queue.length === 0 ? (
          <p className="p-4 text-sm" style={{ color: cmd.outline }}>
            No hay residencias esperando verificación.
          </p>
        ) : (
          <ul>
            {queue.map((r) => {
              const badge = QUEUE_CHIPS[queueChipKey(r.status, r.resubmitted)];
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
                      {r.public_area ?? "Zona sin definir"} · {r.responsible_name ?? "Responsable sin cargar"}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        </>
      }
      detail={
        <>
        {detail ? (
          <VerificationDetail key={detail.residence.id} {...detail} />
        ) : (
          <p className="text-sm" style={{ color: cmd.outline }}>
            Seleccioná una residencia de la lista para revisarla.
          </p>
        )}
        </>
      }
    />
  );
}
