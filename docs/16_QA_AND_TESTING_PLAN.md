# 16_QA_AND_TESTING_PLAN.md

# EstuRed — QA y Plan de Testing del MVP

**Versión:** 1.1
**Estado:** Documento actualizado para construcción
**Producto:** EstuRed MVP
**Mercado inicial:** CABA
**Tipo de producto:** Webapp responsive
**Rutas principales:** `/students`, `/residence` (multi-residencia), `/admin`
**Última actualización:** 2026-06-27

---

## 1. Objetivo del documento

Define el plan de QA y testing para construir, validar y lanzar el MVP de EstuRed sin romper las reglas críticas del producto.

El MVP se considera listo cuando se puede completar, auditar y recuperar correctamente este loop:

**Estudiante (o familiar con aprobación del estudiante) busca residencia → envía solicitud → residencia establece contacto → [negociación opcional: la residencia propone un ajuste, una sola vez; el estudiante acepta o rechaza] → estudiante paga a residencia → residencia marca pago recibido → EstuRed cobra fee (ARS o USD) → se emite factura fiscal → reserva confirmada → comprobante emitido.**

Además debe soportar: renovaciones; dashboard de residencia (incluyendo multi-residencia, hasta 10 por owner); lista de espera; Gestión Operativa vía feature flag freemium; panel admin; privacidad de comunidad visible; auditoría de acciones críticas.

---

## 2. Documentos que este plan debe respetar

Leer después de `00` a `15` (ver orden en `14_PROJECT_INDEX.md` sección 4).

Este documento no reemplaza esos archivos — los convierte en escenarios de prueba. Ante conflicto, gobiernan primero: `00`, `03`, `04`, `05`, `10`.

---

## 3. Principios de QA del MVP

**3.1.** El flujo de negocio es más importante que la UI. Una pantalla correcta no sirve si permite saltar estados, cobrar un fee antes de tiempo, emitir un comprobante o factura inválidos, o exponer documentos indebidamente.

**3.2.** Todo estado crítico debe ser testeable: propuesta del familiar, solicitud, negociación de condiciones, pago a residencia, fee EstuRed, factura fiscal, reserva, comprobante, renovación, lista de espera, disponibilidad, soporte y penalización.

**3.3.** El cliente nunca controla estados sensibles directamente. Toda acción crítica pasa por lógica server-side.

**3.4.** La auditoría no es opcional. Si una acción crítica no queda auditada, el test debe fallar.

**3.5.** La privacidad se prueba como funcionalidad central, no como afterthought — incluyendo el contenido de una propuesta del familiar antes de que el estudiante la apruebe.

**3.6.** Los casos borde importan más que el caso feliz: pagos fallidos en dos proveedores distintos, vencimientos de 48h, negociaciones rechazadas, facturas fiscales fallidas, feature flags freemium mal configurados, aislamiento entre residencias del mismo owner.

---

## 4. Niveles de testing

### 4.1. Unit tests

- Cálculo del fee EstuRed **sobre `snapshot_final`** (no `snapshot_original` si hubo negociación aceptada).
- Exclusión de depósito reembolsable; inclusión de matrícula/cargos obligatorios no reembolsables.
- Redondeo de tarifas y fee (incluyendo desempate hacia arriba en múltiplos de 500); conversión USD/ARS (monedapi.ar).
- Herencia del tipo de cambio en `snapshot_final` (nunca se actualiza al aceptar una propuesta).
- Reinicio del plazo de pago al enviar **y** al aceptar una propuesta de ajuste.
- Validación de la ventana de 10 días corridos de revocación.
- Snapshot original y snapshot final de solicitud.
- Validación de máximo 2 solicitudes activas (propuestas del familiar pendientes no cuentan).
- **Validación de máximo 1 propuesta de ajuste por solicitud.**
- Validación de lista de espera.
- Cálculo de métricas internas de visibilidad.
- **Vencimientos de 48h** (único plazo — ya no hay 72h en ningún flujo).
- Intentos de cobro de fee (máx. 3 en 48h) en **ambos proveedores**.
- Reglas de visibilidad de comunidad.
- Validación de menor de edad con familiar vinculado.
- Selección de estados siguientes permitidos por cada máquina de estados (incluyendo `family_application_proposal` y `application_negotiation_proposals`).
- **Cálculo de fee en USD (PayU) usando el tipo de cambio del snapshot correspondiente.**
- **Validación de feature flag freemium antes de permitir operaciones de Gestión Operativa.**

### 4.2. Integration tests

Crear propuesta del familiar; aprobar/rechazar propuesta; crear solicitud; establecer contacto; **enviar propuesta de ajuste; responder propuesta de ajuste**; pausar segunda solicitud; marcar pago recibido; crear reserva pendiente de fee; cobrar fee (MercadoPago y PayU por separado); **emitir factura fiscal**; confirmar reserva; emitir comprobante; guardar audit log; subir documentos; validar permisos por rol (incluyendo aislamiento multi-residencia); activar lista de espera; crear oferta de renovación; confirmar renovación; abrir caso de soporte; aplicar penalización; actualizar disponibilidad; disparar notificaciones; **otorgar/revocar acceso freemium**.

### 4.3. End-to-end tests

Búsqueda y solicitud directa; **propuesta del familiar aprobada → solicitud**; solicitud a reserva confirmada sin negociación; **solicitud a reserva confirmada con negociación aceptada**; pago de fee exitoso en **MercadoPago (ARS)**; pago de fee exitoso en **PayU (USD)**; pago de fee fallido y reintentos; **factura fiscal emitida automáticamente**; comprobante emitido; familiar pagando fee; residencia gestionando solicitud; admin interviniendo solicitud trabada; lista de espera; renovación; comunidad visible; privacidad por rol; residencia verificada y no verificada; disponibilidad informada y disponibilidad asegurada; **owner operando 2+ residencias sin cruce de datos**.

### 4.4. Manual QA

Claridad del copy de disponibilidad; claridad del fee (incluyendo selector de moneda/proveedor); advertencias antes de solicitud; advertencias antes de pago; copy de no reembolso; **copy de soporte y resolución de conflictos** (no "mediación"); comprensión del comprobante; **comprensión de la vista comparativa de negociación**; mobile; accesibilidad básica; empty states; loading states; error states.

