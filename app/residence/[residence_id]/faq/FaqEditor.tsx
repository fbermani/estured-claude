"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { UnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { saveFaqBatchAction } from "@/app/residence/[residence_id]/faq/actions";
import { isCatalogDraftDirty, describeBatchProblems, type CatalogDraft, type FaqBatchResult } from "@/lib/faq/faqEditor";
import { OWN_FAQ_MAX, ownFaqDirty, type OwnFaqItem } from "@/lib/residences/ownFaq";
import type { FaqOwner } from "@/lib/faq/catalog";

/** Una pregunta del catálogo tal como la dibuja la pantalla (ya ordenada: dentro de cada tema, las esenciales primero). */
export type FaqCatalogInfo = {
  id: string;
  category: string;
  question: string;
  owner: FaqOwner;
  suggestedAnswer: string;
  essential: boolean;
  /** Lo guardado: si se muestra en la ficha y la respuesta con la que arranca el campo (override o sugerida). */
  initialSelected: boolean;
  initialAnswer: string;
};

export type FaqSaveState = { state: "saving" } | { state: "saved"; message: string } | { state: "error"; message: string };
export type OwnFaqDraft = { key: number; question: string; answer: string };
export type FaqAllStatus = { tone: "error" | "info"; text: string } | null;

type FaqEditorContextValue = {
  residenceId: string;
  items: FaqCatalogInfo[];
  drafts: Record<string, CatalogDraft>;
  /** Lo que está guardado en el servidor (se actualiza tras cada guardado exitoso). */
  saved: Record<string, CatalogDraft>;
  dirtyIds: ReadonlySet<string>;
  statuses: Record<string, FaqSaveState>;
  busy: boolean;
  setSelected: (id: string, selected: boolean) => void;
  setAnswer: (id: string, answer: string) => void;
  saveItem: (id: string) => void;
  openCats: ReadonlySet<string>;
  toggleCat: (category: string) => void;
  own: {
    drafts: OwnFaqDraft[];
    dirty: boolean;
    status: FaqSaveState | null;
    canAdd: boolean;
    focusKey: number | null;
    add: () => void;
    remove: (key: number) => void;
    change: (key: number, patch: Partial<OwnFaqItem>) => void;
    save: () => void;
  };
  dirtyCount: number;
  allStatus: FaqAllStatus;
  leaving: boolean;
  saveAllAndReturn: () => void;
  reportUnsaved: (key: string, label: string | null) => void;
};

const FaqEditorContext = createContext<FaqEditorContextValue | null>(null);

export function useFaqEditor(): FaqEditorContextValue {
  const ctx = useContext(FaqEditorContext);
  if (!ctx) throw new Error("useFaqEditor se usa dentro de FaqEditorProvider.");
  return ctx;
}

/**
 * Avisa al editor que hay algo sin guardar en otra parte de la pantalla (destacadas, una respuesta a un visitante). Esas partes se guardan
 * con su propio botón: «Guardar todo y volver» no las publica, pero sí avisa y frena la salida para no perderlas sin querer.
 * Sin editor alrededor no hace nada.
 */
export function useReportUnsaved(key: string, label: string, dirty: boolean) {
  const ctx = useContext(FaqEditorContext);
  const report = ctx?.reportUnsaved;
  useEffect(() => {
    if (!report) return;
    report(key, dirty ? label : null);
    return () => report(key, null);
  }, [report, key, label, dirty]);
}

const GENERIC_SAVE_ERROR = "No pudimos guardar. Revisá tu conexión y probá de nuevo.";

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}

/**
 * Estado de toda la pantalla de preguntas: lo escrito y lo guardado de cada pregunta del catálogo y de las preguntas propias, los
 * guardados individuales y «Guardar todo y volver». Las preguntas de todos los temas siguen montadas aunque el tema esté cerrado, así
 * que el guardado en lote ve las ediciones de todas. El «guardado» se actualiza tras cada éxito: un reintento manda solo lo que falló.
 * Incluye el aviso de cambios sin guardar al salir de la pantalla.
 */
