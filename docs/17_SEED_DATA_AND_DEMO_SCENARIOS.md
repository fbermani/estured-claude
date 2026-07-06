# 17_SEED_DATA_AND_DEMO_SCENARIOS.md

**Versión:** 1.1
**Estado:** Documento actualizado para construcción
**Última actualización:** 2026-06-27

## Propósito del documento

Define los datos seed, usuarios demo, residencias demo, escenarios operativos y recorridos de prueba que deben existir para construir, probar y demostrar el MVP de EstuRed.

Debe leerse junto con `00`, `02`, `03`, `04`, `05`, `06`, `08`, `16`.

## Principios generales para datos demo

Realistas, pero nunca información personal real sin consentimiento. Deben permitir probar el loop central completo:

**Estudiante (o familiar con aprobación del estudiante) busca residencia → envía solicitud → residencia establece contacto → [negociación opcional: la residencia propone un ajuste, una sola vez] → estudiante paga a residencia → residencia marca pago recibido → EstuRed cobra fee (ARS o USD) → se emite factura fiscal → reserva confirmada → comprobante emitido.**

También deben permitir probar: propuesta de solicitud del familiar (aprobada, rechazada, vencida); negociación de condiciones (aceptada, rechazada, vencida); máximo de 2 solicitudes activas; solicitud pausada; cola por plaza; lista de espera; residencia completa; disponibilidad informada/asegurada; fee EstuRed en ambos proveedores y monedas; factura fiscal emitida y fallida; comprobante emitido y pendiente por fallo técnico; renovación; familiar vinculado; estudiante menor de edad; residente pendiente de activar cuenta; comunidad visible; edición de tarifas con alerta +15%; soporte y resolución de conflictos; penalización de visibilidad; acceso freemium a Gestión Operativa; owner con múltiples residencias; admin audit log.

## Reglas de anonimización

Nombres, emails, teléfonos, direcciones y documentos ficticios. No DNIs ni teléfonos reales. No fotos reales sin licencia. Avatares generados o placeholders para personas; fotos placeholder o autorizadas para residencias.

## Convenciones de emails demo

Dominios: `@example.com`, `@estured.test`, `@demo.estured`.

Ejemplos: `lucia.student@example.com`, `padre.lucia@example.com`, `owner.residencia.norte@example.com`, `admin@estured.test`.

## Moneda y tipo de cambio seed — actualizado

```txt
official_exchange_rate_ars_per_usd = 1250
source_name = monedapi.ar
rate_type = blue_sell
rate_date = fecha actual del seed
```

Reglas: tarifas en USD y ARS; conversión según snapshot; USD termina en 0 o 5; ARS termina en 500 o 000; fee redondeado a múltiplos de 500 ARS.

## Usuarios demo obligatorios

### 1. Superadmin EstuRed

```txt
role: superadmin
email: superadmin@estured.test
name: Superadmin EstuRed
```

Puede: todo el admin panel; gestionar admins; audit log completo; aprobar/verificar residencias; intervenir solicitudes y reservas; validar pagos manuales; generar/reemitir/anular comprobantes; reemitir/anular facturas fiscales; suspender usuarios/residencias; modificar configuración global (incluyendo proveedores de pago, tipo de cambio y facturación).

### 2. Admin operativo EstuRed

```txt
role: admin
email: admin.operaciones@estured.test
name: Admin Operaciones
```

Puede: revisar residencias; gestionar verificaciones; revisar solicitudes; revisar propuestas del familiar y negociaciones activas; gestionar pagos y comprobantes; gestionar facturas fiscales; abrir/cerrar casos de soporte; ver alertas de tarifas; aplicar penalizaciones; gestionar feature flags freemium.

No puede: crear otros superadmins; cambiar configuración crítica sin permiso de superadmin.

### 3. Estudiante mayor en búsqueda

```txt
role: student
email: lucia.fernandez@example.com
name: Lucia
last_name: Fernandez
public_name: Lucia F.
age: 19
nationality: Argentina
origin_city: Rosario
career: Medicina
study_destination_declared: Universidad en CABA
academic_objective: Iniciar carrera universitaria en CABA durante el ciclo lectivo actual.
visibility: registered_users
preferred_payment_provider: mercado_pago
```

Perfil bastante completo; foto/avatar habilitado; hábitos visibles para registrados; documentación opcional cargada; sin reserva confirmada al inicio.

