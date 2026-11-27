# Textos aprobados: pesos fijos y pago de la reserva (2026-11-26)

El dueño aprobó cada texto. Reglas: `docs/00` DR70, DR72, DR73 y DR74.

| Fase | Qué incluye | Estado |
|---|---|---|
| 1 | Redondeo, avisos, frases cortas, términos y condiciones (secciones 1, 2 y 3) | En `staging` |
| 2 | «Pago recibido» y contacto directo (sección 4) | En `staging` |
| 3 | «Ya pagué» en contacto directo, Soporte, alertas y plazo nuevo (sección 5) | En `staging` (2026-11-27) |

## 1. Aviso oficial de pesos (`docs/00` §13.3)

**Antes de enviar la solicitud:**

> El valor en pesos es referencial, con el dólar blue (valor venta) de hoy. Para el pago de la reserva y el fee EstuRed, queda fija la cotización del día en que se envía la solicitud de reserva. Los pagos posteriores se acuerdan con la residencia.

**Con la solicitud enviada:**

> Estos pesos usan el dólar blue (valor venta) del día en que se envió la solicitud de reserva. Esa cotización queda fija para el pago de la reserva y el fee EstuRed. Los pagos posteriores se acuerdan con la residencia.

**Renovación:**

> Estos pesos usan el dólar blue (valor venta) del día en que se creó la oferta de renovación. Esa cotización queda fija para el fee EstuRed.

## 2. Frases cortas

| Dónde | Texto |
|---|---|
| Junto a precios y en el tooltip | «Referencial · el pago de la reserva queda fijo en pesos al enviar la solicitud» |
| Panel «Compartir tu ficha» | «Los datos resaltados se completan solos con lo que cargaste en tu ficha. El precio en pesos es una referencia. El pago de la reserva queda fijo en pesos cuando el estudiante envía la solicitud.» |
| `/for-students`, «Qué pagás y cuándo» (reemplaza la nota T17) | «Los precios están en dólares. El pago de la reserva y el fee EstuRed quedan fijos en pesos cuando enviás tu solicitud de reserva.» |
| Propuesta de ajuste | «El fee EstuRed es estimado. En pesos, usa la cotización del día en que se envió la solicitud de reserva.» |
| Condiciones acordadas | «Tipo de cambio de la solicitud» |
| Tarjeta de pago con medios | «Monto de la reserva según las condiciones de la solicitud.» |

## 3. Legales

### `/terms`, sección 10 (reemplaza el segundo párrafo)

> Las conversiones en pantalla usan la fuente de tipo de cambio configurada por EstuRed. Antes de enviar una solicitud de reserva, el valor en pesos es referencial. Al enviarla, queda fija la cotización de ese día para el pago de la reserva y el fee EstuRed. El pago de la reserva en pesos se redondea a múltiplos de 500 pesos. Una propuesta de ajuste de condiciones puede cambiar los montos, pero no la cotización. En las renovaciones, la cotización del fee queda fija cuando se crea la oferta. Los pagos posteriores se acuerdan con la residencia.

### `/terms`, sección 16 (reemplaza la última oración del párrafo de precios)

> El importe en pesos del pago de la reserva queda fijo al enviar la solicitud de reserva (sección 10).

### `/terms`, «solicitar»

| Antes | Ahora |
|---|---|
| «usuario que busca, solicita, reserva o reside…» | «usuario que busca, envía solicitudes de reserva, reserva o reside…» |
| «requiere confirmación al solicitar» (secciones 9 y de disponibilidad) | «requiere confirmación al enviar tu solicitud de reserva» |
| «también puede solicitar una renovación» | «también puede pedir una renovación» |

### Condiciones para residencias, sección 5 (párrafo nuevo)

> El importe del pago de la reserva queda fijo en pesos al enviarse la solicitud de reserva, con la cotización de ese día y redondeado a múltiplos de 500 pesos. La residencia asume las variaciones del dólar hasta el cobro. Si cobra en dólares, vale el monto en dólares de la solicitud. Solo una propuesta de ajuste aceptada puede cambiar el importe.

## 4. Fase 2: «Pago recibido» y contacto directo

### Formulario «Pago recibido» (solo solicitudes)

