"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/ui/Icon";
import { CollapsibleSection } from "@/components/residences/CollapsibleSection";
import {
  initialOpenKeys,
  isSectionOpen,
  openSection,
  summarizeSection,
  toggleSection,
} from "@/lib/residences/photoSectionCollapse";
import { MAX_FEATURED_PHOTOS } from "@/lib/residences/photoMeta";
import { MIN_PUBLISH_PHOTOS } from "@/lib/residences/photos";
import {
  UNSORTED_KEY,
  appendPhotos,
  assignmentFor,
  buildPhotoSections,
  coverPhotos,
  galleryOrder,
  isOrphaned,
  moveCover,
  movePhotoToSection,
  normalizeCover,
  sectionKeyOf,
  toggleCover,
  type CustomAreaInput,
  type PhotoAssignment,
  type PhotoMetaItem,
  type PhotoSectionDef,
} from "@/lib/residences/photoSections";
import { deleteResidencePhoto, savePhotoMeta, setMainCoverPhoto, uploadResidencePhoto } from "@/app/residence/[residence_id]/profile/photoMetaActions";

export type { PhotoMetaItem } from "@/lib/residences/photoSections";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp";
const SAVE_DEBOUNCE_MS = 700;
/** Al cargar, todas las secciones arrancan colapsadas: las subidas fallidas no existen todavía y se abren solas cuando ocurren. */
const INITIAL_OPEN = initialOpenKeys([]);

type Upload = {
  id: string;
  name: string;
  /** Sección de destino (`UNSORTED_KEY` para el pozo). */
  key: string;
  status: "uploading" | "error";
  message?: string;
  /** Falso cuando reintentar no sirve (archivo rechazado por peso o formato): se oculta «Reintentar». */
  retryable?: boolean;
  file: File;
};
type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Galería de fotos del perfil (rediseño 2026-11-03). Las secciones se arman solas y son exactamente: «Foto principal o de presentación» (antes «Fachada / Exterior»),
 * las áreas comunes elegidas (incluidas las «Otro»), y los tipos de habitación guardados y activos; lo que ya no tiene sección queda en «Sin clasificar».
 * Dos formas de cargar: todas juntas a «Sin clasificar» y de ahí arrastrar cada miniatura a su sección (en táctil: «Mover a…»), o subir directo dentro de una sección.
 * Dónde se ve cada cosa (nada rota solo): hasta 5 fotos de portada con orden = la tarjeta de /search las pasa de a una; la foto principal (una sola) = encabeza
 * la ficha, va primera en la tarjeta y es la imagen del link; el mosaico de «Vivir acá» elige solo; el visor «Ver todas» agrupa por sección y oculta las secciones sin fotos.
 * Cada sección se pliega (cabecera con título, cantidad de fotos y estado; el cuerpo queda montado para no perder subidas ni ediciones) y arranca colapsada;
 * se abre sola si falla una subida en ella. «Sin clasificar» no se pliega: tiene trabajo pendiente. Cada cambio se guarda solo (con debounce); las fotos se suben de a una por server action. Las reglas de moderación son las de siempre:
 * en una residencia publicada la foto nueva queda «Pendiente» hasta que el equipo la apruebe. Vive dentro del <form> del perfil: todos sus
 * botones son type="button" y sus campos no tienen `name`, así que no viajan en el guardado del perfil.
 */