### 4.5. Security and privacy testing

RLS; documentos sensibles; acceso multi-tenant (**incluyendo entre residencias del mismo owner**); permisos staff; permisos familiar (**incluyendo que no vea propuestas ajenas ni acepte negociaciones en nombre del estudiante**); acciones admin; service role solo en backend; storage signed URLs; rate limits básicos; datos nunca visibles.

---

## 5. Ambientes de prueba

### 5.1. Local

Desarrollo; unit tests; integration tests parciales; seeds mínimos; flujos sin pagos reales. Usa: Supabase local/dev; **mocks de MercadoPago, PayU, monedapi.ar y TusFacturas.app**; notificaciones mock (email + in-app, sin WhatsApp); storage dev.

### 5.2. Staging

QA completo; E2E; datos demo; webhooks sandbox (**MercadoPago y PayU por separado**); validación de roles; revisión previa a beta. Debe tener: datos demo realistas; residencias demo verificadas; residencias completas; **al menos una residencia con Gestión Operativa vía feature flag**; usuarios estudiante/familiar/residencia/admin; **ambos proveedores de pago en sandbox**; **TusFacturas.app en modo sandbox**; generación real de PDF/QR.

### 5.3. Producción

Beta controlada; residencias reales; estudiantes reales; pagos reales; facturación fiscal real; auditoría completa. No usar para pruebas destructivas.

---

## 6. Datos seed obligatorios para QA

### 6.1. Usuarios

1 estudiante mayor de edad completo; 1 con perfil incompleto; 1 menor sin familiar; 1 menor con familiar vinculado; 1 familiar vinculado activo **con al menos una propuesta creada**; 1 familiar pendiente de aprobación; 1 residence owner **con 2+ residencias**; 2 residence staff con permisos distintos **(uno con acceso a una sola residencia, otro con acceso a varias del mismo owner)**; 1 admin; 1 superadmin.

### 6.2. Residencias

1 `verified_active` Perfil Verificado; 1 `verified_active` **con feature flag Gestión Operativa activo**; 1 `full`; 1 con disponibilidad `not_updated`; 1 `pending_verification`; 1 `paused_by_admin`; 1 con alerta de tarifa +15%; 1 con rechazos por falta de disponibilidad; **1 pionera de beta con `pioneer_free_access_until` configurado**.

### 6.3. Habitaciones y plazas

Individuales, dobles, triples; plazas en cada estado: `available`, `in_contact`, `temporarily_held`, `reserved`, `occupied`, `maintenance`, `blocked`.

### 6.4. Propuestas del familiar (nuevo)

1 propuesta `pending_student_approval`; 1 `approved_by_student` (convertida en solicitud); 1 `rejected_by_student`; 1 `expired`.

### 6.5. Negociación de condiciones (nuevo)

1 solicitud `offer_pending_student_acceptance`; 1 con propuesta `accepted` (snapshot_final generado); 1 con propuesta `rejected_chose_original`; 1 con propuesta `expired_offer_no_response`; 1 intento bloqueado de segunda propuesta (para test de constraint).

### 6.6. Solicitudes

`submitted`; `under_review`; `contact_established`; `residence_payment_pending`; `residence_payment_reported`; `paused_due_to_other_active_request`; `rejected`; `expired_no_residence_response`; `expired_no_student_payment`; `closed_due_to_other_confirmed_reservation`.

### 6.7. Reservas, pagos y facturas (actualizado)

Reserva `pending_estured_fee`; `estured_fee_failed`; `confirmed`; `receipt_pending`; `receipt_issued`. Pago fee `paid` **vía MercadoPago**; `paid` **vía PayU**; `failed`; `expired`; `refunded`. **Factura fiscal `issued`; `pending_issue`; `issue_failed`.**

### 6.8. Renovaciones

Renovación solicitada por estudiante; oferta en borrador; oferta enviada; oferta aceptada; con pago a residencia reportado; con fee pendiente; confirmada; comprobante emitido.

### 6.9. Comunidad visible

Residente activado con perfil visible; con visibilidad limitada; oculto por usuario; pendiente de activar cuenta; plaza ocupada sin datos.

---

## 7. Definition of Done general

Ver `13_CLAUDE_PROJECT_INSTRUCTIONS.md` sección 6 — no se repite acá. Agregar únicamente como criterio específico de este documento: toda feature nueva relacionada con propuesta del familiar, negociación, freemium o facturación fiscal debe tener al menos un test de integración antes de marcarse completa.

---

## 8. Test matrix por módulo

### 8.1. Autenticación y roles

**AUTH-001 — Registro estudiante mayor de edad**
Pasos: entrar a `/register/student` → completar campos → confirmar → onboarding mínimo.
Esperado: usuario y perfil creados; no requiere familiar; accede a `/students`; no accede a `/residence` ni `/admin`.

**AUTH-002 — Registro estudiante menor sin familiar**
Pasos: registrar con fecha de nacimiento <18 → intentar finalizar onboarding sin familiar.
Esperado: bloqueo; mensaje de familiar requerido; no puede enviar solicitud ni aprobar propuestas hasta vincular.

**AUTH-003 — Familiar solicita vinculación**
Pasos: familiar se registra → solicita vínculo → estudiante aprueba.
Esperado: vínculo `active`; familiar accede a dashboard limitado; puede pagar fee, cargar documentos, **crear propuestas de solicitud**; no modifica datos críticos sin permiso.

**AUTH-004 — Familiar revocado**
Pasos: estudiante revoca vínculo → familiar intenta acceder.
Esperado: acceso denegado; audit log; sin acceso a documentos ni pagos posteriores; **si el estudiante es menor y no queda otro familiar activo, pasa a `suspended_minor_no_family` y bloquea acciones sensibles**.

**AUTH-005 — Residence staff con permisos limitados**
Pasos: owner crea staff → asigna permisos limitados → staff intenta editar tarifas, marcar pago recibido, ver documentos.
Esperado: solo hace lo permitido; errores claros; intentos denegados sensibles auditados.

**AUTH-006 — Staff con acceso a múltiples residencias (nuevo)**
Pasos: owner asigna a un staff acceso a Residencia A y Residencia B (mismo owner) → staff opera en ambas.
Esperado: puede ver y operar en ambas según permisos; no ve una tercera residencia del mismo owner sin asignación explícita.

