import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/requireAdmin";

/** Consolidado en /admin/activity (Ciclo 35) — ver views/RevocationsView.tsx. */
export default async function AdminRevocationsRedirect() {
  await requireAdmin();
  redirect("/admin/activity?tab=revocations");
}
