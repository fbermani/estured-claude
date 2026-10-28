import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getResidenceMembership } from "@/lib/residences/access";
import { can } from "@/lib/residences/permissions";
import { PermissionGate } from "@/components/residences/PermissionGate";
import { formatDate } from "@/lib/dates/format";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { RegulationText } from "@/components/regulations/RegulationText";
import { RegulationEditor } from "@/app/residence/[residence_id]/regulation/RegulationEditor";
import { loadCurrentRegulation, listRegulationVersions } from "@/lib/regulations/current";
import { MODEL_LEGAL_NOTE, buildModelText } from "@/lib/regulations/modelTemplate";
import { normalizeRegulationText } from "@/lib/regulations/text";

export const metadata: Metadata = { title: "Reglamento" };
export const dynamic = "force-dynamic";

const STATUS_BADGE = {
  published: { label: "Vigente", tone: "sage" },
  superseded: { label: "Reemplazada", tone: "neutral" },
  draft: { label: "Borrador", tone: "amber" },
} as const;

export default async function ResidenceRegulationPage({ params }: { params: Promise<{ residence_id: string }> }) {
  const { residence_id: residenceId } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser) notFound();
  const admin = getSupabaseAdmin();
  if (!admin) notFound();
  const membership = await getResidenceMembership(admin, sessionUser.id, residenceId);
  if (!membership) notFound();
  // DR14 / docs/05 §16bis: editar el reglamento requiere `profile.edit` (solo presentación; el servidor valida al publicar).
  const canEdit = can(membership, "profile.edit");

  const [current, history] = await Promise.all([loadCurrentRegulation(admin, residenceId), listRegulationVersions(admin, residenceId)]);
  const { data: resRow } = await admin.from("residences").select("name").eq("id", residenceId).maybeSingle();
  const residenceName = (resRow?.name as string | undefined) ?? "";
  const modelText = normalizeRegulationText(buildModelText());

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-ink">Reglamento</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Es el reglamento que lee quien mira tu ficha y que acepta al enviar su solicitud. Podés partir del modelo de EstuRed o
        cargar el tuyo. No lo revisa EstuRed: lo que publicás rige apenas lo publicás, y cada versión queda registrada.
      </p>
      <p className="mt-2 rounded-field bg-amber-soft-100 px-3 py-2 text-xs font-semibold text-ink-soft">{MODEL_LEGAL_NOTE}</p>

      {!current.ok ? (
        <div className="mt-8">
          <EmptyState title="No pudimos cargar el reglamento" description="Recargá la página en unos minutos. Si sigue sin cargar, escribinos desde Soporte." />
        </div>
      ) : (
        <>
          {!current.view.schemaReady && (
            <p role="status" className="mt-4 rounded-field bg-warning-bg px-4 py-3 text-sm text-warning-fg">
              Todavía no se pueden publicar reglamentos en este entorno. Mientras tanto, tu ficha muestra el modelo de EstuRed.
            </p>
          )}
          <p className="mt-6 text-sm text-ink-soft">
            {current.view.isBaseModel
              ? "Hoy tu ficha muestra el modelo de EstuRed sin adaptar. Publicá tu versión para reemplazarlo."
              : `Versión vigente: ${current.view.versionNumber}${current.view.publishedAt ? `, publicada el ${formatDate(current.view.publishedAt)}` : ""}.`}
          </p>
          <Card className="mt-4 p-5">
            <PermissionGate allowed={canEdit}>
              <RegulationEditor
                residenceId={residenceId}
                initialText={current.view.isBaseModel ? "" : current.view.text}
                initialSource={current.view.source}
                modelText={modelText}
                canEdit={canEdit && current.view.schemaReady}
                residenceName={residenceName}
              />
            </PermissionGate>
          </Card>

          <section className="mt-10">
            <h2 className="text-lg font-bold text-ink">Historial de versiones</h2>
            {!history.ok ? (
              <p className="mt-2 text-sm text-ink-soft">No pudimos cargar el historial. Recargá la página.</p>
            ) : history.versions.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">Todavía no publicaste ninguna versión.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {history.versions.map((v) => {
                  const badge = STATUS_BADGE[v.status];
                  const text = typeof v.content?.text === "string" ? v.content.text : "";
                  return (
                    <li key={v.id}>
                      <Card className="p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-ink">Versión {v.version_number}</span>
                          <Badge tone={badge.tone}>{badge.label}</Badge>
                          <Badge>{v.source === "model" ? "Modelo de EstuRed" : "Reglamento propio"}</Badge>
                          <span className="text-xs text-ink-faint">{v.published_at ? formatDate(v.published_at) : ""}</span>
                        </div>
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm font-semibold text-forest-700">Ver el texto</summary>
                          <RegulationText text={text} className="mt-3 max-h-96 overflow-y-auto" />
                        </details>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
