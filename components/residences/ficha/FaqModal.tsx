"use client";

import { createContext, useContext, useEffect, useId, useRef, type ReactNode } from "react";
import { FaqAccordion } from "@/components/residences/FaqAccordion";
import { Icon } from "@/components/ui/Icon";

type FaqItem = { question: string; answer: string; fromVisitor?: boolean; group?: string };

const FaqModalContext = createContext<{ open: () => void } | null>(null);

/**
 * Lista completa de preguntas de la residencia en un modal flotante (propuesta A, fase 4). Mismo patrón que el visor de fotos: un
 * `<dialog>` nativo (foco atrapado y Esc los resuelve el navegador; el scroll del body se bloquea a mano, porque `showModal()` no lo
 * hace), con cierre visible, scroll interno y, en móvil, hoja inferior con el margen seguro del borde (`safe-area-inset-bottom`).
 *
 * Es el contexto que comparten los botones que lo abren (`OpenFaqButton`: el chip de «Lo esencial» y el de la banda): se renderiza una
 * sola vez y envuelve la ficha. Las preguntas se muestran en acordeones, agrupadas por categoría cuando vienen del catálogo (el
 * acordeón dibuja el encabezado del grupo). `askHref`: ancla de «Hacer una pregunta» (se omite para el equipo de la propia residencia).
 */
export function FaqModalProvider({
  items,
  residenceName,
  askHref,
  children,
}: {
  items: FaqItem[];
  residenceName: string;
  askHref?: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyOverflowRef = useRef<string | null>(null);
  const titleId = useId();

  function lockScroll() {
    if (bodyOverflowRef.current === null) bodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  function unlockScroll() {
    if (bodyOverflowRef.current === null) return;
    document.body.style.overflow = bodyOverflowRef.current;
    bodyOverflowRef.current = null;
  }
  // Si el componente se desmonta con el modal abierto, no dejar la página sin scroll.
  useEffect(() => unlockScroll, []);

  function open() {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    lockScroll();
    dialog.showModal();
  }

  function goToAsk(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!askHref) return;
    event.preventDefault();
    dialogRef.current?.close();
    // El scroll del body se libera en `onClose`; se espera un tick para que el desplazamiento ya pueda ocurrir.
    window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(askHref);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
      target?.querySelector<HTMLElement>("textarea, input")?.focus({ preventScroll: true });
    }, 0);
  }

  const total = items.length;
  return (
    <FaqModalContext.Provider value={{ open }}>
      {children}
      {total > 0 && (
        <dialog
          ref={dialogRef}
          aria-labelledby={titleId}
          onClose={unlockScroll}
          onClick={(e) => {
            // Click en el fondo (el propio <dialog>, fuera del contenido) cierra.
            if (e.target === e.currentTarget) e.currentTarget.close();
          }}
          className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-b-none rounded-t-[24px] bg-cream p-0 text-ink shadow-float backdrop:bg-forest-ink/70 sm:m-auto sm:max-h-[90vh] sm:w-[min(720px,94vw)] sm:rounded-card"
        >
          <div className="flex max-h-[92dvh] flex-col sm:max-h-[90vh]">
            <div className="flex items-start justify-between gap-3 border-b-[1.5px] border-line bg-paper px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <h2 id={titleId} className="font-display text-xl font-bold leading-tight text-ink">
                  Preguntas frecuentes
                </h2>
                <p className="text-[14px] text-ink-soft tabular-nums">
                  {total} {total === 1 ? "pregunta respondida" : "preguntas respondidas"} por {residenceName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-[15px] font-bold text-forest-700 hover:bg-forest-tint focus-visible:outline-2 focus-visible:outline-forest"
              >
                <Icon name="close" className="text-lg" />
                Cerrar
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
              <FaqAccordion items={items} initialOpen={null} />
            </div>
            {askHref && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t-[1.5px] border-line bg-paper px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
                <p className="text-[14px] text-ink-soft">¿No está tu pregunta? Si la residencia la responde, la ves acá.</p>
                <a
                  href={askHref}
                  onClick={goToAsk}
                  className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full border-[1.5px] border-forest-700 px-4 text-[15px] font-bold text-forest-700 transition-colors duration-200 ease-out-fresh hover:bg-forest-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                >
                  Hacer una pregunta
                </a>
              </div>
            )}
          </div>
        </dialog>
      )}
    </FaqModalContext.Provider>
  );
}

/**
 * Botón que abre la lista completa de preguntas. Fuera de un `FaqModalProvider` (sin preguntas) cae a un enlace al capítulo
 * `#preguntas`, para no dejar un botón muerto.
 */
export function OpenFaqButton({ className, children }: { className: string; children: ReactNode }) {
  const ctx = useContext(FaqModalContext);
  if (!ctx) {
    return (
      <a href="#preguntas" className={className}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={ctx.open} aria-haspopup="dialog" className={className}>
      {children}
    </button>
  );
}