**AUTH-007 — Staff limitado a una sola residencia intenta ver otra del mismo owner (nuevo)**
Esperado: bloqueado server-side, no solo oculto en UI.

---

### 8.2. Búsqueda y detalle de residencia

**SEARCH-001 — Invitado busca residencias**
Pasos: `/search` sin login → filtros → abrir residencia.
Esperado: explora con datos limitados; no envía solicitud sin registrarse; no ve datos sensibles de comunidad.

**SEARCH-002 — Usuario registrado ve comunidad visible**
Esperado: ve perfiles individuales según permisos; nunca ve apellido completo, email, teléfono, fecha de nacimiento, universidad ni documentos; plazas ocupadas sin datos si residente no activó cuenta.

**SEARCH-003 — Residencia completa**
Esperado: no permite solicitud directa; permite lista de espera; muestra "Residencia completa".

**SEARCH-004 — Disponibilidad informada**
Esperado: "Disponibilidad informada por la residencia. Requiere confirmación al solicitar."

**SEARCH-005 — Disponibilidad asegurada**
Esperado: "Disponibilidad asegurada" solo con Gestión Operativa y plaza actualizada.

**SEARCH-006 — Modal de tipo de cambio referencial (nuevo)**
Pasos: abrir residencia con precio en USD → ver conversión a ARS.
Esperado: aparece el texto exacto de aviso referencial (ver `08_UI_SCREENS_AND_FLOWS.md` §2.8); fuente monedapi.ar.

**SEARCH-007 — FAQ de residencia (nuevo)**
Pasos: preguntar algo cargado en FAQ; preguntar algo no cargado.
Esperado: responde solo con información cargada; pregunta sin respuesta queda registrada para la residencia; nunca inventa disponibilidad o precio.

---

### 8.3. Propuestas de solicitud del familiar (bloque nuevo completo)

**FAMPROP-001 — Familiar crea propuesta**
Pasos: familiar con vínculo activo elige residencia → completa parámetros → envía propuesta.
Esperado: `family_application_proposals.status = pending_student_approval`; **no visible para la residencia**; estudiante notificado; `expires_at = +48h`.

**FAMPROP-002 — Estudiante aprueba propuesta**
Pasos: estudiante entra a `/students/family-proposals` → aprueba.
Esperado: se crea `application_request` con `initiated_by = family_member` y `contact_target = family_member`; snapshot original generado en este momento; cuenta ahora sí como solicitud activa; residencia recibe la solicitud recién ahora.

**FAMPROP-003 — Estudiante rechaza propuesta**
Esperado: `rejected_by_student`; familiar notificado; no se crea solicitud; residencia nunca se entera de que existió.

**FAMPROP-004 — Propuesta vence sin respuesta**
Pasos: no responder dentro de 48h.
Esperado: job `expire_family_proposals` la pasa a `expired`; familiar notificado.

**FAMPROP-005 — Propuestas pendientes no cuentan en el límite**
Pasos: familiar crea 2 propuestas para el mismo estudiante mientras el estudiante ya tiene 2 solicitudes activas propias.
Esperado: las propuestas se crean igual (quedan pendientes); no se bloquean por el límite de 2, porque ese límite aplica a solicitudes activas, no a propuestas pendientes.

**FAMPROP-006 — Aprobar propuesta cuando ya hay 2 solicitudes activas**
Pasos: estudiante con 2 solicitudes activas intenta aprobar una propuesta del familiar.
Esperado: bloqueado — al aprobar, la propuesta se convertiría en una tercera solicitud activa, lo cual no está permitido.

**FAMPROP-007 — Familiar intenta enviar solicitud directamente**
Esperado: no existe tal acción en la API/UI — el familiar solo puede crear `family_application_proposals`, nunca `application_requests` directamente.

---

### 8.4. Solicitudes de reserva

**APP-001 — Crear solicitud exitosa (directa, sin familiar)**
Esperado: `submitted`; `initiated_by = student`; `contact_target = student`; snapshot original guardado; fee estimado calculado; residencia notificada; audit log.

**APP-002 — Máximo 2 solicitudes activas**
Esperado: bloquea tercera; mensaje claro; lista de espera y propuestas pendientes no cuentan.

**APP-003 — Segunda solicitud pausada**
Esperado: la que avanza pasa a `contact_established`; la otra a `paused_due_to_other_active_request`, no anulada.

**APP-004 — Reserva confirmada cierra otras solicitudes**
Esperado: otras solicitudes a `closed_due_to_other_confirmed_reservation`; sale de listas de espera de otras residencias automáticamente.

**APP-005 — Rechazo con motivo interno**
Esperado: motivo guardado (enum); si es `no_availability`, impacta métrica; estudiante ve copy no discriminatorio; admin ve detalle.

**APP-006 — Rechazo discriminatorio**
Esperado: si el motivo es `other` con texto discriminatorio, queda auditado y visible para admin; política permite sanción posterior.

**APP-007 — Solicitud vence a las 48h (corregido de 72h)**
Pasos: solicitud `submitted` sin avance por 48h.
Esperado: pasa a `expired_no_residence_response`; **muestra botón "Actualizar con mismos parámetros"**; NO debe existir ningún flujo que use 72h.

**APP-008 — Botón "Actualizar con mismos parámetros" (nuevo)**
Pasos: sobre una solicitud vencida, presionar el botón.
Esperado: consulta disponibilidad y tarifa actuales con nuevo tipo de cambio; muestra comparación; si el estudiante confirma, crea una nueva solicitud con snapshot nuevo; si no hay disponibilidad, ofrece lista de espera.

---

### 8.5. Contacto establecido y negociación de condiciones (bloque nuevo)

**CONTACT-001 — Residencia establece contacto**
Esperado: `contact_established`; botón WhatsApp habilitado con **el número correcto según `contact_target`**; plazo de 48h inicia; audit log; pausa otra solicitud activa del estudiante si existe.

**CONTACT-002 — Botón WhatsApp usa número del familiar cuando corresponde**
Pasos: solicitud con `contact_target = family_member` → residencia presiona "Contactar".
Esperado: el link `wa.me/...` generado usa el teléfono del familiar, no del estudiante.

