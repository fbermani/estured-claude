import { Icon } from "@/components/ui/Icon";
import { PreaperturaFooter } from "@/components/preapertura/PreaperturaFooter";
import { BrandMark } from "@/components/ui/BrandMark";

const TOOLS = [
  { icon: "quiz", title: "Menos consultas repetidas", text: "Tu ficha responde lo de siempre." },
  { icon: "event_repeat", title: "Renovaciones y lista de espera juntas", text: "Todo en un mismo lugar." },
  { icon: "fact_check", title: "Reservas y pagos con registro", text: "Lo acordado queda por escrito." },
  { icon: "diversity_3", title: "Afinidad de convivencia", text: "Ves hábitos antes de aceptar." },
] as const;

/**
 * Fondo de las pantallas de residencias (fundadoras y formulario): `/for-residences` blureada, SIN planes ni precios (SPEC «Patrón
 * común»). Maqueta ilustrativa dentro de `BlurredPreview`; los títulos son párrafos porque el único `h1` vive en el popup.
 */
export function ResidencesPreview() {
  return (
    <div className="min-h-full bg-cream">
      <header className="border-b border-line bg-cream/90">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-6">
          <BrandMark size={34} />
        </div>
      </header>
      <section className="bg-forest-ink px-6 pb-14 pt-12 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-8 md:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="inline-block rounded-full bg-forest-600 px-3 py-1 text-sm font-semibold">Para residencias estudiantiles</p>
            <p className="mt-4 max-w-[16ch] font-display text-5xl font-bold leading-[1.05] tracking-tight">Menos mensajes, más residencia</p>
            <p className="mt-4 max-w-[46ch] text-white/90">EstuRed no reemplaza tu operación: la ordena.</p>
            <p className="mt-6">
              <span className="inline-flex min-h-[46px] items-center rounded-full bg-orange px-6 text-sm font-bold">Solicitar sumar mi residencia</span>
            </p>
          </div>
          <div className="grid gap-2.5 rounded-card bg-paper p-5 text-ink">
            <b className="font-display text-base">Solicitudes de esta semana</b>
            {["Habitación compartida, marzo", "Individual, abril", "Lista de espera, 3 personas"].map((row) => (
              <div key={row} className="flex items-center justify-between rounded-field bg-cream px-3 py-2.5 text-sm">
                {row}
                <b className="text-forest-700">Nueva</b>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-12">
        <p className="mb-5 font-display text-3xl font-bold">Herramientas para el día a día de tu residencia</p>
        <div className="grid gap-4 md:grid-cols-4">
          {TOOLS.map((t) => (
            <div key={t.title} className="grid content-start gap-2 rounded-card border-[1.5px] border-line bg-paper p-5 shadow-card">
              <span className="grid size-11 place-items-center rounded-field bg-forest-tint text-forest-700">
                <Icon name={t.icon} />
              </span>
              <b className="font-display text-lg">{t.title}</b>
              <p className="text-sm text-ink-soft">{t.text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="bg-forest-ink px-6 py-12 text-white">
        <p className="mx-auto max-w-6xl font-display text-3xl font-bold">Enterate de una salida con tiempo, no el día que se van</p>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-12">
        <p className="mb-5 font-display text-3xl font-bold">Cómo funciona</p>
        <div className="grid gap-4 md:grid-cols-3">
          {["Dejás tu solicitud", "Te visitamos", "Recibís tu cuenta"].map((t) => (
            <div key={t} className="rounded-card border-[1.5px] border-line bg-paper p-5 font-display text-lg font-bold shadow-card">
              {t}
            </div>
          ))}
        </div>
      </section>
      <PreaperturaFooter />
    </div>
  );
}
