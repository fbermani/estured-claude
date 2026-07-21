import { redirect } from "next/navigation";

/** Consolidado en /admin/activity (Ciclo 35) — ver views/RenewalsView.tsx. */
export default function AdminRenewalsRedirect() {
  redirect("/admin/activity?tab=renewals");
}
