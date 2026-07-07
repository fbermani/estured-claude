"use client";

import Image from "next/image";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminBadge } from "@/components/admin/ui/AdminBadge";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { cmd } from "@/components/admin/ui/tokens";
import { reviewResidence, type ReviewState } from "@/app/admin/verifications/actions";

interface Verification {
  status: string;
  responsible_identity_checked: boolean;
  coordinator_identity_checked: boolean;
  address_checked: boolean;
  photos_match_reality: boolean;
  notes_internal: string | null;
  visited_at: string | null;
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
  rulesFile,
}: {
  residence: Residence;
  verification: Verification;
  services: string[];
  nearUniversities: string[];
  rulesSummary: string;
  roomTypes: { name: string; priceUsd: number; availableCount: number }[];
  photoUrls: string[];
  rulesFile: { filename: string; sizeKb: number; signedUrl: string | null } | null;
}) {
  const action = reviewResidence.bind(null, residence.id);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="max-w-4xl space-y-6">
      <AdminCard className="p-6">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.primary }}>
          Residencias / Validación
        </p>
        <h1 className="mt-1 text-2xl font-bold" style={{ color: cmd.onSurface }}>
          {residence.name}
        </h1>
        <p className="mt-1 text-sm" style={{ color: cmd.onSurfaceVariant }}>
          {residence.address_line} — {residence.public_area}, CABA · Registrada el{" "}
          {new Date(residence.created_at).toLocaleDateString("es-AR")}
        </p>
        <p className="mt-2 text-sm" style={{ color: cmd.onSurfaceVariant }}>
          Responsable: <strong>{residence.responsible_name}</strong> · {residence.responsible_contact}
        </p>
        {residence.tagline && (
          <p className="mt-2 text-sm italic" style={{ color: cmd.outline }}>
            &ldquo;{residence.tagline}&rdquo;
          </p>
        )}
      </AdminCard>

      {photoUrls.length > 0 && (
        <AdminCard className="p-6">
          <h2 className="text-sm font-bold" style={{ color: cmd.onSurface }}>
            Galería de propiedad ({photoUrls.length})
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {photoUrls.map((url) => (
              <div key={url} className="relative aspect-video overflow-hidden rounded" style={{ border: `1px solid ${cmd.border}` }}>
                <Image src={url} alt="Foto de la residencia" fill className="object-cover" />
              </div>
            ))}
          </div>
        </AdminCard>
      )}

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
            rulesFile.signedUrl ? (
              <a
                href={rulesFile.signedUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 flex items-center gap-2 text-sm font-semibold"
                style={{ color: cmd.primary }}
              >
                📄 {rulesFile.filename} · {rulesFile.sizeKb} KB
              </a>
            ) : (
              <p className="mt-1 text-sm" style={{ color: cmd.outline }}>
                {rulesFile.filename} (no se pudo generar el link)
              </p>
            )
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
          {[
            { name: "responsible_identity_checked", label: "Identidad del responsable verificada (DNI)" },
            { name: "coordinator_identity_checked", label: "Identidad del coordinador verificada (si aplica)" },
            { name: "address_checked", label: "Dirección comprobada in situ" },
            { name: "photos_match_reality", label: "Fotos coinciden con la realidad" },
          ].map((c) => (
            <label key={c.name} className="flex items-center gap-2 text-sm" style={{ color: cmd.onSurfaceVariant }}>
              <input
                type="checkbox"
                name={c.name}
                defaultChecked={verification[c.name as keyof Verification] as boolean}
                className="h-4 w-4"
                style={{ accentColor: cmd.primary }}
              />
              {c.label}
            </label>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
              Fecha de visita
            </label>
            <input
              type="date"
              name="visited_at"
              defaultValue={verification.visited_at?.slice(0, 10) ?? ""}
              className="mt-1 w-full rounded px-3 py-2 text-sm"
              style={{ border: `1px solid ${cmd.outline}` }}
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
            Notas internas / motivo
          </label>
          <textarea
            name="notes_internal"
            rows={3}
            defaultValue={verification.notes_internal ?? ""}
            placeholder="Obligatorio si pedís cambios o rechazás. Nunca es visible para el estudiante."
            className="mt-1 w-full rounded px-3 py-2 text-sm"
            style={{ border: `1px solid ${cmd.outline}` }}
          />
        </div>

        {state.status === "error" && (
          <p className="mt-3 rounded px-3 py-2 text-sm font-medium" style={{ backgroundColor: cmd.roseBg, color: cmd.rose }}>
            {state.message}
          </p>
        )}
        {state.status === "saved" && (
          <p className="mt-3 rounded px-3 py-2 text-sm font-medium" style={{ backgroundColor: cmd.emeraldBg, color: cmd.emerald }}>
            {state.message}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <ActionButton action="needs_changes" variant="secondary" label="Pedir cambios" />
          <ActionButton action="reject" variant="danger" label="Rechazar" />
          <ActionButton action="approve" variant="primary" label="Aprobar y publicar" />
        </div>
      </AdminCard>
    </form>
  );
}

function ActionButton({
  action,
  variant,
  label,
}: {
  action: "approve" | "needs_changes" | "reject";
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
