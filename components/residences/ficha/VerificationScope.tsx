import { Icon } from "@/components/ui/Icon";

/** Alcance del sello "Residencia Verificada" (docs/01 §11; contenido obligatorio de docs/08 §4.5). */
const CHECKS = ["Identidad de los responsables", "Dirección", "Visita presencial", "Fotos comparadas con el lugar"];

export function VerificationScope() {
  return (
    <div className="rounded-card border-[1.5px] border-line bg-paper p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-tint text-forest-700">
          <Icon name="verified" className="text-2xl" />
        </span>
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-ink">Qué revisó EstuRed</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Identidad, ubicación y fotos revisadas por EstuRed mediante control presencial.
          </p>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink">
            {CHECKS.map((c) => (
              <li key={c} className="flex items-center gap-1.5">
                <Icon name="check" className="text-base text-forest" />
                {c}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink-faint">
            El sello no reemplaza leer las condiciones y el reglamento de la residencia.
          </p>
        </div>
      </div>
    </div>
  );
}
