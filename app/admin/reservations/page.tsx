import { redirect } from "next/navigation";

/** Consolidado en /admin/activity (Ciclo 35) — ver views/ReservationsView.tsx. */
export default function AdminReservationsRedirect() {
  redirect("/admin/activity?tab=reservations");
}
