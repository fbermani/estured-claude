import { Icon } from "@/components/ui/Icon";
import { PreaperturaHeader } from "@/components/preapertura/PreaperturaHeader";
import { PreaperturaFooter } from "@/components/preapertura/PreaperturaFooter";
import { CommunityCard } from "@/components/preapertura/MiniCommunityRail";
import { getCommunityRail } from "@/lib/preapertura/communityRailData";

const WHY = [
  { icon: "verified", tile: "bg-sky text-sky-fg", title: "Visitadas en persona", text: "Cada residencia, verificada antes de publicarse." },
  { icon: "groups", tile: "bg-mint text-forest-700", title: "Conocé la comunidad", text: "Mirá con quién vas a convivir antes de elegir." },
  { icon: "receipt_long", tile: "bg-orange-tint text-orange-700", title: "Todo con registro", text: "Propuesta, pago y comprobante verificable." },
] as const;

const STEPS = [
  { icon: "search", label: "Creá tu cuenta y buscá" },
  { icon: "edit_note", label: "Enviá tu solicitud" },
  { icon: "mark_email_read", label: "La residencia te responde" },
  { icon: "apartment", label: "Le pagás a la residencia" },
  { icon: "verified", label: "Confirmás y recibís tu comprobante" },
] as const;

const PLACEHOLDER_TONES = ["bg-cream-2", "bg-mint", "bg-peach"] as const;

/**
 * Landing de preapertura que se ve blureada detrás del popup (SPEC «Patrón común»). Es una vista previa de cómo va a verse
 * EstuRed: el contenido es ilustrativo, no es un compromiso de oferta (nada de disponibilidad ni precios). Se renderiza dentro de
 * `BlurredPreview` (`aria-hidden` + `inert`), por eso los títulos son párrafos: el único `h1` de la página vive en el popup.
 */
export async function LandingPreview() {
  const rail = await getCommunityRail();
  return (
    <div className="min-h-full bg-cream">
      <PreaperturaHeader sticky={false} />

      <section className="bg-forest-ink px-6 pb-16 pt-14 text-white">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-bold text-orange-light">Ciudad de Buenos Aires</p>
          <p className="mt-3 max-w-[18ch] font-display text-5xl font-bold leading-[1.05] tracking-tight">
            Elegí tu residencia a distancia, <span className="text-orange-light">sin adivinar.</span>
          </p>
          <p className="mt-4 max-w-[46ch] text-white/90">
            Residencias verificadas en persona. Compará reglas, precios y comunidad antes de mandar tu solicitud.
          </p>
          <div className="mt-7 grid max-w-3xl gap-2 rounded-card bg-paper p-2.5 text-ink md:grid-cols-[1fr_1fr_1fr_auto]">
            {[
              ["¿Dónde?", "Todos los barrios"],
              ["¿Qué estudiás?", "Todas"],
              ["¿Cuándo entrás?", "Cuando quieras"],
            ].map(([k, v]) => (
              <span key={k} className="border-line px-3 py-2 text-sm md:border-r">
                {k}
                <br />
                <b>{v}</b>
              </span>
            ))}
            <b className="rounded-field bg-orange px-5 py-3 text-sm text-white">Buscar residencias</b>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <p className="mb-5 font-display text-3xl font-bold">Residencias verificadas</p>
        <div className="grid gap-4 md:grid-cols-3">
          {PLACEHOLDER_TONES.map((tone, i) => (
            <div key={i} className="overflow-hidden rounded-card border-[1.5px] border-line bg-paper shadow-card">
              <div className={`h-36 ${tone}`} />
              <div className="grid gap-2 p-4">
                <b className="font-display text-lg">Residencia ·····</b>
                <i className="block h-2.5 w-3/4 rounded-full bg-cream-2" />
                <i className="block h-2.5 w-2/5 rounded-full bg-cream-2" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <p className="mb-5 font-display text-3xl font-bold">Por qué EstuRed</p>
        <div className="grid gap-4 md:grid-cols-3">
          {WHY.map((w) => (
            <div key={w.title} className="grid gap-2 rounded-card border-[1.5px] border-line bg-paper p-5 shadow-card">
              <span className={`grid size-11 place-items-center rounded-field ${w.tile}`}>
                <Icon name={w.icon} />
              </span>
              <b className="font-display text-lg">{w.title}</b>
              <p className="text-sm text-ink-soft">{w.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-forest-ink py-10">
        <p className="mx-auto max-w-6xl px-6 pb-4 font-display text-3xl font-bold text-white">Tus posibles compañeros</p>
        <div className="flex gap-4 overflow-hidden px-6 pb-6 pt-3">
          {rail.cards.map((card, i) => (
            <CommunityCard key={`${card.kind}-${card.name}-${i}`} card={card} index={i} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <p className="mb-5 font-display text-3xl font-bold">Paso a paso</p>
        <div className="grid gap-2.5">
          {STEPS.map((s) => (
            <div key={s.label} className="flex items-center gap-3.5 rounded-card border-[1.5px] border-line bg-paper px-4 py-3.5">
              <span className="grid size-10 place-items-center rounded-field bg-forest-tint text-forest-700">
                <Icon name={s.icon} />
              </span>
              <b>{s.label}</b>
            </div>
          ))}
        </div>
      </section>

      <PreaperturaFooter />
    </div>
  );
}
