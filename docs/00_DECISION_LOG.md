# 00_DECISION_LOG.md
# EstuRed — Registro de decisiones consolidadas

Última actualización: 2026-10-25 (§31: DR14 reglamento/FAQ/edad/seguimiento; decisiones del dueño D1–D11 de la auditoría 2026-10-20; DF1–DF5, DR1–DR2, DR3 y DR3b "Quiero cambiar"; DR6–DR7; DR8 validación manual del fee; revisión Ciclo 71: checkbox + piso 90 %, reintento de confirmación; DR9 trazabilidad y permisos del admin)

Este documento es la fuente de verdad del proyecto EstuRed.
Registra todas las decisiones de producto, negocio, operación, experiencia y arquitectura técnica.

**Debe leerse antes que cualquier otro archivo del proyecto.**

Si hay contradicción entre este documento y cualquier otro, este documento prevalece.

---

## ÍNDICE DE SECCIONES

1. Definición general del producto
2. Mercado inicial
3. Usuarios principales
4. Loop principal del MVP
5. Alcance del MVP
6. Modalidades de residencia y modelo freemium
7. Verificación de residencias
8. Disponibilidad
9. Solicitudes
10. Datos mínimos para solicitar
11. Pago a la residencia
12. Fee de servicio EstuRed
13. Moneda, tarifas y conversión — DECISIÓN ACTUALIZADA
14. Pasarela y métodos de pago — DECISIÓN ACTUALIZADA
15. Facturación del fee EstuRed — DECISIÓN NUEVA
16. Comprobante de reserva
17. Familiar vinculado — DECISIÓN ACTUALIZADA
18. Visibilidad y privacidad de estudiantes
19. Comunidad visible
20. FAQ asistida por residencia — DECISIÓN ACTUALIZADA
21. Admin EstuRed
22. Métricas y visibilidad
23. Mediación, reclamos y responsabilidad
24. Antidiscriminación
25. Multi-residencia por owner — DECISIÓN NUEVA
26. Contacto con estudiante vía WhatsApp — DECISIÓN NUEVA
27. Arquitectura técnica — DECISIÓN ACTUALIZADA
28. Decisiones técnicas de implementación — SECCIÓN NUEVA
29. Pendientes no bloqueantes — ACTUALIZADO
30. Reglas para Claude Code — ACTUALIZADO
31. Decisiones del dueño — auditoría 2026-10-20 (D1–D11)

---

## 1. Definición general del producto

EstuRed es una webapp responsive para conectar estudiantes que llegan a CABA con residencias estudiantiles verificadas.

El producto no debe posicionarse como un portal inmobiliario genérico ni como un PMS tradicional. La propuesta central es crear una plataforma de confianza para buscar residencias, enviar solicitudes, confirmar reservas, emitir comprobantes y, progresivamente, acompañar la experiencia durante la estadía.

Frase conceptual del producto:

> La convivencia también se elige.

El MVP debe ser simple, funcional y escalable. Debe permitir validar el loop de negocio principal sin construir todavía todos los módulos futuros.

---

## 2. Mercado inicial

- CABA.
- Estudiantes del interior de Argentina que llegan a CABA.
- Estudiantes del exterior que llegan a CABA.
- Residencias estudiantiles ubicadas en CABA.

La primera etapa debe lanzarse con pocas residencias curadas y verificadas, idealmente entre 5 y 10.

---

## 3. Usuarios principales

Los dos usuarios primarios son:

1. Estudiantes.
2. Residencias.

Uno no existe sin el otro. El MVP debe estar gobernado por un loop primario único:

> Estudiante solicita → residencia responde → estudiante paga a la residencia → residencia confirma pago recibido → EstuRed cobra fee → reserva confirmada → comprobante emitido.

Usuario secundario clave:

- Padre, madre o familiar vinculado.

Usuarios internos necesarios:

- Admin EstuRed.
- Superadmin EstuRed.

---

## 4. Loop principal del MVP

El flujo central del MVP es:

1. El estudiante busca residencias verificadas en CABA.
2. El estudiante revisa una ficha de residencia.
3. El estudiante (o familiar, sujeto a aprobación del estudiante) envía una solicitud de reserva.
4. La residencia recibe y revisa la solicitud.
5. La residencia decide si avanza, rechaza o pide más información.
6. Si avanza, se establece contacto con el estudiante o el familiar, según quién inició la solicitud. **Si el estudiante es menor de edad, el contacto se dirige siempre al familiar vinculado, independientemente de quién haya iniciado la solicitud.**
7. **[Negociación opcional]** La residencia puede enviar una única propuesta de ajuste de condiciones por solicitud. El estudiante la acepta, la rechaza y continúa con las condiciones originales, o la rechaza y cierra la solicitud (ver `03_BUSINESS_RULES.md` sección 10ter).
8. El estudiante paga a la residencia el concepto configurado por esa residencia: matrícula, seña, depósito u otro concepto permitido.
9. La residencia marca internamente "Pago recibido".
10. EstuRed cobra el fee de servicio.
11. Si el fee se cobra correctamente, se emite automáticamente la factura fiscal (Factura C) y la reserva queda confirmada dentro de EstuRed.
12. Se emite el comprobante de reserva.

No debe existir "reserva confirmada" dentro de EstuRed si el fee de servicio no fue pagado correctamente.

---

## 5. Alcance del MVP

### Incluido en MVP

- Landing.
- Búsqueda.
- Ficha de residencia.
- Solicitud de reserva (iniciada por estudiante o familiar con aprobación del estudiante).
- Dashboard básico de residencia.
- Confirmación manual por parte de la residencia.
- Cobro de fee EstuRed (vía MercadoPago, PayU o validación manual).
- Comprobante de reserva (PDF + QR verificable).
- Verificación presencial de residencias.
- Panel admin completo.
- Auditoría de acciones críticas.
- Perfil básico de estudiante.
- Familiar vinculado.
- Disponibilidad semi-real (Perfil Verificado) y disponibilidad real (Gestión Operativa).
- Modos de residencia: Perfil Verificado y Gestión Operativa.
- Comunidad visible básica con consentimiento explícito.
- Renovaciones.
- Lista de espera.
- FAQ asistida por residencia.
- Multi-residencia por owner (hasta 10 residencias).
- Modelo freemium para residencias (módulos base gratuitos, Gestión Operativa en plan pago).
- Facturación del fee EstuRed (Factura C, TusFacturas.app).
- Botón de contacto WhatsApp pre-formateado (sin API, solo link).

### Fuera del MVP inicial

- App móvil nativa.
- Sistema de Señales de Convivencia.
- Reviews 360°.
- Rankings públicos.
- Comentarios libres.
- Firma digital.
- Escrow.
- Gestión completa de mantenimiento.
- Tickets de soporte técnico.
- Check-in/check-out avanzado.
- IA avanzada.
- Marketplace de servicios.
- Sistema de puntos.
- Analítica avanzada pública.
- PMS complejo.
- Dashboard agregado multi-residencia.

---

## 6. Modalidades de residencia y modelo freemium

### 6.1. Modo Perfil Verificado — Gratuito

Para residencias que quieren publicar información, recibir solicitudes y confirmar disponibilidad manualmente.

Incluye:

- Perfil completo verificado.
- Verificación presencial obligatoria.
- Dashboard de solicitudes.
- Módulo de disponibilidad manual/semi-real.
- Reserva confirmada.
- Comprobantes.
- Lista de espera.
- Renovaciones.
- FAQ asistida.

### 6.2. Modo Gestión Operativa — Plan pago

Para residencias que quieren gestionar habitaciones, disponibilidad real, residentes y módulos avanzados.

Incluye todo lo del Perfil Verificado más:

- Habitaciones y plazas/camas.
- Residentes.
- Disponibilidad real por plaza.
- Comunidad visible.
- Métricas operativas avanzadas.

> **MVP — todo gratis (decisión D8, 2026-10-20; ver §31).** Gestión Operativa **no se vende en el MVP**: todas las funciones de residencia (incluidas habitaciones, plazas/camas y residentes) son gratuitas para toda residencia verificada. El modelo `operating_mode` y los feature flags se conservan sin cambios para monetizar más adelante; mientras tanto la UI no debe mostrar un plan pago ni mensajes de "Sin acceso".

### 6.3. Reglas del modelo freemium

- Las residencias **pioneras de beta** tienen acceso gratuito completo (incluyendo Gestión Operativa) durante **1 año**, si lo desean.
- Pasado ese período, deben optar por el plan pago para mantener Gestión Operativa.
- El precio del plan pago se definirá antes del lanzamiento público.
- El sistema debe soportar feature flags por residencia para controlar acceso a módulos.
- El admin puede otorgar, revocar o extender acceso gratuito a módulos pagos desde el panel.

**El producto no debe presentar la Gestión Operativa como "PMS" en comunicación comercial. El término recomendado es "Gestión Operativa".**

---

## 7. Verificación de residencias

Ninguna residencia puede publicar sin estar verificada.

El sello público será:

> Residencia Verificada

La verificación incluye:

- Identidad del responsable.
- Fotocopia de DNI del responsable.
- Fotocopia de DNI del coordinador, si hubiera.
- Dirección.
- Visita presencial obligatoria (realizada inicialmente por el fundador).
- Comparación de la residencia real con las fotos publicadas.
- Checklist firmado por ambas partes.
- Aceptación de términos y condiciones.
- Aceptación de disclaimer y deslinde de responsabilidades.
- Declaración de que la residencia es responsable por la actividad de alojamiento que desarrolla.

La verificación se renueva anualmente.

Las ediciones del perfil de residencia son realizadas por la residencia, pero quedan auditadas y sujetas a aprobación por EstuRed.

Las causas de pérdida de sello o expulsión pueden incluir:

- Incumplimiento reiterado de términos.
- Información engañosa.
- Falsa disponibilidad reiterada.
- Cancelaciones injustificadas.
- Reclamos graves validados.
- Conducta discriminatoria comprobada.
- Falta de actualización de disponibilidad.
- Incumplimiento de condiciones aceptadas.

---

## 8. Disponibilidad

La disponibilidad del MVP es semi-real en Perfil Verificado y está sujeta a confirmación de la residencia.

Texto visible en Perfil Verificado:

> Disponibilidad informada por la residencia. Requiere confirmación al solicitar.

Si la residencia usa Gestión Operativa y gestiona disponibilidad real por plazas/camas:

> Disponibilidad asegurada.

Reglas:

- La disponibilidad se define por tipo de habitación (Perfil Verificado) o por plaza/cama (Gestión Operativa).
- Cada residencia debe actualizar disponibilidad al menos cada 30 días o marcar estado "Completa".
- Si no actualiza: recibe recordatorios, puede pasar a "Sin disponibilidad actualizada", puede perder visibilidad.
- Debe existir el estado "Completa" que la residencia selecciona cuando no tiene cupos por ocupación total.

---

## 9. Solicitudes

- Un estudiante puede tener un máximo de 2 solicitudes activas al mismo tiempo.
- Si una solicitud avanza, la otra queda pausada, no anulada.
- Cuando una reserva se confirma, las demás solicitudes activas o pausadas quedan cerradas automáticamente.
- Una misma plaza (Gestión Operativa) o un mismo tipo de habitación (Perfil Verificado) puede tener 3 solicitudes visibles y 2 en cola.
- Debe existir lista de espera para residencias sin disponibilidad.
- La residencia solo puede avanzar con una solicitud por plaza (o tipo de habitación, en Perfil Verificado) a la vez.
- **La solicitud vence a las 48 horas desde su envío** si la residencia no responde ni establece contacto. Ese plazo se detiene cuando la residencia establece contacto (ahí comienza la ventana de pago a la residencia, ver tabla 9.1).
- La residencia recibe notificaciones diarias sobre solicitudes nuevas y pendientes.
- Si la residencia no responde: solicitud se da de baja, advertencia, penalización de visibilidad.
- Si la residencia rechaza: debe seleccionar razón predefinida o justificación interna. El rechazo queda trackeado.

### 9.1. Tabla canónica de plazos — DECISIÓN CONFIRMADA

Esta tabla es la única fuente de verdad de plazos. Todos los plazos operativos son de **48 horas** (no existe ningún plazo de 72 horas en ningún flujo).

| Plazo | Inicia | Se detiene / reinicia | Efecto al vencer |
|---|---|---|---|
| Aprobación de propuesta del familiar | Creación de la propuesta | — | Propuesta `expired`, familiar notificado |
| Vencimiento de solicitud (respuesta de residencia) | Envío de la solicitud | Se detiene al establecerse contacto | `expired_no_residence_response` + botón "Actualizar con mismos parámetros" |
| Pago a residencia | Contacto establecido | Se reinicia al **enviarse** una propuesta de ajuste y nuevamente al **aceptarse** | `expired_no_student_payment`; la residencia puede liberar la plaza |
| Respuesta a propuesta de ajuste | Envío de la propuesta por la residencia | — | `expired_offer_no_response` |
| Pago del fee EstuRed | Residencia marca "Pago recibido" | Hasta 3 intentos dentro de la ventana | Fee `expired` (terminal); reserva `expired_fee_unpaid` |
| No-show | Fecha/hora de ingreso acordada | — | La residencia puede marcar `no_show` a las 24 horas |
| Revocación del fee | Pago del fee | — | Vence a los 10 días corridos (plazo legal, no operativo) |

---

## 10. Datos mínimos para solicitar

Para enviar una solicitud, el estudiante debe completar como mínimo:

- Nombre.
- Apellido.
- Nacionalidad.
- Fecha de nacimiento.
- Lugar donde va a estudiar.

Datos adicionales:

- Son opcionales.
- Aumentan las chances de ser aceptado.
- Pueden ser exigidos por cada residencia en sus condiciones.

La documentación debe subirse al perfil del estudiante.

---

## 11. Pago a la residencia

Cada residencia configura su metodología de pago para asegurar reserva. Puede incluir:

- Matrícula.
- Seña.
- Depósito.
- Otro concepto permitido por EstuRed.

Reglas:

- Los parámetros deben estar configurados en el perfil de cada residencia.
- El monto no puede modificarse caso por caso en una solicitud activa.
- Si la residencia modifica condiciones, el estudiante debe aceptarlas explícitamente.
- El pago a la residencia se realiza **fuera de EstuRed**, por los medios que la residencia indique.
- El estudiante puede cargar comprobante de pago para referencia.
- La residencia marca "Pago recibido" cuando recibe el pago.
- La residencia puede cargar comprobante o recibo para su propia referencia.
- El comprobante final de EstuRed aclara que el monto abonado a la residencia fue **informado por la residencia**.

