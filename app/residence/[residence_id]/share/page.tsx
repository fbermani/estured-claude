import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResidenceHero } from "@/components/residences/ResidenceHero";
import { BackToProfileLink } from "@/components/residences/BackToProfileLink";
import { PermissionNote } from "@/components/residences/PermissionGate";
import { EmptyState } from "@/components/ui/EmptyState";
import { ShareMessageEditor } from "@/components/share/ShareMessageEditor";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getResidenceMembership } from "@/lib/residences/access";
import { can } from "@/lib/residences/permissions";
import { loadShareTemplate } from "@/lib/share/shareMessage";
import { loadShareData } from "@/lib/share/shareData";
import { DEFAULT_SHARE_TEMPLATE } from "@/lib/share/resolveShareMessage";

export const metadata: Metadata = { title: "Compartir tu ficha" };
export const dynamic = "force-dynamic";

export default async function ResidenceSharePage({ params }: { params: Promise<{ residence_id: string }> }) {
  const { residence_id: residenceId } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser) notFound();
  const admin = getSupabaseAdmin();
  if (!admin) notFound();
  const membership = await getResidenceMembership(admin, sessionUser.id, residenceId);
  if (!membership) notFound();
  // Solo quien puede editar el perfil edita y guarda el mensaje; el resto lo ve y lo comparte (el servidor valida cada acción).
  const canEdit = can(membership, "profile.edit");

  const [data, template] = await Promise.all([loadShareData(admin, residenceId), loadShareTemplate(admin, residenceId)]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <BackToProfileLink residenceId={residenceId} className="mb-2" />
      <ResidenceHero
        icon="share"
        title="Compartir tu ficha"
        subtitle="Mandá tu ficha por WhatsApp con un mensaje listo: fotos, precios y las respuestas a las consultas más frecuentes."
      />
      <p className="text-sm text-ink-soft">
        Se abre WhatsApp con el mensaje armado y elegís a quién enviarlo. Los precios y datos se completan solos con lo que cargaste en tu ficha;
        la solicitud sigue siendo dentro de EstuRed y queda sujeta a confirmación.
      </p>
      {!canEdit && <PermissionNote className="mt-3" text="Podés ver y compartir el mensaje. Para cambiarlo, pedile el permiso de perfil al dueño." />}
      {!data ? (
        <div className="mt-8">
          <EmptyState icon="error" title="No pudimos armar el mensaje" description="Recargá la página en unos minutos. Si sigue pasando, avisale a Soporte." />
        </div>
      ) : (
        <ShareMessageEditor
          residenceId={residenceId}
          initialTemplate={template.template}
          defaultTemplate={DEFAULT_SHARE_TEMPLATE}
          initialIsCustom={template.isCustom}
          values={data.values}
          link={data.link}
          canEdit={canEdit}
          schemaReady={template.schemaReady}
          previewImageUrl={data.published ? `/residencias/${encodeURIComponent(data.slug)}/opengraph-image` : null}
          changeCoverHref={canEdit ? `/residence/${residenceId}/profile` : null}
        />
      )}
      {data && !data.published && (
        <p role="status" className="mt-4 rounded-field bg-amber-soft-100 px-4 py-3 text-sm text-ink">
          Tu ficha todavía no está publicada: el link no va a abrir hasta que EstuRed la verifique.
        </p>
      )}
    </div>
  );
}
