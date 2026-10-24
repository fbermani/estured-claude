"use client";

import { formatDate } from "@/lib/dates/format";
import Image from "next/image";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { formatArs, formatUsd, usdToArsRounded } from "@/lib/mock/exchange";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { ResidencePhotoPlaceholder } from "@/components/residences/ResidencePhoto";
import { computeProfileStrength, profileStrengthSuggestion } from "@/lib/residences/profileStrength";
import { MIN_PUBLISH_PHOTOS, hasEnoughPhotosToPublish } from "@/lib/residences/photos";
import { changesRequestedMessageOrFallback } from "@/lib/residences/changesRequest";
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
  id?: string;
  name: string;
  genderPolicy?: string;
  bathroomType?: string;
  features: string[];
  /** Cantidad de habitaciones físicas — sincroniza el módulo de habitaciones. */
  roomCount: number;
  /** Camas por habitación (derivada del tipo; editable en Compartida). */
  capacityPerRoom: number;
  monthlyPriceUsd: number;
}

/** Condiciones generales de reserva (migración 0025 — ref de configuración). */
interface ConditionsDraft {
  minimumStayMonths: number | "";
  adjustmentPolicy: string;
  /** Pago inicial para reservar (D7/H08, migración 0041): primer mes o monto fijo en USD. */
  initialPaymentMode: "one_month" | "custom_usd";
  initialPaymentUsd: number | "";
  enrollmentEnabled: boolean;
  enrollmentFeeMode: "one_month" | "manual";
  enrollmentFeeUsd: number | "";
  enrollmentFeeFrequency: "once" | "annual";
  depositEnabled: boolean;
  depositUsd: number | "";
  emptyMonthsEnabled: boolean;
  /** Se muestra como "descuento"; se guarda como % cobrado (100 - descuento). */
  emptyMonthDiscountPercent: number;
  /** Política de salida anticipada (DR3, migración 0044): se muestra en la ficha y precarga la respuesta a un aviso. */
  earlyExitDepositClausesText: string;
  earlyExitCostsText: string;
  earlyExitConditionsText: string;
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
  faqItems: { question: string; answer: string }[];
  photos: { url: string; pending: boolean }[];
  roomTypes: RoomTypeDraft[];
  conditions: ConditionsDraft;
  pendingEditGroups: { fieldGroup: string; createdAt: string }[];
  /** Mensaje del admin al pedir cambios (DR5, migración 0048); null si no hay (cambios pedidos antes de la 0048). */
  changesMessage: string | null;
}

const FIELD_GROUP_LABELS: Record<string, string> = {
  photos: "Fotos",
  services: "Servicios",
  rules: "Reglas y reglamento",
  minimum_stay_months: "Mínimo de estadía",
  room_types: "Tipos de habitación",
};

/** Camas por habitación según el nombre del tipo (Compartida es editable). */
const CAPACITY_BY_NAME: Record<string, number> = {
  Individual: 1,
  Doble: 2,
  Triple: 3,
  Cuádruple: 4,
  Compartida: 3,
};

const MINIMUM_STAY_OPTIONS = [1, 3, 6, 9, 12];
const EMPTY_MONTH_DISCOUNT_OPTIONS = [0, 25, 50, 75];

function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? "bg-forest" : "bg-sand-200"
      } ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

const initialState: ProfileFormState = { status: "idle" };

const statusCopy: Record<string, { label: string; tone: "neutral" | "amber" | "sage" }> = {
  draft: { label: "Borrador", tone: "neutral" },
  pending_verification: { label: "Enviada — pendiente de verificación", tone: "amber" },
  verification_scheduled: { label: "Visita programada", tone: "amber" },
  verified_active: { label: "Verificada y publicada", tone: "sage" },
  needs_changes: { label: "Requiere cambios", tone: "amber" },
  verification_expired: { label: "Verificación vencida", tone: "amber" },
};

