import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/requireAdmin";

/** Consolidado en /admin/activity (Ciclo 35) — ver views/ReservationsView.tsx. */
export default async function AdminReservationsRedirect() {
  await requireAdmin();
  redirect("/admin/activity?tab=reservations");
}