Sirve para probar: búsqueda; solicitud directa; negociación; pago vía MercadoPago; comprobante; lista de espera; familiar vinculado que crea una propuesta.

### 4. Familiar vinculado de estudiante mayor

```txt
role: family
email: padre.lucia@example.com
name: Martin Fernandez
relationship: father
linked_student: Lucia F.
link_status: active
can_create_proposals: true
```

Puede: ver dashboard de Lucia con permisos limitados; sugerir favoritos; crear propuesta de solicitud (pendiente de aprobación de Lucia); cargar documentación; subir comprobantes; pagar fee EstuRed; descargar comprobante.

No puede: modificar perfil sensible sin permiso; enviar solicitudes directamente a la residencia sin aprobación de Lucia; aceptar una propuesta de ajuste en nombre de Lucia; vincularse a otro estudiante sin proceso correspondiente.

### 5. Estudiante internacional

```txt
role: student
email: camila.rojas@example.com
name: Camila
last_name: Rojas
public_name: Camila R.
age: 21
nationality: Chile
origin_city: Santiago
career: Diseño Grafico
study_destination_declared: Institución educativa en CABA
academic_objective: Realizar intercambio academico por un semestre en CABA.
visibility: registered_users
preferred_payment_provider: payu_argentina
```

Perfil completo; sin familiar vinculado obligatorio; interés en estadía de 6 meses; documentación parcial.

Sirve para probar: tarifas USD/ARS; público internacional; solicitudes; fee cobrado en USD vía PayU; documentación opcional.

### 6. Estudiante menor de edad

```txt
role: student
is_minor: true
email: valentina.sosa@example.com
name: Valentina
last_name: Sosa
public_name: Valentina S.
age: 17
nationality: Argentina
origin_city: Cordoba
career: Arquitectura
study_destination_declared: Universidad en CABA
academic_objective: Mudanza a CABA para inicio de estudios universitarios.
visibility: limited_until_family_link
```

Registro incompleto hasta vincular familiar; bloqueo para solicitar hasta vínculo activo; visibilidad limitada.

### 7. Familiar obligatorio de menor

```txt
role: family
email: madre.valentina@example.com
name: Laura Sosa
relationship: mother
linked_student: Valentina S.
link_status: pending_student_approval
```

Nota de corrección: el valor de `link_status` debe ser un único estado concreto, no una disyuntiva como en la versión anterior. Para el seed base usar `pending_student_approval` (permite probar el escenario de aprobación, ver Escenario 6). Si se necesita un segundo caso ya vinculado, crear un registro adicional separado con `link_status: active`.

Sirve para probar: restricción de menor; vinculación obligatoria; pago por familiar; permisos limitados.

### 8. Estudiante ya alojado

```txt
role: student
email: tomas.alvarez@example.com
name: Tomas
last_name: Alvarez
public_name: Tomas A.
age: 22
nationality: Uruguay
origin_city: Montevideo
career: Economia
current_residence: Residencia Norte
current_room: Habitacion 2A
current_place: Cama 2A-1
visibility: registered_users
```

Sirve para probar: comunidad visible; residente activo; renovación; comprobante de renovación; salida de lista de espera en otras residencias.

### 9. Residente pendiente de activar cuenta

```txt
email: residente.pendiente@example.com
status: pending_activation
public_display: Residente pendiente de activar cuenta
assigned_place: Habitacion 3B - Cama 3B-2
```

Debe mostrarse como plaza ocupada sin datos personales.

### 10. Owner con múltiples residencias (nuevo)

```txt
role: residence_owner
email: owner.grupo-norte@example.com
name: Ricardo Gimenez
manages_residences:
  - Residencia Norte
  - Residencia Rio de la Plata
```

Reasignación respecto a la versión anterior: "Residencia Norte" y "Residencia Rio de la Plata" pasan a pertenecer al mismo owner. No se agregan residencias nuevas para mantener el dataset acotado.

Sirve para probar: `/residence/dashboard` en modo multi-residencia (scroll vertical + filtro); aislamiento de datos entre ambas residencias; staff con acceso a una o ambas.

### 11. Staff con acceso a una sola residencia

```txt
role: residence_staff
email: staff.norte@example.com
assigned_residences:
  - Residencia Norte
permissions: [view_applications, manage_applications, manage_availability]
```