export function FaqEditorProvider({
  residenceId,
  items,
  initialOwn,
  canEditCatalog,
  canEditOwn,
  children,
}: {
  residenceId: string;
  items: FaqCatalogInfo[];
  initialOwn: OwnFaqItem[];
  canEditCatalog: boolean;
  canEditOwn: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<Record<string, CatalogDraft>>(() =>
    Object.fromEntries(items.map((i) => [i.id, { selected: i.initialSelected, answer: i.initialAnswer }])),
  );
  const [drafts, setDrafts] = useState<Record<string, CatalogDraft>>(() =>
    Object.fromEntries(items.map((i) => [i.id, { selected: i.initialSelected, answer: i.initialAnswer }])),
  );
  const [statuses, setStatuses] = useState<Record<string, FaqSaveState>>({});
  const nextOwnKey = useRef(initialOwn.length);
  const [ownDrafts, setOwnDrafts] = useState<OwnFaqDraft[]>(() => initialOwn.map((f, i) => ({ key: i, ...f })));
  const [ownSaved, setOwnSaved] = useState<OwnFaqItem[]>(initialOwn);
  const [ownStatus, setOwnStatus] = useState<FaqSaveState | null>(null);
  const [ownFocusKey, setOwnFocusKey] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [openCats, setOpenCats] = useState<ReadonlySet<string>>(new Set());
  const [external, setExternal] = useState<Record<string, string>>({});
  const [allStatus, setAllStatus] = useState<FaqAllStatus>(null);
  const [scrollTarget, setScrollTarget] = useState<{ id: string; n: number } | null>(null);
  const busyRef = useRef(false);

  const dirtyIds = useMemo(() => {
    if (!canEditCatalog) return new Set<string>();
    return new Set(items.filter((i) => drafts[i.id] && saved[i.id] && isCatalogDraftDirty(i.owner, drafts[i.id], saved[i.id])).map((i) => i.id));
  }, [items, drafts, saved, canEditCatalog]);
  const ownDirty = canEditOwn && ownFaqDirty(ownDrafts, ownSaved);
  const dirtyCount = dirtyIds.size + (ownDirty ? 1 : 0);
  const externalLabels = [...new Set(Object.values(external))];

  // Baja hasta la primera pregunta con aviso (el tema ya se abrió en el mismo cambio de estado).
  useEffect(() => {
    if (!scrollTarget) return;
    document.getElementById(scrollTarget.id)?.scrollIntoView({ block: "center" });
  }, [scrollTarget]);

  function setSelected(id: string, selected: boolean) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], selected } }));
  }
  function setAnswer(id: string, answer: string) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], answer } }));
  }
  function toggleCat(category: string) {
    // Se arma un Set nuevo (abrir o cerrar el tema), sin mutar el anterior.
    setOpenCats((prev) => (prev.has(category) ? new Set([...prev].filter((c) => c !== category)) : new Set([...prev, category])));
  }
  // Estable: los hijos lo usan como dependencia de un efecto.
  const reportUnsaved = useCallback((key: string, label: string | null) => {
    setExternal((prev) => {
      if (label === null) {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return prev[key] === label ? prev : { ...prev, [key]: label };
    });
  }, []);

  /** Guarda las preguntas `ids` del catálogo y, si se pide, las propias. Actualiza «guardado» y estados con lo que devolvió el servidor. */
  async function runBatch(ids: string[], includeOwn: boolean): Promise<{ failedIds: string[]; ownFailed: boolean }> {
    busyRef.current = true;
    setBusy(true);
    setAllStatus(null);
    const sent = ids.map((id) => ({ id, selected: drafts[id].selected, answer: drafts[id].answer }));
    const ownSent: OwnFaqItem[] | null = includeOwn ? ownDrafts.map(({ question, answer }) => ({ question, answer })) : null;
    setStatuses((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, { state: "saving" } as FaqSaveState])) }));
    if (includeOwn) setOwnStatus({ state: "saving" });

    let result: FaqBatchResult;
    try {
      result = await saveFaqBatchAction(residenceId, { catalog: sent, own: ownSent });
    } catch {
      result = { status: "error", message: GENERIC_SAVE_ERROR, catalog: {} };
    }

    const failedIds: string[] = [];
    const okSaved: Record<string, CatalogDraft> = {};
    const nextStatuses: Record<string, FaqSaveState> = {};
    for (const item of sent) {
      const r = result.catalog[item.id];
      if (r?.ok) {
        okSaved[item.id] = { selected: item.selected, answer: item.answer };
        nextStatuses[item.id] = {
          state: "saved",
          message: r.selected ? "Listo, la pregunta se muestra en tu ficha." : "Listo, la pregunta no se muestra en tu ficha.",
        };
      } else {
        failedIds.push(item.id);
        nextStatuses[item.id] = { state: "error", message: r?.error ?? result.message ?? GENERIC_SAVE_ERROR };
      }
    }
    setSaved((prev) => ({ ...prev, ...okSaved }));
    setStatuses((prev) => ({ ...prev, ...nextStatuses }));

    let ownFailed = false;
    if (ownSent !== null) {
      if (result.own?.ok) {
        setOwnSaved(ownSent);
        setOwnStatus({ state: "saved", message: "Listo, guardamos tus preguntas propias." });
      } else {
        ownFailed = true;
        setOwnStatus({ state: "error", message: result.own?.ok === false ? result.own.error : (result.message ?? GENERIC_SAVE_ERROR) });
      }
    }

    // Los temas con una pregunta que falló se abren: los avisos no pueden quedar escondidos.
    if (failedIds.length > 0) {
      const cats = items.filter((i) => failedIds.includes(i.id)).map((i) => i.category);
      setOpenCats((prev) => new Set([...prev, ...cats]));
      setScrollTarget((prev) => ({ id: `faq-item-${failedIds[0]}`, n: (prev?.n ?? 0) + 1 }));
    } else if (ownFailed) {
      setScrollTarget((prev) => ({ id: "faq-own", n: (prev?.n ?? 0) + 1 }));
    }
    busyRef.current = false;
    setBusy(false);
    return { failedIds, ownFailed };
  }

  function saveItem(id: string) {
    if (busyRef.current || !canEditCatalog) return;
    void runBatch([id], false);
  }

  /** Guarda lo pendiente del catálogo y de las propias. Resuelve `ok` solo si no quedó nada sin guardar en toda la pantalla. */
  async function saveAll(): Promise<{ ok: boolean; message?: string }> {
    if (busyRef.current) return { ok: false, message: "Todavía estamos guardando. Esperá un momento." };
    let failedCount = 0;
    let ownFailed = false;
    if (dirtyIds.size > 0 || ownDirty) {
      const r = await runBatch([...dirtyIds], ownDirty);
      failedCount = r.failedIds.length;
      ownFailed = r.ownFailed;
    }
    if (failedCount > 0 || ownFailed) return { ok: false, message: describeBatchProblems(failedCount, ownFailed) };
    if (externalLabels.length > 0) {
      return {
        ok: false,
        message: `Guardamos tus preguntas. Te falta guardar ${joinLabels(externalLabels)}: usá el botón de esa sección.`,
      };
    }
    return { ok: true };
  }

  function saveAllAndReturn() {
    if (leaving) return;
    setLeaving(true);
    void saveAll().then((r) => {
      if (r.ok) {
        router.push(`/residence/${residenceId}/profile`);
        return;
      }
      setLeaving(false);
      setAllStatus({ tone: "error", text: r.message ?? GENERIC_SAVE_ERROR });
    });
  }

  const own: FaqEditorContextValue["own"] = {
    drafts: ownDrafts,
    dirty: ownDirty,
    status: ownStatus,
    canAdd: ownDrafts.length < OWN_FAQ_MAX,
    focusKey: ownFocusKey,
    add: () => {
      if (ownDrafts.length >= OWN_FAQ_MAX) return;
      const key = nextOwnKey.current++;
      setOwnDrafts((prev) => [...prev, { key, question: "", answer: "" }]);
      setOwnFocusKey(key);
    },
    remove: (key) => setOwnDrafts((prev) => prev.filter((d) => d.key !== key)),
    change: (key, patch) => setOwnDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d))),
    save: () => {
      if (busyRef.current || !canEditOwn) return;
      void runBatch([], true);
    },
  };

  const value: FaqEditorContextValue = {
    residenceId,
    items,
    drafts,
    saved,
    dirtyIds,
    statuses,
    busy: busy || leaving,
    setSelected,
    setAnswer,
    saveItem,
    openCats,
    toggleCat,
    own,
    dirtyCount,
    allStatus,
    leaving,
    saveAllAndReturn,
    reportUnsaved,
  };

  return (
    <FaqEditorContext.Provider value={value}>
      {children}
      <UnsavedChangesGuard
        active={dirtyCount > 0 || externalLabels.length > 0}
        description="Si salís ahora, se pierde lo que escribiste en tus preguntas y no se guarda."
        saveLabel="Guardar y seguir"
        onSave={saveAll}
      />
    </FaqEditorContext.Provider>
  );
}
