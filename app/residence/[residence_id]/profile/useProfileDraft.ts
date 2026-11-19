"use client";

import { useCallback } from "react";
import { useLocalDraft } from "@/components/forms/useLocalDraft";
import { draftStorageKey } from "@/lib/forms/localDraft";
import { newRuleDraft, type RuleDraft } from "@/app/residence/[residence_id]/profile/RulesItemsEditor";
import { dropBlankOwnFaq } from "@/lib/residences/ownFaq";
import type { CustomAmenityKind, CustomAmenityStatus } from "@/lib/residences/customAmenities";
import {
  PROFILE_DRAFT_SCOPE,
  mergeByTemplate,
  sanitizeProfileDraft,
  sanitizeRoomTypes,
  toProfileDraftData,
  type ProfileDraftData,
  type ProfileDraftSource,
} from "@/lib/residences/profileDraft";

type CustomItemDraft = { id?: string; kind: CustomAmenityKind; label: string; status: CustomAmenityStatus; rejectReason: string | null };

/** Setters del formulario que el borrador sabe rellenar (se pasan tal cual los `setState`). */
export type ProfileDraftSetters<Room extends object, Conditions extends object> = {
  setTagline: (v: string) => void;
  setDescription: (v: string) => void;
  setServices: (v: Set<string>) => void;
  setCommonAreas: (v: Set<string>) => void;
  setKitchens: (v: number) => void;
  setCleaningMode: (v: "daily" | "weekly") => void;
  setCleaningPerWeek: (v: number) => void;
  setNearUniversities: (v: Set<string>) => void;
  setStayDocKeys: (v: Set<string>) => void;
  setStayDocOther: (v: string[]) => void;
  setRulesRows: (v: RuleDraft[]) => void;
  setRulesDirty: (v: boolean) => void;
  setCustomItems: (update: (prev: CustomItemDraft[]) => CustomItemDraft[]) => void;
  setFaqItems: (v: { question: string; answer: string }[]) => void;
  setRoomTypes: (v: Room[]) => void;
  setConditions: (update: (prev: Conditions) => Conditions) => void;
};

/**
 * Borrador local de la configuración de residencia: guarda en este dispositivo lo escrito en el formulario y lo recupera al volver.
 * Nunca guarda en el servidor, nunca publica y nunca envía a revisión (eso solo lo hacen «Guardar cambios» y «Enviar para revisión»).
 * Los archivos (fotos, PDF del reglamento) no entran en el borrador: hay que volver a elegirlos.
 */
export function useProfileDraft<Room extends object, Conditions extends object>({
  residenceId,
  userId,
  stamp,
  enabled,
  source,
  setters,
  roomTemplate,
}: {
  residenceId: string;
  userId: string;
  /** Huella del estado guardado en el servidor (`updated_at` de la residencia): si cambió, el borrador viejo no se aplica solo. */
  stamp: string;
  enabled: boolean;
  source: ProfileDraftSource;
  setters: ProfileDraftSetters<Room, Conditions>;
  /** Valores por defecto de un tipo de habitación, para completar los campos faltantes de un borrador viejo. */
  roomTemplate: { name: string; roomCount: number; capacityPerRoom: number; monthlyPriceUsd: number };
}) {
  const value = toProfileDraftData(source);

  const apply = useCallback(
    (data: Partial<ProfileDraftData>) => {
      if (data.tagline !== undefined) setters.setTagline(data.tagline);
      if (data.description !== undefined) setters.setDescription(data.description);
      if (data.services) setters.setServices(new Set(data.services));
      if (data.commonAreas) setters.setCommonAreas(new Set(data.commonAreas));
      if (data.kitchens !== undefined) setters.setKitchens(data.kitchens);
      if (data.cleaningMode) setters.setCleaningMode(data.cleaningMode);
      if (data.cleaningPerWeek !== undefined) setters.setCleaningPerWeek(data.cleaningPerWeek);
      if (data.nearUniversities) setters.setNearUniversities(new Set(data.nearUniversities));
      if (data.stayDocKeys) setters.setStayDocKeys(new Set(data.stayDocKeys));
      if (data.stayDocOther) setters.setStayDocOther(data.stayDocOther);
      if (data.rulesRows) setters.setRulesRows(data.rulesRows.map((r) => newRuleDraft(r)));
      if (data.rulesDirty !== undefined) setters.setRulesDirty(data.rulesDirty);
      if (data.newCustomItems) {
        const fresh: CustomItemDraft[] = data.newCustomItems.map((i) => ({ kind: i.kind, label: i.label, status: "pending", rejectReason: null }));
        // Los ya guardados vienen del servidor; los nuevos se reemplazan por los del borrador.
        setters.setCustomItems((prev) => [...prev.filter((i) => i.id), ...fresh]);
      }
      // Las preguntas propias pueden quedar en cero (se quitaron todas); los borradores viejos traían un casillero en blanco: se descarta.
      if (data.faqItems) setters.setFaqItems(dropBlankOwnFaq(data.faqItems));
      if (data.roomTypes) {
        const rooms = sanitizeRoomTypes(data.roomTypes, roomTemplate);
        if (rooms && rooms.length > 0) setters.setRoomTypes(rooms as Room[]);
      }
      if (data.conditions) {
        const incoming = data.conditions;
        setters.setConditions((prev) => mergeByTemplate(incoming, prev));
      }
    },
    // Los setters de `useState` son estables; `roomTemplate` es una constante del formulario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return useLocalDraft<Partial<ProfileDraftData>, ProfileDraftData>({
    storageKey: draftStorageKey(PROFILE_DRAFT_SCOPE, userId, residenceId),
    enabled,
    stamp,
    value,
    validate: sanitizeProfileDraft,
    onRestore: apply,
  });
}
