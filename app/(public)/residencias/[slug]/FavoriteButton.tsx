"use client";

import { useActionState } from "react";
import { Icon } from "@/components/ui/Icon";
import type { ToggleFavoriteState } from "@/app/students/favorites/actions";

const initialState: ToggleFavoriteState = { status: "idle" };

/**
 * Botón de favorito reusado por estudiante y familiar — la `action` ya
 * viene bindeada (`toggleStudentFavorite`/`toggleFamilyFavorite`) desde
 * el server component que la renderiza, así que este componente no
 * necesita saber quién la está tocando.
 */
export function FavoriteButton({
  action,
  initialFavorited,
  label,
}: {
  action: (prevState: ToggleFavoriteState, formData: FormData) => Promise<ToggleFavoriteState>;
  initialFavorited: boolean;
  label?: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const favorited = state.favorited ?? initialFavorited;

  return (
    <form action={formAction} className="inline-flex flex-col items-start gap-1">
      <button
        type="submit"
        disabled={isPending}
        aria-pressed={favorited}
        className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
          favorited
            ? "border-orange bg-warning-bg text-orange-700"
            : "border-line-2 bg-paper text-ink-soft hover:border-orange"
        }`}
      >
        <Icon name={favorited ? "favorite" : "favorite_border"} className="text-base" />
        {label ?? (favorited ? "Guardado" : "Guardar")}
      </button>
      {state.status === "error" && <p className="text-xs font-medium text-danger-fg">{state.message}</p>}
    </form>
  );
}