**CONTACT-002bis — Estudiante menor: contacto siempre al familiar**
Pasos: estudiante menor (con familiar vinculado activo) envía solicitud propia → residencia establece contacto.
Esperado: `contact_target = family_member`; el botón WhatsApp usa el teléfono del familiar; la UI del estudiante y de la residencia lo indican claramente.

**CONTACT-002ter — Teléfono de contacto obligatorio**
Pasos: estudiante sin teléfono registrado intenta enviar solicitud.
Esperado: bloqueado con `CONTACT_PHONE_MISSING`; mensaje claro pidiendo completar el teléfono (o el del familiar, si el contacto irá a él).

**CONTACT-003 — Mensaje pre-formateado no confirma reserva**
Esperado: solo abre WhatsApp con texto pre-cargado; no cambia ningún estado más allá de `contact_established`; EstuRed no registra el contenido de la conversación.

**NEGOTIATION-001 — Residencia envía propuesta de ajuste**
Pasos: residencia en `contact_established` → completa formulario de ajuste → confirma advertencia de "1 sola vez" → envía.
Esperado: `application_negotiation_proposals` creado; `application_request.status = offer_pending_student_acceptance`; `proposal_count = 1`; **timer de 48h se reinicia**; estudiante notificado.

**NEGOTIATION-002 — Segunda propuesta de ajuste bloqueada**
Pasos: residencia intenta enviar una segunda propuesta sobre la misma solicitud.
Esperado: bloqueado por constraint `unique` en `application_negotiation_proposals.application_request_id`; error claro; si se necesita excepción, solo vía override admin explícito y auditado.

**NEGOTIATION-003 — Estudiante acepta propuesta**
Esperado: se crea `snapshot_final` con los valores propuestos; `status = conditions_accepted`; fee EstuRed pasa a calcularse sobre `snapshot_final`; plazo de pago a residencia reinicia 48h **desde la aceptación**; el `snapshot_final` conserva el tipo de cambio del snapshot original (la aceptación no actualiza la cotización).

**NEGOTIATION-004 — Estudiante rechaza y continúa con condiciones originales**
Esperado: `snapshot_final_id = snapshot_original_id`; `status = conditions_accepted` con valores originales.

**NEGOTIATION-005 — Estudiante rechaza y cierra la solicitud**
Esperado: `status = cancelled_by_student`.

**NEGOTIATION-006 — Propuesta de ajuste vence sin respuesta**
Pasos: 48h sin respuesta del estudiante.
Esperado: job `expire_negotiation_proposals` pasa la solicitud a `expired_offer_no_response`; ambas partes notificadas.

**NEGOTIATION-007 — Campos de estudiante no modificables**
Pasos: intentar incluir cambios de nombre/apellido/fecha de nacimiento en el payload de la propuesta de ajuste.
Esperado: rechazado server-side; esos campos no existen en el schema de `application_negotiation_proposals`.

**NEGOTIATION-008 — Fee recalculado correctamente tras negociación**
Pasos: propuesta cambia tarifa mensual de $300 a $250 USD → estudiante acepta.
Esperado: fee EstuRed = 5% sobre $250 × duración (no sobre $300).

**CONTACT-004 — Estudiante sube comprobante de pago a residencia**
Esperado: `student_reference_uploaded`; no confirma reserva; residencia debe marcar "Pago recibido"; documento protegido por permisos.

**CONTACT-005 — Residencia marca pago recibido**
Pasos: residencia marca "Pago recibido" con checkbox de confirmación.
Esperado: `reported_received_by_residence`; se registra `consent` asociado; se crea `reservation.pending_estured_fee`; base del fee calculada **sobre `snapshot_final`**; plaza pasa a `temporarily_held` si Gestión Operativa; auditado.

**CONTACT-006 — Vencimiento por falta de pago a residencia**
Esperado: `expired_no_student_payment` a las 48h; plaza se libera si aplica; notificaciones; residencia puede avanzar con otro interesado.

---

### 8.6. Fee EstuRed y facturación fiscal (bloque actualizado)

**FEE-001 — Cálculo del fee sobre snapshot_final**
Esperado: 5% × (tarifa final × duración inicial + matrícula/cargos no reembolsables); depósito reembolsable excluido; ajustes futuros no incluidos; redondeo a múltiplo de 500 ARS; snapshot correcto usado según haya habido negociación o no.

**FEE-002 — Pago exitoso vía MercadoPago (ARS)**
Esperado: `paid`; reserva `confirmed`; **se dispara `emitFiscalInvoice`**; comprobante `pending_generation`; notificaciones; auditado.

**FEE-003 — Pago exitoso vía PayU (USD)**
Pasos: pagador elige PayU, paga en USD.
Esperado: `fee_amount_usd` calculado desde el tipo de cambio del snapshot; `payment_currency = USD`; mismo flujo posterior que FEE-002.

**FEE-004 — Pago fallido con reintentos**
Esperado: hasta 3 intentos en 48h; notificación tras cada fallo; si se agotan, fee `expired` (terminal) y reserva `expired_fee_unpaid`; no confirma reserva.

**FEE-004bis — Fee sin ningún intento de pago**
Pasos: reserva en `pending_estured_fee` durante 48h sin que el usuario inicie ningún pago.
Esperado: job `expire_estured_fee_windows` pasa el fee a `expired` y la reserva a `expired_fee_unpaid` (nunca a `cancelled_by_student`); notificaciones enviadas; residencia puede liberar la plaza.

**FEE-010 — Chargeback tras reserva confirmada**
Pasos: simular webhook de chargeback sobre un fee `paid` con reserva `confirmed` y comprobante emitido.
Esperado: fee pasa a `chargeback`; alerta admin generada; **la reserva y el comprobante no cambian automáticamente**; toda acción posterior es decisión admin auditada.

**FEE-005 — Webhook duplicado (idempotencia)**
Pasos: simular el mismo webhook de `paid` dos veces.
Esperado: segundo procesamiento no genera cobro ni factura duplicados; se detecta por `idempotency_key`.

