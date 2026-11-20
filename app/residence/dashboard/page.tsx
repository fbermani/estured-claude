import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser, hasAnyRole } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentExchangeRate } from "@/lib/exchange/rate";
import { getOwnerResidenceCards } from "@/lib/residences/ownerDashboard";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHero } from "@/components/ui/PageHero";
import { Badge } from "@/components/ui/Badge";
import { AreaHeader } from "@/components/layout/AreaHeader";
import { Footer } from "@/components/layout/Footer";
import { MAX_RESIDENCES_PER_OWNER } from "@/lib/residences/addResidenceForOwner";
import { OwnerResidenceGrid } from "@/components/residences/OwnerResidenceGrid";
import { SkipLink } from "@/components/ui/SkipLink";
import { PushPermissionCard } from "@/components/push/PushPermissionCard";
import { PushSettings } from "@/components/push/PushSettings";

export const metadata: Metadata = { title: "Panel de residencia" };
export const dynamic = "force-dynamic";

/**
 * Vista multi-residencia en scroll vertical, sin agregado (docs/00
 * §25.3, docs/11 §7.3: "No habrá un dashboard agregado con métricas
 * consolidadas de todas las residencias"). Cada card muestra métricas
 * reales de ESA residencia únicamente — nunca sumadas entre
 * residencias. Con una sola residencia hoy en la mayoría de las
 * cuentas demo, pero la estructura ya soporta hasta 10 (docs/00 §25.1).
 */
export default async function ResidenceDashboardPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/login?next=/residence/dashboard");

  const admin = getSupabaseAdmin();
  const [validCards, rate] = await Promise.all([
    admin ? getOwnerResidenceCards(admin, sessionUser.id) : Promise.resolve([]),
    admin ? getCurrentExchangeRate() : Promise.resolve(null),
  ]);
  const arsPerUsd = rate?.arsPerUsd ?? 0;
  // La tarjeta de avisos se ofrece recién cuando la residencia ya recibió al menos una solicitud.
  let hasReceivedRequest = false;
  if (admin && validCards.length > 0) {
    const { count, error: requestsError } = await admin
      .from("application_requests")
      .select("id", { count: "exact", head: true })
      .in("residence_id", validCards.map((c) => c.residenceId));
    if (requestsError) console.error("[residence dashboard] conteo de solicitudes falló:", requestsError.code, requestsError.message);
    hasReceivedRequest = (count ?? 0) > 0;
  }
  // H22: solo el owner suma residencias (docs/11 §7.3), y hasta el tope de 10.
  // DR10: el reporte PDF y sumar residencias son solo del dueño. Se cuentan las residencias donde es dueño (no donde es staff).
  const ownedCount = validCards.filter((c) => c.role === "owner").length;
  const canAddResidence = hasAnyRole(sessionUser, ["residence_owner"]) && ownedCount < MAX_RESIDENCES_PER_OWNER;

  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <AreaHeader areaLabel="Residencias" userEmail={sessionUser.email} tone="residence" />
      <main id="contenido" tabIndex={-1} className="focus:outline-none tone-residence mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <PageHero
          tone="residence"
          eyebrow="Residencias"
          eyebrowIcon="apartment"
          title="Tus residencias"
          subtitle="Gestioná el perfil y la publicación de cada una."
          glyph="apartment"
          className="mb-8"
          status={
            validCards.length > 0 ? (
              <Badge tone="neutral">{validCards.length === 1 ? "1 residencia" : `${validCards.length} residencias`}</Badge>
            ) : undefined
          }
          actions={
            ownedCount > 0 || canAddResidence ? (
              <div className="flex flex-wrap gap-2">
                {ownedCount > 0 && (
                  <Button href="/residence/dashboard/pdf" variant="outline" size="sm">
                    <Icon name="download" className="text-base" />
                    Reporte PDF
                  </Button>
                )}
                {canAddResidence && (
                  <Button href="/residence/settings/new" variant="outline" size="sm">
                    + Sumar otra residencia
                  </Button>
                )}
              </div>
            ) : undefined
          }
        />

        {hasReceivedRequest && (
          <div className="mb-6">
            <PushPermissionCard audience="residence" />
          </div>
        )}

        {validCards.length === 0 ? (
          <EmptyState
            tone="residence"
            icon="apartment"
            title="Todavía no tenés residencias cargadas"
            description="Si acabás de registrarte, puede que falte completar el alta."
            action={
              canAddResidence ? (
                <Button href="/residence/settings/new" size="sm">
                  Cargar mi residencia
                </Button>
              ) : undefined
            }
          />
        ) : (
          <OwnerResidenceGrid cards={validCards} arsPerUsd={arsPerUsd} />
        )}

        <div className="mt-10 max-w-xl">
          <PushSettings />
        </div>
      </main>
      <Footer staffView />
    </div>
  );
}
