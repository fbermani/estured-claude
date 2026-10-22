import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/requireAdmin";

/** Consolidado en /admin/activity (Ciclo 35) — ver views/RenewalsView.tsx. */
export default async function AdminRenewalsRedirect() {
  await requireAdmin();
  redirect("/admin/activity?tab=renewals");
}
