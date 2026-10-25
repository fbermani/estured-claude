"use client";

import { useId } from "react";
import {
  PERMISSION_PRESETS,
  STAFF_PERMISSION_GROUPS,
  STAFF_PERMISSIONS,
  presetPermissions,
  type PermissionMap,
} from "@/lib/residences/permissions";

/**
 * Casilleros de permisos del staff (DR11), agrupados y con su descripción. Controlado: lo que tilda el dueño se conserva ante un error.
 * Cada casillero es un `<input type="checkbox" name="permission" value="clave">` nativo (el servidor lee `getAll("permission")` y reduce a
 * claves conocidas). Los atajos son botones `type="button"` que rellenan los casilleros SIN enviar el formulario.
 */
export function PermissionChecklist({
  value,
  onChange,
  disabled,
}: {
  value: PermissionMap;
  onChange: (next: PermissionMap) => void;
  disabled?: boolean;
}) {
  const uid = useId();
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted">Atajos</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PERMISSION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.description}
              disabled={disabled}
              onClick={() => onChange(presetPermissions(preset.id))}
              className="rounded-full border-[1.5px] border-line-2 bg-paper px-3.5 py-1.5 text-xs font-bold text-ink transition-colors hover:border-forest hover:bg-forest-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:opacity-50"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-ink-faint">Los atajos solo rellenan los casilleros: después podés ajustarlos y guardar.</p>
      </div>

      {STAFF_PERMISSION_GROUPS.map((group) => (
        <fieldset key={group.id} className="min-w-0 space-y-2 border-0 p-0" disabled={disabled}>
          <legend className="mb-1 text-sm font-bold text-ink">{group.label}</legend>
          {STAFF_PERMISSIONS.filter((p) => p.group === group.id).map((p) => {
            const id = `${uid}-${p.key}`;
            return (
              <label
                key={p.key}
                htmlFor={id}
                className="flex cursor-pointer items-start gap-3 rounded-field border border-line bg-paper px-3 py-2.5 has-[:checked]:border-forest/40 has-[:checked]:bg-forest-tint/40"
              >
                <input
                  id={id}
                  type="checkbox"
                  name="permission"
                  value={p.key}
                  checked={value[p.key]}
                  onChange={(event) => onChange({ ...value, [p.key]: event.target.checked })}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--color-forest)]"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{p.label}</span>
                  <span className="block text-xs text-ink-soft">{p.description}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}
