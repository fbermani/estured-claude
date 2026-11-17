import { ShareFichaSheet } from "@/components/share/ShareFichaSheet";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getResidenceMembership } from "@/lib/residences/access";
import { can } from "@/lib/residences/permissions";
import { loadShareTemplate } from "@/lib/share/shareMessage";
import { loadShareData } from "@/lib/share/shareData";
import { DEFAULT_SHARE_TEMPLATE } from "@/lib/share/resolveShareMessage";

/**
 * Server Component que monta «Compartir esta ficha» en la ficha pública SOLO para el equipo de ESTA residencia (dueño o staff activo).
 * Para cualquier otra persona (visitante, estudiante, familiar, equipo de otra residencia) devuelve `null`: no se arma ni se envía nada.
 * Uso: `<ShareFichaSheetServer residenceId={residence.id} />` (ver `docs/NEXT_STEPS.md`: falta ubicarlo en el hero de la ficha).
 */
export async function ShareFichaSheetServer({ residenceId }: { residenceId: string }) {
  const user = await getSessionUser();
  const admin = getSupabaseAdmin();
  if (!user || !admin) return null;
  const membership = await getResidenceMembership(admin, user.id, residenceId);
  if (!membership) return null;
  const [data, template] = await Promise.all([loadShareData(admin, residenceId), loadShareTemplate(admin, residenceId)]);
  if (!data) return null;
  return (
    <ShareFichaSheet
      residenceId={residenceId}
      initialTemplate={template.template}
      defaultTemplate={DEFAULT_SHARE_TEMPLATE}
      initialIsCustom={template.isCustom}
      values={data.values}
      link={data.link}
      canEdit={can(membership, "profile.edit")}
      schemaReady={template.schemaReady}
    />
  );
}