---

## 12. Fee de servicio EstuRed

El fee lo paga el estudiante, padre, madre o familiar vinculado.

> 5% fijo del total de la estadía inicialmente reservada.

La base del fee incluye:

- Meses de estadía inicialmente reservados.
- Matrícula o cargo de ingreso no reembolsable.

La base del fee excluye:

- Depósito en garantía reembolsable.

El fee no es reembolsable si el estudiante se arrepiente, cancela por decisión propia, no se presenta o no continúa.

El fee puede ser evaluado para reintegro si la residencia cancela, no respeta la reserva o incurre en incumplimiento sustancial verificado por EstuRed.

> El fee de servicio EstuRed no es reembolsable salvo incumplimiento atribuible a la residencia, revisión de EstuRed y normativa aplicable.

La posibilidad técnica de reembolso debe existir aunque la política sea restrictiva.

### Derecho de revocación del fee EstuRed — CONFIRMADO

Plazo: 10 días corridos desde el pago del fee EstuRed (alineado a normativa de contratación a distancia).

Mecanismo: enlace visible en el footer de la plataforma.

Efecto al ejercerse:
- la reserva pasa a `cancelled_by_student` con motivo de revocación;
- el comprobante emitido se anula (`voided`);
- el fee EstuRed **no se reembolsa automáticamente** — queda pendiente de revisión manual de admin;
- admin evalúa cada caso individualmente para detectar patrones de bypass (por ejemplo, revocar el fee después de haber usado el contacto establecido para acordar directamente con la residencia);
- admin puede cotejar con la residencia antes de resolver.

Alcance: aplica únicamente al fee EstuRed. **EstuRed está exenta de reembolsar montos pagados directamente a la residencia** bajo cualquier circunstancia — esa relación y sus condiciones de devolución son responsabilidad exclusiva de la residencia y el estudiante/familiar.

> **Actualizado por DR6 (2026-10-24, §31):** dentro de los 10 días corridos del pago, EstuRed **reintegra el fee completo** previa resolución del admin con motivo obligatorio; ya no se habla de "sin reembolso automático" como política sino de **reintegro tras revisión, nunca automático**. Rige lo que dice DR6 donde difiera de este párrafo.

El derecho de revocación es parte del MVP: debe implementarse con enlace en el footer, pantalla propia, endpoint y flujo de revisión admin (ver `07_API_SPEC.md` §18.6 y `08_UI_SCREENS_AND_FLOWS.md` §6.16). La suficiencia legal del esquema "sin reembolso automático" debe validarse con asesoría legal antes del lanzamiento público (ver `10_PRIVACY_AND_LEGAL_RULES.md` §31).

---

## 13. Moneda, tarifas y conversión — DECISIÓN ACTUALIZADA

### 13.1. Moneda de publicación

Las tarifas de las residencias se publican en dólares estadounidenses (USD) y se muestran también en pesos argentinos (ARS) como referencia.

### 13.2. Fuente del tipo de cambio — DECISIÓN CONFIRMADA

**Fuente oficial del tipo de cambio para EstuRed: monedapi.ar — valor de venta del dólar blue.**

- URL de referencia: https://monedapi.ar/
- Se usa el valor de **venta** del dólar blue.
- La cotización se actualiza diariamente de forma automática.
- Admin puede hacer override manual si la fuente falla.
- Cada solicitud guarda un snapshot del tipo de cambio utilizado al momento de crearla. Ese snapshot no cambia una vez enviada la solicitud.

### 13.3. Modal de tipo de cambio referencial — OBLIGATORIO

Siempre que se muestren precios en ARS convertidos desde USD, debe aparecer un modal o tooltip aclaratorio con este contenido:

> El valor en pesos es referencial, calculado en base al dólar blue (valor venta) del día de hoy. El valor final en pesos será determinado en el momento en que realices el pago directamente a la residencia, según la cotización vigente en ese momento.

Este modal debe mostrarse:

- En la ficha de residencia al ver tarifas en ARS.
- En el resumen de solicitud al ver el monto estimado en ARS.
- En cualquier pantalla donde se muestre conversión de USD a ARS.

### 13.4. Reglas del snapshot

- La cotización mostrada en el modal es la del día (actualizada diariamente desde monedapi.ar).
- El snapshot de la solicitud fija la cotización al momento de enviarla.
- El snapshot no se recalcula automáticamente después de enviada la solicitud.
- El fee EstuRed se calcula usando la cotización del snapshot de la solicitud.
- **Si hubo una propuesta de ajuste aceptada, el `snapshot_final` hereda el tipo de cambio, la fuente y la fecha del snapshot original de la solicitud. La aceptación de la propuesta actualiza montos y condiciones, pero nunca la cotización.** — DECISIÓN CONFIRMADA

### 13.5. Reglas de redondeo

- Tarifas en USD deben terminar en 0 o 5.
- Tarifas en ARS deben terminar en 500 o 000.
- El fee EstuRed se redondea al múltiplo de 500 ARS más cercano. **En caso de empate exacto entre dos múltiplos, se redondea hacia arriba.** — DECISIÓN CONFIRMADA
- Los cálculos internos pueden conservar mayor precisión, pero el usuario ve montos redondeados.

### 13.6. Política de ajuste de tarifas

La residencia puede configurar política de ajuste:

- Mensual.
- Trimestral.
- Semestral.
- Anual.
- Sin ajustes.

El comprobante debe aclarar que los valores de meses futuros están sujetos a posibles modificaciones según la política de la residencia.

---

## 14. Pasarela y métodos de pago del fee EstuRed — DECISIÓN ACTUALIZADA

### 14.1. Proveedores confirmados — DECISIÓN FINAL

**El sistema soporta dos proveedores de pago simultáneamente:**

| Proveedor | Uso principal | URL de referencia |
|---|---|---|
| **MercadoPago** | Estudiantes en Argentina | https://www.mercadopago.com.ar/developers |
| **PayU Argentina** | Estudiantes fuera de Argentina / alternativa | https://corporate.payu.com/argentina/es/ |

- Ambos proveedores están disponibles al mismo tiempo para que el pagador elija.
- La UI debe presentar los dos como opciones al momento de pagar el fee.
- Si el estudiante o familiar está fuera de Argentina, la UI debe sugerir PayU como opción recomendada, pero no forzarla.

### 14.2. Moneda del fee

- El fee EstuRed puede cobrarse en **ARS o USD**, según lo que elija el pagador y soporte el proveedor seleccionado.
- Si el pago es en USD (vía PayU u otro canal habilitado), el sistema debe registrar la moneda y el monto en ambas monedas para auditoría.
- El fee base siempre se calcula en ARS usando el snapshot de tipo de cambio, y luego se convierte a USD si el pagador elige pagar en dólares.

### 14.3. Modo manual

- El sistema debe soportar validación manual del fee por parte del admin (transferencia, comprobante subido por usuario).
- El modo manual debe funcionar sin proveedor de pagos integrado.
- El admin valida el comprobante y confirma el pago manualmente, dejando auditoría.

### 14.4. Abstracción técnica

Debe existir la interfaz interna `PaymentProvider` desacoplada de cualquier proveedor específico.

El proveedor de pago no gobierna la lógica de negocio de EstuRed. Los webhooks actualizan registros internos, pero las reglas de negocio se resuelven en servicios internos.

### 14.5. Medio de pago

- El medio de pago elegido por el estudiante o familiar aplica **solo al fee EstuRed**.
- El pago a la residencia se define en el contacto posterior a la solicitud, fuera de EstuRed.

### 14.6. Idempotencia

Toda operación de pago debe tener `idempotency_key` para prevenir cobros duplicados.

### 14.7. Reintentos del fee

- Después de que la residencia marca "Pago recibido", el estudiante/familiar tiene 48 horas para pagar el fee.
- Si falla el cobro automático: hasta 3 intentos dentro de las 48 horas.
- Si vence sin pago: no hay reserva confirmada, la residencia puede liberar la plaza.

---

## 15. Facturación del fee EstuRed — DECISIÓN NUEVA

### 15.1. Tipo de comprobante fiscal — DECISIÓN CONFIRMADA

**EstuRed emite Factura C como monotributista.**

- Integración con **TusFacturas.app** para emisión automática.
- URL de referencia: https://developers.tusfacturas.app/como-empiezo
- La factura se emite a nombre de quien paga el fee (estudiante o familiar pagador).
- La descripción de la factura debe indicar el beneficiario del servicio reservado (nombre del estudiante si el pagador es el familiar).

### 15.2. Cuándo se emite la factura

- La Factura C se emite automáticamente cuando el fee EstuRed es cobrado correctamente.
- Si el pago es manual (validado por admin), la factura se emite cuando el admin confirma el pago.
- La factura queda vinculada al registro de pago del fee en la base de datos.

### 15.3. Datos requeridos del pagador

Para emitir la Factura C, el sistema debe recolectar del pagador:

- Nombre completo o razón social.
- CUIT/CUIL (opcional para consumidor final, requerido si el pagador lo solicita como persona jurídica).
- Condición frente al IVA (por defecto: consumidor final).

### 15.4. Limitaciones actuales

- EstuRed opera como monotributista. Hay límites de facturación anuales del monotributo.
- Cuando EstuRed supere los límites del monotributo, deberá revisar la categoría fiscal. Esto no es bloqueante para el MVP pero debe tenerse en cuenta como riesgo de crecimiento.

---

## 16. Comprobante de reserva

Nombre aprobado:

> Comprobante de Reserva Confirmada

Se emite **solo** cuando:

- La residencia marcó "Pago recibido".
- El fee de EstuRed fue cobrado correctamente.
- La reserva quedó confirmada dentro de EstuRed.

Debe incluir:

- ID de reserva.
- Código o QR verificable.
- Fecha de emisión.
- Datos del estudiante.
- Datos del familiar pagador o vinculado, si aplica.
- Datos de la residencia.
- Dirección.
- Responsable de residencia.
- Tipo de habitación/plaza.
- Fecha estimada de ingreso.
- Duración inicial declarada.
- Objetivo académico declarado por el estudiante.
- Monto abonado a la residencia, informado por la residencia.
- Monto del fee EstuRed.
- Estado del fee.
- Moneda y tipo de cambio usado si aplica.
- Condiciones principales.
- Política de ajustes futuros.
- Disclaimer legal.
- Contacto de soporte EstuRed.

El comprobante debe aclarar que:

- EstuRed registra la reserva confirmada dentro de la plataforma.
- El pago a la residencia fue informado por la residencia como recibido.
- El fee EstuRed fue abonado correctamente.
- Los pagos mensuales futuros se realizan según condiciones de la residencia.
- Los valores futuros pueden cambiar según política de ajustes de la residencia.
- EstuRed no presta directamente el alojamiento.
- EstuRed puede mediar en determinados casos, pero no garantiza el comportamiento futuro de las partes.

---

## 16bis. Comprobante de renovación

Nombre aprobado:

> Comprobante de Renovación Confirmada

Misma lógica que el comprobante de reserva, adaptado al período renovado, tarifa actual y condiciones vigentes.

---

## 17. Familiar vinculado — DECISIÓN ACTUALIZADA

El estudiante puede usar EstuRed sin familiar vinculado si es mayor de edad.

Si el estudiante es menor de edad, debe tener familiar vinculado obligatoriamente.

Solo puede haber 1 familiar vinculado activo por estudiante.

Un familiar puede estar vinculado a más de un estudiante.

### 17.1. Vinculación

- El familiar debe registrarse y solicitar vinculación.
- El estudiante debe aceptar la vinculación.
- Mientras el vínculo no está aprobado, el familiar no puede operar.

### 17.2. Qué puede hacer el familiar

- Acompañar y ver dashboard compartido con permisos limitados.
- Sugerir o agregar favoritos.
- Cargar documentación.
- Pagar el fee asociado a una solicitud.
- Cargar comprobantes de pago a residencia.
- Ver y descargar comprobantes de reserva.

### 17.3. Familiar que inicia una solicitud — DECISIÓN NUEVA

El familiar **puede iniciar una solicitud de reserva**, pero con las siguientes reglas:

- La solicitud iniciada por el familiar entra en estado **`pending_student_approval`** antes de activarse.
- El estudiante debe aprobar la solicitud para que pase a estado `submitted` y sea visible para la residencia.
- Si el estudiante no aprueba dentro de un plazo definido, la solicitud expira.
- **Si la solicitud fue iniciada originalmente por el familiar**, el contacto que establezca la residencia será dirigido al familiar (no al estudiante).
- Si la solicitud fue iniciada por el estudiante, el contacto de la residencia es con el estudiante.
- **Si el estudiante es menor de edad, el contacto se dirige siempre al familiar vinculado (`contact_target = family_member`), incluso si la solicitud fue iniciada por el propio estudiante.** — DECISIÓN CONFIRMADA
- La entidad `application_requests` debe registrar el campo `initiated_by` (student / family_member) y el campo `contact_target` (student / family_member) para determinar el destino del contacto.
- El teléfono del destinatario del contacto (estudiante o familiar, según `contact_target`) es **obligatorio** para poder enviar o aprobar una solicitud.

### 17.4. Lo que el familiar no puede hacer

- Reemplazar la decisión del estudiante.
- Cancelar una reserva confirmada sin regla específica o confirmación del estudiante.
- Desvincular al estudiante si el estudiante es menor y no hay otro familiar disponible.
- Ver datos que el estudiante no autorizó.

---

## 18. Visibilidad y privacidad de estudiantes

Datos **nunca** públicos:

- Apellido completo.
- Mail.
- Teléfono.
- Fecha de nacimiento.
- Universidad.
- Documentos.
- Datos sensibles.

Invitados o usuarios no registrados:

- Acceso limitado.
- Solo pueden ver nombre y foto/avatar si el estudiante lo habilitó.

Usuarios registrados y compañeros:

- Ven el mismo nivel de información permitido por el estudiante.

La configuración de visibilidad se define durante el registro y puede modificarse en cualquier momento.

> **Decisión D4 (2026-10-20; ver §31).** La visibilidad de la comunidad la controla el estudiante: en "Mi perfil" ve una vista previa de cómo lo ven los demás y dispone de 3–4 interruptores (con valores por defecto recomendados). El consentimiento se pide en el registro. Los menores de edad tienen el perfil individual **oculto por defecto** para usuarios registrados (`docs/10` §9.2). El sistema no puede dejar a un estudiante visible sin que haya consentido.

