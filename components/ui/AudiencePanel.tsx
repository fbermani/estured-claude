import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

/**
 * Panel de la sección «Para quién es» de la home. Cada público tiene su color
 * (estudiantes: verde, familias: naranja, residencias: petrol). La mini-UI es
 * estática, siempre marcada «Ejemplo» y sin datos reales ni de residentes.
 */

export type AudienceTone = "student" | "family" | "residence";

const TONES: Record<
  AudienceTone,
  { top: string; blob: string; who: string; title: string; tile: string; btn: string }
> = {
  student: {
    top: "bg-sage-100",
    blob: "bg-forest",
    who: "text-forest-700",
    title: "text-forest-ink",
    tile: "bg-forest-tint text-forest-700",
    btn: "bg-forest hover:bg-forest-600 focus-visible:outline-forest",
  },
  family: {
    top: "bg-amber-soft-100",
    blob: "bg-orange",
    who: "text-orange-700",
    title: "text-[#5c2a0e]",
    tile: "bg-orange-tint text-orange-700",
    btn: "bg-orange hover:bg-orange-600 focus-visible:outline-orange",
  },
  residence: {
    top: "bg-petrol-100",
    blob: "bg-petrol-600",
    who: "text-petrol-700",
    title: "text-petrol-800",
    tile: "bg-petrol-50 text-petrol-700",
    btn: "bg-petrol-600 hover:bg-petrol-700 focus-visible:outline-petrol-600",
  },
};

export interface AudiencePerk {
  icon: string;
  title: string;
  text: string;
}

export function AudiencePanel({
  tone,
  icon,
  who,
  promise,
  badge,
  mini,
  perks,
  cta,
  href,
  note,
}: {
  tone: AudienceTone;
  icon: string;
  who: string;
  promise: string;
  badge?: string;
  mini: ReactNode;
  perks: AudiencePerk[];
  cta: string;
  href: string;
  note: string;
}) {
  const t = TONES[tone];
  return (
    // En escritorio las 4 franjas (encabezado, mini-UI, ventajas, botón) son filas de la grilla de la home (subgrid): las tres tarjetas quedan alineadas.
    <article className="group flex h-full flex-col overflow-hidden rounded-[30px] border border-line bg-paper shadow-card transition-all duration-300 ease-bounce focus-within:shadow-card-hover hover:shadow-card-hover lg:row-span-4 lg:grid lg:grid-rows-subgrid motion-safe:focus-within:-translate-y-1 motion-safe:hover:-translate-y-1 motion-safe:active:scale-[0.99]">
      <div className={`relative overflow-hidden px-6 pb-20 pt-6 ${t.top}`}>
        <span
          aria-hidden="true"
          className={`absolute -right-12 -top-12 h-44 w-44 rounded-full opacity-[0.12] ${t.blob}`}
        />
        <p className={`relative inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.09em] ${t.who}`}>
          <Icon name={icon} className="text-lg" style={{ fontVariationSettings: "'FILL' 1" }} />
          {who}
        </p>
        <h3 className={`relative mt-3 text-2xl font-bold leading-[1.1] ${t.title}`}>{promise}</h3>
        {badge && (
          <span
            className={`absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-xl bg-paper py-1 pl-1.5 pr-2.5 text-[11px] font-bold leading-tight shadow-card ring-1 ring-line ${t.who}`}
          >
            <Icon name="verified" className="text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }} />
            <span>{badge}</span>
          </span>
        )}
      </div>

      <div className="relative z-10 -mt-14 px-4">
        <div className="grid gap-2.5 rounded-[20px] border border-line bg-paper p-3.5 text-[13px] shadow-float motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-bounce motion-safe:group-hover:-translate-y-1">
          {mini}
        </div>
      </div>

      <ul className="grid gap-3.5 px-6 pb-1 pt-5">
        {perks.map((p) => (
          <li key={p.title} className="grid grid-cols-[40px_1fr] items-start gap-3">
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${t.tile}`}>
              <Icon name={p.icon} className="text-[21px]" />
            </span>
            <div>
              <b className="block text-[15px] leading-snug text-ink">{p.title}</b>
              <span className="text-[13.5px] leading-snug text-ink-faint">{p.text}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-auto grid gap-2 px-6 pb-6 pt-5 lg:mt-0 lg:content-start">
        <Link
          href={href}
          className={`group/btn inline-flex h-14 w-full items-center justify-center gap-2 rounded-full text-base font-bold text-white transition-all focus-visible:outline-2 focus-visible:outline-offset-2 motion-safe:active:scale-[0.98] active:brightness-90 ${t.btn}`}
        >
          {cta}
          <Icon name="arrow_forward" className="text-xl transition-transform duration-300 ease-bounce group-hover/btn:translate-x-1 group-active/btn:translate-x-1" />
        </Link>
        <small className="text-center text-[12.5px] text-ink-faint">{note}</small>
      </div>
    </article>
  );
}

/* ---------- Mini-UIs (estáticas, de ejemplo) ---------- */

function MiniTitle({ children }: { children: ReactNode }) {
  return (
    <h4 className="flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-[0.06em] text-ink-faint">
      {children}
      <span className="rounded-md bg-cream-2 px-1.5 py-0.5 text-[10.5px] tracking-[0.07em] text-ink-faint">
        Ejemplo
      </span>
    </h4>
  );
}

function Row({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 rounded-2xl border border-line bg-cream px-2.5 py-2 ${className}`}>
      {children}
    </div>
  );
}

function Chip({ children, tone = "neutral", icon }: { children: ReactNode; tone?: "ok" | "neutral" | "info"; icon?: string }) {
  const c = tone === "ok" ? "bg-forest-tint text-forest-700" : tone === "info" ? "bg-info-bg text-info-fg" : "bg-cream-2 text-ink-soft";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${c}`}>
      {icon && <Icon name={icon} className="text-[15px]" />}
      {children}
    </span>
  );
}

function Avatar({ letter, className }: { letter: string; className: string }) {
  return (
    <span aria-hidden="true" className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-paper text-xs font-bold ${className}`}>
      {letter}
    </span>
  );
}

