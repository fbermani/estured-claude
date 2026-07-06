import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedResidences, getResidenceBySlug } from "@/lib/mock/residences";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatusTag, availabilityHelpText } from "@/components/ui/StatusTag";
import { TrustBadge } from "@/components/residences/TrustBadge";
import { formatArs, formatUsd, usdToArsReferencial } from "@/lib/mock/exchange";

export function generateStaticParams() {
  return getPublishedResidences().map((r) => ({ slug: r.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const residence = getResidenceBySlug(slug);
  if (!residence) return { title: "Residencia no encontrada" };
  return {
    title: `${residence.name} — ${residence.zone}`,
    description: residence.description,
  };
}

export default async function ResidenceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const residence = getResidenceBySlug(slug);
  if (!residence) notFound();

  const isFull = residence.availabilityMode === "full";
  const canApply =
    residence.availabilityMode === "real_by_place" ||
    residence.availabilityMode === "by_room_type_to_confirm";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      {/* Galería */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="relative h-72 overflow-hidden rounded-card bg-sand-200 sm:col-span-2 sm:h-96">
          <Image
            src={residence.photos[0]}
            alt={`Foto principal de ${residence.name}`}
            fill
            sizes="(max-width: 640px) 100vw, 66vw"
            className="object-cover"
            priority
          />
        </div>
        <div className="hidden flex-col gap-3 sm:flex">
          {residence.photos.slice(1, 3).map((photo, i) => (
            <div
              key={photo}
              className="relative flex-1 overflow-hidden rounded-card bg-sand-200"
            >
              <Image
                src={photo}
                alt={`Foto ${i + 2} de ${residence.name}`}
                fill
                sizes="33vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-3">
        {/* Contenido principal */}
        <div className="space-y-10 lg:col-span-2">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold text-petrol-800 sm:text-4xl">
                {residence.name}
              </h1>
              <TrustBadge status={residence.verificationStatus} size="md" />
            </div>
            <p className="mt-1 text-ink-soft">
              {residence.zone}, {residence.city}
              {residence.nearUniversities.length > 0 && (
                <span className="text-petrol-600">
                  {" "}
                  · Cerca de {residence.nearUniversities.join(" y ")}
                </span>
              )}
            </p>
            <p className="mt-4 text-ink-soft">{residence.description}</p>
            {residence.idealFor && (
              <p className="mt-3 rounded-card bg-sage-50 p-4 text-sm text-sage-800">
                <span className="font-semibold">Ideal para:</span>{" "}
                {residence.idealFor}
              </p>
            )}
          </div>

          {/* Habitaciones y tarifas */}
          <section>
            <h2 className="text-xl font-bold text-petrol-800">
              Habitaciones y tarifas
            </h2>
            <div className="mt-4 overflow-hidden rounded-card border border-sand-200">
              <table className="w-full text-sm">
                <thead className="bg-sand-100 text-left text-ink-soft">
                  <tr>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Precio por mes</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-200 bg-surface">
                  {residence.roomTypes.map((rt) => (
                    <tr key={rt.type}>
                      <td className="px-4 py-3 font-medium text-ink">
                        {rt.type}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-petrol-700">
                          {formatUsd(rt.priceUsd)}
                        </span>
                        <span className="ml-2 text-xs text-ink-faint">
                          ≈ {formatArs(usdToArsReferencial(rt.priceUsd))}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {rt.available ? (
                          <Badge tone="sage">Con lugar informado</Badge>
                        ) : (
                          <Badge tone="neutral">Sin lugar</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-ink-faint">
              Los valores en pesos son referenciales al dólar blue del día y
              pueden variar. {residence.matriculaUsd !== null && (
                <>Matrícula: {formatUsd(residence.matriculaUsd)}. </>
              )}
              {residence.depositoUsd !== null && (
                <>Depósito reembolsable: {formatUsd(residence.depositoUsd)}.</>
              )}
            </p>
          </section>

          {/* Servicios */}
          <section>
            <h2 className="text-xl font-bold text-petrol-800">
              Servicios incluidos
            </h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {residence.services.map((s) => (
                <li key={s} className="flex items-center gap-2 text-sm text-ink-soft">
                  <span className="text-sage-600">✓</span> {s}
                </li>
              ))}
            </ul>
          </section>

          {/* Reglas */}
          {residence.highlightedRules.length > 0 && (
            <section>
              <h2 className="text-xl font-bold text-petrol-800">
                Reglas de convivencia destacadas
              </h2>
              <ul className="mt-4 space-y-2">
                {residence.highlightedRules.map((rule) => (
                  <li
                    key={rule}
                    className="rounded-card bg-sand-100 px-4 py-3 text-sm text-ink-soft"
                  >
                    {rule}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Sidebar de acción */}
        <aside>
          <Card className="sticky top-24 p-6">
            <StatusTag mode={residence.availabilityMode} />
            <p className="mt-3 text-sm text-ink-soft">
              {availabilityHelpText(residence.availabilityMode)}
            </p>
            <div className="mt-5 border-t border-sand-200 pt-5">
              <p className="text-xs text-ink-faint">Desde</p>
              <p className="text-2xl font-bold text-petrol-700">
                {formatUsd(residence.priceFromUsd)}
                <span className="ml-1 text-sm font-normal text-ink-faint">
                  /mes
                </span>
              </p>
              <p className="text-xs text-ink-faint">
                ≈ {formatArs(usdToArsReferencial(residence.priceFromUsd))} al
                dólar blue de hoy
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-3">
              {canApply && (
                <Button href="/waitlist" size="lg" className="w-full">
                  Enviar solicitud de reserva
                </Button>
              )}
              {(isFull || residence.hasWaitlist) && (
                <Button
                  href="/waitlist"
                  variant={canApply ? "outline" : "primary"}
                  size="lg"
                  className="w-full"
                >
                  Sumarme a la lista de espera
                </Button>
              )}
              {!canApply && !isFull && !residence.hasWaitlist && (
                <Button href="/waitlist" variant="outline" size="lg" className="w-full">
                  Consultar disponibilidad
                </Button>
              )}
            </div>
            <p className="mt-4 text-xs text-ink-faint">
              Para enviar una solicitud vas a necesitar una cuenta y un perfil
              mínimo. Toda solicitud está sujeta a confirmación de la
              residencia, que puede proponerte un único ajuste de condiciones
              antes de confirmar.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
