import Link from "next/link";
import type { CSSProperties } from "react";
import { Icon } from "@/components/ui/Icon";
import { ResidencePhoto } from "@/components/residences/ResidencePhoto";
import { SealIntro } from "@/components/brand/SealIntro";
import type { Residence } from "@/types/domain";
import "./hero-motion.css";

/** Cantidad mínima de tarjetas por tanda para que la cinta cubra el ancho y el bucle (-50%) no tenga saltos. */
const MIN_CARDS_PER_SET = 8;

/** La apertura con el sello (`SealIntro`) dura ~3,9 s; el contenido arranca a los 3,5 s, mientras la capa se va. */
const INTRO_S = 3.5;

const delay = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;

const MINI_POINTS = [
  { icon: "edit_document", label: "Proceso registrado" },
  { icon: "sell", label: "Costos a la vista" },
  { icon: "rule", label: "Reglamento claro" },
];

/** Campo decorativo del buscador (mock visual): no es un control, todo el bloque es un link a /search. */
function FakeField({ label, value }: { label: string; value: string }) {
  return (
    <span className="grid gap-0.5 rounded-2xl px-4 py-2 text-left md:px-5 md:[&:not(:first-child)]:border-l md:[&:not(:first-child)]:border-line md:rounded-full">
      <span className="text-xs font-bold text-ink-faint">{label}</span>
      <span className="flex items-center justify-between gap-2 text-[15px] font-semibold text-ink">
        {value}
        <Icon name="expand_more" className="text-lg text-ink-faint" />
      </span>
    </span>
  );
}

function MarqueeCard({ residence, hidden }: { residence: Residence; hidden?: boolean }) {
  const types = Array.from(new Set(residence.roomTypes.map((t) => t.type))).join(", ");
  return (
    <Link
      href={`/residencias/${residence.slug}`}
      tabIndex={hidden ? -1 : undefined}
      aria-hidden={hidden || undefined}
      className={`group relative block h-60 w-[200px] shrink-0 overflow-hidden rounded-3xl bg-forest-600 shadow-card even:mt-5 md:h-[300px] md:w-[260px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${hidden ? "motion-reduce:hidden" : ""}`}
    >
      <ResidencePhoto
        src={residence.photos[0]}
        name={residence.name}
        zone={residence.zone}
        alt=""
        sizes="260px"
        imageClassName="transition-transform duration-500 group-hover:scale-105"
      />
      <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-forest-tint px-2.5 py-1 text-xs font-semibold text-forest-700">
        <Icon name="verified" className="text-sm" />
        Verificada
      </span>
      <span className="absolute inset-x-0 bottom-0 grid bg-gradient-to-t from-forest-ink/90 to-transparent px-3.5 pb-3 pt-9 text-xs text-white/90">
        <b className="font-display text-base font-bold text-white">{residence.name}</b>
        <span>
          {residence.zone}
          {types ? `, ${types}` : ""}
        </span>
      </span>
    </Link>
  );
}

/**
 * Hero de la home (propuesta B): fondo forest oscuro, buscador mock que lleva a /search
 * y cinta de residencias reales que se desplaza sola (pausa con hover o foco).
 * Todo el movimiento es CSS; no hay estado ni JS de cliente. `intro`: apertura con el sello de EstuRed (`SealIntro`) sobre el hero
 * (~3,9 s, solo visual: el texto ya está en el DOM desde el primer frame); con prefers-reduced-motion, sello quieto y fundido.
 */
