# Aviso de cambios en los términos (versión 2026-11-27)

**Estado:** texto aprobado por el dueño el 2026-11-27. Sin enviar. Fecha de vigencia: 27 de noviembre de 2026.

Cubre DR72 (cotización fija) y DR73 (un caso en Soporte frena el vencimiento). Compara `main` (`4f82924`) con `staging`.

## Para revisar

Las condiciones para residencias no mencionan la regla del caso en Soporte. Solo está en `/terms` §22.

## Antes de enviar

1. Fecha de vigencia: 27 de noviembre de 2026 (dueño).
2. Enviá los mails antes de que rijan (`/terms` §30). Hoy no hay destinatarios reales.
3. Publicá en `main` en esa fecha, no antes. Al publicar, los textos nuevos quedan visibles.
4. Avisá a las residencias por email. Lo exige la sección 13 de sus condiciones.
5. Poné los destinatarios en copia oculta.

## Destinatarios

Elegilos por consentimiento (`consents.consent_type`), no por rol.

| Mail | Consentimiento | Incluye |
|---|---|---|
| 1 | `terms` | Preregistrados, estudiantes, familias y staff de residencias |
| 2 | `residence_terms` | Responsables de residencias |

Quien tenga los dos recibe los dos. En prod (2026-11-27): `terms` 2, `residence_terms` 0. Las 2 son pruebas del dueño: no hay a quién avisar hoy. Plan: `PLAN_PUBLICACION_2026-11-27.md`.

## Mail 1: estudiantes y familias

**Asunto:** Cambian los términos de EstuRed

Hola:

Actualizamos los Términos y condiciones de EstuRed. Los cambios rigen desde el 27 de noviembre de 2026.

**1. La cotización queda fija al enviar tu solicitud de reserva**

- Antes: el valor en pesos era de referencia hasta el pago.
- Antes: el valor final se acordaba con la residencia.
- Ahora: al enviar tu solicitud de reserva, queda fija la cotización de ese día.
- Vale para el pago de la reserva y el fee EstuRed.
- El pago de la reserva en pesos se redondea a múltiplos de 500 pesos.
- Antes de enviarla, el valor en pesos sigue siendo de referencia.
- Una propuesta de ajuste de condiciones puede cambiar los montos, pero no la cotización.
- En las renovaciones, la cotización del fee queda fija al crearse la oferta.
- Los pagos posteriores se acuerdan con la residencia.

**2. Un caso en Soporte sobre el pago frena el vencimiento**

- Antes: un reclamo no suspendía nada, salvo decisión manual de EstuRed.
- Ahora hay una excepción: los casos sobre el pago de la reserva a la residencia.
- Mientras ese caso siga abierto, la solicitud no vence.
- Al cerrarlo, puede correr un plazo nuevo de 24 horas.
- Corre si el plazo ya venció y no hay «Pago recibido».

También ajustamos la redacción de otras partes.

Los cambios no afectan solicitudes ni reservas ya confirmadas. Si no estás de acuerdo, podés dejar de usar EstuRed.

Desde el 27 de noviembre de 2026 vas a ver el texto completo en https://estured.com/terms.

¿Dudas? Escribinos a hola@estured.com.

El equipo de EstuRed

## Mail 2: residencias

**Asunto:** Cambian las condiciones para residencias de EstuRed

Hola:

Actualizamos las Condiciones para residencias de EstuRed. Los cambios rigen desde el 27 de noviembre de 2026.

**Sección 5: el importe de la reserva queda fijo**

- El pago de la reserva queda fijo en pesos al enviarse la solicitud de reserva.
- Se calcula con la cotización de ese día.
- Se redondea a múltiplos de 500 pesos.
- La residencia asume las variaciones del dólar hasta el cobro.
- Si cobrás en dólares, vale el monto en dólares de la solicitud.
- Solo una propuesta de ajuste aceptada puede cambiar el importe.

Desde el 27 de noviembre de 2026 vas a ver ese texto en https://estured.com/terms/residencias.

**Además: cómo cambia el vencimiento de las solicitudes**

Esta regla figura en la sección 22 de los Términos y condiciones.

- Un caso en Soporte sobre el pago de la reserva frena el vencimiento.
- La solicitud no vence mientras el caso siga abierto.
- Al cerrarlo, puede correr un plazo nuevo de 24 horas.
- Corre si el plazo ya venció y no hay «Pago recibido».

Desde el 27 de noviembre de 2026 la vas a ver en https://estured.com/terms.

¿Dudas? Escribinos a hola@estured.com.

El equipo de EstuRed
