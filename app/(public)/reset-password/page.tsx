import type { Metadata } from "next";
import { BrandMark } from "@/components/ui/BrandMark";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ResetPasswordForm } from "@/app/(public)/reset-password/ResetPasswordForm";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string; error_code?: string }>;
}) {
  const { code, error, error_code } = await searchParams;
  // Sin código o con error del proveedor (enlace vencido, ya usado, etc.).
  const invalidLink = !code || Boolean(error) || Boolean(error_code);

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:py-20">
      <div className="text-center">
        <BrandMark variant="symbol" tile size={52} className="mx-auto mb-4 block" />
        <h1 className="text-3xl font-bold text-ink">Elegí tu contraseña nueva</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Después de guardarla te pedimos que ingreses de nuevo.
        </p>
      </div>
      <div className="mt-8">
        {invalidLink ? (
          <Card className="p-8">
            <div role="alert" className="flex flex-col gap-4">
              <p className="text-base font-bold text-ink">Este enlace no sirve</p>
              <p className="text-sm leading-relaxed text-ink-soft">
                El enlace venció, ya se usó o no es válido. Pedí uno nuevo para elegir tu
                contraseña.
              </p>
              <Link
                href="/forgot-password"
                className="text-sm font-semibold text-forest-700 underline underline-offset-2"
              >
                Pedir un enlace nuevo
              </Link>
            </div>
          </Card>
        ) : (
          <ResetPasswordForm code={code} />
        )}
      </div>
    </div>
  );
}
