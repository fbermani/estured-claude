"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const COLLAPSE_STORAGE_KEY = "estured:sidebar-collapsed";
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function subscribeMobile(onChange: () => void) {
  const mq = window.matchMedia("(max-width:767px)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** `true` bajo md (768 px). En el servidor es `false`: el drawer cerrado se oculta recién al hidratar. */
export function useIsMobile() {
  return useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia("(max-width:767px)").matches,
    () => false,
  );
}

/**
 * Estado de colapso/expansión del sidebar (desktop) + apertura del
 * drawer (mobile). Compartido por los 3 sidebars del sitio (admin,
 * estudiante, residencia) para que el toggle se comporte igual en
 * todas las áreas. La preferencia de colapso persiste en localStorage
 * — el proyecto no tenía un sistema de preferencias previo, así que
 * esta es la persistencia más simple posible, sin traer una dependencia
 * nueva.
 *
 * Móvil (lote L7): entre md y lg, sin preferencia guardada, el rail arranca
 * colapsado. El drawer cierra con Esc, bloquea el scroll del fondo, atrapa el
 * foco (arranca en "Cerrar menú" y vuelve al botón de menú) y queda `inert`
 * mientras está cerrado (`drawerInert`).
 */
export function useSidebarCollapse() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpenState] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const isMobile = useIsMobile();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
      setCollapsed(
        saved === null
          ? window.matchMedia("(min-width:768px) and (max-width:1023px)").matches
          : saved === "1",
      );
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

  const setMobileOpen = useCallback((open: boolean) => setMobileOpenState(open), []);

  // Si se agranda la ventana con el drawer abierto, se cierra.
  useEffect(() => {
    if (!isMobile) setMobileOpenState(false);
  }, [isMobile]);

  useEffect(() => {
    if (!mobileOpen) {
      if (wasOpen.current) {
        wasOpen.current = false;
        menuButtonRef.current?.focus({ preventScroll: true });
      }
      return;
    }
    wasOpen.current = true;
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus({ preventScroll: true }));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpenState(false);
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => el.offsetParent !== null,
      );
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (!drawerRef.current?.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return {
    // Antes de hidratar, tratamos como expandido para no pegar un salto
    // visual de layout apenas carga la página.
    collapsed: hydrated && collapsed,
    toggleCollapsed,
    mobileOpen,
    setMobileOpen,
    isMobile,
    /** Pasar a `<aside inert={drawerInert}>`: cerrado bajo md no recibe foco ni lo lee el lector de pantalla. */
    drawerInert: isMobile && !mobileOpen,
    menuButtonRef,
    closeButtonRef,
    drawerRef,
  };
}
