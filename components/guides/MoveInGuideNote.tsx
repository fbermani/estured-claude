import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { resolveGuides } from "@/lib/guides/picks";

/**
 * Aviso antes del campo «fecha de ingreso» (Server Component; se pasa como slot a los formularios cliente).
 * Fiel a la guía de mudanza: es una recomendación, no una promesa de disponibilidad.
 */
export function MoveInGuideNote({ className = "" }: { className?: string }) {
  const [guide] = resolveGuides(["02"]);
  if (!guide) return null;
  return (
    <div className={`flex items-start gap-2.5 rounded-field bg-sky px-3.5 py-3 text-xs leading-relaxed text-sky-fg ${className}`}>
      <Icon name="luggage" className="mt-0.5 shrink-0 text-lg" />
      <p>
        Si podés, llegá 2 o 3 semanas antes del inicio de clases: te da tiempo de conocer la residencia y adaptarte.{" "}
        <Link href={`/guias/${guide.slug}`} target="_blank" rel="noopener" className="font-bold underline underline-offset-2">
          Leer la guía de mudanza
          <span className="sr-only"> (se abre en otra pestaña)</span>
        </Link>
      </p>
    </div>
  );
}
