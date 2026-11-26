import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Reveal } from "@/components/ui/Reveal";
import { DetailRow } from "@/components/marketing/DetailRow";

/**
 * Bloque "Para las familias" de `/for-students` (DR4, `docs/00` §31; `docs/08` §3.2): las familias son público clave.
 * Describe el rol real del familiar vinculado: SEGUIR el estado, PROPONER residencias (el estudiante decide) y VER el
 * comprobante; el pago del fee va en la bajada (DR68). Sin promesas de lugar ni de resultados, y el familiar no ve los
 * mensajes privados ni los documentos del estudiante.
 */

const ABILITIES = [
  {
    icon: "visibility",
    title: "Seguís cada paso",
    hook: "Estado de solicitudes y reserva, con avisos",
    text: "Ves en qué estado están las solicitudes y la reserva, y te avisamos de los hitos importantes: solicitud aceptada, pago, plazos y reserva confirmada.",
  },
  {
    icon: "lightbulb",
    title: "Proponés opciones",
    hook: "Sugerís residencias; decide tu estudiante",
    text: "Le sugerís residencias que te gusten. Tu estudiante las revisa y decide si avanza: vos acompañás, la decisión es suya.",
  },
  {
    icon: "receipt_long",
    title: "Ves el comprobante",
    hook: "El de la reserva de tu estudiante",
    text: "Cuando la reserva se confirma, lo abrís desde tu panel. Tiene código y QR propios.",
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
          <h2 id="para-familias-title" className="text-3xl font-bold text-ink sm:text-4xl md:text-5xl">
            Seguridad para tu familia, autonomía para tu decisión
          </h2>
          <p className="mt-4 text-base text-ink-soft sm:text-lg">
            Creás una cuenta de familiar y pedís vincularte con tu estudiante, que aprueba la vinculación. Desde ahí acompañás el
            proceso con la información que corresponde a tu rol. Si tu estudiante te designa, también podés pagar el fee de EstuRed.
          </p>
          <p className="mt-4 flex items-start gap-2 rounded-field bg-surface px-4 py-3 text-sm text-ink-soft">
            <Icon name="lock" className="mt-0.5 shrink-0 text-lg text-forest-700" />
            <span>
              Tu estudiante mantiene el control: sus documentos y mensajes privados son suyos. Las solicitudes de reserva se
              envían solo desde su cuenta.
            </span>
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button href="/register/family" size="lg">
              Crear cuenta de familiar
            </Button>
          </div>
        </Reveal>

        <Reveal delay={2}>
          <ul className="space-y-3">
            {ABILITIES.map((item) => (
              <li key={item.title}>
                <DetailRow icon={item.icon} title={item.title} hook={item.hook}>
                  {item.text}
                </DetailRow>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
