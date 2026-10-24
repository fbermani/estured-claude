import { redirect } from "next/navigation";

// D8 (docs/00 §31): todo es gratis en el MVP, no se muestra ningún plan.
// La ruta se conserva solo para enlaces viejos y redirige al Panel.
export const dynamic = "force-dynamic";

export default async function ResidencePlanPage({
  params,
}: {
  params: Promise<{ residence_id: string }>;
}) {
  const { residence_id: residenceId } = await params;
  redirect(`/residence/${residenceId}`);
}
