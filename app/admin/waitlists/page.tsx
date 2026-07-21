import { redirect } from "next/navigation";

/** Consolidado en /admin/activity (Ciclo 35) — ver views/WaitlistsView.tsx. */
export default function AdminWaitlistsRedirect() {
  redirect("/admin/activity?tab=waitlists");
}
