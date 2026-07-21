import { redirect } from "next/navigation";

/** Consolidado en /admin/activity (Ciclo 35) — ver views/ReceiptsView.tsx. */
export default function AdminReceiptsRedirect() {
  redirect("/admin/activity?tab=receipts");
}
