import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { StatusTag } from "@/components/ui/StatusTag";
import { isTypePaused, isTypeRequestable } from "@/lib/availability/typeAvailability";
import type { ReservationWindowNotice } from "@/lib/students/reservationWindow";
import type { RequestPanelMode } from "@/lib/residences/requestPanelMode";
import type { FichaRoomType } from "@/components/residences/ficha/types";

/**
 * Avisos que acompañan a la tabla de tarifas ahora que la solicitud vive en un modal (DR30 §6): lo que antes
 * mostraba el panel lateral según el rol (invitado, menor sin familiar, equipo, etc.), el aviso de reserva
 * vigente y los estados de disponibilidad del conjunto de tipos. No tiene CTAs propios para estudiantes y
 * familiares: «Elegir» en la tabla abre el modal.
 */
export function RequestNotices({
  mode,
  roomTypes,
  slot,
  windowNotice,
  studentName,
}: {
  mode: RequestPanelMode;
  roomTypes: FichaRoomType[];
  /** Contenido del servidor para los modos sin acción interactiva (favoritos del familiar, vista previa del equipo…). */
  slot: ReactNode;
  windowNotice: ReservationWindowNotice | null;
  studentName: string | null;
}) {
  const requestable = roomTypes.filter((rt) => isTypeRequestable(rt.state));
  const allFull = roomTypes.length > 0 && roomTypes.every((rt) => rt.state === "full");
  const allPaused = roomTypes.length > 0 && roomTypes.every((rt) => isTypePaused(rt.state));
  const notUpdated = requestable.length > 0 && requestable.every((rt) => rt.state === "not_updated");
  const box = "rounded-field bg-sand-100 px-3.5 py-2.5 text-xs leading-relaxed text-ink-soft";

  return (
    <div className="space-y-3 empty:hidden">
      {mode === "guest" && roomTypes.length > 0 && (
        <p className={box}>
          Para elegir una habitación te pedimos que ingreses con tu cuenta de estudiante: volvés acá con tu elección
          guardada.{" "}
          <Link href="/register/student" className="font-bold text-forest-700 hover:underline">
            Crear cuenta de estudiante
          </Link>
        </p>
      )}
      {mode === "student" && windowNotice && windowNotice.stayChangeOpen && (
        <div className="rounded-field border border-orange/30 bg-warning-bg px-3.5 py-3 text-xs leading-relaxed text-warning-fg">
          <p className="flex items-start gap-2">
            <Icon name="swap_horiz" className="mt-0.5 shrink-0 text-base" />
            <span>
              <strong>Estás buscando cambiar de residencia;</strong> tu residencia actual fue avisada. Podés enviar tu solicitud de reserva para cualquier fecha,
              aunque se superponga con tu estadía.
            </span>
          </p>
          <Link href="/students/residency#quiero-cambiar" className="mt-1.5 inline-block font-bold underline underline-offset-2">
            Ir a Mi residencia
          </Link>
        </div>
      )}
      {mode === "student" && windowNotice && !windowNotice.stayChangeOpen && (
        <div className="space-y-2">
          <p className="flex items-start gap-2 rounded-field bg-info-bg px-3.5 py-2.5 text-xs leading-relaxed text-info-fg">
            <Icon name="event_available" className="mt-0.5 shrink-0 text-base" />
            <span>
              {windowNotice.message}{" "}
              <Link href="/students/residency" className="font-bold underline underline-offset-2">
                Ir a Mi residencia
              </Link>
            </span>
          </p>
          <p className="flex items-center gap-1.5 px-1 text-xs text-ink-soft">
            <Icon name="swap_horiz" className="text-base text-orange-700" />
            ¿Querés mudarte antes?{" "}
            <Link href="/students/residency#quiero-cambiar" className="font-bold text-forest-700 hover:underline">
              Quiero cambiar de residencia
            </Link>
          </p>
        </div>
      )}
      {allFull && (
        <div className="space-y-1.5">
          <StatusTag mode="full" withTip />
          <p className="text-xs leading-relaxed text-ink-soft">
            Sumarte a la lista de espera no es una solicitud ni reserva un lugar.
          </p>
        </div>
      )}
      {allPaused && (
        <p className={box}>
          Las solicitudes de esta residencia están pausadas por ahora. Volvé a mirar más adelante o explorá otras
          residencias.
        </p>
      )}
      {notUpdated && (
        <p className={box}>
          La residencia no actualizó su disponibilidad. Podés enviar tu solicitud de reserva igual, pero no te asegura el lugar.
        </p>
      )}
      {mode === "family" && (
        <p className="text-xs leading-relaxed text-ink-faint">
          Una propuesta no es una solicitud: {studentName ?? "tu estudiante"} la ve en su panel y decide si la envía.
        </p>
      )}
      {mode !== "guest" && mode !== "student" && slot ? (
        <div className="rounded-card border-[1.5px] border-line bg-paper p-5 shadow-card">{slot}</div>
      ) : null}
    </div>
  );
}
