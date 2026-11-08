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
    title: "Mirá cómo es por dentro antes de solicitar",
    lede: "En cada ficha ves qué habitaciones tienen plazas libres y quiénes viven ahí. Elegís sabiendo con quién vas a compartir.",
    points: [
      { icon: "bed", title: "Plazas libres a la vista", text: "Según la disponibilidad que informa la residencia. Tu solicitud queda sujeta a confirmación." },
      { icon: "groups", title: "Quiénes viven ahí", text: "Carrera, universidad e intereses, según lo que cada residente elige mostrar." },
      { icon: "favorite", title: "Convivencia que se elige", text: "Encontrás gente que estudia lo mismo o comparte tus horarios." },
    ],
    cta: { href: "/search", label: "Buscar residencias" },
  },
  residences: {
    eyebrow: "Tu comunidad, tu mejor carta",
    title: "Así ven tu residencia los estudiantes",
    lede: "Tus habitaciones y la comunidad que ya vive ahí responden la pregunta que más se repite: «¿con quién voy a vivir?».",
    points: [
      { icon: "quiz", title: "Menos preguntas antes de solicitar", text: "Llegan solicitudes de quienes ya vieron cómo es la casa." },
      { icon: "diversity_3", title: "Afinidad desde el primer contacto", text: "Quien solicita ya sabe qué estudian y qué les gusta a tus residentes." },
      { icon: "tune", title: "Vos y tus residentes controlan qué se ve", text: "Cada residente elige qué mostrar. Quienes son menores no aparecen." },
    ],
    cta: { href: "/register/residence", label: "Solicitar sumar mi residencia" },
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
                alt="Sección Comunidad de una residencia en EstuRed: residentes, ocupación y habitaciones individuales y dobles con quién vive en cada cama y las plazas libres."
                width={2240}
                height={1360}
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
                Captura real de la app con datos de ejemplo. Cada residente elige qué mostrar; quienes son menores no aparecen.
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
