import type { CSSProperties, ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ResidencePhoto } from "@/components/residences/ResidencePhoto";
import type { Residence } from "@/types/domain";
import "./hero-motion.css";

const style = (vars: Record<string, string>) => vars as CSSProperties;

const TRUST = [
  { icon: "verified_user", label: "Residencias verificadas" },
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
      className={`hero-float absolute flex max-w-[210px] items-start gap-2.5 rounded-[18px] border border-line bg-white px-3 py-2.5 text-xs leading-snug shadow-float md:max-w-[240px] md:px-3.5 md:py-3 md:text-[13px] ${className}`}
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
 * Hero de /for-students (propuesta A, "collage vivo"): fotos del catálogo real en arco, píldora y óvalo,
 * tarjetas flotantes decorativas y manchas de color que derivan. Todo el movimiento es CSS.
 */
export function StudentsHero({ residences }: { residences: Residence[] }) {
  const first = residences[0] ?? null;
  // Tres fotos distintas: primero las de la primera residencia y, si faltan, las de las siguientes.
  const photos = Array.from(new Set(residences.flatMap((r) => r.photos))).slice(0, 3);
  const frames = [
    { src: photos[0] ?? null, name: first?.name ?? "Residencia verificada", zone: first?.zone },
    { src: photos[1] ?? null, name: residences[1]?.name ?? first?.name ?? "Residencia verificada", zone: residences[1]?.zone ?? first?.zone },
    { src: photos[2] ?? null, name: residences[2]?.name ?? first?.name ?? "Residencia verificada", zone: residences[2]?.zone ?? first?.zone },
  ];

  return (
    <section className="relative overflow-hidden bg-cream bg-[radial-gradient(55%_60%_at_90%_0%,var(--color-orange-tint)_0,transparent_65%),radial-gradient(50%_60%_at_0%_100%,var(--color-forest-tint)_0,transparent_65%)]">
      <i
        aria-hidden="true"
        className="hero-drift pointer-events-none absolute -left-16 top-10 size-[260px] rounded-full bg-sage-200 opacity-45 blur-[50px]"
      />
      <i
        aria-hidden="true"
        className="hero-drift pointer-events-none absolute -right-20 -top-16 size-[300px] rounded-full bg-amber-soft-300 opacity-45 blur-[50px]"
        style={style({ "--dx": "-30px" })}
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-7 px-4 pb-5 pt-9 sm:px-6 md:grid-cols-[1.02fr_0.98fr] md:gap-12 md:pb-7 md:pt-[72px]">
        <div>
          <p
            className="hero-rise mb-[18px] inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-1.5 text-[13px] font-semibold text-forest-700"
            style={style({ "--d": "0.08s" })}
          >
            <span className="hero-pulse size-2 rounded-full bg-forest" aria-hidden="true" />
            Para estudiantes y familias
          </p>
          <h1
            className="hero-rise text-[2.5rem] font-extrabold leading-[1.05] tracking-tight text-ink md:text-6xl"
            style={style({ "--d": "0.18s" })}
          >
            Elegí tu residencia en Buenos Aires{" "}
            <span className="bg-[linear-gradient(transparent_64%,var(--color-amber-soft-300)_64%)] px-[0.1em] text-forest-700">
              con todo verificado y por escrito.
            </span>
          </h1>
          <p className="hero-rise mt-[18px] max-w-[520px] text-lg text-ink-soft md:text-xl" style={style({ "--d": "0.3s" })}>
            Residencias verificadas, un proceso registrado paso a paso y un comprobante de reserva que cualquiera puede
            verificar. Sin viajar.
          </p>
          <p className="hero-rise mt-3 text-sm font-medium text-petrol-700" style={style({ "--d": "0.3s" })}>
            Conocé los requisitos y beneficios de cada residencia sin moverte de tu casa.
          </p>
          <div className="hero-rise mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap" style={style({ "--d": "0.42s" })}>
            <Button href="/search" size="lg" className="whitespace-nowrap">
              Buscar residencia en CABA
              <Icon name="arrow_forward" className="text-xl" />
            </Button>
            <Button href="/register" variant="outline" size="lg" className="whitespace-nowrap">
              Crear cuenta de estudiante
            </Button>
          </div>
          <p className="hero-rise mt-3.5 text-[13px] text-ink-faint" style={style({ "--d": "0.6s" })}>
            Explorar es gratis. Toda solicitud queda sujeta a confirmación de la residencia.
          </p>
        </div>

        {/* Collage: fotos reales del catálogo + tarjetas decorativas */}
        <div className="hero-rise relative mx-1.5 h-[440px] md:mx-0 md:h-[560px]" style={style({ "--d": "0.3s" })}>
          <figure className="absolute left-0 top-0 m-0 h-[76%] w-[62%] overflow-hidden rounded-t-[200px] rounded-b-[26px] bg-sand-200 shadow-float">
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
          <figure className="absolute right-0 top-[10%] m-0 h-[34%] w-[36%] overflow-hidden rounded-[26px] bg-sand-200 shadow-float">
            <ResidencePhoto src={frames[1].src} name={frames[1].name} zone={frames[1].zone} alt="" sizes="(max-width: 768px) 36vw, 20vw" variant="card" />
          </figure>
          <figure className="absolute bottom-0 right-[4%] m-0 h-[34%] w-[46%] overflow-hidden rounded-l-full rounded-r-[26px] bg-sand-200 shadow-float">
            <ResidencePhoto src={frames[2].src} name={frames[2].name} zone={frames[2].zone} alt="" sizes="(max-width: 768px) 46vw, 26vw" variant="card" />
          </figure>

          <FloatCard
            className="left-[-4px] top-[58%] md:left-[-30px] md:top-[62%]"
            rotate="-3deg"
            floatDelay="0s"
            tile="bg-info-bg text-info-fg"
            icon="send"
          >
            <b className="text-ink">Tu solicitud</b>
            <br />
            <span className="text-ink-faint">Enviada a {first?.name ?? "la residencia"}</span>
            <br />
            <span className="mt-1 inline-block rounded-full bg-info-bg px-2.5 py-0.5 text-xs font-semibold text-info-fg">
              Sujeta a confirmación
            </span>
          </FloatCard>
          <FloatCard
            className="right-[-4px] top-[2%] max-w-[170px] md:right-[-16px] md:top-0"
            rotate="2.5deg"
            floatDelay="-2s"
            tile="bg-forest-tint text-forest-700"
            icon="verified"
          >
            <b className="text-ink">Verificada en persona</b>
            <br />
            <span className="text-ink-faint">Reglas, servicios y fotos revisados</span>
          </FloatCard>
          <FloatCard
            className="bottom-[-8px] right-0 md:bottom-[-14px] md:right-[-10px]"
            rotate="-1.5deg"
            floatDelay="-4s"
            tile="bg-orange-tint text-orange-700"
            icon="receipt_long"
          >
            <b className="text-ink">Comprobante de reserva</b>
            <br />
            <code className="rounded bg-cream-2 px-1.5 py-px text-[11px]">ER-XXXX-XXXX</code>
            <br />
            <span className="text-ink-faint">Cualquiera puede verificarlo</span>
          </FloatCard>
        </div>
      </div>

      <ul className="relative mx-auto grid max-w-6xl grid-cols-2 gap-x-3.5 gap-y-2.5 px-4 pb-9 pt-2 text-[13px] font-semibold text-ink-soft sm:px-6 md:flex md:justify-between md:pb-11 md:pt-3 md:text-sm">
        {TRUST.map((t) => (
          <li key={t.label} className="flex items-center gap-2">
            <Icon name={t.icon} className="text-xl text-forest" />
            {t.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
