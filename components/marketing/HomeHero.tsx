import Link from "next/link";
import type { CSSProperties } from "react";
import { Icon } from "@/components/ui/Icon";
import { ResidencePhoto } from "@/components/residences/ResidencePhoto";
import type { Residence } from "@/types/domain";
import "./hero-motion.css";

/** Cantidad mínima de tarjetas por tanda para que la cinta cubra el ancho y el bucle (-50%) no tenga saltos. */
const MIN_CARDS_PER_SET = 8;

const delay = (s: number) => ({ "--d": `${s}s` }) as CSSProperties;

const MINI_POINTS = [
  { icon: "verified", label: "Verificadas por EstuRed" },
  { icon: "flight_takeoff", label: "Sin viajar" },
  { icon: "receipt_long", label: "Comprobante verificable" },
];

/** Campo decorativo del buscador (mock visual): no es un control, todo el bloque es un link a /search. */
function FakeField({ label, value }: { label: string; value: string }) {
  return (
    <span className="grid gap-0.5 rounded-2xl px-4 py-2 text-left md:px-5 md:[&:not(:first-child)]:border-l md:[&:not(:first-child)]:border-line md:rounded-full">
      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{label}</span>
      <span className="flex items-center justify-between gap-2 text-[15px] font-semibold text-ink">
        {value}
        <Icon name="expand_more" className="text-lg text-ink-faint" />
      </span>
    </span>
  );
}

function MarqueeCard({ residence, hidden }: { residence: Residence; hidden?: boolean }) {
  const types = Array.from(new Set(residence.roomTypes.map((t) => t.type))).join(" · ");
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
          {types ? ` · ${types}` : ""}
        </span>
      </span>
    </Link>
  );
}

/**
 * Hero de la home (propuesta B): fondo forest oscuro, buscador mock que lleva a /search
 * y cinta de residencias reales que se desplaza sola (pausa con hover o foco).
 * Todo el movimiento es CSS; no hay estado ni JS de cliente.
 */
export function HomeHero({ residences }: { residences: Residence[] }) {
  let set: Residence[] = [];
  if (residences.length > 0) {
    while (set.length < MIN_CARDS_PER_SET) set = set.concat(residences);
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-forest-ink via-forest-700 to-forest-600 text-white">
      <i
        aria-hidden="true"
        className="hero-drift pointer-events-none absolute -right-32 -top-44 size-[520px] rounded-full bg-[radial-gradient(circle,rgb(239_133_81/.55),transparent_65%)]"
      />
      <i
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(255_255_255/.09)_1px,transparent_1.2px)] [background-size:22px_22px] [mask-image:linear-gradient(#000,transparent_80%)]"
      />

      <div className="relative mx-auto max-w-[900px] px-4 pb-6 pt-8 text-center sm:px-6 md:pb-9 md:pt-20">
        <p className="hero-rise mb-3.5 text-xs font-bold uppercase tracking-widest text-orange-light" style={delay(0.08)}>
          Ciudad de Buenos Aires
        </p>
        <h1
          className="hero-rise text-[1.875rem] font-extrabold leading-[1.1] tracking-tight text-white sm:text-[2.375rem] md:text-6xl"
          style={delay(0.18)}
        >
          Elegí tu residencia a distancia, <span className="text-amber-soft-300">sin adivinar.</span>
        </h1>
        <p className="hero-rise mx-auto mt-4 max-w-[600px] text-base text-forest-tint sm:text-[17px] md:text-xl" style={delay(0.3)}>
          Residencias en Buenos Aires, verificadas por EstuRed. Reservá y pagá desde donde estés, sin viajar.
        </p>

        {/* Buscador: mock visual. Lleva a /search; los campos no son controles. */}
        <Link
          href="/search"
          aria-label="Buscar residencias en Buenos Aires"
          className="hero-rise group mx-auto mt-5 grid gap-1 rounded-[26px] bg-white p-2.5 text-ink shadow-float focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white md:grid-cols-[1.1fr_1fr_1fr_auto] md:items-center md:rounded-full md:py-2 md:pl-3.5 md:pr-2 md:gap-0"
          style={delay(0.42)}
        >
          <FakeField label="¿Dónde?" value="Todos los barrios" />
          <FakeField label="¿Qué estudiás?" value="Todas" />
          <FakeField label="¿Cuándo entrás?" value="Cuando quieras" />
          <span className="mt-1 inline-flex h-14 items-center justify-center gap-2 rounded-full bg-orange px-8 text-base font-bold text-white shadow-sm transition-all duration-300 ease-bounce group-hover:-translate-y-[3px] group-hover:bg-orange-600 group-hover:shadow-orange md:mt-0">
            <Icon name="search" className="text-xl" />
            Buscar residencias
          </span>
        </Link>

        <p className="hero-rise mt-3.5 text-[13px] text-forest-tint" style={delay(0.6)}>
          Explorar es gratis. Toda solicitud queda sujeta a confirmación de la residencia.{" "}
          <Link href="/for-residences" className="font-bold text-white underline-offset-2 hover:underline">
            Sumar mi residencia
          </Link>
        </p>
        <ul
          className="hero-rise mt-4 flex flex-wrap justify-center gap-x-[18px] gap-y-2 text-[13px] font-semibold text-forest-tint"
          style={delay(0.6)}
        >
          {MINI_POINTS.map((p) => (
            <li key={p.label} className="inline-flex items-center gap-1.5">
              <Icon name={p.icon} className="text-lg text-orange-light" />
              {p.label}
            </li>
          ))}
        </ul>
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