### 12. Staff con acceso a múltiples residencias del mismo owner (nuevo)

```txt
role: residence_staff
email: staff.grupo-norte@example.com
assigned_residences:
  - Residencia Norte
  - Residencia Rio de la Plata
permissions: [view_applications, manage_applications]
```

Sirve para probar AUTH-006/007 de `16_QA_AND_TESTING_PLAN.md`.

## Residencias demo obligatorias

Crear al menos 6 residencias demo.

### Residencia 1: Residencia Norte

```txt
name: Residencia Norte
slug: residencia-norte
zone: Palermo
owner: Ricardo Gimenez (owner.grupo-norte@example.com)
mode: gestion_operativa
has_operational_management_access: true
is_pioneer: true
pioneer_free_access_until: +1 año desde alta del seed
verification_status: verified_active
availability_mode: real_by_place
public_availability_label: Disponibilidad asegurada
```

Perfil: fotos cargadas; reglas completas; servicios completos; política de ajustes trimestral; tarifas en USD y ARS; matrícula configurada; depósito reembolsable configurado; comunidad visible activa; residentes cargados; FAQ configurada con preguntas del listado predefinido.

Tarifas ejemplo:

```txt
single_room_usd: 500
double_room_usd: 350
triple_room_usd: 300
matricula_usd: 100
deposito_usd: 350
adjustment_policy: quarterly
```

Habitaciones: 1A individual (available); 2A doble (1 occupied, 1 available); 3B triple (2 occupied, 1 maintenance).

Debe permitir probar: Gestión Operativa vía feature flag activo; disponibilidad asegurada; comunidad visible; solicitudes por plaza; renovación; residentes; dashboard multi-residencia (junto con Residencia Rio de la Plata).

### Residencia 2: Casa Universitaria Sur

```txt
name: Casa Universitaria Sur
slug: casa-universitaria-sur
zone: San Telmo
mode: perfil_verificado
has_operational_management_access: false
verification_status: verified_active
availability_mode: by_room_type_to_confirm
public_availability_label: Disponibilidad informada por la residencia. Requiere confirmación al solicitar.
```

Tarifas ejemplo:

```txt
double_room_usd: 300
triple_room_usd: 250
matricula_usd: 75
deposito_usd: 250
adjustment_policy: monthly
```

Debe permitir probar: Modo Perfil Verificado sin acceso freemium; disponibilidad semi-real; solicitud por tipo de habitación; confirmación manual; una residencia que NO tiene Gestión Operativa habilitada, para probar `OPERATIONAL_MANAGEMENT_NOT_ENABLED`.

### Residencia 3: Residencia Obelisco

```txt
name: Residencia Obelisco
slug: residencia-obelisco
zone: Centro
mode: perfil_verificado
verification_status: verified_active
availability_status: full
public_label: Residencia completa
```

Debe permitir probar: estado completa; lista de espera; notificación de disponibilidad; no permitir solicitud directa sin cupos.

### Residencia 4: Residencia Rio de la Plata

```txt
name: Residencia Rio de la Plata
slug: residencia-rio-de-la-plata
zone: Belgrano
owner: Ricardo Gimenez (owner.grupo-norte@example.com)
mode: gestion_operativa
has_operational_management_access: true
is_pioneer: false
verification_status: verified_active
availability_mode: real_by_place
```

Nota: segunda residencia del mismo owner que Residencia Norte, pero sin ser pionera (para probar que el freemium se otorga por residencia, no por owner).

Debe tener: una plaza con 3 solicitudes visibles y 2 en cola; una solicitud en contacto establecido; una plaza temporalmente retenida; una reserva confirmada; métricas de respuesta buenas.

Sirve para probar: cola por plaza; solicitud pausada; plaza tomada; métricas internas; aislamiento multi-residencia respecto a Residencia Norte.

### Residencia 5: Residencia Pendiente

```txt
name: Residencia Pendiente
slug: residencia-pendiente
verification_status: pending_verification
published: false
```

Debe permitir probar: residencia no publicada; admin verification; checklist pendiente; bloqueo de publicación.

### Residencia 6: Residencia con Alertas

```txt
name: Residencia con Alertas
slug: residencia-alertas
verification_status: verified_active
mode: perfil_verificado
has_operational_management_access: false
```

Debe tener: tarifa modificada con variación mayor al 15%; varias solicitudes rechazadas por falta de disponibilidad; disponibilidad no actualizada; advertencia de visibilidad.

