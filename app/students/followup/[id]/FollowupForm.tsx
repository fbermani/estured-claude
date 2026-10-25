"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { HOW_IS_IT_GOING_OPTIONS, WAS_AS_EXPECTED_OPTIONS } from "@/lib/followups/common";
import { submitFollowupAction, type FollowupFormState } from "@/app/students/followup/[id]/actions";

const initial: FollowupFormState = { status: "idle" };

function Choice({ name, options }: { name: string; options: readonly { value: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label
          key={o.value}
          className="cursor-pointer rounded-full border-[1.5px] border-line-2 bg-paper px-4 py-2 text-sm font-bold text-ink-soft has-[:checked]:border-forest has-[:checked]:bg-forest-tint has-[:checked]:text-ink"
        >
          <input type="radio" name={name} value={o.value} required className="sr-only" />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export function FollowupForm({ followupId }: { followupId: string }) {
  const [state, formAction, isPending] = useActionState(submitFollowupAction.bind(null, followupId), initial);
  if (state.status === "done") {
    return (
      <p role="status" className="rounded-card bg-forest-tint p-4 text-sm font-bold text-ink">
        ¡Gracias por contarnos! Recibimos tu respuesta.
      </p>
    );
  }
  return (
    <form action={formAction} className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="text-base font-bold text-ink">¿Cómo va todo hasta ahora?</legend>
        <Choice name="howIsItGoing" options={HOW_IS_IT_GOING_OPTIONS} />
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-base font-bold text-ink">¿Era lo que esperabas?</legend>
        <Choice name="wasAsExpected" options={WAS_AS_EXPECTED_OPTIONS} />
      </fieldset>
      <Textarea name="comment" label="Algo más que quieras contarnos (opcional)" rows={4} maxLength={1000} />
      {state.status === "error" && (
        <p role="alert" className="text-sm font-bold text-danger">
          {state.message}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Enviando…" : "Enviar"}
        </Button>
        <Link href="/students/dashboard" className="text-sm font-bold text-ink-soft hover:underline">
          Ahora no
        </Link>
      </div>
    </form>
  );
}
