import type { ReactNode } from "react";
import Link from "next/link";
import { cmd } from "@/components/admin/ui/tokens";

/**
 * Bandeja lista + detalle del admin.
 * >= xl: dos paneles (cola de 24rem + detalle). < xl: una sola vista —
 * la cola si no hay `?id` explícito, el detalle a ancho completo si lo hay.
 */
export function QueueLayout({
  queue,
  detail,
  backHref,
  explicit,
  detailClassName = "p-4 sm:p-6 xl:p-8",
}: {
  queue: ReactNode;
  detail: ReactNode;
  /** URL de la cola (conserva filtros). */
  backHref: string;
  /** true si la URL trae `?id=`: debajo de xl se muestra el detalle. */
  explicit: boolean;
  detailClassName?: string;
}) {
  return (
    <div className="flex h-full">
      <div
        className={`${explicit ? "hidden xl:block" : "block"} w-full min-w-0 shrink-0 overflow-y-auto border-r xl:w-96`}
        style={{ borderColor: cmd.border }}
      >
        {queue}
      </div>
      <div className={`${explicit ? "block" : "hidden xl:block"} min-w-0 flex-1 overflow-y-auto ${detailClassName}`}>
        <Link
          href={backHref}
          className="mb-3 inline-flex min-h-12 items-center gap-1.5 text-sm font-bold xl:hidden"
          style={{ color: cmd.primary }}
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Volver a la cola
        </Link>
        {detail}
      </div>
    </div>
  );
}
