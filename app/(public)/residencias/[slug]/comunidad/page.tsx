import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getCommunityVisibility } from "@/lib/residents/communityVisibility";
import { CommunityBrowser } from "@/components/residences/CommunityBrowser";
import { ReservationSelectionProvider } from "@/components/residences/reservationSelection";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Comunidad — ${slug}` };
}

/**
 * Comunidad de una residencia — layout a semejanza de la referencia
 * `estured_comunidad_actual_modal_full_view` (barra de ocupación,
 * secciones colapsables por tipo, panel lateral de perfil), como página
 * en vez de modal para que sea linkeable/compartible.
 */
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
    // Esta página no tiene panel "Tu solicitud de reserva" propio (no
    // hay #solicitud acá) — el Provider igual es necesario porque
    // CommunityBrowser lo requiere; FreeBedSlot detecta la ausencia del
    // panel y navega a la ficha real en vez de solo actualizar estado.
    <ReservationSelectionProvider>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <Link href={`/residencias/${slug}`} className="text-sm text-forest-700 hover:underline">
          ← {residence.name}
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-ink sm:text-3xl">Comunidad actual de la residencia</h1>
        <p className="mt-1 text-ink-soft">
          Conocé a tus futuros compañeros — cada estudiante decide qué mostrar. {residence.public_area}, CABA.
        </p>

        {!sessionUser && (
          <p className="mt-4 rounded-field bg-sand-100 px-4 py-3 text-sm text-ink-soft">
            <Link href={`/login?next=/residencias/${slug}/comunidad`} className="font-semibold text-forest-700 hover:underline">
              Iniciá sesión
            </Link>{" "}
            para ver los perfiles individuales de los residentes que eligieron mostrarse.
          </p>
        )}

        <div className="mt-8">
          {summary.totalResidents === 0 ? (
            <EmptyState
              icon="groups"
              title="Todavía sin residentes cargados"
              description="La residencia todavía no cargó a nadie en su comunidad visible."
            />
          ) : (
            <CommunityBrowser summary={summary} slug={slug} isGuest={!sessionUser} />
          )}
        </div>

        <p className="mt-10 text-center text-xs text-ink-faint">
          <Badge tone="neutral">Nunca se muestran</Badge> apellido completo, email, teléfono, fecha de nacimiento,
          universidad ni documentos.
        </p>
      </div>
    </ReservationSelectionProvider>
  );
}
