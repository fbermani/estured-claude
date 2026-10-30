import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { toneClass, type RoleTone } from "@/lib/ui/tone";

/**
 * Fila de lista del kit: avatar, quién, estado y acción; si hay `detail`, se abre bajo «Más detalle»
 * (`<details>` nativo, accesible por teclado). Las tablas del admin siguen siendo tablas FRESH. Server Component.
 */
export function ListRow({
  tone,
  avatar,
  title,
  meta,
  status,
  action,
  detail,
  className = "",
}: {
  tone?: RoleTone;
  /** Iniciales o un nodo (foto/ícono). */
  avatar: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  action?: ReactNode;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <li className={`${toneClass(tone)} rounded-2xl transition-colors hover:bg-cream focus-within:bg-cream [&+&]:border-t [&+&]:border-line ${className}`}>
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 p-3 md:grid-cols-[auto_1fr_auto_auto] md:gap-x-4">
        <span className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-(--tone-tint) font-display text-[15px] font-bold text-(--tone-700)">
          {avatar}
        </span>
        <div className="min-w-0">
          <b className="block truncate text-[15px] leading-tight text-ink">{title}</b>
          {meta && <span className="block truncate text-[13px] text-ink-faint">{meta}</span>}
        </div>
        {status && <div className="col-start-2 flex flex-wrap items-center gap-2 md:col-start-auto">{status}</div>}
        {action && <div className="col-start-2 flex flex-wrap gap-2 md:col-start-auto">{action}</div>}
      </div>
      {detail && (
        <details className="group px-3 pb-3 pl-[66px] md:pl-[70px]">
          <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-1 text-[13px] font-semibold text-(--tone-700) marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--tone) [&::-webkit-details-marker]:hidden">
            Más detalle
            <Icon name="expand_more" className="text-lg transition-transform duration-300 group-open:rotate-180" />
          </summary>
          <div className="benefit-fade-in text-sm text-ink-soft">{detail}</div>
        </details>
      )}
    </li>
  );
}
