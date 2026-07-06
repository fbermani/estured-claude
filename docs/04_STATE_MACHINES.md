# 04_STATE_MACHINES.md
# EstuRed — Máquinas de estado del MVP

**Versión:** 1.2
**Estado:** Especificación actualizada para construcción
**Producto:** EstuRed
**Mercado inicial:** CABA
**Formato MVP:** webapp responsive
**Última actualización:** 2026-06-27

---

## 1. Propósito del documento

Este documento define las máquinas de estado principales de EstuRed para que el producto pueda construirse sin ambigüedades.

Debe usarse como referencia para:

- base de datos (enums, constraints);
- backend (validaciones server-side de transiciones);
- frontend (estados visibles, labels, colores);
- dashboards;
- notificaciones;
- permisos;
- auditoría;
- QA y casos borde;
- integraciones de pago;
- comprobantes;
- reglas de visibilidad;
- panel admin.

Ningún módulo crítico del MVP debe implementarse con estados improvisados fuera de este documento.

Si Claude Code necesita agregar un nuevo estado, debe justificarlo y verificar que no contradiga estas reglas.

---

## 2. Principios generales

### 2.1. Separar entidades

No se debe usar un único estado global para representar todo el flujo. EstuRed separa como mínimo:

- propuesta de solicitud (iniciada por familiar);
- solicitud de reserva;
- negociación de condiciones;
- pago a residencia;
- reserva;
- fee EstuRed;
- comprobante;
- disponibilidad;
- lista de espera;
- renovación;
- residencia;
- verificación;
- ediciones de perfil;
- familiar vinculado;
- comunidad visible / residente;
- soporte / resolución de conflictos;
- penalización / visibilidad;
- notificaciones.

Esto evita que una falla de pago, un reclamo, una reemisión de comprobante o una renovación rompa todo el flujo principal.

---

### 2.2. Estados técnicos vs. estados visibles

Los estados técnicos deben ser estables, claros y en `snake_case`.

Los textos visibles para usuarios pueden cambiar por UX, pero siempre deben mapearse a un estado técnico definido en este documento.

Ejemplo:

- técnico: `residence_payment_pending`
- visible estudiante: `Esperando pago a la residencia`
- visible residencia: `Esperando pago del estudiante`

---

### 2.3. Auditoría obligatoria

Toda transición crítica debe generar un registro de auditoría.

Eventos auditables mínimos:

- creación de propuesta de solicitud por familiar;
- aprobación / rechazo de propuesta por estudiante;
- expiración de propuesta;
- envío de solicitud;
- apertura / revisión de solicitud por residencia;
- contacto establecido (timestamp del botón WhatsApp presionado);
- propuesta de ajuste enviada por residencia;
- aceptación / rechazo de propuesta de ajuste por estudiante;
- pausa o reactivación de solicitud;
- rechazo de solicitud + motivo;
- vencimiento de solicitud;
- carga de comprobante por estudiante;
- residencia marca pago recibido (timestamp de aceptación de términos);
- intento de cobro del fee;
- fee pagado;
- fee fallido;
- fee expirado;
- fee reembolsado;
- factura emitida (TusFacturas.app);
- reserva confirmada;
- comprobante emitido;
- comprobante reemitido;
- comprobante anulado;
- cancelación;
- no-show;
- edición de tarifas;
- alerta por variación de tarifas mayor al 15%;
- cambio de disponibilidad;
- entrada o salida de lista de espera;
- creación, envío y aceptación de renovación;
- cambios de visibilidad de perfil;
- apertura de reclamo;
- acciones admin (toda intervención);
- penalizaciones;
- suspensiones;
- override de tipo de cambio;
- cambio de feature flag de plan por residencia.

Cada evento debe guardar:

- entidad afectada (tabla + ID);
- estado anterior;
- estado nuevo;
- usuario o sistema que ejecutó la acción (userId);
- rol del actor;
- timestamp;
- motivo si aplica;
- metadata relevante;
- IP / user agent cuando corresponda;
- fuente de acción: `user`, `residence`, `admin`, `system`, `payment_provider`.

---

## 3. Loop central del MVP

```
Estudiante busca residencia
→ envía solicitud (o aprueba propuesta del familiar)
→ residencia revisa
→ residencia establece contacto
→ [negociación opcional: residencia propone ajuste, 1 vez; estudiante acepta o rechaza]
→ estudiante acepta condiciones finales
→ estudiante paga a la residencia
→ residencia marca Pago recibido
→ EstuRed cobra el fee
→ reserva confirmada
→ comprobante emitido
```

**Regla central:** No existe reserva confirmada dentro de EstuRed si el fee EstuRed no está pagado.

**Regla complementaria:** No existe Comprobante de Reserva Confirmada si la reserva no está confirmada.

---

# 4. Máquina de estados: Propuesta de solicitud (familiar)

## 4.1. Entidad

```
family_application_proposal
```

Representa la sugerencia que un familiar vinculado hace al estudiante para iniciar una solicitud en una residencia específica.

**No es una solicitud activa.** No es visible para la residencia hasta que el estudiante la apruebe.

---

## 4.2. Estados técnicos

| Estado técnico | Descripción |
|---|---|
| `draft` | El familiar está completando los parámetros. No enviada al estudiante aún. |
| `pending_student_approval` | Propuesta enviada al estudiante. Esperando aprobación o rechazo. |
| `approved_by_student` | El estudiante aprobó. Se convierte en solicitud (`application_request`). |
| `rejected_by_student` | El estudiante rechazó la propuesta. |
| `expired` | El estudiante no respondió dentro del plazo (48 horas). |

---

## 4.3. Transiciones permitidas

| Desde | Hacia | Evento | Actor |
|---|---|---|---|
| `draft` | `pending_student_approval` | Familiar envía propuesta al estudiante | Familiar |
| `pending_student_approval` | `approved_by_student` | Estudiante aprueba | Estudiante |
| `pending_student_approval` | `rejected_by_student` | Estudiante rechaza | Estudiante |
| `pending_student_approval` | `expired` | 48 horas sin respuesta | Sistema |

---

## 4.4. Reglas

- El familiar solo puede proponer, no enviar directamente a la residencia.
- El estudiante solo puede aprobar o rechazar. No puede modificar parámetros.
- Si quiere cambiar parámetros, debe rechazar y el familiar puede crear una nueva propuesta.
- Las propuestas en `pending_student_approval` **no cuentan** en el límite de 2 solicitudes activas del estudiante.
- Al aprobar, se crea una `application_request` con `initiated_by = family_member` y `contact_target = family_member`. El snapshot se genera en ese momento.
- Si el estudiante rechaza o la propuesta expira: el familiar recibe notificación. No hay acción automática adicional.
- El plazo de aprobación es de **48 horas**.

---

# 5. Máquina de estados: Solicitud de reserva

## 5.1. Entidad

```
application_request
```

Representa la intención formal del estudiante de reservar una plaza, habitación o tipo de habitación en una residencia. Puede haberse originado en el estudiante o en una propuesta aprobada del familiar.

---