Grupos sugeridos de visibilidad:

- Invitados.
- Usuarios registrados.
- Compañeros de residencia.
- Residencias con solicitud activa.

Si el registro del residente lo inicia la residencia:

- La residencia puede crear una cuenta pendiente con email.
- El estudiante recibe email para activar cuenta.
- El estudiante finaliza la carga de datos.
- Hasta que active cuenta, aparece como residente pendiente.

---

## 19. Comunidad visible

La comunidad visible será híbrida:

- Información agregada (capacidad, ocupación, tipos de perfiles en términos generales).
- Perfiles individuales cuando el estudiante haya aceptado explícitamente mostrar su perfil.

Los usuarios registrados pueden ver perfiles individuales según configuración del estudiante.

La idea estratégica: un estudiante puede elegir residencia también por el tipo de personas que conviven en ella.

Reglas:

- La residencia **no puede obligar** a un residente a mostrar perfil completo.
- Si un residente no activa cuenta: aparece como "plaza ocupada" o "residente pendiente de activar cuenta".
- No se muestran datos personales completos sin consentimiento.
- El consentimiento de visibilidad se obtiene en el registro, con información clara sobre qué datos se muestran y a quién.
- No habrá etiquetas ni estados de convivencia en la primera etapa.

---

## 20. FAQ asistida por residencia — DECISIÓN ACTUALIZADA

### 20.1. Alcance confirmado para MVP

El módulo FAQ entra en el MVP. Cada residencia puede:

- Elegir preguntas frecuentes de un listado predefinido por EstuRed.
- Cargar sus propias respuestas para cada pregunta elegida.
- Subir archivos adicionales (reglamento interno, información de servicios, normas de convivencia, etc.).
- La información de estos archivos y respuestas forma la base de conocimiento con la que el sistema responde consultas.

### 20.2. Cómo funciona

- El estudiante puede hacer preguntas desde la ficha de la residencia.
- El sistema busca la respuesta en las FAQ configuradas y los archivos subidos por la residencia.
- Si no encuentra respuesta: registra la pregunta como no respondida para que la residencia la vea y la agregue.
- **El sistema no inventa respuestas.** Solo responde con información cargada por la residencia.
- El sistema **no puede** confirmar disponibilidad, precios, ni condiciones que no estén explícitamente cargadas.

### 20.3. Límites obligatorios

El FAQ/bot no puede:

- Inventar precios.
- Confirmar disponibilidad no cargada.
- Prometer condiciones.
- Dar asesoramiento legal.
- Decir que una reserva está confirmada si no lo está.
- Modificar estados.

### 20.4. IA avanzada

IA avanzada queda para fase posterior. En MVP el sistema es estrictamente basado en información cargada por la residencia.

---

## 21. Admin EstuRed

El panel admin es obligatorio desde el MVP. Sin él, el producto no puede operar con seguridad.

El admin puede:

- Crear, editar, aprobar, suspender o archivar residencias.
- Aprobar o rechazar cambios de perfil.
- Gestionar verificación presencial y anual.
- Ver, anular, pausar, reiniciar o editar solicitudes.
- Confirmar reservas manualmente (con override auditado).
- Emitir, reemitir o anular comprobantes.
- Gestionar reembolsos del fee.
- Cambiar visibilidad de residencias.
- Suspender usuarios y residencias.
- Ver documentos sensibles con justificación registrada.
- Gestionar reclamos y mediaciones.
- Ver tipo de cambio y hacer override manual.
- Ver auditoría completa.
- Gestionar feature flags de planes freemium por residencia.
- Otorgar, revocar o extender acceso gratuito a módulos pagos.

Todo debe quedar auditado con: actor, timestamp, entidad, estado anterior, estado nuevo, motivo.

---

## 22. Métricas y visibilidad

Las penalizaciones de visibilidad deben basarse en métricas ponderables internas.

Métricas MVP:

- Tasa de respuesta dentro de 48 horas (peso: 25%).
- Disponibilidad actualizada (peso: 20%).
- Tasa de conversión a reserva (peso: 20%).
- Perfil completo y verificado (peso: 15%).
- Baja tasa de reclamos validados (peso: 10%).
- Uso operativo de la plataforma (peso: 10%).

Las métricas pueden afectar: visibilidad, advertencias, pausas temporales, pérdida del sello, suspensión.

No se mostrarán rankings públicos en el MVP.

---

## 23. Mediación, reclamos y responsabilidad

EstuRed actúa como plataforma intermediaria. No presta directamente el alojamiento.

EstuRed no garantiza: conducta futura de las partes, convivencia, cumplimiento de pagos mensuales, permanencia, ni condiciones no registradas en la plataforma.

EstuRed puede actuar como canal de resolución de conflictos cuando lo solicite una parte y el caso amerite revisión.

Antes de abrir un reclamo, el usuario debe ver: reminder de términos, deslinde de responsabilidad y alcance de la intervención.

Resultados posibles de una mediación: registro interno, recomendación, intermediación entre partes, reintegro del fee si corresponde, penalización de visibilidad, suspensión, expulsión.

**Nota:** Se prefiere el término "resolución de conflictos" o "soporte de gestión" sobre "mediación" en la comunicación pública, para evitar implicaciones legales del término mediación formal en Argentina (Ley 26.589).

---

## 24. Antidiscriminación

Las residencias pueden tener criterios propios de admisión y convivencia publicados en sus reglas, siempre que no sean discriminatorios.

No se permiten criterios de rechazo: raciales, xenófobos, religiosos, discriminatorios, arbitrarios o abusivos.

Una residencia puede declarar condiciones estructurales legítimas (femenina, masculina, mixta, habitaciones separadas por género). Estas deben estar publicadas como características del producto, no usarse como rechazo arbitrario posterior.

Si se comprueba conducta discriminatoria comprobada, la residencia o el estudiante puede ser expulsado de la red.

---

## 25. Multi-residencia por owner — DECISIÓN NUEVA

### 25.1. Capacidad

- Un owner puede gestionar **hasta 10 residencias** dentro de su cuenta.
- No hay multi-cuenta: todo se gestiona desde el mismo login con selector de residencia activa.

### 25.2. Usuarios y acceso

- El owner puede crear usuarios de staff con acceso a múltiples residencias o a residencias específicas.
- El acceso es por `residence_users`, que vincula un usuario a una o más residencias con permisos específicos por residencia.
- No hay permisos globales cross-residencia salvo para el owner.

### 25.3. Dashboard multi-residencia

- **No habrá un dashboard agregado** con métricas consolidadas de todas las residencias.
- En cambio, el owner verá los dashboards individuales de cada residencia en **scroll vertical simultáneo**.
- Habrá un filtro/selector en la parte superior para mostrar solo las residencias que el owner quiera ver en ese momento.
- Cada dashboard individual mantiene su estructura y datos propios.

### 25.4. Contexto activo

- Cuando el owner trabaja dentro de una residencia específica (ej: gestionar solicitudes de esa residencia), el sistema opera en el contexto de esa residencia.
- El contexto activo debe estar visible en la UI en todo momento (nombre de la residencia activa en el header del dashboard de residencia).

---

## 26. Contacto con estudiante vía WhatsApp — DECISIÓN NUEVA

### 26.1. Decisión confirmada

EstuRed **no integra la API de WhatsApp Business** en el MVP.

El mecanismo de contacto es el siguiente:

- Cuando la residencia decide avanzar con una solicitud, se le muestra un **botón de WhatsApp** en la interfaz.
- El botón abre WhatsApp con el número del estudiante (o familiar si la solicitud fue iniciada por el familiar) pre-cargado.
- Se genera automáticamente un **mensaje pre-formateado** con los datos aprobados de la solicitud, que la residencia debe **copiar y pegar** al iniciar la conversación.
- El mensaje incluye: nombre del estudiante, residencia, tipo de habitación, fecha de ingreso, duración, condiciones de reserva y monto requerido.
- EstuRed registra internamente que el contacto fue establecido en ese momento (cambio de estado de la solicitud).

### 26.2. Lo que NO hace el sistema

- No envía mensajes de WhatsApp automáticamente.
- No integra WhatsApp Business API.
- No controla la conversación después de que el botón fue presionado.
- No registra el contenido de la conversación de WhatsApp.

### 26.3. Lo que SÍ debe registrar el sistema

- Timestamp de cuando la residencia presionó el botón (contacto establecido).
- Estado de la solicitud cambia a `contact_established`.
- Se inicia el plazo de 48 horas para el pago a la residencia.
- Auditoría de la acción.

---

## 27. Arquitectura técnica — DECISIÓN ACTUALIZADA

### 27.1. Stack confirmado

- **Frontend/Backend:** Next.js con App Router + TypeScript.
- **Base de datos:** Supabase/PostgreSQL.
- **Auth:** Supabase Auth.
- **Storage:** Supabase Storage.
- **Hosting:** Vercel.
- **Pagos:** MercadoPago + PayU (ambos disponibles, capa `PaymentProvider` abstracta).
- **Tipo de cambio:** monedapi.ar (dólar blue, valor venta), capa `ExchangeRateProvider` abstracta.
- **Notificaciones:** email transaccional (proveedor a definir por Claude Code, opción gratuita/económica) + WhatsApp botón sin API.
- **Comprobantes:** PDF + QR verificable, generación server-side.
- **Facturación del fee:** TusFacturas.app (Factura C, monotributista).
- **Auditoría:** tabla `audit_logs` propia.
- **Jobs:** **Supabase pg_cron** (decisión confirmada — necesario porque hay jobs horarios de vencimiento que el plan gratuito de Vercel Cron no soporta). Granularidad horaria: un vencimiento de 48h puede ejecutarse hasta 59 minutos después del instante exacto; es aceptable.

### 27.2. Principios técnicos no negociables

- No hardcodear ningún proveedor de pagos en la lógica de negocio.
- No hardcodear ninguna fuente de tipo de cambio en la lógica de negocio.
- No permitir que el frontend cambie estados críticos directamente.
- No emitir comprobantes sin reserva confirmada.
- No confirmar reservas sin fee pagado.
- No publicar residencias sin verificación aprobada.
- No exponer documentos sensibles por URLs públicas.
- Toda acción crítica debe quedar auditada.
- Las decisiones de implementación técnica (librerías, providers específicos, jobs) las toma Claude Code, priorizando opciones gratuitas o económicas.

---

## 28. Decisiones técnicas de implementación — SECCIÓN NUEVA

Esta sección establece qué decisiones técnicas ya están tomadas a nivel producto vs. cuáles delega Claude Code.

### 28.1. Decididas a nivel producto (no cambiar sin autorización)

| Decisión | Valor |
|---|---|
| Proveedor de pagos 1 | MercadoPago |
| Proveedor de pagos 2 | PayU Argentina |
| Fuente tipo de cambio | monedapi.ar (blue, venta) |
| Facturación | TusFacturas.app — Factura C monotributista |
| Contacto WhatsApp | Botón pre-formateado, sin API |
| Hosting | Vercel |
| Base de datos | Supabase/PostgreSQL |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Límite de residencias por owner | 10 |
| Familiar inicia solicitud | Requiere aprobación del estudiante |
| Multi-residencia dashboard | Scroll vertical simultáneo, sin agregado |
| FAQ/bot | Basado en contenido cargado por residencia, sin IA libre |
| Jobs / cron | Supabase pg_cron |
| Vencimientos operativos | 48 horas unificadas (ver §9.1); ningún flujo usa 72h |
| TC del snapshot_final | Hereda la cotización del snapshot original |
| Redondeo del fee (empate) | Hacia arriba |
| Contacto con menor de edad | Siempre al familiar vinculado |
| Chargeback del fee | Solo alerta admin; no anula reserva ni comprobante automáticamente |
| 2FA admin/superadmin | Obligatorio (TOTP vía Supabase Auth MFA) desde la beta privada |
| Reserva con factura fiscal fallida | Aceptable temporalmente; la factura se reintenta por job, la reserva no se bloquea |
| Conversaciones de WhatsApp | El admin nunca las ve; solo capturas subidas como evidencia |
| Familiar con alta tasa de propuestas rechazadas | Métrica pasiva (sin marca automática) |

### 28.2. Delegadas a Claude Code (elegir la mejor opción técnica, priorizando gratuitas/económicas)

- Librería de generación de PDF.
- Librería de generación de QR.
- Proveedor de email transaccional.
- Librería de UI / componentes.
- Estrategia de cacheo.
- Herramienta de monitoreo de errores.
- Testing framework.
- Estrategia de migraciones.
- Rate limiting.
- Cualquier otra decisión de stack no listada en 28.1.

**Criterio:** en igualdad de condiciones técnicas, Claude Code debe preferir la opción gratuita o de menor costo para el MVP.

---

## 29. Pendientes no bloqueantes — ACTUALIZADO

Los siguientes puntos estaban pendientes y ahora están **resueltos**:

- ~~Proveedor definitivo de pagos.~~ → MercadoPago + PayU.
- ~~Fuente técnica exacta para tipo de cambio.~~ → monedapi.ar (blue, venta).
- ~~Política fiscal exacta de recibos/facturación.~~ → Factura C, TusFacturas.app.
- ~~Nivel exacto de bot/FAQ en MVP.~~ → FAQ asistida basada en contenido de residencia, sin IA libre.
- ~~Implementación exacta de notificaciones por WhatsApp.~~ → Botón pre-formateado, sin API.
- ~~Planes pagos futuros para residencias.~~ → Freemium: base gratuito, Gestión Operativa pago.
- ~~Multi-residencia por owner.~~ → Hasta 10, sin dashboard agregado.
- ~~Suficiencia legal del botón de arrepentimiento.~~ → Confirmado a nivel producto: enlace en footer, plazo 10 días corridos, sin reembolso automático (ver §12). La revocación entra al MVP con endpoint, pantalla y QA propios.
- ~~Menor de edad y propuesta de solicitud del familiar.~~ → Confirmado: el estudiante, incluso menor, decide (aprueba o rechaza). El familiar no puede aprobar en su representación.
- ~~Vencimientos 48h vs 72h.~~ → Unificado a 48 horas en todos los flujos (ver §9.1).
- ~~Tipo de cambio del snapshot_final.~~ → Hereda la cotización del snapshot original (ver §13.4).
- ~~Solución de cron jobs.~~ → Supabase pg_cron.
- ~~Chargeback posterior a reserva confirmada.~~ → Solo alerta admin; sin efectos automáticos sobre reserva o comprobante.
- ~~2FA admin.~~ → Obligatorio para admin/superadmin desde la beta privada.
- ~~Preguntas abiertas de `09_ADMIN_PANEL_SPEC.md` §34.~~ → Resueltas (ver tabla §28.1).

