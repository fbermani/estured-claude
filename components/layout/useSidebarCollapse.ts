"use client";

import { useCallback, useEffect, useState } from "react";

const COLLAPSE_STORAGE_KEY = "estured:sidebar-collapsed";

/**
 * Estado de colapso/expansión del sidebar (desktop) + apertura del
 * drawer (mobile). Compartido por los 3 sidebars del sitio (admin,
 * estudiante, residencia) para que el toggle se comporte igual en
 * todas las áreas. La preferencia de colapso persiste en localStorage
 * — el proyecto no tenía un sistema de preferencias previo, así que
 * esta es la persistencia más simple posible, sin traer una dependencia
 * nueva.
 */
export function useSidebarCollapse() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");
    } catch {
      // localStorage puede no estar disponible (modo privado, etc.) — se
      // degrada a "expandido" sin romper nada.
    }
    setHydrated(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ver comentario de arriba
      }
      return next;
    });
  }, []);

  return {
    // Antes de hidratar, tratamos como expandido para no pegar un salto
    // visual de layout apenas carga la página.
    collapsed: hydrated && collapsed,
    toggleCollapsed,
    mobileOpen,
    setMobileOpen,
  };
}