## 5.2. Estados técnicos

| Estado técnico | Descripción | Cuenta como solicitud activa |
|---|---|:---:|
| `draft` | Solicitud iniciada, todavía no enviada. | No |
| `submitted` | El estudiante envió la solicitud. | Sí |
| `queued_for_place` | Entró en cola porque la plaza/tipo ya tiene el máximo visible. | Sí |
| `under_review` | La residencia abrió o comenzó a revisar la solicitud. | Sí |
| `contact_established` | La residencia decidió avanzar y habilitó contacto por WhatsApp. | Sí |
| `offer_pending_student_acceptance` | La residencia envió propuesta de ajuste de condiciones. El estudiante debe responder. | Sí |
| `conditions_accepted` | El estudiante respondió a la propuesta de ajuste (aceptó las nuevas condiciones o eligió continuar con las originales). Solo existe en el flujo con negociación. Listo para pagar. | Sí |
| `paused_due_to_other_active_request` | Pausada porque el estudiante está avanzando con otra solicitud. | No |
| `residence_payment_pending` | El estudiante debe pagar a la residencia lo configurado. | Sí |
| `residence_payment_reported` | La residencia marcó Pago recibido. Fee EstuRed pendiente. | Sí |
| `converted_to_reservation` | La solicitud generó una reserva. La entidad reserva toma el control. | No |
| `rejected` | La residencia rechazó la solicitud. | No |
| `expired_no_residence_response` | La residencia no respondió dentro del plazo. | No |
| `expired_no_student_payment` | El estudiante no pagó a la residencia dentro de las 48 horas. | No |
| `expired_offer_no_response` | El estudiante no respondió a la propuesta de ajuste dentro de las 48 horas. | No |
| `cancelled_by_student` | El estudiante canceló antes de confirmar. | No |
| `cancelled_by_residence` | La residencia canceló antes de confirmar. | No |
| `closed_due_to_other_confirmed_reservation` | El estudiante confirmó reserva en otra residencia. | No |
| `disputed` | Existe reclamo o mediación asociado. | Depende del caso |

---

## 5.3. Estados visibles

| Estado técnico | Visible estudiante | Visible residencia |
|---|---|---|
| `draft` | Solicitud en preparación | Borrador no visible |
| `submitted` | Solicitud enviada | Nueva solicitud |
| `queued_for_place` | En cola para esta plaza | En cola |
| `under_review` | En revisión | En revisión |
| `contact_established` | Contacto habilitado | Contacto establecido |
| `offer_pending_student_acceptance` | Propuesta de ajuste recibida — revisá los cambios | Propuesta enviada — esperando respuesta |
| `conditions_accepted` | Condiciones aceptadas — completá el pago | Condiciones aceptadas |
| `paused_due_to_other_active_request` | Solicitud pausada | Pausada por otra solicitud activa |
| `residence_payment_pending` | Esperando pago a la residencia | Esperando pago del estudiante |
| `residence_payment_reported` | Pago informado por residencia | Pago recibido informado |
| `converted_to_reservation` | Reserva en proceso | Reserva en proceso |
| `rejected` | Solicitud rechazada | Rechazada |
| `expired_no_residence_response` | Solicitud vencida | Venció sin respuesta |
| `expired_no_student_payment` | Solicitud vencida | Venció por falta de pago |
| `expired_offer_no_response` | Propuesta vencida | Propuesta sin respuesta |
| `cancelled_by_student` | Cancelada por vos | Cancelada por estudiante |
| `cancelled_by_residence` | Cancelada por residencia | Cancelada por residencia |
| `closed_due_to_other_confirmed_reservation` | Cerrada por otra reserva confirmada | Cerrada automáticamente |
| `disputed` | En revisión por EstuRed | En revisión por EstuRed |

---

## 5.4. Transiciones permitidas

| Desde | Hacia | Evento | Actor |
|---|---|---|---|
| `draft` | `submitted` | Enviar solicitud | Estudiante |
| `submitted` | `queued_for_place` | Plaza/tipo tiene cupo visible completo | Sistema |
| `queued_for_place` | `submitted` | Se libera cupo visible | Sistema / Admin |
| `submitted` | `under_review` | Residencia abre solicitud | Residencia |
| `submitted` | `contact_established` | Residencia decide avanzar directamente | Residencia |
| `under_review` | `contact_established` | Residencia decide avanzar | Residencia |
| `contact_established` | `offer_pending_student_acceptance` | Residencia envía propuesta de ajuste (1 vez) | Residencia |
| `contact_established` | `residence_payment_pending` | Sin propuesta de ajuste: al establecerse el contacto se habilita el pago con las condiciones originales (`snapshot_final = snapshot_original`) | Sistema |
| `offer_pending_student_acceptance` | `conditions_accepted` | Estudiante acepta propuesta | Estudiante |
| `offer_pending_student_acceptance` | `conditions_accepted` | Estudiante rechaza propuesta y elige continuar con condiciones originales | Estudiante |
| `offer_pending_student_acceptance` | `cancelled_by_student` | Estudiante rechaza propuesta y cierra la solicitud | Estudiante |
| `offer_pending_student_acceptance` | `expired_offer_no_response` | 48 horas sin respuesta del estudiante | Sistema |
| `conditions_accepted` | `residence_payment_pending` | Se habilita pago a residencia | Sistema |
| `residence_payment_pending` | `residence_payment_reported` | Residencia marca Pago recibido | Residencia |
| `residence_payment_reported` | `converted_to_reservation` | Se crea reserva asociada | Sistema |
| `submitted` | `rejected` | Residencia rechaza | Residencia |
| `under_review` | `rejected` | Residencia rechaza | Residencia |
| `queued_for_place` | `cancelled_by_student` | Estudiante cancela | Estudiante |
| `submitted` | `cancelled_by_student` | Estudiante cancela | Estudiante |
| `under_review` | `cancelled_by_student` | Estudiante cancela | Estudiante |
| `contact_established` | `cancelled_by_student` | Estudiante cancela antes de pagar | Estudiante |
| `residence_payment_pending` | `cancelled_by_student` | Estudiante cancela antes de pagar | Estudiante |
| `submitted` | `expired_no_residence_response` | Residencia no responde dentro de 48 horas | Sistema |
| `under_review` | `expired_no_residence_response` | Residencia no avanza dentro del plazo | Sistema |
| `contact_established` | `expired_no_student_payment` | No hay pago a residencia dentro de 48 horas | Sistema |
| `residence_payment_pending` | `expired_no_student_payment` | No hay pago a residencia dentro de 48 horas | Sistema |
| `submitted` | `paused_due_to_other_active_request` | Otra solicitud del estudiante avanza | Sistema |
| `under_review` | `paused_due_to_other_active_request` | Otra solicitud del estudiante avanza | Sistema |
| `queued_for_place` | `paused_due_to_other_active_request` | Otra solicitud del estudiante avanza | Sistema |
| `paused_due_to_other_active_request` | `submitted` | La solicitud activa se cancela o vence | Sistema / Estudiante |
| `paused_due_to_other_active_request` | `closed_due_to_other_confirmed_reservation` | Se confirma otra reserva del estudiante | Sistema |
| Cualquier no terminal | `disputed` | Se abre reclamo | Admin / Sistema |