**Pendientes que siguen sin resolver (no bloquean construcción):**

- Validación comercial/regulatoria del cobro del fee en USD vía PayU Argentina como monotributista (se valida antes de activar PayU en producción; mientras tanto, MercadoPago + modo manual cubren el flujo).
- ~~Validación legal de la política de revocación "sin reembolso automático" frente a la Ley 24.240.~~ → **Superada por DR6 (2026-10-24):** el dueño decidió reintegrar el fee completo dentro de los 10 días corridos, previa revisión del admin. Queda pendiente que un asesor legal revise los textos de cara al estudiante (lista en DR6) y la suficiencia del plazo/condiciones.

- Precio del plan pago de Gestión Operativa (se define antes del lanzamiento público — sin fecha ni criterio aún).
- Texto legal final revisado por abogado.
- Límites anuales exactos de facturación del monotributo a monitorear (se resolverá con un contador en el admin panel más adelante, no es Must Have del MVP).
- Pesos exactos de métricas de visibilidad (listados como referencia, pueden ajustarse).
- Diseño visual final de estados (Claude Code puede implementar diseño funcional).
- Fórmulas finales de ranking interno de búsqueda.

---

## 30. Reglas para Claude Code — ACTUALIZADO

Claude Code debe respetar siempre estas reglas al construir EstuRed:

**Reglas de negocio:**
1. No inventar reglas de negocio. Si falta algo, preguntar.
2. No cambiar el loop principal sin autorización.
3. No confirmar reservas sin fee EstuRed pagado.
4. No emitir comprobantes sin reserva confirmada.
5. No mostrar datos sensibles públicamente.
6. No publicar residencias sin verificación aprobada.
7. No fusionar solicitud, reserva, pago a residencia, fee EstuRed y comprobante en una sola entidad.
8. No asumir que EstuRed es garante del alojamiento.
9. No omitir panel admin.

**Reglas técnicas:**
10. No hardcodear proveedor de pagos en lógica de negocio.
11. No hardcodear fuente de tipo de cambio en lógica de negocio.
12. No permitir que el frontend cambie estados críticos directamente.
13. No omitir auditoría en acciones críticas.
14. No exponer documentos privados por URLs públicas.
15. No usar strings libres para estados. Usar enums.
16. Priorizar opciones gratuitas o económicas para el MVP cuando existan alternativas técnicas válidas.

**Reglas de producto:**
17. No implementar Señales de Convivencia en MVP.
18. No crear rankings públicos.
19. No crear bot de IA libre que invente respuestas, disponibilidad o precios.
20. No convertir Gestión Operativa en un PMS complejo.
21. No construir app nativa.
22. No eliminar capacidad de mediación/resolución de conflictos.

**Si Claude Code encuentra una ambigüedad bloqueante: debe detenerse y preguntar antes de asumir.**

---

## 31. Decisiones del dueño — auditoría 2026-10-20 (D1–D11)

**Fecha:** 2026-10-20 (resueltas por el dueño; registradas el 2026-10-21).
**Fuente:** `docs/audits/AUDITORIA_2026-10-20.md` (hallazgos H01–H32) y `docs/audits/PLAN_ACCION_2026-10-20.md` (tabla "Decisiones del dueño (resueltas)").
**Alcance:** estas decisiones autorizan editar los docs de producto afectados (por única vez, protocolo `docs/13` §5: doc primero, código después). Donde contradigan texto anterior de este documento (§5, §6.2, §6.3, §18, §19, §20, §29), **prevalece esta sección**.

| # | Hallazgo | Decisión | Docs actualizados |
|---|---|---|---|
| D1 | H26 | Segundo proyecto Supabase para desarrollo, tests y demos; el actual queda solo para producción. | (técnico: `CLAUDE.md`/`AGENTS.md`) |
| D2 | H02 | Modo manual del fee = transferencia con datos en pantalla: CBU/alias/titular configurables por el admin, monto exacto en ARS, n.º de reserva como referencia, cuenta regresiva y botón "Tengo un problema con el pago". | `docs/08` §6.8 |
| D3 | H03 | La disponibilidad que ve el estudiante la manda el **tipo de habitación**; el mapa de camas solo informa ocupación y no ofrece "Elegir" si el tipo no está disponible. | `docs/08` §2.6, §4.5 |
| D4 | H04 | Visibilidad de comunidad controlada por el estudiante (vista previa + interruptores), consentimiento en el registro, menores ocultos por defecto. Revierte los Ciclos 37/39. | `docs/00` §18, `docs/10` §7, §9.2 |
| D5 | H05 | La tarifa vigente de la estadía puede diferir de la acordada en la reserva: el estudiante ve la vigente con una nota; la residencia ve la diferencia contra el snapshot. | `docs/06` §15.1 |
| D6 | H06 | El pago a la residencia se habilita solo desde `contact_established`, que vence a las 48 h (`expired_no_student_payment`); el plazo es visible en el inbox de la residencia. | `docs/04` §5.8 |
| D7 | H08 | Campo "pago inicial para reservar" en el perfil de la residencia (por defecto, el primer mes), mostrado igual en ficha, solicitud, WhatsApp y fee. Supuesto reversible. | `docs/06` §8.1 |
| D8 | H09 | **Todo gratis en el MVP.** Gestión Operativa no se vende; el modelo `operating_mode` se conserva para monetizar más adelante. Difiere de §6.2. | `docs/00` §6.2, `docs/02` §7.21, §15.2, `docs/08` §3.3 |
| D9 | H12 | FAQ simple en el MVP (pregunta libre del estudiante → la residencia responde). Métricas, facturas y settings, diferidos. Routing real reflejado. | `docs/02` §7.22, §20, `docs/08` §3, §4.5 |
| D10 | H13, H19 | Solo reset de contraseña y `/terms` (borrador desde `docs/21`, enlazado en registro y footer; revisión legal antes de operar). Sin canal directo con la residencia: todo pasa por Soporte. | `docs/08` §3.1, §5.1, §5.3 |
| D11 | H18 | Estadías vencidas: alerta a 30 días y al vencer, con acciones "Renovar" / "Registrar salida"; nunca cierre automático. | `docs/08` §7.12 |

Notas de interpretación:
- **D8 vs §6.3:** el beneficio "pionera de beta: 1 año gratis" queda sin efecto práctico mientras todo sea gratuito; `is_pioneer`/`pioneer_free_access_until` se conservan en el modelo.
- **D9 vs §20.2:** en el MVP no hay búsqueda automática en archivos subidos: la pregunta libre llega a la residencia y la responde una persona. Los límites de §20.3 siguen vigentes.
- **Ciclo 43 (no es una decisión D, pero corrige un doc):** la renovación extiende `resident_stays.expected_end_date` ("contrato hasta"), no `end_date` (salida real). Ver `docs/06` §14.2 y §15.1.

### Decisiones de la ficha pública `/residencias/[slug]` (2026-10-23, DF1–DF4)

**Fuente:** `design-proposals/ficha-residencia/SPEC.md` (§11, decisiones 1–4). Autorización explícita del dueño para editar los docs afectados (protocolo `docs/13` §5: doc primero, código después).

| # | Decisión | Docs actualizados |
|---|---|---|
| DF1 | Layout A: columna lateral sticky con tarjeta de precio y condiciones (selector por tipo con `StatusTag`, CTA por rol) + hoja lateral con el formulario de solicitud; "Qué pagás y a quién" visible para todos; el mapa de camas pasa a `/comunidad` y la ficha no muestra camas libres (solo disponibilidad por tipo, D3). | `docs/08` §4.5 |
| DF2 | Variante "Completa" **por tipo** en `StatusTag` ("{Tipo}: completa"), sin afirmar que toda la residencia está completa; "Residencia completa" solo si todos los tipos lo están. | `docs/08` §4.5, `docs/04` §10.2 |
| DF3 | ~~Mapa OSM con zona aproximada, centro redondeado del lado del servidor.~~ **Superada por DF5.** Se mantiene: universidades cercanas con distancia; teselas OSM directo en MVP y proveedor con clave antes del lanzamiento masivo. | `docs/08` §4.5, `docs/15` §23 |
| DF4 | ~~La dirección exacta se muestra recién en `contact_established`.~~ **Superada por DF5.** Se mantiene: `enrollment_fee_mode = null` significa "no cobra matrícula", no "no informado". | `docs/06` §8.1 |
| DF5 | **(2026-10-23, reemplaza DF3 y la parte de dirección de DF4)** La dirección y la ubicación de una residencia son información pública (cualquiera la encuentra online). El mapa de la ficha muestra el **pin exacto** y alrededor los puntos de interés (universidades cercanas con distancia). Sin zona aproximada, sin redondeo y sin dirección privada hasta `contact_established`. Coordenadas exactas `latitude`/`longitude` (`numeric(9,6)`) públicas; fallback al centro del barrio solo si faltan. Siguen privados: teléfono, email y contacto del responsable, documentos, notas internas y datos de verificación. | `docs/08` §4.5, §6.5, `docs/06` §8.1, `docs/10` §6.1–6.2 |

### Reserva vigente y listas de espera (2026-10-23, DR1–DR2)

**Fuente:** decisión directa del dueño (2026-10-23). Autorización explícita para editar los docs afectados con cambios mínimos (protocolo `docs/13` §5: doc primero, código después). Donde contradigan `docs/03` §11.3, `docs/12` (lista de espera) o `docs/16`/`docs/17` (estudiante alojado), **prevalece esta sección**.

| # | Decisión | Docs actualizados |
|---|---|---|
| DR1 | Un estudiante con **reserva vigente** (`LIVE_RESERVATION_STATUSES`, p. ej. `confirmed` con estadía sin terminar) o **estadía en curso** (`pending_activation`/`active`) **no puede crear solicitudes ni anotarse en listas de espera con fechas que se superpongan** con ese período (de `start_date` al fin de contrato vigente: `expected_end_date` o `start_date` + duración). **Sí puede** para fechas posteriores al fin. Se mantiene el máximo de 2 solicitudes activas. Reemplaza la regla simple "alojado no puede solicitar". | `docs/04` §5.6bis, §5.6, §7.4, §11.3, §22, §24; `docs/08` §4.5, §6.10 |
| DR2 | Al **confirmarse una reserva** se anulan automáticamente todas las listas de espera del estudiante; se lo **notifica** cuáles se anularon y por qué, y esas residencias quedan **solo en sus favoritos** (el usuario decide si las mantiene o las quita). | `docs/04` §11.2, §11.3, §22; `docs/06` §27.8, §21 (notificaciones); `docs/08` §6.2, §6.10 |

Notas de interpretación (supuestos reversibles): (a) una lista de espera sin fecha deseada se considera superpuesta mientras haya período vigente; (b) la regla también se valida sobre las propuestas del familiar; (c) las reservas en `pending_estured_fee`/`estured_fee_processing`/`estured_fee_failed` cuentan como vigentes a efectos del bloqueo (siguen la lista de `reservationStatus.ts`), mientras que el borrado de listas de espera (DR2) ocurre recién en `confirmed`.

### Flujo "Quiero cambiar" (2026-10-23, DR3)

**Fuente:** decisión directa del dueño (2026-10-23). Autorización explícita para editar los docs de producto afectados con cambios mínimos (protocolo `docs/13` §5: doc primero, código después). **Excepciona a DR1** y **no cambia DR2**.

| # | Decisión | Docs actualizados |
|---|---|---|
| DR3 | Un estudiante con **reserva vigente confirmada o estadía en curso** puede presionar **"Quiero cambiar"** en *Mi residencia*. Eso (1) **avisa a su residencia actual** que está en búsqueda activa de otro lugar y (2) **lo habilita**, mientras el aviso esté abierto, a **enviar solicitudes de reserva y anotarse en listas de espera de otras residencias, incluso con fechas que se superponen** con su período vigente (excepción a DR1). La residencia actual puede **anticipar la salida** y **comunicar con anticipación los costos** (p. ej. pérdida del depósito si no cumplió la estadía mínima) y cualquier detalle de la salida; la respuesta es informativa. El estudiante puede **cancelar** el aviso y vuelve a regir DR1. Se resuelve cuando se **confirma una reserva nueva** en otra residencia (DR2 limpia las listas de espera). Entidad nueva y separada: `stay_change_intent` (no se fusiona con renovación, solicitud ni reserva). Beneficio buscado para la residencia: previsibilidad de ocupación, planificación y renovaciones (hoy los estudiantes se cambian sin avisar). El flujo y sus beneficios se **destacan** en la web y en los perfiles de estudiantes, familiares y residencias. | `docs/04` §5.6bis, §12bis, §20.3, §21.6, §22, §24; `docs/05` §14bis; `docs/10` §21bis; `docs/06` §4.22, §14bis, §21.1, §23.5bis, §24.9, §27.11; `docs/08` §3.2, §4.2, §4.3, §4.5, §6.1, §6.10, §6.15, §6.16, §7.12, §10 (Flujo M) |
| DR3b | **Precisiones del dueño al flujo "Quiero cambiar" (2026-10-23).** (1) **Política de salida anticipada:** la residencia define **una vez en su perfil** el depósito y las cláusulas básicas (derechos/obligaciones sobre el depósito y la salida anticipada); se muestra en la **ficha antes de reservar** y se **precarga** al responder el aviso. (2) **Cancelar el aviso** cierra las solicitudes y listas de espera creadas bajo él (se avisa a esas residencias); cancelar se **bloquea si hay pago en curso** (se resuelve con Soporte). (3) **Visibilidad:** la residencia actual ve solo la **fecha de ingreso** a la nueva (no el nombre); la residencia **nueva** ve una señal **"en proceso de mudanza"** pero **no** de qué residencia viene ni el motivo, que el estudiante puede contar en un **campo opcional** de la solicitud nueva (**corrige el supuesto previo** de interruptor/invisibilidad entre residencias). (4) **Menores:** el menor inicia el aviso y **no se envía hasta que el familiar vinculado lo confirma**; el familiar lo ve **sin el mensaje privado** del estudiante. (5) **Pagos:** sin regla nueva de reembolso; lo pagado a la residencia se rige por su política y el fee por la revocación/reembolso vigente (`docs/10` §15.4), sin prometer devoluciones. (6) **Defaults:** el estudiante puede **editar** el aviso abierto con auditoría; **checkbox obligatorio**; **vencimiento a 90 días**. (7) **Quien confirma y paga una reserva nueva bajo el aviso debe mudarse.** Al confirmarse (pagos hechos y fee cobrado) se avisa a la residencia actual "este estudiante tiene una reserva confirmada a partir de DD/MM/AAAA en otra residencia"; cuando el estudiante se retira, la residencia actual **finaliza la estadía con SALIDA ANTICIPADA**, marcando si se devolvió el depósito (devuelto / no devuelto / sin depósito), con nota libre de la residencia y nota opcional del estudiante; si no hay depósito, la residencia es responsable de cobrar lo necesario antes de que se retire; **EstuRed no se responsabiliza por mensualidades impagas, incobrables ni morosos bajo ninguna circunstancia** (copy obligatorio). (8) **La salida SIEMPRE la inicia la residencia actual**; el aviso del estudiante no cierra su estadía. (9) **Preaviso:** empieza al presionar "Quiero cambiar"; *supuesto reversible:* puede enviar solicitudes y anotarse en listas desde el primer momento, pero no avanzar al pago/confirmación de una reserva nueva antes de **48 h** desde el aviso (menores: desde la confirmación del familiar). | `docs/04` §5.6bis, §12bis; `docs/05` §14bis; `docs/06` §14bis; `docs/08` §6.16, §7.12; `docs/10` §21bis |