Sirve para probar: `/admin/pricing`; penalización; alertas; métricas negativas.

## Configuración de habitaciones y plazas demo

Tipos de habitación (nombres visibles, corregido el espacio extra del original): Individual, Doble, Triple, Cuádruple, Compartida.

Estados de plaza demo: crear al menos una en cada estado — `available`, `in_contact`, `temporarily_held`, `reserved`, `occupied`, `blocked`, `maintenance`, `unavailable`. Cada estado debe mostrarse correctamente en dashboard residencia y admin.

## Propuestas de solicitud del familiar demo (bloque nuevo)

### Propuesta A: pendiente de aprobación

```txt
family_member: Martin Fernandez
student: Lucia F.
residence: Casa Universitaria Sur
room_type: Doble
status: pending_student_approval
expires_at: +48h desde creación
```

Debe probar: `/students/family-proposals` mostrando la propuesta a Lucia; que Casa Universitaria Sur no tiene ninguna visibilidad de esta propuesta.

### Propuesta B: aprobada, convertida en solicitud

```txt
family_member: Laura Sosa
student: Valentina S.
residence: Residencia Norte
room_type: Individual
status: approved_by_student
converted_to_application: Solicitud G (ver más abajo)
```

Debe probar: el flujo completo familiar → propuesta → aprobación → solicitud con `initiated_by = family_member` y `contact_target = family_member`.

### Propuesta C: rechazada

```txt
family_member: Martin Fernandez
student: Lucia F.
residence: Residencia Obelisco
status: rejected_by_student
```

### Propuesta D: vencida

```txt
family_member: Martin Fernandez
student: Lucia F.
residence: Residencia con Alertas
status: expired
created_at: hace 50 horas
```

## Solicitudes demo obligatorias

### Solicitud A: flujo feliz en progreso

```txt
student: Lucia F.
residence: Residencia Norte
room_type: Doble
place: 2A-2
status: contact_established
initiated_by: student
contact_target: student
created_at: hace 12 horas
```

Debe permitir avanzar a: `offer_pending_student_acceptance` (ver Solicitud H) → `residence_payment_pending` → `residence_payment_reported` → `pending_estured_fee` → `confirmed` → `receipt_issued`.

### Solicitud B: segunda solicitud pausada

```txt
student: Lucia F.
residence: Casa Universitaria Sur
room_type: Triple
status: paused_due_to_other_active_request
reason: Lucia está avanzando con Residencia Norte
```

Debe probar: pausa automática; reactivación si A vence/cancela; cierre si A confirma reserva.

### Solicitud C: rechazada por falta de disponibilidad

```txt
student: Camila R.
residence: Residencia con Alertas
status: rejected
rejection_reason_code: no_availability
```

Debe alimentar métricas y alertas admin.

### Solicitud D: vencida por no pago del estudiante

```txt
student: Estudiante Demo 4
residence: Casa Universitaria Sur
status: expired_no_student_payment
```

Debe probar vencimiento de 48h (no 72h) para pago a residencia, y el botón "Actualizar con mismos parámetros".

### Solicitud E: vencida por falta de respuesta de residencia

```txt
student: Estudiante Demo 5
residence: Residencia con Alertas
status: expired_no_residence_response
```

Debe generar penalización/alerta.

### Solicitud F: plaza tomada

```txt
student: Estudiante Demo 6
residence: Residencia Rio de la Plata
status: closed_due_to_other_confirmed_reservation
```

### Solicitud G: originada por propuesta del familiar (nuevo)

```txt
student: Valentina S.
residence: Residencia Norte
room_type: Individual
status: submitted
initiated_by: family_member
contact_target: family_member
originated_from_proposal: Propuesta B
```

Debe probar: al establecer contacto, el botón de WhatsApp usa el teléfono de Laura Sosa, no el de Valentina.

### Solicitud H: en negociación de condiciones (nuevo)

```txt
student: Lucia F.
residence: Residencia Norte
status: offer_pending_student_acceptance
proposal_count: 1
negotiation_proposal:
  proposed_monthly_price_usd: 320 (original era 350)
  proposed_deposit_usd: 300 (original era 350)
  special_conditions: "Descuento por pago de estadía completa por adelantado"
  expires_at: +48h desde el envío de la propuesta
```