---

## 5.5. Campos clave de la entidad

- `initiated_by`: `student` | `family_member` — quién originó la solicitud.
- `contact_target`: `student` | `family_member` — a quién contacta la residencia al avanzar. **Si el estudiante es menor de edad, es siempre `family_member`, independientemente de `initiated_by`.**
- `snapshot_original`: condiciones al momento de enviar/aprobar la solicitud.
- `snapshot_final`: condiciones finales aceptadas (igual a original si no hubo ajuste; actualizado si hubo propuesta aceptada).
- `negotiation_proposal`: datos de la propuesta de ajuste enviada por la residencia (si existió).
- `negotiation_history`: historial de condiciones originales y propuesta para mostrar al estudiante.
- `proposal_count`: contador de propuestas enviadas por la residencia (máximo 1).

---

## 5.6. Reglas de solicitudes activas

- Un estudiante puede tener máximo **2 solicitudes activas** (estados que cuentan como activas según tabla 5.2).
- Las propuestas del familiar en `pending_student_approval` **no cuentan**.
- Si una solicitud avanza a `contact_established`, la otra solicitud activa pasa a `paused_due_to_other_active_request`.
- La solicitud pausada no se cierra automáticamente.
- La solicitud pausada se reactiva si la solicitud activa se cancela, vence o no se confirma.
- La solicitud pausada se cierra definitivamente solo cuando otra reserva del estudiante queda confirmada.

---

## 5.7. Cola por plaza o tipo de habitación

La cola aplica **por plaza** en Gestión Operativa y **por tipo de habitación** en Perfil Verificado (donde no existen plazas individuales).

- Hasta **3 solicitudes visibles** para la residencia por plaza (GO) o tipo de habitación (PV).
- Hasta **2 solicitudes en cola** por plaza (GO) o tipo de habitación (PV).
- La residencia solo puede avanzar con **1 solicitud a la vez** por plaza o tipo de habitación.
- Cuando una solicitud visible se rechaza, vence o cancela, el sistema promueve la primera de la cola.
- La promoción genera notificación.

---

## 5.8. Plazos

Ver la tabla canónica de plazos en `00_DECISION_LOG.md` §9.1. Resumen:

- La solicitud **vence a las 48 horas** de ser enviada si la residencia no responde. Ese plazo **se detiene** cuando la residencia establece contacto. Al vencer: mostrar detalle + botón "Actualizar con mismos parámetros".
- Después de `contact_established`, el estudiante tiene **48 horas** para pagar a la residencia (o para que ocurra la negociación y el pago).
- Cuando la residencia envía propuesta de ajuste (`offer_pending_student_acceptance`), el plazo de 48 horas **se reinicia**.
- El estudiante tiene **48 horas** para responder a la propuesta de ajuste.
- **Si el estudiante acepta la propuesta, el plazo de 48 horas para el pago a la residencia se reinicia nuevamente desde la aceptación.**
- La residencia recibe recordatorios diarios sobre solicitudes nuevas o pendientes.

---

# 6. Máquina de estados: Pago a residencia

## 6.1. Entidad

```
residence_payment_reference
```

EstuRed no procesa directamente este pago en el MVP. Se registra para trazabilidad.

---

## 6.2. Estados técnicos

| Estado técnico | Descripción |
|---|---|
| `not_required_yet` | Todavía no corresponde pagar a residencia. |
| `pending` | El estudiante debe pagar a la residencia. |
| `student_reference_uploaded` | El estudiante cargó comprobante para referencia. |
| `reported_received_by_residence` | La residencia informó que recibió el pago. |
| `expired` | El estudiante no pagó dentro del plazo. |
| `disputed` | Hay conflicto sobre pago, monto o recepción. |

---

## 6.3. Reglas

- El monto y condiciones de pago a residencia se establecen en las condiciones finales aceptadas (snapshot_final).
- Si hubo propuesta de ajuste aceptada, los nuevos valores son los que aplican.
- La residencia no puede modificar el monto fuera del proceso de propuesta de ajuste.
- El estudiante carga comprobante de pago como referencia. No confirma la reserva.
- La acción clave es que la residencia marque **Pago recibido**, con confirmación explícita y aceptación de términos.
- El reembolso de lo abonado a la residencia depende de la residencia y sus condiciones.

---

# 7. Máquina de estados: Reserva

## 7.1. Entidad

```
reservation
```

La reserva nace cuando la residencia marca `reported_received_by_residence` en el pago a residencia.

---

## 7.2. Estados técnicos

| Estado técnico | Descripción |
|---|---|
| `pending_estured_fee` | La residencia informó pago recibido, pero falta pagar el fee EstuRed. |
| `estured_fee_processing` | El fee está en proceso de cobro. |
| `estured_fee_failed` | El intento de cobro falló. |
| `confirmed` | El fee EstuRed fue pagado correctamente. Reserva confirmada. |
| `expired_fee_unpaid` | El fee EstuRed venció sin pago (sin intentos, o con los 3 intentos fallidos). Estado terminal. La residencia puede liberar la plaza. |
| `receipt_pending` | Reserva confirmada, comprobante todavía no generado. |
| `receipt_issued` | Comprobante emitido correctamente. |
| `cancelled_by_student` | El estudiante canceló después de confirmar. |
| `cancelled_by_residence` | La residencia canceló después de confirmar. |
| `no_show` | El estudiante no se presentó en la fecha acordada. |
| `completed` | La estadía inicial finalizó o fue cerrada correctamente. |
| `disputed` | Existe reclamo activo. |

**Nota sobre estados de comprobante:** `receipt_pending` y `receipt_issued` en la reserva reflejan el progreso del comprobante asociado. El estado autoritativo del comprobante vive en `booking_receipt.status`. La reserva actualiza su estado cuando el comprobante cambia.

---

## 7.3. Transiciones permitidas