Supuestos reversibles que el dueño no fijó (ver `GAPS.md` para lo que sigue abierto): (a) el aviso lo crea **solo el estudiante** (menor: con confirmación del familiar); (b) los costos y condiciones de salida que informa la residencia son **informativos**: EstuRed no los fija, no los cobra, no los garantiza ni media (plataforma intermediaria, sin garantías); (c) el aviso no exime del contrato vigente ni cierra la estadía automáticamente (D11); (d) el aviso vence a los 90 días sin confirmación del estudiante o al registrarse la salida real de la estadía; (e) 48 h de preaviso antes de avanzar al pago (DR3b-9) y alcance exacto de "pago en curso" para bloquear la cancelación.

### Experiencia del familiar vinculado (2026-10-23, DR4)

**Fuente:** decisión directa del dueño (2026-10-23), hallazgo H16 de `docs/audits/AUDITORIA_2026-10-20.md`. Autorización explícita para editar los docs afectados con cambios mínimos (protocolo `docs/13` §5: doc primero, código después). Donde contradiga `docs/05` §4.5, `docs/08` §5.5/§6.15 o `docs/10` §3.4 en lo que el familiar puede hacer sobre documentos del estudiante, **prevalece esta sección**.

| # | Decisión | Docs actualizados |
|---|---|---|
| DR4 | **(1) Rol del familiar vinculado:** puede **seguir** (ver el estado de las solicitudes y reservas del estudiante), **proponer** residencias (el estudiante las aprueba: flujo existente de propuestas del familiar) y **pagar** (ser el `payer_user_id` del fee EstuRed). **No** edita el perfil ni los documentos del estudiante, **no** envía solicitudes en su nombre y **no** ve sus mensajes privados. **(2) Perfil propio editable del familiar:** nombre, teléfono de contacto, relación con el estudiante (padre, madre, tutor, otro) y **datos de facturación del pagador** (CUIT/DNI y condición de IVA), guardados para el fee (no se piden de nuevo en cada pago); consentimiento `family_contact_disclosure` cuando corresponda. **(3) Avisos que recibe:** hitos clave y todo lo relacionado con pagos: propuestas aprobadas o rechazadas, solicitud aceptada, pago a la residencia pedido, fee a pagar y su plazo, reserva confirmada, comprobante, vencimientos y, si el estudiante inicia "Quiero cambiar", un aviso de menor importancia para confirmar. **No** recibe mensajes privados ni cada movimiento menor. **(4) Pantallas:** pantalla del familiar pagador, ruta del perfil del familiar, dashboard centrado en el estudiante y ficha de residencia con desglose de costos; la landing `/for-students` destaca a las familias como público clave. | `docs/05` §4.5; `docs/06` §6.3, §21.1; `docs/08` §3.2, §4.2, §4.5, §5.5, §6.1, §6.8, §6.13, §6.15; `docs/10` §3.4, §9.3 |

**Cruce con DR6 (2026-10-24):** el familiar pagador **no** puede revocar el fee si la estudiante es mayor de edad (solo si es menor); ver DR6 (i).

Supuestos reversibles que el dueño no fijó: (a) el perfil del familiar vive en la misma ruta `/students/profile`, con contenido según el rol (hoy el enlace "Mi perfil" del familiar está oculto porque esa ruta no tiene vista de familiar y da 404); (b) los campos nuevos de `family_members` se llaman `billing_tax_id` y `billing_vat_condition`; (c) el "aviso de menor para confirmar" de "Quiero cambiar" solo se envía como notificación cuando el estudiante es menor (para mayores, el familiar recibe el aviso informativo ya previsto en DR3); (d) "subir comprobantes de pago a residencia" se mantiene como estaba hasta que el dueño diga otra cosa, porque DR4 solo excluye perfil y documentos del estudiante. (e) **(Ciclo 61)** el mecanismo para que el familiar sea `payer_user_id` es que el estudiante lo designe desde la pantalla del fee (o vuelva a pagar él mismo) mientras el fee espera el pago y no venció; el familiar no se auto-designa y, una vez cargado un comprobante, ya no se cambia.

### Reenvío a revisión tras "pedir cambios" (2026-10-24, DR5, opción A)

**Fuente:** decisión directa del dueño (2026-10-24, "opción A"). Protocolo `docs/13` §5: doc primero, código después.

| # | Decisión | Docs actualizados |
|---|---|---|
| DR5 | Cuando el admin **pide cambios** a una residencia (`needs_changes`) escribe un **"Mensaje para la residencia"** (obligatorio, 10 a 1000 caracteres), **separado de las notas internas** (que siguen siendo solo del admin). La residencia recibe un **aviso in-app + email genérico** (sin el texto del admin), ve el mensaje en su Panel y en `/profile`, corrige y **reenvía**: `needs_changes` → `pending_verification` con el mismo botón "Enviar para revisión" (rotulado "Reenviar para revisión"), con las mismas validaciones de mínimos. La verificación interna vuelve a `documents_pending`. El mensaje se guarda en `residence_verifications.changes_requested_message` (solo service role, migración 0048) y al reenviar se limpia de la fila pero queda en el audit log. | `docs/04` §13.3 |

Supuestos reversibles que el dueño no fijó: (a) el rechazo (`suspended`) no cambia: el motivo sigue interno y la residencia consulta por Soporte; (b) el mensaje no admite edición posterior ni historial en pantalla (el historial vive en el audit log); (c) el email no incluye el mensaje porque viaja por un tercero; (d) una residencia con cambios pedidos antes de la migración 0048 no tiene mensaje: se muestra el copy genérico.


### Ciclo de vida de la verificación de residencias (2026-10-24, DR7)

**Fuente:** auditoría del panel admin (Ciclo 70) sobre reglas ya vigentes (`docs/05` §11.2: la visita presencial es obligatoria; `docs/04` §13: estados de residencia). Protocolo `docs/13` §5: doc primero, código después. **No se crean estados nuevos.**

| # | Decisión | Docs actualizados |
|---|---|---|
| DR7 | (a) **No se aprueba sin visita presencial:** para aprobar el admin carga la **fecha de la visita realizada** (`residence_verifications.visited_at`, no futura) además del checklist mínimo. (b) **"Programar visita"** es una acción propia: `pending_verification` → `verification_scheduled` y guarda `scheduled_at` (el Panel de la residencia muestra la fecha). No toca el checklist. (c) **Aprobar y rechazar piden confirmación explícita** con sus consecuencias (aprobar publica la residencia en el catálogo; rechazar la suspende, no puede reenviar y consulta por Soporte). (d) **Toda decisión es un update condicional por el estado actual** de la residencia (`pending_verification`, `verification_scheduled` o `verification_expired`; el rechazo también desde `needs_changes`): si el estado cambió en el medio se avisa y no se pisa nada. (e) **"Pedir cambios" no guarda los tildes del checklist** ni la fecha de visita. (f) Al **aprobar y al rechazar** la residencia recibe aviso in-app + email genérico (sin datos sensibles ni plazos; el rechazo remite a Soporte). (g) **`verification_expired` entra a la cola** del admin (chip "Vencida") y la cuenta como pendiente; el dueño puede **reenviarla** a revisión con el mismo botón (`verification_expired` → `pending_verification`; la verificación interna `expired` vuelve a `documents_pending`). El admin también puede aprobarla tras una nueva visita. (h) **Aviso a 30 días del vencimiento** al equipo de la residencia (job horario existente, sin duplicar) y lista "vencen en 30 días" en el dashboard. (i) El dashboard separa **"Verificaciones pendientes"** (esperan al admin) de **"Esperando a la residencia"** (`needs_changes`), y la cola distingue "Nueva" de "Reenviada". | `docs/04` §13.3; `docs/09` §7.3–7.5 |

Supuestos reversibles que el dueño no fijó: (a) la fecha de visita se carga como un día (se guarda a las 12:00 UTC) y no puede ser futura; la programada no puede ser anterior a hoy; (b) desde `verification_expired` el admin puede programar, pedir cambios, aprobar o rechazar (re-verificación sin que el dueño reenvíe antes); (c) de los avisos de `docs/09` §7.5 (60/30/7 días y el día del vencimiento) solo se implementa el de 30 días; el de 60, el de 7 y el del día quedan pendientes; (d) "Programar visita" no avisa a la residencia (solo se ve en su Panel); (e) el rechazo sigue siendo irreversible desde el panel (fuera de alcance); (f) el aviso de aprobación no menciona la vigencia anual.

### Revocación del fee: reintegro completo previa revisión (2026-10-24, DR6)

**Fuente:** decisión directa del dueño (2026-10-24). Autorización explícita para editar los docs afectados (protocolo `docs/13` §5: doc primero, código después). Donde contradiga lo anterior sobre revocación (`docs/03` §13.11/§13.11bis, `docs/04` §8.9, `docs/07` §18.6, `docs/08` §6.9bis/§9.10, `docs/09` §35, `docs/10` §15.4, `docs/16`/`docs/17`), **prevalece esta sección**.

| # | Decisión | Docs actualizados |
|---|---|---|
| DR6 | Si el estudiante revoca el fee **dentro de los 10 días corridos de pagado** (`estured_fee_payments.paid_at`), **EstuRed reintegra el fee completo (el 5%)**, previa **resolución del admin con motivo obligatorio** (10 a 1000 caracteres). **Nunca es automático:** al revocar, la reserva pasa a `cancelled_by_student` (`student_revocation_right`), el comprobante a `voided`, el fee **permanece `paid`** y se abre un caso de Soporte para la revisión. El admin resuelve desde Actividad → Revocaciones con una de dos acciones: **"Reintegrar fee"** (el fee pasa a `refunded`; el admin registra fecha, medio y referencia del reintegro) o **"Denegar revocación"** (el fee sigue `paid`; solo si la revocación está fuera de los 10 días o hay una causa justificada, siempre con motivo). **Lo pagado a la residencia queda fuera:** se acuerda con la residencia directamente y EstuRed no lo reintegra. **El reintegro lo hace EstuRed a mano, por fuera de la plataforma** (p. ej. transferencia): no hay integración de pagos automática y la plataforma solo registra la resolución. El estudiante ve el estado de su revocación (en revisión / reintegrada con fecha / denegada) y, si el admin lo escribe, un **mensaje para el estudiante**, que es un campo aparte del motivo interno (el motivo interno no se muestra nunca). | `docs/03` §13.11, §13.11bis; `docs/04` §8.2, §8.9; `docs/05` §5; `docs/06` §13.2, §18.1; `docs/07` §18.6, §18.6bis; `docs/08` §6.9bis, §9.10, §8.10bis; `docs/09` §35; `docs/10` §15.1, §15.4, §31; `docs/16` §8.7bis; `docs/17` |

Supuestos reversibles que el dueño no fijó: (a) **"dentro de los 10 días"** se mide entre `paid_at` y el momento en que se registró la revocación (`reservations.cancelled_at`), no al resolver: una resolución tardía del admin no le quita el derecho al estudiante; (b) **denegar dentro de los 10 días** exige marcar explícitamente "hay una causa justificada" además del motivo (por ejemplo, un uso indebido del contacto para acordar por fuera de la plataforma) y queda auditado; (c) **denegar no restaura la reserva** (sigue cancelada y el comprobante anulado): revertirlo sería otra decisión; (d) el reintegro es del **monto completo del fee** (`fee_amount_ars`), sin parciales; el admin confirma explícitamente el monto en ARS (y se muestra la referencia en USD); (e) si ya se había emitido Factura C, la **nota de crédito** se gestiona por fuera de la plataforma (no hay emisión fiscal automática de ella); (f) el caso de Soporte de la revocación es un caso **sin residencia** (`support_cases.topic = 'fee_revocation'`): la residencia nunca lo ve; cerrarlo se hace al resolver la revocación; (g) el aviso in-app a los admins al revocar **no se construye** (no existe un notificador genérico a admins): la visibilidad es el contador del dashboard y la pestaña Revocaciones; (h) **riesgo abierto, sin cambio hasta que el dueño decida:** el familiar pagador hoy puede revocar la reserva de una estudiante mayor de edad (`revokeEsturedFee` acepta al estudiante o al `payer_user_id`); se registra en `GAPS.md`.

**Textos legales visibles al estudiante tocados por DR6 — pendientes de revisión por un asesor legal** (borrador; el copy técnico vive en `lib/revocations/copy.ts`, marcado con `LEGAL_REVIEW_PENDING`): (1) `/terms` §17 "Reembolso del fee y derecho de revocación" (subsección "Derecho de revocación del fee EstuRed"); (2) pantalla `/students/revocation` (derecho, qué se reintegra y qué no, checkbox de entendimiento, estados en revisión / reintegrada / denegada); (3) nota al pie de la pantalla del fee `/students/applications/[id]/fee` y su checkbox "Entiendo que el fee EstuRed no se reembolsa automáticamente ante una cancelación" (sin cambios de texto, a revisar por coherencia); (4) avisos in-app de resolución (reintegro / denegación) al estudiante; (5) helper "Reserva revocada por vos" en `lib/applications/visibleStatus.ts` (sin cambios, a revisar); (6) copy sugerido de `docs/10` §15.1, §15.4 y las leyendas de aceptación de `docs/10` (§ de confirmación de reserva, líneas de "no reembolsable"); (7) el checkbox equivalente de renovaciones (`RenewalFeePaymentForm`).