Debe probar: vista comparativa condiciones originales vs. propuestas; aceptación con recalculo de fee sobre `snapshot_final`; intento de segunda propuesta bloqueado.

### Solicitud I: negociación rechazada, continúa con condiciones originales (nuevo)

```txt
student: Camila R.
residence: Casa Universitaria Sur
status: conditions_accepted
snapshot_final = snapshot_original
negotiation_history:
  - proposal_rejected_reason: chose_original
```

### Solicitud J: negociación vencida sin respuesta (nuevo)

```txt
student: Estudiante Demo 7
residence: Residencia Rio de la Plata
status: expired_offer_no_response
```

## Pagos demo obligatorios — actualizado

### Pago a residencia informado

```txt
payment_to_residence_status: reported_received_by_residence
amount_usd: 450
amount_ars: 562500
reported_by: residence_owner
student_reference_uploaded: true
```

### Fee EstuRed pendiente

```txt
fee_status: pending_manual_payment
fee_base_usd: 2100
fee_percentage: 5
fee_amount_usd_equivalent: 105
fee_amount_ars: 131500
based_on_snapshot: final (si la solicitud tuvo negociación) | original
```

### Fee fallido con reintentos

```txt
fee_status: failed
payment_provider: mercado_pago
attempts: 1
max_attempts: 3
expires_at: dentro de 36 horas
```

### Fee pagado vía MercadoPago (ARS)

```txt
fee_status: paid
payment_provider: mercado_pago
payment_currency: ARS
payer: Martin Fernandez
beneficiary_student: Lucia F.
```

Debe permitir: confirmar reserva; disparar emisión de factura fiscal; emitir comprobante.

### Fee pagado vía PayU (USD) — nuevo

```txt
fee_status: paid
payment_provider: payu_argentina
payment_currency: USD
fee_amount_usd: 105
payer: Camila R.
beneficiary_student: Camila R.
```

Debe probar: cálculo correcto en USD usando el tipo de cambio del snapshot; misma cadena de eventos posteriores que el pago en ARS.

### Fee reembolsado

```txt
fee_status: refunded
refund_reason: cancelacion_atribuible_a_residencia
admin_reviewed: true
```

Debe probar admin payments. Nota: no revierte automáticamente la factura fiscal ya emitida (ver `09_ADMIN_PANEL_SPEC.md` §15.3) — para el seed, dejar la factura asociada en estado `issued` sin nota de crédito, ya que ese flujo queda fuera del MVP.

## Facturas fiscales demo (bloque nuevo)

### Factura emitida correctamente

```txt
fee_payment: Fee pagado vía MercadoPago (Lucia F.)
fiscal_invoice_status: issued
invoice_type: Factura C
payer_name: Martin Fernandez
payer_iva_condition: consumidor_final
issued_at: inmediatamente después del pago
```

### Factura pendiente de emisión

```txt
fee_payment: Fee pagado vía PayU (Camila R.)
fiscal_invoice_status: pending_issue
```

### Factura con fallo de emisión

```txt
fee_payment: (fee pagado, reserva confirmed)
fiscal_invoice_status: issue_failed
retry_count: 1
```

Debe probar: la reserva asociada está `confirmed` igual, sin bloqueo; aparece en `/admin/invoices` para reintento.

## Comprobantes demo obligatorios — actualizado

### Comprobante de Reserva Confirmada

```txt
reservation: Solicitud A (una vez completado el flujo)
verification_code: DEMO-REC-0001
qr_url: /verify/DEMO-REC-0001
status: issued
```

Incluye: ID de reserva; QR/código verificable; estudiante; familiar pagador si aplica; residencia; habitación/plaza; fecha de ingreso; duración inicial; objetivo académico; condiciones finales (snapshot_final); monto abonado a residencia informado por residencia; fee EstuRed y moneda; referencia a factura fiscal; política de ajustes; disclaimer.

### Comprobante pendiente por fallo técnico

```txt
reservation_status: confirmed
receipt_status: generation_failed
```

Debe aparecer en admin dashboard como alerta.

### Comprobante anulado

```txt
verification_code: DEMO-REC-0002
status: voided
```

Debe probar que `/verify/DEMO-REC-0002` muestra "anulado", no "válido".

### Revocación en revisión (bloque nuevo)

