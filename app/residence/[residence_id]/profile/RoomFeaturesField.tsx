"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ROOM_FEATURE_OPTIONS } from "@/lib/residences/options";
import {
  ROOM_FEATURE_OTHER_MAX_CHARS,
  ROOM_FEATURE_OTHER_MAX_WORDS,
  joinRoomFeatures,
  normalizeCustomRoomFeature,
  splitRoomFeatures,
  validateCustomRoomFeature,
} from "@/lib/residences/roomFeatures";
import { Input } from "@/components/ui/Input";

/**
 * Características de un tipo de habitación: las de la lista como casillas y «Otro» con un campo de hasta 2 palabras. El valor sigue
 * siendo `features: string[]` (la propia va al final, normalizada). La validación en vivo bloquea el envío del formulario con un mensaje
 * del navegador (`setCustomValidity`); la que vale es la del servidor (`sanitizeRoomFeatures`).
 */
export function RoomFeaturesField({ features, onChange }: { features: string[]; onChange: (next: string[]) => void }) {
  const { listed, custom } = splitRoomFeatures(features);
  const [otherOpen, setOtherOpen] = useState(custom !== null);
  const [text, setText] = useState(custom ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const errorId = useId();

  // Si el valor cambió desde afuera (se restauró un borrador), el campo lo sigue; mientras se escribe, `text` conserva lo tipeado tal cual.
  if (normalizeCustomRoomFeature(text) !== (custom ?? "")) setText(custom ?? "");

  const showOther = otherOpen || custom !== null;
  const check = text.trim() !== "" ? validateCustomRoomFeature(text) : null;
  const error = check && !check.ok ? check.error : null;

  useEffect(() => {
    inputRef.current?.setCustomValidity(error ?? "");
  }, [error, showOther]);

  function toggleListed(feature: string) {
    const next = listed.includes(feature) ? listed.filter((f) => f !== feature) : [...listed, feature];
    onChange(joinRoomFeatures(next, custom));
  }

  function toggleOther(checked: boolean) {
    setOtherOpen(checked);
    if (!checked) {
      setText("");
      onChange(listed);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-sm font-medium text-ink">Características</span>
        {ROOM_FEATURE_OPTIONS.map((f) => (
          <label key={f} className="max-lg:min-h-11 flex items-center gap-1.5 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={listed.includes(f)}
              onChange={() => toggleListed(f)}
              className="h-4 w-4 max-lg:size-5! accent-forest"
            />
            {f}
          </label>
        ))}
        <label className="max-lg:min-h-11 flex items-center gap-1.5 text-sm text-ink-soft">
          <input type="checkbox" checked={showOther} onChange={(e) => toggleOther(e.target.checked)} className="h-4 w-4 max-lg:size-5! accent-forest" />
          Otro
        </label>
      </div>
      {showOther && (
        <div className="mt-2 max-w-xs">
          <Input
            label="Otra característica"
            ref={inputRef}
            id={inputId}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onChange(joinRoomFeatures(listed, e.target.value));
            }}
            onKeyDown={(e) => {
              // Enter en este campo no debe enviar el formulario de la configuración.
              if (e.key === "Enter") e.preventDefault();
            }}
            maxLength={ROOM_FEATURE_OTHER_MAX_CHARS}
            placeholder="Ej: Aire acondicionado"
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
          />
          <p id={errorId} role={error ? "alert" : undefined} className={`mt-1 text-xs ${error ? "font-medium text-danger-fg" : "text-muted"}`}>
            {error ?? `Hasta ${ROOM_FEATURE_OTHER_MAX_WORDS} palabras.`}
          </p>
        </div>
      )}
    </div>
  );
}