| Desde | Hacia | Evento | Actor |
|---|---|---|---|
| `pending_estured_fee` | `estured_fee_processing` | Intento de cobro iniciado | Sistema / Payment provider |
| `estured_fee_processing` | `confirmed` | Fee pagado | Payment provider / Admin |
| `estured_fee_processing` | `estured_fee_failed` | Cobro fallido | Payment provider |
| `estured_fee_failed` | `estured_fee_processing` | Nuevo intento (máx. 3 en 48h) | Sistema / Usuario |
| `estured_fee_failed` | `pending_estured_fee` | Se espera nuevo pago manual | Admin / Sistema |
| `pending_estured_fee` | `expired_fee_unpaid` | Venció el plazo de 48h sin ningún intento de pago | Sistema |
| `estured_fee_failed` | `expired_fee_unpaid` | Fee vencido sin pago en 48h (intentos agotados) | Sistema |
| `confirmed` | `receipt_pending` | Se inicia generación de comprobante | Sistema |
| `confirmed` | `cancelled_by_student` | Estudiante cancela antes de emitirse el comprobante | Estudiante / Admin |
| `confirmed` | `cancelled_by_residence` | Residencia cancela antes de emitirse el comprobante | Residencia / Admin |
| `receipt_pending` | `cancelled_by_student` / `cancelled_by_residence` | Cancelación durante la generación del comprobante | Admin |
| `receipt_pending` | `receipt_issued` | Comprobante emitido | Sistema |
| `receipt_pending` | `confirmed` | Fallo técnico recuperable del PDF | Sistema / Admin |
| `receipt_issued` | `cancelled_by_student` | Estudiante cancela | Estudiante / Admin |
| `receipt_issued` | `cancelled_by_student` | Estudiante ejerce derecho de revocación del fee (dentro de 10 días corridos desde el pago) — `reason_code = student_revocation_right` | Estudiante / Sistema |
| `receipt_issued` | `cancelled_by_residence` | Residencia cancela | Residencia / Admin |
| `receipt_issued` | `no_show` | Estudiante no se presenta en 24h | Residencia / Admin |
| `receipt_issued` | `completed` | Estadía inicial finalizada | Sistema / Admin |
| Cualquier no terminal | `disputed` | Se abre reclamo | Admin / Sistema |

---

## 7.4. Reglas

- No hay reserva confirmada sin fee EstuRed pagado.
- El estado `confirmed` es independiente de `receipt_issued` para manejar fallos técnicos del PDF/QR.
- Si el comprobante falla, la reserva puede estar confirmada y el comprobante quedar pendiente.
- Admin puede emitir o reemitir comprobante manualmente.
- No-show: si el estudiante no se presenta dentro de **24 horas** posteriores a la fecha acordada de ingreso y no responde por canales registrados, la residencia puede marcar `no_show`.
- En caso de `no_show`, el fee EstuRed no se reembolsa.
- `expired_fee_unpaid` es un estado terminal propio del sistema: **no debe registrarse como cancelación del estudiante** (afectaría métricas y auditoría de forma incorrecta).
- **Chargeback:** si un fee ya `paid` recibe contracargo (`chargeback`), la reserva y el comprobante **no cambian automáticamente**. Se genera una alerta admin y el admin decide las acciones (anular comprobante, abrir caso de soporte, suspender), todas auditadas con motivo.

---

# 8. Máquina de estados: Fee EstuRed

## 8.1. Entidad

```
estured_fee_payment
```

---

## 8.2. Estados técnicos

| Estado técnico | Descripción |
|---|---|
| `not_required_yet` | Todavía no corresponde cobrar fee. |
| `pending_payment_method` | El usuario debe cargar o seleccionar medio de pago. |
| `pending_manual_payment` | El usuario debe pagar por transferencia u otro canal manual. |
| `pending_auto_charge` | Existe medio de pago cargado y se intentará cobro automático. |
| `processing` | El proveedor está procesando el cobro. |
| `paid` | Fee pagado. |
| `failed` | Cobro fallido. |
| `expired` | No se pagó dentro del plazo de 48 horas. Estado terminal. |
| `refunded` | Fee reintegrado por causa atribuible a residencia, revisión de EstuRed o normativa aplicable. |
| `chargeback` | Contracargo o desconocimiento. |

---

## 8.3. Reglas de cálculo

El fee EstuRed es:

```
5% fijo del total de la estadía inicial reservada
```

**Calculado siempre sobre los valores finales aceptados** (`snapshot_final`), no sobre los valores originales si hubo propuesta de ajuste aceptada.

Incluye:

- tarifa mensual final × duración inicial reservada;
- matrícula o cargo de ingreso obligatorio no reembolsable.

Excluye:

- depósito reembolsable;
- servicios opcionales;
- consumos variables;
- multas;
- cargos no obligatorios;
- ajustes futuros.

El fee se calcula sobre la tarifa actual guardada en el `snapshot_final`. No recalcula por ajustes futuros.

---

## 8.4. Moneda y proveedores — DECISIÓN CONFIRMADA

- El fee puede cobrarse en **ARS** (MercadoPago) o **USD** (PayU Argentina).
- El pagador elige el proveedor al momento de pagar.
- Si el pagador está fuera de Argentina, la UI sugiere PayU como opción recomendada.
- Si el pago es en USD: el fee base se calcula en ARS usando el tipo de cambio del `snapshot_final`, y se convierte a USD. Se muestra aclaración al pagador.
- Debe existir la abstracción técnica `PaymentProvider` desacoplada de cualquier proveedor específico.

---

## 8.5. Facturación — DECISIÓN CONFIRMADA

- EstuRed emite **Factura C** como monotributista.
- Integración con **TusFacturas.app** para emisión automática.
- La factura se emite cuando el fee es cobrado correctamente (o cuando el admin confirma pago manual).
- La factura se emite a nombre de quien paga.
- La descripción indica el beneficiario del servicio reservado.

---

## 8.6. Tipo de cambio — DECISIÓN CONFIRMADA

- Fuente: **monedapi.ar — dólar blue, valor venta**.
- Actualización diaria automática.
- Admin puede hacer override manual si la fuente falla.
- Cada solicitud guarda snapshot del tipo de cambio al momento de enviar/aprobar.
- El snapshot no cambia después de enviada la solicitud.
- El fee usa siempre el tipo de cambio del `snapshot_final`, **que hereda la cotización, fuente y fecha del snapshot original de la solicitud**: la aceptación de una propuesta de ajuste actualiza montos y condiciones, nunca el tipo de cambio.

---

## 8.7. Redondeo

- Tarifas en USD: terminan en 0 o 5.
- Tarifas en ARS: terminan en 500 o 000.
- Fee EstuRed: se calcula exacto y se redondea al múltiplo de 500 ARS más cercano. En caso de empate exacto entre dos múltiplos, se redondea hacia arriba.

---

## 8.8. Intentos de cobro e idempotencia

- Después de que la residencia marca Pago recibido, el estudiante/familiar tiene **48 horas** para pagar el fee.
- Si existe medio de pago automático, el sistema puede intentar cobrar automáticamente.
- Si falla: hasta **3 intentos dentro de las 48 horas**.
- Cada intento queda auditado.
- El usuario recibe notificaciones después de cada fallo.
- Si los 3 intentos fallan o vence el plazo: el fee pasa a `expired` (estado terminal) y la reserva pasa a `expired_fee_unpaid`.
- Sin fee pagado: no se confirma reserva, no se emite comprobante, la residencia puede liberar la plaza.
- **El cobro debe ser idempotente.** Si el proveedor envía el webhook múltiples veces, no debe generarse un cobro duplicado ni un comprobante duplicado.

## 8.9. Revocación del fee — DECISIÓN CONFIRMADA

Si el estudiante ejerce el derecho de revocación dentro de los **10 días corridos** posteriores al pago del fee:

- la reserva pasa a `cancelled_by_student` con `reason_code = student_revocation_right`;
- el comprobante pasa a `voided`;
- el fee **permanece `paid`** hasta que admin resuelva manualmente si corresponde `refunded` — no hay transición automática a `refunded`;
- debe abrirse un `support_case` interno para la evaluación de bypass, con posibilidad de cotejar con la residencia antes de resolver;
- el derecho de revocación no alcanza a montos pagados directamente a la residencia.