**FEE-006 — Factura fiscal se emite automáticamente**
Pasos: fee pasa a `paid`.
Esperado: `emitFiscalInvoice` se dispara; `fiscal_invoice_id` guardado; PDF en bucket `fiscal-documents`; emitida a nombre del pagador.

**FEE-007 — Falla de emisión de factura no bloquea la reserva**
Pasos: simular fallo de TusFacturas.app tras fee pagado.
Esperado: reserva sigue `confirmed`; factura queda `issue_failed`; job de reintento la retoma; admin puede ver el estado en `/admin/invoices`.

**FEE-008 — Pago manual validado por admin**
Esperado: admin marca `paid` con motivo; se dispara emisión de factura igual que en pago automático; auditado.

**FEE-009 — Reembolso**
Esperado: solo por incumplimiento atribuible a residencia/revisión EstuRed; motivo obligatorio; auditado; **no revierte automáticamente la factura fiscal ya emitida** (requiere gestión de nota de crédito, ver `09_ADMIN_PANEL_SPEC.md` §15.3).

---

### 8.7. Reserva y comprobante

**RES-001 — Confirmación de reserva**
Esperado: solo si fee `paid`; nunca antes.

**RES-002 — Comprobante con verification_code**
Esperado: se genera `verification_code` único; QR apunta a `/verify/[verification_code]`; contenido refleja `snapshot_final`.

**RES-003 — Verificación pública**
Pasos: abrir `/verify/[verification_code]` sin login.
Esperado: muestra solo estado, nombre + inicial, residencia, tipo de habitación, fecha, duración; nunca datos sensibles ni el PDF completo.

**RES-004 — Código de verificación inválido**
Esperado: mensaje de "código inválido", sin filtrar información sobre si existió o no.

**RES-005 — Fallo de generación de PDF**
Esperado: reserva sigue `confirmed`; comprobante `generation_failed`; alerta admin; admin puede reintentar.

**RES-006 — Comprobante anulado sigue mostrando estado correcto en /verify**
Esperado: `/verify/[codigo]` muestra "anulado", no "válido".

---

### 8.7bis. Revocación del fee (bloque nuevo)

**REVOKE-001 — Revocación dentro del plazo**
Pasos: estudiante o familiar pagador entra por el enlace del footer a `/students/revocation` dentro de los 10 días corridos del pago → acepta consecuencias → confirma.
Esperado: reserva `cancelled_by_student` con `cancellation_reason_code = student_revocation_right`; comprobante `voided`; fee permanece `paid`; `support_case` de revisión abierto; residencia y admin notificados; todo auditado.

**REVOKE-002 — Revocación fuera de plazo**
Pasos: intentar revocar a los 11 días.
Esperado: bloqueado con `REVOCATION_WINDOW_EXPIRED`; mensaje claro; sin cambios de estado.

**REVOKE-003 — Verificación pública tras revocación**
Esperado: `/verify/[codigo]` del comprobante revocado muestra "anulado".

**REVOKE-004 — Reembolso posterior solo por admin**
Esperado: no existe ninguna vía automática de `paid` → `refunded` tras la revocación; el reembolso requiere acción admin con motivo y auditoría.

**REVOKE-005 — Enlace visible en el footer**
Esperado: el enlace "Botón de arrepentimiento" está presente en el footer de todas las áreas de la plataforma.

---

### 8.8. Renovaciones

**RENEW-001 — Estudiante solicita renovación (informal)**
Esperado: `renewal_requests.created_by_student`; no crea oferta vinculante; residencia notificada.

**RENEW-002 — Residencia crea oferta formal**
Esperado: `renewal_offers.draft` → `sent`; incluye período, tarifa, política de ajustes, fecha límite.

**RENEW-003 — Fee de renovación idéntico al de reserva inicial**
Pasos: comparar cálculo de fee de renovación contra fórmula de fee inicial con los mismos parámetros.
Esperado: resultado idéntico — no hay ninguna variante en la fórmula.

**RENEW-004 — Renovación confirmada emite comprobante propio**
Esperado: "Comprobante de Renovación Confirmada" con su propio `verification_code`; factura fiscal propia.

**RENEW-005 — Renovación vencida no genera fee**
Esperado: `expired`; sin cobro.

---

### 8.9. Multi-residencia y freemium (bloque nuevo completo)

**MULTIRES-001 — Owner ve todas sus residencias en scroll**
Pasos: owner con 3 residencias entra a `/residence/dashboard`.
Esperado: 3 bloques independientes en scroll vertical; filtro visible; **sin vista agregada de métricas**.

**MULTIRES-002 — Owner con una sola residencia no ve filtro**
Esperado: comportamiento igual a dashboard simple, sin selector.

**MULTIRES-003 — Datos no se cruzan entre residencias**
Pasos: crear solicitudes distintas en Residencia A y B del mismo owner.
Esperado: cada bloque muestra solo sus propias solicitudes; ninguna acción en A afecta a B.

**MULTIRES-004 — Alta de residencia adicional**
Pasos: owner con 5 residencias agrega una sexta.
Esperado: permitido (límite es 10); aparece en el dashboard.

**MULTIRES-005 — Límite de 10 residencias por owner**
Pasos: owner con 10 residencias intenta agregar la 11ª.
Esperado: bloqueado.

**FREEMIUM-001 — Residencia sin feature flag no accede a Gestión Operativa**
Pasos: residencia con `has_operational_management_access = false` intenta crear una habitación vía API directamente (no UI).
Esperado: bloqueado server-side con `OPERATIONAL_MANAGEMENT_NOT_ENABLED`, no solo oculto en frontend.

**FREEMIUM-002 — Admin otorga acceso freemium**
Pasos: admin activa el flag para una residencia pionera con `pioneer_free_access_until` a 1 año.
Esperado: flag activo; fecha guardada; auditado con motivo; residencia notificada.

**FREEMIUM-003 — Admin revoca acceso**
Esperado: flag pasa a `false`; auditado con motivo; residencia pierde acceso a rutas de Gestión Operativa (validado server-side, no solo redirect de UI).

---

### 8.10. Lista de espera

Sin cambios de fondo respecto a la versión anterior. Casos: entrar a lista no cuenta como solicitud activa; no vence por tiempo; recordatorio a los 90 días; sale automáticamente al confirmar reserva en otra residencia; residencia puede notificar sin activar solicitud automáticamente.

