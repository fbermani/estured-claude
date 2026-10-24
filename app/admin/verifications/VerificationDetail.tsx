"use client";

import { formatDate } from "@/lib/dates/format";
import Image from "next/image";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { DocumentAccessButton } from "@/components/admin/ui/DocumentAccessButton";
import { cmd } from "@/components/admin/ui/tokens";
import { reviewResidence, type ReviewState } from "@/app/admin/verifications/actions";
import { ResidencePhotoPlaceholder } from "@/components/residences/ResidencePhoto";
import { MIN_PUBLISH_PHOTOS, hasEnoughPhotosToPublish } from "@/lib/residences/photos";
import { CHANGES_MESSAGE_MAX, CHANGES_MESSAGE_MIN } from "@/lib/residences/changesRequest";
import { isActionableStatus, type ReviewAction } from "@/lib/residences/verificationReview";

interface Verification {
  status: string;
  responsible_identity_checked: boolean;
  coordinator_identity_checked: boolean;
  address_checked: boolean;
  photos_match_reality: boolean;
  notes_internal: string | null;
  /** Migración 0048: mensaje que ve la residencia al pedirle cambios (puede faltar si la 0048 no está aplicada). */
  changes_requested_message?: string | null;
  visited_at: string | null;
  scheduled_at: string | null;
}

interface Residence {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  public_area: string | null;
  address_line: string | null;
  responsible_name: string;
  responsible_contact: string;
  created_at: string;
}

const initialState: ReviewState = { status: "idle" };

