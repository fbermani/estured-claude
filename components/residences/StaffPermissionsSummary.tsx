import { Icon } from "@/components/ui/Icon";
import { STAFF_PERMISSIONS, type PermissionMap } from "@/lib/residences/permissions";

/**
 * "Tus permisos" (DR11): resumen discreto, solo para el staff, de qué puede hacer hoy en esta residencia. Colapsado por defecto. No es la
 * gestión del equipo (esa es solo del dueño): solo informa. Los permisos salen de `residence_users.permissions`, resueltos en el servidor.
 */
export function StaffPermissionsSummary({ permissions }: { permissions: PermissionMap }) {
  const enabled = STAFF_PERMISSIONS.filter((p) => permissions[p.key]).length;
  return (
    <details className="mt-6 rounded-card border-[1.5px] border-line bg-paper p-4 sm:p-5">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-bold text-ink">
        <Icon name="key" className="text-lg text-ink-soft" />
        Tus permisos
        <span className="font-medium text-ink-soft">
          ({enabled} de {STAFF_PERMISSIONS.length} activos)
        </span>
      </summary>
      <p className="mt-3 text-sm text-ink-soft">
        El dueño de la residencia decide qué podés hacer. Lo demás lo ves en solo lectura. Podés ver el panel, abrir un caso de Soporte y
        recibir avisos siempre. Si necesitás un permiso, pedíselo al dueño.
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {STAFF_PERMISSIONS.map((p) => {
          const on = permissions[p.key];
          return (
            <li key={p.key} className={`flex items-start gap-2 text-sm ${on ? "text-ink" : "text-ink-faint"}`}>
              <Icon name={on ? "check_circle" : "block"} className={`mt-0.5 shrink-0 text-base ${on ? "text-success-fg" : "text-ink-faint"}`} />
              <span className="min-w-0">
                {p.label}
                <span className="sr-only">{on ? " (permitido)" : " (sin permiso)"}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
