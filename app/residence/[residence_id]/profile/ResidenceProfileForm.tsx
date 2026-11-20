"use client";

import { CLEANING_PER_WEEK_MAX, CLEANING_SERVICE, KITCHENS_MAX, KITCHEN_AREA, type AmenityDetails } from "@/lib/residences/amenityDetails";
import { ResidenceHero } from "@/components/residences/ResidenceHero";
import { formatDate } from "@/lib/dates/format";
import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { SectionNav } from "@/components/residences/ficha/SectionNav";
import { SaveStatus } from "@/components/forms/SaveStatus";
import { DraftNotice } from "@/components/forms/DraftNotice";
import { UnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import { useProfileDraft } from "@/app/residence/[residence_id]/profile/useProfileDraft";
import { profileStamp, saveImpactNote } from "@/lib/residences/profileDraft";
import { formatArs, usdToArsRounded } from "@/lib/mock/exchange";
import { ExchangeRateNote } from "@/components/ui/ExchangeRateNote";
import { computeProfileStrength, profileStrengthSuggestion } from "@/lib/residences/profileStrength";
import { MIN_PUBLISH_PHOTOS, hasEnoughPhotosToPublish } from "@/lib/residences/photos";
import { changesRequestedMessageOrFallback } from "@/lib/residences/changesRequest";
import { NO_PERMISSION_NOTE } from "@/lib/residences/permissions";
import {
  SERVICE_OPTIONS,
  COMMON_AREA_OPTIONS,
  ROOM_TYPE_NAMES,
  GENDER_POLICY_OPTIONS,
  ADJUSTMENT_POLICY_OPTIONS,
  serviceLabel,
} from "@/lib/residences/options";
import {
  CUSTOM_AMENITY_MAX,
  MAX_PENDING_CUSTOM_AMENITIES,
  type CustomAmenityKind,
  type CustomAmenityStatus,
} from "@/lib/residences/customAmenities";
import { MAX_RULE_ITEMS, ruleItemsToSummary, type HouseRuleItem } from "@/lib/residences/ruleItems";
import { buildRuleRows } from "@/lib/residences/fichaRules";
import { splitRules as splitRulesLines } from "@/lib/residences/topRules";
import { RulesItemsEditor, newRuleDraft, type RuleDraft } from "@/app/residence/[residence_id]/profile/RulesItemsEditor";
import {
  MAX_OTHER_STAY_DOCUMENTS,
  MAX_OTHER_STAY_DOCUMENT_LENGTH,
  STAY_DOCUMENT_CATALOG,
  sanitizeStayDocumentLabel,
  normalizeRequirementLabel,
  type StayDocumentKey,
} from "@/lib/residences/stayDocuments";
import { CompleteFichaDialog } from "@/app/residence/[residence_id]/profile/CompleteFichaDialog";
import { ProfilePreviewCard } from "@/app/residence/[residence_id]/profile/ProfilePreviewCard";
import { buildCompletionPanel } from "@/lib/residences/completionPanel";
import type { AvailabilityMode } from "@/types/domain";
import { RoomFeaturesField } from "@/app/residence/[residence_id]/profile/RoomFeaturesField";
import { UniversityPicker } from "@/app/residence/[residence_id]/profile/UniversityPicker";
import { ProfileFaqCard } from "@/app/residence/[residence_id]/profile/ProfileFaqCard";
import type { FaqProfileSummary } from "@/lib/faq/profileSummary";
import type { OwnFaqItem } from "@/lib/residences/ownFaq";
import { PhotoMetaManager, type PhotoMetaItem } from "@/app/residence/[residence_id]/profile/PhotoMetaManager";
import { PromotionsManager, type PromotionItem } from "@/app/residence/[residence_id]/profile/PromotionsManager";
import {
  DEPOSIT_OPTIONS,
  ENROLLMENT_DISCOUNT_PRESETS,
  EMPTY_MONTH_PERCENT_PRESETS,
  type DepositMode,
} from "@/lib/applications/reservationMoney";
import {
  saveResidenceProfile,
  type ProfileFormState,
} from "@/app/residence/[residence_id]/profile/actions";

export interface RoomTypeDraft {
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
export interface ConditionsDraft {
  minimumStayMonths: number | "";
  adjustmentPolicy: string;
  /** Pago inicial para reservar (D7/H08, migración 0041): primer mes, monto fijo en USD o solo la matrícula (DR18 t3). */
  initialPaymentMode: "one_month" | "custom_usd" | "enrollment_only" | "deposit_only";
  initialPaymentUsd: number | "";
  enrollmentEnabled: boolean;
  enrollmentFeeMode: "one_month" | "manual";
  enrollmentFeeUsd: number | "";
  enrollmentFeeFrequency: "once" | "annual";
  /** Descuento de matrícula (DR18 t3): % y último día (YYYY-MM-DD, opcional). */
  enrollmentDiscountPercent: number | "";
  enrollmentDiscountUntil: string;
  depositEnabled: boolean;
  /** "" = monto fijo en USD (`depositUsd`); si no, meses de renta de lista (DR18 t3). */
  depositMode: "" | DepositMode;
  depositUsd: number | "";
  emptyMonthsEnabled: boolean;
  /** % de la renta que se cobra por mes vacío, solo si la plaza queda realmente vacía (DR18 t3; presets + manual). */
  emptyMonthChargePercent: number | "";
  /** Política de salida anticipada (DR3, migración 0044): se muestra en la ficha y precarga la respuesta a un aviso. */
  earlyExitDepositClausesText: string;
  earlyExitCostsText: string;
  earlyExitConditionsText: string;
  /** Edad de residentes (DR14, migración 0052). */
  minResidentAge: number | "";
  maxResidentAge: number | "";
  acceptsMinors: boolean;
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
  /** 0073: cantidad de cocinas compartidas y frecuencia de la limpieza general (vacío si no hay o falta la columna). */
  amenityDetails: AmenityDetails;
  nearUniversities: string[];
  /** DR38: documentos que la residencia le pide a sus residentes (claves del catálogo + «Otro»). */
  stayDocuments: { items: StayDocumentKey[]; other: string[] };
  rulesSummary: string;
  /** Reglas principales estructuradas (`rules.items`); vacío si la residencia solo tiene el resumen de texto. */
  rulesItems: HouseRuleItem[];
  rulesFileName: string | null;
  /** DR18: ítems «Otro» ya cargados (con su estado) y si la migración 0058 está aplicada. */
  customAmenities: { id: string; kind: CustomAmenityKind; label: string; status: CustomAmenityStatus; rejectReason: string | null }[];
  customAmenitiesReady: boolean;
  /** DR18: la residencia ya publicó un reglamento propio (si no, se la invita a armarlo con el modelo). */
  hasOwnRegulation: boolean;
  /** Miniatura: slug público, disponibilidad ya guardada (misma regla del catálogo) y coordenada de la residencia (para ordenar las universidades por cercanía). */
  slug: string;
  availabilityMode: AvailabilityMode;
  location: { lat: number; lng: number } | null;
  /** Preguntas propias guardadas (texto libre, sistema anterior al catálogo). */
  faqItems: OwnFaqItem[];
  /** Estado del catálogo de preguntas (elegidas, esenciales, destacadas); `null` si no se pudo cargar. */
  faqSummary: FaqProfileSummary | null;
  /** DR18 (tanda 2): fotos con su clasificación (0059) y los tipos de habitación a los que se pueden asociar. */
  photos: PhotoMetaItem[];
  photoRoomTypes: { id: string; name: string }[];
  photoMetaReady: boolean;
  photoSectionsReady: boolean;
  /** Migración 0074 (orden de portada). */
  photoCoverReady: boolean;
  /** Migración 0097 aplicada: se puede elegir la foto principal. */
  photoMainCoverReady: boolean;
  /** DR18 t3 (migración 0060): promociones de tarifa y si las opciones nuevas de dinero ya se pueden guardar. */
  promotions: PromotionItem[];
  moneyReady: boolean;
  roomTypes: RoomTypeDraft[];
  conditions: ConditionsDraft;
  pendingEditGroups: { fieldGroup: string; createdAt: string; summary: { before: string; after: string } | null }[];
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
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out-fresh ${
          checked ? "translate-x-5" : ""
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

/** Secciones del índice móvil (L9); los ids están en los `Card` de cada sección. */
const PROFILE_SECTIONS = [
  { id: "perfil-datos", label: "Datos" },
  { id: "perfil-edad", label: "Edad" },
  { id: "perfil-servicios", label: "Servicios" },
  { id: "perfil-areas", label: "Áreas comunes" },
  { id: "perfil-reglas", label: "Reglas" },
  { id: "perfil-faq", label: "Preguntas" },
  { id: "perfil-universidades", label: "Universidades" },
  { id: "perfil-documentos", label: "Documentos" },
  { id: "perfil-habitaciones", label: "Habitaciones" },
  { id: "perfil-fotos", label: "Fotos" },
  { id: "perfil-condiciones", label: "Condiciones" },
];

export function ResidenceProfileForm({
  residenceId,
  initial,
  arsPerUsd,
  readOnly = false,
  canSubmit = true,
  draftScope,
}: {
  residenceId: string;
  initial: ProfileInitial;
  arsPerUsd: number;
  /** DR10: el staff ve el perfil sin poder editarlo (campos deshabilitados y sin botones de guardar/enviar). El servidor igual lo rechaza. */
  readOnly?: boolean;
  /** DR11: enviar o reenviar a verificación es solo del dueño, no delegable. Un staff con `profile.edit` guarda pero no envía. */
  canSubmit?: boolean;
  /** Borrador local: quién edita. Sin esto no se guarda borrador en el dispositivo. */
  draftScope?: { userId: string };
}) {
  const action = saveResidenceProfile.bind(null, residenceId);
  const [state, formAction] = useActionState(action, initialState);

  const [tagline, setTagline] = useState(initial.tagline);
  const [description, setDescription] = useState(initial.description);
  const [services, setServices] = useState<Set<string>>(new Set(initial.services));
  const [commonAreas, setCommonAreas] = useState<Set<string>>(new Set(initial.commonAreas));
  const [kitchens, setKitchens] = useState<number>(initial.amenityDetails.kitchens ?? 1);
  const [cleaningMode, setCleaningMode] = useState<"daily" | "weekly">(initial.amenityDetails.cleaningGeneral?.mode ?? "daily");
  const [cleaningPerWeek, setCleaningPerWeek] = useState<number>(
    initial.amenityDetails.cleaningGeneral?.mode === "weekly" ? initial.amenityDetails.cleaningGeneral.perWeek : 3,
  );
  const [nearUniversities, setNearUniversities] = useState<Set<string>>(
    new Set(initial.nearUniversities),
  );
  // DR38: solo el dueño define los documentos; el resto del equipo los ve en solo lectura.
  const [stayDocKeys, setStayDocKeys] = useState<Set<string>>(new Set(initial.stayDocuments.items));
  const [stayDocOther, setStayDocOther] = useState<string[]>(initial.stayDocuments.other);
  const [stayDocDraft, setStayDocDraft] = useState("");
  const [stayDocDraftError, setStayDocDraftError] = useState<string | null>(null);
  function addStayDocOther() {
    const label = sanitizeStayDocumentLabel(stayDocDraft);
    if (!label) return;
    if (label.length > MAX_OTHER_STAY_DOCUMENT_LENGTH) {
      setStayDocDraftError(`Hasta ${MAX_OTHER_STAY_DOCUMENT_LENGTH} caracteres.`);
      return;
    }
    if (stayDocOther.some((l) => normalizeRequirementLabel(l) === normalizeRequirementLabel(label))) {
      setStayDocDraftError("Ya lo agregaste.");
      return;
    }
    if (stayDocOther.length >= MAX_OTHER_STAY_DOCUMENTS) return;
    setStayDocOther((prev) => [...prev, label]);
    setStayDocDraft("");
    setStayDocDraftError(null);
  }
  // Reglas principales: las estructuradas guardadas o, si la residencia solo tiene el resumen de texto, filas armadas a partir de él
  // (la residencia las revisa; no se guarda nada hasta que toca la lista: `rulesDirty`).
  const derivedFromText = initial.rulesItems.length === 0 && initial.rulesSummary.trim().length > 0;
  const [rulesRows, setRulesRows] = useState<RuleDraft[]>(() => {
    if (initial.rulesItems.length > 0) return initial.rulesItems.map((i) => newRuleDraft({ lead: i.lead, title: i.title, detail: i.detail }));
    return buildRuleRows({ summary: initial.rulesSummary })
      .slice(0, MAX_RULE_ITEMS)
      .map((r) => {
        // Solo se prefiere el dato cuando es un horario («23 a 7»); «No»/«Sí» repetirían el título.
        const lead = r.lead && r.lead.includes(" a ") ? r.lead : "";
        if (r.title) return newRuleDraft({ lead, title: r.title.slice(0, 40), detail: r.body.slice(0, 120) });
        return r.body.length <= 40 ? newRuleDraft({ lead, title: r.body }) : newRuleDraft({ lead, detail: r.body.slice(0, 120) });
      });
  });
  const [rulesDirty, setRulesDirty] = useState(false);
  const rulesSummary = rulesDirty
    ? ruleItemsToSummary(rulesRows.filter((r) => r.title.trim()).map((r) => ({ title: r.title.trim() })))
    : initial.rulesSummary.trim();
  const [customItems, setCustomItems] = useState<{ id?: string; kind: CustomAmenityKind; label: string; status: CustomAmenityStatus; rejectReason: string | null }[]>(
    initial.customAmenities,
  );
  const [customDraft, setCustomDraft] = useState<Record<CustomAmenityKind, string>>({ service: "", area: "" });
  const pendingCustomCount = customItems.filter((i) => i.status === "pending").length;

  function addCustomItem(kind: CustomAmenityKind) {
    const label = customDraft[kind].trim();
    if (!label) return;
    if (pendingCustomCount >= MAX_PENDING_CUSTOM_AMENITIES) return;
    setCustomItems((prev) => [...prev, { kind, label, status: "pending", rejectReason: null }]);
    setCustomDraft((prev) => ({ ...prev, [kind]: "" }));
  }
  function removeCustomItem(index: number) {
    setCustomItems((prev) => prev.filter((_, i) => i !== index));
  }
  function renderCustomItems(kind: CustomAmenityKind) {
    const rows = customItems.map((item, index) => ({ item, index })).filter((r) => r.item.kind === kind);
    if (!initial.customAmenitiesReady) {
      return <p className="mt-4 text-xs text-ink-faint">Sumar ítems propios todavía no está disponible. Probá de nuevo en unos días.</p>;
    }
    return (
      <div className="mt-5 border-t border-line pt-4">
        <p className="text-sm font-semibold text-ink">Otro</p>
        <p className="mt-0.5 text-xs text-ink-soft">
          Sumá un {kind === "service" ? "servicio" : "área común"} que no esté en la lista. Se muestra en tu ficha pública cuando el equipo de EstuRed lo aprueba.
        </p>
        {rows.length > 0 && (
          <ul className="mt-3 space-y-2">
            {rows.map(({ item, index }) => (
              <li key={`${item.id ?? "new"}-${index}`} className="flex flex-wrap items-center gap-2 text-sm text-ink">
                <span className="font-medium">{item.label}</span>
                <Badge tone={item.status === "approved" ? "sage" : item.status === "rejected" ? "danger" : "amber"}>
                  {item.status === "approved" ? "Aprobado" : item.status === "rejected" ? "No aprobado" : "Pendiente de revisión"}
                </Badge>
                <button type="button" onClick={() => removeCustomItem(index)} className="text-xs font-semibold text-ink-soft underline">
                  Quitar
                </button>
                {item.status === "rejected" && item.rejectReason && (
                  <span className="basis-full text-xs text-danger-fg">Motivo: {item.rejectReason}</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex gap-2">
          <input
            value={customDraft[kind]}
            onChange={(e) => setCustomDraft((prev) => ({ ...prev, [kind]: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomItem(kind);
              }
            }}
            maxLength={CUSTOM_AMENITY_MAX}
            aria-label={`Otro ${kind === "service" ? "servicio" : "área común"}`}
            placeholder={kind === "service" ? "Ej: Bicicletero" : "Ej: Huerta"}
            className="min-w-0 flex-1 rounded-field border-[1.5px] border-line-2 bg-paper px-3 py-2 text-sm"
          />
          <Button type="button" variant="secondary" onClick={() => addCustomItem(kind)} disabled={pendingCustomCount >= MAX_PENDING_CUSTOM_AMENITIES}>
            Agregar
          </Button>
        </div>
        {pendingCustomCount >= MAX_PENDING_CUSTOM_AMENITIES && (
          <p className="mt-1 text-xs text-ink-faint">Tenés {MAX_PENDING_CUSTOM_AMENITIES} ítems esperando revisión: esperá a que los revisemos para sumar más.</p>
        )}
      </div>
    );
  }
  // Preguntas propias (sistema anterior al catálogo): solo las ya guardadas, sin casilleros vacíos; sumar nuevas se hace desde el catálogo.
  const [faqItems, setFaqItems] = useState<OwnFaqItem[]>(initial.faqItems);
  const [roomTypes, setRoomTypes] = useState<RoomTypeDraft[]>(
    initial.roomTypes.length > 0 ? initial.roomTypes : [emptyRoomType()],
  );
  const [conditions, setConditions] = useState<ConditionsDraft>(initial.conditions);
  // Fotos del editor de la galería (se suben y se aprueban por su cuenta, no con el guardado del perfil).
  const [photoCounts, setPhotoCounts] = useState({ total: initial.photos.length, approved: initial.photos.filter((p) => !p.pending).length });

  // Borrador local (solo en este dispositivo): se guarda solo mientras se escribe y se recupera al volver. No toca el servidor:
  // lo único que guarda en la cuenta es «Guardar cambios» (o «Guardar y salir» en el aviso de salida).
  const draftStamp = useMemo(() => profileStamp(initial), [initial]);
  const draft = useProfileDraft<RoomTypeDraft, ConditionsDraft>({
    residenceId,
    userId: draftScope?.userId ?? "",
    stamp: draftStamp,
    enabled: !readOnly && draftScope !== undefined,
    source: { tagline, description, services, commonAreas, kitchens, cleaningMode, cleaningPerWeek, nearUniversities, stayDocKeys, stayDocOther, rulesRows, rulesDirty, customItems, faqItems, roomTypes, conditions },
    setters: { setTagline, setDescription, setServices, setCommonAreas, setKitchens, setCleaningMode, setCleaningPerWeek, setNearUniversities, setStayDocKeys, setStayDocOther, setRulesRows, setRulesDirty, setCustomItems, setFaqItems, setRoomTypes, setConditions },
    roomTemplate: emptyRoomType(),
  });
  const formRef = useRef<HTMLFormElement>(null);
  const saveWaiter = useRef<((r: { ok: boolean; message?: string }) => void) | null>(null);
  const [accountSavedAt, setAccountSavedAt] = useState<number | null>(null);
  const { completeSave } = draft;
  // «Completá tu ficha» (reglamento, preguntas, compartir): se ofrece tras guardar o enviar, solo si falta algo y no cuando el guardado
  // vino del aviso de salida (esa persona ya se va a otra pantalla).
  const completion = useMemo(
    () =>
      buildCompletionPanel({
        hasOwnRegulation: initial.hasOwnRegulation,
        faq: initial.faqSummary ? { essentialReady: initial.faqSummary.essentialReady, essentialTotal: initial.faqSummary.essentialTotal } : null,
        published: initial.status === "verified_active",
      }),
    [initial.hasOwnRegulation, initial.faqSummary, initial.status],
  );
  const showCompletionRef = useRef(completion.show);
  useEffect(() => {
    showCompletionRef.current = completion.show;
  }, [completion.show]);
  const [completionDialog, setCompletionDialog] = useState<"saved" | "submitted" | null>(null);
  useEffect(() => {
    if (state.status === "idle") return;
    const ok = state.status === "saved" || state.status === "saved_pending_review" || state.status === "submitted";
    const fromLeaveGuard = saveWaiter.current !== null;
    if (ok) {
      completeSave();
      setAccountSavedAt(Date.now());
      if (!fromLeaveGuard && showCompletionRef.current) setCompletionDialog(state.status === "submitted" ? "submitted" : "saved");
    }
    saveWaiter.current?.({ ok, message: state.message });
    saveWaiter.current = null;
  }, [state, completeSave]);
  /** «Guardar y salir» del aviso de salida: envía el formulario como «Guardar cambios» (nunca como «Enviar para revisión») y espera el resultado. */
  const saveAndWait = useCallback(
    () =>
      new Promise<{ ok: boolean; message?: string }>((resolve) => {
        const form = formRef.current;
        if (!form) return resolve({ ok: false });
        if (!form.checkValidity()) return resolve({ ok: false, message: "Hay datos con formato inválido en el formulario. Revisalos o elegí otra opción." });
        saveWaiter.current = resolve;
        form.requestSubmit();
      }),
    [],
  );

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

  const strength = useMemo(
    () =>
      computeProfileStrength({
        tagline,
        description,
        services: services.size,
        commonAreas: commonAreas.size,
        rulesSummary,
        nearUniversities: nearUniversities.size,
        // Solo cuentan las aprobadas: las pendientes todavía no las ve el público.
        photos: photoCounts.approved,
        roomTypesOk: roomTypes.length > 0 && roomTypes.every((rt) => rt.monthlyPriceUsd > 0),
      }),
    [tagline, description, services, commonAreas, rulesSummary, nearUniversities, roomTypes, photoCounts.approved],
  );
  const strengthSuggestion = profileStrengthSuggestion(strength);

  const badge = statusCopy[initial.status] ?? statusCopy.draft;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <ResidenceHero
        icon="settings"
        title="Configuración de Residencia"
        className="mb-6"
        actions={<Badge tone={badge.tone}>{badge.label}</Badge>}
        subtitle={
          readOnly
              ? `Así está cargada la información de ${initial.name}.`
              : initial.status === "draft"
              ? `Completá la información de ${initial.name} para poder publicarla. Guardá cuando quieras como borrador.`
              : initial.status === "verified_active"
                ? `Mantené al día la información de ${initial.name}.`
                : initial.status === "needs_changes"
                  ? `Corregí lo que pidió el equipo de EstuRed en ${initial.name} y reenviala para revisión.`
                  : initial.status === "verification_expired"
                    ? `La verificación anual de ${initial.name} venció. Revisá que el perfil esté al día y reenviala para revisión.`
                  : `Mantené al día la información de ${initial.name} mientras el equipo de EstuRed la revisa.`
        }
      />

      {readOnly && (
        <section
          role="note"
          aria-label="Perfil en solo lectura"
          className="mb-8 flex items-start gap-3 rounded-card border-[1.5px] border-line-2 bg-cream-2 p-4 sm:p-5"
        >
          <Icon name="lock" className="mt-0.5 shrink-0 text-xl text-ink-soft" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink">{NO_PERMISSION_NOTE}</p>
            <p className="mt-1 text-sm text-ink-soft">
              Podés ver cómo está el perfil, pero editar los datos, las tarifas y las condiciones de reserva requiere el permiso «Editar perfil, tarifas y condiciones», y el envío a verificación lo hace siempre el dueño de la residencia.
              {initial.status === "needs_changes" || initial.status === "verification_expired"
                ? " Hay cambios pendientes de corregir: el dueño tiene que reenviarlos para revisión."
                : ""}
            </p>
          </div>
        </section>
      )}

      {!readOnly && initial.status === "needs_changes" && (
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

      {!readOnly && initial.status === "verification_expired" && (
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
          <ul className="mt-3 space-y-3">
            {initial.pendingEditGroups.map((e) => (
              <li key={e.fieldGroup} className="rounded-field bg-paper p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-ink">{FIELD_GROUP_LABELS[e.fieldGroup] ?? e.fieldGroup}</span>
                  <Badge tone="amber">Esperando revisión · enviado el {formatDate(e.createdAt)}</Badge>
                </p>
                {e.summary && (
                  <dl className="mt-2 grid gap-1 sm:grid-cols-[auto_1fr] sm:gap-x-3">
                    <dt className="text-ink-soft">Publicado</dt>
                    <dd className="break-words text-ink">{e.summary.before}</dd>
                    <dt className="text-ink-soft">Enviado</dt>
                    <dd className="break-words font-bold text-ink">{e.summary.after}</dd>
                  </dl>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Bajo lg: Fortaleza compacta + índice de secciones fijo (L9). Desde lg manda la columna lateral. */}
      <div className="mb-4 rounded-card border-[1.5px] border-line bg-paper px-4 py-3 lg:hidden">
        <div className="flex items-center gap-3">
          <p className="text-sm font-bold text-ink">Fortaleza del Perfil</p>
          <div
            role="progressbar"
            aria-label="Fortaleza del Perfil"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={strength.percent}
            className="h-2 flex-1 overflow-hidden rounded-full bg-sand-200"
          >
            <div className="h-full w-full origin-left rounded-full bg-forest transition-transform duration-300 ease-out-fresh" style={{ transform: `scaleX(${strength.percent / 100})` }} />
          </div>
          <p className="text-sm font-bold text-forest-700">{strength.percent}%</p>
        </div>
        {strengthSuggestion && <p className="mt-1.5 text-xs text-ink-soft">{strengthSuggestion}</p>}
      </div>
      <SectionNav
        label="Secciones del perfil"
        className="sticky top-0 z-30 mb-6 lg:hidden"
        rootMargin="-60px 0px -60% 0px"
        items={PROFILE_SECTIONS}
      />

      <DraftNotice
        notice={draft.notice}
        what="tus cambios sin guardar"
        extra="Si habías elegido fotos o un PDF, volvé a elegirlos: los archivos no se guardan en el borrador."
        onDiscard={draft.discard}
        onAccept={draft.acceptStale}
        onDismiss={draft.dismissNotice}
        className="mb-6"
      />
      <UnsavedChangesGuard
        active={draft.dirty}
        description="Lo que escribiste sigue como borrador en este dispositivo y lo recuperás al volver, pero todavía no está en tu cuenta."
        impactNote={saveImpactNote(initial.status)}
        onSave={saveAndWait}
        onLeave={draft.saveNow}
      />
      <CompleteFichaDialog
        open={completionDialog !== null}
        onClose={() => setCompletionDialog(null)}
        residenceId={residenceId}
        variant={completionDialog ?? "saved"}
        rows={completion.rows}
      />

      <form
        ref={formRef}
        action={(fd) => {
          draft.beginSave();
          // El intent viaja como name/value del <button> que disparó el
          // submit (patrón HTML nativo) — leer el botón evita la carrera
          // de usar onClick + estado de React para decidirlo.
          fd.set("room_types_json", JSON.stringify(roomTypes));
          fd.set("stay_documents_other_json", JSON.stringify(stayDocOther));
          fd.set("custom_amenities_json", JSON.stringify(customItems.map((i) => ({ id: i.id, kind: i.kind, label: i.label }))));
          // Siempre se manda (aunque esté vacío): así quitar todas las preguntas propias se guarda, y su ausencia nunca borra nada.
          fd.set("faq_json", JSON.stringify(faqItems.filter((f) => f.question.trim() && f.answer.trim())));
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
              enrollmentDiscountPercent: conditions.enrollmentEnabled ? conditions.enrollmentDiscountPercent : null,
              enrollmentDiscountUntil: conditions.enrollmentEnabled ? conditions.enrollmentDiscountUntil : null,
              depositUsd: conditions.depositEnabled && !conditions.depositMode ? conditions.depositUsd : null,
              depositMode: conditions.depositEnabled && conditions.depositMode ? conditions.depositMode : null,
              emptyMonthChargePercent: conditions.emptyMonthsEnabled ? conditions.emptyMonthChargePercent : null,
              earlyExitDepositClausesText: conditions.earlyExitDepositClausesText,
              earlyExitCostsText: conditions.earlyExitCostsText,
              earlyExitConditionsText: conditions.earlyExitConditionsText,
              minResidentAge: conditions.minResidentAge,
              maxResidentAge: conditions.maxResidentAge,
              acceptsMinors: conditions.acceptsMinors,
            }),
          );
          formAction(fd);
        }}
        className={`grid gap-8 lg:grid-cols-[1fr_320px] ${readOnly ? "" : "max-md:pb-40 md:max-lg:pb-4"}`}
      >
        <fieldset disabled={readOnly} className="m-0 min-w-0 space-y-6 border-0 p-0">
          {/* Datos básicos (algunos read-only: se fijan al registrarse) */}
          <Card id="perfil-datos" className="p-6 max-lg:scroll-mt-14">
            <h2 className="text-lg font-bold text-ink">Datos Básicos</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input label="Nombre de la residencia" value={initial.name} disabled hint="Se fija al registrarse." />
              <Input
                label="Barrio"
                value={initial.zone}
                disabled
              />
            </div>
            <Input
              label="Dirección completa"
              value={initial.addressLine}
              disabled
              className="mt-4"
              hint="Se muestra en tu ficha pública. Para corregirla, escribinos a Soporte."
            />
            <Input
              label="Frase corta (eslogan)"
              id="tagline"
              name="tagline"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={80}
              placeholder="Tu lugar de casa"
              hint={`Visible en resultados de búsqueda. Una idea breve que te distinga (ej.: «A 10 cuadras de Ciudad Universitaria»); sin teléfonos, enlaces ni promesas. ${tagline.length}/80 caracteres.`}
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
              hint="Contá lo que hace distinta a tu residencia: el ambiente, la convivencia, el barrio, qué tipo de estudiantes viven ahí. No repitas lo que ya figura en servicios, áreas comunes o precios, ni pongas teléfonos, enlaces externos o promesas (por ejemplo, «siempre habrá lugar»)."
            />
          </Card>

          {/* Edad de los residentes: va justo después de los datos básicos (auditoría del Owner, DR18) */}
          <Card id="perfil-edad" className="p-6 max-lg:scroll-mt-14">
            <h2 className="text-lg font-bold text-ink">Edad de los residentes</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Los estudiantes ven solo las residencias que aceptan su edad. Si no cargás nada, aceptás desde los 18 años y sin tope.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input
                label="Edad mínima"
                type="number"
                min={conditions.acceptsMinors ? 10 : 18}
                max={99}
                disabled={readOnly}
                value={conditions.minResidentAge}
                onChange={(e) => updateConditions({ minResidentAge: e.target.value ? Number(e.target.value) : "" })}
                hint="Mínimo 18, salvo que aceptes menores."
              />
              <Input
                label="Edad máxima (opcional)"
                type="number"
                min={18}
                max={99}
                disabled={readOnly}
                value={conditions.maxResidentAge}
                onChange={(e) => updateConditions({ maxResidentAge: e.target.value ? Number(e.target.value) : "" })}
                hint="Dejala vacía si no tenés tope."
              />
            </div>
            <label className="max-lg:min-h-11 mt-4 flex items-start gap-3 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 max-lg:size-5!"
                disabled={readOnly}
                checked={conditions.acceptsMinors}
                onChange={(e) =>
                  updateConditions({
                    acceptsMinors: e.target.checked,
                    ...(!e.target.checked && Number(conditions.minResidentAge) < 18 ? { minResidentAge: 18 } : {}),
                  })
                }
              />
              <span>
                <span className="font-semibold">Acepto residentes menores de 18</span>
                <span className="mt-0.5 block text-ink-soft">
                  La decidís vos, sin aprobación de EstuRed. Con esta opción tu ficha pública suma el apartado «Para menores de 18», y cada
                  solicitud de un menor debe confirmarla su guardián.
                </span>
              </span>
            </label>
            {conditions.acceptsMinors && (
              <p className="mt-3 rounded-field bg-amber-soft-100 px-4 py-3 text-sm text-ink">
                Al guardar, tu ficha mostrará el apartado para menores. Revisá tu reglamento y tus condiciones: aplican igual para ellos.
              </p>
            )}
          </Card>

          {/* Servicios */}
          <Card id="perfil-servicios" className="p-6 max-lg:scroll-mt-14">
            <h2 className="text-lg font-bold text-ink">Servicios Incluidos</h2>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
              {SERVICE_OPTIONS.map((s) => (
                <label key={s} className="max-lg:min-h-11 flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="services"
                    value={s}
                    checked={services.has(s)}
                    onChange={() => toggle(services, setServices, s)}
                    className="h-4 w-4 max-lg:size-5! accent-forest"
                  />
                  {serviceLabel(s)}
                </label>
              ))}
            </div>
            {services.has(CLEANING_SERVICE) && (
              <fieldset className="mt-4 rounded-field border border-sand-200 bg-sand-50 p-3">
                <legend className="px-1 text-xs font-semibold text-ink-soft">Frecuencia de la limpieza general</legend>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink">
                  <label className="max-lg:min-h-11 flex items-center gap-2">
                    <input type="radio" name="amenity_cleaning_mode" value="daily" checked={cleaningMode === "daily"} onChange={() => setCleaningMode("daily")} className="h-4 w-4 max-lg:size-5! accent-forest" />
                    Todos los días
                  </label>
                  <label className="max-lg:min-h-11 flex items-center gap-2">
                    <input type="radio" name="amenity_cleaning_mode" value="weekly" checked={cleaningMode === "weekly"} onChange={() => setCleaningMode("weekly")} className="h-4 w-4 max-lg:size-5! accent-forest" />
                    <select
                      name="amenity_cleaning_per_week"
                      aria-label="Veces por semana"
                      value={cleaningPerWeek}
                      disabled={cleaningMode !== "weekly"}
                      onChange={(e) => { setCleaningPerWeek(Number(e.target.value)); setCleaningMode("weekly"); }}
                      className="rounded-field border border-sand-300 bg-white px-2 py-1 text-sm"
                    >
                      {Array.from({ length: CLEANING_PER_WEEK_MAX }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    veces por semana
                  </label>
                </div>
              </fieldset>
            )}
            {renderCustomItems("service")}
          </Card>

          {/* Áreas comunes */}
          <Card id="perfil-areas" className="p-6 max-lg:scroll-mt-14">
            <h2 className="text-lg font-bold text-ink">Áreas Comunes</h2>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
              {COMMON_AREA_OPTIONS.map((a) => (
                <label key={a} className="max-lg:min-h-11 flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="common_areas"
                    value={a}
                    checked={commonAreas.has(a)}
                    onChange={() => toggle(commonAreas, setCommonAreas, a)}
                    className="h-4 w-4 max-lg:size-5! accent-forest"
                  />
                  {serviceLabel(a)}
                </label>
              ))}
            </div>
            {commonAreas.has(KITCHEN_AREA) && (
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-field border border-sand-200 bg-sand-50 p-3 text-sm text-ink">
                <label htmlFor="amenity_kitchens" className="font-semibold">Cantidad de cocinas compartidas</label>
                <select
                  id="amenity_kitchens"
                  name="amenity_kitchens"
                  value={kitchens}
                  onChange={(e) => setKitchens(Number(e.target.value))}
                  className="rounded-field border border-sand-300 bg-white px-2 py-1 text-sm"
                >
                  {Array.from({ length: KITCHENS_MAX }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            )}
            {renderCustomItems("area")}
          </Card>

          {/* Reglas y políticas */}
          <Card id="perfil-reglas" className="p-6 max-lg:scroll-mt-14">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">Reglas y Políticas</h2>
              <Badge tone="amber">Datos sensibles</Badge>
            </div>
            <p className="mt-2 rounded-field bg-warning-bg px-3 py-2 text-xs text-warning-fg">
              Atención: cualquier cambio en esta sección requiere validación del equipo de EstuRed
              antes de ser público.
            </p>
            <div className="mt-4">
              <p className="text-sm font-medium text-ink">Reglas principales</p>
              <p className="mt-0.5 text-xs text-ink-soft">
                Hasta {MAX_RULE_ITEMS} reglas, las más importantes. Se muestran en tu ficha pública con el dato grande a la izquierda; el detalle completo va en el
                reglamento. Ejemplo: <strong>23 a 7</strong> · Silencio · Para música o videos, auriculares. Otro: <strong>Libre</strong> · Entrada y salida · Con tu
                llave, sin horario de llegada.
              </p>
              {derivedFromText && !rulesDirty && (
                <p className="mt-2 rounded-field bg-forest-tint px-3 py-2 text-xs text-ink">
                  Armamos estas filas a partir del texto que tenías cargado. Revisalas y completalas: hasta que no cambies algo, tu ficha sigue mostrando lo de antes.
                </p>
              )}
              <input type="hidden" name="rules_summary" value={initial.rulesSummary} />
              <input type="hidden" name="rules_items_dirty" value={rulesDirty ? "1" : "0"} />
              <input
                type="hidden"
                name="rules_items_json"
                value={JSON.stringify(rulesRows.map((r) => ({ lead: r.lead, title: r.title, detail: r.detail })))}
              />
              <div className="mt-3">
                <RulesItemsEditor
                  rows={rulesRows}
                  onChange={(next) => {
                    setRulesRows(next);
                    setRulesDirty(true);
                  }}
                />
              </div>
              {splitRulesLines(initial.rulesSummary).length > MAX_RULE_ITEMS && !rulesDirty && (
                <p className="mt-2 text-xs text-warning-fg">
                  Tenías más de {MAX_RULE_ITEMS} reglas cargadas: acá ves las primeras {MAX_RULE_ITEMS}. Si guardás cambios en esta lista, quedan solo esas.
                </p>
              )}
            </div>
            {!initial.hasOwnRegulation && (
              <p className="mt-4 rounded-field bg-forest-tint px-4 py-3 text-sm text-ink">
                Si no tenés reglamento, armalo con nuestro modelo.{" "}
                <a href={`/residence/${residenceId}/regulation`} className="font-semibold text-forest-700 underline">
                  Ir al reglamento
                </a>
                . Un reglamento completo y prolijo evita problemas a futuro y preguntas repetidas antes de reservar. Lo que escribas acá queda
                como borrador en este dispositivo: podés ir, volver con «Volver a la configuración» y seguir.
              </p>
            )}
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

          {/* Preguntas frecuentes: se eligen del catálogo en /faq; acá el estado real y, si existen, las preguntas propias anteriores */}
          <ProfileFaqCard residenceId={residenceId} summary={initial.faqSummary} ownItems={faqItems} onChangeOwn={setFaqItems} />

          {/* Universidades cercanas */}
          <Card id="perfil-universidades" className="p-6 max-lg:scroll-mt-14">
            <h2 className="text-lg font-bold text-ink">Proximidad a Universidades</h2>
            <p className="mt-1 text-sm text-ink-soft">Elegí solo las sedes a no más de 15 cuadras (≈1,5 km) de tu residencia: es lo que buscan los estudiantes al filtrar por universidad.</p>
            <UniversityPicker selected={nearUniversities} onToggle={(name) => toggle(nearUniversities, setNearUniversities, name)} />
          </Card>

          {/* DR38: documentos que se le piden al residente. Solo el dueño los edita; no es contenido público. */}
          <Card id="perfil-documentos" className="p-6 max-lg:scroll-mt-14">
            <h2 className="text-lg font-bold text-ink">Documentos que pedís a tus residentes</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Elegí qué documentos tiene que presentar quien se aloja. A cada estudiante solo le pedimos los que todavía no tiene cargados en su perfil, y
              vos ves en Residentes si lo entregó. Es privado: no se muestra en tu ficha.
            </p>
            <fieldset disabled={readOnly || !canSubmit} className="m-0 mt-4 min-w-0 border-0 p-0">
              <input type="hidden" name="stay_documents_present" value="1" />
              <div className="grid gap-2.5 sm:grid-cols-2">
                {STAY_DOCUMENT_CATALOG.map((d) => (
                  <label key={d.key} className="max-lg:min-h-11 flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      name="stay_documents"
                      value={d.key}
                      checked={stayDocKeys.has(d.key)}
                      onChange={() => toggle(stayDocKeys, setStayDocKeys, d.key)}
                      className="h-4 w-4 max-lg:size-5! accent-forest"
                    />
                    {d.label}
                  </label>
                ))}
              </div>

              <p className="mt-5 text-sm font-semibold text-ink">Otro documento</p>
              <p className="mt-0.5 text-xs text-ink-faint">
                Si pedís algo más (por ejemplo, un seguro médico o una carta de aceptación). Hasta {MAX_OTHER_STAY_DOCUMENTS}.
              </p>
              {stayDocOther.length > 0 && (
                <ul className="mt-2.5 flex flex-wrap gap-2">
                  {stayDocOther.map((label) => (
                    <li key={label} className="flex items-center gap-1 rounded-full border border-line bg-cream-2 py-1 pl-3 pr-1.5 text-sm text-ink">
                      {label}
                      <button
                        type="button"
                        onClick={() => setStayDocOther((prev) => prev.filter((l) => l !== label))}
                        className="rounded-full p-1 text-ink-faint hover:text-danger-fg"
                        aria-label={`Quitar ${label}`}
                      >
                        <Icon name="close" className="text-base" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {stayDocOther.length < MAX_OTHER_STAY_DOCUMENTS && (
                <div className="mt-2.5 flex flex-wrap items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Input
                      label="Nombre del documento"
                      value={stayDocDraft}
                      maxLength={MAX_OTHER_STAY_DOCUMENT_LENGTH}
                      onChange={(e) => {
                        setStayDocDraft(e.target.value);
                        setStayDocDraftError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addStayDocOther();
                        }
                      }}
                      hint={stayDocDraftError ? <span role="alert" className="font-medium text-danger-fg">{stayDocDraftError}</span> : undefined}
                      placeholder="Ej: Seguro médico"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addStayDocOther}
                    disabled={!stayDocDraft.trim()}
                    className="mt-7 shrink-0 rounded-full border-[1.5px] border-line px-4 py-2 text-sm font-bold text-ink-soft hover:border-forest hover:text-forest-700 disabled:opacity-50"
                  >
                    Agregar
                  </button>
                </div>
              )}
              {!canSubmit && !readOnly && (
                <p className="mt-3 text-xs text-ink-faint">Esta lista la define el dueño de la residencia.</p>
              )}
            </fieldset>
          </Card>

          {/* Tipos de habitación */}
          <Card id="perfil-habitaciones" className="p-6 max-lg:scroll-mt-14">
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
                      <label key={b} className="max-lg:min-h-11 flex items-center gap-1.5 text-sm capitalize text-ink-soft">
                        <input
                          type="radio"
                          checked={rt.bathroomType === b}
                          onChange={() => updateRoomType(i, { bathroomType: b })}
                          className="h-4 w-4 max-lg:size-5! accent-forest"
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
                  <RoomFeaturesField features={rt.features} onChange={(next) => updateRoomType(i, { features: next })} />
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

          {/* Galería de fotos: va después de los tipos de habitación porque sus secciones salen de las áreas comunes y de esos tipos */}
          <Card id="perfil-fotos" className="p-6 max-lg:scroll-mt-14">
            <h2 className="text-lg font-bold text-ink">Galería de Fotos</h2>
            {initial.status !== "verified_active" && <PhotosRequirementNotice count={photoCounts.approved} />}
            <PhotoMetaManager
              residenceId={residenceId}
              initialItems={initial.photos}
              roomTypes={initial.photoRoomTypes}
              unsavedRoomTypeNames={roomTypes
                .filter((rt) => !rt.id && !initial.photoRoomTypes.some((p) => p.name === rt.name))
                .map((rt) => rt.name)}
              commonAreas={COMMON_AREA_OPTIONS.filter((a) => commonAreas.has(a))}
              customAreas={customItems.filter((i) => i.kind === "area" && i.status !== "rejected")}
              schemaReady={initial.photoMetaReady}
              sectionsReady={initial.photoSectionsReady}
              coverReady={initial.photoCoverReady}
              mainCoverReady={initial.photoMainCoverReady}
              readOnly={readOnly}
              onCountsChange={setPhotoCounts}
            />
          </Card>

          {/* Condiciones de Reserva — generales a todos los tipos (ref
              de configuración; migración 0025) */}
          <Card id="perfil-condiciones" className="p-6 max-lg:scroll-mt-14">
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
              <p className="font-semibold text-ink">Pago inicial para confirmar la reserva</p>
              <p className="text-xs text-ink-soft">
                Lo que el estudiante te paga a vos, directamente, para reservar. Se muestra igual en tu ficha, en la
                solicitud y en el mensaje de WhatsApp. El fee de EstuRed va aparte y no depende de este monto.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <label className="max-lg:min-h-11 flex items-center gap-1.5 text-sm text-ink-soft">
                  <input
                    type="radio"
                    name="initial_payment_mode"
                    checked={conditions.initialPaymentMode === "one_month"}
                    onChange={() => updateConditions({ initialPaymentMode: "one_month" })}
                    className="h-4 w-4 max-lg:size-5! accent-forest"
                  />
                  Primer mes de renta
                </label>
                <label className="max-lg:min-h-11 flex items-center gap-1.5 text-sm text-ink-soft">
                  <input
                    type="radio"
                    name="initial_payment_mode"
                    checked={conditions.initialPaymentMode === "enrollment_only"}
                    disabled={!conditions.enrollmentEnabled || !initial.moneyReady}
                    onChange={() => updateConditions({ initialPaymentMode: "enrollment_only" })}
                    className="h-4 w-4 max-lg:size-5! accent-forest"
                  />
                  Matrícula
                </label>
                <label className="max-lg:min-h-11 flex items-center gap-1.5 text-sm text-ink-soft">
                  <input
                    type="radio"
                    name="initial_payment_mode"
                    checked={conditions.initialPaymentMode === "deposit_only"}
                    disabled={!conditions.depositEnabled || !initial.moneyReady}
                    onChange={() => updateConditions({ initialPaymentMode: "deposit_only" })}
                    className="h-4 w-4 max-lg:size-5! accent-forest"
                  />
                  Depósito
                </label>
                <label className="max-lg:min-h-11 flex items-center gap-1.5 text-sm text-ink-soft">
                  <input
                    type="radio"
                    name="initial_payment_mode"
                    checked={conditions.initialPaymentMode === "custom_usd"}
                    onChange={() => updateConditions({ initialPaymentMode: "custom_usd" })}
                    className="h-4 w-4 max-lg:size-5! accent-forest"
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
                  ? "Es la tarifa mensual del tipo de habitación que elija el estudiante (con la promoción vigente, si hay). Es el valor por defecto."
                  : conditions.initialPaymentMode === "enrollment_only"
                    ? "El estudiante te paga la matrícula (ya con su descuento) para confirmar la reserva; la renta se paga mes a mes. Si la matrícula queda bonificada al 100%, el pago inicial pasa a ser el primer mes."
                    : conditions.initialPaymentMode === "deposit_only"
                      ? "El estudiante te paga el depósito del tipo que elija (reembolsable) para confirmar la reserva; la renta se paga mes a mes. Si no pedís depósito, el pago inicial pasa a ser el primer mes."
                      : "Es el mismo monto para todos los tipos de habitación. Las solicitudes ya enviadas conservan el monto con el que se crearon."}
                {(!conditions.enrollmentEnabled || !conditions.depositEnabled) &&
                  " «Matrícula» y «Depósito» se habilitan cuando activás cobrar matrícula o pedir depósito (son excluyentes entre sí)."}
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
                <p className="mt-2 text-xs text-ink-faint">Excluyente con el depósito.</p>
              )}
              {conditions.enrollmentEnabled && (
                <div className="mt-4 space-y-3 border-t border-sand-200 pt-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="text-xs font-bold uppercase tracking-wide text-muted">Equivalente a</span>
                    <label className="max-lg:min-h-11 flex items-center gap-1.5 text-sm text-ink-soft">
                      <input
                        type="radio"
                        checked={conditions.enrollmentFeeMode === "one_month"}
                        onChange={() => updateConditions({ enrollmentFeeMode: "one_month" })}
                        className="h-4 w-4 max-lg:size-5! accent-forest"
                      />
                      1 mes de renta
                    </label>
                    <label className="max-lg:min-h-11 flex items-center gap-1.5 text-sm text-ink-soft">
                      <input
                        type="radio"
                        checked={conditions.enrollmentFeeMode === "manual"}
                        onChange={() => updateConditions({ enrollmentFeeMode: "manual" })}
                        className="h-4 w-4 max-lg:size-5! accent-forest"
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
                      <label key={f.value} className="max-lg:min-h-11 flex items-center gap-1.5 text-sm text-ink-soft">
                        <input
                          type="radio"
                          checked={conditions.enrollmentFeeFrequency === f.value}
                          onChange={() => updateConditions({ enrollmentFeeFrequency: f.value })}
                          className="h-4 w-4 max-lg:size-5! accent-forest"
                        />
                        {f.label}
                      </label>
                    ))}
                  </div>
                  {/* Descuento de matrícula (DR18 t3): el fee se calcula sobre la matrícula ya descontada. */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-muted">Descuento de matrícula (opcional)</span>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {[...ENROLLMENT_DISCOUNT_PRESETS].map((p) => (
                          <button
                            key={p}
                            type="button"
                            disabled={!initial.moneyReady}
                            aria-pressed={conditions.enrollmentDiscountPercent === p}
                            onClick={() => updateConditions({ enrollmentDiscountPercent: conditions.enrollmentDiscountPercent === p ? "" : p })}
                            className={`rounded-full border px-3 py-1 text-sm ${conditions.enrollmentDiscountPercent === p ? "border-forest bg-forest-tint font-semibold text-forest-700" : "border-sand-300 text-ink-soft"}`}
                          >
                            {p === 100 ? "100% (bonificada)" : `${p}%`}
                          </button>
                        ))}
                      </div>
                      <div className="w-28">
                        <Input
                          label="Otro %"
                          type="number"
                          min={1}
                          max={100}
                          disabled={!initial.moneyReady}
                          value={conditions.enrollmentDiscountPercent}
                          onChange={(e) => updateConditions({ enrollmentDiscountPercent: e.target.value ? Number(e.target.value) : "" })}
                        />
                      </div>
                      <div className="w-44">
                        <Input
                          label="Vigente hasta (opcional)"
                          type="date"
                          disabled={!initial.moneyReady || conditions.enrollmentDiscountPercent === ""}
                          value={conditions.enrollmentDiscountUntil}
                          onChange={(e) => updateConditions({ enrollmentDiscountUntil: e.target.value })}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-ink-faint">
                      Ejemplo: 50% hasta mitad de año o 100% por ahora. Sin fecha, rige hasta que lo quites. EstuRed calcula su fee sobre lo que
                      realmente paga el estudiante (la matrícula ya descontada).
                      {!initial.moneyReady && " Muy pronto vas a poder usarlo."}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Depósito */}
            <div className="mt-4 rounded-card border border-sand-200 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-ink">Depósito</p>
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
                <div className="mt-4 space-y-3 border-t border-sand-200 pt-4">
                  <Select
                    label="Monto del depósito"
                    value={conditions.depositMode}
                    disabled={!initial.moneyReady && conditions.depositMode === ""}
                    onChange={(e) => updateConditions({ depositMode: e.target.value as "" | DepositMode })}
                    hint="En meses de renta se calcula sobre la tarifa de cada tipo de habitación. Siempre es reembolsable y no entra a la base del fee."
                  >
                    <option value="">Monto fijo en USD</option>
                    {initial.moneyReady &&
                      DEPOSIT_OPTIONS.map((o) => (
                        <option key={o.mode} value={o.mode}>
                          {o.label}
                        </option>
                      ))}
                  </Select>
                  {conditions.depositMode === "" && (
                    <div className="w-40">
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
              )}
            </div>

            {/* Meses vacíos */}
            <div className="mt-4 rounded-card border border-sand-200 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-ink">
                    Cobro de mes vacío:{" "}
                    <span className={conditions.emptyMonthsEnabled ? "text-forest-700" : "text-ink-soft"}>
                      {conditions.emptyMonthsEnabled ? "sí" : "no"}
                    </span>
                  </p>
                  <p className="text-xs font-semibold text-ink-soft">
                    Es una elección de tu residencia. Se muestra a los estudiantes en la tarjeta «Mes vacío» de la ficha.
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    Cuando un estudiante reserva para ingresar más adelante y la plaza queda libre mientras tanto, podés cobrar un porcentaje de la renta (no la renta entera) por ese tiempo, hasta 3 meses.
                  </p>
                </div>
                <Switch
                  checked={conditions.emptyMonthsEnabled}
                  onChange={(v) =>
                    updateConditions({
                      emptyMonthsEnabled: v,
                      ...(v && conditions.emptyMonthChargePercent === "" ? { emptyMonthChargePercent: 50 } : {}),
                    })
                  }
                  label="Cobrar meses vacíos"
                />
              </div>
              {conditions.emptyMonthsEnabled && (
                <div className="mt-4 space-y-3 border-t border-sand-200 pt-4">
                  <p className="text-sm font-semibold text-ink">¿Qué porcentaje de la renta se cobra por cada mes vacío?</p>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {[...EMPTY_MONTH_PERCENT_PRESETS].map((p) => (
                        <button
                          key={p}
                          type="button"
                          aria-pressed={conditions.emptyMonthChargePercent === p}
                          onClick={() => updateConditions({ emptyMonthChargePercent: p })}
                          className={`rounded-full border px-3 py-1 text-sm ${conditions.emptyMonthChargePercent === p ? "border-forest bg-forest-tint font-semibold text-forest-700" : "border-sand-300 text-ink-soft"}`}
                        >
                          {p}%
                        </button>
                      ))}
                    </div>
                    <div className="w-28">
                      <Input
                        label="Otro %"
                        type="number"
                        min={1}
                        max={100}
                        value={conditions.emptyMonthChargePercent}
                        onChange={(e) => updateConditions({ emptyMonthChargePercent: e.target.value ? Number(e.target.value) : "" })}
                      />
                    </div>
                  </div>
                  <div className="space-y-3 rounded-field bg-sand-50 p-3 text-sm leading-relaxed text-ink-soft">
                    <div>
                      <p className="font-semibold text-ink">¿Qué es?</p>
                      <p>
                        Si un estudiante reserva para ingresar más adelante y la plaza está libre mientras tanto, se la guardás: por ese
                        tiempo sin él adentro (el «mes vacío») cobrás un porcentaje de la renta, no la renta entera. No es un descuento: es un
                        cargo parcial por guardar la plaza vacía.
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-ink">¿Cuándo se cobra?</p>
                      <p>
                        Solo si el ingreso es diferido y la plaza estuvo realmente libre hasta que llega. Se cuenta desde que la habitación está
                        disponible hasta el día anterior al ingreso, en proporción a los días: más de 15 días extra cuentan como un mes y 15 o
                        menos como medio mes. Hasta 3 meses por reserva. Si ese tiempo estaba ocupado por otro residente, no se cobra.
                      </p>
                      <p className="mt-1.5 text-xs">
                        Ejemplo: disponible desde hoy (28/10) e ingresa el 1/12 → 1 mes y medio vacío. Ingresa el 20/12 → 2 meses. Si no hay
                        disponibilidad publicada, el estudiante ve «a confirmar por la residencia» y no se suma al total. Lo cobrado se paga a
                        la residencia y entra en la base del fee de EstuRed, igual que la matrícula.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Promociones de tarifa (DR18 t3) */}
            <div className="mt-4 rounded-card border border-sand-200 p-4">
              <p className="font-semibold text-ink">Promociones sobre la renta</p>
              <p className="text-xs text-ink-soft">
                Un descuento por tiempo limitado, en cualquier momento del año, sin tocar tus tarifas. En tu ficha se ve «antes / ahora».
              </p>
              <PromotionsManager
                residenceId={residenceId}
                initialItems={initial.promotions}
                roomTypes={initial.photoRoomTypes}
                schemaReady={initial.moneyReady}
                readOnly={readOnly}
              />
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

          {!readOnly && (
            <>
          {/* Bajo md: barra fija sobre la tab bar. Los 61px = alto de MobileTabBar sin safe-area (1 borde + 4 pt + 56 min-h-14): si cambia ese alto, cambiar acá. De md a lg: sticky en el main (no pisa la sidebar). Desde lg, en el flujo. */}
          <div className="max-md:fixed max-md:inset-x-0 max-md:bottom-[calc(61px+max(0.25rem,env(safe-area-inset-bottom)))] max-lg:mb-0! max-lg:z-30 md:max-lg:sticky md:max-lg:bottom-0 md:max-lg:-mx-4 sm:md:max-lg:-mx-6 max-lg:border-t max-lg:border-line max-lg:bg-paper/95 max-lg:px-4 max-lg:py-2 max-lg:backdrop-blur md:max-lg:pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:contents">
          <div className="space-y-2 max-lg:mb-2 max-lg:max-h-24 max-lg:overflow-y-auto max-lg:empty:hidden max-lg:[&>p]:py-2 max-lg:[&>p]:text-xs lg:contents">
          <SaveStatus
            dirty={draft.dirty}
            localState={draft.localState}
            localSavedAt={draft.savedAt}
            accountSavedAt={accountSavedAt}
            className="max-lg:py-0! sm:text-right"
          />
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

          </div>

          <div className="flex gap-3 sm:justify-end max-lg:[&>*]:flex-1 max-sm:[&>*:first-child]:flex-[0_0_38%]">
            <SubmitButton intent="draft" variant="outline" idleLabel="Guardar cambios" pendingLabel="Guardando…" />
            {canSubmit && (
              <SubmitButton
                intent="submit"
                variant="primary"
                idleLabel={initial.status === "needs_changes" || initial.status === "verification_expired" ? "Reenviar para revisión" : "Enviar para revisión"}
                pendingLabel="Enviando…"
              />
            )}
          </div>
          </div>
          {!canSubmit && (
            <p className="flex items-start gap-1.5 text-xs text-ink-soft sm:justify-end">
              <Icon name="lock" className="mt-px text-sm" />
              Enviar el perfil a verificación lo hace solo el dueño.
            </p>
          )}
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
            </>
          )}
        </fieldset>

        {/* Sidebar */}
        <aside className="space-y-6">
          <Card className="sticky top-24 p-5 max-lg:hidden">
            <h3 className="font-bold text-ink">Fortaleza del Perfil</h3>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-sand-200">
              <div className="h-full w-full origin-left rounded-full bg-forest transition-transform duration-300 ease-out-fresh" style={{ transform: `scaleX(${strength.percent / 100})` }} />
            </div>
            <p className="mt-1 text-right text-sm font-bold text-forest-700">{strength.percent}%</p>
            {strengthSuggestion && (
              <p className="mt-2 rounded-field bg-sand-100 px-3 py-2 text-xs text-ink-soft">{strengthSuggestion}</p>
            )}
          </Card>

          <ProfilePreviewCard
            residenceId={residenceId}
            slug={initial.slug}
            name={initial.name}
            zone={initial.zone}
            status={initial.status}
            availabilityMode={initial.availabilityMode}
            description={description}
            services={services}
            commonAreas={commonAreas}
            approvedExtraServices={customItems.filter((i) => i.kind === "service" && i.status === "approved").map((i) => i.label)}
            approvedExtraAreas={customItems.filter((i) => i.kind === "area" && i.status === "approved").map((i) => i.label)}
            nearUniversities={nearUniversities}
            roomTypes={roomTypes}
            photos={initial.photos}
            location={initial.location}
            arsPerUsd={arsPerUsd}
            hasUnsavedChanges={draft.dirty}
          />

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
    <Button type="submit" name="intent" value={intent} variant={variant} disabled={pending} className="whitespace-nowrap max-lg:px-2 max-sm:text-[13px]">
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
          Tienen que ser fotos propias (luz natural, ambientes comunes y una por tipo de habitación). Para publicar el
          equipo de EstuRed considera solo las fotos ya cargadas y aprobadas. Mientras tanto, tu residencia se muestra
          con una ilustración.
        </p>
      )}
    </div>
  );
}
