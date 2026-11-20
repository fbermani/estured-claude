"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import {
  getMyNotifications,
  markNotificationRead,
  markNotificationsRead,
  type NotificationItem,
} from "@/lib/notifications/actions";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // En pantallas anchas el panel se ancla al borde del botón que tenga más lugar (la campana
  // también vive en el sidebar izquierdo del estudiante, donde `right-0` lo cortaba).
  const [alignLeft, setAlignLeft] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getMyNotifications().then(({ items, unreadCount }) => {
      setItems(items);
      setUnreadCount(unreadCount);
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function refresh() {
    getMyNotifications().then(({ items, unreadCount }) => {
      setItems(items);
      setUnreadCount(unreadCount);
    });
  }

  // Abrir el panel ya NO marca todo como leído (H20): cada notificación se marca al abrirla.
  function handleToggle() {
    const next = !open;
    if (next && containerRef.current) {
      setAlignLeft(containerRef.current.getBoundingClientRect().left < 340);
    }
    setOpen(next);
    if (next) refresh();
  }

  function handleOpenItem(n: NotificationItem) {
    setOpen(false);
    if (n.readAt) return;
    // Optimista: el contador baja ya; el servidor confirma en segundo plano.
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    setUnreadCount((c) => Math.max(0, c - 1));
    markNotificationRead(n.id).catch(refresh);
  }

  function handleMarkAll() {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((x) => (x.readAt ? x : { ...x, readAt: now })));
    setUnreadCount(0);
    markNotificationsRead().catch(refresh);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : "Notificaciones"}
        aria-expanded={open}
        className="relative inline-flex size-11 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-cream-2 hover:text-forest-700"
      >
        <Icon name="notifications" className="text-xl" />
        {unreadCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-orange px-1 text-xs font-bold leading-none tabular-nums text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`fixed inset-x-3 top-16 z-50 rounded-card border-[1.5px] border-line bg-paper shadow-lg sm:absolute sm:inset-x-auto sm:top-auto sm:mt-2 sm:w-80 ${
            alignLeft ? "sm:left-0" : "sm:right-0"
          }`}
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p className="text-sm font-bold text-ink">Notificaciones</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-xs font-semibold text-forest-700 underline hover:text-forest"
              >
                Marcar todo como leído
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-faint">Todavía no tenés notificaciones.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto">
              {items.map((n) => {
                const unread = !n.readAt;
                const content = (
                  <>
                    <div className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${unread ? "bg-orange" : "bg-transparent"}`}
                      />
                      <div className="min-w-0">
                        <p className={`text-sm text-ink ${unread ? "font-bold" : "font-medium"}`}>
                          {unread && <span className="sr-only">Sin leer: </span>}
                          {n.title}
                        </p>
                        <p className="mt-0.5 text-sm text-ink-soft">{n.body}</p>
                        <p className="mt-1 text-xs text-ink-faint">
                          {timeAgo(n.createdAt)}
                          {n.href && <span className="ml-2 font-semibold text-forest-700">Ver →</span>}
                        </p>
                      </div>
                    </div>
                  </>
                );
                const rowClass = `block w-full px-4 py-3 text-left transition-colors ${unread ? "bg-orange-tint/40" : ""} ${
                  n.href || unread ? "hover:bg-cream-2" : ""
                }`;
                return (
                  <li key={n.id}>
                    {n.href ? (
                      <Link href={n.href} onClick={() => handleOpenItem(n)} className={rowClass}>
                        {content}
                      </Link>
                    ) : unread ? (
                      <button type="button" onClick={() => handleOpenItem(n)} className={rowClass}>
                        {content}
                      </button>
                    ) : (
                      <div className={rowClass}>{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
