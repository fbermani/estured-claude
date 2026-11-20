import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ResidencePhoto } from "@/components/residences/ResidencePhoto";
import type { Residence } from "@/types/domain";
import "./hero-motion.css";

const style = (vars: Record<string, string>) => vars as CSSProperties;

const TRUST = [
  { icon: "verified_user", label: "Visitamos cada residencia" },
  { icon: "edit_document", label: "Todo registrado por escrito" },
  { icon: "lock", label: "Ves el monto exacto antes de pagar" },
  { icon: "flight_takeoff", label: "100% a distancia" },
];

/** Tarjeta flotante decorativa (aria-hidden): UI de ejemplo, sin datos reales de nadie. */
function FloatCard({
  className,
  rotate,
  floatDelay,
  tile,
  icon,
  children,
}: {
  className: string;
  rotate: string;
  floatDelay: string;
  tile: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      className={`hero-float absolute flex max-w-[210px] items-start gap-2.5 rounded-[18px] border border-line bg-white px-3 py-2.5 text-ink text-xs leading-snug shadow-float md:max-w-[240px] md:px-3.5 md:py-3 md:text-[13px] ${className}`}
      style={style({ "--r": rotate, "--fd": floatDelay })}
    >
      <span className={`flex size-[34px] shrink-0 items-center justify-center rounded-[11px] ${tile}`}>
        <Icon name={icon} className="text-xl" />
      </span>
      <div>{children}</div>
    </div>
  );
}

/**
 * Hero de /for-students (propuesta A, "collage vivo"; contraste AA, 2 fotos + 2 tarjetas decorativas). Todo el movimiento es CSS.
 */
