import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/requireAdmin";

/** Consolidado en /admin/activity (Ciclo 35) — ver views/NegotiationsView.tsx. */
export default async function AdminNegotiationsRedirect() {
  await requireAdmin();
  redirect("/admin/activity?tab=negotiations");
}
