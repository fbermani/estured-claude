"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

/** «Volver»: a la pantalla anterior si la hay; si se abrió en una pestaña nueva (sin historial), al inicio. */
export function BackLink({ label = "Volver", fallback = "/", id }: { label?: string; fallback?: string; id?: string }) {
  const router = useRouter();
  return (
    <button
      id={id}
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      className="inline-flex min-h-11 items-center gap-1 rounded-field text-sm font-bold text-forest-700 hover:underline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-forest-ink"
    >
      <Icon name="arrow_back" className="text-xl" />
      {label}
    </button>
  );
}