export function StudentsHero({ residences }: { residences: Residence[] }) {
  const first = residences[0] ?? null;
  // Dos fotos distintas: primero las de la primera residencia y, si faltan, las de las siguientes.
  const photos = Array.from(new Set(residences.flatMap((r) => r.photos))).slice(0, 2);
  const frames = [
    { src: photos[0] ?? null, name: first?.name ?? "Residencia verificada", zone: first?.zone },
    { src: photos[1] ?? null, name: residences[1]?.name ?? first?.name ?? "Residencia verificada", zone: residences[1]?.zone ?? first?.zone },
  ];

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(175deg,var(--color-forest-ink)_0%,#0e4434_62%,var(--color-forest-700)_100%)] text-white">
      <i
        aria-hidden="true"
        className="hero-drift pointer-events-none absolute -right-[60px] top-10 size-[560px] rounded-full bg-[radial-gradient(circle,rgb(239_133_81/.22),transparent_62%)]"
        style={style({ "--dx": "-30px" })}
      />
      <i
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgb(255_255_255/.09)_1px,transparent_1.2px)] [background-size:22px_22px] [mask-image:linear-gradient(#000,transparent_80%)]"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-x-10 px-4 pt-8 sm:px-6 md:grid-cols-[1.25fr_0.75fr] md:pt-16">
        <div className="md:col-start-1 md:row-start-1">
          <p
            className="hero-rise mb-[18px] inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[13px] font-semibold text-white"
            style={style({ "--d": "0.08s" })}
          >
            <span className="hero-pulse size-2 rounded-full bg-orange-light" aria-hidden="true" />
            Para estudiantes y familias
          </p>
          <h1
            className="hero-rise max-w-[620px] text-4xl font-bold leading-[1.06] tracking-tight text-white md:text-[52px] md:leading-[1.04]"
            style={style({ "--d": "0.18s" })}
          >
            Elegí tu residencia en Buenos Aires{" "}
            <span className="text-orange-light">
              con todo verificado y por escrito.
            </span>
          </h1>
          <p className="hero-rise mt-3.5 max-w-[590px] text-[17px] text-white/85 md:mt-5 md:text-[19px]" style={style({ "--d": "0.3s" })}>
            Un proceso registrado paso a paso y un comprobante de reserva que cualquiera puede consultar online.
          </p>
          <div className="hero-rise mt-[22px] flex flex-col items-stretch gap-1 md:mt-7 md:flex-row md:flex-wrap md:items-center md:gap-3" style={style({ "--d": "0.42s" })}>
            <Button href="/search" size="lg" variant="secondary" className="whitespace-nowrap [--btn-focus:#fff]">
              Ver residencias verificadas
              <Icon name="arrow_forward" className="text-xl" />
            </Button>
            <div className="hidden md:block">
              <Button href="/register" variant="outline-dark" size="lg" className="whitespace-nowrap">
                Crear cuenta de estudiante
              </Button>
            </div>
            <Link
              href="/register"
              className="flex min-h-12 items-center justify-center text-[15.5px] font-bold text-white underline decoration-white/50 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:hidden"
            >
              Crear cuenta de estudiante
            </Link>
          </div>
          <p className="hero-rise mt-1 text-center text-[13px] text-white/80 md:mt-3.5 md:text-left md:text-[13.5px]" style={style({ "--d": "0.6s" })}>
            Explorar es gratis · Cada solicitud la confirma la residencia.
          </p>
        </div>

        {/* Collage: fotos reales del catálogo + tarjetas decorativas (en móvil va después de la fila de confianza) */}
        <div
          className="hero-rise relative order-3 mx-4 mb-8 mt-1 h-[300px] md:order-none md:col-start-2 md:row-start-1 md:mx-0 md:mb-0 md:mt-0 md:h-[470px]"
          style={style({ "--d": "0.3s" })}
        >
          <figure className="absolute left-0 top-0 m-0 h-full w-[64%] overflow-hidden rounded-t-[200px] rounded-b-[26px] bg-sand-200 shadow-float md:left-[4%] md:h-[84%] md:w-[70%]">
            <ResidencePhoto
              src={frames[0].src}
              name={frames[0].name}
              zone={frames[0].zone}
              alt={first ? `Residencia ${first.name}` : "Residencia verificada"}
              sizes="(max-width: 768px) 60vw, 34vw"
              variant="hero"
              priority
            />
          </figure>
          <figure className="absolute -bottom-[2%] right-0 m-0 h-[46%] w-[46%] overflow-hidden rounded-l-full rounded-r-[26px] border-4 border-[#0e4434] bg-sand-200 shadow-float md:bottom-[2%] md:h-[36%] md:w-[42%]">
            <ResidencePhoto src={frames[1].src} name={frames[1].name} zone={frames[1].zone} alt="" sizes="(max-width: 768px) 46vw, 20vw" variant="card" />
          </figure>

          <FloatCard
            className="right-0 top-[6%] max-w-[186px] md:right-[-6px] md:top-[8%]"
            rotate="1.5deg"
            floatDelay="-2s"
            tile="bg-forest-tint text-forest-700"
            icon="verified"
          >
            <b className="text-ink">Visitada en persona</b>
            <br />
            <span className="text-ink-faint">Reglas, servicios y fotos revisados</span>
          </FloatCard>
          <FloatCard
            className="bottom-[4%] left-[-4px] md:bottom-[6%] md:left-[-14px]"
            rotate="-1.5deg"
            floatDelay="-4s"
            tile="bg-orange-tint text-orange-700"
            icon="receipt_long"
          >
            <b className="text-ink">Comprobante de reserva</b>
            <br />
            <code className="rounded bg-cream-2 px-1.5 py-px text-xs font-bold tracking-[0.02em] text-ink">ER-XXXX-XXXX</code>
            <br />
            <span className="text-ink-faint">Cualquiera puede consultarlo</span>
          </FloatCard>
        </div>

        <ul className="order-2 mt-[22px] grid grid-cols-2 gap-x-3 gap-y-3.5 border-t border-white/15 pb-5 pt-4 text-[13.5px] font-semibold leading-tight text-white/90 md:order-none md:col-span-2 md:row-start-2 md:mt-10 md:flex md:justify-between md:gap-6 md:pb-9 md:pt-[18px] md:text-sm">
          {TRUST.map((t, i) => (
            <li key={t.label} className="trust-item flex items-center gap-2 rounded-full px-3 py-1.5 -mx-3" style={style({ "--i": String(i) })}>
              <Icon name={t.icon} className="trust-icon inline-block text-[21px] text-mint" />
              {t.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