---

### 8.11. Comunidad visible y privacidad

**PRIV-001 a PRIV-005** — sin cambios de fondo (perfiles según permisos, residencia no fuerza visibilidad, documentos por contexto).

**PRIV-006 — Contenido de propuesta del familiar antes de aprobación (nuevo)**
Pasos: familiar crea propuesta → residencia intenta consultarla vía API.
Esperado: bloqueado — la residencia no tiene ninguna vía de acceso a `family_application_proposals` en estado `pending_student_approval`.

**PRIV-007 — Familiar no ve propuestas de otro estudiante**
Esperado: bloqueado por RLS, incluso si el familiar está vinculado a varios estudiantes — cada propuesta se filtra por el vínculo específico.

---

### 8.12. Admin panel (actualizado)

**ADMIN-001 a ADMIN-005** — sin cambios de fondo (solicitudes trabadas, confirmación manual, reembolso, suspensión, audit log no editable).

**ADMIN-006 — Admin ve propuestas del familiar (nuevo)**
Pasos: entrar a `/admin/family-proposals`.
Esperado: listado con estado, familiar, estudiante, residencia sugerida, fecha, tiempo de respuesta.

**ADMIN-007 — Admin ve negociaciones activas (nuevo)**
Pasos: entrar a `/admin/negotiations`.
Esperado: listado con campos modificados, fecha de envío/expiración, respuesta del estudiante si existe.

**ADMIN-008 — Admin reintenta factura fiscal fallida (nuevo)**
Pasos: en `/admin/invoices`, seleccionar una en `issue_failed` → reintentar.
Esperado: se vuelve a invocar `FiscalInvoiceProvider`; si tiene éxito, pasa a `issued`; auditado.

**ADMIN-009 — Admin gestiona feature flag freemium (nuevo)**
Ver FREEMIUM-002/003.

**ADMIN-010 — Admin accede a documento sensible con justificación obligatoria**
Pasos: admin intenta ver un documento sin ingresar motivo.
Esperado: bloqueado hasta ingresar justificación; se genera audit log con esa justificación.

---

### 8.13. Soporte y resolución de conflictos (renombrado de "Mediaciones")

**SUPPORT-001 — Abrir caso**
Pasos: usuario abre reclamo → ve reminder de términos → confirma → sube evidencia.
Esperado: caso `submitted`; evidencia guardada; admin alertado; no suspende automáticamente solicitud/reserva.

**SUPPORT-002 — Admin pide más información**
Esperado: `needs_more_info`; usuario notificado; auditado.

**SUPPORT-003 — Cierre sin acción**
Esperado: `closed_no_action`; motivo interno; usuario notificado según criterio.

**SUPPORT-004 — Acción admin tomada**
Esperado: `admin_action_taken`; entidad afectada actualizada (penalización, reembolso, etc.); auditado.

**SUPPORT-005 — Evidencia de conversación de WhatsApp**
Pasos: usuario sube captura de pantalla de la conversación de WhatsApp como evidencia.
Esperado: se acepta como evidencia estándar — EstuRed no tiene esa conversación por otra vía.

---

### 8.14. Métricas, penalizaciones y visibilidad

**METRIC-001 a METRIC-004** — sin cambios de fondo (tasa de respuesta, rechazos por disponibilidad, penalización progresiva, ponderación 25/20/20/15/10/10).

**METRIC-005 — Tasa de propuestas de ajuste vencidas (nuevo, observacional)**
Esperado: se calcula y es visible para admin como señal, pero no pondera en el score de visibilidad todavía (decisión de producto pendiente de datos de beta).

---

### 8.15. Notificaciones

**NOTIF-001 a NOTIF-006** — sin cambios de fondo.

**NOTIF-007 — Notificación de propuesta del familiar (nuevo)**
Esperado: estudiante recibe notificación al crearse; familiar recibe notificación al aprobarse/rechazarse/vencer.

**NOTIF-008 — Notificación de propuesta de ajuste (nuevo)**
Esperado: estudiante notificado al recibirla; residencia notificada al ser respondida o vencer.

**NOTIF-009 — Notificación de factura fiscal (nuevo)**
Esperado: pagador recibe la factura por email al emitirse.

**NOTIF-010 — WhatsApp no genera notificación automática (nuevo, negativo)**
Pasos: revisar el sistema de notificaciones completo.
Esperado: no existe ningún trigger que envíe mensajes de WhatsApp automáticamente — el único artefacto es el link `wa.me` generado para que la residencia lo accione manualmente.

---

## 9. Casos borde obligatorios (actualizado)

