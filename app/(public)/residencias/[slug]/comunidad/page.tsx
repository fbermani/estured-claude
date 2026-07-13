import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCommunityVisibility } from "@/lib/residents/communityVisibility";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Comunidad — ${slug}` };
}

export default async function ResidenceCommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = getSupabaseAdmin();
  if (!admin) notFound();

  const { data: residence } = await admin
    .from("residences")
    .select("id, name, slug, public_area")
    .eq("slug", slug)
    .eq("status", "verified_active")
    .maybeSingle();
  if (!residence) notFound();

  const sessionUser = await getSessionUser();
  const viewerType = sessionUser ? "registered" : "guest";
  const summary = await getCommunityVisibility(admin, residence.id, viewerType);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href={`/residencias/${slug}`} className="text-sm text-forest-700 hover:underline">
        ← {residence.name}
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-ink sm:text-3xl">Comunidad de {residence.name}</h1>
      <p className="mt-2 text-sm text-ink-soft">{residence.public_area}, CABA</p>

      {!sessionUser && (
        <p className="mt-4 rounded-field bg-sand-100 px-4 py-3 text-sm text-ink-soft">
          Iniciá sesión para ver perfiles individuales de residentes que eligieron mostrarse.
        </p>
      )}

      {summary.totalResidents === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="Todavía sin residentes cargados"
            description="La residencia todavía no cargó a nadie en su comunidad visible."
          />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <p className="text-2xl font-bold text-ink">{summary.totalResidents}</p>
              <p className="text-sm text-ink-soft">Residentes cargados</p>
              {summary.pendingActivationCount > 0 && (
                <p className="mt-1 text-xs text-ink-faint">
                  {summary.pendingActivationCount} pendientes de activar cuenta
                </p>
              )}
            </Card>
            <Card className="p-5">
              <p className="text-sm font-semibold text-ink">Por tipo de habitación</p>
              <ul className="mt-2 space-y-1 text-sm text-ink-soft">
                {summary.byRoomType.map((rt) => (
                  <li key={rt.roomTypeId ?? "sin-tipo"}>
                    {rt.roomTypeName}: {rt.count}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {summary.cards.map((card) => (
              <Card key={card.residentStayId} className="p-5">
                {card.kind === "placeholder" ? (
                  <>
                    <p className="font-semibold text-ink-faint">Plaza ocupada</p>
                    <p className="mt-1 text-xs text-ink-faint">{card.roomTypeName ?? "Sin tipo asignado"}</p>
                    <p className="mt-2 text-xs text-ink-faint">Residente pendiente de activar cuenta</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-ink">{card.firstName}</p>
                    <p className="text-xs text-ink-faint">{card.roomTypeName ?? "Sin tipo asignado"}</p>
                    <div className="mt-2 space-y-0.5 text-xs text-ink-soft">
                      {card.nationality && (
                        <p>
                          {card.countryFlag} {card.nationality}
                        </p>
                      )}
                      {card.age != null && <p>{card.age} años</p>}
                      {card.career && <p>{card.career}</p>}
                      {card.originCity && <p>De {card.originCity}</p>}
                    </div>
                  </>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      <p className="mt-10 text-center text-xs text-ink-faint">
        <Badge tone="neutral">Nunca se muestran</Badge> apellido completo, email, teléfono, fecha de nacimiento,
        universidad ni documentos.
      </p>
    </div>
  );
}
