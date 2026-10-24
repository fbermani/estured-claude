import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";

/**
 * Bloque "Para las familias" de `/for-students` (DR4, `docs/00` §31; `docs/08` §3.2): las familias son público clave.
 * Describe el rol real del familiar vinculado: SEGUIR el estado, PROPONER residencias (el estudiante decide) y PAGAR el
 * fee EstuRed si el estudiante lo designa. Sin promesas de lugar ni de resultados: toda solicitud está sujeta a la
 * confirmación de la residencia, y el familiar no ve los mensajes privados ni los documentos del estudiante.
 */

const ABILITIES = [
  {
    icon: "visibility",
    title: "Seguís cada paso",
    text: "Ves en qué estado están las solicitudes y la reserva, y te avisamos de los hitos importantes: solicitud aceptada, pago, plazos y reserva confirmada.",
  },
  {
    icon: "lightbulb",
    title: "Proponés opciones",
    text: "Le sugerís residencias que te gusten. Tu familiar las revisa y decide si avanza: vos acompañás, la decisión es suya.",
  },
  {
    icon: "payments",
    title: "Pagás el fee si te designa",
    text: "Si tu familiar te elige como pagador, ves el monto, los datos de transferencia y el plazo, y los datos de facturación del pago quedan a tu nombre.",
  },
];

export function FamilyHighlight() {
  return (
    <section id="para-familias" aria-labelledby="para-familias-title" className="scroll-mt-24 bg-mint/60">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[0.95fr_1.05fr]">
        <Reveal>
          <p className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-sm font-semibold text-forest-700">
            <Icon name="family_restroom" className="text-base" /> Para las familias
          </p>
          <h2 id="para-familias-title" className="text-3xl font-bold text-ink sm:text-4xl">
            Acompañá la mudanza sin quedarte afuera
          </h2>
          <p className="mt-4 text-base text-ink-soft sm:text-lg">
            Crean una cuenta de familiar y se vinculan con el estudiante, que aprueba la vinculación. Desde ahí acompañás el
            proceso con la información que corresponde a tu rol.
          </p>
          <p className="mt-4 flex items-start gap-2 rounded-field bg-surface px-4 py-3 text-sm text-ink-soft">
            <Icon name="lock" className="mt-0.5 shrink-0 text-lg text-forest-700" />
            <span>
              Tu familiar mantiene el control: sus documentos y mensajes privados son suyos, y solo él o ella envía las
              solicitudes. Toda solicitud está sujeta a la confirmación de la residencia.
            </span>
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button href="/register/family" size="lg">
              Crear cuenta de familiar
            </Button>
            <Button href="/search" variant="outline" size="lg">
              Explorar residencias
            </Button>
          </div>
        </Reveal>

        <Reveal delay={2}>
          <ul className="space-y-4">
            {ABILITIES.map((item) => (
              <li key={item.title} className="flex gap-4 rounded-card bg-surface p-5 shadow-card ring-1 ring-sand-200">
                <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-field bg-forest-tint text-forest-700">
                  <Icon name={item.icon} className="text-2xl" />
                </span>
                <div>
                  <p className="font-bold text-ink">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