export function PhotoMetaManager({
  residenceId,
  initialItems,
  roomTypes,
  unsavedRoomTypeNames,
  commonAreas,
  customAreas,
  schemaReady,
  sectionsReady,
  coverReady,
  mainCoverReady = false,
  readOnly,
  onCountsChange,
}: {
  residenceId: string;
  initialItems: PhotoMetaItem[];
  /** Tipos de habitación ya guardados (solo esos pueden tener fotos). */
  roomTypes: { id: string; name: string }[];
  /** Nombres de tipos de habitación todavía sin guardar: se avisa que se habilitan al guardar. */
  unsavedRoomTypeNames: string[];
  /** Áreas comunes elegidas en el formulario (texto de `COMMON_AREA_OPTIONS`). */
  commonAreas: string[];
  /** Ítems «Otro» de área común (aprobados o pendientes; los no aprobados se ven marcados «Pendiente» y no se publican hasta que el equipo los apruebe). */
  customAreas: CustomAreaInput[];
  schemaReady: boolean;
  sectionsReady: boolean;
  coverReady: boolean;
  /** Migración 0097 aplicada: se puede elegir la foto principal (hero de la ficha y vista previa del link). */
  mainCoverReady?: boolean;
  readOnly: boolean;
  onCountsChange?: (counts: { total: number; approved: number }) => void;
}) {
  const [items, setItems] = useState<PhotoMetaItem[]>(() => normalizeCover(initialItems));
  const itemsRef = useRef(items);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [mainError, setMainError] = useState<string | null>(null);
  // Secciones colapsables: solo se guarda lo que la persona tocó (o lo que se abrió solo por un error); el resto sigue el estado inicial.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);
  const again = useRef(false);
  const dirty = useRef(false);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const defs = useMemo<PhotoSectionDef[]>(
    () =>
      schemaReady
        ? buildPhotoSections({ commonAreas, customAreas, roomTypes, sectionNamesReady: sectionsReady })
        : [],
    // Las dependencias son las claves de lo que cambia (los arreglos llegan nuevos en cada render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schemaReady, sectionsReady, commonAreas.join("|"), customAreas.map((c) => `${c.label}:${c.status}`).join("|"), roomTypes.map((r) => `${r.id}:${r.name}`).join("|")],
  );
  const editable = !readOnly;
  const defsRef = useRef(defs);
  useEffect(() => {
    defsRef.current = defs;
  }, [defs]);

  useEffect(() => {
    onCountsChange?.({ total: items.length, approved: items.filter((i) => !i.pending).length });
  }, [items, onCountsChange]);

  // ---- Guardado automático ----
  async function flush() {
    if (saving.current) {
      again.current = true;
      return;
    }
    saving.current = true;
    dirty.current = false;
    setSaveStatus("saving");
    setSaveError(null);
    const snapshot = itemsRef.current;
    const order = galleryOrder(snapshot, defsRef.current);
    const result = await savePhotoMeta(
      residenceId,
      snapshot.map((i) => ({
        fileId: i.id,
        category: i.category,
        area: i.area,
        roomTypeId: i.roomTypeId,
        featured: i.featured,
        section: i.section,
        sortOrder: order.get(i.id) ?? 0,
        coverOrder: i.coverOrder,
      })),
    );
    saving.current = false;
    if (result.status === "success") {
      if (again.current || dirty.current) {
        again.current = false;
        void flush();
        return;
      }
      setSaveStatus("saved");
    } else {
      again.current = false;
      dirty.current = true;
      setSaveStatus("error");
      setSaveError(result.message ?? "No pudimos guardar los cambios.");
    }
  }

  function scheduleSave() {
    dirty.current = true;
    setSaveStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
  }

  // Si se sale de la página con un cambio sin guardar, se guarda igual.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (dirty.current && !saving.current) void flush();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function commit(update: (prev: PhotoMetaItem[]) => PhotoMetaItem[]) {
    const next = update(itemsRef.current);
    if (next === itemsRef.current) return;
    itemsRef.current = next;
    setItems(next);
    scheduleSave();
  }

  // ---- Acciones ----
  const moveTo = (id: string, key: string) => commit((prev) => movePhotoToSection(prev, id, key, defsRef.current));
  const toggleStar = (id: string) => commit((prev) => toggleCover(prev, id));
  const shiftCover = (id: string, dir: -1 | 1) => commit((prev) => moveCover(prev, id, dir));

  // Foto principal (0097): se guarda en el acto con su propia acción (no pasa por el guardado automático); si falla, vuelve a como estaba.
  async function toggleMain(id: string) {
    const before = itemsRef.current;
    const makeMain = before.find((i) => i.id === id)?.isCover !== true;
    const apply = (list: PhotoMetaItem[]) => list.map((i) => ({ ...i, isCover: makeMain && i.id === id }));
    setMainError(null);
    itemsRef.current = apply(before);
    setItems(itemsRef.current);
    const result = await setMainCoverPhoto(residenceId, makeMain ? id : null);
    if (result.status === "error") {
      // Se restaura solo la marca (no se pisa lo que se haya tocado mientras tanto).
      const restore = (list: PhotoMetaItem[]) => list.map((i) => ({ ...i, isCover: before.find((b) => b.id === i.id)?.isCover === true }));
      itemsRef.current = restore(itemsRef.current);
      setItems(itemsRef.current);
      setMainError(result.message);
    }
  }

  // Borrar una foto propia (DR36): primero se guarda lo pendiente, después se borra en el servidor y recién ahí sale de la grilla.
  async function removePhoto(id: string) {
    setDeleteError(null);
    setDeletingId(id);
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (dirty.current && !saving.current) await flush();
    let message: string | null = null;
    try {
      const result = await deleteResidencePhoto(residenceId, id);
      if (result.status === "success") commit((prev) => normalizeCover(prev.filter((i) => i.id !== id)));
      else message = result.message;
    } catch {
      message = "No pudimos borrar la foto. Probá de nuevo.";
    }
    setDeletingId(null);
    setConfirmDeleteId(null);
    setDeleteError(message);
  }

  function startUploads(files: File[], key: string) {
    if (!editable || files.length === 0) return;
    const entries: Upload[] = files.map((file) => {
      const id = crypto.randomUUID();
      const tooBig = file.size > MAX_BYTES;
      const badType = !ACCEPT.split(",").includes(file.type);
      return {
        id,
        name: file.name,
        key,
        file,
        status: tooBig || badType ? "error" : "uploading",
        message: badType ? "Tiene que ser JPG, PNG o WebP." : tooBig ? "Pesa más de 5 MB." : undefined,
        retryable: !(tooBig || badType),
      };
    });
    setUploads((prev) => [...prev, ...entries]);
    if (entries.some((e) => e.status === "error")) setToggled((prev) => openSection(key, prev, INITIAL_OPEN));
    for (const entry of entries) if (entry.status === "uploading") enqueue(entry);
  }

  function enqueue(entry: Upload) {
    queue.current = queue.current.then(() => runUpload(entry));
  }

  async function runUpload(entry: Upload) {
    const assign: PhotoAssignment | null = assignmentFor(entry.key, defsRef.current);
    const fd = new FormData();
    fd.set("photo", entry.file);
    if (assign) {
      fd.set("category", assign.category);
      if (assign.area) fd.set("area", assign.area);
      if (assign.roomTypeId) fd.set("roomTypeId", assign.roomTypeId);
      if (assign.section) fd.set("section", assign.section);
    }
    let message = "No pudimos subir la foto. Probá de nuevo.";
    let retryable = true;
    try {
      const result = await uploadResidencePhoto(residenceId, fd);
      if (result.status === "success") {
        setUploads((prev) => prev.filter((u) => u.id !== entry.id));
        commit((prev) => appendPhotos(prev, [result.photo]));
        return;
      }
      message = result.message;
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      if (entry.file.size > MAX_BYTES || /body exceeded|too large|payload|413|limit/i.test(raw)) {
        message = "La foto pesa demasiado; el máximo es 5 MB.";
        retryable = false;
      } else {
        message = "Se cortó la conexión mientras subíamos la foto. Probá de nuevo.";
      }
    }
    setUploads((prev) => prev.map((u) => (u.id === entry.id ? { ...u, status: "error", message, retryable } : u)));
    setToggled((prev) => openSection(entry.key, prev, INITIAL_OPEN));
  }

  function retry(id: string) {
    const entry = uploads.find((u) => u.id === id);
    if (!entry || entry.retryable === false || entry.file.size > MAX_BYTES || !ACCEPT.split(",").includes(entry.file.type)) return;
    const next = { ...entry, status: "uploading" as const, message: undefined };
    setUploads((prev) => prev.map((u) => (u.id === id ? next : u)));
    enqueue(next);
  }

  const dismiss = (id: string) => setUploads((prev) => prev.filter((u) => u.id !== id));

  // ---- Drag & drop (HTML5 nativo: mover miniaturas y soltar archivos del escritorio) ----
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
  function dropProps(key: string) {
    if (!editable) return {};
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!dragId && !hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = dragId ? "move" : "copy";
        if (overKey !== key) setOverKey(key);
      },
      onDragLeave: (e: React.DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverKey((k) => (k === key ? null : k));
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setOverKey(null);
        if (dragId) {
          moveTo(dragId, key);
          setDragId(null);
        } else if (hasFiles(e)) {
          startUploads(Array.from(e.dataTransfer.files), key);
        }
      },
    };
  }

  // ---- Derivados ----
  const cover = coverPhotos(items);
  const approvedCount = items.filter((i) => !i.pending).length;
  const unsortedItems = items.filter((i) => sectionKeyOf(i, defs) === UNSORTED_KEY);
  const orphanedCount = unsortedItems.filter((i) => isOrphaned(i, defs)).length;
  const unsortedUploads = uploads.filter((u) => u.key === UNSORTED_KEY);
  const unsortedActive = unsortedUploads.filter((u) => u.status === "uploading").length;
  const byKey = (key: string) => items.filter((i) => sectionKeyOf(i, defs) === key);
  const optionsFor = (current: string) => [
    ...(current !== UNSORTED_KEY ? [{ key: UNSORTED_KEY, title: "Sin clasificar" }] : []),
    ...defs.filter((d) => d.key !== current).map((d) => ({ key: d.key, title: d.title })),
  ];

  const statusLine =
    saveStatus === "saving" ? (
      <span className="inline-flex items-center gap-1.5 text-ink-soft">
        <Icon name="progress_activity" className="animate-spin text-base" /> Guardando…
      </span>
    ) : saveStatus === "saved" ? (
      <span className="inline-flex items-center gap-1.5 text-forest-700">
        <Icon name="check_circle" className="text-base" /> Cambios guardados
      </span>
    ) : null;

  return (
    <div className="mt-4 space-y-5">
      {!schemaReady && (
        <p className="rounded-field bg-cream-2 p-3 text-sm text-ink-soft">
          Muy pronto vas a poder ordenar tus fotos por sección y elegir las de portada. Por ahora podés subirlas igual.
        </p>
      )}

      {mainError && (
        <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
          {mainError}
        </p>
      )}

      {schemaReady && (
        <CoverStrip
          cover={cover}
          editable={editable}
          coverReady={coverReady}
          mainCoverReady={mainCoverReady}
          onToggle={toggleStar}
          onShift={shiftCover}
        />
      )}

      {editable && (
        <UploadDropzone
          highlight={overKey === UNSORTED_KEY && !dragId}
          dropProps={dropProps(UNSORTED_KEY)}
          onFiles={(files) => startUploads(files, UNSORTED_KEY)}
          empty={items.length === 0 && uploads.length === 0}
        />
      )}

      {items.some((i) => i.pending) && (
        <p className="flex items-start gap-2 rounded-field bg-orange-tint/60 p-3 text-sm text-ink-soft">
          <Icon name="schedule" className="mt-0.5 text-base" />
          <span>Las fotos marcadas «Pendiente» las revisa el equipo de EstuRed. Hasta que las aprueben, el público no las ve.</span>
        </p>
      )}

      {/* Pozo «Sin clasificar» */}
      {schemaReady && (unsortedItems.length > 0 || unsortedUploads.length > 0) && (
        <section
          aria-label="Sin clasificar"
          {...dropProps(UNSORTED_KEY)}
          className={`rounded-card border-[1.5px] border-dashed p-3 sm:p-4 ${
            overKey === UNSORTED_KEY && dragId ? "border-forest bg-forest-tint" : "border-orange/40 bg-orange-tint/40"
          }`}
        >
          <SectionHeader icon="inventory_2" title="Sin clasificar" count={unsortedItems.length + unsortedActive} />
          {editable && <p className="mt-1 text-xs text-ink-soft">Arrastrá cada foto a su sección o elegí «Mover a…».</p>}
          {orphanedCount > 0 && (
            <p className="mt-1 text-xs text-ink-soft">
              {orphanedCount === 1 ? "Una foto estaba" : `${orphanedCount} fotos estaban`} en un área o tipo de habitación que ya no está en tu perfil. En la ficha se ven como «Fotos adicionales»; si volvés a tildar esa área, vuelven a su sección.
            </p>
          )}
          <PhotoGrid items={unsortedItems} uploads={unsortedUploads} sectionKey={UNSORTED_KEY} sectionTitle="Sin clasificar" {...gridCommon()} />
        </section>
      )}

      {/* Sin schema de clasificación: lista simple */}
      {!schemaReady && (items.length > 0 || uploads.length > 0) && (
        <PhotoGrid items={items} uploads={uploads} sectionKey={UNSORTED_KEY} sectionTitle="Fotos" {...gridCommon()} />
      )}

      {/* Secciones */}
      {schemaReady && (
        <div className="space-y-3">
          {editable && <p className="text-xs text-ink-soft">Las secciones sin fotos no se muestran en tu ficha.</p>}
          {defs.map((d) => {
            const sectionItems = byKey(d.key);
            const sectionUploads = uploads.filter((u) => u.key === d.key);
            const total = sectionItems.length + sectionUploads.length;
            const isOver = overKey === d.key;
            const summary = summarizeSection({
              key: d.key,
              photos: sectionItems.length,
              pendingPhotos: sectionItems.filter((i) => i.pending).length,
              uploading: sectionUploads.filter((u) => u.status === "uploading").length,
              failedUploads: sectionUploads.filter((u) => u.status === "error").length,
            });
            const open = isSectionOpen(d.key, toggled, INITIAL_OPEN);
            return (
              <section
                key={d.key}
                aria-label={d.title}
                {...dropProps(d.key)}
                className={`rounded-card border-[1.5px] p-3 transition-colors sm:p-4 ${
                  isOver ? "border-forest bg-forest-tint" : total === 0 ? "border-dashed border-line-2 bg-cream" : "border-line bg-paper"
                }`}
              >
                <CollapsibleSection
                  icon={d.icon}
                  title={d.title}
                  countLabel={summary.countLabel}
                  status={summary.status}
                  badge={d.pending ? { label: "Pendiente", hint: "Se muestra en la ficha cuando el equipo apruebe esta área" } : null}
                  open={open}
                  onToggle={() => setToggled((prev) => toggleSection(d.key, prev, INITIAL_OPEN))}
                  actions={editable && <PickButton label="Subir" ariaLabel={`Subir fotos a ${d.title}`} onFiles={(files) => startUploads(files, d.key)} />}
                >
                  {editable && d.kind === "facade" && (
                    <p className="mt-1 text-xs text-ink-soft">
                      Las fotos con las que se presenta tu residencia, por ejemplo el frente.
                      {mainCoverReady && " La que encabece tu ficha la elegís con el ícono de imagen."}
                    </p>
                  )}
                  {total === 0 ? (
                    <p className="mt-2 text-sm text-ink-faint">{editable ? "Arrastrá fotos acá o tocá «Subir»." : "Sin fotos todavía."}</p>
                  ) : (
                    <PhotoGrid items={sectionItems} uploads={sectionUploads} sectionKey={d.key} sectionTitle={d.title} {...gridCommon()} />
                  )}
                </CollapsibleSection>
              </section>
            );
          })}
          {unsavedRoomTypeNames.length > 0 && (
            <p className="flex items-start gap-2 rounded-field bg-cream-2 p-3 text-sm text-ink-soft">
              <Icon name="info" className="mt-0.5 text-base" />
              <span>
                Guardá el perfil para sumar fotos de: <strong className="text-ink">{unsavedRoomTypeNames.join(", ")}</strong>. La sección aparece al guardar.
              </span>
            </p>
          )}
        </div>
      )}

      {deleteError && (
        <p role="alert" className="flex items-start gap-2 rounded-field bg-danger-bg px-3.5 py-2.5 text-sm font-medium text-danger-fg">
          <Icon name="error" className="mt-0.5 text-base" />
          <span>{deleteError}</span>
        </p>
      )}

      {/* Estado del guardado */}
      <div className="min-h-6 text-sm" aria-live="polite">
        {saveStatus === "error" ? (
          <p role="alert" className="flex flex-wrap items-center gap-2 text-danger-fg">
            <Icon name="error" className="text-base" />
            <span>{saveError}</span>
            <button type="button" onClick={() => void flush()} className="font-bold underline">
              Reintentar
            </button>
          </p>
        ) : (
          statusLine
        )}
      </div>
      {approvedCount < MIN_PUBLISH_PHOTOS && items.length > 0 && (
        <p className="sr-only">Hacen falta al menos {MIN_PUBLISH_PHOTOS} fotos aprobadas para publicar.</p>
      )}
    </div>
  );

  function gridCommon() {
    return {
      editable,
      sectionsEnabled: schemaReady,
      options: optionsFor,
      sectionKeyOf: (i: PhotoMetaItem) => sectionKeyOf(i, defs),
      dragId,
      coverFull: cover.length >= MAX_FEATURED_PHOTOS,
      onDragStart: setDragId,
      onDragEnd: () => {
        setDragId(null);
        setOverKey(null);
      },
      onMove: moveTo,
      onStar: toggleStar,
      mainCoverReady,
      onMain: (id: string) => void toggleMain(id),
      onRetry: retry,
      onDismiss: dismiss,
      confirmDeleteId,
      deletingId,
      onAskDelete: (id: string) => {
        setDeleteError(null);
        setConfirmDeleteId(id);
      },
      onCancelDelete: () => setConfirmDeleteId(null),
      onConfirmDelete: (id: string) => void removePhoto(id),
    };
  }
}