```txt
reservation_status: cancelled_by_student
cancellation_reason_code: student_revocation_right
receipt: DEMO-REC-0002 (voided — reutiliza el comprobante anulado)
fee_status: paid (pendiente de revisión admin, sin reembolso automático)
support_case: abierto, categoría revocación, asignado a admin
revocation_requested_at: hace 2 días (dentro del plazo de 10 días corridos)
```

Debe probar: flujo completo de revocación; visibilidad del caso en el dashboard admin; que el fee no pasó a `refunded` automáticamente.

## Lista de espera demo

Sin cambios de fondo. Crear listas para Residencia Obelisco y Casa Universitaria Sur: `active`; `active` con recordatorio de 90 días (`notification_due: true`, sin vencer automáticamente); `removed_due_to_confirmed_reservation` (Tomas A.).

## Renovaciones demo obligatorias

Sin cambios de fondo, salvo reflejar la separación `renewal_requests`/`renewal_offers` de `04_STATE_MACHINES.md`:

```txt
renewal_request:
  student: Tomas A.
  residence: Residencia Norte
  status: created_by_student

renewal_offer:
  student: Tomas A.
  period_months: 6
  monthly_rate_usd: 350
  matricula_usd: 0
  deposit_usd: 0
  adjustment_policy: quarterly
  status: sent
  expires_at: dentro de 7 dias
```

Renovación confirmada: `status: confirmed`, `fee_status: paid`, `receipt_status: issued`, `receipt_name: Comprobante de Renovación Confirmada`, `fiscal_invoice_status: issued`, `verification_code: DEMO-REN-0001`.

Renovación vencida: `status: expired`, motivo "estudiante no aceptó antes de la fecha límite".

## Comunidad visible demo

Sin cambios de fondo: residente activo visible (Tomas A.); residente con visibilidad limitada (Sofía M.); residente pendiente de activar; plaza ocupada sin perfil visible.

## Documentos demo

Sin cambios de fondo: `identity_document`, `proof_of_study`, `guardian_authorization`, `payment_reference`, `other`. Reglas: no públicos; residencia solo con contexto autorizado; admin con auditoría (y justificación registrada obligatoria); familiar puede cargar documentos del estudiante vinculado.

## FAQ / Bot limitado demo — actualizado

Para Residencia Norte, elegir del listado de preguntas predefinidas (no texto libre):

```txt
Pregunta predefinida: "¿La residencia incluye wifi?"
Respuesta: Sí, el wifi está incluido en la tarifa mensual.

Pregunta predefinida: "¿Se permiten visitas?"
Respuesta: Sí, con aviso previo y respetando los horarios de la residencia.

Pregunta predefinida: "¿Cómo funciona la disponibilidad?"
Respuesta: La disponibilidad se actualiza desde la gestión operativa de la residencia. Si figura como disponible, puede solicitarse la plaza.
```

Para Casa Universitaria Sur:

```txt
Pregunta predefinida: "¿El precio está en pesos o dólares?"
Respuesta: La residencia muestra valores en USD y ARS. El valor en pesos es referencial según el dólar blue del día; el monto final en pesos se acuerda directamente con la residencia al momento del pago.
```

Debe existir un caso de pregunta libre sin respuesta, registrada para que la residencia la revise.

## Soporte y resolución de conflictos demo (renombrado de "Mediaciones")

Crear al menos 4 casos:

Caso 1 — información inconsistente: `opened_by: student`, `against: residence`, `status: under_review`.

Caso 2 — cancelación atribuible a residencia: `opened_by: student`, `status: admin_action_taken`, `action: fee_refunded`.

Caso 3 — no-show: `opened_by: residence`, `status: closed_no_action`.

Caso 4 — reporte de comportamiento discriminatorio: `opened_by: student`, `status: needs_more_info`, `priority: high`.

## Penalizaciones y visibilidad demo

Sin cambios de fondo. Residencia con Alertas: `visibility_status: warning`, luego un segundo registro con `reduced_visibility` por rechazos reiterados sin actualización correspondiente. No mostrar ranking público.

## Métricas demo

Sin cambios de fondo (Residencia Norte, Casa Universitaria Sur, Residencia con Alertas con los valores ya definidos). Agregar campo `adjustment_proposals_sent` / `adjustment_proposals_accepted` en al menos un registro para reflejar la métrica observacional de negociación.

## Notificaciones demo — actualizado

