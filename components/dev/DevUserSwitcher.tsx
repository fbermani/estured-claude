"use client";

import { useState, useTransition } from "react";
import { DEMO_USERS } from "@/lib/dev/demo-users";
import {
  exitDemoSession,
  impersonateDemoUser,
} from "@/components/dev/actions";

/**
 * Selector flotante de sesión simulada — SOLO desarrollo.
 * Se monta desde el root layout únicamente si DEMO_LOGIN_ENABLED=true.
 * `currentEmail` marca la sesión activa si es un usuario demo.
 */
export function DevUserSwitcher({ currentEmail }: { currentEmail: string | null }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const active = DEMO_USERS.find((u) => u.email === currentEmail);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 font-sans">
      {open && (
        <div className="w-80 overflow-hidden rounded-card border border-petrol-200 bg-surface shadow-float">
          <p className="border-b border-sand-200 bg-petrol-800 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white">
            Simular sesión (solo dev)
          </p>
          <ul className="max-h-96 overflow-y-auto py-1">
            {DEMO_USERS.map((u) => (
              <li key={u.email}>
                <button
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      const fd = new FormData();
                      fd.set("email", u.email);
                      await impersonateDemoUser(fd);
                    })
                  }
                  className={`flex w-full flex-col px-4 py-2.5 text-left transition-colors hover:bg-petrol-50 disabled:opacity-50 ${
                    u.email === currentEmail ? "bg-sage-50" : ""
                  }`}
                >
                  <span className="text-sm font-semibold text-petrol-800">
                    {u.label}
                    {u.email === currentEmail && (
                      <span className="ml-2 text-xs font-bold text-sage-600">
                        ● activa
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-ink-faint">{u.detail}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-sand-200 p-2">
            <button
              disabled={isPending}
              onClick={() => startTransition(() => exitDemoSession())}
              className="w-full rounded-field px-3 py-2 text-left text-sm font-medium text-danger-fg transition-colors hover:bg-danger-bg disabled:opacity-50"
            >
              Salir de la sesión simulada
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full bg-petrol-800 px-4 py-2.5 text-sm font-bold text-white shadow-float transition-transform hover:scale-105"
        aria-expanded={open}
      >
        <span
          className={`h-2 w-2 rounded-full ${active ? "bg-sage-400" : "bg-amber-soft-400"}`}
          aria-hidden
        />
        {isPending ? "Cambiando…" : active ? active.label : "Simular usuario"}
      </button>
    </div>
  );
}