function SectionHeader({ icon, title, count, pending }: { icon: string; title: string; count: number; pending?: boolean }) {
  return (
    <h4 className="flex items-center gap-2 text-sm font-bold text-ink">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-forest-tint text-forest-700">
        <Icon name={icon} className="text-lg" />
      </span>
      {title}
      <span className="rounded-full bg-cream-2 px-2 py-0.5 text-xs font-bold text-ink-soft">{count}</span>
      {pending && (
        <span className="rounded-full bg-orange-tint px-2 py-0.5 text-xs font-bold text-orange-700" title="Se muestra en la ficha cuando el equipo apruebe esta área">
          Pendiente
        </span>
      )}
    </h4>
  );
}

/** Botón «Subir» de una sección: un <label> con el input adentro (accesible con teclado y táctil). */
function PickButton({ label, ariaLabel, onFiles }: { label: string; ariaLabel: string; onFiles: (files: File[]) => void }) {
  return (
    <label className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-line-2 bg-paper px-4 text-sm font-bold text-ink hover:border-forest hover:bg-forest-tint focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-forest">
      <Icon name="add_photo_alternate" className="text-lg" />
      {label}
      <input
        type="file"
        accept={ACCEPT}
        multiple
        aria-label={ariaLabel}
        className="sr-only"
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </label>
  );
}