---

# 9. Máquina de estados: Comprobante

## 9.1. Entidad

```
booking_receipt
```

Nombre visible:

```
Comprobante de Reserva Confirmada
```

Para renovaciones:

```
Comprobante de Renovación Confirmada
```

---

## 9.2. Estados técnicos

| Estado técnico | Descripción |
|---|---|
| `not_available` | Todavía no corresponde emitirlo. |
| `pending_generation` | La reserva está confirmada y el sistema debe generar el comprobante. |
| `issued` | Comprobante emitido. |
| `generation_failed` | Falló la generación del PDF o QR. |
| `voided` | Comprobante anulado por cancelación, error grave o intervención admin. |
| `reissued` | Comprobante reemitido por corrección o actualización autorizada. |

---

## 9.3. Contenido mínimo

El comprobante debe incluir:

- ID de reserva;
- QR o código verificable (URL pública `/verify/[codigo]`);
- fecha de emisión;
- datos del estudiante;
- datos del familiar/pagador si aplica;
- datos de residencia y responsable;
- dirección de residencia;
- tipo de habitación/plaza;
- fecha estimada de ingreso;
- duración inicial declarada;
- objetivo académico declarado (obligatorio);
- condiciones finales aceptadas (`snapshot_final`);
- monto abonado a residencia, informado por la residencia;
- fee EstuRed pagado;
- moneda y tipo de cambio usado;
- política de ajustes futuros;
- disclaimer legal;
- contacto de soporte EstuRed.

---

## 9.4. URL de verificación pública

El comprobante incluye un QR que apunta a `/verify/[codigo]`.

Esa URL pública muestra: estado de la reserva, nombre del estudiante (inicial de apellido), residencia, fecha de ingreso y duración. No debe exponer datos sensibles.

---

## 9.5. Reglas

- El objetivo académico declarado es obligatorio para emitir comprobante.
- El monto abonado a residencia se muestra como "informado por la residencia como recibido".
- El fee fiscal (Factura C) se emite a nombre de quien paga. El comprobante de reserva queda asociado al estudiante.
- Los valores de meses futuros pueden variar según la política de ajustes de la residencia.
- El comprobante no convierte a EstuRed en prestador directo del alojamiento.
- Admin puede emitir o reemitir comprobante manualmente (queda auditado).

---

# 10. Máquina de estados: Disponibilidad

## 10.1. Entidades

```
residence_availability_status
room_type_availability
bed_availability
```

---

## 10.2. Modo Perfil Verificado

Estados por residencia o tipo de habitación:

| Estado técnico | Texto visible | Descripción |
|---|---|---|
| `available_to_confirm` | Disponibilidad informada por la residencia. Requiere confirmación al solicitar. | Hay disponibilidad declarada/semi-real. |
| `full` | Residencia completa. | La residencia declara no tener cupos. |
| `not_updated` | Sin disponibilidad actualizada. | No hubo actualización dentro del plazo requerido. |
| `paused_by_residence` | Solicitudes pausadas por la residencia. | La residencia pausó temporalmente. |
| `paused_by_admin` | Disponibilidad pausada por EstuRed. | Admin pausó por control, reclamo o incumplimiento. |

---

## 10.3. Modo Gestión Operativa

Estados por plaza/cama:

| Estado técnico | Texto visible | Descripción |
|---|---|---|
| `available` | Disponibilidad asegurada. | Plaza disponible con gestión operativa actualizada. |
| `in_contact` | Solicitud en proceso. | Hay una solicitud avanzando. |
| `temporarily_held` | Plaza retenida temporalmente. | La residencia informó pago recibido, falta fee EstuRed. |
| `reserved` | Reservada. | Reserva confirmada en EstuRed. |
| `occupied` | Ocupada. | Hay residente alojado. |
| `blocked` | Bloqueada. | Bloqueo manual. |
| `maintenance` | Fuera de operación. | Mantenimiento. |
| `unavailable` | No disponible. | No disponible por otro motivo. |

---

## 10.4. Reglas

- Cada residencia define disponibilidad por tipo de habitación y plaza.
- La residencia debe actualizar disponibilidad al menos cada **30 días** o marcar estado `full`.
- Si no actualiza: recibe recordatorios, puede mostrarse como `not_updated`.
- Si el estado `not_updated` persiste más de **15 días**, la residencia desaparece de búsquedas activas hasta que actualice.
- El estado `full` lo selecciona la residencia cuando no tiene cupos reales.
- Una residencia con `not_updated` puede seguir recibiendo solicitudes, pero con advertencia visible para el estudiante.
- El rechazo constante por falta de disponibilidad sin actualizar penaliza visibilidad.

---

# 11. Máquina de estados: Lista de espera

## 11.1. Entidad

```
waitlist_entry
```

---

## 11.2. Estados técnicos

| Estado técnico | Descripción |
|---|---|
| `active` | El estudiante está en lista de espera. |
| `availability_notification_sent` | Se notificó que apareció disponibilidad. |
| `retention_check_sent` | A los 90 días se envió recordatorio para confirmar continuidad. |
| `student_activated_request` | El estudiante decidió activar una solicitud. |
| `removed_by_student` | El estudiante salió voluntariamente. |
| `removed_by_residence` | La residencia eliminó manualmente al estudiante. |
| `removed_by_admin` | Admin eliminó por control o soporte. |
| `removed_due_to_confirmed_reservation` | El estudiante reservó en otra residencia. |
| `closed_by_residence` | La residencia cerró la lista de espera para ese tipo/plaza. |

---

## 11.3. Reglas

- Estar en lista de espera no cuenta como solicitud activa.
- Solo pueden permanecer estudiantes que no tengan reserva confirmada en EstuRed.
- Si un estudiante confirma reserva en otra residencia, sale automáticamente de todas las listas de espera.
- A los 90 días, el sistema envía recordatorio para que el estudiante confirme si quiere seguir.
- La lista no vence automáticamente por tiempo.
- Cuando aparece disponibilidad: los estudiantes reciben notificación especial. La residencia puede contactar. No se activa solicitud automáticamente.

---

# 12. Máquina de estados: Renovaciones

## 12.1. Entidades

```
renewal_request     (solicitud del estudiante o intención)
renewal_offer       (oferta formal emitida por la residencia)
```

Las renovaciones son Must Have del MVP. Se separan en dos entidades para evitar el solapamiento detectado en la auditoría.

---

## 12.2. Estados técnicos: renewal_request

| Estado técnico | Descripción |
|---|---|
| `created_by_student` | El estudiante expresó interés en renovar. No es oferta vinculante. |
| `notified_to_residence` | La residencia fue notificada de la solicitud del estudiante. |
| `offer_received` | La residencia emitió oferta formal. |
| `closed_no_offer` | La residencia no emitió oferta. |
| `superseded_by_offer` | La renovación continúa en el estado de la `renewal_offer`. |