export function VerificationDetail({
  residence,
  verification,
  services,
  nearUniversities,
  rulesSummary,
  roomTypes,
  photoUrls,
  approvedPhotoCount,
  rulesFile,
  resubmittedAt,
  residenceStatus,
}: {
  residence: Residence;
  verification: Verification;
  services: string[];
  nearUniversities: string[];
  rulesSummary: string;
  roomTypes: { name: string; priceUsd: number; availableCount: number }[];
  photoUrls: string[];
  /** Fotos propias aprobadas: las que cuentan para el mínimo de publicación. */
  approvedPhotoCount: number | null;
  rulesFile: { id: string; filename: string; sizeKb: number } | null;
  /** Fecha en que la residencia reenvió el perfil tras pedirle cambios (audit log); null si no aplica. */
  resubmittedAt?: string | null;
  /** Estado actual de la residencia: define si el admin todavía puede decidir (DR7). */
  residenceStatus: string;
}) {
  const action = reviewResidence.bind(null, residence.id);
  const [state, formAction] = useActionState(action, initialState);

  // Campos controlados: si la acción devuelve un error de validación, lo escrito no se pierde (el form se resetea).
  const [checks, setChecks] = useState({
    responsible_identity_checked: verification.responsible_identity_checked,
    coordinator_identity_checked: verification.coordinator_identity_checked,
    address_checked: verification.address_checked,
    photos_match_reality: verification.photos_match_reality,
  });
  const [visitedAt, setVisitedAt] = useState(verification.visited_at?.slice(0, 10) ?? "");
  const [scheduledAt, setScheduledAt] = useState(verification.scheduled_at?.slice(0, 10) ?? "");
  const [notes, setNotes] = useState(verification.notes_internal ?? "");
  const [changesMessage, setChangesMessage] = useState(
    verification.status === "needs_changes" ? (verification.changes_requested_message ?? "") : "",
  );
  // Confirmación de aprobar/rechazar: se muestra hasta que la acción devuelve un nuevo estado.
  const [confirming, setConfirming] = useState<{ action: "approve" | "reject"; forState: ReviewState } | null>(null);
  const confirmAction = confirming && confirming.forState === state ? confirming.action : null;
  const canDecide = isActionableStatus(residenceStatus);
  const isExpired = residenceStatus === "verification_expired";
  const isWaiting = residenceStatus === "needs_changes";

  return (
    <form
      action={formAction}
      className="max-w-4xl space-y-6"
      // Enter en un campo de una línea no debe disparar una decisión (el primer botón de envío).
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement && e.target.type !== "checkbox") e.preventDefault();
      }}
    >
      <AdminCard className="p-6">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.primary }}>
          Verificación de residencia
        </p>
        <h1 className="mt-1 text-2xl font-bold" style={{ color: cmd.onSurface }}>
          {residence.name}
        </h1>
        <p className="mt-1 text-sm" style={{ color: cmd.onSurfaceVariant }}>
          {residence.address_line} — {residence.public_area}, CABA · Registrada el{" "}
          {formatDate(residence.created_at)}
        </p>
        <p className="mt-2 text-sm" style={{ color: cmd.onSurfaceVariant }}>
          Responsable: <strong>{residence.responsible_name}</strong> · {residence.responsible_contact}
        </p>
        {resubmittedAt && (
          <p className="mt-3">
            <AdminBadge tone="violet">Reenviada para revisión · {formatDate(resubmittedAt)}</AdminBadge>
          </p>
        )}
        {isExpired && (
          <p className="mt-3">
            <AdminBadge tone="rose">Verificación vencida: hace falta una nueva visita</AdminBadge>
          </p>
        )}
        {residence.tagline && (
          <p className="mt-2 text-sm italic" style={{ color: cmd.outline }}>
            &ldquo;{residence.tagline}&rdquo;
          </p>
        )}
      </AdminCard>

      <AdminCard className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold" style={{ color: cmd.onSurface }}>
            Galería de propiedad ({photoUrls.length})
          </h2>
          <AdminBadge tone={approvedPhotoCount !== null && hasEnoughPhotosToPublish(approvedPhotoCount) ? "emerald" : "amber"}>
            {approvedPhotoCount === null
              ? "No pudimos contar las fotos"
              : `Fotos propias: ${approvedPhotoCount} de ${MIN_PUBLISH_PHOTOS} necesarias`}
          </AdminBadge>
        </div>
        {photoUrls.length > 0 ? (
          <div className="mt-3 grid grid-cols-3 gap-3">
            {photoUrls.map((url) => (
              <div key={url} className="relative aspect-video overflow-hidden rounded" style={{ border: `1px solid ${cmd.border}` }}>
                <Image src={url} alt="Foto de la residencia" fill sizes="200px" className="object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-4">
            <div className="relative h-24 w-40 shrink-0 overflow-hidden rounded" style={{ border: `1px solid ${cmd.border}` }}>
              <ResidencePhotoPlaceholder name={residence.name} zone={residence.public_area ?? undefined} variant="card" />
            </div>
            <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
              {approvedPhotoCount === null
                ? "No pudimos leer las fotos de la residencia. Recargá la página antes de decidir."
                : `La residencia todavía no cargó fotos. No se puede aprobar hasta que tenga al menos ${MIN_PUBLISH_PHOTOS}.`}
            </p>
          </div>
        )}
        {photoUrls.length > 0 && approvedPhotoCount !== null && !hasEnoughPhotosToPublish(approvedPhotoCount) && (
          <p className="mt-3 text-sm" style={{ color: cmd.amber }}>
            Faltan fotos propias para poder aprobar: hacen falta al menos {MIN_PUBLISH_PHOTOS}.
          </p>
        )}
      </AdminCard>

      <div className="grid grid-cols-2 gap-6">
        <AdminCard className="p-6">
          <h2 className="text-sm font-bold" style={{ color: cmd.onSurface }}>
            Tipos de habitación
          </h2>
          {roomTypes.length === 0 ? (
            <p className="mt-2 text-sm" style={{ color: cmd.outline }}>
              Sin tipos cargados.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {roomTypes.map((rt) => (
                <li key={rt.name} className="flex items-center justify-between text-sm">
                  <span style={{ color: cmd.onSurfaceVariant }}>
                    {rt.name} · {rt.availableCount} disponibles
                  </span>
                  <span className="font-bold" style={{ color: cmd.onSurface }}>
                    USD {rt.priceUsd}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {services.length > 0 && (
            <>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
                Servicios
              </p>
              <p className="mt-1 text-sm" style={{ color: cmd.onSurfaceVariant }}>
                {services.join(" · ")}
              </p>
            </>
          )}
        </AdminCard>

        <AdminCard className="p-6">
          <h2 className="text-sm font-bold" style={{ color: cmd.onSurface }}>
            Entorno académico
          </h2>
          {nearUniversities.length === 0 ? (
            <p className="mt-2 text-sm" style={{ color: cmd.outline }}>
              Sin universidades declaradas.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm" style={{ color: cmd.onSurfaceVariant }}>
              {nearUniversities.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
            Documentación
          </p>
          {rulesFile ? (
            <div className="mt-1">
              <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
                📄 {rulesFile.filename} · {rulesFile.sizeKb} KB
              </p>
              <DocumentAccessButton fileId={rulesFile.id} label="Ver reglamento →" />
            </div>
          ) : (
            <p className="mt-1 text-sm" style={{ color: cmd.outline }}>
              No se cargó reglamento en PDF.
            </p>
          )}
          {rulesSummary && (
            <>
              <p className="mt-4 text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
                Resumen de normas
              </p>
              <p className="mt-1 text-sm" style={{ color: cmd.onSurfaceVariant }}>
                {rulesSummary}
              </p>
            </>
          )}
        </AdminCard>
      </div>

      <AdminCard className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold" style={{ color: cmd.onSurface }}>
            Checklist de verificación presencial
          </h2>
          <AdminBadge tone="amber">Datos sensibles</AdminBadge>
        </div>
        <p className="mt-1 text-xs" style={{ color: cmd.outline }}>
          Completá esto después de la visita presencial a la residencia.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {(
            [
              { name: "responsible_identity_checked", label: "Identidad del responsable verificada (DNI)" },
              { name: "coordinator_identity_checked", label: "Identidad del coordinador verificada (si aplica)" },
              { name: "address_checked", label: "Dirección comprobada in situ" },
              { name: "photos_match_reality", label: "Fotos coinciden con la realidad" },
            ] as const
          ).map((c) => (
            <label key={c.name} className="flex items-center gap-2 text-sm" style={{ color: cmd.onSurfaceVariant }}>
              <input
                type="checkbox"
                name={c.name}
                checked={checks[c.name]}
                onChange={(e) => setChecks((prev) => ({ ...prev, [c.name]: e.target.checked }))}
                className="h-4 w-4"
                style={{ accentColor: cmd.primary }}
              />
              {c.label}
            </label>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="scheduled_at" className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
              Visita programada para
            </label>
            <input
              id="scheduled_at"
              type="date"
              name="scheduled_at"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="mt-1 w-full rounded px-3 py-2 text-sm"
              style={{ border: `1px solid ${cmd.outline}` }}
            />
            <p className="mt-1 text-xs" style={{ color: cmd.outline }}>
              Solo para &ldquo;Programar visita&rdquo;. La residencia ve la fecha en su panel.
            </p>
          </div>
          <div>
            <label htmlFor="visited_at" className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
              Fecha de la visita realizada
            </label>
            <input
              id="visited_at"
              type="date"
              name="visited_at"
              value={visitedAt}
              onChange={(e) => setVisitedAt(e.target.value)}
              className="mt-1 w-full rounded px-3 py-2 text-sm"
              style={{ border: `1px solid ${cmd.outline}` }}
            />
            <p className="mt-1 text-xs" style={{ color: cmd.outline }}>
              Obligatoria para aprobar: la verificación presencial no se puede saltear.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="notes_internal" className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
            Notas internas / motivo
          </label>
          <textarea
            id="notes_internal"
            name="notes_internal"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Obligatorio si rechazás. Es interno: la residencia no lo ve."
            className="mt-1 w-full rounded px-3 py-2 text-sm"
            style={{ border: `1px solid ${cmd.outline}` }}
          />
        </div>

        <div className="mt-4">
          <label htmlFor="changes_message" className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
            Mensaje para la residencia
          </label>
          <textarea
            id="changes_message"
            name="changes_message"
            rows={4}
            maxLength={CHANGES_MESSAGE_MAX}
            value={changesMessage}
            onChange={(e) => setChangesMessage(e.target.value)}
            placeholder={`Obligatorio al pedir cambios (${CHANGES_MESSAGE_MIN} a ${CHANGES_MESSAGE_MAX} caracteres). La residencia lo ve en su panel: decile qué corregir.`}
            className="mt-1 w-full rounded px-3 py-2 text-sm"
            style={{ border: `1px solid ${cmd.outline}` }}
          />
          <p className="mt-1 text-xs" style={{ color: cmd.outline }}>
            Solo se usa al pedir cambios (y ahí no se guarda el checklist). No es una nota interna: la residencia lo lee.
          </p>
        </div>

        {state.status === "error" && (
          <p role="alert" className="mt-3 rounded px-3 py-2 text-sm font-medium" style={{ backgroundColor: cmd.roseBg, color: cmd.rose }}>
            {state.message}
          </p>
        )}
        {state.status === "saved" && (
          <p role="status" className="mt-3 rounded px-3 py-2 text-sm font-medium" style={{ backgroundColor: cmd.emeraldBg, color: cmd.emerald }}>
            {state.message}
          </p>
        )}

        {!canDecide ? (
          <p className="mt-5 text-sm" style={{ color: cmd.outline }}>
            Esta residencia ya no está pendiente de verificación: no se puede decidir desde acá.
          </p>
        ) : confirmAction ? (
          <div
            className="mt-5 rounded p-4"
            style={{ border: `1px solid ${confirmAction === "approve" ? cmd.emerald : cmd.rose}`, backgroundColor: cmd.surface }}
          >
            <input type="hidden" name="confirmed" value="1" />
            <p className="text-sm font-bold" style={{ color: cmd.onSurface }}>
              {confirmAction === "approve" ? "¿Aprobar y publicar esta residencia?" : "¿Rechazar esta residencia?"}
            </p>
            <p className="mt-1 text-sm" style={{ color: cmd.onSurfaceVariant }}>
              {confirmAction === "approve"
                ? "Se publica la residencia en el catálogo y le avisamos al equipo de la residencia. Quedan registradas la fecha de la visita y el checklist."
                : "Se suspende la residencia y no podrá reenviarla: va a tener que consultar por Soporte. Le avisamos al equipo de la residencia (sin el motivo, que es interno)."}
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <AdminButton type="button" variant="ghost" onClick={() => setConfirming(null)}>
                Volver
              </AdminButton>
              {confirmAction === "approve" ? (
                <ActionButton action="approve" variant="primary" label="Sí, aprobar y publicar" />
              ) : (
                <ActionButton action="reject" variant="danger" label="Sí, rechazar" />
              )}
            </div>
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap justify-end gap-3">
            {isWaiting ? (
              <p className="mr-auto self-center text-sm" style={{ color: cmd.outline }}>
                Esperando que la residencia corrija y reenvíe. Mientras tanto solo podés rechazarla.
              </p>
            ) : (
              <>
                <ActionButton action="schedule" variant="secondary" label="Programar visita" />
                <ActionButton action="needs_changes" variant="secondary" label="Pedir cambios" />
              </>
            )}
            <AdminButton type="button" variant="danger" onClick={() => setConfirming({ action: "reject", forState: state })}>
              Rechazar
            </AdminButton>
            {!isWaiting && (
              <AdminButton type="button" variant="primary" onClick={() => setConfirming({ action: "approve", forState: state })}>
                Aprobar y publicar
              </AdminButton>
            )}
          </div>
        )}
      </AdminCard>
    </form>
  );
}

function ActionButton({
  action,
  variant,
  label,
}: {
  action: ReviewAction;
  variant: "primary" | "secondary" | "danger";
  label: string;
}) {
  const { pending, data } = useFormStatus();
  const isThisPending = pending && data?.get("action") === action;
  return (
    <AdminButton type="submit" name="action" value={action} variant={variant} disabled={pending}>
      {isThisPending ? "Guardando…" : label}
    </AdminButton>
  );
}
