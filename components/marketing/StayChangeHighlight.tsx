import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";

/**
 * Bloque destacado del flujo "Quiero cambiar" para las landings (DR3; SPEC §7). Variante `students` para
 * `/for-students` y `residences` para `/for-residences`. Sin métricas inventadas ni promesas de lugar o reembolso:
 * EstuRed es plataforma intermediaria, los costos de salida los informa cada residencia y toda solicitud está sujeta a
 * confirmación. Las composiciones visuales son réplicas estáticas (`aria-hidden`), no datos reales.
 */

const STUDENT_STEPS = [
  { title: "Avisás con un botón", text: "Desde Mi residencia tocás “Quiero cambiar”. Tu residencia se entera con tiempo y tu reserva sigue igual." },
  {
    title: "Buscás sin trabas de fechas",
    text: "Solicitás y te sumás a listas de espera aunque se superpongan con tu estadía. Te avisamos si se libera lugar.",
  },
  { title: "Conocés los costos antes", text: "Tu residencia te informa por escrito depósito, preaviso y entrega. Lo ves vos y tu familia." },
];

const RESIDENCE_BENEFITS = [
  { icon: "event_upcoming", title: "Anticipás la salida", text: "Sabés quién busca otro lugar y para cuándo, en vez de enterarte el día que se va." },
  { icon: "request_quote", title: "Comunicás los costos antes", text: "Informás depósito, preaviso y condiciones por escrito, con plantillas listas para completar." },
  { icon: "calendar_month", title: "Planificás la plaza", text: "Ves cuántas plazas se liberarían y desde qué mes, para ordenar tu ocupación y tus renovaciones." },
  { icon: "hearing", title: "Tenés la oportunidad de escuchar", text: "Si el motivo es algo que podés mejorar, lo sabés a tiempo y podés ofrecer una alternativa." },
];