---

## 12.3. Estados técnicos: renewal_offer

| Estado técnico | Descripción |
|---|---|
| `draft` | La residencia está creando la oferta. |
| `sent` | La residencia envió la oferta formal al estudiante. |
| `viewed` | El estudiante vio la oferta. |
| `accepted_by_student` | El estudiante aceptó. |
| `rejected_by_student` | El estudiante rechazó. |
| `expired` | Venció la fecha límite de aceptación. |
| `expired_no_student_payment` | El estudiante aceptó pero no pagó a la residencia dentro del plazo de 48 horas. |
| `residence_payment_pending` | El estudiante debe pagar a la residencia para renovar. |
| `residence_payment_reported` | La residencia marcó Pago recibido. |
| `estured_fee_pending` | Falta pagar fee EstuRed de renovación. |
| `estured_fee_processing` | Fee de renovación en proceso. |
| `confirmed` | Renovación confirmada. Fee pagado. |
| `receipt_pending` | Comprobante de renovación pendiente. |
| `receipt_issued` | Comprobante de Renovación Confirmada emitido. |
| `cancelled_by_residence` | La residencia canceló la oferta o renovación. |
| `cancelled_by_student` | El estudiante canceló antes de confirmar. |
| `disputed` | Reclamo o mediación activo. |

---

## 12.4. Reglas

- La residencia emite la oferta formal de renovación.
- El estudiante puede expresar interés (`renewal_request`), pero eso no crea oferta vinculante.
- La oferta debe incluir: período renovado, precio, moneda, política de ajustes, monto a pagar a residencia si aplica y fecha límite de aceptación.
- Si el estudiante acepta, el flujo es idéntico al de la reserva inicial:
  - pago a residencia si corresponde;
  - residencia marca Pago recibido;
  - EstuRed cobra fee de renovación;
  - renovación confirmada;
  - Comprobante de Renovación Confirmada emitido.
- **El fee de renovación usa exactamente la misma lógica que el fee de reserva inicial**, sin excepciones: 5% sobre tarifa mensual × duración del período renovado + matrícula/cargo de renovación no reembolsable si aplica, excluyendo depósito reembolsable. Decisión tomada para reducir complejidad de código.
- **Al confirmarse la renovación, el sistema extiende la estadía del residente (`resident_stays.end_date` pasa al fin del período renovado) y la plaza mantiene su estado de ocupación** (`occupied`/`reserved` según corresponda). La renovación no crea una `reservation` nueva.

---

# 13. Máquina de estados: Residencia

## 13.1. Entidad

```
residence
```

---

## 13.2. Estados técnicos

| Estado técnico | Descripción |
|---|---|
| `draft` | Residencia creada pero incompleta. |
| `pending_verification` | Perfil completo, esperando verificación. |
| `verification_scheduled` | Visita presencial programada. |
| `verified_active` | Residencia verificada y publicada. |
| `needs_changes` | Debe corregir información. |
| `paused_by_residence` | Residencia pausada voluntariamente. |
| `paused_by_admin` | EstuRed pausó la residencia. |
| `suspended` | Suspendida por incumplimientos. |
| `verification_expired` | Venció la verificación anual. |
| `archived` | Archivada. |

---

## 13.3. Reglas

- Una residencia no verificada no publica.
- La verificación presencial es obligatoria.
- La verificación vence anualmente.
- Debe existir checklist firmado por ambas partes.
- La residencia debe aceptar términos, condiciones, disclaimer y deslinde de responsabilidades.
- Un owner puede tener hasta **10 residencias**, cada una con su propio estado.
- El modo (Perfil Verificado / Gestión Operativa) se gestiona mediante feature flags por residencia.

---

# 14. Máquina de estados: Ediciones de perfil de residencia

## 14.1. Entidad

```
residence_profile_update
```

---

## 14.2. Estados técnicos (cambios que requieren aprobación)

| Estado técnico | Descripción |
|---|---|
| `draft_update` | Cambio iniciado. |
| `pending_admin_review` | Esperando revisión admin. |
| `approved` | Cambio aprobado y publicado. |
| `rejected` | Cambio rechazado. |
| `cancelled_by_residence` | La residencia canceló el cambio. |

---

## 14.3. Campos que requieren aprobación admin

- fotos;
- dirección;
- nombre comercial;
- servicios incluidos;
- reglas principales;
- condiciones de reserva;
- capacidad total;
- tipos de habitación;
- documentación de residencia.

---

## 14.4. Campos tarifarios

Los cambios de tarifas, matrícula, depósito y política de ajustes son gestionados por cada residencia sin aprobación previa, pero:

- quedan auditados;
- generan alerta admin si suben o bajan más del 15% en una sola edición;
- no alteran snapshots de solicitudes ya enviadas.

---

# 15. Máquina de estados: Familiar vinculado

## 15.1. Entidad

```
family_link
```

---

## 15.2. Estados técnicos

| Estado técnico | Descripción |
|---|---|
| `pending_student_approval` | Familiar solicitó vincularse, estudiante debe aprobar. |
| `active` | Vínculo activo. |
| `rejected_by_student` | Estudiante rechazó. |
| `revoked_by_student` | Estudiante revocó vínculo. |
| `revoked_by_family` | Familiar se desvinculó. |
| `suspended_minor_no_family` | Estudiante menor de edad sin familiar activo. Acciones sensibles bloqueadas. |

---

## 15.3. Reglas

- Un estudiante puede tener solo **1 familiar vinculado activo**.
- Un familiar puede vincularse a más de un estudiante.
- Un estudiante mayor de edad puede usar EstuRed sin familiar vinculado.
- Un estudiante menor de edad **necesita familiar vinculado** para finalizar registro y para acciones sensibles.
- Si el vínculo se revoca y el estudiante es menor sin otro familiar disponible, el sistema entra en estado `suspended_minor_no_family`. Se bloquean acciones sensibles y se notifica al admin.
- El familiar puede proponer solicitudes, cargar documentación, pagar fee EstuRed, cargar comprobantes y acceder al comprobante.
- El familiar **no decide** por el estudiante.
- Si el familiar paga, la Factura C del fee sale a nombre del familiar pagador. El comprobante de reserva queda asociado al estudiante.
- Cuando la solicitud fue iniciada por el familiar (`initiated_by = family_member`), el contacto de la residencia va al familiar (`contact_target = family_member`).

---

# 16. Máquina de estados: Residente / comunidad visible

## 16.1. Entidades

```
resident_profile
resident_stay
community_visibility_settings
```

---

## 16.2. Estados técnicos

| Estado técnico | Descripción |
|---|---|
| `created_by_residence` | La residencia cargó un residente con email. |
| `pending_activation` | El residente todavía no activó su cuenta. |
| `active` | El residente activó y configuró perfil. |
| `visibility_limited` | Perfil activo con visibilidad restringida. |
| `hidden_by_user` | El usuario eligió no mostrar perfil individual. |
| `inactive` | Ya no reside ahí o fue desactivado. |

---

## 16.3. Reglas

