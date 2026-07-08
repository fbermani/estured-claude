"use client";

import Image from "next/image";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { formatArs, formatUsd, usdToArs } from "@/lib/mock/exchange";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import {
  SERVICE_OPTIONS,
  COMMON_AREA_OPTIONS,
  UNIVERSITY_OPTIONS,
  ROOM_TYPE_NAMES,
  GENDER_POLICY_OPTIONS,
  ADJUSTMENT_POLICY_OPTIONS,
  ROOM_FEATURE_OPTIONS,
} from "@/lib/residences/options";
import {
  saveResidenceProfile,
  type ProfileFormState,
} from "@/app/residence/[residence_id]/profile/actions";

interface RoomTypeDraft {
  name: string;
  genderPolicy?: string;
  bathroomType?: string;
  features: string[];
  availableCount: number;
  monthlyPriceUsd: number;
  enrollmentFeeUsd?: number;
  depositUsd?: number;
  adjustmentPolicy: string;
  minimumStayMonths?: number;
}

interface ProfileInitial {
  name: string;
  tagline: string;
  propertyType: string;
  addressLine: string;
  zone: string;
  description: string;
  status: string;
  services: string[];
  commonAreas: string[];
  nearUniversities: string[];
  rulesSummary: string;
  rulesFileName: string | null;
  photoUrls: string[];
  roomTypes: RoomTypeDraft[];
}

const initialState: ProfileFormState = { status: "idle" };

const statusCopy: Record<string, { label: string; tone: "neutral" | "amber" | "sage" }> = {
  draft: { label: "Borrador", tone: "neutral" },
  pending_verification: { label: "Enviada — pendiente de verificación", tone: "amber" },
  verification_scheduled: { label: "Visita programada", tone: "amber" },
  verified_active: { label: "Verificada y publicada", tone: "sage" },
  needs_changes: { label: "Requiere cambios", tone: "amber" },
};

function emptyRoomType(): RoomTypeDraft {
  return {
    name: "Individual",
    features: [],
    availableCount: 1,
    monthlyPriceUsd: 300,
    adjustmentPolicy: "quarterly",
  };
}

