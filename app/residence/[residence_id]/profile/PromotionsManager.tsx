"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { isWithinWindow, PROMOTION_MAX_PERCENT, todayIso } from "@/lib/applications/reservationMoney";
import { formatDateOnly } from "@/lib/dates/formatDateOnly";
import { createPromotion, endPromotion } from "@/app/residence/[residence_id]/profile/promotionActions";

export type PromotionItem = {
  id: string;
  label: string;
  discountPercent: number;
  roomTypeName: string | null;
  startsOn: string;
  endsOn: string | null;
  isActive: boolean;
  /** Vigente hoy (activa y dentro de fechas), calculado en el servidor. */
  current: boolean;
};

/**
 * Promociones de tarifa (DR18 t3, migración 0060): un descuento % sobre la renta, con vigencia, sin tocar las tarifas de lista.
 * Guarda por su cuenta (no depende del botón del perfil); el servidor valida todo. Vive dentro del <form> del perfil, por eso
 * sus botones son type="button" y sus campos no tienen `name`. Afecta solo solicitudes NUEVAS: las ya enviadas conservan su precio.
 */
export function PromotionsManager({
  residenceId,
  initialItems,
  roomTypes,
  schemaReady,
  readOnly,
}: {
  residenceId: string;
  initialItems: PromotionItem[];
  roomTypes: { id: string; name: string }[];
  schemaReady: boolean;
  readOnly: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [label, setLabel] = useState("");
  const [percent, setPercent] = useState("");
  const [roomTypeId, setRoomTypeId] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  if (!schemaReady)
    return (
      <p className="mt-4 rounded-field bg-sand-50 p-3 text-sm text-ink-soft">
        Muy pronto vas a poder crear promociones de tarifa con fecha de inicio y de fin, sin cambiar tus tarifas.
      </p>
    );

  function create() {
    startTransition(async () => {
      const result = await createPromotion(residenceId, {
        label,
        discountPercent: percent,
        roomTypeId: roomTypeId || null,
        startsOn,
        endsOn,
      });
      setFeedback({ ok: result.status === "success", text: result.message ?? "" });
      if (result.status === "success" && result.promotion) {
        const created = result.promotion;
        setItems((prev) => [
          {
            id: created.id,
            label: created.label,
            discountPercent: created.discountPercent,
            roomTypeName: roomTypes.find((rt) => rt.id === created.roomTypeId)?.name ?? null,
            startsOn: created.startsOn,
            endsOn: created.endsOn,
            isActive: true,
            current: isWithinWindow({ startsOn: created.startsOn, endsOn: created.endsOn }, todayIso()),
          },
          ...prev,
        ]);
        setLabel("");
        setPercent("");
        setRoomTypeId("");
        setStartsOn("");
        setEndsOn("");
      }
    });
  }

  function end(id: string) {
    startTransition(async () => {
      const result = await endPromotion(residenceId, id);
      setFeedback({ ok: result.status === "success", text: result.message ?? "" });
      if (result.status === "success") setItems((prev) => prev.map((p) => (p.id === id ? { ...p, isActive: false, current: false } : p)));
    });
  }

  const activeItems = items.filter((p) => p.isActive);

  return (
    <div className="mt-4 space-y-4">
      {activeItems.length > 0 ? (
        <ul className="space-y-2">
          {activeItems.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-field border border-sand-200 p-3 text-sm">
              <span>
                <span className="font-semibold text-ink">{p.label}</span>{" "}
                <span className="font-bold text-forest-700">−{p.discountPercent}%</span>
                <span className="block text-xs text-ink-soft">
                  {p.roomTypeName ? `Solo ${p.roomTypeName}` : "Todos los tipos de habitación"} · desde {formatDateOnly(p.startsOn)}
                  {p.endsOn ? ` hasta ${formatDateOnly(p.endsOn)}` : " sin fecha de fin"} ·{" "}
                  {p.current ? "vigente hoy" : "todavía no empezó o ya terminó"}
                </span>
              </span>
              {!readOnly && (
                <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => end(p.id)}>
                  Finalizar
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">No tenés promociones activas.</p>
      )}

      {!readOnly && (
        <div className="space-y-3 rounded-card border border-sand-200 p-4">
          <p className="font-semibold text-ink">Nueva promoción</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Nombre" value={label} maxLength={60} placeholder="Ej.: Promo invierno" onChange={(e) => setLabel(e.target.value)} />
            <Input
              label={`Descuento sobre la renta (1% a ${PROMOTION_MAX_PERCENT}%)`}
              type="number"
              min={1}
              max={PROMOTION_MAX_PERCENT}
              step="0.5"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
            />
            <Select label="Aplica a" value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value)}>
              <option value="">Todos los tipos de habitación</option>
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.name}
                </option>
              ))}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Desde (opcional)" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
              <Input label="Hasta (opcional)" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-ink-faint">
            Se aplica a las solicitudes nuevas mientras esté vigente; las ya enviadas conservan su precio. Tus tarifas de lista no cambian. Si
            hay más de una promoción para un tipo, rige la de mayor descuento. El fee de EstuRed se calcula sobre lo que paga el estudiante.
          </p>
          <Button type="button" variant="secondary" size="sm" disabled={pending || !label.trim() || !percent} onClick={create}>
            {pending ? "Guardando…" : "Crear promoción"}
          </Button>
        </div>
      )}
      {feedback && (
        <p role="status" className={`text-sm ${feedback.ok ? "text-forest-700" : "text-danger-fg"}`}>
          {feedback.text}
        </p>
      )}
    </div>
  );
}
