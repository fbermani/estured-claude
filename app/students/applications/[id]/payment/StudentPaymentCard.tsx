import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { CopyButton } from "@/components/ui/CopyButton";
import { ContactDeadlineNote } from "@/components/applications/ContactDeadlineNote";
import { formatDateTime } from "@/lib/dates/format";
import { formatArs, formatUsd } from "@/lib/mock/exchange";
import type { StudentPaymentCardView } from "@/lib/applications/loadStudentPaymentCard";
import { StudentPaymentActions } from "@/app/students/applications/[id]/payment/StudentPaymentActions";

/** Aviso de seguridad (DR63 (g)) y TP-06 (DR65 (c)): EstuRed no recibe este dinero ni revisa los datos de cobro de la residencia. */
const SECURITY_NOTICE =
  "Pagás directamente a la residencia. EstuRed no recibe este dinero. Los datos de cobro los carga la residencia, que responde por ellos: EstuRed no los revisa ni los aprueba. Pagá solo a los datos que figuran acá: si te piden transferir a otros, no lo hagas y escribinos a Soporte. Esto no limita tus derechos como consumidor.";

function SupportButton({ label = "Escribir a Soporte" }: { label?: string }) {
  return (
    <Button href="/students/support" variant="outline" size="sm" className="mt-4 w-full sm:w-auto">
      {label}
    </Button>
  );
}

/**
 * Tarjeta del pago de la reserva en el detalle de la solicitud (DR63 (c), (d), (e), (l), (m)). Server Component: recibe la vista que
 * armó `loadStudentPaymentCard` (que ya comprobó que quien mira es el estudiante o el familiar pagador de un menor). Una sola acción
 * principal por pantalla: «Ya pagué». Con contacto directo solo hay un mensaje: el estudiante nunca ve un número ni escribe a la residencia.
 */
export function StudentPaymentCard({ applicationId, view }: { applicationId: string; view: StudentPaymentCardView }) {
  const forFamily = view.actorRole === "family_payer";

  if (view.kind === "choosing") {
    return (
      <Card className="mt-6 p-6">
        <h2 className="text-base font-bold text-ink">Pago de la reserva</h2>
        <p className="mt-2 text-sm text-ink-soft">
          La residencia todavía está definiendo cómo cobrar la reserva. Te avisamos cuando lo haga.
        </p>
      </Card>
    );
  }

  if (view.kind === "whatsapp_direct") {
    return (
      <Card className="mt-6 p-6">
        <h2 className="text-base font-bold text-ink">Pago de la reserva</h2>
        <p className="mt-2 flex items-start gap-2 text-sm text-ink">
          <Icon name="chat" className="mt-0.5 shrink-0 text-lg text-forest-700" />
          <span>
            {view.isMinor && !forFamily
              ? "La residencia le va a escribir a tu familiar vinculado por WhatsApp con el monto final y cómo pagar."
              : "La residencia te va a escribir por WhatsApp con el monto final y cómo pagar."}
          </span>
        </p>
        <p className="mt-3 text-xs text-ink-faint">
          No transfieras dinero a datos que no te haya pasado la residencia por ese canal. EstuRed no custodia ni garantiza este pago.
        </p>
      </Card>
    );
  }

  const amount = (
    <p className="text-sm text-ink">
      {view.amountUsd !== null && <span className="text-2xl font-bold tabular-nums">{formatUsd(view.amountUsd)}</span>}
      {view.amountArs !== null && <span className="ml-2 tabular-nums text-ink-soft">· {formatArs(view.amountArs)}</span>}
      <span className="mt-1 block text-xs text-ink-faint">Monto de la reserva fijado por la residencia al habilitar el pago.</span>
    </p>
  );

  if (view.stage === "reported") {
    return (
      <Card className="mt-6 border-line-2 bg-mint p-6">
        <h2 className="flex items-center gap-2 text-base font-bold text-forest-700">
          <Icon name="schedule" className="text-lg" />
          {forFamily ? "Se avisó que se pagó" : "Avisaste que pagaste"}
        </h2>
        <p className="mt-2 text-sm text-ink-soft">
          {view.reportedPaidAt ? `El ${formatDateTime(view.reportedPaidAt)}. ` : ""}
          La residencia tiene que confirmar que lo recibió. Hasta entonces la reserva no se confirma
          {view.hasProof ? ", y ya tiene tu comprobante" : ""}.
        </p>
        <SupportButton />
      </Card>
    );
  }

  if (view.stage === "issue_open") {
    return (
      <Card className="mt-6 p-6">
        <h2 className="text-base font-bold text-ink">Avisaste que no pudiste pagar</h2>
        <p className="mt-2 text-sm text-ink-soft">
          {view.isMinor
            ? "La residencia va a contactar a tu familiar vinculado por WhatsApp o va a habilitar de nuevo el pago."
            : "La residencia te va a contactar por WhatsApp o va a habilitar de nuevo el pago."}{" "}
          Mientras tanto el plazo queda frenado.
        </p>
        <SupportButton />
      </Card>
    );
  }

  if (view.stage === "disputed") {
    return (
      <Card className="mt-6 p-6">
        <h2 className="text-base font-bold text-ink">La residencia no encontró el pago</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Soporte de EstuRed revisa el caso. Tené a mano el comprobante del pago. La solicitud sigue sujeta a confirmación.
        </p>
        <SupportButton />
      </Card>
    );
  }

  return (
    <Card className="mt-6 p-6">
      <h2 className="text-base font-bold text-ink">{forFamily ? "Pago de la reserva" : "Pagá la reserva"}</h2>
      <div className="mt-3">{amount}</div>

      {view.instructions && (
        <div className="mt-4 rounded-field border border-line-2 bg-sand-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-bold text-ink-soft">{view.methodLabel ? `Pagá con ${view.methodLabel}` : "Datos de pago"}</p>
            <CopyButton value={view.instructions} label="los datos de pago" />
          </div>
          <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm text-ink">{view.instructions}</pre>
        </div>
      )}

      <ContactDeadlineNote deadlineAt={view.deadlineAt} className="mt-4" />
      <p className="mt-3 flex items-start gap-2 text-xs text-ink-soft">
        <Icon name="shield" className="mt-0.5 shrink-0 text-base text-forest-700" />
        <span>{SECURITY_NOTICE}</span>
      </p>

      <StudentPaymentActions applicationId={applicationId} />
    </Card>
  );
}
