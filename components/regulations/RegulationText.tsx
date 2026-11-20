import { renderPlaceholders } from "@/lib/regulations/modelTemplate";

/**
 * Texto de un reglamento (DR14), legible completo. Sin Markdown ni HTML del autor: texto plano en bloques.
 * Convención del editor y del modelo: una línea en MAYÚSCULAS sola = título de sección; un bloque que empieza con «Art. N.» = artículo
 * (primera línea en negrita). Los `{campos}` sin completar del modelo base se leen como «[a definir con la residencia]».
 */
export function RegulationText({ text, className = "" }: { text: string; className?: string }) {
  const blocks = renderPlaceholders(text).split(/\n{2,}/).filter((b) => b.trim().length > 0);
  return (
    <div className={`space-y-3 text-sm leading-relaxed text-ink-soft ${className}`}>
      {blocks.map((block, i) => {
        const [first, ...rest] = block.split("\n");
        const isSection = rest.length === 0 && first === first.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(first) && first.length < 80;
        if (isSection) {
          return (
            <h4 key={i} className="pt-3 text-xs font-bold uppercase tracking-widest text-ink first:pt-0">
              {first}
            </h4>
          );
        }
        if (/^Art\.\s*\d+\./.test(first)) {
          return (
            <div key={i}>
              <p className="font-bold text-ink">{first}</p>
              {rest.length > 0 && <p className="mt-0.5 whitespace-pre-wrap">{rest.join("\n")}</p>}
            </div>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {block}
          </p>
        );
      })}
    </div>
  );
}
