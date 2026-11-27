import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";

/**
 * Captura real de la sección «Comunidad» de una ficha (residencia demo, datos de ejemplo) para las landings de
 * estudiantes y de residencias. Las capturas viven en `public/landing/`. Sin métricas inventadas: lo que se ve es
 * lo que muestra la app. Server Component.
 */

const COPY = {
  students: {
    eyebrow: "Comunidad visible",
    title: "Mirá cómo es por dentro",
    lede: "En cada ficha ves las habitaciones. Con tu cuenta, también los perfiles de la comunidad.",
    points: [
      { icon: "bed", title: "Habitaciones y precios", text: "Los ves en cada ficha. Enviar tu solicitud de reserva no te asegura el lugar." },
      { icon: "groups", title: "Quiénes viven ahí", text: "Carrera, universidad e intereses de la comunidad." },
      { icon: "shield_person", title: "Los menores no aparecen", text: "Quienes son menores de edad no se muestran en la comunidad." },
    ],
    cta: { href: "/search", label: "Buscar residencias" },
  },
  residences: {
    eyebrow: "Tu ficha pública",
    title: "Tu ficha, casi tu propia web",
    lede: "Fotos, precios, reglamento y comunidad en un link.",
    points: [
      { icon: "send", title: "Compartila por WhatsApp", text: "Con un mensaje ya listo, que podés editar." },
      { icon: "diversity_3", title: "Tu comunidad a la vista", text: "Con su cuenta, el estudiante ve qué estudian y qué les interesa." },
      { icon: "shield_person", title: "Los menores no aparecen", text: "Quienes son menores de edad no se muestran en la comunidad." },
    ],
    cta: { href: "/register/residence", label: "Sumá tu residencia, es gratis" },
  },
} as const;

export function CommunityPreview({ variant }: { variant: "students" | "residences" }) {
  const c = COPY[variant];
  const titleId = `community-preview-${variant}`;
  return (
    <section aria-labelledby={titleId} className="border-y border-line bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className={`grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14 ${variant === "residences" ? "lg:[&>*:first-child]:order-2" : ""}`}>
          <Reveal>
            <p className="text-sm font-bold text-forest-700">{c.eyebrow}</p>
            <h2 id={titleId} className="mt-2.5 text-3xl font-bold leading-[1.12] text-ink sm:text-4xl md:text-5xl">
              {c.title}
            </h2>
            <p className="mt-3 text-base text-ink-soft sm:text-lg">{c.lede}</p>
            <ul className="mt-6 grid gap-3.5">
              {c.points.map((p) => (
                <li key={p.title} className="grid grid-cols-[40px_1fr] gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-sage-100 text-sage-700">
                    <Icon name={p.icon} className="text-2xl" />
                  </span>
                  <div>
                    <b className="block text-ink">{p.title}</b>
                    <span className="text-[14.5px] text-ink-soft">{p.text}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Button href={c.cta.href} size="lg">
                {c.cta.label}
              </Button>
            </div>
          </Reveal>

          <Reveal delay={2}>
            <figure className="relative m-0 overflow-hidden rounded-[30px] border border-line bg-paper shadow-float lg:-rotate-1 lg:transition-transform lg:duration-500 lg:ease-out-fresh lg:hover:rotate-0">
              <div aria-hidden className="flex items-center gap-1.5 border-b border-line bg-cream-2 px-3.5 py-2.5">
                <span className="flex-1 truncate text-xs font-semibold text-ink-soft">Comunidad de la residencia</span>
              </div>
              <span className="absolute right-3 top-[52px] z-10 rounded-md bg-amber-soft-100 px-2 py-0.5 text-xs font-bold text-amber-soft-700">
                Datos de ejemplo
              </span>
              <Image
                src="/landing/comunidad-desktop.webp"
                alt="Sección Comunidad de una residencia en EstuRed: filtros por tipo y habitaciones dobles con quién vive en cada cama y una cama disponible."
                width={2240}
                height={1184}
                sizes="(min-width: 1024px) 620px, 100vw"
                loading="lazy"
                className="hidden h-auto w-full md:block"
              />
              <div className="relative max-h-[560px] overflow-hidden after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-16 after:bg-gradient-to-t after:from-paper after:to-transparent md:hidden">
                <Image
                  src="/landing/comunidad-mobile.webp"
                  alt="La misma sección Comunidad vista en un teléfono."
                  width={780}
                  height={2400}
                  sizes="100vw"
                  loading="lazy"
                  className="h-auto w-full"
                />
              </div>
              <figcaption className="flex items-start gap-1.5 border-t border-line px-3.5 py-2.5 text-xs text-ink-faint">
                <Icon name="lock" className="text-base" />
                Captura real de la app con datos de ejemplo. Quienes son menores no aparecen.
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
