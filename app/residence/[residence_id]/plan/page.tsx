import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { assertResidenceAccess } from "@/lib/residences/access";
import { getOperationalAccess } from "@/lib/residences/operationalAccess";
import { PREMIUM_FEATURES, VERIFIED_FEATURES, PLAN_PRICE_NOTE } from "@/lib/residences/planFeatures";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Planes" };
export const dynamic = "force-dynamic";

/**
 * Planes de la residencia (DR17, docs/00 §31): comparación Perfil Verificado vs Plan Premium (Gestión Operativa).
 * Es una demostración visual: no hay precios ni cobro y nada se bloquea (D8, DR23).
 */
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

  // Si no se pudo leer el plan (null) no se afirma ninguno como «actual».
  const access = await getOperationalAccess(residenceId);
  const isPremium = access === true;
  const isVerified = access === false;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-3xl font-bold text-ink">Planes</h1>
      <p className="mt-1 text-ink-soft">
        Mirá qué incluye cada plan. Perfil Verificado es gratuito; Plan Premium está bonificado el primer año para Residencias fundadoras.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card className={`flex h-full flex-col p-8 ${isVerified ? "border-forest" : ""}`}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="sage">Gratuito</Badge>
            {isVerified && <Badge tone="petrol">Tu plan actual</Badge>}
          </div>
          <h2 className="mt-3 text-2xl font-bold text-ink">Perfil Verificado</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Tu residencia en el catálogo, con el sello de verificación de EstuRed y gestión de solicitudes.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {VERIFIED_FEATURES.map((f) => (
              <li key={f.label} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-success-bg text-success-fg">
                  <Icon name="check" className="text-base" />
                </span>
                <span>
                  <span className="font-bold text-ink">{f.label}</span>
                  <span className="mt-0.5 block text-ink-soft">{f.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className={`flex h-full flex-col p-8 ${isPremium ? "border-forest" : ""}`}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="amber">Plan Premium</Badge>
            {isPremium && <Badge tone="petrol">Tu plan actual</Badge>}
          </div>
          <h2 className="mt-3 text-2xl font-bold text-ink">
            Plan Premium
          </h2>
          <p className="mt-2 text-sm text-ink-soft">
            Todo lo del Perfil Verificado, más la Gestión Operativa: habitaciones, plazas, residentes, comunidad y renovaciones.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {PREMIUM_FEATURES.map((f) => (
              <li key={f.label} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-orange-tint text-orange-700">
                  <Icon name={isPremium ? "check" : "lock"} className="text-base" />
                </span>
                <span>
                  <span className="font-bold text-ink">{f.label}</span>
                  <span className="mt-0.5 block text-ink-soft">{f.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <p className="mt-6 text-center text-xs text-ink-faint">
        Plan Premium bonificado el primer año para Residencias fundadoras. {PLAN_PRICE_NOTE}
      </p>

      <Card className="mt-8 flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-ink">
            {isPremium ? "Tenés el Plan Premium" : "¿Querés el Plan Premium?"}
          </h3>
          <p className="mt-1 text-sm text-ink-soft">
            {isPremium
              ? "Tu residencia tiene el Plan Premium activo. Si tenés dudas sobre el plan, escribinos."
              : "Escribinos y te contamos cómo sumarla a tu residencia. No pagás nada sin aceptarlo antes."}
          </p>
        </div>
        <Link
          href={`/residence/${residenceId}/support`}
          className="shrink-0 rounded-full bg-forest px-5 py-2.5 text-sm font-bold text-white hover:bg-forest-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          Contactar a EstuRed
        </Link>
      </Card>
    </div>
  );
}