function emptyRoomType(): RoomTypeDraft {
  return {
    name: "Individual",
    features: [],
    roomCount: 1,
    capacityPerRoom: 1,
    monthlyPriceUsd: 300,
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
  const [faqItems, setFaqItems] = useState<{ question: string; answer: string }[]>(
    initial.faqItems.length > 0 ? initial.faqItems : [{ question: "", answer: "" }],
  );
  const [roomTypes, setRoomTypes] = useState<RoomTypeDraft[]>(
    initial.roomTypes.length > 0 ? initial.roomTypes : [emptyRoomType()],
  );
  const [conditions, setConditions] = useState<ConditionsDraft>(initial.conditions);
  const [newPhotoCount, setNewPhotoCount] = useState(0);

  function updateConditions(patch: Partial<ConditionsDraft>) {
    setConditions((prev) => ({ ...prev, ...patch }));
  }

  function toggle(set: Set<string>, setSet: (s: Set<string>) => void, value: string) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setSet(next);
  }

  function updateRoomType(index: number, patch: Partial<RoomTypeDraft>) {
    setRoomTypes((prev) => prev.map((rt, i) => (i === index ? { ...rt, ...patch } : rt)));
  }

  function updateFaqItem(index: number, patch: Partial<{ question: string; answer: string }>) {
    setFaqItems((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function addFaqItem() {
    setFaqItems((prev) => (prev.length >= 5 ? prev : [...prev, { question: "", answer: "" }]));
  }

  function removeFaqItem(index: number) {
    setFaqItems((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
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

  const strength = useMemo(
    () =>
      computeProfileStrength({
        tagline,
        description,
        services: services.size,
        commonAreas: commonAreas.size,
        rulesSummary,
        nearUniversities: nearUniversities.size,
        photos: initial.photos.length + newPhotoCount,
        roomTypesOk: roomTypes.length > 0 && roomTypes.every((rt) => rt.monthlyPriceUsd > 0),
      }),
    [tagline, description, services, commonAreas, rulesSummary, nearUniversities, roomTypes, newPhotoCount, initial.photos.length],
  );
  const strengthSuggestion = profileStrengthSuggestion(strength);

  const previewPrice = roomTypes.length > 0 ? Math.min(...roomTypes.map((r) => r.monthlyPriceUsd)) : null;
  const badge = statusCopy[initial.status] ?? statusCopy.draft;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-ink">Configuración de Residencia</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {initial.status === "draft"
              ? `Completá la información de ${initial.name} para poder publicarla. Guardá cuando quieras como borrador.`
              : initial.status === "verified_active"
                ? `Mantené al día la información de ${initial.name}.`
                : initial.status === "needs_changes"
                  ? `Corregí lo que pidió el equipo de EstuRed en ${initial.name} y reenviala para revisión.`
                  : initial.status === "verification_expired"
                    ? `La verificación anual de ${initial.name} venció. Revisá que el perfil esté al día y reenviala para revisión.`
                  : `Mantené al día la información de ${initial.name} mientras el equipo de EstuRed la revisa.`}
          </p>
        </div>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>

      {initial.status === "needs_changes" && (
        <section role="alert" aria-label="Cambios pedidos por EstuRed" className="mb-8 rounded-card border-[1.5px] border-warning-fg/30 bg-warning-bg p-5">
          <p className="text-sm font-bold text-warning-fg">El equipo de EstuRed te pidió cambios</p>
          {initial.changesMessage ? (
            <p className="mt-2 whitespace-pre-line break-words text-sm text-ink">{initial.changesMessage}</p>
          ) : (
            <p className="mt-2 text-sm text-ink">{changesRequestedMessageOrFallback(null).text}</p>
          )}
          <p className="mt-2 text-xs text-ink-soft">Cuando termines de corregir, tocá &ldquo;Reenviar para revisión&rdquo; al final de la página.</p>
        </section>
      )}

      {initial.status === "verification_expired" && (
        <section role="alert" aria-label="Verificación vencida" className="mb-8 rounded-card border-[1.5px] border-warning-fg/30 bg-warning-bg p-5">
          <p className="text-sm font-bold text-warning-fg">La verificación anual venció</p>
          <p className="mt-2 text-sm text-ink">
            Tu residencia dejó de estar publicada hasta que se vuelva a verificar. Cuando el perfil esté al día, tocá &ldquo;Reenviar para revisión&rdquo; al final de la página: el equipo de EstuRed coordina la nueva visita presencial.
          </p>
        </section>
      )}

      {initial.pendingEditGroups.length > 0 && (
        <Card className="mb-8 border-orange-tint bg-orange-tint/40 p-5">
          <p className="text-sm font-bold text-orange-700">
            Tenés cambios esperando aprobación del equipo de EstuRed
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Como esta residencia ya está publicada, estos campos no se actualizan hasta que un admin los revise.
            Mientras tanto seguís viendo acá los valores actuales (los que ya están publicados), no los que enviaste.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {initial.pendingEditGroups.map((e) => (
              <li key={e.fieldGroup}>
                <Badge tone="amber">
                  {FIELD_GROUP_LABELS[e.fieldGroup] ?? e.fieldGroup} · enviado el{" "}
                  {formatDate(e.createdAt)}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <form
        action={(fd) => {
          // El intent viaja como name/value del <button> que disparó el
          // submit (patrón HTML nativo) — leer el botón evita la carrera
          // de usar onClick + estado de React para decidirlo.
          fd.set("room_types_json", JSON.stringify(roomTypes));
          fd.set(
            "faq_json",
            JSON.stringify(faqItems.filter((f) => f.question.trim() && f.answer.trim())),
          );
          fd.set(
            "conditions_json",
            JSON.stringify({
              minimumStayMonths: conditions.minimumStayMonths,
              adjustmentPolicy: conditions.adjustmentPolicy,
              initialPaymentMode: conditions.initialPaymentMode,
              initialPaymentUsd: conditions.initialPaymentMode === "custom_usd" ? conditions.initialPaymentUsd : null,
              enrollmentFeeMode: conditions.enrollmentEnabled ? conditions.enrollmentFeeMode : null,
              enrollmentFeeUsd: conditions.enrollmentFeeUsd,
              enrollmentFeeFrequency: conditions.enrollmentFeeFrequency,
              depositUsd: conditions.depositEnabled ? conditions.depositUsd : null,
              emptyMonthChargePercent: conditions.emptyMonthsEnabled
                ? 100 - conditions.emptyMonthDiscountPercent
                : null,
              earlyExitDepositClausesText: conditions.earlyExitDepositClausesText,
              earlyExitCostsText: conditions.earlyExitCostsText,
              earlyExitConditionsText: conditions.earlyExitConditionsText,
            }),
          );
          formAction(fd);
        }}
        className="grid gap-8 lg:grid-cols-[1fr_320px]"
      >
        <div className="space-y-6">
          {/* Datos básicos (algunos read-only: se fijan al registrarse) */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-ink">Datos Básicos</h2>
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
            <h2 className="text-lg font-bold text-ink">Servicios Incluidos</h2>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
              {SERVICE_OPTIONS.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="services"
                    value={s}
                    checked={services.has(s)}
                    onChange={() => toggle(services, setServices, s)}
                    className="h-4 w-4 accent-forest"
                  />
                  {s}
                </label>
              ))}
            </div>
          </Card>

          {/* Áreas comunes */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-ink">Áreas Comunes</h2>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
              {COMMON_AREA_OPTIONS.map((a) => (
                <label key={a} className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="common_areas"
                    value={a}
                    checked={commonAreas.has(a)}
                    onChange={() => toggle(commonAreas, setCommonAreas, a)}
                    className="h-4 w-4 accent-forest"
                  />
                  {a}
                </label>
              ))}
            </div>
          </Card>

          {/* Reglas y políticas */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">Reglas y Políticas</h2>
              <Badge tone="amber">Datos sensibles</Badge>
            </div>
            <p className="mt-2 rounded-field bg-warning-bg px-3 py-2 text-xs text-warning-fg">
              Atención: cualquier cambio en esta sección requiere validación del equipo de EstuRed
              antes de ser público.
            </p>
            <Textarea
              label="Reglas de convivencia (una por línea)"
              hint="En tu ficha pública se muestran las primeras 5. Escribí una regla corta por renglón."
              id="rules_summary"
              name="rules_summary"
              value={rulesSummary}
              onChange={(e) => setRulesSummary(e.target.value)}
              rows={5}
              className="mt-4"
              placeholder={"No fiestas después de las 22hs\nProhibido fumar en interiores\nVisitas hasta las 20hs"}
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
                className="mt-1.5 block w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-forest-tint file:px-4 file:py-2 file:text-sm file:font-semibold file:text-forest-700"
              />
              {initial.rulesFileName && (
                <p className="mt-1 text-xs text-ink-faint">Actual: {initial.rulesFileName}</p>
              )}
            </div>
          </Card>

          {/* Preguntas frecuentes — hasta 5, se muestran públicamente en la ficha con acordeón */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-ink">Preguntas frecuentes</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Hasta 5 preguntas que los estudiantes suelen hacer antes de reservar. Se muestran en tu ficha pública.
            </p>
            <div className="mt-4 space-y-4">
              {faqItems.map((faq, i) => (
                <div key={i} className="rounded-field border-[1.5px] border-line p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Input
                      label={`Pregunta ${i + 1}`}
                      value={faq.question}
                      onChange={(e) => updateFaqItem(i, { question: e.target.value })}
                      placeholder="Ej: ¿Se permiten mascotas?"
                      className="flex-1"
                    />
                    {faqItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFaqItem(i)}
                        className="mt-7 shrink-0 rounded-field p-2 text-ink-faint transition-colors hover:bg-cream-2 hover:text-danger-fg"
                        aria-label="Quitar pregunta"
                      >
                        <Icon name="close" className="text-lg" />
                      </button>
                    )}
                  </div>
                  <Textarea
                    label="Respuesta"
                    value={faq.answer}
                    onChange={(e) => updateFaqItem(i, { answer: e.target.value })}
                    rows={2}
                    className="mt-3"
                    placeholder="Respuesta breve y clara"
                  />
                </div>
              ))}
            </div>
            {faqItems.length < 5 && (
              <button
                type="button"
                onClick={addFaqItem}
                className="mt-3 text-sm font-semibold text-forest-700 hover:underline"
              >
                + Agregar pregunta
              </button>
            )}
          </Card>

          {/* Universidades cercanas */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-ink">Proximidad a Universidades</h2>
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
                    className="h-4 w-4 accent-forest"
                  />
                  {u}
                </label>
              ))}
            </div>
          </Card>

          {/* Galería de fotos */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-ink">Galería de Fotos</h2>
            {initial.status !== "verified_active" && (
              <PhotosRequirementNotice
                count={initial.photos.filter((p) => !p.pending).length + newPhotoCount}
              />
            )}
            {initial.photos.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {initial.photos.map((photo) => (
                  <div key={photo.url} className="relative aspect-square overflow-hidden rounded-field bg-sand-200">
                    <Image src={photo.url} alt="Foto de la residencia" fill className="object-cover" />
                    {photo.pending && (
                      <div className="absolute bottom-1 left-1">
                        <Badge tone="amber">Pendiente</Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <label
              htmlFor="photos"
              className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-field border-2 border-dashed border-sand-300 bg-sand-50 px-4 py-8 text-center hover:border-forest"
            >
              <span className="text-sm font-semibold text-forest-700">
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
              <p className="mt-2 text-xs text-forest-700">{newPhotoCount} foto(s) lista(s) para subir.</p>
            )}
          </Card>

          {/* Tipos de habitación */}
          <Card className="p-6">
            <h2 className="text-lg font-bold text-ink">Tipos de Habitaciones</h2>
            <div className="mt-4 space-y-4">
              {roomTypes.map((rt, i) => (
                <div key={i} className="rounded-card border border-sand-200 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-ink">Habitación {i + 1}</h3>
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
                      onChange={(e) =>
                        updateRoomType(i, {
                          name: e.target.value,
                          capacityPerRoom: CAPACITY_BY_NAME[e.target.value] ?? 3,
                        })
                      }
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
                          className="h-4 w-4 accent-forest"
                        />
                        {b}
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Cantidad de habitaciones"
                      type="number"
                      min={1}
                      max={60}
                      value={rt.roomCount}
                      onChange={(e) => updateRoomType(i, { roomCount: Number(e.target.value) })}
                      hint={`${rt.capacityPerRoom} ${rt.capacityPerRoom === 1 ? "cama" : "camas"} por habitación → ${
                        rt.roomCount * rt.capacityPerRoom
                      } plazas. Genera "Habitación 1…${rt.roomCount || "N"}", renombrables en el módulo de habitaciones.`}
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
                          ≈ {formatArs(usdToArsRounded(rt.monthlyPriceUsd, arsPerUsd))} referencial
                          <ExchangeRateNote />
                        </>
                      }
                    />
                  </div>
                  {rt.name === "Compartida" && (
                    <div className="mt-3 max-w-56">
                      <Input
                        label="Camas por habitación"
                        type="number"
                        min={2}
                        max={10}
                        value={rt.capacityPerRoom}
                        onChange={(e) => updateRoomType(i, { capacityPerRoom: Number(e.target.value) || 2 })}
                      />
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-4">
                    <span className="text-sm font-medium text-ink">Características</span>
                    {ROOM_FEATURE_OPTIONS.map((f) => (
                      <label key={f} className="flex items-center gap-1.5 text-sm text-ink-soft">
                        <input
                          type="checkbox"
                          checked={rt.features.includes(f)}
                          onChange={() => toggleRoomFeature(i, f)}
                          className="h-4 w-4 accent-forest"
                        />
                        {f}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setRoomTypes((prev) => [...prev, emptyRoomType()])}
              className="mt-4 text-sm font-semibold text-forest-700 hover:text-forest-700"
            >
              + Agregar tipo de habitación
            </button>
          </Card>

          {/* Condiciones de Reserva — generales a todos los tipos (ref
              de configuración; migración 0025) */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">Condiciones de Reserva</h2>
              <Badge tone="amber">Datos sensibles</Badge>
            </div>
            <p className="mt-1 text-sm text-ink-soft">
              Aplican a todos los tipos de habitación y se muestran en la previa de cada solicitud.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Select
                label="Mínimo de estadía"
                value={conditions.minimumStayMonths}
                onChange={(e) =>
                  updateConditions({ minimumStayMonths: e.target.value ? Number(e.target.value) : "" })
                }
                hint="Duración mínima de contrato requerida."
              >
                <option value="">Sin mínimo</option>
                {MINIMUM_STAY_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} {m === 1 ? "mes" : "meses"}
                  </option>
                ))}
              </Select>
              <Select
                label="Ajuste cada"
                value={conditions.adjustmentPolicy}
                onChange={(e) => updateConditions({ adjustmentPolicy: e.target.value })}
              >
                {ADJUSTMENT_POLICY_OPTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Pago inicial para reservar (D7 / H08, migración 0041) */}
            <div className="mt-5 rounded-card border border-sand-200 p-4">
              <p className="font-semibold text-ink">Pago inicial para reservar</p>
              <p className="text-xs text-ink-soft">
                Lo que el estudiante te paga a vos, directamente, para reservar. Se muestra igual en tu ficha, en la
                solicitud y en el mensaje de WhatsApp. El fee de EstuRed va aparte y no depende de este monto.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-1.5 text-sm text-ink-soft">
                  <input
                    type="radio"
                    name="initial_payment_mode"
                    checked={conditions.initialPaymentMode === "one_month"}
                    onChange={() => updateConditions({ initialPaymentMode: "one_month" })}
                    className="h-4 w-4 accent-forest"
                  />
                  Primer mes de renta
                </label>
                <label className="flex items-center gap-1.5 text-sm text-ink-soft">
                  <input
                    type="radio"
                    name="initial_payment_mode"
                    checked={conditions.initialPaymentMode === "custom_usd"}
                    onChange={() => updateConditions({ initialPaymentMode: "custom_usd" })}
                    className="h-4 w-4 accent-forest"
                  />
                  Monto fijo
                </label>
                {conditions.initialPaymentMode === "custom_usd" && (
                  <div className="w-36">
                    <Input
                      label="Monto (USD)"
                      type="number"
                      min={1}
                      step="0.01"
                      value={conditions.initialPaymentUsd}
                      onChange={(e) =>
                        updateConditions({ initialPaymentUsd: e.target.value ? Number(e.target.value) : "" })
                      }
                    />
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-ink-faint">
                {conditions.initialPaymentMode === "one_month"
                  ? "Es la tarifa mensual del tipo de habitación que elija el estudiante. Es el valor por defecto."
                  : "Es el mismo monto para todos los tipos de habitación. Las solicitudes ya enviadas conservan el monto con el que se crearon."}
              </p>
            </div>

            {/* Matrícula */}
            <div className="mt-5 rounded-card border border-sand-200 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-ink">Matrícula de inscripción</p>
                  <p className="text-xs text-ink-soft">
                    ¿Cobrás una tarifa administrativa al inicio? <span className="font-semibold text-danger-fg">No reembolsable.</span>
                  </p>
                </div>
                <Switch
                  checked={conditions.enrollmentEnabled}
                  disabled={conditions.depositEnabled}
                  onChange={(v) => updateConditions({ enrollmentEnabled: v })}
                  label="Cobrar matrícula"
                />
              </div>
              {conditions.depositEnabled && (
                <p className="mt-2 text-xs text-ink-faint">Excluyente con el depósito de garantía.</p>
              )}
              {conditions.enrollmentEnabled && (
                <div className="mt-4 space-y-3 border-t border-sand-200 pt-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="text-xs font-bold uppercase tracking-wide text-muted">Equivalente a</span>
                    <label className="flex items-center gap-1.5 text-sm text-ink-soft">
                      <input
                        type="radio"
                        checked={conditions.enrollmentFeeMode === "one_month"}
                        onChange={() => updateConditions({ enrollmentFeeMode: "one_month" })}
                        className="h-4 w-4 accent-forest"
                      />
                      1 mes de renta
                    </label>
                    <label className="flex items-center gap-1.5 text-sm text-ink-soft">
                      <input
                        type="radio"
                        checked={conditions.enrollmentFeeMode === "manual"}
                        onChange={() => updateConditions({ enrollmentFeeMode: "manual" })}
                        className="h-4 w-4 accent-forest"
                      />
                      Valor manual
                    </label>
                    {conditions.enrollmentFeeMode === "manual" && (
                      <div className="w-32">
                        <Input
                          label="Monto (USD)"
                          type="number"
                          min={0}
                          value={conditions.enrollmentFeeUsd}
                          onChange={(e) =>
                            updateConditions({ enrollmentFeeUsd: e.target.value ? Number(e.target.value) : "" })
                          }
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="text-xs font-bold uppercase tracking-wide text-muted">Frecuencia</span>
                    {(
                      [
                        { value: "once", label: "Única vez" },
                        { value: "annual", label: "Anual" },
                      ] as const
                    ).map((f) => (
                      <label key={f.value} className="flex items-center gap-1.5 text-sm text-ink-soft">
                        <input
                          type="radio"
                          checked={conditions.enrollmentFeeFrequency === f.value}
                          onChange={() => updateConditions({ enrollmentFeeFrequency: f.value })}
                          className="h-4 w-4 accent-forest"
                        />
                        {f.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Depósito */}
            <div className="mt-4 rounded-card border border-sand-200 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-ink">Depósito de garantía</p>
                  <p className="text-xs text-ink-soft">Reembolsable al egreso. Excluyente con la matrícula.</p>
                </div>
                <Switch
                  checked={conditions.depositEnabled}
                  disabled={conditions.enrollmentEnabled}
                  onChange={(v) => updateConditions({ depositEnabled: v })}
                  label="Pedir depósito"
                />
              </div>
              {conditions.depositEnabled && (
                <div className="mt-4 w-40 border-t border-sand-200 pt-4">
                  <Input
                    label="Monto (USD)"
                    type="number"
                    min={0}
                    value={conditions.depositUsd}
                    onChange={(e) => updateConditions({ depositUsd: e.target.value ? Number(e.target.value) : "" })}
                  />
                </div>
              )}
            </div>

            {/* Meses vacíos */}
            <div className="mt-4 rounded-card border border-sand-200 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-ink">Meses vacíos (reserva anticipada)</p>
                  <p className="text-xs text-ink-soft">
                    Al reservar un cupo futuro (máximo 3 meses), los meses no ocupados tienen un cargo mínimo.
                  </p>
                </div>
                <Switch
                  checked={conditions.emptyMonthsEnabled}
                  onChange={(v) => updateConditions({ emptyMonthsEnabled: v })}
                  label="Cobrar meses vacíos"
                />
              </div>
              {conditions.emptyMonthsEnabled && (
                <div className="mt-4 max-w-72 border-t border-sand-200 pt-4">
                  <Select
                    label="Descuento para meses no ocupados"
                    value={conditions.emptyMonthDiscountPercent}
                    onChange={(e) => updateConditions({ emptyMonthDiscountPercent: Number(e.target.value) })}
                    hint={`El estudiante paga el ${100 - conditions.emptyMonthDiscountPercent}% de la renta por mes vacío.`}
                  >
                    {EMPTY_MONTH_DISCOUNT_OPTIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}% de descuento
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>

            <div className="mt-4 rounded-card border border-sand-200 p-4">
              <p className="font-semibold text-ink">Depósito y salida anticipada</p>
              <p className="text-xs text-ink-soft">
                Lo ve el estudiante en tu ficha antes de reservar y se precarga cuando respondés un aviso &quot;Quiero cambiar&quot;. Es
                información tuya: EstuRed no la fija ni la cobra.
                {conditions.depositEnabled
                  ? " Tu reserva tiene depósito: contá sus cláusulas básicas."
                  : " Tu reserva no tiene depósito: cobrá lo que corresponda antes de que el estudiante se retire."}
              </p>
              <div className="mt-4 space-y-4">
                {conditions.depositEnabled && (
                  <Textarea
                    label="Cláusulas básicas del depósito"
                    value={conditions.earlyExitDepositClausesText}
                    onChange={(e) => updateConditions({ earlyExitDepositClausesText: e.target.value })}
                    rows={3}
                    maxLength={1000}
                    hint="Derechos y obligaciones de las partes sobre el depósito (cuándo se devuelve, plazos)."
                  />
                )}
                <Textarea
                  label="Costos de salida anticipada"
                  value={conditions.earlyExitCostsText}
                  onChange={(e) => updateConditions({ earlyExitCostsText: e.target.value })}
                  rows={3}
                  maxLength={1000}
                  hint="Por ejemplo: pérdida del depósito si no se cumple la estadía mínima."
                />
                <Textarea
                  label="Condiciones de salida anticipada"
                  value={conditions.earlyExitConditionsText}
                  onChange={(e) => updateConditions({ earlyExitConditionsText: e.target.value })}
                  rows={3}
                  maxLength={1000}
                  hint="Preaviso, entrega de la habitación y cualquier otro detalle."
                />
              </div>
            </div>
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
          {state.status === "saved_pending_review" && (
            <p className="rounded-field bg-orange-tint px-4 py-3 text-sm font-medium text-orange-700">
              {state.message}
            </p>
          )}
          {state.status === "submitted" && (
            <p className="rounded-field bg-success-bg px-4 py-3 text-sm font-medium text-success-fg">
              {state.message ??
                "¡Enviado! El equipo de EstuRed va a coordinar la verificación presencial antes de publicar tu residencia."}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <SubmitButton intent="draft" variant="outline" idleLabel="Guardar cambios" pendingLabel="Guardando…" />
            <SubmitButton
              intent="submit"
              variant="primary"
              idleLabel={initial.status === "needs_changes" || initial.status === "verification_expired" ? "Reenviar para revisión" : "Enviar para revisión"}
              pendingLabel="Enviando…"
            />
          </div>
          <p className="text-xs text-ink-soft sm:text-right">
            {initial.status === "draft"
              ? "Guardar cambios conserva tu avance como borrador y no la envía. Enviar para revisión la manda al equipo de EstuRed, que coordina la verificación presencial antes de publicarla."
              : initial.status === "verified_active"
                ? "Los cambios se guardan al instante, salvo fotos, servicios, reglas, mínimo de estadía y tipos de habitación: esos quedan pendientes de aprobación del equipo de EstuRed. No hace falta volver a enviarla."
                : initial.status === "needs_changes"
                  ? "Guardar cambios conserva tu avance sin enviarlo. Reenviar para revisión vuelve a mandar la residencia al equipo de EstuRed con tus correcciones."
                  : initial.status === "verification_expired"
                    ? "Guardar cambios conserva tu avance sin enviarlo. Reenviar para revisión manda la residencia al equipo de EstuRed, que coordina la nueva visita antes de volver a publicarla."
                  : "Guardar cambios actualiza tu perfil. Tu residencia ya fue enviada: el equipo de EstuRed la ve con los cambios al revisarla."}
          </p>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <Card className="sticky top-24 p-5">
            <h3 className="font-bold text-ink">Fortaleza del Perfil</h3>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand-200">
              <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${strength.percent}%` }} />
            </div>
            <p className="mt-1 text-right text-sm font-bold text-forest-700">{strength.percent}%</p>
            {strengthSuggestion && (
              <p className="mt-2 rounded-field bg-sand-100 px-3 py-2 text-xs text-ink-soft">{strengthSuggestion}</p>
            )}
          </Card>

          <Card className="overflow-hidden p-0">
            <p className="border-b border-sand-200 px-5 py-3 text-sm font-bold text-ink">
              Vista previa
            </p>
            <div className="relative h-32 bg-sand-200">
              {(initial.photos.find((p) => !p.pending) ?? initial.photos[0]) ? (
                <Image
                  src={(initial.photos.find((p) => !p.pending) ?? initial.photos[0]).url}
                  alt=""
                  fill
                  sizes="320px"
                  className="object-cover"
                />
              ) : (
                <ResidencePhotoPlaceholder name={initial.name} zone={initial.zone} variant="card" label="Foto próximamente" />
              )}
            </div>
            <div className="p-4">
              <p className="font-bold text-ink">{initial.name}</p>
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
                  <p className="font-bold text-forest-700">
                    {previewPrice !== null ? formatUsd(previewPrice) : "—"}
                  </p>
                </div>
                <Button size="sm" variant="outline" disabled>
                  Ver
                </Button>
              </div>
            </div>
          </Card>

          <Card className="border-line-2 bg-forest-tint p-5">
            <h3 className="font-bold text-ink">¿Necesitás ayuda?</h3>
            <p className="mt-1 text-sm text-ink-soft">
              Contactá a nuestro equipo de soporte para configurar tu perfil.
            </p>
            <Button href={`/residence/${residenceId}/support`} variant="outline" size="sm" className="mt-3">
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

/**
 * Aviso de la regla de publicación (Ciclo 54, D12): hacen falta al menos 3
 * fotos propias. `count` suma las ya cargadas más las elegidas en el
 * selector de esta sesión. Solo se muestra mientras la residencia no está
 * publicada.
 */
function PhotosRequirementNotice({ count }: { count: number }) {
  const enough = hasEnoughPhotosToPublish(count);
  const shown = Math.min(count, MIN_PUBLISH_PHOTOS);
  return (
    <div
      role="status"
      className={`mt-3 rounded-field border-[1.5px] px-4 py-3 ${
        enough ? "border-forest/30 bg-forest-tint" : "border-warning-fg/30 bg-warning-bg"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={`flex items-center gap-2 text-sm font-bold ${enough ? "text-forest-700" : "text-warning-fg"}`}>
          <Icon name={enough ? "check_circle" : "photo_camera"} className="text-lg" />
          {enough ? "Ya tenés las fotos necesarias para publicar" : `Para publicar necesitás al menos ${MIN_PUBLISH_PHOTOS} fotos`}
        </p>
        <span className={`text-sm font-bold ${enough ? "text-forest-700" : "text-warning-fg"}`}>
          {shown} de {MIN_PUBLISH_PHOTOS}
        </span>
      </div>
      <div className="mt-2 flex gap-1.5" aria-hidden>
        {Array.from({ length: MIN_PUBLISH_PHOTOS }, (_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < shown ? (enough ? "bg-forest" : "bg-warning-fg") : "bg-line-2"}`} />
        ))}
      </div>
      {!enough && (
        <p className="mt-2 text-xs leading-relaxed text-ink-soft">
          Tienen que ser fotos propias (luz natural, ambientes comunes y una por tipo de habitación). Las que elegís
          ahora cuentan recién al guardar, y para publicar el equipo de EstuRed considera solo las fotos ya cargadas y
          aprobadas. Mientras tanto, tu residencia se muestra con una ilustración.
        </p>
      )}
    </div>
  );
}
