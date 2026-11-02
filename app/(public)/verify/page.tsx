import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { parseReceiptReference } from "@/lib/receipts/verifyLookup";

export const metadata: Metadata = { title: "Verificar comprobante" };
export const dynamic = "force-dynamic";

/**
 * Entrada manual de `/verify` (H14): para quien tiene el comprobante impreso
 * o en PDF y tipea el número. Es un formulario GET sin JS: si el número tiene
 * forma válida se redirige a `/verify/[número]`; esta pantalla no consulta la
 * base, así que no se puede usar para probar números en bloque.
 */
export default async function VerifyEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ numero?: string }>;
}) {
  const { numero } = await searchParams;
  const typed = (numero ?? "").trim();
  const reference = typed ? parseReceiptReference(typed) : null;
  if (reference) redirect(`/verify/${encodeURIComponent(reference.value)}`);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-14 sm:px-6">
      <Card className="w-full p-8">
        <h1 className="text-xl font-bold text-ink">Verificá un comprobante</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Ingresá el número que figura en el Comprobante de Reserva o de Renovación Confirmada de EstuRed. Si tenés
          el QR o el enlace de verificación, abrilo directamente.
        </p>
        <form action="/verify" method="get" className="mt-6 flex flex-col gap-4">
          <Input
            label="Número del comprobante"
            id="verify-number"
            name="numero"
            defaultValue={typed}
            placeholder="ER-2026-7K3QM-9XJ4A"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            autoCorrect="off"
            enterKeyHint="go"
            className="uppercase"
            maxLength={40}
            required
            hint="Empieza con ER- (reserva) o ERR- (renovación)."
          />
          {typed && !reference && (
            <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
              Ese número no tiene el formato de un comprobante de EstuRed. Revisalo: debería verse como
              ER-2026-7K3QM-9XJ4A.
            </p>
          )}
          <Button type="submit" size="lg">
            Verificar
          </Button>
        </form>
      </Card>
      <p className="mt-6 text-center text-xs text-ink-faint">
        EstuRed actúa como plataforma intermediaria. No presta directamente el alojamiento ni
        garantiza la conducta de las partes.
      </p>
    </div>
  );
}
