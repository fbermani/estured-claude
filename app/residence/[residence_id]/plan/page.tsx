import { formatDate } from "@/lib/dates/format";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertResidenceAccess } from "@/lib/residences/access";
import { getResidencePrivateDetails } from "@/lib/residences/privateDetails";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";

export const metadata: Metadata = { title: "Tu plan" };
export const dynamic = "force-dynamic";

export default async function ResidencePlanPage({
  params,
}: {
  params: Promise<{ residence_id: string }>;
}) {
  const { residence_id: residenceId } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser) notFound();

  const admin = getSupabaseAdmin();
  if (!admin) notFound();

  const hasAccess = await assertResidenceAccess(admin, sessionUser.id, residenceId);
  if (!hasAccess) notFound();

  const { data: residence } = await admin
    .from("residences")
    .select("name, has_operational_management_access, pioneer_free_access_until")
    .eq("id", residenceId)
    .maybeSingle();
  if (!residence) notFound();
  // Ciclo 56: la fecha de otorgamiento sale de la tabla privada (auditoría interna del acceso).
  const privateDetails = await getResidencePrivateDetails(admin, residenceId);
  const operationalAccessGrantedAt = privateDetails?.operational_access_granted_at ?? null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-2xl font-bold text-ink md:text-3xl">Tu plan</h1>
      <p className="mt-1 text-ink-soft">Estado de acceso a Gestión Operativa para {residence.name}.</p>

      <Card className="mt-6 p-6">
        <div className="flex items-center gap-3">
          <div className={`rounded-field p-2.5 ${residence.has_operational_management_access ? "bg-forest-tint text-forest-700" : "bg-cream-2 text-ink-soft"}`}>
            <Icon name={residence.has_operational_management_access ? "verified" : "lock"} className="text-2xl" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-ink">
              {residence.has_operational_management_access ? "Plan Gestión Operativa activo" : "Plan Perfil Verificado"}
            </h2>
            <Badge tone={residence.has_operational_management_access ? "sage" : "neutral"}>
              {residence.has_operational_management_access ? "Con acceso" : "Sin acceso a Gestión Operativa"}
            </Badge>
          </div>
        </div>

        <p className="mt-4 text-sm text-ink-soft">
          {residence.has_operational_management_access
            ? "Tu residencia tiene acceso al plan Gestión Operativa, otorgado por el equipo de EstuRed."
            : "Tu residencia opera hoy en el plan Perfil Verificado (el modo estándar de todas las residencias en EstuRed). El equipo de EstuRed puede otorgar acceso a Gestión Operativa de forma manual."}
        </p>

        {residence.has_operational_management_access && (
          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            {operationalAccessGrantedAt && (
              <div className="flex justify-between">
                <dt className="text-ink-faint">Otorgado el</dt>
                <dd className="font-semibold text-ink">
                  {formatDate(operationalAccessGrantedAt)}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-ink-faint">Vigencia</dt>
              <dd className="font-semibold text-ink">
                {residence.pioneer_free_access_until
                  ? `Hasta el ${formatDateOnly(residence.pioneer_free_access_until)}`
                  : "Sin fecha límite"}
              </dd>
            </div>
          </dl>
        )}

        <p className="mt-4 text-xs text-ink-faint">
          ¿Tenés preguntas sobre tu plan? Escribinos desde{" "}
          <a href={`/residence/${residenceId}/support`} className="font-semibold text-forest-700 hover:underline">
            Soporte
          </a>
          .
        </p>
      </Card>
    </div>
  );
}
