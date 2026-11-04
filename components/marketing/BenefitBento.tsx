import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { SwipeStack } from "@/components/ui/SwipeStack";

type Tone = "forest" | "amber" | "petrol" | "sage" | "lilac";

export type BentoItem = {
  icon: string;
  title: string;
  /** «Lo que suele pasar»: una línea. */
  before: string;
  /** Qué cambia con EstuRed. */
  yes: string;
  tone: Tone;
  /** wide = 3 columnas de 6 (lleva mini-prueba visual); narrow = 2 columnas. */
  size: "wide" | "narrow";
  viz?: ReactNode;
};

const TONE: Record<Tone, string> = {
  forest: "bg-forest-tint text-forest-700",
  amber: "bg-amber-soft-100 text-amber-soft-700",
  petrol: "bg-petrol-50 text-petrol-600",
  sage: "bg-sage-100 text-sage-700",
  lilac: "bg-lilac text-lilac-fg",
};

function VizBox({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden className="grid gap-2 rounded-[14px] border border-line bg-cream p-3 text-[13px] text-ink">
      {children}
    </div>
  );
}

function Check({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon name="check_circle" className="text-base text-forest [font-variation-settings:'FILL'_1]" />
      {children}
    </div>
  );
}

function Row({ a, b }: { a: string; b: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span>{a}</span>
      <b className="font-bold">{b}</b>
    </div>
  );
}

/**
 * Bento de beneficios (home «Por qué EstuRed» y for-students «Beneficios»). Cada tarjeta dice «lo que suele pasar» en
 * una línea y qué cambia con EstuRed. En mobile se vuelve un mazo con swipe (`SwipeStack`). Server Component.
 * Las mini-pruebas visuales son decorativas (aria-hidden) y usan datos de ejemplo, no métricas.
 */
export function BenefitBento({ items, label }: { items: BentoItem[]; label: string }) {
  return (
    <SwipeStack label={label} className="grid grid-cols-1 gap-4 md:grid-cols-6 md:gap-[18px]">
      {items.map((it) => (
        <article
          key={it.title}
          className={`flex flex-col gap-3.5 rounded-card border border-line bg-paper p-6 shadow-card transition duration-200 ease-out-fresh md:hover:-translate-y-0.5 md:hover:shadow-card-hover ${
            it.size === "wide" ? "md:col-span-3" : "md:col-span-2"
          }`}
        >
          <div className="flex items-center gap-3.5">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-field ${TONE[it.tone]}`}>
              <Icon name={it.icon} className="text-2xl" />
            </span>
            <h3 className="text-xl text-ink">{it.title}</h3>
          </div>
          <p className="flex items-start gap-2 rounded-[12px] bg-cream px-3 py-2.5 text-[13.5px] text-ink-faint">
            <Icon name="remove" className="mt-px text-lg text-orange-700" />
            <span>
              <b className="font-semibold text-ink-soft">Lo que suele pasar:</b> {it.before}
            </span>
          </p>
          <p className="text-[15px] text-ink-soft">{it.yes}</p>
          {it.viz}
        </article>
      ))}
    </SwipeStack>
  );
}

/** Home · «Por qué EstuRed». */
export const HOME_BENEFITS: BentoItem[] = [
  {
    icon: "verified",
    title: "Residencias Verificadas",
    before: "fotos que nadie revisó.",
    yes: "Revisamos responsable, ubicación y fotos antes de publicar.",
    tone: "forest",
    size: "wide",
    viz: (
      <VizBox>
        <Check>Responsable identificado</Check>
        <Check>Ubicación revisada</Check>
        <Check>Fotos revisadas</Check>
      </VizBox>
    ),
  },
  {
    icon: "receipt",
    title: "Costos a la vista",
    before: "el precio cambia según quién responde.",
    yes: "Tarifa, matrícula, depósito y ajustes, publicados. El fee lo ves antes de pagar.",
    tone: "amber",
    size: "wide",
    viz: (
      <VizBox>
        <Row a="Tarifa mensual" b="USD 380" />
        <Row a="Matrícula · Depósito" b="USD 140 · USD 380" />
        <Row a="Ajuste de tarifa" b="Semestral" />
      </VizBox>
    ),
  },
  {
    icon: "description",
    title: "Todo queda registrado",
    before: "acuerdos en un chat que se pierde.",
    yes: "Solicitud, respuesta y ajustes, con fecha.",
    tone: "petrol",
    size: "narrow",
  },
  {
    icon: "qr_code_2",
    title: "Comprobante verificable",
    before: "pagás y no te queda nada.",
    yes: "Tu reserva confirmada, con un código que cualquiera verifica.",
    tone: "sage",
    size: "narrow",
  },
  {
    icon: "support_agent",
    title: "Soporte de EstuRed",
    before: "si algo falla, nadie responde.",
    yes: "Abrís un caso y te acompañamos a encontrar otra opción.",
    tone: "lilac",
    size: "narrow",
  },
];

/** /for-students · «Beneficios». */
export const STUDENT_BENEFITS: BentoItem[] = [
  {
    icon: "groups",
    title: "Comunidad visible",
    before: "no sabés con quién vivís hasta que llegás.",
    yes: "Conocé a tus compañeros antes de solicitar.",
    tone: "sage",
    size: "wide",
    viz: (
      <VizBox>
        <div className="flex items-center gap-3">
          <div className="flex">
            {[
              ["LF", "bg-sage-200"],
              ["TR", "bg-amber-soft-300"],
              ["MA", "bg-petrol-100"],
              ["+9", "bg-lilac"],
            ].map(([t, c], i) => (
              <span key={t} className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-bold ${c} ${i ? "-ml-2" : ""}`}>
                {t}
              </span>
            ))}
          </div>
          <span className="text-xs text-ink-faint">Medicina · Diseño · Económicas</span>
        </div>
      </VizBox>
    ),
  },
  {
    icon: "rule",
    title: "Reglas antes de escribir",
    before: "las reglas aparecen cuando ya pagaste.",
    yes: "Las 5 principales a la vista y el reglamento para descargar.",
    tone: "amber",
    size: "wide",
    viz: (
      <VizBox>
        <div className="flex items-center gap-1.5">
          <Icon name="bedtime" className="text-base" /> Silencio desde las 23 h
        </div>
        <div className="flex items-center gap-1.5">
          <Icon name="group_add" className="text-base" /> Visitas con aviso previo
        </div>
        <div className="flex items-center gap-1.5 text-xs font-semibold text-forest-700">
          <Icon name="download" className="text-base" /> Reglamento completo
        </div>
      </VizBox>
    ),
  },
  {
    icon: "family_restroom",
    title: "Tu familia te acompaña",
    before: "tu familia se entera por capturas.",
    yes: "Sigue cada paso y te propone opciones. Decidís vos.",
    tone: "petrol",
    size: "narrow",
  },
  {
    icon: "sell",
    title: "Precios claros",
    before: "costos que aparecen al final.",
    yes: "Dólares con referencia en pesos, matrícula y depósito a la vista.",
    tone: "forest",
    size: "narrow",
  },
  {
    icon: "qr_code_2",
    title: "Comprobante de reserva",
    before: "tu reserva depende de un mensaje.",
    yes: "Abonado el fee, tu reserva queda confirmada con código.",
    tone: "lilac",
    size: "narrow",
  },
];
