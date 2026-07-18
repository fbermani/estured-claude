"use client";

import { useActionState } from "react";
import { AdminButton } from "@/components/admin/ui/AdminButton";
import { markTariffLogReviewed, type TariffReviewState } from "@/app/admin/pricing/actions";

const initialState: TariffReviewState = { status: "idle" };

export function ReviewButton({ logId }: { logId: string }) {
  const action = markTariffLogReviewed.bind(null, logId);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <AdminButton type="submit" name="review_status" value="reviewed" variant="secondary" disabled={pending} className="px-3 py-1 text-xs">
        Revisado
      </AdminButton>
      <AdminButton type="submit" name="review_status" value="flagged" variant="danger" disabled={pending} className="px-3 py-1 text-xs">
        Marcar
      </AdminButton>
      {state.status === "error" && <span className="text-xs text-red-600">{state.message}</span>}
    </form>
  );
}
