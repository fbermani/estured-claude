"use server";

import { getSessionUser } from "@/lib/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export async function getMyNotifications(): Promise<{ items: NotificationItem[]; unreadCount: number }> {
  const sessionUser = await getSessionUser();
  const admin = getSupabaseAdmin();
  if (!sessionUser || !admin) return { items: [], unreadCount: 0 };

  const { data } = await admin
    .from("notifications")
    .select("id, title, body, read_at, created_at")
    .eq("user_id", sessionUser.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const items = (data ?? []).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    createdAt: n.created_at,
    readAt: n.read_at,
  }));
  return { items, unreadCount: items.filter((n) => !n.readAt).length };
}

export async function markNotificationsRead(): Promise<void> {
  const sessionUser = await getSessionUser();
  const admin = getSupabaseAdmin();
  if (!sessionUser || !admin) return;

  await admin
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", sessionUser.id)
    .is("read_at", null);
}