1. Estudiante menor intenta solicitar sin familiar.
2. Estudiante intenta crear tercera solicitud activa.
3. Familiar crea propuesta → estudiante aprueba → solicitud correcta.
4. Familiar crea propuesta → estudiante rechaza → sin solicitud.
5. Propuesta del familiar vence en 48h.
6. Una solicitud avanza y la otra se pausa.
7. Una reserva confirmada cierra otras solicitudes y listas de espera.
8. Residencia envía propuesta de ajuste → estudiante acepta → fee recalculado.
9. Residencia intenta enviar segunda propuesta de ajuste → bloqueado.
10. Propuesta de ajuste vence sin respuesta.
11. Residencia marca pago recibido, pero fee falla.
12. Fee falla 3 veces dentro de 48h (en cada proveedor).
13. Fee vence sin pago.
14. Fee pagado en USD vía PayU calcula correctamente.
15. Webhook de pago duplicado no genera doble cobro ni doble factura.
16. Factura fiscal falla pero la reserva se confirma igual.
17. Comprobante falla al generarse.
18. Admin reemite comprobante.
19. Admin anula comprobante.
20. Admin reintenta factura fiscal fallida.
21. Residencia rechaza muchas solicitudes por falta de disponibilidad.
22. Residencia no actualiza disponibilidad por 30 días; tras 15 días adicionales, desaparece de búsquedas.
23. Residencia marca estado `full` correctamente.
24. Estudiante sube comprobante a residencia, pero residencia no confirma.
25. Admin interviene una solicitud trabada.
26. Residencia edita tarifa +20% → genera alerta.
27. Usuario registrado intenta ver datos nunca visibles.
28. Residencia intenta ver documentos sin contexto.
29. Residencia intenta ver una propuesta del familiar antes de aprobación.
30. Staff intenta acción sin permiso.
31. Staff con acceso a Residencia A intenta ver Residencia B del mismo owner sin asignación.
32. Familiar revocado intenta pagar fee.
33. Estudiante no se presenta y residencia marca no-show.
34. Caso de soporte abierto no suspende automáticamente reserva.
35. Admin suspende residencia.
36. Lista de espera no vence a los 90 días.
37. Lista de espera se limpia si estudiante reserva otra residencia.
38. Renovación aceptada genera fee y comprobante idénticos en lógica a la reserva inicial.
39. Renovación vencida no genera fee.
40. QR de comprobante anulado no valida como activo.
41. Storage no expone documentos sin signed URL válida.
42. Owner con 10 residencias no puede agregar una 11ª.
43. Residencia sin feature flag freemium no puede usar Gestión Operativa aunque manipule el request directamente.
44. Estudiante ejerce revocación dentro de los 10 días → reserva cancelada, comprobante anulado, fee `paid` en revisión admin.
45. Revocación fuera de plazo → bloqueada.
46. Chargeback sobre fee pagado → alerta admin; reserva y comprobante sin cambios automáticos.
47. Estudiante menor de edad → contacto de la residencia siempre al familiar vinculado.
48. Solicitud sin teléfono de contacto del destinatario → bloqueada.
49. Fee vencido sin pago → reserva `expired_fee_unpaid` (no `cancelled_by_student`).
50. Cola de 3+2 funciona por tipo de habitación en Perfil Verificado (sin plazas).

---

## 10. Smoke test pre-deploy (actualizado)

1. Login como estudiante.
2. Buscar residencia.
3. Abrir detalle (verificar modal de tipo de cambio).
4. Crear solicitud.
5. Login como residencia.
6. Establecer contacto.
7. Enviar propuesta de ajuste → aceptar como estudiante.
8. Marcar pago recibido.
9. Simular pago fee exitoso (MercadoPago).
10. Confirmar reserva.
11. Verificar factura fiscal emitida.
12. Generar comprobante.
13. Descargar comprobante y verificar `/verify/[codigo]`.
14. Login como admin.
15. Ver solicitud, negociación, reserva, pago, factura y comprobante.
16. Ver audit log.
17. Confirmar que no hay datos sensibles expuestos.
18. Revisar mobile básico.
19. Revisar errores en consola.
20. Revisar variables de entorno críticas (incluyendo PayU y TusFacturas.app).

Si falla cualquiera de los puntos 4 a 17, deploy no aprobado.

---

## 11. Regression test mínimo (actualizado)

Cada cambio en estados, pagos, solicitudes, reservas, negociación o permisos corre regresión sobre: propuesta del familiar; solicitud nueva; negociación de condiciones; contacto establecido; pago recibido por residencia; fee pendiente/pagado (ambos proveedores); factura fiscal; reserva confirmada; comprobante emitido; segunda solicitud pausada; lista de espera; renovación; acceso estudiante/familiar/owner/staff/admin; aislamiento multi-residencia; documentos privados; audit log.

---

## 12. QA de mobile responsive

Sin cambios de fondo. Agregar a pantallas críticas mobile: vista de negociación (comparación original vs. propuesta, debe apilarse verticalmente); dashboard multi-residencia (bloques apilados, comportamiento nativo); `/verify/[codigo]`.

---

## 13. QA de accesibilidad básica

Sin cambios de fondo respecto a la versión anterior: contraste razonable; labels en inputs; botones con texto claro; focus visible; navegación por teclado en acciones críticas; errores asociados al campo correcto; textos no dependen solo de color; estados críticos tienen texto y no solo badge; PDFs con información legible.

---

## 14. QA de contenido y microcopy (actualizado)

Evitar: "reserva garantizada" antes de fee pagado; "disponible" absoluto si es informada; "EstuRed garantiza alojamiento"; ranking público; lenguaje despectivo hacia estudiante o residencia; promesas legales excesivas; promesas de devolución absoluta; promesas de disponibilidad sin confirmación.

Usar: "Solicitud de reserva"; "Sujeta a confirmación de la residencia"; "Disponibilidad informada por la residencia"; "Disponibilidad asegurada" (solo GO actualizada); "Comprobante de Reserva Confirmada"; "Fee de servicio EstuRed"; "Monto informado por la residencia"; "EstuRed puede intervenir en resolución de conflictos en determinados casos" (no "mediar" — término legal evitado); "Esta es la única propuesta de ajuste que la residencia puede enviarte para esta solicitud".

---

## 15. QA de seguridad mínima

Sin cambios de fondo respecto a la versión anterior: RLS activado en tablas sensibles; storage privado para documentos; signed URLs con expiración; service role solo server-side; webhooks validados; variables secretas no expuestas al cliente; endpoints admin protegidos; acciones críticas con validación server-side; rate limit básico en auth, solicitudes y contactos; audit log de acciones críticas; no hay datos sensibles en logs del cliente.

Agregar: webhooks de MercadoPago y PayU validados por separado, cada uno con su propio secreto; credenciales de TusFacturas.app nunca expuestas al cliente; RLS valida `residence_users` por residencia específica, no solo por rol general de owner/staff.

---

## 16. QA de pagos (actualizado — separado por proveedor)

Para cada proveedor (MercadoPago y PayU) por separado: pago exitoso; pago fallido; pago pendiente; webhook duplicado; webhook retrasado; reintento; expiración; reembolso manual; chargeback simulado; usuario cierra checkout.

Adicional: familiar paga; pagador distinto del estudiante; factura fiscal a nombre del pagador; comprobante de reserva a nombre del estudiante; fee calculado en USD vía PayU usa el tipo de cambio del snapshot, no el del día del pago.

Regla no negociable: ningún webhook puede confirmar una reserva si la operación no está en estado válido para recibir ese pago, y ningún webhook duplicado puede generar un segundo cobro, una segunda factura o un segundo comprobante.

---

## 17. QA de tipo de cambio y tarifas