- El consentimiento de visibilidad se obtiene durante el registro, con información clara sobre qué datos se muestran y a quién.
- Si el residente no activó cuenta: aparece como "Residente pendiente de activar cuenta" o "Plaza ocupada". No se muestran datos personales.
- La residencia no puede obligar a mostrar perfil completo.
- Datos nunca visibles: apellido completo, mail, teléfono, fecha de nacimiento, universidad, documentos.
- Datos visibles según permiso: nombre + inicial, foto o avatar, edad, nacionalidad/bandera, carrera, ciudad de origen, hábitos, intereses.

---

# 17. Máquina de estados: Soporte / resolución de conflictos

## 17.1. Entidad

```
support_case
```

---

## 17.2. Estados técnicos

| Estado técnico | Descripción |
|---|---|
| `opened` | Caso abierto. |
| `terms_reminder_shown` | Se mostró recordatorio de términos y alcance. |
| `submitted` | Usuario confirmó que desea continuar. |
| `under_review` | EstuRed revisa el caso. |
| `needs_more_info` | Falta evidencia. |
| `waiting_other_party` | Se pidió respuesta a la otra parte. |
| `in_progress` | EstuRed está actuando. |
| `resolved_by_agreement` | Las partes llegaron a acuerdo. |
| `closed_no_action` | EstuRed cerró sin acción. |
| `closed_unresolved` | No hubo acuerdo. |
| `admin_action_taken` | EstuRed tomó acción (penalización, suspensión, reembolso). |

---

## 17.3. Reglas

- Antes de abrir un reclamo: mostrar recordatorio de términos, deslinde de responsabilidad y alcance de la intervención.
- EstuRed puede actuar en determinados casos. No está obligada a intervenir en todos.
- Abrir un reclamo **no suspende automáticamente** solicitud, reserva o renovación.
- Admin puede suspender manualmente si el caso lo amerita.
- Se aceptan evidencias: fotos, videos, capturas, audios, documentos.
- **Usar el término "resolución de conflictos" o "soporte de gestión", no "mediación", en comunicación pública.**

---

# 18. Máquina de estados: Penalización / visibilidad de residencia

## 18.1. Entidad

```
residence_visibility_status
```

---

## 18.2. Estados técnicos

| Estado técnico | Descripción |
|---|---|
| `normal_visibility` | Sin penalización. |
| `warning` | Advertencia. |
| `reduced_visibility` | Menor visibilidad. |
| `temporarily_paused` | Pausada temporalmente. |
| `suspended` | Suspendida. |
| `removed_from_network` | Expulsada de la red. |

---

## 18.3. Factores y ponderación interna inicial

| Factor | Peso |
|---|---:|
| Respuesta y velocidad | 25% |
| Disponibilidad actualizada | 20% |
| Conversión a reserva | 20% |
| Perfil completo/verificado | 15% |
| Baja tasa de reclamos validados | 10% |
| Uso operativo de la plataforma | 10% |

Esta ponderación se usa internamente. No se muestra como ranking público en MVP.

---

# 19. Máquina de estados: Verificación de residencia

## 19.1. Entidad

```
residence_verification
```

---

## 19.2. Estados técnicos

| Estado técnico | Descripción |
|---|---|
| `not_started` | Todavía no inició verificación. |
| `documents_pending` | Faltan datos o documentos. |
| `visit_pending` | Falta visita presencial. |
| `visit_scheduled` | Visita presencial programada. |
| `under_review` | Admin está revisando. |
| `approved` | Verificación aprobada. |
| `rejected` | Verificación rechazada. |
| `needs_changes` | Debe corregir información. |
| `expired` | Verificación anual vencida. |
| `revoked` | Verificación revocada por incumplimiento. |

---

## 19.3. Reglas

- Residencia no verificada no publica.
- La visita presencial es obligatoria.
- La verificación vence anualmente.
- Debe guardarse checklist firmado por ambas partes.
- El sello visible es "Residencia Verificada".
- El alcance del sello aclara que EstuRed revisó identidad, ubicación y consistencia de fotos/información, no que garantiza la prestación futura del alojamiento.

---

# 20. Máquina de estados: Notificaciones

## 20.1. Entidad

```
notification_event
```

---

## 20.2. Estados técnicos

| Estado técnico | Descripción |
|---|---|
| `created` | Notificación creada. |
| `queued` | En cola de envío. |
| `sent` | Enviada. |
| `delivered` | Entregada (si el canal lo permite). |
| `failed` | Falló el envío. |
| `read` | Leída (si el canal lo permite). |
| `dismissed` | Descartada por usuario. |

---

## 20.3. Eventos mínimos que disparan notificación

- propuesta de solicitud recibida por estudiante (familiar la creó);
- propuesta de solicitud aprobada/rechazada (al familiar);
- propuesta de solicitud expirada (al familiar);
- solicitud enviada;
- solicitud recibida por residencia;
- recordatorio diario a residencia;
- contacto establecido;
- propuesta de ajuste enviada por residencia (al estudiante);
- propuesta de ajuste aceptada/rechazada (a la residencia);
- propuesta de ajuste expirada;
- 48 horas iniciadas para pago a residencia;
- 24 horas restantes para pago a residencia;
- solicitud vencida (con opción de actualizar parámetros);
- residencia marca Pago recibido;
- fee EstuRed pendiente;
- intento de cobro fallido;
- fee pagado;
- factura emitida;
- reserva confirmada;
- comprobante emitido;
- disponibilidad nueva para lista de espera;
- recordatorio de 90 días de lista de espera;
- oferta de renovación enviada;
- renovación aceptada;
- renovación confirmada;
- reclamo abierto;
- admin solicita información adicional.

Reglas:

- El usuario debe tener al menos un canal obligatorio.
- Email debe funcionar como respaldo para eventos críticos.
- WhatsApp: no hay integración API en MVP. El sistema genera mensajes pre-formateados que las partes pueden enviar manualmente.

---

# 21. Estados terminales por entidad

## 21.1. Propuesta de solicitud (family_application_proposal)

Terminales: `approved_by_student`, `rejected_by_student`, `expired`.

## 21.2. Solicitud (application_request)

Terminales: `converted_to_reservation`, `rejected`, `expired_no_residence_response`, `expired_no_student_payment`, `expired_offer_no_response`, `cancelled_by_student`, `cancelled_by_residence`, `closed_due_to_other_confirmed_reservation`.

No terminal especial: `disputed` (puede volver a otro estado mediante acción admin).

## 21.3. Reserva

Terminales o casi terminales: `receipt_issued`, `expired_fee_unpaid`, `cancelled_by_student`, `cancelled_by_residence`, `no_show`, `completed`.

No terminal especial: `disputed`.

**Salida de `disputed` (todas las entidades):** solo el admin puede sacar una entidad de `disputed`, devolviéndola al último estado previo registrado en `*_status_events` o llevándola a un estado terminal (`cancelled_*`, `closed_*`), siempre con motivo obligatorio y auditoría.

## 21.4. Fee EstuRed

Terminales: `paid`, `expired`, `refunded`, `chargeback`.

