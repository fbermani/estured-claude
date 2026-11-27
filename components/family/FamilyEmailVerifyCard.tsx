"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { resendFamilyEmailCodeAction, verifyFamilyEmailAction } from "@/app/students/dashboard/familyEmailActions";
import { Input } from "@/components/ui/Input";

/** El familiar verifica su mail con el código de 6 dígitos; sin esto el estudiante no puede aprobar el vínculo (DR32 addendum). */
export function FamilyEmailVerifyCard() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function verify() {
    setMessage(null);
    startTransition(async () => {
      const r = await verifyFamilyEmailAction(code);
      if (r.ok) router.refresh();
      else setMessage({ tone: "error", text: r.message });
    });
  }
  function resend() {
    setMessage(null);
    startTransition(async () => {
      const r = await resendFamilyEmailCodeAction();
      setMessage(r.ok ? { tone: "info", text: "Te mandamos un código nuevo." } : { tone: "error", text: r.message });
    });
  }

  return (
    <Card className="border-amber-soft-300 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-soft-100 text-amber-soft-700">
          <Icon name="mark_email_read" className="text-xl" />
        </span>
        <div className="min-w-0">
          <h2 className="font-bold text-ink">Verificá tu mail</h2>
          <p className="mt-1 text-sm text-ink-soft">Ingresá el código de 6 números que te mandamos. Hasta entonces tu familiar no puede aprobar el vínculo.</p>
        </div>
      </div>
      <form
        className="mt-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          verify();
        }}
      >
        <Input
          label="Código de 6 números"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          className="flex-1 tabular-nums tracking-[0.3em]"
        />
        <Button type="submit" size="lg" disabled={pending || code.length !== 6} className="min-h-14">
          {pending ? "Verificando…" : "Verificar"}
        </Button>
      </form>
      <button type="button" onClick={resend} disabled={pending} className="mt-3 text-sm font-semibold text-forest-700 hover:underline disabled:opacity-50">
        Reenviar código
      </button>
      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`mt-3 rounded-field px-3.5 py-2.5 text-sm font-medium ${message.tone === "error" ? "bg-danger-bg text-danger-fg" : "bg-info-bg text-info-fg"}`}>
          {message.text}
        </p>
      )}
    </Card>
  );
}