Tarifa en USD y ARS; conversión vía monedapi.ar (dólar blue, valor venta); fallback si falla la fuente; override admin con motivo; snapshot por solicitud (original y final si hubo negociación); tarifa USD termina en 0 o 5; tarifa ARS termina en 500 o 000; fee redondeado a múltiplo de 500; alerta por cambio de tarifa ±15%; política de ajustes guardada; ajustes futuros no recalculan fee inicial ni de renovación.

---

## 18. QA de auditoría (actualizado)

Cada una de estas acciones debe dejar audit log: crear/aprobar/rechazar propuesta del familiar; crear solicitud; establecer contacto; enviar/responder propuesta de ajuste; subir comprobante; marcar pago recibido; cobrar fee; reintentar fee; reembolsar fee; emitir/reintentar/anular factura fiscal; confirmar reserva; emitir/reemitir/anular comprobante; editar tarifa; editar disponibilidad; editar perfil residencia; aprobar verificación; suspender residencia; crear staff; cambiar permisos; cambiar visibilidad de perfil; abrir/cerrar caso de soporte; aplicar penalización; otorgar/revocar feature flag freemium; override admin (incluyendo override de tipo de cambio).

Audit log incluye: actor; rol; entidad; acción; timestamp; before/after si aplica; motivo si es admin; metadata útil; fuente (user/admin/system/payment_provider).

---

## 19. Criterios de aceptación para beta controlada (actualizado)

La beta puede comenzar solo si: al menos 5 residencias verificadas; búsqueda y detalle funcionan (con FAQ y modal de tipo de cambio); propuesta del familiar funciona de punta a punta; solicitud funciona; negociación de condiciones funciona con el límite de 1 propuesta respetado; dashboard residencia gestiona solicitudes (incluyendo multi-residencia si aplica); residencia establece contacto y marca pago recibido; fee EstuRed se paga o valida en ambos proveedores; factura fiscal se emite correctamente; reserva se confirma; comprobante se emite y verifica en `/verify/[codigo]`; admin puede intervenir (incluyendo propuestas del familiar y negociaciones); audit log funciona; lista de espera funciona; renovaciones funcionan; feature flag freemium funciona para residencias pioneras; comunidad visible respeta permisos; documentos no se exponen indebidamente; notificaciones críticas funcionan; mobile no bloquea el flujo central; smoke test completo pasa; revisión legal mínima en proceso o completada.

---

## 20. Criterios de bloqueo de release (actualizado)

No lanzar si: el enlace de revocación del footer no existe o el flujo de revocación no funciona; se puede emitir comprobante sin fee pagado; se puede emitir factura fiscal sin fee pagado; se puede confirmar reserva sin estado válido; se puede saltar pago a residencia sin intervención admin auditada; se exponen documentos sensibles; se expone el contenido de una propuesta del familiar antes de aprobación; usuarios ven datos de otra residencia/tenant (incluyendo entre residencias del mismo owner); staff hace acciones no autorizadas; familiar no vinculado puede pagar o ver documentos; menor puede solicitar sin familiar; no hay audit log en acciones críticas; pagos duplicados no son idempotentes (en ningún proveedor); webhook puede confirmar operaciones inválidas; QR de comprobante anulado sigue válido; admin no puede intervenir solicitudes trabadas; disponibilidad vencida se muestra sin advertencia; tarifas cambian sin snapshot en solicitudes; residencia no verificada puede publicar; no hay manejo de errores en fee fallido; una residencia sin feature flag puede usar Gestión Operativa; la residencia puede enviar más de una propuesta de ajuste por solicitud.

---

## 21. Instrucciones para Claude Code

Ver `13_CLAUDE_PROJECT_INSTRUCTIONS.md` — no se repite acá. Regla específica de este documento: no marcar como completa ninguna feature de propuesta del familiar, negociación, freemium o facturación fiscal sin al menos un test de integración que la cubra.

---

## 22. Primer paquete de tests recomendado (actualizado)

1. `calculateEsturedFee()` — sobre `snapshot_final`.
2. `createFamilyApplicationProposal()`.
3. `approveOrRejectFamilyProposal()`.
4. `createApplicationRequest()`.
5. `enforceMaxActiveApplications()`.
6. `pauseOtherActiveApplication()`.
7. `establishContact()` — resolviendo `contact_target`.
8. `sendNegotiationProposal()` — con constraint de máx. 1.
9. `respondToNegotiationProposal()`.
10. `markResidencePaymentReceived()`.
11. `createReservationPendingFee()`.
12. `processEsturedFeePaid()` — MercadoPago y PayU.
13. `emitFiscalInvoice()`.
14. `confirmReservation()`.
15. `generateReceipt()` — con `verification_code`.
16. `removeFromOtherWaitlistsAfterReservation()`.
17. `createRenewalOffer()`.
18. `acceptRenewalOffer()`.
19. `enforceDocumentAccess()`.
20. `writeAuditLog()`.
21. `enforceResidenceTenantAccess()` — incluyendo multi-residencia.
22. `enforceFamilyLinkAccess()`.
23. `enforceOperationalManagementFeatureFlag()`.
24. `exchangeRateSnapshot()`.
25. `pricingChangeAlert()`.
26. `receiptQrValidation()`.

---

## 23. Resultado esperado del QA

El sistema debe manejar: estudiantes reales; familiares reales (incluyendo propuestas); residencias verificadas (incluyendo multi-residencia y freemium); solicitudes reales; negociación de condiciones; pagos a residencia externos; fee EstuRed en dos proveedores/monedas; facturación fiscal automática; comprobantes; renovaciones; lista de espera; comunidad visible; casos de soporte; intervención admin; auditoría; privacidad; casos borde.

El MVP debe sentirse simple para el usuario, aunque internamente tenga reglas estrictas. La complejidad vive en la arquitectura y el admin, no en la experiencia del estudiante.

---

## 24. Estado final del documento

Aprobado como guía base de QA para el MVP de EstuRed.

Debe actualizarse cuando cambien: reglas de fee; proveedores de pago; tipo de cambio; proveedor de facturación fiscal; estados de solicitud/reserva/negociación; permisos; privacidad; renovaciones; lista de espera; comprobantes; reglas de freemium; admin actions; alcance del MVP.

Ninguna release debe considerarse lista si contradice este plan en flujos críticos.