export function ResidenceProfileForm({
  residenceId,
  initial,
  arsPerUsd,
}: {
  residenceId: string;
  initial: ProfileInitial;
  arsPerUsd: number;
}) {
  const action = saveResidenceProfile.bind(null, residenceId);
  const [state, formAction] = useActionState(action, initialState);

  const [tagline, setTagline] = useState(initial.tagline);
  const [description, setDescription] = useState(initial.description);
  const [services, setServices] = useState<Set<string>>(new Set(initial.services));
  const [commonAreas, setCommonAreas] = useState<Set<string>>(new Set(initial.commonAreas));
  const [nearUniversities, setNearUniversities] = useState<Set<string>>(
    new Set(initial.nearUniversities),
  );
  const [rulesSummary, setRulesSummary] = useState(initial.rulesSummary);
  const [roomTypes, setRoomTypes] = useState<RoomTypeDraft[]>(
    initial.roomTypes.length > 0 ? initial.roomTypes : [emptyRoomType()],
  );
  const [newPhotoCount, setNewPhotoCount] = useState(0);

  function toggle(set: Set<string>, setSet: (s: Set<string>) => void, value: string) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setSet(next);
  }

  function updateRoomType(index: number, patch: Partial<RoomTypeDraft>) {
    setRoomTypes((prev) => prev.map((rt, i) => (i === index ? { ...rt, ...patch } : rt)));
  }

  function toggleRoomFeature(index: number, feature: string) {
    setRoomTypes((prev) =>
      prev.map((rt, i) => {
        if (i !== index) return rt;
        const has = rt.features.includes(feature);
        return { ...rt, features: has ? rt.features.filter((f) => f !== feature) : [...rt.features, feature] };
      }),
    );
  }

  const strength = useMemo(() => {
    const totalPhotos = initial.photoUrls.length + newPhotoCount;
    const checks = [
      tagline.trim().length > 0,
      description.trim().length > 20,
      services.size > 0,
      commonAreas.size > 0,
      rulesSummary.trim().length > 0,
      nearUniversities.size > 0,
      totalPhotos >= 3,
      roomTypes.length > 0 && roomTypes.every((rt) => rt.monthlyPriceUsd > 0),
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [tagline, description, services, commonAreas, rulesSummary, nearUniversities, roomTypes, newPhotoCount, initial.photoUrls.length]);

  const previewPrice = roomTypes.length > 0 ? Math.min(...roomTypes.map((r) => r.monthlyPriceUsd)) : null;
  const badge = statusCopy[initial.status] ?? statusCopy.draft;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-petrol-800">Configuración de Residencia</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Completá la información de {initial.name} para poder publicarla. Guardá cuando quieras
            como borrador.
          </p>
        </div>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>

      <form
        action={(fd) => {
          // El intent viaja como name/value del <button> que disparó el
          // submit (patrón HTML nativo) — leer el botón evita la carrera
          // de usar onClick + estado de React para decidirlo.
          fd.set("room_types_json", JSON.stringify(roomTypes));
          formAction(fd);
        }}
        className="grid gap-8 lg:grid-cols-[1fr_320px]"
      >
        <div className="space-y-6">
          {/* Datos básicos (algunos read-only: se fijan al registrarse) */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-petrol-800">Datos Básicos</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input label="Nombre de la residencia" value={initial.name} disabled hint="Se fija al registrarse." />
              <Input
                label="Zona"
                value={initial.zone}
                disabled
              />
            </div>
            <Input
              label="Dirección completa"
              value={initial.addressLine}
              disabled
              className="mt-4"
              hint="Privada. Escribinos si necesitás corregirla."
            />
            <Input
              label="Frase corta (eslogan)"
              id="tagline"
              name="tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={80}
              placeholder="Tu lugar de casa"
              hint={`Visible en resultados de búsqueda. ${tagline.length}/80 caracteres.`}
              className="mt-4"
            />
            <Textarea
              label="Descripción detallada"
              id="description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-4"
            />
          </Card>

          {/* Servicios */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-petrol-800">Servicios Incluidos</h2>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
              {SERVICE_OPTIONS.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="services"
                    value={s}
                    checked={services.has(s)}
                    onChange={() => toggle(services, setServices, s)}
                    className="h-4 w-4 accent-petrol-600"
                  />
                  {s}
                </label>
              ))}
            </div>
          </Card>

          {/* Áreas comunes */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-petrol-800">Áreas Comunes</h2>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
              {COMMON_AREA_OPTIONS.map((a) => (
                <label key={a} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="common_areas"
                    value={a}
                    checked={commonAreas.has(a)}
                    onChange={() => toggle(commonAreas, setCommonAreas, a)}
                    className="h-4 w-4 accent-petrol-600"
                  />
                  {a}
                </label>
              ))}
            </div>
          </Card>

          {/* Reglas y políticas */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-petrol-800">Reglas y Políticas</h2>
              <Badge tone="amber">Datos sensibles</Badge>
            </div>
            <p className="mt-2 rounded-field bg-warning-bg px-3 py-2 text-xs text-warning-fg">
              Atención: cualquier cambio en esta sección requiere validación del equipo de EstuRed
              antes de ser público.
            </p>
            <Textarea
              label="Resumen de normas de convivencia"
              id="rules_summary"
              name="rules_summary"
              value={rulesSummary}
              onChange={(e) => setRulesSummary(e.target.value)}
              rows={3}
              className="mt-4"
              placeholder="Ej: No se permiten fiestas ruidosas después de las 22hs. Prohibido fumar en interiores…"
            />
            <div className="mt-4">
              <label htmlFor="rules_file" className="text-sm font-medium text-ink">
                Reglamento completo (PDF, opcional)
              </label>
              <input
                id="rules_file"
                name="rules_file"
                type="file"
                accept="application/pdf"
                className="mt-1.5 block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-petrol-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-petrol-700"
              />
              {initial.rulesFileName && (
                <p className="mt-1 text-xs text-ink-faint">Actual: {initial.rulesFileName}</p>
              )}
            </div>
          </Card>

          {/* Universidades cercanas */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-petrol-800">Proximidad a Universidades</h2>
            <p className="mt-1 text-sm text-ink-soft">Seleccioná las universidades cercanas a tu residencia.</p>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {UNIVERSITY_OPTIONS.map((u) => (
                <label key={u} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="near_universities"
                    value={u}
                    checked={nearUniversities.has(u)}
                    onChange={() => toggle(nearUniversities, setNearUniversities, u)}
                    className="h-4 w-4 accent-petrol-600"
                  />
                  {u}
                </label>
              ))}
            </div>
          </Card>

          {/* Galería de fotos */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-petrol-800">Galería de Fotos</h2>
            {initial.photoUrls.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {initial.photoUrls.map((url) => (
                  <div key={url} className="relative aspect-square overflow-hidden rounded-field bg-sand-200">
                    <Image src={url} alt="Foto de la residencia" fill className="object-cover" />
                  </div>
                ))}
              </div>
            )}
            <label
              htmlFor="photos"
              className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-field border-2 border-dashed border-sand-300 bg-sand-50 px-4 py-8 text-center hover:border-petrol-300"
            >
              <span className="text-sm font-semibold text-petrol-700">
                Arrastrá tus fotos aquí o hacé clic para subir
              </span>
              <span className="text-xs text-ink-faint">Soporta JPG, PNG, WebP. Máx 5MB por imagen.</span>
              <input
                id="photos"
                name="photos"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => setNewPhotoCount(e.target.files?.length ?? 0)}
              />
            </label>
            {newPhotoCount > 0 && (
              <p className="mt-2 text-xs text-sage-600">{newPhotoCount} foto(s) lista(s) para subir.</p>
            )}
          </Card>

          {/* Tipos de habitación */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-petrol-800">Tipos de Habitaciones</h2>
            <div className="mt-4 space-y-4">
              {roomTypes.map((rt, i) => (
                <div key={i} className="rounded-card border border-sand-200 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-petrol-800">Habitación {i + 1}</h3>
                    {roomTypes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setRoomTypes((prev) => prev.filter((_, idx) => idx !== i))}
                        className="text-xs font-medium text-danger-fg hover:underline"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Select
                      label="Tipo"
                      value={rt.name}
                      onChange={(e) => updateRoomType(i, { name: e.target.value })}
                    >
                      {ROOM_TYPE_NAMES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </Select>
                    <Select
                      label="Género permitido"
                      value={rt.genderPolicy ?? ""}
                      onChange={(e) => updateRoomType(i, { genderPolicy: e.target.value || undefined })}
                    >
                      <option value="">Sin especificar</option>
                      {GENDER_POLICY_OPTIONS.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-4">
                    <span className="text-sm font-medium text-ink">Baño</span>
                    {["privado", "compartido"].map((b) => (
                      <label key={b} className="flex items-center gap-1.5 text-sm capitalize text-ink-soft">
                        <input
                          type="radio"
                          checked={rt.bathroomType === b}
                          onChange={() => updateRoomType(i, { bathroomType: b })}
                          className="h-4 w-4 accent-petrol-600"
                        />
                        {b}
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Cantidad disponible"
                      type="number"
                      min={0}
                      value={rt.availableCount}
                      onChange={(e) => updateRoomType(i, { availableCount: Number(e.target.value) })}
                    />
                    <Input
                      label="Tarifa mensual (USD)"
                      type="number"
                      min={0}
                      step={5}
                      value={rt.monthlyPriceUsd}
                      onChange={(e) => updateRoomType(i, { monthlyPriceUsd: Number(e.target.value) })}
                      hint={
                        <>
                          ≈ {formatArs(usdToArs(rt.monthlyPriceUsd, arsPerUsd))} referencial
                          <ExchangeRateNote />
                        </>
                      }
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4">
                    <span className="text-sm font-medium text-ink">Características</span>
                    {ROOM_FEATURE_OPTIONS.map((f) => (
                      <label key={f} className="flex items-center gap-1.5 text-sm text-ink-soft">
                        <input
                          type="checkbox"
                          checked={rt.features.includes(f)}
                          onChange={() => toggleRoomFeature(i, f)}
                          className="h-4 w-4 accent-petrol-600"
                        />
                        {f}
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-4 sm:grid-cols-3">
                    <Input
                      label="Matrícula (USD, opcional)"
                      type="number"
                      min={0}
                      value={rt.enrollmentFeeUsd ?? ""}
                      onChange={(e) =>
                        updateRoomType(i, {
                          enrollmentFeeUsd: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                    />
                    <Input
                      label="Depósito (USD, opcional)"
                      type="number"
                      min={0}
                      value={rt.depositUsd ?? ""}
                      onChange={(e) =>
                        updateRoomType(i, { depositUsd: e.target.value ? Number(e.target.value) : undefined })
                      }
                      hint="Reembolsable."
                    />
                    <Select
                      label="Ajuste cada"
                      value={rt.adjustmentPolicy}
                      onChange={(e) => updateRoomType(i, { adjustmentPolicy: e.target.value })}
                    >
                      {ADJUSTMENT_POLICY_OPTIONS.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setRoomTypes((prev) => [...prev, emptyRoomType()])}
              className="mt-4 text-sm font-semibold text-petrol-600 hover:text-petrol-700"
            >
              + Agregar tipo de habitación
            </button>
          </Card>

          {state.status === "error" && (
            <p role="alert" className="rounded-field bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
              {state.message}
            </p>
          )}
          {state.status === "saved" && (
            <p className="rounded-field bg-success-bg px-4 py-3 text-sm font-medium text-success-fg">
              {state.message}
            </p>
          )}
          {state.status === "submitted" && (
            <p className="rounded-field bg-success-bg px-4 py-3 text-sm font-medium text-success-fg">
              ¡Enviado! El equipo de EstuRed va a coordinar la verificación presencial antes de publicar
              tu residencia.
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <SubmitButton intent="draft" variant="outline" idleLabel="Guardar cambios" pendingLabel="Guardando…" />
            <SubmitButton intent="submit" variant="primary" idleLabel="Enviar para revisión" pendingLabel="Enviando…" />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <Card className="sticky top-24 p-5">
            <h3 className="font-bold text-petrol-800">Fortaleza del Perfil</h3>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand-200">
              <div className="h-full rounded-full bg-petrol-600 transition-all" style={{ width: `${strength}%` }} />
            </div>
            <p className="mt-1 text-right text-sm font-bold text-petrol-700">{strength}%</p>
            {strength < 100 && (
              <p className="mt-2 rounded-field bg-sand-100 px-3 py-2 text-xs text-ink-soft">
                Sugerencia: completá todas las secciones y sumá al menos 3 fotos para mejorar tu
                posicionamiento.
              </p>
            )}
          </Card>

          <Card className="overflow-hidden p-0">
            <p className="border-b border-sand-200 px-5 py-3 text-sm font-bold text-petrol-800">
              Vista previa
            </p>
            <div className="relative h-32 bg-sand-200">
              {initial.photoUrls[0] && (
                <Image src={initial.photoUrls[0]} alt="" fill className="object-cover" />
              )}
            </div>
            <div className="p-4">
              <p className="font-bold text-petrol-800">{initial.name}</p>
              <p className="text-xs text-ink-soft">{initial.zone || "Zona sin definir"}, CABA</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {[...services].slice(0, 2).map((s) => (
                  <Badge key={s} tone="petrol">
                    {s}
                  </Badge>
                ))}
                {services.size > 2 && <Badge tone="neutral">+{services.size - 2}</Badge>}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-ink-faint">Desde</p>
                  <p className="font-bold text-petrol-700">
                    {previewPrice !== null ? formatUsd(previewPrice) : "—"}
                  </p>
                </div>
                <Button size="sm" variant="outline" disabled>
                  Ver
                </Button>
              </div>
            </div>
          </Card>

          <Card className="border-petrol-200 bg-petrol-50 p-5">
            <h3 className="font-bold text-petrol-800">¿Necesitás ayuda?</h3>
            <p className="mt-1 text-sm text-ink-soft">
              Contactá a nuestro equipo de soporte para configurar tu perfil.
            </p>
            <Button href="/waitlist" variant="outline" size="sm" className="mt-3">
              Contactar soporte
            </Button>
          </Card>
        </aside>
      </form>
    </div>
  );
}

/**
 * useFormStatus solo funciona en un descendiente del <form>, por eso
 * vive separado del componente que define el form. `data.get("intent")`
 * identifica cuál de los dos botones submit disparó el envío en curso.
 */
function SubmitButton({
  intent,
  variant,
  idleLabel,
  pendingLabel,
}: {
  intent: "draft" | "submit";
  variant: "outline" | "primary";
  idleLabel: string;
  pendingLabel: string;
}) {
  const { pending, data } = useFormStatus();
  const isThisPending = pending && data?.get("intent") === intent;
  return (
    <Button type="submit" name="intent" value={intent} variant={variant} disabled={pending}>
      {isThisPending ? pendingLabel : idleLabel}
    </Button>
  );
}
