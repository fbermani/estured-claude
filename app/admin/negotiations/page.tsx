import { redirect } from "next/navigation";

/** Consolidado en /admin/activity (Ciclo 35) — ver views/NegotiationsView.tsx. */
export default function AdminNegotiationsRedirect() {
  redirect("/admin/activity?tab=negotiations");
}