export function HomeHero({ residences, intro = true }: { residences: Residence[]; intro?: boolean }) {
  const t = intro ? INTRO_S : 0;
  let set: Residence[] = [];
  if (residences.length > 0) {
    while (set.length < MIN_CARDS_PER_SET) set = set.concat(residences);
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-forest-ink via-forest-700 to-forest-600 text-white">
      <i
        aria-hidden="true"
        className="hero-drift pointer-events-none absolute -right-32 -top-44 size-[520px] rounded-full bg-[radial-gradient(circle,rgb(239_133_81/.28),transparent_65%)]"
      />
      <i
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(255_255_255/.09)_1px,transparent_1.2px)] [background-size:22px_22px] [mask-image:linear-gradient(#000,transparent_80%)]"
      />

      {intro && <SealIntro />}

      <div className="relative mx-auto max-w-[900px] px-4 pb-6 pt-8 text-center sm:px-6 md:pb-9 md:pt-20">
        <p className="hero-seq mb-3.5 text-[13px] font-bold text-amber-soft-300" style={delay(0.06 + t)}>
          Ciudad de Buenos Aires
        </p>
        <h1
          className="hero-seq text-[1.875rem] font-bold leading-[1.1] tracking-tight text-white sm:text-[2.375rem] md:text-6xl"
          style={delay(0.12 + t)}
        >
          Encontrá y reservá tu residencia, <span className="text-amber-soft-300">con la seguridad de elegir bien.</span>
        </h1>
        <p className="hero-seq mx-auto mt-4 max-w-[600px] text-base text-forest-tint sm:text-[17px] md:text-xl" style={delay(0.18 + t)}>
          Visitamos y verificamos residencias estudiantiles, para que vos elijas con tranquilidad y confianza.
        </p>

        {/* Buscador: mock visual. Lleva a /search; los campos no son controles. */}
        <Link
          href="/search"
          aria-label="Buscar residencias en Buenos Aires"
          className="hero-seq group mx-auto mt-5 grid gap-1 rounded-[26px] bg-white p-2.5 text-ink shadow-float focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white md:grid-cols-[1.1fr_1fr_1fr_auto] md:items-center md:rounded-full md:py-2 md:pl-3.5 md:pr-2 md:gap-0"
          style={delay(0.24 + t)}
        >
          <FakeField label="¿Dónde?" value="Todos los barrios" />
          <FakeField label="¿Qué estudiás?" value="Todas" />
          <FakeField label="¿Cuándo entrás?" value="Cuando quieras" />
          <span className="mt-1 inline-flex h-14 items-center justify-center gap-2 rounded-full bg-orange px-8 text-base font-bold text-white shadow-sm transition duration-200 ease-out-fresh group-hover:-translate-y-0.5 group-hover:bg-orange-600 group-hover:shadow-orange md:mt-0">
            <Icon name="search" className="text-xl" />
            Buscar residencias
          </span>
        </Link>

        <ul
          className="mt-4 flex flex-wrap justify-center gap-x-[18px] gap-y-2 text-[13px] font-semibold text-forest-tint"
        >
          {MINI_POINTS.map((p, i) => (
            <li key={p.label} className="hero-chip inline-flex items-center gap-1.5" style={delay(0.36 + t + i * 0.04)}>
              <Icon name={p.icon} className="text-lg text-amber-soft-300" />
              {p.label}
            </li>
          ))}
        </ul>

        {/* Residencias: tarjeta clara sobre el fondo oscuro (DR68). El naranja queda solo en «Buscar». */}
        <div
          className="hero-rise mx-auto mt-6 flex max-w-[660px] flex-col items-center gap-3 rounded-card bg-paper p-4 text-ink shadow-float sm:flex-row sm:justify-between sm:gap-5 sm:px-5 sm:text-left"
          style={delay(0.48 + t)}
        >
          <p className="text-sm text-ink-soft">
            <b className="block font-display text-lg text-ink">¿Tenés una residencia?</b>
            Recibí solicitudes completas, sin comisión sobre tu tarifa.
          </p>
          <Link
            href="/register/residence"
            className="inline-flex min-h-12 w-full shrink-0 items-center justify-center rounded-full bg-forest px-5 text-sm font-bold text-white transition-colors hover:bg-forest-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest sm:w-auto"
          >
            Sumá tu residencia, es gratis
          </Link>
        </div>
      </div>

      {set.length > 0 && (
        <div
          className="hero-marquee-wrap relative overflow-hidden motion-reduce:overflow-x-auto pb-9 pt-3.5 md:pb-14 [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]"
          role="region"
          aria-label="Residencias verificadas"
        >
          <div className="hero-marquee flex w-max gap-3.5">
            {set.map((r, i) => (
              <MarqueeCard key={`a-${r.slug}-${i}`} residence={r} />
            ))}
            {set.map((r, i) => (
              <MarqueeCard key={`b-${r.slug}-${i}`} residence={r} hidden />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
