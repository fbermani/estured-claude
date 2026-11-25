"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { startTotpEnrollment, verifyTotp, type EnrollState, type VerifyState } from "@/app/admin-mfa/actions";

const initialVerify: VerifyState = { status: "idle" };

export function AdminMfaForm({ hasFactor }: { hasFactor: boolean }) {
  const router = useRouter();
  const [enroll, setEnroll] = useState<EnrollState>({ status: "idle" });
  const [starting, startTransition] = useTransition();
  const [verify, verifyAction, verifying] = useActionState(verifyTotp, initialVerify);

  useEffect(() => {
    if (verify.status === "verified") {
      router.replace("/admin/dashboard");
      router.refresh();
    }
  }, [verify.status, router]);

  const needsEnrollment = !hasFactor && enroll.status !== "ready";

  return (
    <div className="mt-6 space-y-5">
      {needsEnrollment && (
        <div className="rounded-card border-[1.5px] border-line bg-paper p-5">
          <p className="text-sm text-ink">Todavía no configuraste tu app de autenticación.</p>
          <Button type="button" className="mt-3" disabled={starting} onClick={() => startTransition(async () => setEnroll(await startTotpEnrollment()))}>
            {starting ? "Generando…" : "Configurar app de autenticación"}
          </Button>
          {enroll.status === "error" && (
            <p role="alert" className="mt-3 text-sm font-medium text-danger-fg">
              {enroll.message}
            </p>
          )}
        </div>
      )}

      {enroll.status === "ready" && (
        <div className="rounded-card border-[1.5px] border-line bg-paper p-5">
          <p className="text-sm text-ink">Escaneá el código con tu app. Si no podés, cargá la clave a mano.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enroll.qr} alt="Código QR para tu app de autenticación" width={200} height={200} className="mt-3 rounded-field bg-paper" />
          <p className="mt-3 break-all text-xs text-ink-soft">
            Clave: <span className="font-mono tabular-nums">{enroll.secret}</span>
          </p>
        </div>
      )}

      {(hasFactor || enroll.status === "ready") && (
        <form action={verifyAction} className="space-y-3">
          {enroll.status === "ready" && <input type="hidden" name="factor_id" value={enroll.factorId} />}
          <Input label="Código de 6 dígitos" id="mfa-code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required />
          {verify.status === "error" && (
            <p role="alert" className="text-sm font-medium text-danger-fg">
              {verify.message}
            </p>
          )}
          <Button type="submit" disabled={verifying}>
            {verifying ? "Verificando…" : "Verificar y entrar"}
          </Button>
        </form>
      )}
    </div>
  );
}