Agregar a la lista de eventos existente: propuesta del familiar creada/aprobada/rechazada/vencida; propuesta de ajuste enviada/respondida/vencida; factura fiscal emitida/fallida.

Canal: `email | in_app` — ya no `whatsapp`, ese canal no existe en el sistema de notificaciones.

## Audit log demo

Agregar a la lista existente: familiar crea propuesta de solicitud; estudiante aprueba/rechaza propuesta; residencia envía propuesta de ajuste; estudiante responde propuesta de ajuste; sistema emite factura fiscal; admin reintenta factura fiscal fallida; admin otorga/revoca acceso freemium.

## Escenarios demo de punta a punta

### Escenario 1: reserva exitosa con familiar pagador

Sin cambios de fondo: Lucia solicita Residencia Norte → Casa Universitaria Sur pausada → contacto → paga y sube comprobante → residencia marca pago recibido → Martin paga fee → reserva confirmada → comprobante emitido → otra solicitud se cierra.

Debe probar: loop central; familiar pagador; comprobante; solicitudes pausadas/cerradas; audit log.

### Escenario 2: estudiante internacional con tarifa USD/ARS y pago en PayU

1. Camila abre Casa Universitaria Sur, ve tarifa USD y ARS con modal referencial.
2. Envía solicitud de 6 meses.
3. Snapshot guarda tipo de cambio de monedapi.ar.
4. Residencia establece contacto.
5. Camila no completa pago a residencia en 48h.
6. Solicitud vence, ve botón "Actualizar con mismos parámetros".

Debe probar: conversión USD/ARS; snapshot; vencimiento a 48h; notificaciones.

### Escenario 3: residencia completa y lista de espera

Sin cambios de fondo.

### Escenario 4: renovación confirmada

Sin cambios de fondo, salvo que ahora incluye emisión de factura fiscal como parte del flujo.

### Escenario 5: residencia con malas métricas

Sin cambios de fondo.

### Escenario 6: menor de edad bloqueado sin familiar

1. Valentina se registra, sistema detecta 17 años.
2. No puede enviar solicitud hasta familiar vinculado activo.
3. Laura (madre) solicita vínculo → `pending_student_approval`.
4. Valentina aprueba → `active`.
5. Laura crea una propuesta de solicitud (Propuesta B) para Residencia Norte.
6. Valentina aprueba la propuesta → se crea Solicitud G con `contact_target = family_member`.

Debe probar: menor de edad; familiar obligatorio; permisos; flujo completo de propuesta del familiar para un menor.

### Escenario 7: comprobante falla técnicamente

Sin cambios de fondo.

### Escenario 8: negociación de condiciones aceptada (nuevo)

1. Lucia tiene Solicitud A en `contact_established`.
2. Residencia Norte envía propuesta de ajuste (Solicitud H): descuento en tarifa mensual y depósito.
3. Lucia ve comparación original vs. propuesta.
4. Lucia acepta.
5. `snapshot_final` se genera; fee recalculado sobre el nuevo monto.
6. Flujo continúa igual que Escenario 1 desde el pago a residencia.

Debe probar: límite de 1 propuesta; comparación; aceptación; recalculo de fee.

### Escenario 9: negociación rechazada y solicitud cerrada (nuevo)

1. Una residencia envía propuesta de ajuste con condiciones peores a las esperadas por el estudiante.
2. El estudiante rechaza y elige cerrar la solicitud.
3. `status = cancelled_by_student`.

Debe probar: camino alternativo de rechazo total, distinto del "continuar con condiciones originales".

### Escenario 9bis: revocación del fee (nuevo)

1. Un estudiante con reserva confirmada y comprobante emitido entra por el enlace del footer.
2. Ejerce la revocación dentro de los 10 días corridos.
3. La reserva pasa a `cancelled_by_student` (`student_revocation_right`); el comprobante se anula; el fee queda `paid`.
4. Se abre un caso de revisión; el admin lo ve en su dashboard, coteja con la residencia y resuelve manualmente el reembolso o su denegación.

Debe probar: pantalla de revocación; ventana de 10 días; anulación del comprobante; revisión admin sin reembolso automático.

### Escenario 10: owner gestiona dos residencias (nuevo)

