/**
 * Agrupa eventos de auditoría CONSECUTIVOS idénticos (mismo actor y misma
 * acción) para el feed del dashboard admin (UX09 / H17): 8 líneas «Estudiante
 * se registró…» pasan a «Estudiante se registró… ×8». Solo agrupa vecinos
 * (el feed viene ordenado por fecha desc), así no reordena ni oculta eventos
 * intermedios. `latest` es la fecha del más reciente del grupo; `oldest`, la
 * del más antiguo.
 */
export type ActivityEvent = { id: string; action: string; created_at: string; actor_role: string };
export type ActivityGroup = { id: string; action: string; actor_role: string; count: number; latest: string; oldest: string };

export function groupConsecutiveActivity(events: ActivityEvent[]): ActivityGroup[] {
  const groups: ActivityGroup[] = [];
  for (const e of events) {
    const last = groups[groups.length - 1];
    if (last && last.action === e.action && last.actor_role === e.actor_role) {
      last.count += 1;
      last.oldest = e.created_at;
    } else {
      groups.push({ id: e.id, action: e.action, actor_role: e.actor_role, count: 1, latest: e.created_at, oldest: e.created_at });
    }
  }
  return groups;
}
