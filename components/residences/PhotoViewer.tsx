"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { Icon } from "@/components/ui/Icon";
import { DEFAULT_SECTION, PRESENTATION_LABEL, groupPhotosBySections, type GalleryPhoto } from "@/lib/residences/photoMeta";
import { useSwipe } from "@/components/residences/useRotation";

/**
 * Visor de todas las fotos de la ficha, compartido por el hero inmersivo y por el mosaico: un `<dialog>` nativo (foco y Escape los
 * resuelve el navegador; el scroll del body se bloquea a mano mientras está abierto, porque `showModal()` no lo hace) con las fotos
 * agrupadas por sección (áreas comunes primero, después los tipos de habitación y «Fotos adicionales» al final; solo aparecen las secciones con al menos una foto), y un segundo
 * `<dialog>` (lightbox) con la foto ampliada, flechas, teclado (← →) y deslizar para pasar de a una.
 *
 * Uso: `const viewer = usePhotoViewer({ photos, name, zone })`, renderizar `{viewer.node}` (fuera de cualquier contenedor con color
 * de texto propio) y abrir con `viewer.openAt(i)` / `viewer.openPhoto(foto)`.
 */
export function usePhotoViewer({ photos, name, zone }: { photos: GalleryPhoto[]; name: string; zone: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const bodyOverflowRef = useRef<string | null>(null);

  function lockScroll() {
    if (bodyOverflowRef.current === null) bodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  function unlockScroll() {
    if (bodyOverflowRef.current === null) return;
    document.body.style.overflow = bodyOverflowRef.current;
    bodyOverflowRef.current = null;
  }
  // Si el componente se desmonta con el visor abierto, no dejar la página sin scroll.
  useEffect(() => unlockScroll, []);

  const total = photos.length;
  const place = zone ? ` en ${zone}` : "";
  // Orden del visor (DR30): agrupado por sección con nombre (o área / tipo sugeridos), «Fotos adicionales» al final.
  // Áreas comunes primero, después los tipos de habitación y «Fotos adicionales» al final (el orden interno de cada bloque se conserva).
  const rawGroups = groupPhotosBySections(photos).map((g) => ({
    ...g,
    kind: g.photos.some((p) => p.category === "room_type")
      ? ("room" as const)
      : g.title === DEFAULT_SECTION
        ? ("extra" as const)
        : g.title === PRESENTATION_LABEL
          ? ("presentation" as const)
          : ("common" as const),
  }));
  // «presentation» comparte lugar con las áreas comunes (el orden interno se conserva) pero lleva su propio título, sin rótulo «Área común».
  const kindRank = { presentation: 0, common: 0, room: 1, extra: 2 } as const;
  const groups = rawGroups
    .map((g, i) => ({ g, i }))
    .sort((a, b) => kindRank[a.g.kind] - kindRank[b.g.kind] || a.i - b.i)
    .map(({ g }) => g);
  const ordered = groups.flatMap((g) => g.photos);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function scrollToSection(index: number) {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-section-index="${index}"]`);
    el?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    el?.querySelector<HTMLElement>("h3")?.focus?.();
  }

  function openAt(index: number) {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) {
      lockScroll();
      setDialogOpen(true);
      dialog.showModal();
    }
    // Espera un frame para que el diálogo ya tenga layout antes de desplazar.
    requestAnimationFrame(() => {
      dialog.querySelector<HTMLElement>(`[data-photo-index="${index}"]`)?.scrollIntoView({ block: "start" });
    });
  }

  function openPhoto(photo: GalleryPhoto) {
    openAt(Math.max(0, ordered.indexOf(photo)));
  }

  const node: ReactNode = (
    <>
      <dialog
        ref={dialogRef}
        aria-label={`Fotos de ${name}`}
        onClose={() => {
          unlockScroll();
          setDialogOpen(false);
        }}
        onClick={(e) => {
          // Click en el fondo (el propio <dialog>, fuera del contenido) cierra.
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="m-auto max-h-[92vh] w-[min(960px,94vw)] overflow-hidden rounded-card bg-cream p-0 shadow-float backdrop:bg-forest-ink/70"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line bg-paper px-4 py-3">
          <p className="truncate text-sm font-bold text-ink">
            {name}, {total} fotos
          </p>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold text-forest-700 hover:bg-forest-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest"
          >
            <Icon name="close" className="text-lg" />
            Cerrar
          </button>
        </div>
        <div ref={scrollRef} className="max-h-[calc(92vh-56px)] overflow-y-auto p-3 sm:p-5">
          {groups.length > 1 && (
            <nav aria-label="Recorrido fotográfico" className="mb-6">
              <h2 className="mb-3 text-lg font-bold text-ink">Recorrido fotográfico</h2>
              <ul className="relative flex gap-3 overflow-x-auto pb-2">
                {groups.map((group, gi) => (
                  <li key={group.key} className="w-28 shrink-0 sm:w-36">
                    <button
                      type="button"
                      onClick={() => scrollToSection(gi)}
                      className="block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
                    >
                      <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-field bg-sand-200">
                        <Image src={group.photos[0].url} alt="" fill sizes="144px" className="object-cover" />
                      </span>
                      <span className="mt-1.5 block truncate text-sm font-semibold text-ink">{group.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <div className="space-y-8">
            {groups.map((group, gi) => (
              <section
                key={group.key}
                data-section-index={gi}
                aria-labelledby={`${uid}-sec-${gi}`}
                className="scroll-mt-2 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)] sm:gap-6"
              >
                <div>
                  {group.kind !== "extra" && group.kind !== "presentation" && (
                    <p className="mb-0.5 text-xs font-semibold text-forest-700">{group.kind === "room" ? "Habitación" : "Área común"}</p>
                  )}
                  <h3 id={`${uid}-sec-${gi}`} tabIndex={-1} className="text-base font-bold text-ink sm:text-lg">
                    {group.title}
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {group.photos.map((photo, pi) => {
                    const i = ordered.indexOf(photo);
                    // Una foto sola, o la impar final, ocupa el ancho de las dos columnas (como Airbnb).
                    const wide = group.photos.length % 2 === 1 && pi === group.photos.length - 1;
                    return (
                      <button
                        key={photo.url}
                        type="button"
                        data-photo-index={i}
                        onClick={() => setLightbox(i)}
                        aria-label={`Ampliar foto ${i + 1} de ${total}: ${group.title}`}
                        aria-haspopup="dialog"
                        className={`group relative aspect-[4/3] w-full scroll-mt-2 cursor-zoom-in overflow-hidden rounded-field bg-sand-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${wide ? "col-span-2" : ""}`}
                      >
                        <Image
                          src={photo.url}
                          alt={`${group.title}: foto ${i + 1} de ${total} de ${name}${place}`}
                          fill
                          sizes="(max-width: 640px) 47vw, 520px"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
                        />
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      </dialog>

      <PhotoLightbox
        photos={ordered}
        titles={groups.flatMap((g) => g.photos.map(() => g.title))}
        index={lightbox}
        onIndex={setLightbox}
        name={name}
        place={place}
      />
    </>
  );

  return { node, openAt, openPhoto, ordered, dialogOpen, total, place };
}

/**
 * Foto ampliada en un `<dialog>` modal flotante, encima del visor. ← → / botones / deslizar para pasar de a una (circular);
 * Esc o tocar el fondo cierra solo este modal y devuelve al visor. `index === null` = cerrado.
 */
function PhotoLightbox({
  photos,
  titles,
  index,
  onIndex,
  name,
  place,
}: {
  photos: GalleryPhoto[];
  titles: string[];
  index: number | null;
  onIndex: (i: number | null) => void;
  name: string;
  place: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const total = photos.length;
  const open = index !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function go(delta: 1 | -1) {
    if (index === null || total < 2) return;
    onIndex((index + delta + total) % total);
  }
  const swipe = useSwipe(go);
  const photo = index !== null ? photos[index] : null;
  const arrow =
    "absolute top-1/2 z-10 flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-paper/95 text-ink shadow-card hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest";

  return (
    <dialog
      ref={ref}
      aria-label={`Foto ampliada de ${name}`}
      onClose={() => onIndex(null)}
      onCancel={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          go(1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          go(-1);
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="m-auto h-dvh max-h-none w-screen max-w-none overflow-hidden bg-transparent p-0 backdrop:bg-forest-ink/90"
    >
      {photo && index !== null && (
        <div className="relative flex h-full w-full flex-col items-center justify-center px-3 py-14 sm:px-20" {...swipe} onClick={(e) => e.target === e.currentTarget && ref.current?.close()}>
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-4 py-3 text-white">
            <p className="min-w-0 truncate text-sm font-bold">
              {titles[index]} <span className="font-normal tabular-nums opacity-80">· {index + 1} / {total}</span>
            </p>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Cerrar foto ampliada"
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-paper/95 px-3.5 py-2 text-sm font-bold text-ink hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Icon name="close" className="text-lg" />
              Cerrar
            </button>
          </div>
          <div className="relative h-full w-full max-w-5xl">
            <Image
              key={photo.url}
              src={photo.url}
              alt={`${titles[index]}: foto ${index + 1} de ${total} de ${name}${place}`}
              fill
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="select-none object-contain"
              priority
            />
          </div>
          {total > 1 && (
            <>
              <button type="button" onClick={() => go(-1)} aria-label="Foto anterior" className={`${arrow} left-2 sm:left-5`}>
                <Icon name="chevron_left" className="text-2xl" />
              </button>
              <button type="button" onClick={() => go(1)} aria-label="Foto siguiente" className={`${arrow} right-2 sm:right-5`}>
                <Icon name="chevron_right" className="text-2xl" />
              </button>
            </>
          )}
        </div>
      )}
    </dialog>
  );
}
