import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/requireAdmin";

/** Consolidado en /admin/activity (Ciclo 35) — ver views/ReceiptsView.tsx. */
export default async function AdminReceiptsRedirect() {
  await requireAdmin();
  redirect("/admin/activity?tab=receipts");
}