1. Ricardo Gimenez (owner) entra a `/residence/dashboard`.
2. Ve Residencia Norte y Residencia Rio de la Plata en scroll vertical, con filtro.
3. Opera una solicitud de Residencia Norte.
4. Verifica que Residencia Rio de la Plata no muestra esa solicitud ni ningún dato cruzado.
5. Staff con acceso a ambas (staff.grupo-norte) puede operar en las dos; staff con acceso solo a Norte (staff.norte) no ve Rio de la Plata.

Debe probar: dashboard multi-residencia; aislamiento; permisos de staff diferenciados.

## Seeds mínimos por ambiente — actualizado

### Local

1 superadmin; 1 admin; 4 estudiantes; 2 familiares (con al menos 1 propuesta creada); 3 residencias (incluyendo 2 del mismo owner); solicitudes en varios estados (incluyendo 1 en negociación); 1 reserva confirmada; 1 comprobante emitido con `verification_code`; 1 factura fiscal emitida; 1 lista de espera; 1 renovación.

### Staging

Todos los usuarios demo; 6 residencias; todos los estados principales (incluyendo propuesta del familiar, negociación, freemium); todos los escenarios E2E (10 en total); pagos simulados en ambos proveedores; webhooks simulados; facturación fiscal simulada; documentos ficticios; métricas y penalizaciones.

### Producción

No cargar usuarios ficticios reales salvo configuración necesaria: tipos de habitación; enums; roles; configuración global; plantillas de notificación; parámetros de visibilidad; configuración de tipo de cambio, proveedores de pago y facturación fiscal.

No incluir: estudiantes demo; documentos demo; residencias ficticias publicadas; pagos ficticios; propuestas o negociaciones ficticias.

## Reglas para Claude Code

1. Crear seed data coherente con el modelo de datos oficial (`06_DATA_MODEL.md`).
2. No usar datos personales reales.
3. No crear estados que no existan en `04_STATE_MACHINES.md`.
4. No mezclar propuesta del familiar, solicitud, negociación, pago, reserva, fee, factura y comprobante.
5. No marcar reserva como confirmada sin fee EstuRed pagado.
6. No emitir comprobante sin reserva confirmada.
7. No emitir factura fiscal sin fee pagado.
8. No publicar residencias no verificadas.
9. No hacer visible documentación sensible ni el contenido de propuestas del familiar antes de aprobación.
10. No crear rankings públicos.
11. No usar comunidad visible sin consentimiento.
12. No hacer que lista de espera venza automáticamente por tiempo.
13. No contar lista de espera ni propuestas pendientes como solicitud activa.
14. No activar solicitud desde lista de espera sin acción del estudiante.
15. No permitir más de 2 solicitudes activas por estudiante en los datos seed.
16. No permitir más de 1 propuesta de ajuste por solicitud en los datos seed.
17. No permitir que una residencia avance con más de una solicitud por plaza a la vez.
18. No permitir que cambios tarifarios mayores a 15% pasen sin alerta auditada.
19. No crear pagos ni facturas reales en ambientes demo.
20. No llamar APIs de pago o facturación reales desde seeds — usar mocks o modo sandbox.
21. No asignar acceso freemium a una residencia sin el feature flag explícito en el seed.

## Criterios de aceptación del seed/demo — actualizado

El seed está completo si permite probar: búsqueda pública (con FAQ y modal de tipo de cambio); detalle de residencia; comunidad visible; registro estudiante; vinculación familiar; propuesta de solicitud del familiar (creada, aprobada, rechazada, vencida); solicitud directa; solicitud pausada; negociación de condiciones (aceptada, rechazada, vencida); contacto establecido; pago a residencia; fee pendiente/fallido/pagado en ambos proveedores; **fee vencido con reserva `expired_fee_unpaid`**; factura fiscal emitida y fallida; reserva confirmada; comprobante emitido con `verification_code` verificable; **revocación del fee en revisión admin**; lista de espera; renovación; residencia completa; disponibilidad asegurada/informada; dashboard multi-residencia; feature flag freemium; admin verification/pricing/payments/receipts/invoices; soporte y resolución de conflictos; penalización; audit log; menor de edad (**incluyendo contacto dirigido al familiar**).

## Próximo documento recomendado

`18_RELEASE_AND_BETA_CHECKLIST.md` — ya existe en el proyecto y será auditado a continuación. Debe definir condiciones para lanzar beta controlada con 5 a 10 residencias en CABA, incorporando los flujos de propuesta del familiar, negociación, freemium y facturación fiscal.