**DR6 — pendientes de decisión tras la revisión de seguridad (el (i) ya está resuelto; el resto no está implementado):**
(i) **RESUELTO (2026-10-24, decisión del dueño, Ciclo 69):** el familiar pagador solo puede revocar el fee / la reserva si la estudiante es **menor de edad** (a la fecha de la revocación, con `isMinorByBirthDate`, calendario de Buenos Aires; sin `birth_date` se trata como menor). Si es mayor de edad, **solo ella puede revocar**: el familiar sigue pudiendo seguir, proponer y pagar, pero no revocar. Además se exige vínculo `family_links.status='active'` y ser el pagador del fee, y el estudiante recibe siempre un aviso cuando revoca un familiar (caso menor). Mensaje al familiar de una mayor: «La revocación la tiene que hacer la estudiante desde su cuenta. Si ella necesita ayuda, escribinos a Soporte.»; nota en pantalla (3.ª persona): «Solo {nombre} puede revocar el fee de su reserva; si necesita ayuda, puede escribir a Soporte.» (textos para el asesor legal).
(ii) El plazo de 10 días como 240 h exactas desde `paid_at` vs. día calendario (art. 6 CCyC; Ley 24.240 art. 34): asesor legal.
(iii) "Denegar dentro de plazo con causa justificada" vs. derecho irrenunciable: asesor legal.
(iv) Que la residencia pueda ver `status`/`refunded_at` del fee (migración 0047): decisión de privacidad pendiente.
(v) Falta `refund_currency`: un fee pagado en USD se reintegra registrado en ARS (la UI del admin advierte y exige un checkbox de reconocimiento; no hay moneda de reintegro en el modelo).
Textos legales para el asesor (suma de esta ronda): intro y consecuencias de `/students/revocation` ahora dicen "salvo que la revisión detecte un uso indebido" (coherente con `/terms` §17); aviso in-app al estudiante cuando revoca un familiar ("{nombre} revocó el fee de tu reserva en {residencia}").


### Validación manual del fee: "Marcar pagado y confirmar reserva" (2026-10-24, DR8)

**Fuente:** auditoría del panel admin (Ciclo 71) sobre la pantalla `/admin/payments`. Es dinero y dispara la confirmación de la reserva, el comprobante verificable y la Factura C, así que se endurece con protocolo `docs/13` §5 (doc primero, código después). **Supuestos reversibles** donde el dueño no fijó nada (marcados abajo); la semántica de la confirmación de reserva **no cambia**.

| # | Decisión | Docs actualizados |
|---|---|---|
| DR8 | **(1) Comprobante o override explícito.** El admin solo puede marcar pagado un fee en `pending_manual_payment` **con comprobante subido** (visible en pantalla por el acceso con motivo ya existente, `docs/09` §18.2) o, como **excepción**, con un **override "Confirmar sin comprobante"**: exige motivo de **al menos 10 caracteres** y una **segunda confirmación** explícita, y queda marcado en la auditoría y en el registro del pago (`confirmed_without_receipt`). Sin comprobante y sin override la acción no está disponible y el servidor la rechaza. El override solo vale si **no** hay comprobante cargado. **(2) Monto realmente recibido.** El admin carga **monto recibido + moneda (ARS/USD)**, que el servidor compara con el fee esperado **guardado** (nunca el que mande el cliente): en ARS `fee_amount_ars`; en USD `fee_amount_usd` o, si no está, `fee_amount_ars` ÷ cotización del snapshot (`fee_base_ars` ÷ `fee_base_usd`). **Tolerancia: hasta 1 %** de diferencia es redondeo y no frena el pago (igual se muestra y se audita la diferencia). Si la diferencia **supera 1 %**, el servidor exige un **motivo de al menos 10 caracteres** que la explique y la audita como diferencia. Se guardan el monto recibido y la moneda. **(3) Confirmación explícita** antes de ejecutar: paso previo que muestra las consecuencias ("Se confirma la reserva, se emite el comprobante verificable y se dispara la factura") y un checkbox **"Verifiqué el pago"** obligatorio (también validado en el servidor). **(4) Plazo vencido.** No se puede marcar pagado un fee cuya ventana de pago (`expires_at`) ya venció, salvo **reabrir el plazo** con la acción existente (Actividad → Reservas, `reopenEsturedFeeWindow`, 48 h más). **(5) Contexto en pantalla:** plazo de la ventana (vence en / vencido), **pagador** (nombre corto y si es el estudiante o el familiar) y **cálculo del fee** (base USD × porcentaje × tipo de cambio del snapshot, en ARS y USD). **(6) Servidor:** rol admin/superadmin desde la sesión; UPDATE **condicional** por estado (`pending_manual_payment` / `pending_payment_method`) y por plazo no vencido, con chequeo de filas afectadas (evita la doble confirmación); se verifica antes que la reserva esté `pending_estured_fee` y el pago a la residencia esté confirmado; auditoría con quién, monto esperado vs. recibido, diferencia, override sí/no y motivo, **sin datos de facturación**. **(7) Revisión de seguridad (Ciclo 71, supuestos reversibles).** (a) **Diferencia de monto:** fuera de la tolerancia del 1 % el servidor exige además un checkbox explícito **"Acepto la diferencia"** (`accept_amount_difference`) y, con un **piso**: si lo recibido es **menos del 90 %** del esperado (`AMOUNT_FLOOR_RATIO`), **solo un `superadmin`** puede confirmar (un admin operativo debe derivarlo). Si coinciden override sin comprobante y diferencia, el `reason_code` de la auditoría lista ambos (`confirmed_without_receipt,amount_difference`). (b) **Fee `paid` con la reserva sin confirmar:** si tras marcar `paid` falla la confirmación de la reserva, el fee **no se revierte**; se audita `reservation_confirmation_failed_after_fee_paid`, se notifica a los admins y `/admin/payments` (pestaña Cobrados + aviso en Pendientes) marca esos casos con **"Reintentar confirmación"** (acción admin, audita `reservation_confirmation_retried`). `confirmReservationAfterFeePaid` es **idempotente**: exige fee `paid`, confirma con UPDATE condicional de la reserva (`pending_estured_fee`) y si ya estaba `confirmed` devuelve ok sin duplicar comprobante, factura ni disponibilidad. (c) El UPDATE del fee exige el **mismo estado leído, el mismo comprobante por id** (el form envía el `file_id` visto) y plazo vigente o sin plazo. (d) Montos ambiguos (`140.500`, `1,234`, `1,234.5`) se rechazan: se pide escribirlos sin separador de miles. (e) `provider_payment_id` deja de ser legible por la residencia (migración 0050). **Decisión PENDIENTE del dueño:** hoy el comprobante verificable y la Factura C salen por el **fee esperado completo**, no por el monto realmente recibido (si se aceptó una diferencia, ¿se emite por lo recibido?, ¿se exige regularizar la diferencia?). | `docs/04` §8.10; `docs/06` §13.2; `docs/07` §17.4; `docs/08` §8.10; `docs/09` §14.3, §14.5 |

Supuestos reversibles que el dueño no fijó: (a) la tolerancia del 1 % es una cifra de partida (se cambia en `lib/payments/evaluateManualFeePayment.ts`, constante `AMOUNT_TOLERANCE_RATIO`); (b) el motivo sigue siendo obligatorio siempre (mínimo 5 caracteres, `docs/07` §17.4) y sube a 10 si hay override o diferencia; (c) el override no se permite si hay comprobante cargado (para que "sin comprobante" siempre signifique eso); (d) el pago manual en **USD** compara contra el equivalente en USD guardado/derivado: no hay integración de cobro en USD (PayU) todavía; (e) el monto recibido, el flag `confirmed_without_receipt` y el admin que validó se guardan en columnas nuevas de `estured_fee_payments` (migración `0050`, solo servidor); **hasta que se aplique la 0050 el código sigue funcionando** y esos tres datos quedan solo en el audit log; (f) la validación manual del fee de **renovaciones** (`RenewalPaymentDetail`) **queda fuera de esta decisión** y mantiene el comportamiento anterior hasta que el dueño decida extenderla; (g) "Rechazar pago manual" (`docs/09` §14.3) sigue sin implementarse.

### Trazabilidad y permisos del panel admin (2026-10-24, DR9)

**Fuente:** auditoría del panel admin (Ciclo 72), pantallas `/admin/activity?tab=logs` y `/admin/users`. Son **supuestos reversibles** (el dueño no los fijó); se cambian en `lib/users/blockPermissions.ts` y `lib/format/auditActionLabels.ts`.

| # | Decisión | Docs actualizados |
|---|---|---|
| DR9 | **(1) Quién puede bloquear a quién.** Solo un `superadmin` puede bloquear/desbloquear a un `admin` o a otro `superadmin`. Un `admin` solo bloquea usuarios **no administrativos** (estudiante, familiar, dueño/staff de residencia, registrado). Nadie se bloquea a sí mismo. Se valida **en el servidor**: el rol del actor sale de la sesión (nunca del formulario) y el del objetivo se lee de `users.primary_role` + `user_roles`; si alguno de los dos es admin/superadmin, el objetivo es "administrativo" (criterio conservador). La interfaz oculta el botón y explica el motivo, pero la regla real es la del servidor. **(2) Log de auditoría legible.** `/admin/activity?tab=logs` muestra **quién actuó** (email del usuario resuelto desde `actor_user_id`; "Sistema" si es job o no hay usuario), la **entidad con nombre** y enlace cuando existe pantalla de detalle (residencia, usuario), y una **etiqueta humana para toda acción** (el código técnico queda solo en un tooltip). Un test de cobertura falla si aparece en el código una acción de auditoría sin etiqueta. Filtros por acción, tipo de entidad y actor (email), además de fecha y origen. El audit sigue siendo append-only. **(3) Usuarios.** La lista muestra nombre (perfil de estudiante/familiar o residencia; si no hay, el email), rol(es) y estado como chips, filtros por rol y estado, total real y paginación de 25. | `docs/05` §5; `docs/09` §17, §26 |

Supuestos pendientes: (a) el email del usuario se muestra en el log porque el panel es solo para admin/superadmin; (b) las entidades sin pantalla de detalle (solicitudes, reservas, pagos, etc.) se muestran por tipo + nombre corto sin enlace; (c) falta decidir si `admin` puede **gestionar** (no solo bloquear) roles de otros admins (hoy solo por script `create-admin.mjs`).


### Equipo de la residencia: dueño y staff (2026-10-24, DR10, opción A)

> **Parcialmente reemplazado por DR11** (más abajo): el staff ya no es "un solo nivel"; el dueño elige sus permisos. Siguen vigentes de DR10 el vínculo por residencia, la pantalla Equipo, la invitación y la auditoría.

**Fuente:** decisión directa del dueño (2026-10-24, "opción A": dos niveles). Protocolo `docs/13` §5: doc primero, código después. La lista exacta de "lo sensible" y la clasificación de cada acción son **criterio conservador del agente** (supuestos reversibles, marcados abajo): ante la duda, la acción es solo del dueño.

| # | Decisión | Docs actualizados |
|---|---|---|
| DR10 | **(1) Dos niveles por residencia, sin permisos finos.** El vínculo `residence_users.role` (`owner` o `staff`, ya existente) decide qué puede hacer cada persona **en esa residencia**; un mismo usuario puede ser dueño de una y staff de otra. **Staff** = trabaja el día a día: solicitudes (revisar, establecer contacto, habilitar el pago a la residencia sin cambios, rechazar, marcar pago recibido), habitaciones y camas, disponibilidad (incluye pausar solicitudes por tipo), residentes (alta, datos, cama, salida, notas, respuesta a "Quiero cambiar" y salida anticipada), renovaciones (crear/enviar oferta, marcar pago recibido), lista de espera, preguntas de la ficha, Soporte (puede abrir casos) y notificaciones. **Solo el dueño**: editar el perfil de la residencia (ver lista abajo), tarifas y condiciones de reserva, política de salida anticipada, enviar o reenviar el perfil a verificación, enviar una propuesta de ajuste de condiciones a una solicitud, ver el reporte PDF del portfolio, sumar otra residencia y **gestionar el equipo**. **(2) Qué es "lo sensible" (el perfil completo es solo del dueño).** El formulario del perfil guarda todo en una sola acción, así que se decidió que **el staff no edita nada del perfil, solo lo ve en solo lectura**: datos básicos y descripción, servicios, áreas comunes, universidades cercanas, reglas y reglamento (PDF), fotos, preguntas de la ficha cargadas en el perfil, tipos de habitación (cantidad, género, baño, características y tarifa), condiciones de reserva (mínimo de estadía, política de ajuste, pago inicial, matrícula, depósito, mes vacío), política de salida anticipada y el envío/reenvío a verificación. Incluye los grupos que hoy pasan por aprobación del admin (`fotos`, `servicios`, `reglas`, `mínimo de estadía`, `tipos de habitación`). La dirección, los documentos y los datos privados del responsable no se editan desde el perfil hoy (los carga el alta o el admin); si se suman a una pantalla, **nacen como solo del dueño**. **(3) Pausar/reanudar la residencia:** no existe una acción del dueño a nivel residencia (solo el admin: `paused_by_admin`); el "pausar solicitudes" por tipo de habitación es parte de Disponibilidad y lo puede hacer el staff. Si algún día se crea la pausa de la residencia entera, es solo del dueño. **(4) Pantalla "Equipo"** (`/residence/[residence_id]/team`, solo dueño): lista de miembros (email, rol, estado, desde cuándo), **invitar por email** con un rol fijo `staff`, invitaciones pendientes con **reenviar** y **cancelar**, y **quitar acceso** a un staff. **(5) Invitación.** Token aleatorio de un solo uso que se guarda **hasheado** (SHA-256), vence a los **7 días**, el email es genérico (nombra la residencia, no incluye datos del dueño ni de nadie más) y el enlace lleva a `/register/staff/[token]`. Reenviar genera un token nuevo (el enlace anterior deja de funcionar) y renueva el plazo. Aceptar exige que la cuenta use **el email invitado**: si ya está en sesión con ese email acepta con un clic; si no, ingresa su contraseña (cuenta existente) o crea una (cuenta nueva, con consentimiento de términos). **No se puede elevar a dueño** (la invitación y el vínculo creado son siempre `staff`; el servidor nunca lee el rol del formulario). Mensajes neutros: un enlace inválido, vencido, usado o cancelado muestra el mismo texto; el dueño recibe el mismo mensaje de éxito exista o no una cuenta con ese email; el formulario de aceptación no distingue cuenta nueva de existente. **(6) Quitar acceso:** solo a un staff activo, con confirmación explícita; pone `is_active=false` e `invitation_status='revoked'` (no borra la fila: queda el historial) y se audita; **el dueño no puede quitarse a sí mismo y la residencia nunca queda sin dueño** (a un `owner` no se le quita el acceso desde esta pantalla). Aislamiento multi-residencia sin cambios: el rol y el vínculo se resuelven por `residence_id` en el servidor, nunca por el rol global de la cuenta ni por el formulario. **(7) Servidor.** `getResidenceMembership` / `assertResidenceOwner` (`lib/residences/access.ts`) y la matriz pura `lib/residences/permissions.ts`; toda acción solo-dueño rechaza al staff en el servidor con «Esta acción la puede hacer solo el dueño de la residencia.». La interfaz oculta o deja en solo lectura (con la nota «Solo el dueño puede editar esto») lo que el staff no puede, pero la regla real es la del servidor. **(8) Auditoría y avisos.** Se auditan invitar, reenviar, cancelar, aceptar y quitar acceso (`team_invitation_*`, `team_member_removed`); el invitado recibe el email; el dueño recibe aviso in-app + email genérico cuando la invitación se acepta; el staff al que se le quita el acceso recibe un aviso in-app. Los avisos de verificación (`changes_requested`, `verification_approved/rejected/expiring`) pasan a ir **solo al dueño** (el staff no puede actuar sobre ellos). | `docs/05` §4.6, §4.7, §5, §7.5, §11.3, §14bis; `docs/06` §8.2, §8.2bis; `docs/08` §3.3, §7.19, §7.20; `docs/11` §7.3 |