## 21.5. Lista de espera

Terminales: `student_activated_request`, `removed_by_student`, `removed_by_residence`, `removed_by_admin`, `removed_due_to_confirmed_reservation`, `closed_by_residence`.

No vence automáticamente por tiempo. `retention_check_sent` no es terminal.

---

# 22. Casos borde obligatorios para QA

1. Familiar crea propuesta → estudiante aprueba → se convierte en solicitud con `initiated_by = family_member` y `contact_target = family_member`.
2. Familiar crea propuesta → estudiante rechaza → familiar notificado, no hay solicitud creada.
3. Familiar crea propuesta → 48h sin respuesta → propuesta expira, familiar notificado.
4. Propuesta en `pending_student_approval` no cuenta en el límite de 2 solicitudes.
5. Solicitud vence a las 48h → se muestra detalle + botón "Actualizar con mismos parámetros".
6. Residencia intenta enviar segunda propuesta de ajuste → bloqueado (proposal_count = 1 máximo).
7. Residencia envía propuesta de ajuste → timer de 48h se reinicia.
8. Estudiante acepta propuesta de ajuste → `snapshot_final` actualizado, fee recalculado sobre nuevos valores.
9. Estudiante rechaza propuesta y elige continuar con condiciones originales → `conditions_accepted` con `snapshot_original`.
10. Estudiante rechaza propuesta y cierra la solicitud → `cancelled_by_student`.
11. Propuesta de ajuste sin respuesta en 48h → `expired_offer_no_response`.
12. Estudiante intenta enviar 3ª solicitud activa → bloqueado.
13. Solicitud activa avanza → la otra pasa a `paused_due_to_other_active_request`.
14. Solicitud pausada se reactiva cuando la activa vence.
15. Plaza con 3 solicitudes visibles + 2 en cola.
16. Residencia marca pago recibido → fee activado → cobro duplicado bloqueado por idempotencia.
17. Fee falla 3 veces dentro de 48h → fee pasa a `expired` y la reserva a `expired_fee_unpaid`.
18. Fee pagado pero falla generación de comprobante → reserva `confirmed`, comprobante `generation_failed`.
19. Admin reemite comprobante → auditado.
20. Residencia cancela después de reserva confirmada → estudiante puede abrir reclamo.
21. Estudiante no se presenta en 24h → residencia puede marcar `no_show`.
22. Residencia edita tarifa con variación mayor al 15% → alerta admin.
23. Solicitud guarda snapshot → residencia edita tarifa → snapshot no cambia.
24. Disponibilidad `not_updated` por más de 15 días → residencia desaparece de búsquedas.
25. Estudiante con reserva confirmada sale automáticamente de todas las listas de espera.
26. Estudiante menor sin familiar activo → estado `suspended_minor_no_family` → acciones sensibles bloqueadas, admin notificado.
27. Owner accede a residencia 1 y residencia 2 → contexto activo visible en header → datos de residencia 2 no visibles al operar en residencia 1.
28. Staff con acceso solo a residencia 1 intenta acceder a residencia 2 → bloqueado.
29. Fee cobrado en USD via PayU → se registra monto en ARS y USD, con tipo de cambio del snapshot.
30. Reclamo abierto → reserva no se suspende automáticamente.
31. Admin suspende residencia manualmente → auditado.
32. Rechazos reiterados por `no_availability` → alerta admin.
33. Reserva en `pending_estured_fee` sin ningún intento de pago en 48h → `expired_fee_unpaid` (no `cancelled_by_student`).
34. Estudiante menor de edad envía solicitud propia → `contact_target = family_member`; el botón de WhatsApp usa el número del familiar.
35. Fee `paid` recibe chargeback → alerta admin; reserva y comprobante sin cambios automáticos.
36. Estudiante ejerce revocación dentro de los 10 días → reserva `cancelled_by_student` (`reason_code = student_revocation_right`), comprobante `voided`, fee permanece `paid`, se abre `support_case` de revisión.

---

# 23. Flujo mínimo esperado (happy path)

```
family_application_proposal.pending_student_approval
→ family_application_proposal.approved_by_student
→ application_request.submitted (initiated_by=family_member, contact_target=family_member)
→ application_request.under_review
→ application_request.contact_established
→ application_request.offer_pending_student_acceptance [opcional — solo si hay negociación]
→ application_request.conditions_accepted [opcional — solo si hubo negociación]
→ application_request.residence_payment_pending
→ application_request.residence_payment_reported
→ application_request.converted_to_reservation
→ reservation.pending_estured_fee
→ estured_fee_payment.processing
→ estured_fee_payment.paid
→ reservation.confirmed
→ reservation.receipt_pending
→ booking_receipt.pending_generation
→ booking_receipt.issued
→ reservation.receipt_issued
```

Happy path sin propuesta del familiar:

```
application_request.submitted (initiated_by=student)
→ application_request.contact_established
→ application_request.residence_payment_pending
→ application_request.residence_payment_reported
→ application_request.converted_to_reservation
→ reservation.pending_estured_fee
→ estured_fee_payment.paid
→ reservation.confirmed
→ booking_receipt.issued
→ reservation.receipt_issued
```

---

# 24. Reglas de implementación para Claude Code

1. No fusionar solicitud, reserva y pago en una sola entidad.
2. No llamar reserva confirmada a una operación sin fee EstuRed pagado.
3. No emitir comprobante antes de reserva confirmada.
4. No cerrar solicitudes alternativas hasta que exista reserva confirmada.
5. No vencer automáticamente lista de espera por tiempo.
6. No permitir publicar residencias no verificadas.
7. No permitir que cambios tarifarios alteren snapshots de solicitudes existentes.
8. No mostrar datos sensibles nunca.
9. No mostrar rankings públicos de residencias.
10. No implementar Señales de Convivencia en esta etapa.
11. No implementar IA avanzada como dependencia del MVP.
12. No omitir audit logs en acciones críticas.
13. No hacer que el reclamo suspenda estados automáticamente.
14. No permitir que la residencia confirme múltiples solicitudes para la misma plaza al mismo tiempo.
15. No permitir que un estudiante tenga más de 2 solicitudes activas.
16. No permitir que la residencia envíe más de 1 propuesta de ajuste por solicitud.
17. No permitir que el familiar envíe solicitudes directamente a la residencia sin aprobación del estudiante.
18. No calcular el fee sobre los valores originales si hubo propuesta de ajuste aceptada. Usar siempre `snapshot_final`.
19. El cobro del fee debe ser idempotente. Un webhook recibido múltiples veces no debe generar cobro duplicado.
20. No usar strings libres para estados. Usar enums definidos en este documento.

---

# 25. Pendientes no bloqueantes

- Revisión legal de términos y condiciones.
- Revisión legal de no reembolso y derecho de arrepentimiento.
- Tratamiento de datos personales y menores de edad.
- Texto final de disclaimers.
- Criterios detallados de penalización cuando haya datos suficientes.
- Diseño final de colores, iconos y microcopy por estado.
- Precio del plan pago de Gestión Operativa.
