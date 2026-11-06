"use client";

import { formatDateTime } from "@/lib/dates/format";
import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { DocumentAccessButton } from "@/components/admin/ui/DocumentAccessButton";
import { cmd } from "@/components/admin/ui/tokens";
import { reviewProfileEdit, type ProfileEditReviewState } from "@/app/admin/profile-edits/actions";

const FIELD_GROUP_LABELS: Record<string, string> = {
  photos: "Fotos",
  services: "Servicios",
  rules: "Reglas y reglamento",
  minimum_stay_months: "Mínimo de estadía",
  room_types: "Tipos de habitación",
};

interface RoomTypeSnapshot {
  id?: string;
  name?: string;
  genderPolicy?: string;
  bathroomType?: string;
  features?: string[];
  roomCount?: number;
  capacityPerRoom?: number;
  monthlyPriceUsd?: number;
}

const initialState: ProfileEditReviewState = { status: "idle" };

export function ProfileEditDetail({
  id,
  residenceId,
  residenceName,
  residenceZone,
  fieldGroup,
  oldValue,
  newValue,
  submittedByEmail,
  createdAt,
  photoUrls,
  rulesFileId,
}: {
  id: string;
  residenceId: string;
  residenceName: string;
  residenceZone: string | null;
  fieldGroup: string;
  oldValue: unknown;
  newValue: unknown;
  submittedByEmail: string | null;
  createdAt: string;
  photoUrls: string[];
  rulesFileId: string | null;
}) {
  const action = reviewProfileEdit.bind(null, id);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      <AdminCard className="p-6">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.primary }}>
          Residencias / Ediciones de perfil
        </p>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ color: cmd.onSurface }}>
            {residenceName}
          </h1>
          <Link href={`/residence/${residenceId}`} className="text-xs font-bold underline" style={{ color: cmd.primary }}>
            Ver panel de la residencia →
          </Link>
        </div>
        <p className="mt-1 text-sm" style={{ color: cmd.onSurfaceVariant }}>
          {residenceZone ?? "Zona sin definir"} · campo: <strong>{FIELD_GROUP_LABELS[fieldGroup] ?? fieldGroup}</strong>
        </p>
        <p className="mt-1 text-xs" style={{ color: cmd.outline }}>
          Enviado por {submittedByEmail ?? "—"} el {formatDateTime(createdAt)}
        </p>
      </AdminCard>

      <AdminCard className="p-6">
        <h2 className="text-sm font-bold" style={{ color: cmd.onSurface }}>
          Qué cambió
        </h2>
        <div className="mt-4">
          <FieldGroupDiff
            fieldGroup={fieldGroup}
            oldValue={oldValue}
            newValue={newValue}
            photoUrls={photoUrls}
            rulesFileId={rulesFileId}
          />
        </div>
      </AdminCard>

      <AdminCard className="p-6">
        <label className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
          Notas de revisión
        </label>
        <textarea
          name="review_notes"
          rows={3}
          placeholder="Obligatorio si rechazás o pedís corrección. La residencia lo ve como motivo."
          className="mt-1 w-full rounded px-3 py-2 text-sm"
          style={{ border: `1px solid ${cmd.outline}` }}
        />

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

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <ActionButton action="needs_changes" variant="secondary" label="Pedir corrección" />
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
    <AdminButton type="submit" name="action" value={action} variant={variant} disabled={pending} className="whitespace-nowrap">
      {isThisPending ? "Guardando…" : label}
    </AdminButton>
  );
}