export function StayChangeHighlight({ variant, studentCta = "register" }: { variant: "students" | "residences"; studentCta?: "register" | "residency" }) {
  if (variant === "students") {
    return (
      <section id="quiero-cambiar" aria-labelledby="quiero-cambiar-students-title" className="scroll-mt-24 border-y border-line bg-paper">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr]">
          <Reveal>
            <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-orange-tint px-3 py-1 text-sm font-semibold text-orange-700">
              <Icon name="swap_horiz" className="text-base" /> Si ya vivís en una residencia
            </p>
            <h2 id="quiero-cambiar-students-title" className="text-3xl font-bold text-ink sm:text-4xl">
              Cambiarte de residencia, sin esconderte y con los costos claros
            </h2>
            <p className="mt-4 text-base text-ink-soft sm:text-lg">
              Si el lugar donde vivís ya no es para vos, avisale con un botón y buscá otro aunque tu contrato siga vigente. Antes de decidir, sabés qué costos
              tiene salir.
            </p>

            <ol className="mt-7 space-y-4">
              {STUDENT_STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-forest-tint font-display text-base font-extrabold text-forest-700">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-bold text-ink">{step.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {studentCta === "residency" ? (
                <Button href="/students/residency#quiero-cambiar" size="lg">
                  Ir a Mi residencia
                </Button>
              ) : (
                <Button href="/register/student" size="lg">
                  Crear cuenta de estudiante
                </Button>
              )}
              <Button href="/search" variant="outline" size="lg">
                Buscar residencias
              </Button>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-ink-faint">
              Lo cancelás cuando quieras. Las otras residencias solo ven que estás en proceso de mudanza, no de cuál venís. Los costos de salida los informa cada
              residencia: EstuRed no los fija ni los cobra. Toda solicitud está sujeta a confirmación.
            </p>

            <div className="mt-8 flex flex-col gap-3 rounded-card bg-mint p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold text-forest-700">Para familias: te enterás de todo</p>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                  Si estás vinculado como familiar, ves el aviso, la fecha estimada de salida y los costos que informe la residencia. Podés proponer opciones; la decisión
                  es de tu estudiante.
                </p>
              </div>
              <Button href="/register/family" variant="outline" size="sm" className="shrink-0">
                Vincularme como familiar
              </Button>
            </div>
          </Reveal>

          {/* Réplica estática de la tarjeta de estado de Mi residencia (decorativa). */}
          <Reveal delay={2} className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div aria-hidden className="overflow-hidden rounded-card border-[1.5px] border-orange/30 bg-paper shadow-float">
              <div className="bg-gradient-to-br from-orange-tint to-paper p-5">
                <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-orange-700">
                  <span className="size-2 rounded-full bg-orange" /> Aviso abierto
                </p>
                <p className="mt-2 font-display text-xl font-extrabold text-ink">Estás buscando un cambio</p>
                <p className="mt-1 text-sm text-ink-soft">Ya podés solicitar y sumarte a listas de espera aunque las fechas se superpongan con tu estadía.</p>
              </div>
              <div className="space-y-3 p-5">
                <div className="grid grid-cols-4 gap-2 text-[11px] font-semibold text-ink-soft">
                  {["Avisaste", "Responde", "Buscás", "Confirmás"].map((label, i) => (
                    <div key={label} className="flex flex-col items-start gap-1.5">
                      <span
                        className={`flex size-4 items-center justify-center rounded-full border-2 text-[9px] ${
                          i === 0 ? "border-forest bg-forest text-white" : i === 1 ? "border-orange ring-4 ring-orange-tint" : "border-line-2"
                        }`}
                      >
                        {i === 0 ? "✓" : ""}
                      </span>
                      {label}
                    </div>
                  ))}
                </div>
                <div className="rounded-field border border-line bg-cream-2/60 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted">
                    <Icon name="payments" className="text-sm text-forest-700" /> Costos de salida
                  </p>
                  <p className="mt-1 text-sm text-ink">Lo informa tu residencia por escrito, antes de que decidas.</p>
                </div>
              </div>
            </div>
            <div aria-hidden className="absolute -right-3 -top-5 hidden max-w-[200px] rotate-2 rounded-card bg-paper p-3.5 shadow-float ring-1 ring-line sm:block">
              <p className="flex items-center gap-2 text-xs font-bold leading-snug text-ink">
                <Icon name="lock" className="text-lg text-forest-700" /> Tu reserva sigue igual
              </p>
            </div>
            <div aria-hidden className="absolute -bottom-4 -left-3 hidden -rotate-1 rounded-card bg-paper p-3.5 shadow-float ring-1 ring-line sm:block">
              <p className="flex items-center gap-2 text-xs font-bold leading-snug text-ink">
                <Icon name="description" className="text-lg text-orange-700" /> Costos de salida, por escrito
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    );
  }

  return (
    <section id="quiero-cambiar" aria-labelledby="quiero-cambiar-residences-title" className="scroll-mt-24 bg-forest-ink text-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid items-start gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <Reveal>
            <p className="text-sm font-extrabold uppercase tracking-wide text-orange-light">Previsibilidad</p>
            <h2 id="quiero-cambiar-residences-title" className="mt-2 text-3xl font-bold sm:text-4xl">
              Enterate de una salida con tiempo, no el día que se van
            </h2>
            <p className="mt-4 text-base text-white/85 sm:text-lg">
              Cuando un residente se va sin avisar con tiempo, se desordenan tu ocupación, tu planificación y tus renovaciones. Con “Quiero cambiar”, el residente te
              avisa cuando empieza a buscar.
            </p>
            <ul className="mt-7 grid gap-4 sm:grid-cols-2">
              {RESIDENCE_BENEFITS.map((benefit) => (
                <li key={benefit.title} className="rounded-card bg-white/[0.06] p-4 ring-1 ring-white/10">
                  <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-white/10 text-orange-light">
                    <Icon name={benefit.icon} className="text-xl" />
                  </span>
                  <p className="mt-3 font-bold">{benefit.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/80">{benefit.text}</p>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs leading-relaxed text-white/70">
              Tu respuesta es informativa: no reemplaza el contrato ni el preaviso que acordaste con el residente. Las otras residencias no ven a tus residentes.
              EstuRed es una plataforma intermediaria y no fija ni cobra costos de salida.
            </p>
          </Reveal>

          <Reveal delay={2} className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div aria-hidden className="overflow-hidden rounded-card bg-paper text-ink shadow-float">
              <div className="bg-gradient-to-br from-orange-tint to-paper px-5 py-4">
                <p className="font-display text-lg font-extrabold">2 residentes buscan cambiar</p>
                <p className="mt-0.5 text-xs text-ink-soft">Respondé con los costos, las condiciones y los detalles de la salida.</p>
              </div>
              {[
                { name: "Lucía F.", detail: "Salida estimada · diciembre", badge: "Sin responder", warm: true },
                { name: "Tomás R.", detail: "Salida estimada · marzo", badge: "Respondida · vista", warm: false },
              ].map((row) => (
                <div key={row.name} className="flex items-center gap-3 border-t border-line px-5 py-3.5">
                  <span className="flex size-8 items-center justify-center rounded-full bg-orange-tint text-sm font-bold text-orange-700">{row.name[0]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{row.name}</p>
                    <p className="text-xs text-ink-faint">{row.detail}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${row.warm ? "bg-orange-tint text-orange-700" : "bg-mint text-forest-700"}`}>
                    {row.badge}
                  </span>
                </div>
              ))}
            </div>
            <div aria-hidden className="absolute -bottom-5 -right-2 hidden max-w-[230px] rotate-1 rounded-card bg-paper p-3.5 text-ink shadow-float sm:block">
              <p className="flex items-start gap-2 text-xs font-bold leading-snug">
                <Icon name="notifications_active" className="text-lg text-orange-700" />
                Lucía avisó que busca cambiar de residencia. Respondele con los costos y condiciones.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
