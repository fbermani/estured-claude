import { redirect } from "next/navigation";

/** Consolidado en /admin/activity (Ciclo 35) — ver views/LogsView.tsx. */
export default async function AdminLogsRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = new URLSearchParams({ tab: "logs" });
  for (const [key, value] of Object.entries(await searchParams)) {
    if (value) params.set(key, value);
  }
  redirect(`/admin/activity?${params.toString()}`);
}