function FieldGroupDiff({
  fieldGroup,
  oldValue,
  newValue,
  photoUrls,
  rulesFileId,
}: {
  fieldGroup: string;
  oldValue: unknown;
  newValue: unknown;
  photoUrls: string[];
  rulesFileId: string | null;
}) {
  if (fieldGroup === "photos") {
    return (
      <div>
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
          Fotos nuevas propuestas ({photoUrls.length})
        </p>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {photoUrls.map((url) => (
            <div key={url} className="relative aspect-square overflow-hidden rounded" style={{ border: `1px solid ${cmd.border}` }}>
              <Image src={url} alt="Foto propuesta" fill className="object-cover" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (fieldGroup === "services") {
    const oldItems = ((oldValue as { items?: string[] } | null)?.items ?? []) as string[];
    const newItems = ((newValue as { items?: string[] } | null)?.items ?? []) as string[];
    return <BeforeAfterList label="Servicios" before={oldItems.join(", ") || "—"} after={newItems.join(", ") || "—"} />;
  }

  if (fieldGroup === "rules") {
    const oldSummary = (oldValue as { summary?: string } | null)?.summary ?? "";
    const newSummary = (newValue as { summary?: string } | null)?.summary ?? "";
    const rulesFile = (newValue as { rulesFile?: { filename: string } | null } | null)?.rulesFile ?? null;
    return (
      <div className="space-y-4">
        <BeforeAfterList label="Resumen de reglas" before={oldSummary || "—"} after={newSummary || "—"} />
        {rulesFile && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
              Reglamento PDF nuevo
            </p>
            {rulesFileId ? (
              <div>
                <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
                  {rulesFile.filename}
                </p>
                <DocumentAccessButton fileId={rulesFileId} label="Ver reglamento →" />
              </div>
            ) : (
              <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>
                {rulesFile.filename} (documento no disponible)
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  if (fieldGroup === "minimum_stay_months") {
    const oldMonths = (oldValue as { months?: number | null } | null)?.months ?? null;
    const newMonths = (newValue as { months?: number | null } | null)?.months ?? null;
    return (
      <BeforeAfterList
        label="Mínimo de estadía"
        before={oldMonths ? `${oldMonths} meses` : "Sin mínimo"}
        after={newMonths ? `${newMonths} meses` : "Sin mínimo"}
      />
    );
  }

  if (fieldGroup === "room_types") {
    const oldTypes = ((oldValue as { roomTypes?: RoomTypeSnapshot[] } | null)?.roomTypes ?? []) as RoomTypeSnapshot[];
    const newTypes = ((newValue as { roomTypes?: RoomTypeSnapshot[] } | null)?.roomTypes ?? []) as RoomTypeSnapshot[];
    return (
      <div className="grid grid-cols-2 gap-4">
        <RoomTypesList label="Antes (publicado)" types={oldTypes} />
        <RoomTypesList label="Propuesto" types={newTypes} />
      </div>
    );
  }

  return <p className="text-sm" style={{ color: cmd.onSurfaceVariant }}>Sin detalle disponible.</p>;
}

function BeforeAfterList({ label, before, after }: { label: string; before: string; after: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
        {label}
      </p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div className="rounded p-3 text-sm" style={{ backgroundColor: cmd.roseBg, color: cmd.onSurfaceVariant }}>
          <p className="mb-1 text-[10px] font-bold uppercase" style={{ color: cmd.rose }}>
            Antes (publicado)
          </p>
          {before}
        </div>
        <div className="rounded p-3 text-sm" style={{ backgroundColor: cmd.emeraldBg, color: cmd.onSurfaceVariant }}>
          <p className="mb-1 text-[10px] font-bold uppercase" style={{ color: cmd.emerald }}>
            Propuesto
          </p>
          {after}
        </div>
      </div>
    </div>
  );
}

function RoomTypesList({ label, types }: { label: string; types: RoomTypeSnapshot[] }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: cmd.outline }}>
        {label}
      </p>
      {types.length === 0 ? (
        <p className="mt-2 text-sm" style={{ color: cmd.onSurfaceVariant }}>
          Sin tipos.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {types.map((t, i) => (
            <li key={t.id ?? i} className="rounded p-3 text-sm" style={{ border: `1px solid ${cmd.border}` }}>
              <p className="font-bold" style={{ color: cmd.onSurface }}>
                {t.name ?? "—"} {!t.id && <span style={{ color: cmd.emerald }}>(nuevo)</span>}
              </p>
              <p className="text-xs" style={{ color: cmd.onSurfaceVariant }}>
                {t.roomCount ?? 0} habitación(es) · {t.capacityPerRoom ?? 1} por habitación · {t.genderPolicy ?? "sin género definido"} ·{" "}
                {t.bathroomType ?? "sin baño definido"}
              </p>
              {t.features && t.features.length > 0 && (
                <p className="text-xs" style={{ color: cmd.outline }}>
                  {t.features.join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
