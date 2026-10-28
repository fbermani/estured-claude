"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { cmd } from "@/components/admin/ui/tokens";
import { reviewCustomAmenityAction, type CustomAmenityReviewState } from "@/app/admin/custom-amenities/actions";

const initialState: CustomAmenityReviewState = { status: "idle" };

function Buttons() {
  const { pending } = useFormStatus();
  return (
    <div className="flex gap-2">
      <AdminButton type="submit" name="decision" value="approved" variant="secondary" className="!px-3 !py-1 text-xs" disabled={pending}>
        Aprobar
      </AdminButton>
      <AdminButton type="submit" name="decision" value="rejected" variant="danger" className="!px-3 !py-1 text-xs" disabled={pending}>
        Rechazar
      </AdminButton>
    </div>
  );
}

export function ReviewButtons({ id }: { id: string }) {
  const [state, formAction] = useActionState(reviewCustomAmenityAction.bind(null, id), initialState);
  return (
    <form action={formAction} className="flex flex-col items-end gap-1.5">
      <input
        name="reason"
        maxLength={300}
        placeholder="Motivo (obligatorio si rechazás)"
        className="w-56 rounded-xl px-2.5 py-1 text-xs"
        style={{ border: `1.5px solid ${cmd.border}`, backgroundColor: cmd.surface, color: cmd.onSurface }}
      />
      {state.status === "error" && (
        <span className="text-xs font-medium" style={{ color: cmd.rose }}>
          {state.message}
        </span>
      )}
      <Buttons />
    </form>
  );
}