**Clasificación de las acciones de escritura del área de residencia (auditoría Ciclo 73):**

| Acción (server action / ruta) | Quién |
|---|---|
| Solicitudes: `markUnderReview` (revisar), `establishContact`, `enableResidencePayment`, `rejectApplication`, `markResidencePaymentReceived` | Dueño y staff |
| Solicitudes: `sendNegotiationProposal` (propuesta de ajuste de condiciones, 1 por solicitud) | **Solo dueño** |
| Habitaciones: `renameRoomAction`, `setBedStatusAction`, `assignStayToBedAction` | Dueño y staff |
| Disponibilidad: `updateAvailabilityAction` | Dueño y staff |
| Residentes: `createResidentStayAction`, `updateStayDetailsAction`, `assignBedToStayAction`, `endResidentStayAction`, `endResidentStayEarlyExitAction`, `addResidentNoteAction`, `respondStayChangeIntentAction` | Dueño y staff |
| Renovaciones: `createRenewalOfferAction`, `sendRenewalOfferAction`, `markRenewalResidencePaymentReceivedAction` | Dueño y staff |
| Lista de espera: `notifyWaitlistAvailabilityAction`, `removeFromWaitlistAction` | Dueño y staff |
| Preguntas de la ficha: `moderateFaqQuestionAction` (responder, ocultar, restaurar) | Dueño y staff |
| Soporte: `openResidenceSupportCase` | Dueño y staff |
| Notificaciones (campana): marcar leídas | Dueño y staff |
| Perfil: `saveResidenceProfile` (guardar borrador, guardar cambios, enviar/reenviar a verificación) | **Solo dueño** (el staff ve el perfil en solo lectura) |
| Reporte PDF del portfolio (`/residence/dashboard/pdf`) | **Solo dueño** (solo incluye las residencias donde la persona es dueña) |
| Sumar otra residencia (`addResidence`) | **Solo dueño** (ya exigía el rol `residence_owner`) |
| Equipo: invitar, reenviar, cancelar invitación, quitar acceso (`/team`) | **Solo dueño** |
| Aceptar una invitación de equipo (`/register/staff/[token]`) | Quien recibió el email (público con el token) |

Supuestos reversibles que el dueño no fijó: (a) **la propuesta de ajuste de condiciones es solo del dueño** (cambia precio, matrícula, depósito o fechas de una reserva: es "tarifas y condiciones de reserva"; `docs/05` §7.5 ya la reservaba al owner salvo permiso explícito); el staff igual puede habilitar el pago con las condiciones originales o rechazar; (b) **habilitar el pago a la residencia sin cambios** es parte de la revisión y lo puede hacer el staff; (c) **todo el perfil es solo del dueño**, aunque campos como el eslogan o la descripción no sean sensibles, porque el formulario es uno solo y editar cualquiera puede disparar la revisión del admin; se puede abrir más adelante dividiendo el formulario por secciones; (d) **la lista de miembros muestra el email** (la cuenta de staff no guarda nombre: `users` no tiene esa columna); (e) **límite de 10 staff por residencia** (activos + invitaciones pendientes) y **5 invitaciones o reenvíos por hora y por residencia** (cifras de partida, constantes en `lib/team/teamRules.ts`); (f) una invitación vencida no se borra: queda visible como "Vencida" con la opción de reenviarla; (g) quien acepta puede ser una cuenta ya existente de dueño o staff de otra residencia; una cuenta de estudiante, familiar o admin **no** puede aceptar (se pide usar otro email); (h) el rol global `residence_staff` se crea con alcance global (como el resto de las cuentas demo) y **no se revoca** al quitarle una residencia: el acceso real lo da `residence_users`; (i) la auditoría de las acciones del día a día todavía guarda `actor_role = residence_owner` aunque las haga un staff (el `actor_user_id` sí es el correcto): unificar el rol del actor en esos registros queda pendiente; (j) los **cuatro presets** de `docs/05` §4.7 (`staff_viewer`, `staff_applications`, `staff_operations`, `staff_renewals`) y `staff_manager` quedan como **evolución futura**, no se implementan: `residence_users.permissions` (jsonb) se conserva sin uso para eso; (k) **migración `0051`** (`residence_team_invitations`): escrita y **sin aplicar**; hasta que se aplique la pantalla Equipo funciona (lista de miembros y quitar acceso) pero no se puede invitar (se avisa con claridad).

**Ajustes de revisión y seguridad (Ciclo 73, mismo día; no cambian ninguna regla de producto de DR10):** (1) la auditoría usa el **rol real del vínculo** (`residence_owner` o `residence_staff`) en todas las acciones del día a día y en el historial de la solicitud (`application_status_events.changed_by_role`): el supuesto (i) de arriba queda **resuelto**; la ayuda pura es `residenceActorRole` y un test de cobertura impide volver a escribir `residence_owner` a mano; (2) `createRenewalOffer` valida en el servidor que la solicitud de renovación sea **de esa reserva y esté abierta** (`created_by_student` o `notified_to_residence`), y mueve su estado con un update condicional con chequeo de filas; (3) límites de invitación: **espera de 10 minutos entre dos envíos de la misma invitación**, **tope de 5 envíos por invitación** y **5 envíos por hora y por residencia contados desde la auditoría** (`team_invitation_sent` / `team_invitation_resent`, no filas); no se invita ni se reenvía si la residencia está en `draft`, `rejected`, `suspended` o `archived` (`rejected` no es un estado técnico de residencia: un rechazo de verificación la deja `suspended`, `docs/04` §13.2); el asunto del email es fijo y **no nombra la residencia** (el nombre va solo en el cuerpo, acotado a ~60 caracteres); tras insertar una invitación se **recuenta** el tope de 10 staff y, si se pasó, se cancela antes de mandar el email; (4) al aceptar se **revalida** que quien invitó siga siendo dueño activo de esa residencia y que la residencia no esté `rejected`, `suspended` ni `archived` (mismo mensaje neutro de enlace inválido); no pueden aceptar cuentas con rol `admin`, `superadmin` ni `student` (un familiar que además es dueño de una residencia sí); (5) si el email de una invitación **no sale**, se avisa («Creamos la invitación pero no pudimos enviar el email. Podés reenviarla.») y, al **reenviar, el token solo se rota si el email salió** (si no, queda todo como estaba y el enlace anterior sigue sirviendo); (6) el PDF responde 403 a quien tiene vínculos activos pero ninguno de dueño y 404 solo si no tiene residencias; (7) la búsqueda del token es por **igualdad del hash en la base** (índice único) con un token de 256 bits: **no hay comparación en tiempo constante** en el código (se sacó `sameTokenHash`, que era código muerto); (8) migración 0051 (sin aplicar): `invited_by` y `accepted_by_user_id` pasan a ser nullables con `on delete set null`; una invitación pendiente cuyo `invited_by` quedó nulo ya no se puede aceptar. **Pendientes de decisión del dueño (no tocados):** (a) si el staff puede crear ofertas de renovación con precio, depósito y matrícula mientras la propuesta de ajuste es solo del dueño (hoy el staff las crea: coherencia a revisar; con DR11 se controla con `renewals.manage`); (b) control de edad (mayor de 18) al crear la cuenta de staff por invitación; (c) regla de WAF de Vercel para `POST /register/staff/*` y `/login` y un limitador persistente (hoy el limitador de aceptación es en memoria, por instancia); (d) formato y dominio del remitente de email (hoy el sandbox de Resend solo entrega al dueño de la cuenta Resend).

### Permisos del staff elegidos por el dueño (2026-10-24, DR11)

**Fuente:** decisión directa del dueño (2026-10-24). **Reemplaza** de DR10 lo que decía qué puede hacer el staff: los puntos (1) "dos niveles por residencia, sin permisos finos", (2) "el perfil completo es solo del dueño" y el supuesto (j) (presets fijos como evolución futura). **Se mantiene** de DR10 todo lo demás: el vínculo y el rol por residencia, la pantalla Equipo solo del dueño, la invitación (token hasheado, 7 días, un solo uso, mensajes neutros), quitar acceso, la auditoría y los avisos. Protocolo `docs/13` §5: doc primero, código después.

| # | Decisión | Docs actualizados |
|---|---|---|
| DR11 | **(1) El dueño elige, staff por staff, qué acciones puede hacer.** Los permisos viven en `residence_users.permissions` (jsonb, ya existente desde la 0003; **no hace falta migración para los permisos**), **por miembro y por residencia**: la misma persona puede tener permisos distintos en dos residencias. El dueño siempre puede todo. **(2) Los 10 permisos y su valor inicial** (aprobados por el dueño): `applications.review_contact` revisar solicitudes y establecer contacto (**sí**); `applications.reject` rechazar solicitudes (**sí**); `payments.residence` habilitar el pago a la residencia y marcar pago recibido (**sí**); `applications.send_adjustment` proponer un ajuste de condiciones, que cambia precio o fechas (**no**); `operations.rooms_availability` habitaciones, camas y disponibilidad (**sí**); `residents.manage` residentes: altas, salidas, notas y responder "Quiero cambiar" y salidas anticipadas (**sí**); `renewals.manage` renovaciones: crear y enviar ofertas, marcar el pago (**sí**); `waitlist.manage` lista de espera (**sí**); `faq.manage` preguntas de la ficha: responder, ocultar, restaurar (**sí**); `profile.edit` guardar el perfil, las tarifas y las condiciones de reserva (**no**). **(3) Siempre disponible para todo staff activo, sin casillero:** ver el panel y las pantallas en solo lectura, abrir un caso de Soporte y recibir notificaciones. **(4) Solo el dueño, NO delegable:** gestionar el equipo y los permisos, sumar otra residencia, **enviar o reenviar el perfil a verificación** (aunque el staff tenga `profile.edit`: guarda, pero no envía) y el reporte PDF del portfolio. **(5) Valores de partida y compatibilidad.** Una clave **ausente** vale el valor inicial de la lista: los staff creados **antes** de DR11 (sin permisos guardados) conservan exactamente lo que ya hacían, salvo los permisos 4 y 10 que nunca tuvieron y quedan apagados. **Falla cerrado:** una clave desconocida, un valor que no sea booleano o un error de lectura **no habilitan nada**. **(6) Atajos** (solo rellenan los casilleros, el dueño después ajusta y guarda; reemplazan a los 4 presets fijos de `docs/05` §4.7): «Solo lectura» (todo apagado), «Atención de solicitudes» (1, 2, 3, 8 y 9 encendidos) y «Operación completa» (todo encendido salvo 4 y 10). **(7) Servidor.** Cada acción delegable valida con `assertResidencePermission(admin, userId, residenceId, permiso)` (`lib/residences/access.ts`): el rol y los permisos salen **siempre de la base, por residencia**, nunca del formulario; mensaje «No tenés permiso para esta acción. Pedíselo al dueño de la residencia.» Lo no delegable sigue con `assertResidenceOwner` («Esta acción la puede hacer solo el dueño de la residencia.»). La lógica pura está en `lib/residences/permissions.ts` (lista tipada con etiqueta, descripción y valor inicial; `can`; atajos) y un test de cobertura falla si una acción de escritura de `app/residence/**`, `lib/residences/**`, `lib/residents/**`, `lib/renewals/**`, `lib/waitlist-entries/**` o `lib/availability/**` no tiene su control documentado. La auditoría de las acciones guarda el permiso usado en `new_value.permission` cuando la acción ya registra un `new_value`. **(8) Pantalla Equipo.** Cada staff tiene un panel «Permisos» (casilleros agrupados con su descripción, atajos, «Guardar permisos»); **al invitar** el dueño elige los permisos iniciales (casilleros con los valores por defecto y los atajos), que viajan en `residence_team_invitations.permissions` (jsonb, columna agregada a la 0051 **sin aplicar**) y se copian al vínculo al aceptar; si la columna no existe todavía, solo se puede invitar con los valores por defecto (guardar otros no sería posible y aplicar los por defecto en silencio podría dar **más** permisos de los elegidos). Cambiar permisos exige ser dueño, audita (`team_permissions_changed`, con las claves que cambiaron) y le avisa al staff con un aviso in-app genérico («El dueño actualizó tus permisos en {residencia}»). El dueño no se edita permisos a sí mismo ni a otro dueño (no aplica). **(9) Interfaz del staff.** Lo que no puede hacer se muestra **deshabilitado con una nota** («Pedile este permiso al dueño.») en vez de ocultarse; lo no delegable (Equipo, Sumar residencia, PDF) sigue oculto. Un resumen discreto «Tus permisos» en el Panel le muestra al staff qué puede hacer. Los botones deshabilitados no son seguridad: el servidor decide. | `docs/05` §4.7, §5, §21, §22; `docs/06` §8.2, §8.2bis; `docs/08` §3.3, §7.20; `docs/11` §7.3 |