- «Monto acordado», sin editar.
- «¿En qué moneda te pagaron?», con «Pesos» o «Dólares».
- Ayuda con enlace al caso de pago de la solicitud: «¿Recibiste otro monto? No confirmes el pago y abrí un caso en Soporte.» Con un caso abierto: «¿Recibiste otro monto? No confirmes el pago.»

### Contacto directo

La frase sale junto con el monto, la fecha límite y la aclaración de la sección 2. Nunca un teléfono.

| Dónde | Texto |
|---|---|
| Tarjeta del estudiante | «La residencia te contactará para coordinar la forma de pago con vos.» |
| Tarjeta del estudiante menor | «La residencia contactará a tu familiar vinculado para coordinar la forma de pago.» |
| Aviso de pago habilitado | La misma idea, en las tres variantes. |
| Ayuda del panel de la residencia | Cita la frase que ve el estudiante. |

**Variantes del aviso de pago habilitado (derivadas en la fase 2, pendientes de revisión del dueño):**

- Estudiante: «La residencia te contactará para coordinar la forma de pago con vos. La solicitud sigue sujeta a confirmación.»
- Estudiante menor: «La residencia contactará a tu familiar vinculado para coordinar la forma de pago. La solicitud sigue sujeta a confirmación.»
- Familiar: «La residencia habilitó el pago de la reserva de {estudiante}. La residencia te contactará para coordinar la forma de pago con vos. La solicitud sigue sujeta a confirmación.» Título sin cambios: «{residencia} te va a indicar cómo pagar».
- Ayuda de la residencia: «Ve el monto, el plazo y «La residencia te contactará para coordinar la forma de pago con vos». Vos le escribís con el botón de WhatsApp; el estudiante no te contacta.» Con menor: «El estudiante es menor: ve el monto, el plazo y «La residencia contactará a tu familiar vinculado para coordinar la forma de pago». Escribile solo al familiar.»

## 5. Fase 3: Soporte, alertas y plazo nuevo

### Excepción de Soporte

En los formularios de residencias y estudiantes, se agrega:

> Excepción: un caso sobre el pago de la reserva a la residencia frena el vencimiento de esa solicitud mientras siga abierto.

En `/terms`, la misma oración y además (versión nueva):

> Si al cerrarlo el plazo ya venció y no hay «Pago recibido», corre un plazo nuevo de 24 horas.

### Alertas al estudiante

| Hora | Título |
|---|---|
| 12 | «Tenés un pago pendiente» |
| 24 | «Te queda la mitad del plazo» |
| 36 | «Tu solicitud puede vencer pronto» |
| 42 | «Último aviso para pagar la reserva» |

Texto de las cuatro:

> Pagá la reserva en {residencia} y tocá «Ya pagué» antes del {fecha} a las {hora}. Si no, la solicitud puede vencer. ¿Tenés un problema? Escribí a Soporte antes de esa hora.

Con un menor, el familiar lee «Pagá la reserva de {nombre} en {residencia}…». El estudiante lee:

> Tu familiar vinculado tiene que pagar la reserva en {residencia} y avisarlo antes del {fecha} a las {hora}. Si no, la solicitud puede vencer.

### Aviso a la residencia (42 horas)

> **Una solicitud puede vencer.** Todavía no se informó el pago de la reserva de {nombre}. Vence el {fecha} a las {hora}. Podés escribirle para que pague. Si ya recibiste el pago, marcá «Pago recibido».

Con un menor: «Podés escribirle al familiar vinculado».

### Plazo nuevo de 24 horas (solo si nada más frena el plazo)

Estudiante:

> **Tenés 24 horas más para pagar la reserva.** Se cerró el caso de Soporte. Pagá en {residencia} y tocá «Ya pagué» antes del {fecha} a las {hora}. Si no, la solicitud puede vencer.

Residencia:

> **Plazo nuevo para una solicitud.** Se cerró el caso de Soporte sobre el pago de {nombre}. Si ya lo recibiste, marcá «Pago recibido» antes del {fecha} a las {hora}. Si no, la solicitud puede vencer.

Con un menor, el familiar lee «Pagá la reserva de {nombre} en {residencia}…». El estudiante lee:

> Tu familiar vinculado tiene que pagar la reserva en {residencia} y avisarlo antes del {fecha} a las {hora}.