export function StudentMini() {
  return (
    <>
      <MiniTitle>Comunidad de la casa</MiniTitle>
      <Row>
        <span className="flex -space-x-2">
          <Avatar letter="C" className="bg-forest-tint text-forest-700" />
          <Avatar letter="M" className="bg-sky text-sky-fg" />
          <Avatar letter="J" className="bg-lilac text-lilac-fg" />
        </span>
        <div>
          <b className="block text-[13px] leading-tight">3 perfiles visibles</b>
          <small className="text-xs text-ink-faint">Carrera, intereses, de dónde son</small>
        </div>
      </Row>
      <div className="flex flex-wrap gap-1.5">
        <Chip tone="ok" icon="schedule">Silencio desde las 23</Chip>
        <Chip>Sin fiestas</Chip>
        <Chip>Wifi incluido</Chip>
      </div>
      <div>
        <Chip tone="info" icon="directions_walk">8 min a pie de tu facultad</Chip>
      </div>
    </>
  );
}

export function FamilyMini() {
  const done = ["Propuesta de la familia enviada", "Solicitud enviada a la residencia"];
  return (
    <>
      <MiniTitle>Seguimiento</MiniTitle>
      {done.map((s) => (
        <div key={s} className="grid grid-cols-[22px_1fr] items-center gap-2.5">
          <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-forest-tint text-forest-700">
            <Icon name="check" className="text-[15px]" />
          </span>
          <span>{s}</span>
        </div>
      ))}
      <div className="grid grid-cols-[22px_1fr] items-center gap-2.5">
        <span className="h-[22px] w-[22px] rounded-full bg-orange motion-safe:animate-pulse" />
        <b>Esperando la respuesta</b>
      </div>
      <div className="grid grid-cols-[22px_1fr] items-center gap-2.5 text-ink-faint">
        <span className="h-[22px] w-[22px] rounded-full border-[1.5px] border-dashed border-line-2 bg-cream-2" />
        <span>Comprobante de reserva</span>
      </div>
      <Row>
        <Icon name="qr_code_2" className="text-orange-700" />
        <div>
          <small className="block text-xs text-ink-faint">Código verificable</small>
          <b className="rounded-lg bg-cream-2 px-2 py-0.5 font-mono text-[13px] tracking-wider">EST-XXXX-XXXX</b>
        </div>
      </Row>
    </>
  );
}

export function ResidenceMini() {
  return (
    <>
      <MiniTitle>Solicitud nueva</MiniTitle>
      <Row>
        <Avatar letter="L" className="bg-petrol-100 text-petrol-700" />
        <div>
          <b className="block text-[13px] leading-tight">Perfil completo</b>
          <small className="text-xs text-ink-faint">Carrera, fechas y habitación elegida</small>
        </div>
        <span className="ml-auto"><Chip tone="ok">Completa</Chip></span>
      </Row>
      <Row>
        <Icon name="quiz" className="text-petrol-600" />
        <div>
          <b className="block text-[13px] leading-tight">Tu ficha ya respondió</b>
          <small className="text-xs text-ink-faint">Reglas, servicios y precios</small>
        </div>
      </Row>
      <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-cream-2">
        <div className="h-full w-[78%] rounded-full bg-petrol-500" />
      </div>
      <small className="text-xs text-ink-faint">Ejemplo: ficha completa</small>
    </>
  );
}