**Qué permiso exige cada acción (reemplaza la tabla de DR10):**

| Acción (server action / función) | Permiso |
|---|---|
| Solicitudes: `markUnderReview`, `establishContact` | `applications.review_contact` |
| Solicitudes: `rejectApplication` | `applications.reject` |
| Solicitudes: `enableResidencePayment`; pago: `markResidencePaymentReceived` (`recordResidencePaymentReceived`) | `payments.residence` |
| Solicitudes: `sendNegotiationProposal` (y la pantalla `/negotiation`) | `applications.send_adjustment` |
| Habitaciones: `renameRoomAction`, `setBedStatusAction`, `assignStayToBedAction` (también desde Residentes); Disponibilidad: `updateAvailabilityAction` | `operations.rooms_availability` |
| Residentes: `createResidentStayAction`, `updateStayDetailsAction`, `endResidentStayAction`, `endResidentStayEarlyExitAction`, `addResidentNoteAction`, `respondStayChangeIntentAction` | `residents.manage` |
| Renovaciones: `createRenewalOfferAction`, `sendRenewalOfferAction`, `markRenewalResidencePaymentReceivedAction` | `renewals.manage` |
| Lista de espera: `notifyWaitlistAvailabilityAction`, `removeFromWaitlistAction` | `waitlist.manage` |
| Preguntas de la ficha: `moderateFaqQuestionAction` (responder, ocultar, restaurar) | `faq.manage` |
| Perfil: `saveResidenceProfile` con `intent = draft` (guardar) | `profile.edit` |
| Perfil: `saveResidenceProfile` con `intent = submit` (enviar/reenviar a verificación) | **Solo dueño** |
| Soporte: `openResidenceSupportCase`; notificaciones; ver panel y pantallas | Todo staff activo (sin casillero) |
| Reporte PDF; sumar otra residencia; Equipo (invitar, reenviar, cancelar, quitar acceso, **cambiar permisos**) | **Solo dueño** |

Supuestos reversibles que el dueño no fijó: (a) **«cambiar la cama de un residente» (`assignStayToBedAction`, también desde la pantalla Residentes) exige `operations.rooms_availability`**, no `residents.manage`: es parte de "habitaciones y camas"; un staff con residentes pero sin habitaciones puede cargar y dar de baja residentes pero no ubicarlos; (b) **«Liberar plaza» desde Habitaciones cierra la estadía** y por eso exige `residents.manage` además de ver las camas; (c) **guardar el perfil con `profile.edit` incluye todo el formulario** (también los grupos que pasan por aprobación del admin: fotos, servicios, reglas, mínimo de estadía y tipos de habitación; la política de salida anticipada; las preguntas de la ficha cargadas en el perfil), porque el formulario guarda todo en una sola acción; enviar a verificación sigue siendo solo del dueño; (d) los avisos de verificación (`changes_requested`, `verification_*`) siguen yendo **solo al dueño**; el resto de los avisos del equipo le llega a todo staff aunque no tenga el permiso de actuar (puede ver, no actuar); (e) **no se agrega un permiso de "pausar solicitudes"**: va con `operations.rooms_availability`; (f) la **oferta de renovación** (precio, depósito, matrícula) la crea quien tenga `renewals.manage`, aunque la propuesta de ajuste de una solicitud tenga su propio permiso apagado por defecto: ver el pendiente (a) de los ajustes del Ciclo 73; (g) un cambio de permisos rige **de inmediato** (se leen de la base en cada acción), sin cerrar la sesión del staff; (h) los permisos de un staff **no se borran** al quitarle el acceso: si se lo vuelve a invitar, rigen los de la nueva invitación.


### Copy de planes y voz en la landing y el catálogo (2026-10-25, DR12)

**Fuente:** decisiones directas del dueño (2026-10-25), a partir del borrador de `design-proposals/voz-y-tono/INVENTARIO_COPY.md` §4.2 (que queda superado por esta entrada). **Modifica D8 solo en la comunicación**: en el producto sigue todo habilitado y sin cobro; no hay pantallas de plan (`/residence/[id]/plan` sigue redirigiendo). Protocolo `docs/13` §5: doc primero, código después.

| # | Decisión | Docs a actualizar |
|---|---|---|
| DR12 | **(1) Plan en `/for-residences`: variante B «Hoy, todo sin costo».** Dos tarjetas: **Perfil Verificado** y **Plan Premium** (nombre comercial de Gestión Operativa; no crea funciones nuevas). Badge «Bonificado el 1er año» para las **Residencias fundadoras** (`is_pioneer = true`). Sin precio publicado; el copy dice que **nadie paga sin aceptarlo**. Nunca «período de prueba». **(2) Se quita «Disponibilidad asegurada».** Se mantiene **«Elección de plaza»**, suavizada: el estudiante indica una plaza libre y la residencia confirma; manda el tipo de habitación. **(3) Titular de P11** (inventario de copy): «Menos mensajes, más residencia». **(4) Alcance:** «Primera etapa: Ciudad de Buenos Aires», sin «Próximamente, Latinoamérica». **(5) Badge del catálogo** (`ResidenceCard`, K01): se separa en tres casos: completo → «Lista de espera abierta»; sin actualizar → «Sin lugar informado por ahora»; pausado → sin badge (ya lo dice el `StatusTag`). **(6) Landing de residencias** sin «entre 5 y 10»: se habla de «Residencias fundadoras». **(7) Avisos de Gestión Operativa:** mientras todo esté habilitado y no existan pantallas de plan (D8), **no se envían a la residencia** los avisos de activar, revocar o vencer Gestión Operativa (`lib/jobs/expireOperationalAccess.ts` y afines); el hecho queda en la auditoría. | `docs/00` §6.2 (nota D8), §6.3, §31; `docs/02` §7.21, §15.2; `docs/08` §3.3, §4.3, §4.5 (copy de disponibilidad del catálogo); `docs/20` (acuerdo con residencias) |

**Sin cambios en el modelo:** `operating_mode`, `is_pioneer`, `pioneer_free_access_until` y `has_operational_management_access` quedan igual. El copy del badge del catálogo vive en `components/ui/StatusTag.tsx` (archivo sensible, copy oficial de `docs/08` §4.5): su cambio se aplica con esta decisión como respaldo. Precio, qué pasa después del primer año y desde cuándo corre la bonificación **siguen sin definirse** (no se publican).


### Copy: «respaldo», bloque de no coincidencia y arrepentimiento (2026-10-25, DR13)

**Fuente:** decisiones directas del dueño (2026-10-25), tomadas **antes de la revisión del asesor legal, que sigue pendiente**. Protocolo `docs/13` §5.

| # | Decisión | Docs a actualizar |
|---|---|---|
| DR13 | **(1) «Respaldo/respaldado/respalda» se reemplaza** por «verificable» o «registro/registrado» en home, `/for-students`, Footer y metadatos (entradas H04, H06, H08, H10, H16, H18, H22, S01, S07, S09, S18, S20, T01, T05, T06 del inventario); no se tocan `/terms`, `lib/revocations/copy.ts` ni el resto de usos descriptivos (W22). **(2) Se publica el bloque «Si algo no coincide con lo publicado»** (INVENTARIO_COPY §7.4, sin la palabra «garantía») como componente `components/marketing/WhenSomethingDiffers.tsx` en home y `/for-students`, con la FAQ equivalente de §7.3. **(3) El bloque «Si te arrepentís» (§7.5) NO se publica en la landing.** | `docs/00` §31; `design-proposals/voz-y-tono/INVENTARIO_COPY.md` (§7.4 publicado, §7.5 descartado para landing) |


### Reglamento, FAQ, edad de residentes y seguimiento post-ingreso (2026-10-25, DR14)

**Fuente:** decisiones directas del dueño (2026-10-25); detalle en `docs/IDEAS_DEL_DUENO_2026-10-23.md` §5–§7 y `docs/propuestas/REGLAMENTO_MODELO_Y_FAQ.md`. Protocolo `docs/13` §5: doc primero, código después (no hay migraciones escritas ni código). **El texto legal del reglamento modelo queda sujeto a la revisión del asesor legal, que sigue pendiente.** Lo marcado «supuesto» es reversible (`docs/13` §4).

| # | Decisión | Docs actualizados |
|---|---|---|
| DR14 | **(1) Reglamento.** El estudiante accede al **reglamento completo** de la residencia y **acepta los términos al enviar la solicitud**. La aceptación se guarda **por solicitud**, con versión/hash del reglamento y fecha; los cambios posteriores del reglamento **no afectan** a las solicitudes ya aceptadas. Si la residencia no tiene reglamento propio, se muestra el **modelo** (`docs/propuestas/REGLAMENTO_MODELO_Y_FAQ.md`, Parte A, con multiple choice). Supuestos: la aceptación es un paso obligatorio del envío, distinto de `/terms`; en una solicitud que nace de una propuesta del familiar, la acepta el estudiante al aprobarla (o el familiar vinculado si es menor). **(2) FAQ.** Catálogo **único** de preguntas; cada residencia **elige cuáles mostrar y edita la respuesta** (tabla de catálogo + selección/override por residencia). Reemplaza «catálogo fuera de alcance» de `docs/08` §7.16; se suma a la FAQ libre de D9, que no cambia. **(3) Edad.** Cada residencia define **edad mínima y máxima** de sus residentes, usadas como **filtro de búsqueda**. Piso: **18 años cumplidos**; **menores solo si la residencia lo habilita expresamente**, con un apartado especial para menores (familiar/guardián, DR3b). La edad se calcula **a la fecha de ingreso solicitada**; **sin fecha de nacimiento cargada no se excluye** (y se pide completar el perfil). **(4) Seguimiento.** A los **5 días del ingreso** (inicio efectivo en `resident_stays`): **aviso a la residencia** para que consulte por su cuenta y **encuesta automática de EstuRed al estudiante** (y al guardián si es menor). **La residencia NO ve la respuesta**; solo admin/superadmin; EstuRed decide si comunica algo. Supuestos: una encuesta por estadía; el día 5 cuenta desde `start_date` con la estadía `active`; si la estadía no tiene cuenta de estudiante, solo se avisa a la residencia. **(5) Sin controles de admin (decisión del dueño, 2026-10-25):** ni el reglamento nuevo/modificado ni habilitar menores requieren aprobación del admin; la residencia decide sola y los cambios rigen al publicarse (solo quedan auditados). | `docs/04` §12ter, §20.3, §21.7; `docs/05` §16bis; `docs/06` §4.23–4.24, §8.1, §8.7, §11.5, §15.3, §17.1–17.2, §27.12; `docs/08` §4.4, §4.5, §6.17, §7.16, §8.18 |

**Sin cambios:** la regla de 2 solicitudes activas, el flujo de pago y el fee. La aceptación del reglamento **no** es un contrato ni una garantía de plaza: «solicitud sujeta a confirmación»; EstuRed sigue siendo plataforma intermediaria y las disputas van por Soporte. La respuesta de la encuesta **no** se muestra a la residencia ni se usa para penalizarla automáticamente (cualquier uso posterior en métricas requiere nueva decisión).

### Copy y orden de bloques de las landings (2026-10-25, DR15)

**Fuente:** decisiones directas del dueño (2026-10-25). Solo copy y orden de bloques; sin cambios de reglas, estados ni modelo.

| # | Decisión | Docs a actualizar |
|---|---|---|
| DR15 | **Aplicado.** (1) Home: se quita `WhenSomethingDiffers` (queda en `/for-students`; en la home queda la pregunta frecuente equivalente); `WhatYouPay` pasa a versión corta con enlace a `/for-students#que-pagas`; baja la presencia de «comprobante» en titulares y beneficios (se usa «registro verificable» / «código verificable»). (2) `/for-students`: `StayChangeHighlight` baja antes del FAQ; los 7 pasos se agrupan en 5 fases sin cambiar el orden ni los roles; nuevos títulos del hero y de `FamilyHighlight`; el beneficio de comunidad se reformula según lo que la ficha muestra hoy (quiénes viven ahí, qué estudian, intereses; sin «ritmos de estudio» ni «afinidad», que son «Señales de convivencia», aún en diseño). (3) Beneficio de verificación (home y `/for-students`): se mantiene la aclaración de que el sello no reemplaza consultar condiciones y se suma «Revisamos cada espacio en persona: fotos auténticas, servicios reales y reglas claras.». (4) `/for-residences`: «Quiero cambiar» (sin «semanas»), cobro directo sin comisión sobre la tarifa, tarjeta «Plan Premium bonificado el primer año para Residencias fundadoras» con la nota de precio en letra chica, y beneficio «Conectá con estudiantes afines…» (sin «reducís la rotación»). (5) «Por qué EstuRed» (home): se suman «Costos a la vista» y «Soporte de EstuRed». **No aplicado:** «lugar reservado/asegurado», «Ocupación predecible», «registro oficial», «prioridad… reubicación», reemplazo de la FAQ «¿EstuRed verifica a los estudiantes?» (se mantiene «No» + cada residencia evalúa), «Enviar una solicitud es gratis» (se mantiene) y el gancho «sin garantía propietaria» (pendiente de confirmación del dueño). | `app/(public)/page.tsx`, `/for-students`, `/for-residences`, `components/marketing/*` |
| DR16 | **Regla general (2026-10-25): en las residencias de EstuRed no se necesita garantía propietaria.** La residencia que se suma a EstuRed se compromete a no exigirla como requisito de ingreso. Copy publicado: micro-copy en el hero de `/for-students` y pregunta frecuente «¿Necesito garantía propietaria?» en `/for-students` y home (reemplaza el «gancho» que DR15 dejó pendiente). **Pendiente:** definir cómo se comunica y verifica con las residencias (términos para residencias, reglamento modelo) y revisión legal del asesor. | `app/(public)/page.tsx`, `/for-students`, `docs/propuestas/REGLAMENTO_MODELO_Y_FAQ.md` |
