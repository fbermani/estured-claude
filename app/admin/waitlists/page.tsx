import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/requireAdmin";

/** Consolidado en /admin/activity (Ciclo 35) — ver views/WaitlistsView.tsx. */
export default async function AdminWaitlistsRedirect() {
  await requireAdmin();
  redirect("/admin/activity?tab=waitlists");
}
