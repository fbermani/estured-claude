import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { safeInternalPath } from "@/lib/auth/safeNext";
import { getSessionUser, roleHome } from "@/lib/auth/session";
import { listActiveResidencesForPicker } from "@/lib/residents/activeResidences";
import { RolePicker } from "@/app/(public)/register/RolePicker";

export const metadata: Metadata = { title: "Crear cuenta" };
export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: nextRaw } = await searchParams;
  const next = safeInternalPath(nextRaw) ?? undefined;
  const sessionUser = await getSessionUser();
  if (sessionUser) redirect(roleHome(sessionUser));
  const residences = await listActiveResidencesForPicker();

  return (
    <>
      <RolePicker residences={residences} next={next} />
      <p className="-mt-4 pb-12 text-center text-sm text-ink-soft">
        ¿Ya tenés cuenta?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-semibold text-forest-700 hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </>
  );
}