function UploadDropzone({
  onFiles,
  dropProps,
  highlight,
  empty,
}: {
  onFiles: (files: File[]) => void;
  dropProps: object;
  highlight: boolean;
  empty: boolean;
}) {
  return (
    <label
      {...dropProps}
      className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed px-4 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-forest ${
        empty ? "py-12" : "py-6"
      } ${highlight ? "border-forest bg-forest-tint" : "border-line-2 bg-cream hover:border-forest"}`}
    >
      <Icon name="cloud_upload" className="text-4xl text-forest-700" />
      <span className="text-sm font-bold text-forest-700">
        {empty ? "Subí tus fotos" : "Sumá más fotos"}: tocá acá o arrastralas
      </span>
      <span className="text-xs text-ink-faint">
        {empty ? `Necesitás al menos ${MIN_PUBLISH_PHOTOS} para publicar. ` : ""}JPG, PNG o WebP · hasta 5 MB cada una · después las acomodás por sección
      </span>
      <input
        type="file"
        accept={ACCEPT}
        multiple
        aria-label="Subir fotos"
        className="sr-only"
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </label>
  );
}

/** Tira de portada: hasta 5 lugares numerados, en el orden en que la tarjeta de la búsqueda las pasa. La foto principal (insignia «Principal») va primera igual. */
function CoverStrip({
  cover,
  editable,
  coverReady,
  mainCoverReady,
  onToggle,
  onShift,
}: {
  cover: PhotoMetaItem[];
  editable: boolean;
  coverReady: boolean;
  mainCoverReady: boolean;
  onToggle: (id: string) => void;
  onShift: (id: string, dir: -1 | 1) => void;
}) {
  return (
    <section aria-label="Fotos de portada" className="rounded-card border-[1.5px] border-line bg-paper p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-bold text-ink">
          <span className="grid size-8 place-items-center rounded-full bg-orange-tint text-orange-700">
            <Icon name="star" className="text-lg" />
          </span>
          Portada
        </h4>
        <span
          className={`rounded-full px-3 py-1 text-sm font-bold ${cover.length === MAX_FEATURED_PHOTOS ? "bg-forest-tint text-forest-700" : "bg-cream-2 text-ink-soft"}`}
          aria-label={`${cover.length} de ${MAX_FEATURED_PHOTOS} fotos de portada`}
        >
          {cover.length} de {MAX_FEATURED_PHOTOS}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        {editable
          ? `Marcá con la estrella hasta ${MAX_FEATURED_PHOTOS} fotos para tu tarjeta de la búsqueda: quien explora las pasa de a una.`
          : "Estas son las fotos de tu tarjeta de la búsqueda: quien explora las pasa de a una."}{" "}
        {cover.length === 0 && `Si no elegís, se muestran las primeras ${MAX_FEATURED_PHOTOS}. `}
        {editable &&
          (mainCoverReady
            ? "Con el ícono de imagen elegís la foto principal: encabeza tu ficha, va primera en la búsqueda y se muestra al compartir el link."
            : "El encabezado de tu ficha usa la primera foto de la portada.")}
      </p>
      <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
        {Array.from({ length: MAX_FEATURED_PHOTOS }, (_, i) => {
          const photo = cover[i];
          if (!photo)
            return (
              <li key={`empty-${i}`} className="grid aspect-[4/3] place-items-center rounded-field border-[1.5px] border-dashed border-line-2 text-xs font-bold text-ink-faint">
                {i + 1}
              </li>
            );
          return (
            <li key={photo.id} className="relative aspect-[4/3] overflow-hidden rounded-field bg-cream-2">
              <Image src={photo.url} alt={`Portada ${i + 1}`} fill sizes="(min-width: 640px) 120px, 45vw" draggable={false} className="object-cover" />
              <span className="absolute left-1 top-1 grid size-6 place-items-center rounded-full bg-forest-ink/85 text-xs font-bold text-white">{i + 1}</span>
              {photo.isCover && <span className="absolute bottom-1 left-1 rounded-full bg-forest-ink px-2 py-0.5 text-xs font-bold text-paper">Principal</span>}
              {editable && (
                <>
                  <button
                    type="button"
                    onClick={() => onToggle(photo.id)}
                    aria-label={`Sacar la portada ${i + 1}`}
                    className="absolute right-0.5 top-0.5 grid size-8 place-items-center rounded-full bg-paper/90 text-ink hover:bg-paper focus-visible:outline-2 focus-visible:outline-forest"
                  >
                    <Icon name="close" className="text-base" />
                  </button>
                  {coverReady && (
                    <div className="absolute inset-x-0 bottom-0 flex justify-between p-0.5">
                      <button
                        type="button"
                        disabled={i === 0}
                        onClick={() => onShift(photo.id, -1)}
                        aria-label={`Mover la portada ${i + 1} hacia adelante`}
                        className="grid size-8 place-items-center rounded-full bg-paper/90 text-ink hover:bg-paper disabled:opacity-0 focus-visible:outline-2 focus-visible:outline-forest"
                      >
                        <Icon name="chevron_left" className="text-lg" />
                      </button>
                      <button
                        type="button"
                        disabled={i === cover.length - 1}
                        onClick={() => onShift(photo.id, 1)}
                        aria-label={`Mover la portada ${i + 1} hacia atrás`}
                        className="grid size-8 place-items-center rounded-full bg-paper/90 text-ink hover:bg-paper disabled:opacity-0 focus-visible:outline-2 focus-visible:outline-forest"
                      >
                        <Icon name="chevron_right" className="text-lg" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

type GridProps = {
  items: PhotoMetaItem[];
  uploads: Upload[];
  sectionKey: string;
  /** Título de la sección, para que los `aria-label` no se repitan entre secciones. */
  sectionTitle: string;
  editable: boolean;
  sectionsEnabled: boolean;
  options: (current: string) => { key: string; title: string }[];
  sectionKeyOf: (i: PhotoMetaItem) => string;
  dragId: string | null;
  coverFull: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onMove: (id: string, key: string) => void;
  onStar: (id: string) => void;
  mainCoverReady: boolean;
  onMain: (id: string) => void;
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
  confirmDeleteId: string | null;
  deletingId: string | null;
  onAskDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
};

function PhotoGrid(props: GridProps) {
  const { items, uploads, editable, sectionsEnabled, dragId, coverFull } = props;
  return (
    <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((photo, n) => (
        <li
          key={photo.id}
          draggable={editable && sectionsEnabled}
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", photo.id);
            e.dataTransfer.effectAllowed = "move";
            props.onDragStart(photo.id);
          }}
          onDragEnd={props.onDragEnd}
          className={`group relative overflow-hidden rounded-field border border-line bg-paper ${editable && sectionsEnabled ? "cursor-grab active:cursor-grabbing" : ""} ${dragId === photo.id ? "opacity-40" : ""}`}
        >
          <div className="relative aspect-[4/3] bg-cream-2">
            <Image
              src={photo.url}
              alt={`Foto ${n + 1}${photo.pending ? " (pendiente de aprobación)" : ""}`}
              fill
              sizes="(min-width: 1024px) 240px, (min-width: 640px) 33vw, 50vw"
              draggable={false}
              className="object-cover"
            />
            {photo.pending && (
              <span className="absolute bottom-1 left-1 rounded-full bg-orange-tint px-2 py-0.5 text-xs font-bold text-orange-700">Pendiente</span>
            )}
            {sectionsEnabled && editable && (
              <button
                type="button"
                onClick={() => props.onStar(photo.id)}
                disabled={!photo.featured && coverFull}
                aria-pressed={photo.featured}
                aria-label={photo.featured ? "Sacar de la portada" : coverFull ? "Ya elegiste 5: sacá una portada para elegir otra" : "Poner en la portada"}
                title={photo.featured ? "Sacar de la portada" : coverFull ? "Ya elegiste 5: sacá una para elegir otra" : "Poner en la portada"}
                className={`absolute right-1 top-1 grid size-11 place-items-center rounded-full shadow-sm focus-visible:outline-2 focus-visible:outline-forest disabled:opacity-40 ${
                  photo.featured ? "bg-orange text-white" : "bg-paper/90 text-ink hover:bg-paper"
                }`}
              >
                <Icon name="star" className="text-xl" style={{ fontVariationSettings: `'FILL' ${photo.featured ? 1 : 0}` }} />
              </button>
            )}
            {sectionsEnabled && editable && props.mainCoverReady && !photo.pending && (
              <button
                type="button"
                onClick={() => props.onMain(photo.id)}
                aria-pressed={photo.isCover === true}
                aria-label={photo.isCover ? "Dejar de usar como foto principal" : "Usar como foto principal"}
                title={photo.isCover ? "Es la foto principal de tu ficha y del link" : "Usar como foto principal de tu ficha y del link"}
                className={`absolute left-1 top-1 inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-full text-xs font-bold shadow-sm focus-visible:outline-2 focus-visible:outline-forest ${
                  photo.isCover ? "bg-forest-ink px-3 text-paper" : "bg-paper/90 text-ink hover:bg-paper"
                }`}
              >
                <Icon name="image" className="text-xl" />
                {photo.isCover && "Principal"}
              </button>
            )}
            {sectionsEnabled && !editable && photo.isCover && (
              <span className="absolute left-1 top-1 rounded-full bg-forest-ink px-2.5 py-1 text-xs font-bold text-paper">Principal</span>
            )}
            {sectionsEnabled && !editable && photo.featured && (
              <span className="absolute right-1 top-1 grid size-8 place-items-center rounded-full bg-orange text-white" title="En la portada">
                <Icon name="star" className="text-base" />
              </span>
            )}
          </div>
          {sectionsEnabled && editable && (
            <select
              aria-label={`Mover la foto ${n + 1} de ${props.sectionTitle} a…`}
              value=""
              onChange={(e) => e.target.value && props.onMove(photo.id, e.target.value)}
              className="min-h-11 w-full border-t border-line bg-paper px-2 text-sm text-ink-soft focus-visible:outline-2 focus-visible:outline-forest"
            >
              <option value="">Mover a…</option>
              {props.options(props.sectionKeyOf(photo)).map((o) => (
                <option key={o.key} value={o.key}>
                  {o.title}
                </option>
              ))}
            </select>
          )}
          {editable &&
            (props.confirmDeleteId === photo.id ? (
              <div role="group" aria-label={`Confirmar el borrado de la foto ${n + 1} de ${props.sectionTitle}`} className="flex flex-wrap items-center gap-1 border-t border-line bg-danger-bg px-2 py-1.5">
                <span className="flex-1 text-xs font-semibold text-danger-fg">¿Borrar esta foto?</span>
                <button
                  type="button"
                  disabled={props.deletingId === photo.id}
                  onClick={() => props.onConfirmDelete(photo.id)}
                  className="min-h-11 rounded-full bg-danger-fg px-3 text-xs font-bold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {props.deletingId === photo.id ? "Borrando…" : "Sí, borrar"}
                </button>
                <button type="button" disabled={props.deletingId === photo.id} onClick={props.onCancelDelete} className="min-h-11 px-2 text-xs font-semibold text-ink-soft hover:text-ink">
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => props.onAskDelete(photo.id)}
                aria-label={`Borrar la foto ${n + 1} de ${props.sectionTitle}`}
                className="flex min-h-11 w-full items-center justify-center gap-1.5 border-t border-line text-sm font-semibold text-ink-soft hover:bg-danger-bg hover:text-danger-fg focus-visible:outline-2 focus-visible:outline-forest"
              >
                <Icon name="delete" className="text-lg" />
                Borrar
              </button>
            ))}
        </li>
      ))}
      {uploads.map((u) => (
        <li key={u.id} className="overflow-hidden rounded-field border border-line bg-paper">
          <div className="grid aspect-[4/3] place-items-center bg-cream-2 p-2 text-center">
            {u.status === "uploading" ? (
              <div role="status" className="flex flex-col items-center gap-1 text-xs text-ink-soft">
                <Icon name="progress_activity" className="animate-spin text-2xl text-forest-700" />
                <span className="line-clamp-1 max-w-full">Subiendo {u.name}</span>
              </div>
            ) : (
              <div role="alert" className="flex flex-col items-center gap-1 text-xs text-danger-fg">
                <Icon name="error" className="text-2xl" />
                <span className="line-clamp-1 max-w-full font-bold">{u.name}</span>
                <span>{u.message}</span>
              </div>
            )}
          </div>
          {u.status === "error" && (
            <div className="flex border-t border-line">
              {u.retryable !== false && (
                <button type="button" onClick={() => props.onRetry(u.id)} className="min-h-11 flex-1 text-sm font-bold text-forest-700 hover:bg-forest-tint">
                  Reintentar
                </button>
              )}
              <button
                type="button"
                onClick={() => props.onDismiss(u.id)}
                className={`min-h-11 flex-1 text-sm font-bold text-ink-soft hover:bg-cream-2 ${u.retryable !== false ? "border-l border-line" : ""}`}
              >
                Quitar
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
