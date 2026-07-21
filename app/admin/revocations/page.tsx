import { redirect } from "next/navigation";

/** Consolidado en /admin/activity (Ciclo 35) — ver views/RevocationsView.tsx. */
export default function AdminRevocationsRedirect() {
  redirect("/admin/activity?tab=revocations");
}
