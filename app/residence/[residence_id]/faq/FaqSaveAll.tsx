"use client";

import { Button } from "@/components/ui/Button";
import { useFaqEditor } from "@/app/residence/[residence_id]/faq/FaqEditor";

/**
 * Cierre de la pantalla: la única acción primaria. Guarda todo lo pendiente de las preguntas del catálogo y de las propias, y vuelve a la
 * configuración. Si algo falla, queda en la pantalla y cada pregunta muestra su aviso. Las destacadas y las respuestas a visitantes se
 * guardan con su propio botón (publicar una respuesta es una decisión aparte): si quedan cambios ahí, lo avisa en vez de perderlos.
 */
export function FaqSaveAll() {
  const ed = useFaqEditor();
  return (
    <section aria-labelledby="faq-save-all-title" className="mt-12 rounded-card border-[1.5px] border-line bg-cream p-5">
      <h2 id="faq-save-all-title" className="text-lg font-bold text-ink">
        Guardar y volver
      </h2>
      <p className="mt-1 text-sm text-ink-soft">
        Guarda las preguntas del catálogo y tus preguntas propias, y te lleva a tu configuración. Las destacadas y las respuestas a visitantes
        se guardan con el botón de cada sección.
      </p>
      <p aria-live="polite" className={`mt-3 text-sm font-semibold tabular-nums ${ed.dirtyCount > 0 ? "text-warning-fg" : "text-ink-soft"}`}>
        {ed.dirtyCount > 0 ? (ed.dirtyCount === 1 ? "Tenés 1 cambio sin guardar." : `Tenés ${ed.dirtyCount} cambios sin guardar.`) : "No tenés cambios sin guardar."}
      </p>
      {ed.allStatus && (
        <p role="alert" className="mt-3 rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {ed.allStatus.text}
        </p>
      )}
      <div className="mt-4">
        <Button type="button" variant="primary" onClick={ed.saveAllAndReturn} disabled={ed.busy}>
          {ed.leaving ? "Guardando…" : "Guardar todo y volver"}
        </Button>
      </div>
    </section>
  );
}
