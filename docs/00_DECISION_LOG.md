# 00_DECISION_LOG.md
# EstuRed — Registro de decisiones consolidadas

Última actualización: 2026-11-25 (DR67: WhatsApp, Google, registro sin contraseña, número desde 11, popup, 15 fundadoras y perfil obligatorio). Anterior: 2026-11-14 (DR48: la residencia abre documentos de residentes y solicitantes con pago habilitado, con registro; DR42–DR47: preapertura, ver `docs/23_PREAPERTURA.md`; DR41: aviso por lote y decisión del estudiante en la lista de espera; DR40: lista de espera con mes y vencimiento automático; DR39: relevamiento lote 3; DR38: documentación de la estadía configurable por residencia; DR37: ficha más corta y con la comunidad al frente; DR36: el dueño borra sus fotos; DR35: checklist de llegada con esenciales; DR33–DR34 config de residencia; DR30: ficha y solicitud en modal; DR29: Fase 2 de Guías, llegada y checklist; DR28: Centro de Guías público en /guias; DR27 costos sin «sin depósito» y comprobante en la home; DR22–DR26 y anteriores en §31)

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
- El pago a la residencia se realiza **fuera de EstuRed**, por los medios que la residencia indique. *(DR63: la residencia indica esos medios en su ficha, «Cobro de la reserva»; el pago sigue fuera de EstuRed.)*
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

> El valor en pesos es referencial, con el dólar blue (valor venta) de hoy. Para el pago de la reserva y el fee EstuRed, queda fija la cotización del día en que se envía la solicitud de reserva. Los pagos posteriores se acuerdan con la residencia.

Con la solicitud ya enviada, el contenido es:

> Estos pesos usan el dólar blue (valor venta) del día en que se envió la solicitud de reserva. Esa cotización queda fija para el pago de la reserva y el fee EstuRed. Los pagos posteriores se acuerdan con la residencia.

En una renovación:

> Estos pesos usan el dólar blue (valor venta) del día en que se creó la oferta de renovación. Esa cotización queda fija para el fee EstuRed.

Este modal debe mostrarse:

- En la ficha de residencia al ver tarifas en ARS.
- En el resumen de solicitud al ver el monto estimado en ARS.
- En cualquier pantalla donde se muestre conversión de USD a ARS.

> **DR72 (2026-11-26):** textos reemplazados. Antes decían que el valor final en pesos se fijaba al pagar.

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
- El pago a la residencia se define en el contacto posterior a la solicitud, fuera de EstuRed. **[Reemplazado en parte por DR63, 2026-11-20]:** la residencia configura cómo cobra la reserva y la solicitud muestra esos medios. El pago sigue ejecutándose fuera de EstuRed, sin custodia. El primer punto sigue vigente para el fee; DR63 (i) propone extenderlo.

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

> **Reemplazado en parte por DR67 (2026-11-25):** se elimina la prohibición de la API de WhatsApp Business. El contacto residencia–estudiante descripto acá sigue igual.

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
| DF6 | **(2026-11-20, complementa DF5)** Las coordenadas de la residencia se **identifican a partir de la dirección** (`address_line` + barrio + CABA) con **Nominatim/OSM**, sin clave (1 req/s, `User-Agent` propio con contacto en `GEOCODER_USER_AGENT`, solo server). Se geocodifica al dar de alta la residencia y a pedido del admin («Ubicar desde la dirección»); el resultado se guarda en `latitude`/`longitude` (ODbL lo permite). El admin puede corregir el pin a mano (carga manual de DF5 sigue vigente). Si el geocoder falla o no encuentra la dirección: no se rompe nada, queda sin coordenada y la ficha cae al centro del barrio. Interfaz `Geocoder` enchufable para cambiar de proveedor. | `docs/15` §23, `lib/geocoding/nominatim.ts` |

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
| DR8 | **(1) Comprobante o override explícito.** El admin solo puede marcar pagado un fee en `pending_manual_payment` **con comprobante subido** (visible en pantalla por el acceso con motivo ya existente, `docs/09` §18.2) o, como **excepción**, con un **override "Confirmar sin comprobante"**: exige motivo de **al menos 10 caracteres** y una **segunda confirmación** explícita, y queda marcado en la auditoría y en el registro del pago (`confirmed_without_receipt`). Sin comprobante y sin override la acción no está disponible y el servidor la rechaza. El override solo vale si **no** hay comprobante cargado. **(2) Monto realmente recibido.** El admin carga **monto recibido + moneda (ARS/USD)**, que el servidor compara con el fee esperado **guardado** (nunca el que mande el cliente): en ARS `fee_amount_ars`; en USD `fee_amount_usd` o, si no está, `fee_amount_ars` ÷ cotización del snapshot (`fee_base_ars` ÷ `fee_base_usd`). **Tolerancia: hasta 1 %** de diferencia es redondeo y no frena el pago (igual se muestra y se audita la diferencia). Si la diferencia **supera 1 %**, el servidor exige un **motivo de al menos 10 caracteres** que la explique y la audita como diferencia. Se guardan el monto recibido y la moneda. **(3) Confirmación explícita** antes de ejecutar: paso previo que muestra las consecuencias ("Se confirma la reserva, se emite el comprobante verificable y se dispara la factura") y un checkbox **"Verifiqué el pago"** obligatorio (también validado en el servidor). **(4) Plazo vencido.** No se puede marcar pagado un fee cuya ventana de pago (`expires_at`) ya venció, salvo **reabrir el plazo** con la acción existente (Actividad → Reservas, `reopenEsturedFeeWindow`, 48 h más). **Enmienda DR64 (d), 2026-11-21 (supuesto del agente, pendiente de ratificación):** un fee en `pending_manual_payment` ya fue informado dentro del plazo, no vence y se valida aunque `expires_at` haya pasado; este punto rige para `pending_payment_method`. **(5) Contexto en pantalla:** plazo de la ventana (vence en / vencido), **pagador** (nombre corto y si es el estudiante o el familiar) y **cálculo del fee** (base USD × porcentaje × tipo de cambio del snapshot, en ARS y USD). **(6) Servidor:** rol admin/superadmin desde la sesión; UPDATE **condicional** por estado (`pending_manual_payment` / `pending_payment_method`) y por plazo no vencido, con chequeo de filas afectadas (evita la doble confirmación); se verifica antes que la reserva esté `pending_estured_fee` y el pago a la residencia esté confirmado; auditoría con quién, monto esperado vs. recibido, diferencia, override sí/no y motivo, **sin datos de facturación**. **(7) Revisión de seguridad (Ciclo 71, supuestos reversibles).** (a) **Diferencia de monto:** fuera de la tolerancia del 1 % el servidor exige además un checkbox explícito **"Acepto la diferencia"** (`accept_amount_difference`) y, con un **piso**: si lo recibido es **menos del 90 %** del esperado (`AMOUNT_FLOOR_RATIO`), **solo un `superadmin`** puede confirmar (un admin operativo debe derivarlo). Si coinciden override sin comprobante y diferencia, el `reason_code` de la auditoría lista ambos (`confirmed_without_receipt,amount_difference`). (b) **Fee `paid` con la reserva sin confirmar:** si tras marcar `paid` falla la confirmación de la reserva, el fee **no se revierte**; se audita `reservation_confirmation_failed_after_fee_paid`, se notifica a los admins y `/admin/payments` (pestaña Cobrados + aviso en Pendientes) marca esos casos con **"Reintentar confirmación"** (acción admin, audita `reservation_confirmation_retried`). `confirmReservationAfterFeePaid` es **idempotente**: exige fee `paid`, confirma con UPDATE condicional de la reserva (`pending_estured_fee`) y si ya estaba `confirmed` devuelve ok sin duplicar comprobante, factura ni disponibilidad. (c) El UPDATE del fee exige el **mismo estado leído, el mismo comprobante por id** (el form envía el `file_id` visto) y plazo vigente o sin plazo. (d) Montos ambiguos (`140.500`, `1,234`, `1,234.5`) se rechazan: se pide escribirlos sin separador de miles. (e) `provider_payment_id` deja de ser legible por la residencia (migración 0050). **Decisión PENDIENTE del dueño:** hoy el comprobante verificable y la Factura C salen por el **fee esperado completo**, no por el monto realmente recibido (si se aceptó una diferencia, ¿se emite por lo recibido?, ¿se exige regularizar la diferencia?). | `docs/04` §8.10; `docs/06` §13.2; `docs/07` §17.4; `docs/08` §8.10; `docs/09` §14.3, §14.5 |

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
| DR17 | **Demostración visual Perfil Verificado vs Plan Premium (2026-10-27).** División de funciones. **Perfil Verificado:** perfil público, disponibilidad por tipo de habitación, solicitudes, Lista de espera, Preguntas frecuentes, Reglamento y Soporte. **Plan Premium (Gestión Operativa):** Habitaciones y plazas, Residentes, Comunidad visible, Elección de plaza y Renovaciones (Renovaciones pasa de Verificado a Premium). Cuando `has_operational_management_access` está apagado, el panel de la residencia remarca esas secciones (etiqueta «Premium» con candado en el menú y el Panel, aviso «Esta función es del Plan Premium» con CTA «Conocé el Plan Premium»); la ruta `/residence/[id]/plan` pasa a ser una página de comparación (sin precio, con CTA de contacto a Soporte). **Es solo remarcado visual: no hay bloqueo real ni precio, las funciones siguen andando y D8 (todo gratis en el MVP) sigue vigente.** Landing `/for-residences` actualizada con la misma división. | `docs/12` §15.3, `docs/06` §2.8, `components/residences/PremiumLock.tsx`, `lib/residences/planFeatures.ts`, `app/residence/[residence_id]/plan/page.tsx` |

### Auditoría del Owner (2026-10-27, DR18)

**Fuente:** `docs/NOTAS_RECORRIDO_2026-10-26.md`, sección «AUDITORÍA DEL USUARIO OWNER» (20 puntos) y «Decisiones del dueño sobre las advertencias del Owner» (6 decisiones). Protocolo `docs/13` §5: doc primero, código después. **Fase 1 = implementada con este registro; fase 2 = decidida, pendiente de implementar.** Nada de lo decidido cambia estados ni la regla de las entidades separadas; el copy sigue sin prometer disponibilidad.

| # | Decisión del Owner | Fase |
|---|---|---|
| 1 | Tipo de propiedad: solo «Residencia Estudiantil» (alta y edición). Las filas viejas no se tocan. | **1** |
| 2 | «Zona» pasa a «Barrio» con los 48 barrios oficiales de CABA (constante `lib/data/caBarrios.ts`; validación server-side; se sigue guardando en `residences.public_area`). El filtro de barrio de `/search` lista solo barrios con al menos una residencia verificada y publicada. | **1** |
| 3 | Ayudas de texto en «descripción detallada» y «frase corta»: qué escribir y qué no (sin repetir servicios/precios, sin teléfonos ni enlaces, sin promesas). | **1** |
| 4 | La edad de residentes (mín./máx./menores) va justo después de los datos básicos de la ficha. | **1** |
| 5 | Servicios y áreas comunes: opción «Otro» personalizado. **Decisión 1:** queda pendiente y NO se muestra en la ficha hasta que un admin de EstuRed lo aprueba o rechaza, con aviso a la residencia (cola de aprobación nueva en admin). | 2 |
| 6 | «Gimnasio» se muestra «Gimnasio / Área para ejercitar»; «Área protegida» suma «(emergencias médicas)». Solo cambia la etiqueta visible; el valor guardado no cambia (`serviceLabel`). | **1** |
| 7 | Características de habitación: se suman «Velador» y «Ropero individual». | **1** |
| 8 | Recomendar sedes a ≤15 cuadras (≈1,5 km). **Decisión 2:** a más de 20 cuadras (≈2 km) solo se alerta al admin (auditoría + campana); la residencia puede guardarla y se muestra. Solo con coordenada propia de la residencia (con el centro del barrio como fallback no se alerta). El filtro de universidad de `/search` usa las sedes que la residencia declaró como cercanas (no calcula distancia). | **1** |
| 9 | Reglas de convivencia: elegir las 5 más importantes; el estudiante consulta/descarga el reglamento completo; sin reglamento, asistente paso a paso con el modelo (extiende DR14). | 2 |
| 10 | FAQ: se recomienda elegir como máximo 10 (las que se ven en la ficha); «Ver todas las preguntas» muestra las elegidas y las respondidas. Leyenda: «cuanto más respondas, más consultas vas a recibir **por EstuRed**» (nunca «consultas directas»). | **1** |
| 11 | Se quitan del catálogo la FAQ de visitas a la residencia (FAQ-01) y la de cómo funciona la comida (FAQ-38): se desactivan, no se borran (migración 0056). | **1** |
| 12 | Se agregan «¿Con quién voy a compartir?» (FAQ-50, texto fijo de EstuRed: lo que se ve hoy no es necesariamente con quienes toca compartir; la asignación depende de múltiples factores) y la explicación del mes vacío (FAQ-51, sin números; **decisión 5**: se cobra solo si la plaza queda realmente vacía, nunca por toda reserva diferida). | **1** |
| 13 | Ocupación en ficha y tarjeta. **Decisión 3:** «capacidad · residentes» (ej. «26 plazas · 24 residentes»), sin porcentaje ni «quedan N»; con Premium es dato real, en Verificado solo capacidad declarada. | 2 |
| 14 | Galería con fotos generales, por área y por tipo de habitación; en la tarjeta pasan las fotos; en la ficha se eligen 5 que rotan. | 2 |
| 15 | Género por habitación: «Sin especificar» solo en individuales; las compartidas eligen masculino/femenino/mixto; un mismo tipo puede tener habitaciones con distinto género; editable luego. | 2 |
| 16 | El pago inicial puede ser solo la matrícula; descuentos sobre la matrícula. **Decisión 4:** el fee (5 %) se calcula sobre lo que paga el estudiante (monto final, con matrícula bonificada o promoción). | 2 |
| 17 | Depósito: ofrecer opciones de monto. | 2 |
| 18 | Mes vacío: explicarlo bien y sumar % manual. **Decisión 5:** solo si la plaza queda realmente vacía; % con presets + campo manual; explicado en ficha y FAQ (la FAQ ya está en fase 1). | 2 |
| 19 | Promociones y descuentos sobre tarifas en cualquier momento del año (ficha «antes/ahora», vigencia, efecto en el fee = monto final). | 2 |
| 20 | Residentes: mensaje modelo y registro/vinculación. **Decisión 6:** botón «Compartir por WhatsApp» que abre WhatsApp con mensaje y link pre-armados, enviado a mano; **sin API de WhatsApp**. Cargado solo con nombre y apellido: «residente sin activar». | 2 |

**Fase 1 adicional (búsqueda):** se quita el filtro de disponibilidad de `/search` (se mantiene el de precio); se agregan filtros por servicios y áreas comunes (los mismos que elige la residencia), por query params `servicios` y `areas`, filtrados en el servidor.

**Dudas abiertas:** FAQ-29 («¿Con quién voy a compartir habitación?», texto de la residencia) convive con FAQ-50; decidir si se desactiva FAQ-29.

**Docs actualizados:** `docs/06` §8.1, §17.1; `docs/05` §16bis.

### DR18 fase 2, tanda 2: galería de fotos y ocupación/capacidad (2026-10-28)

**Alcance:** puntos 13 y 14 de la auditoría del Owner. Protocolo `docs/13` §5: doc primero, código después. No cambia estados, permisos ni la regla de entidades separadas; el copy no promete disponibilidad.

**Galería (punto 14).** Las fotos siguen siendo filas de `files` (`document_type = 'residence_photo'`, bucket `public-residence-media`, mismo flujo de aprobación). La clasificación vive en una tabla nueva `residence_photo_meta` (migración 0059, 1 fila por foto, RLS sin policies: solo service role, igual que `files`). Una foto sin fila de metadatos es «general» y no destacada (las residencias existentes siguen funcionando igual).
- Categoría: `general` · `area` (con área: cocina, baño, patio, terraza, comedor, living/sala común, lavadero, gimnasio/ejercicio, estudio, entrada/fachada, otra) · `room_type` (asociada a un `room_types.id` de la residencia).
- **Destacadas (hasta 5):** la residencia elige hasta 5 fotos de su galería; esas rotan en el hero de la ficha y, junto con el resto, en la tarjeta. Sin destacadas, el hero usa las primeras 5 aprobadas.
- Tarjeta de `/search`: fotos con flechas/puntos accesibles y rotación automática suave; se pausa con hover/foco y se desactiva con `prefers-reduced-motion`. La tarjeta rota las destacadas (o las primeras 5).
- Ficha: el hero rota las destacadas; el visor «Ver todas» agrupa por General / por área / por tipo de habitación.
- Editar categoría, área, tipo y destacada **no pasa por la cola de revisión** (no cambia qué fotos son públicas, solo cómo se ordenan/rotulan; subir fotos nuevas sigue gateado como hoy). Requiere permiso `profile.edit`, validado en el servidor.
- Degradación: si la 0059 no está aplicada, todo se lee como «general, sin destacadas» y el editor avisa que no está disponible.

**Supuestos reversibles:** (a) tope de 5 destacadas = «5 fotos que rotan» del Owner; (b) la edición de metadatos no se gatea; (c) lista de áreas cerrada (la residencia no inventa áreas; el «Otro» personalizado es de servicios y áreas comunes, no de fotos).

**Ocupación y capacidad (punto 13, decisión 3).** Texto «N plazas · M residentes» (singular: «1 plaza · 1 residente»), sin porcentaje ni «quedan N». Plazas = suma, sobre las habitaciones activas, de la capacidad por habitación del tipo (dato declarado, disponible en Verificado). Residentes = estadías vigentes (no inactivas), solo con Premium (`has_operational_management_access`) y solo si hay al menos una cargada (un «0 residentes» sería engañoso mientras la residencia no cargó a nadie); en Verificado o sin dato se muestra solo «N plazas», y sin habitaciones cargadas no se muestra nada. Es una cifra informativa de la residencia, no una promesa de lugar (la disponibilidad sigue viviendo solo en `StatusTag`).

**Docs actualizados:** este registro; `docs/06` (nota de `residence_photo_meta`).

### DR18 fase 2, tanda 3: dinero — matrícula, depósito, mes vacío y promociones (2026-10-28)

**Alcance:** puntos 16 a 19 de la auditoría del Owner (decisiones 4 y 5). Protocolo `docs/13` §5: doc primero, código después. No cambia estados ni permisos, no crea entidades nuevas de pago y mantiene separadas propuesta del familiar, solicitud, negociación, pago a la residencia, fee, reserva, factura fiscal y comprobante. Todo se congela en el snapshot como hasta ahora; las solicitudes ya creadas no cambian. La migración es `0060` (aplicada solo en dev por ahora).

**Principio rector (decisión 4).** El fee (5 %) se calcula sobre lo que paga el estudiante: renta con promoción × meses + matrícula **ya descontada**. El depósito (reembolsable) y el mes vacío contingente quedan fuera de la base.

**1. Pago inicial = solo matrícula (punto 16).** Tercer modo `enrollment_only` junto a `one_month` (default) y `custom_usd`. El pago inicial es la matrícula vigente (ya con descuento). Si la residencia no cobra matrícula o queda en 0 (bonificada al 100 %), cae al primer mes: nunca devuelve 0 ni un monto inventado (mismo criterio que `custom_usd` inválido). En la negociación sigue la matrícula acordada si el original era la matrícula. Sigue siendo lo que el estudiante le paga a la residencia; no es el fee.

**2. Descuento de matrícula (punto 16).** Dos columnas en `residences`: `enrollment_discount_percent` (0–100; presets 25/50/100 + manual) y `enrollment_discount_until` (fecha opcional, inclusive: «50 % hasta el 30/06», «100 % ahora»). Solo con matrícula activa. Vencido = no aplica. El snapshot guarda la matrícula **neta** en `enrollment_fee_usd` (todos los lectores existentes, fee y comprobantes siguen igual) y, aparte, `enrollment_fee_list_usd` y `enrollment_discount_percent` para mostrar «antes/ahora». La matrícula «equivalente a 1 mes» se calcula sobre la tarifa de lista (la promoción de renta no la abarata: los dos descuentos son independientes y no se apilan sobre la misma base).

**3. Depósito con opciones (punto 17).** Opciones: **½ mes**, **1 mes**, **2 meses** de renta de lista del tipo elegido, o monto fijo en USD (lo de hoy). Columna `residences.deposit_mode` (`half_month`/`one_month`/`two_months`; null = monto fijo vía `deposit_usd`). Sigue siendo excluyente con la matrícula (constraint de la 0025 + chequeo equivalente para `deposit_mode`). El snapshot guarda el monto resuelto en `deposit_usd`. Sigue fuera de la base del fee y reembolsable.

**4. Mes vacío (punto 18, decisión 5).** Se explica en ficha, formulario y FAQ-51: **solo se cobra si la plaza queda realmente vacía**, nunca por toda reserva diferida. % de la renta por mes vacío con presets 25/50/75/100 + campo manual (1–100; el dato ya existía como `empty_month_charge_percent`, no hay columna nueva). Supuesto reversible: como no se sabe al solicitar si la plaza va a quedar vacía, el cargo **deja de entrar al snapshot y a la base del fee**; se muestra como «posible cargo» informativo (hasta 3 meses, como hoy) y no suma al total. Cómo se confirma y cobra queda entre estudiante y residencia, sin estados nuevos (el cobro operativo del mes vacío sigue en backlog).

**5. Promociones sobre tarifas (punto 19).** Tabla nueva `residence_promotions`: etiqueta (2–60 caracteres), porcentaje 1–90, alcance (toda la residencia o un tipo de habitación), `starts_on` (default hoy), `ends_on` opcional, `is_active`. Se crean y finalizan desde el perfil de la residencia (permiso `profile.edit`, auditadas) **sin tocar las tarifas de lista**. Regla de vigencia: activa, `starts_on <= hoy <= ends_on` (o sin fin). Si hay más de una vigente para un tipo, **gana la de mayor porcentaje** (no se apilan). La solicitud nueva congela el precio con promoción en `monthly_price_usd` y la tarifa de lista en `list_monthly_price_usd` + `promotion_percent` + `promotion_id` (para «antes/ahora»). La ficha muestra «antes/ahora» con la etiqueta y la vigencia; el fee se calcula sobre el monto final. La negociación parte del snapshot ya congelado (la promoción no se reaplica). Copy: «Promoción vigente hasta…», nunca promete disponibilidad.

**Supuestos reversibles:** (a) matrícula y depósito en meses usan tarifa de lista, no la promocional; (b) mayor promoción gana, sin apilar; (c) mes vacío contingente fuera de la base del fee; (d) tope 90 % en promociones; (e) el descuento de matrícula tiene vigencia opcional por fecha, no por tipo de habitación; (f) la promoción no aplica a renovaciones (`createRenewalOffer` queda como está).

**Degradación:** sin la 0060 todo se lee como hoy (sin descuento, sin promociones, depósito fijo, pago inicial de 2 modos) y el formulario avisa que las opciones nuevas aún no están disponibles.

**Docs actualizados:** este registro; `docs/06` §8.1 (nota de campos nuevos).

### DR18 fase 2, tanda 3: correcciones del dueño (2026-10-28, migración 0061)

**Reemplaza** en la tanda 3 el punto 1 (pago inicial «solo matrícula») y el punto 4 (mes vacío como «posible cargo»). Todo lo demás de la tanda 3 sigue igual.

**A. Pago inicial: la residencia elige qué cobra para confirmar la reserva.** Cuatro opciones: **Primer mes** (default), **Matrícula** (`enrollment_only`), **Depósito** (`deposit_only`, nuevo) y **Monto fijo en USD** (`custom_usd`). La matrícula y el depósito son excluyentes entre sí (0025), así que solo una de las dos puede estar activa. `deposit_only` usa el mismo patrón que `enrollment_only`: el pago inicial es el depósito resuelto para el tipo elegido (monto fijo o meses de renta de lista); si la residencia no pide depósito o el monto queda en 0, cae al primer mes (nunca devuelve 0). En la negociación, si el original era el depósito, acompaña el depósito acordado (0 → primer mes). La migración 0061 amplía el CHECK de `reservation_initial_payment_mode` (sin monto fijo para `deposit_only`). Sigue siendo lo que el estudiante le paga a la residencia; no es el fee ni se fusiona con matrícula/depósito como entidades.

**B. Mes vacío: se cobra, pero solo si es real.** El cargo vuelve al desglose, al snapshot y a la base del fee **solo cuando es un cargo confirmado** por esta regla (la regla del dueño): (1) la reserva es diferida, y (2) en los meses calendario completos entre hoy y la fecha de ingreso (tope `MAX_EMPTY_MONTHS` = 3, los mismos que ya se contaban) el tipo de habitación elegido realmente no tiene ocupación. Ejemplo: hoy octubre, ingreso en diciembre; si noviembre está ocupado, no se cobra. Hoy octubre, ingreso en enero; si noviembre y diciembre están libres, se cobran esos dos meses al % que configuró la residencia (`empty_month_charge_percent`, presets 25/50/75/100 + manual). El cliente nunca manda el monto: el cálculo es el mismo en servidor y en la previa.
- **Cómo se sabe la ocupación futura (investigado):** el único dato confiable es el de Gestión Operativa (Premium): estadías vigentes de `resident_stays` por tipo (con `start_date`/`end_date`; una estadía sin fecha de fin se toma como ocupando), reservas del tipo en estado `pending_estured_fee`, `estured_fee_processing`, `confirmed`, `receipt_pending` o `receipt_issued` que todavía no tienen estadía vinculada (de `start_date` a `start_date + initial_duration_months`), contra la capacidad del tipo (habitaciones activas × capacidad por habitación). Un mes está vacío si las plazas ocupadas en ese mes son menos que la capacidad. `profile_availability` (estado, `available_count`, `available_from`) es declarativa e informativa («a confirmar»): no se usa para cobrar.
- **Supuesto conservador (elegido, reversible):** si NO hay dato confiable (residencia sin Premium, sin capacidad declarada, sin ninguna estadía cargada, o falla la lectura) **no se cobra** y el desglose avisa «a confirmar por la residencia». Nunca se cobra por una estimación.
- El snapshot guarda el cargo confirmado: entra a `fee_base_usd` (igual que la matrícula, no reembolsable) y se muestra «Mes vacío» en el desglose solo si es cargo confirmado; si es «a confirmar» se muestra la aclaración, sin monto y sin sumar.

**C. Copy.** Configuración de la residencia (qué es y cuándo aplica, ejemplo octubre→diciembre/enero), ficha y desglose (InfoTip y proceso de reserva) y FAQ-51 (se actualiza por 0061). Voseo, sin garantías: «puede aplicar», «la residencia lo confirma», nunca «reserva garantizada».

**Docs actualizados:** este registro; `docs/06` §8.1 (nota).

### DR18 fase 2, tanda 3: segunda corrección del mes vacío (2026-10-28, migración 0062)

**Reemplaza** la sección B de «correcciones del dueño» (mes vacío solo con ocupación Premium). Lo demás (pago inicial a elección, copy, estructura de snapshot) sigue.

**Regla (igual para Premium y no Premium).**
1. **La disponibilidad publicada manda.** Si el tipo de habitación tiene disponibilidad publicada (`profile_availability.status = 'available_to_confirm'` y no oculta de la búsqueda), la plaza se considera vacante desde `max(hoy, available_from)` (sin `available_from` = desde hoy). `profile_availability` deja de ser «solo informativa» para este cálculo.
2. **Si hay ocupación real** (Premium: estadías vigentes y reservas vigentes sin estadía vinculada, contra la capacidad del tipo) se usa para **descartar tramos ocupados**: la vacancia empieza el día siguiente al último día en que el tipo estuvo completo antes del ingreso. Sin esos datos rige solo la disponibilidad publicada.
3. **Sin disponibilidad publicada** (estado `full`, `not_updated`, pausas, fila ausente, oculta) o ante un error de lectura: **no se cobra** y el desglose dice «a confirmar por la residencia», aunque haya estadías cargadas (supuesto conservador: ocupación sin disponibilidad publicada no alcanza para cobrar).
4. **Reserva diferida:** el cargo aplica solo si el ingreso (`start_date`) es posterior al inicio de la vacancia. Si el ingreso es el primer día disponible (o antes), no hay mes vacío.

**Medición por tramo, con parciales.** El tramo vacío va desde el inicio de la vacancia hasta el día anterior al ingreso. Se cuentan los **meses completos** (1 c/u, contando desde el inicio de la vacancia, con el día ajustado al fin de mes si hace falta) y el **resto en días**: más de 15 días = 1 mes; de 1 a 15 días = 0,5 mes; 0 días = nada. Se aplica el % de la residencia (`empty_month_charge_percent`, presets 25/50/75/100 + manual) a cada unidad: cargo = unidades × renta mensual (con promoción) × %. Ejemplo: disponible desde hoy (28/10) e ingreso el 1/12 = 1 mes completo + 3 días = 1,5 meses; con el 50 % configurado y renta USD 400, USD 300. Si noviembre está ocupado (Premium), la vacancia empieza el 1/12 y no hay cargo.

**Tope.** Se mantiene `MAX_EMPTY_MONTHS = 3` unidades de mes por reserva (el tope es una protección del estudiante y ya figuraba en la configuración: «hasta 3»). Con la medición por tramo desde hoy, 3 meses cubre ingresos diferidos hasta ~3 meses; sigue siendo decisión de producto si debe ser configurable por residencia o mayor (propuesta: dejarlo en 3 hasta ver uso real).

**Horizonte de ocupación.** La ocupación real se evalúa hasta 400 días desde hoy; un ingreso más lejano queda «a confirmar» (no se estima).

**Mismo cálculo en todos lados.** Servidor (`createApplicationFromRoomType`), previa (`CostBreakdown`), negociación (`recordNegotiationResponse`, recalculado con los datos finales) y pago a la residencia (`recordResidencePaymentReceived`, que reusa el cargo del snapshot ya congelado). El cliente nunca manda el monto. Snapshot: `empty_months_count` pasa a `numeric(3,1)` (admite 0,5) con la 0062; `empty_months_charge_usd` sin cambios.

**Copy.** Formulario de condiciones, ficha/desglose y FAQ-51 (reescrita por 0062) explican la vacancia por tramo con el ejemplo de parciales; voseo, sin garantías.

**Docs actualizados:** este registro; `docs/06` §8.1 (nota).

**Aclaraciones del mes vacío (2026-10-28).** (1) Se mide solo el **tramo vacante inmediatamente anterior al ingreso**: un tramo libre anterior que después se ocupó no se suma (la regla es la vacancia previa al ingreso). Ej.: vacante días 0–19, ocupada 20–40, ingreso día 60 → se miden los días 41–59 (19 días = 1 mes). (2) Los meses se anclan siempre en el día de inicio del tramo, ajustado al fin de mes (31/1 + 1 mes = 28/2 o 29/2; 31/1 + 2 meses = 31/3), sin encadenar. (3) Una estadía vigente sin tipo de habitación deja la ocupación en duda: el mes vacío queda «a confirmar» (no se cobra). (4) La 0062 exige la 0061 completa y verifica que ninguna vista dependa de `empty_months_count`.

### DR18 fase 2, tanda 4: reglamento guiado, residente sin cuenta, «Otro» aprobados, mes vacío en acuerdo/comprobante y «antes/ahora» en /search (2026-10-28, migración 0063)

**Alcance:** puntos 9, 20, 5 (visibilidad), 18 (acuerdo/comprobante) y 19 (tarjeta) de la auditoría del Owner. Protocolo `docs/13` §5: doc primero. No cambia estados ni permisos; propuesta, solicitud, negociación, pago a la residencia, fee, reserva, factura y comprobante siguen separados. La migración es `0063` (aplicada solo cuando el dueño la corra).

**1. Reglamento paso a paso (punto 9, extiende DR14).** El editor del reglamento (`/residence/[id]/regulation`, permiso `profile.edit`, sin cambios de permisos) suma un **asistente guiado** sobre el modelo de EstuRed: un paso por sección, cada artículo se incluye o no (los «sugeridos» vienen marcados) y su texto base en voseo es editable; el nombre de la residencia ya viene completo. Al terminar, el texto (renumerado, con las referencias «Art. N» actualizadas) pasa al editor y se **publica por el flujo de siempre** (versión, hash, auditoría; no hay borrador nuevo). Descarga: **.txt** (cliente) e **imprimir / guardar como PDF** desde una vista imprimible; no se agrega infraestructura de PDF. Supuesto: no se guarda un «borrador del asistente» en servidor (se pierde si se cierra la pestaña antes de publicar). El aviso legal del modelo sigue vigente.

**2. Residente sin cuenta (punto 20).** Se puede cargar un residente **sin mail** con **nombre y apellido** y teléfono opcional (`resident_stays.invite_name`/`invite_phone`, 0063). Queda `pending_activation` y se muestra como «Residente sin activar» (con el nombre solo para la residencia). **Se vincula después:** la residencia le carga el mail (acción `setResidentEmail`, permiso `residents.manage`, solo estadías vigentes sin cuenta ni mail) y desde ahí rige la activación por mail de siempre. «Compartir por WhatsApp» sigue siendo **manual** (enlace `wa.me` con mensaje pre-armado; con teléfono abre ese chat); jamás API de WhatsApp. Unicidad: por mail (como hoy) o, sin mail, por nombre dentro de la residencia (chequeo + índice único parcial). PII mínima: el teléfono son solo dígitos, la auditoría registra que se cargó nombre/teléfono pero no sus valores, nada de esto llega a la comunidad ni a otros roles. Supuesto: sin la 0063 la carga sin mail avisa que no está disponible y la carga con mail sigue igual.

**3. Ítems «Otro» aprobados (punto 5).** Ya aprobados se muestran donde faltaban: tarjetas y **filtros de /search** (aparecen como opciones solo los aprobados presentes en el catálogo) y la vista de la residencia del estudiante, además de la ficha. Pendientes y rechazados nunca se muestran.

**4. Mes vacío en acuerdo y comprobante (punto 18).** Cuando el snapshot tiene un **cargo confirmado** (`empty_months_charge_usd` > 0, cantidad `empty_months_count`, que admite 0,5), la tarjeta de condiciones acordadas y el comprobante muestran la fila «Mes vacío (1,5 meses)» (pesos con el tipo de cambio congelado) y la «Base del fee» aclara que lo incluye. El comprobante congela el cargo al emitirse. Sin cargo confirmado no se muestra nada; sin la 0061 las lecturas degradan.

**5. «Antes/ahora» en la tarjeta de /search (punto 19).** El precio «desde» pasa a ser el mínimo **con promoción vigente** (la de mayor %, sin apilar, entre los tipos que admiten solicitud); si el tipo ganador tiene promoción se muestra la tarifa de lista tachada y «Promoción vigente · −N%». Sin promoción (o sin la 0060) todo queda igual.

**6. FAQ-29 / FAQ-50.** Eran la misma pregunta. Queda **FAQ-29** (editable por la residencia) con el contenido de las dos (aclaración de que lo visible no es necesariamente con quién se comparte + los campos de tipos, compañeros, criterio y pedidos + «solicitud sujeta a confirmación»); **FAQ-50 se desactiva** y sus selecciones pasan a FAQ-29 (0063).

**Docs actualizados:** este registro; `docs/06` (columnas de `resident_stays`); `docs/NEXT_STEPS.md`.


### DR19: vinculación estudiante ↔ estadía con prueba de identidad (2026-10-30, migración 0064)

**Decisión del dueño.** El vínculo entre un estudiante y una estadía de residente (`resident_stays`) se apoya SIEMPRE en una prueba de identidad: (a) un **enlace personal con token** que la residencia le manda, o (b) la **aprobación de la residencia**. Nunca alcanza con que el mail de la cuenta coincida con el `invite_email` cargado. Protocolo `docs/13` §5: doc primero. No cambia estados de `resident_stays` ni permisos (se usa `residents.manage`, DR11); la invitación, la solicitud de vínculo, la solicitud de reserva, el pago, el fee y el comprobante siguen siendo entidades separadas.

**A. Invitación personal (residencia invita a un residente ya cargado).**
1. **Token de un solo uso**, 32 bytes aleatorios (base64url), vence a los **14 días**, regenerable. Se guarda solo el **SHA-256**; el token en claro viaja únicamente en el enlace (patrón de `lib/team/invitationToken.ts`). Vive en una tabla **aparte** (`resident_stay_invitations`, RLS sin policies, sin acceso para `anon`/`authenticated`): no en columnas de `resident_stays`, porque el propio estudiante y su familiar vinculado leen esa fila por RLS. Una sola invitación abierta por estadía; regenerar invalida la anterior.
2. **Enlace** `/register/student?invite=<token>`: muestra solo el nombre de la residencia y el nombre de pila; el mail aparece **enmascarado y bloqueado** (el servidor usa siempre el de la invitación, nunca el del formulario). Si la persona ya tiene cuenta, la pantalla ofrece iniciar sesión y vuelve a `/students/residency/invite?invite=<token>`, que activa con un clic (no se muestra «ya existe una cuenta»). Al terminar el registro/inicio de sesión con token válido, la estadía queda **activa** sin pasos extra.
3. **Canal.** `email`: el clic en el enlace prueba el mail; alcanza. `whatsapp`: el token prueba el teléfono, no el mail; antes de registrar o activar se exige un **código de 6 dígitos enviado al mail** (hash, vence a los 10 minutos, 5 intentos, reenvío cada 60 s). `manual` (sin token): la persona entró por su cuenta; para activar una estadía cargada con su mail se exige el mismo código al mail (**verificación de mail por OTP**); el registro común no cambia.
4. **Mail automático** al cargar un residente con mail (remitente «Residencia X te invita, vía EstuRed», `reply-to` = contacto de la residencia si es un mail; nunca se envía desde el mail de la residencia) y botón **Reenviar** en la lista (regenera el token). **TODO de producción:** el remitente sigue siendo el sandbox de Resend; un dominio verificado es bloqueante (GAPS.md).
5. **WhatsApp:** solo **botón manual** `wa.me` con mensaje pre-armado que incluye el enlace personal (nunca la API de WhatsApp Business). Un botón por persona: al `invite_phone` para quien no tiene mail; el generado en la lista de residentes. Cada generación invalida el enlace anterior.
6. **Corrección de mail.** La residencia puede cambiar el mail de una estadía **sin cuenta vinculada** (hoy solo se cargaba si era nulo): invalida el token anterior y reenvía.
7. **«No vivo ahí / no soy yo».** Desde el enlace la persona puede responderlo sin iniciar sesión; se revoca la invitación y la residencia lo ve en la lista («Dijo que no vive ahí»); puede corregir el mail o regenerar el enlace.
8. **Menores.** Activar la estadía de un menor exige un **familiar/tutor con vínculo activo** (`docs/00` §17); si no hay, se bloquea con un mensaje claro y la invitación no se consume. *Pendiente:* aviso al tutor y flujo de consentimiento específico para la invitación a un menor.
9. **Frenos.** Límites por IP y por token en los intentos (en memoria por instancia, como `verifyRateLimit`; el límite real va en el WAF); mensajes de error accionables que no confirman si un mail existe.

**B. Estudiante alojado que se registra solo («Ya vivo en una residencia»).**
1. En `/students/residency` elige una residencia (solo `verified_active`) y manda una **solicitud de vínculo** (`resident_link_requests`: `pending` / `approved` / `rejected`, con `matched_stay_id`, mensaje corto y marca de si usó el código de casa). Frenos anti-spam: **máximo 3 pendientes por estudiante y 1 por residencia**; no se puede pedir con una estadía vigente.
2. **Código de casa:** código corto por residencia (6 caracteres sin ambiguos) que genera/regenera la residencia (`residence_private_details.house_code`, no legible con anon). El estudiante lo ingresa para ir directo a esa residencia; **igual pasa por aprobación**.
3. La residencia ve la cola **«Solicitudes de vínculo»** en `/residence/[id]/residents` y **aprueba** (la une a una estadía `pending_activation` sin cuenta si la elige, o crea la estadía `active`) o **rechaza**. **Nunca se aprueba sola.** Server action con permiso `residents.manage`, auditoría y aviso in-app al estudiante.
4. **«Mi residencia no está»:** campo simple (nombre + contacto opcional) que se guarda en `missing_residence_requests` y avisa a los admins; sin PII innecesaria (máx. 3 por estudiante).

**C. Invariantes.** Una sola estadía vigente por estudiante (se valida al activar y al aprobar); hash de tokens y de códigos; todo server-side con service role; `getSafeUser` sin cambios; las tablas nuevas de uso interno van a `scripts/sensitive-columns.json`.

**Supuestos reversibles:** TTL de 14 días, OTP de 6 dígitos / 10 min / 5 intentos / 60 s, tope de 3 solicitudes pendientes, alfabeto del código de casa, y que `reply-to` solo se usa si el contacto de la residencia es un mail.

**Docs actualizados:** este registro; `docs/05` §15.1 (y nuevos §15.1bis–15.1ter); `docs/06` (tablas nuevas); `GAPS.md`; `docs/NEXT_STEPS.md`.

### DR20: captación comercial de residencias y nombre «EstuResi» (2026-10-30)

**Decisión del dueño.** (F1) En el contacto con una residencia, EstuRed se nombra **cuando pregunten o, como tarde, en el minuto 2 de la reunión**; nunca se oculta ni se dice «no quiero venderte nada» (lo verdadero es «hoy no te cobramos»). El que contacta se presenta como dueño de Sin Fronteras, y lo dice de entrada (es competencia). (F2) **EstuResi** es el **nombre comercial del módulo de gestión** (habitaciones, residentes, renovaciones) **dentro de EstuRed Premium** (DR17); no es una marca ni un producto aparte, no tiene precio propio (D8) y no se vende como «PMS» ni como «más demanda». (F3) Se **contacta ya**, antes de tener producción, sin prometer fecha de publicación, ocupación ni disponibilidad; producción pasa a ser meta de unas 3 semanas (dominio y mail verificado siguen siendo bloqueantes, GAPS).

**Reglas del contacto.** WhatsApp solo manual desde un número de negocio (app Business, nunca la API); máx. 6 chats nuevos por día; un mensaje por número y por grupo (no escribir a dos sedes por separado); seguimiento a los 3 y 7 días hábiles, luego «Frío» y reintento en abril. Promesas permitidas hoy: perfil verificado en persona, solicitudes ordenadas, comprobante. Contactos con celular personal (p. ej. ficha de Wanna) solo con presentación del conocido.

**Descartado por ahora (no es regla de producto):** niveles de compromiso 1/2/3 (ya existen Verificado/Premium, DR17), tarifa «consultar» (contradice DR4; «desde» sí), señales de convivencia públicas con mínimo 3 y badges de conversión (requieren volumen). **Material:** CRM de 80 fichas CABA (exportado el 2026-10-30) y plan de 30 días fuera del repo.

### DR21: estudiante alojado que se registra sin invitación y «Mi residencia no está» desde el alta (2026-10-30)

**Decisión del dueño.** En «Crear cuenta de estudiante», un bloque opcional «Ya vivo en una residencia» permite (1) elegir la residencia de la lista de las activas (`verified_active`) o (2) si no la encuentra, escribir su nombre en texto libre. La opción 1 reutiliza la solicitud de vínculo de DR19 (`resident_link_requests`, estado `pending`); la 2 reutiliza `missing_residence_requests` (0064) con las columnas de seguimiento de la **0065** (`contacted_at`, `contacted_by`).

**Límites.** (a) La vinculación y el acceso a la comunidad siguen sujetos a la **aprobación de la residencia** (o código de casa + aprobación), igual que DR19: elegir o escribir una residencia no da acceso a nada. (b) Privacidad: se guarda solo el **nombre de la residencia en texto** (2–120 caracteres, espacios colapsados, sin caracteres de control ni `<>`), un contacto institucional opcional (mail/teléfono de la residencia, ≤120) y el id del perfil del estudiante; ningún dato de otros residentes. Tope de 3 avisos por estudiante y límite de intentos por usuario ya existentes. (c) Tabla solo service role (RLS sin policies). (d) Si el aviso falla, **no bloquea el alta**: la cuenta se crea igual y el estudiante puede repetirlo en «Mi residencia».

**Lo que hace EstuRed.** El admin ve en `/admin/residencias-pedidas` las residencias nombradas agrupadas por nombre (cantidad de estudiantes, primera fecha, contacto indicado, estado) y marca «Contactada» tras escribirles **manualmente** (mail o WhatsApp por `wa.me` desde su propio celular) para avisar que ya tienen comunidad activa. **Nunca** API de WhatsApp Business ni envío automático; el texto sugerido no promete disponibilidad ni fechas. El copy usa «Soporte», no «mediación».

### DR22: rediseño de home y registro de residencias en dos pasos (2026-10-31)

**Contexto.** El dueño comparó el rediseño externo `estured-rediseno-standalone.html` con el producto actual y decidió qué se adopta. Protocolo `docs/13` §5: doc primero, código después (nada de esto está implementado).

**A. Home (`/`).**
1. Se mantiene el **hero actual** (buscador + carrusel de ≥5 residencias distintas). Se reescriben **título y subtítulo** para presentar EstuRed y el principal beneficio/dolor que resuelve (**textos a definir con el dueño**). **No** se agrega selector/pestañas por rol («Estudiantes y familias / Residencias») en la home.
2. **Nuevo orden:** hero → «Por qué EstuRed» + «La diferencia» **fusionadas en una sola sección**, con la tabla «Con EstuRed vs. por fuera» (la de la propuesta) → catálogo con tarjetas reales algo más reducidas → proceso (el actual) → «Para quién es» (el actual) → FAQ más corta.
3. Se **quita** de la home la sección «Lo que viene» (MVP).
4. **FAQ:** se mantienen todas las preguntas con respuestas más breves, y se saca la de «garantía propietaria». DR16 sigue vigente; solo deja de estar en la FAQ de la home.
5. **Textos del hero elegidos por el dueño (2026-10-31, opción 1 adaptada):** sobretítulo «Ciudad de Buenos Aires»; H1 «Elegí tu residencia a distancia, sin adivinar.»; subtítulo «Residencias en Buenos Aires, verificadas por EstuRed. Reservá y pagá desde donde estés, sin viajar.»
6. ~~No se afirma «visitada en persona»~~ **Superado el 2026-11-01 por el dueño:** toda residencia publicada se verifica en persona (visita con fecha cargada, DR7), por lo que «verificada en persona» / «visitada en persona» **se puede usar en cualquier texto** que lo necesite (hero, chips, tabla, FAQ, términos, fichas). Sigue vigente: «verificada por EstuRed» como fórmula general, el detalle «Revisamos responsable, ubicación y fotos», y la regla de no afirmar nada de una residencia que aún no pasó la visita. Sin contadores fijos ni promesas de plazo de respuesta.

**B. Otras pantallas.** `/for-students`, `/for-residences` y la ficha de residencia **se mantienen como están construidas**; se descartan las propuestas del rediseño para ellas. Solo se pulirán textos.

**C. Criterio transversal de copy.** Lectura rápida y cómoda; destacar beneficios y la ventaja de hacerlo por EstuRed y no por fuera (evitar bypass); en mobile, comodidad visual y menos scroll vertical. Siguen vigentes las reglas de copy (sin promesas de disponibilidad ni garantías, «Soporte» y no «mediación»; DR12, DR13, DR20).

**D. Registro de residencias: paso intermedio (cambio de reglas de negocio autorizado por el dueño).**
1. En el MVP la residencia **no crea cuenta sola**: deja sus **datos principales** (solicitud de alta).
2. El **equipo de EstuRed** investiga la residencia, **puede armar un borrador de ficha**, coordina una **visita** y **recién ahí entrega la cuenta** y ayuda con el onboarding inicial.
3. Alineación: **DR20** (contacto previo, EstuRed se nombra como tarde en el minuto 2; el contacto manual por WhatsApp/mail sigue igual; este flujo es el camino de entrada para quienes ya fueron contactadas o llegan por la web) y **DR19** (las invitaciones de residentes y el código de casa siguen para residencias ya activas; no cambian).
4. **Decisiones/flujos afectados:** el alta autogestionada actual (`/register/residence`, `/register/staff`) y los CTA «Sumar mi residencia» (home, hero, comunidad, `/for-residences`); la invitación de staff por enlace (DR10/DR11) queda para residencias ya con cuenta; el ciclo de verificación (DR7: programar visita, aprobar/rechazar, vencimiento) y DR5 (pedir cambios) deben encajar con la visita previa a la entrega de cuenta; DR12 («Residencias fundadoras») y el onboarding de residencias nuevas (ciclos 63–65); `/admin/residencias-pedidas` (DR21) puede compartir cola con las solicitudes de alta.
5. **Contador/copy de verificación:** el cambio de copy y del contador de verificación asociado a este flujo también es un cambio de reglas de negocio ya autorizado por el dueño; su redacción exacta está **a definir con el dueño**.

**E. A definir con el dueño (no inventado).** Campos del formulario de solicitud de alta; estados de la solicitud (y su relación con los estados oficiales de `docs/04`); quién del equipo contacta; plazo de respuesta/visita; si el borrador de ficha es visible para la residencia; cómo se entrega la cuenta (invitación por enlace de un uso vs. creación por el admin); textos de hero y de la tabla «Con EstuRed vs. por fuera».

**E1. Campos del formulario de alta (decidido por el dueño, 2026-11-01).** Obligatorios: nombre de la residencia, barrio, nombre del responsable, email, teléfono/WhatsApp. Opcionales: Instagram o web, cantidad aproximada de camas. Sin dirección exacta, precios ni fotos en este paso (se completan en la visita/onboarding).

**E2. Estados de la solicitud de alta (decidido por el dueño, 2026-11-01).** Propios de la solicitud, separados de los estados de residencia (`docs/04`) y del ciclo de verificación DR7: Recibida → En contacto → Visita coordinada → Cuenta entregada, más Descartada. Nombres de implementación a fijar al documentar `docs/04`.

**E3. Entrega de la cuenta (decidido por el dueño, 2026-11-01).** Invitación por enlace personal de un solo uso con vencimiento, generada por el admin tras la visita; la residencia crea su propia contraseña y queda vinculada a su ficha. El equipo nunca conoce ni asigna contraseñas.

**E4. Borrador de ficha (decidido por el dueño, 2026-11-01).** Es interno del equipo; la residencia lo ve recién en la visita y lo edita con su cuenta. No hay vista previa por enlace.

**E5. Alta autogestionada actual (decidido por el dueño, 2026-11-01).** `/register/residence` se reemplaza por el formulario de solicitud de alta (no crea cuenta, sin flag). `/register/staff` se mantiene solo por invitación de una residencia ya activa (DR10/DR11).

**E6. Plazo (decidido por el dueño, 2026-11-01).** Sin plazo declarado: tras enviar, «Recibimos tu solicitud. Te escribimos por mail o WhatsApp para coordinar». Internamente la cola se ordena por antigüedad. Quién del equipo contacta: el administrador/equipo EstuRed (sin asignación por persona en el MVP).

**E7. Contador de verificación (decidido por el dueño, 2026-11-01).** No se muestra en el MVP. Si más adelante se agrega, se calcula desde la base (solo `verified_active`) y se documenta antes.

**DR22 E queda cerrado.** Falta implementar: formulario de solicitud de alta, cola en admin (compartible con `/admin/residencias-pedidas`), invitación de un uso y ajuste de CTAs «Sumar mi residencia».

**Docs a actualizar al implementar:** `docs/04` (si hay estados nuevos), `docs/05`/`docs/06` (tabla de solicitudes de alta), `docs/08` §3 (rutas), `docs/09`/`docs/11` (flujo y copy), `PROJECT.md`, `GAPS.md`.

### DR23: nomenclatura de planes de residencias (2026-11-01)

Decisión del dueño. Se unifica el nombre de los planes en toda la UI y los docs:
- **Plan Gratuito = Perfil Verificado.**
- **Plan Premium = Gestión Operativa**, bonificado el primer año para las Residencias fundadoras (DR12).
- «Gestión Operativa» queda **solo como nombre de las funciones** (habitaciones, plazas, residentes, comunidad, renovaciones), nunca como nombre de plan.
- Banners y candados: «Función Premium · hoy bonificada». No se menciona precio futuro, fecha de fin ni renovación; el primer año se dice como en DR12 / `PLAN_PRICE_NOTE`.
- No cambia la lógica de acceso Premium (D8/DR17).

### DR24: orden por defecto del catálogo (2026-11-01)

Decisión del dueño. El orden «Recomendado» pasa a «disponibles primero»:
- **Grupo 1:** residencias con disponibilidad informada o asegurada (`by_room_type_to_confirm`, `real_by_place`).
- **Grupo 2:** sin disponibilidad actualizada (`not_updated`).
- **Grupo 3:** completas o en pausa (`full`, `paused_by_residence`, `paused_by_admin`).
- Dentro de cada grupo, más recientes primero (`created_at` desc). No se oculta ninguna residencia.
- No se infieren cupos: solo se usa el estado ya calculado que muestra `StatusTag`. Aplica a `/search` y a la home/hero. Los órdenes por precio no cambian.

### DR25: microcopy «a quién se paga y cuándo» en el panel de solicitud (2026-11-01)

Decisión del dueño (variante «pasos visuales»). Bajo el botón de enviar solicitud de la ficha (`RequestPanel`), tres pasos cortos: **1. Enviás la solicitud (gratis)** → **2. Si la residencia avanza, le pagás a ella** (matrícula, seña o depósito) → **3. Pagás a EstuRed el 5% de servicio**. Se mantiene «Toda reserva está sujeta a confirmación». No promete disponibilidad ni plazo de pago; el detalle sigue en «Qué pagás y a quién» (`WhoGetsPaid`). Respeta la regla 3 (pago a residencia y fee son entidades distintas).

### DR30: rediseño de la ficha pública y del flujo de solicitud en modal (2026-11-02)

Decisión del dueño (pedido con referencia de la galería «Ver todas» de Airbnb). Protocolo `docs/13` §5: doc primero, código después. No cambia estados ni permisos; mantiene separadas propuesta del familiar, solicitud, negociación, pago a la residencia, fee, reserva, factura y comprobante. Extiende DR18 (fotos, reglas top 5, mes vacío) y reemplaza el panel lateral de DR25/DR4 por un modal.

**1. Fotos por secciones.** La residencia sube y clasifica las fotos **por sección con nombre** (Living, Cocina completa, Comedor, Dormitorio 1, Dormitorio 2, Baño completo, Exterior, Pileta, «Fotos adicionales»…). Modelo: columnas nuevas en `residence_photo_meta` (migración 0070): `section` (texto 1–40, libre con sugerencias; null = «Fotos adicionales») y `sort_order`. `category/area/room_type` de DR18 siguen valiendo para filtros y como sugerencia de sección cuando `section` es null. Editar sección sigue sin pasar por la cola de revisión (no cambia qué fotos son públicas); subir fotos nuevas sigue gateado. «Ver todas»: arriba «Recorrido fotográfico» con una miniatura por sección (nombre debajo, ancla a la sección) y debajo cada sección con sus fotos en grilla de 2 columnas (1 en móvil angosto si hace falta). Sin la 0070 degrada a la agrupación de DR18.

**2.** Nombre, dirección y todo lo posterior a las fotos hasta «Comunidad» se mantiene.

**3. Orden de la ficha (presentar antes de cobrar).** Fotos → nombre/dirección → **Servicios y áreas comunes en formato horizontal con íconos** → **edad de los residentes** → **reglas de convivencia (las 5 que elige la residencia)** + reglamento para leer y descargar (modal) → «Comunidad» si está activa → **Tarifas** → **Condiciones de admisión** → «Qué pagás y a quién» → «Qué revisó EstuRed» → mapa → FAQ.

**4. Tarifas y condiciones.** Tabla de tarifas compacta (una línea por tipo, hasta 5–6 tipos, sin repetir información —no «Individual» y además «1 persona»— y con íconos descriptivos), con botón «Elegir» que abre el modal de solicitud. Condiciones de admisión: **seis tarjetas fijas, del mismo tamaño y las mismas en todas las residencias** —Para reservar, Matrícula, Depósito, Ajuste de tarifa, Mes vacío, Documentos para admisión—; cada una muestra el dato breve que corresponde (o «No aplica / No cobra») y la explicación detallada al dorso (se toca para voltear/expandir). **Mes vacío:** cobrarlo o no es elección de cada residencia (`empty_month_charge_percent` null = no cobra); la configuración de la residencia lo deja explícito («Cobro mes vacío: sí/no») y la tarjeta dice una de las dos cosas. Explicación (al dorso): «Si reservás con ingreso a futuro y la plaza queda realmente vacía antes de que entres, la residencia puede cobrarte esos meses al % que fijó. Solo aplica si la residencia lo cobra y lo confirma; para el detalle, mirá la pregunta frecuente sobre mes vacío.» Sin promesas de disponibilidad.

**5.** Luego «Qué pagás y a quién» y «Qué revisó EstuRed», el mapa y, al final, las FAQ.

**6. Solicitud en modal.** Se elimina el cuadro lateral sticky. «Elegir» en la tabla abre un modal (en móvil, hoja a pantalla completa): primero **fecha de ingreso y cantidad de meses**; luego, en este orden: (a) **pago inicial a la residencia para reservar** («se abona una vez aprobada la solicitud»; importe final en pesos según el tipo de cambio que aplica la residencia); (b) **total de la reserva** con desplegable de detalle; (c) **fee de EstuRed** (5 % al estudiante); (d) si hay depósito, **depósito** con la leyenda «se abona al ingresar a la residencia». Después «Sobre vos» y el resto del formulario como está. Los cálculos siguen siendo los de servidor (`CostBreakdown`); el cliente no manda montos.

**Supuestos reversibles:** (a) `section` libre con sugerencias, sin catálogo cerrado; (b) las seis tarjetas se muestran siempre aunque no apliquen; (c) el tipo de cambio mostrado es el vigente de `lib/exchange/rate.ts`.
**Docs actualizados:** este registro.

### DR26: Google SSO fuera del MVP (2026-11-01)

> **Reemplazado por DR67 (2026-11-25).** Las condiciones de rol y consentimientos previos siguen vigentes.

Decisión del dueño. El registro e ingreso siguen con email y contraseña (mínimo 8 caracteres, sin endurecer). Google SSO queda como idea futura: exigiría un callback que asigne el rol (estudiante/familiar) y registre los consentimientos de términos y privacidad antes de crear la cuenta; las residencias y el staff siguen entrando solo por invitación. Se retoma después del lanzamiento si la fricción del registro lo justifica.

> **Nota (2026-11-08, DR43):** la preapertura contempla una variante **con** y otra **sin** botón «Continuar con Google»; el diseño muestra el botón «si existe». DR26 sigue vigente: no hay OAuth en el código y no se implementa salvo decisión expresa del dueño (pendiente). Si se implementara, aplican las condiciones de arriba (rol y consentimientos antes de crear la cuenta; con Google la fecha de nacimiento 18+ se pide aparte).

### DR27: costos sin la aclaración «sin depósito» + comprobante en «Por qué EstuRed» (2026-11-02)

Decisión del dueño. (1) En el copy de costos de landings y ficha no se aclara «sin depósito» / «sin contar el depósito» / «nunca sobre el depósito»; la aclaración vive solo en las FAQ y en los términos (`/terms`). El cálculo no cambia: el fee es 5% de la estadía inicial y nunca incluye el depósito reembolsable. (2) En la home, «Por qué EstuRed» reemplaza la tarjeta «Qué revisamos» (repetía «Visitadas en persona») por una miniatura del Comprobante de Reserva Confirmada, armada con las mismas filas que la pantalla y el PDF reales, con datos de ejemplo rotulados.

### DR28: Centro de Guías público (2026-11-02)

Decisión del dueño.
- **Qué es:** guías editoriales públicas (sin login) en `/guias` (hub) y `/guias/[slug]`. Seis guías iniciales: elegir residencia, mudarte a Buenos Aires, errores comunes, estudiar y convivir, familias y operadores de residencias.
- **Contenido:** archivos Markdown con frontmatter en `content/guias/` (soltar un `.md` nuevo publica una guía, sin tocar componentes). Texto editorial neutral y multi-residencia: no habla en nombre de ninguna residencia, sin testimonios, cifras ni fechas de revisión no verificadas, sin «mediación» (se dice «Soporte»).
- **CTAs:** solo a rutas que existen (`/search`, `/for-residences`, `/for-students`, `/register`, otras guías); si la ruta no existe, el CTA se oculta.
- **Fase 1:** contenido + SEO (metadata, canonical, JSON-LD `Article` y `BreadcrumbList`, sitemap) + enlaces contextuales desde home, buscador, fichas y dashboards.
- **Fase 2:** ver DR29 (cuenta regresiva y checklist en el lote 2A; alertas por mail/notificación en el lote 2B, pendiente de confirmación). WhatsApp solo como botón manual, nunca la API.

### DR29: Fase 2 del Centro de Guías — llegada, cuenta regresiva, checklist compartido y alertas (2026-11-02)

Decisión del dueño. Amplía DR4 (qué ve el familiar vinculado) y completa la Fase 2 de DR28.
- **Lote 2A (implementado):**
  - **Cuenta regresiva «Tu llegada»:** el estudiante con reserva confirmada y fecha de ingreso futura ve los días que faltan (en días enteros, con «Mañana» y «Hoy»), la residencia y la fecha. El familiar con vínculo ACTIVO aprobado ve lo mismo de su familiar (nombre corto, residencia, fecha de ingreso). Esto amplía DR4: el familiar activo ve la llegada, y recibirá los avisos t7/t2 (lote 2B).
  - **Checklist de llegada con casillas, persistido en DB** (tabla `arrival_checklist_items`, migración 0068, una fila por reserva e ítem tildado). Lo tilda solo el estudiante dueño de la reserva; el familiar vinculado activo lo ve en **solo lectura** (progreso) y tiene acceso a las guías. El catálogo de ítems es estático en código (`lib/arrival/checklist.ts`), genérico y sin datos de trámites, horarios ni teléfonos; no promete disponibilidad. Es más completo que la checklist de la guía y el dueño lo irá puliendo.
  - **WhatsApp:** solo botón manual «Copiar mensaje» / «Abrir WhatsApp» (`wa.me` con texto pre-armado). Nunca la API de WhatsApp Business.
  - Hasta que se aplique la migración 0068 la UI degrada: muestra el checklist en solo lectura, sin tildes persistentes.
- **Lote 2B (PENDIENTE de 2 confirmaciones del dueño: ¿se permite opt-out de los avisos? ¿es esta la cadencia?):** alertas in-app y por mail a 14/7/2/0 días del ingreso para el estudiante y a 7/2 días para el familiar activo; las manda el cron horario existente; migración aparte con tabla de envíos con unicidad por reserva + destinatario + aviso + canal; no se envía antes de las 9:00 (hora de Argentina); solo para reservas `confirmed`/`receipt_pending`/`receipt_issued`; el mail real depende de que el dominio de Resend esté verificado. No se implementa hasta resolver las dos confirmaciones.
- **Lote 2B (implementado, migración 0069 aplicada en dev, pendiente en prod):** el estudiante NO puede desactivar los avisos (sin preferencias); cadencia estudiante 14/7/2/0 y familiar activo solo 7/2; nunca antes de las 9:00 de Argentina; in-app siempre y mail solo con `EMAIL_DOMAIN_VERIFIED=true` (Resend con dominio verificado). **Sin catch-up** (cadencia cerrada: si un día falla el cron, ese aviso no se recupera). **La 0069 hay que aplicarla en dev y en prod.** Código: `lib/jobs/notifyArrivalReminders.ts`, `lib/arrival/reminderPlan.ts`, `lib/arrival/reminderCopy.ts`; tabla `arrival_reminder_sends` (unique por reserva + destinatario + aviso + canal).

- **DR31 (2026-11-02) — `/waitlist` retirada (resuelve H30):** la lista de espera de pre-lanzamiento redirige a `/search` (redirect temporal en `next.config.ts`). La página, la acción y los datos de `waitlist_signups` siguen intactos; se revierte quitando la línea del redirect. **Actualización 2026-11-12 (dueño):** se borró el código (página, form, action y `lib/waitlist/submitWaitlistSignup.ts`); quedan el redirect y la tabla `waitlist_signups` (la cuenta el dashboard admin). Revertir = restaurar esos archivos desde git. El estado vacío de la home ya no ofrece «dejar mi mail».

### DR32: confirmación del tutor para la estadía de un menor (2026-11-02, migración 0071)

**Decisión del dueño.** Cuando se vincula la estadía de un estudiante **menor de 18** (flujo DR19, punto A.8, o aprobación de la residencia, punto B.3), la estadía queda **pendiente de confirmación** hasta que el familiar/tutor con vínculo **activo** la confirme desde su inicio (`/students/dashboard`, vista familiar). Completa el «Pendiente» de DR19 A.8. No cambia estados de `resident_stays` ni permisos de la residencia (DR11); el consentimiento del tutor es una entidad aparte (`guardian_stay_confirmations`), separada de invitación, solicitud de vínculo, reserva, pago y fee.

**Reglas.**
1. **Cuándo.** Solo si `student_profiles.is_minor` y hay tutor con vínculo `active` (sin tutor sigue bloqueado, DR19 A.8). El menor pasa la prueba de identidad de DR19 (enlace/OTP) y recién ahí se crea la confirmación; la invitación **no se consume** mientras tanto. Una sola confirmación pendiente por estudiante.
2. **Mientras está pendiente la estadía NO existe:** no se vincula `student_profile_id`, no hay comunidad, ni seguimiento post-ingreso, ni la residencia ve al menor como residente. La residencia sigue viendo la estadía como «pendiente de activación» (o la solicitud ya resuelta); **no ve al tutor ni su decisión**. El menor ve «Esperando la confirmación de tu familiar» y puede seguir usando EstuRed como siempre (solicitudes, propuestas) — la confirmación solo gobierna la estadía.
3. **Confirmar** (solo el tutor con vínculo `active` en ese momento, validado server-side; no el menor, no un familiar con vínculo revocado/pendiente): ejecuta el vínculo (estadía `active`, invitación usada, vínculo a reserva si falta, auditoría) con las mismas condiciones de DR19 revalidadas (una estadía vigente por estudiante, estadía aún libre, invitación no revocada ni rechazada). Si algo cambió, se cancela con aviso claro.
4. **Rechazar** («No es correcto»): no se vincula nada; la invitación sigue abierta (hasta su vencimiento) y el menor puede pedirla de nuevo; se avisa al menor («Tu familiar no confirmó la estadía») sin motivos. La residencia no recibe aviso.
5. **Vencimiento a los 7 días** *(confirmado por el dueño)*: pasa a `expired`, no se activa nada solo, se avisa al menor y al tutor; recordatorio al tutor a los 3 días. El menor puede repetir el pedido.
6. **Aviso al tutor:** in-app siempre y mail solo si `EMAIL_DOMAIN_VERIFIED=true` (remitente sandbox de Resend, DR19 A.4). El mail y la notificación dicen solo «[Nombre I.] pidió vincular su estadía en [residencia]. Confirmala o decí que no es correcta» + enlace al inicio; sin datos de contacto ni fechas de nacimiento.
7. **Copy:** cero promesas de disponibilidad ni garantías; «Soporte», nunca «mediación».
8. **Privacidad (DR4/DR29/docs/10 §9):** el tutor ve nombre corto + residencia y nada más de la estadía antes de confirmar; la tabla la leen por RLS solo el estudiante y su familiar activo; escribe solo el servidor.

**Solicitud de vínculo de la residencia:** si el pedido viene de una aprobación (B.3) y el tutor rechaza, vence o se cancela, la solicitud pasa a `rejected` (nota «El familiar no confirmó la estadía.») para que el menor pueda volver a pedirla.

**Verificación del mail del familiar y responsabilidad declarada (decisión del dueño, 2026-11-02, migración 0072).** La auditoría detectó que un menor podía registrar una cuenta «familiar» con un mail inventado, aprobar él mismo el vínculo y confirmarse solo. Se adopta: (1) **código de 6 dígitos al mail del familiar** (hash, 10 min, 5 intentos, reenvío cada 60 s; tabla `family_email_verifications`); el estudiante **no puede aprobar** un vínculo hasta que el familiar lo verifique (rechazar siempre se puede); (3) **responsabilidad declarada:** EstuRed no puede probar que el familiar sea adulto o tutor; quien se registra como tal lo declara y asume esa responsabilidad (texto en términos: pendiente), y el alcance legal del consentimiento sigue sujeto a la revisión de `docs/10` §9.6. Descartada por ahora la revisión manual de Soporte del primer vínculo de un menor (se reabre si la asesoría legal lo pide). Límite honesto: el código prueba el control del mail, no la identidad. Hasta tener dominio verificado en Resend (GAPS), el mail del código solo llega al dueño de la cuenta de Resend, igual que DR19.

**Supuestos reversibles (docs/13 §4):** 7 días de plazo, recordatorio a los 3, la residencia no se entera del rechazo ni del vencimiento, la invitación sigue abierta tras rechazo/vencimiento.

**Docs actualizados:** este registro; `docs/04` §16.4; `docs/06` (tablas nuevas); `docs/10` §9.1bis; `GAPS.md`.

### DR33: disponibilidad por tipo y género, gestionada solo desde Disponibilidad (2026-11-03, migración 0075)

**Decisión del dueño.** La disponibilidad se informa **por tipo de habitación y género** («Dobles masculinas / femeninas / mixtas»), calculada desde las habitaciones y camas ya cargadas (con su género); la residencia solo confirma o ajusta.

**Reglas.**
1. **Un solo lugar:** la disponibilidad se gestiona **solo** en la pantalla Disponibilidad (permiso `operations.rooms_availability`). Habitaciones queda para cada habitación en particular (nombre, género, camas) y ya no edita disponibilidad ni contadores.
2. **Por fila (tipo + género):** estado (disponible / completa / pausada), cantidad, «disponible desde» y nota pública. El valor inicial se sugiere con las camas libres activas del género; la residencia lo ajusta. Las habitaciones sin género se muestran aparte, con aviso para definirlo en Habitaciones.
3. **Resumen por tipo:** `profile_availability` sigue siendo una fila por tipo y se recalcula al guardar (algún género disponible → disponible; todos completos → completa; todos pausados → pausada). Lo que hacen solicitudes, reservas, lista de espera y vencimientos **no cambia** (siguen por tipo). El estado del tipo manda cuando es más restrictivo.
4. **Cara al estudiante:** la ficha muestra cada género con su estado (copy solo de `StatusTag`) cuando el tipo tiene más de uno, y el catálogo ofrece «Doble femenina» / «Doble masculina» por separado. La solicitud sigue siendo por tipo (el género del estudiante no se pide: **supuesto reversible**, sin cambios de flujo).
5. **Contadores automáticos:** una reserva confirmada o la salida de un residente ajustan el contador del TIPO (no saben el género); la pantalla avisa cuando el total del tipo se movió y hay que revisar cada género.

**Docs actualizados:** este registro; `docs/06` §9.4.

---

### DR34: cambio de habitación dentro de la residencia (2026-11-03, migración 0076)

**Decisión del dueño.** Un residente puede pedir cambiar de habitación **dentro de su misma residencia**, y la residencia puede anotar ese pedido por él. La preferencia (tipo, género, piso / nota libre) sirve de **filtro** para encontrar luego a esos residentes. Cuando se libera una plaza que coincide con un pedido pendiente, la residencia se entera **antes** de que se publique como disponible y elige qué hacer. Siempre sujeto a disponibilidad y a los costos que correspondan.

**Reglas.**
1. **Entidad propia (`room_change_requests`):** no es una solicitud, ni una renovación, ni «Quiero cambiar» (cambio de residencia), ni genera pago, fee, reserva ni factura. EstuRed **no cobra nada** en este flujo: solo queda **constancia del texto de costos** que el estudiante reconoció («asumo los costos que correspondan, que me informa y acuerda la residencia»). El copy no promete disponibilidad ni garantías.
2. **Estados:** `pendiente` → `en gestión` (la residencia lo está viendo o ya ofreció una plaza) → `resuelta` o `cancelada`. La residencia mueve pendiente ⇄ en gestión y cierra; el estudiante puede **cancelar** mientras siga abierto. Un solo pedido abierto por estadía. Al terminar la estadía el pedido abierto se cancela solo.
3. **Desde la residencia (Residentes → ficha → «Habitación y cama»):** opción «Solicita cambio de habitación» + preferencia (tipo, género, piso / nota, motivo). Pill de filtro «Piden otra habitación» (con sub-filtros por tipo y género; quien no pidió un tipo o género puntual aparece igual, «me da igual») y búsqueda por la nota. Permiso: `residents.manage` (DR11), sin permiso nuevo.
4. **Desde el estudiante (Mi residencia → «Cambio de habitación»):** botón «Pedir cambio de habitación» con preferencia, motivo y la confirmación del texto de costos. Solo para **su propia estadía activa** (la lee el servidor, no el formulario). El pedido llega a la residencia y aparece en la misma lista y filtro.
5. **Plaza liberada por decidir (`room_change_place_alerts`):** si una plaza se libera (salida de un residente, cambio de cama —queda libre la cama que dejó—, cama o habitación que vuelve a estar en servicio) y coincide con algún pedido **pendiente**, se crea un aviso por decidir y se notifica al equipo con `residents.manage` (campana y mail genérico, sin datos del residente). Mientras está abierto, **la plaza no se publica sola**: en una salida, el +1 automático de disponibilidad del tipo (DR33 pto 5) queda **diferido**. Sin coincidencia, todo sigue como antes. La residencia elige: **ofrecérsela** a un residente que coincide (su pedido pasa a «en gestión» con la plaza y se le avisa; si después se lo reubica en esa cama, el pedido queda resuelto), **ignorar** (cierra el aviso, no publica ni avisa a nadie; la plaza se puede cargar desde Disponibilidad) o **publicar como disponible** (repone el +1 diferido; exige `operations.rooms_availability`, porque toca la disponibilidad).
6. **Coincidencia:** preferencia nula = cualquiera; si pidió género, la plaza tiene que tener ese género (una plaza sin género definido no avisa); no se avisa a quien dejó la plaza ni por pedidos ya en gestión. Una nota libre sola no se puede comparar: se trata como «me da igual» y la residencia la lee en la ficha.
7. **Menores (DR32):** necesitan un familiar vinculado activo para pedir (misma regla que «Quiero cambiar»); el familiar recibe aviso de cada paso. **Supuesto reversible:** no se pide confirmación formal del tutor porque el pedido es dentro de la misma residencia y no cambia contrato ni reserva.
8. **Datos:** auditoría (`room_change_requested`, `room_change_updated`, `room_change_status_changed`, `room_change_cancelled_by_student`, `room_change_place_offered` / `_ignored` / `_published`), RLS fail-closed con lectura por columna, solo service role escribe. El código degrada si falta la migración (sin bloque ni opción; las salidas siguen reponiendo la disponibilidad como antes).

**Interpretaciones a confirmar (reversibles).** «Fuera de servicio» como punto de liberación se interpreta como la **reactivación** de una cama o habitación (hoy no se puede sacar de servicio con residentes). «Ignorar» no publica la plaza (el desvío entre camas libres y el contador se ve en Disponibilidad, DR33). Nunca se publica ni se ofrece una plaza sin que la residencia lo decida.

**Docs actualizados:** este registro; `docs/06` §15.1ter.


### DR35: checklist de llegada — sin solapados y con «Lo esencial antes de viajar» (2026-11-03, sin migración)

**Decisión del dueño.** El catálogo del checklist de llegada (DR29) pasa de 47 a 44 ítems fusionando los que se repetían, y se marcan 10 **esenciales** que se muestran arriba, aparte de las categorías.

**Reglas.**
1. **Fusiones:** `dinero.comprobantes` se funde en `doc.comprobante` («Comprobante de tu reserva y de tus pagos a mano»); `viaje.horario-llegada` en `res.fecha-hora` (confirmar el ingreso con la residencia y compartir el horario con la familia); `llevar.cama-bano` en `res.llevar` («Pregunté qué tengo que llevar»). Las claves retiradas dejan de contar; los tildes guardados de esas claves se ignoran (no se migran).
2. **Esenciales (`essential: true` en `lib/arrival/checklist.ts`):** documento de identidad, requisitos migratorios, autorización si es menor de edad, qué le pago a la residencia y cuándo, monto para imprevistos, dirección exacta de la residencia, persona de contacto del día de la llegada, medicación habitual, cobertura de salud y datos médicos relevantes (la elección final, de 2026-11-03, reemplazó a la primera propuesta: constancia, comprobante, contrato, fecha de ingreso, pasajes y traslado pasaron a las categorías). Se muestran en una sección propia («Lo esencial antes de viajar», abierta por defecto) y los ítems no se repiten en las categorías. La tarjeta suma «Esenciales: X de 10» al progreso general (X de 44).
3. **Sin cambios en los avisos:** los recordatorios de 14, 7, 2 y 0 días (DR29, lote 2B) **no** usan los esenciales.

**Supuestos reversibles.** Cuáles son los 10 esenciales (se eligen por criticidad antes de viajar, no por frecuencia); que los esenciales no cuenten todavía para los avisos; que el estudiante vea el mismo catálogo que el familiar (solo lectura). Si más adelante los avisos pasan a depender de los esenciales, se decide acá primero.

**Docs actualizados:** este registro; `MEMORY.md`; `docs/NEXT_STEPS.md`.

### DR36: el dueño puede borrar sus propias fotos, con piso de 3 aprobadas (2026-11-03, sin migración)

**Decisión del dueño.** El dueño (o staff con `profile.edit`) borra fotos de su galería sin pasar por Soporte ni por el admin. Hasta ahora solo podía pedirlo.

**Reglas.**
1. **Sin aprobación del admin:** borrar nunca muestra contenido sin revisar; la moderación (DR8/docs/09 §8.1) sigue aplicando a lo que se **agrega**.
2. **Piso:** en una residencia **publicada** (`verified_active`) no se puede borrar una foto **aprobada** si después quedan menos de 3 aprobadas (mismo mínimo que para publicar, `MIN_PUBLISH_PHOTOS`). Una foto **pendiente** se borra siempre; en una residencia sin publicar no hay piso. Mensaje: «Tu residencia está publicada y necesita al menos 3 fotos aprobadas. Subí otra y, cuando el equipo la apruebe, vas a poder borrar esta.».
3. **Qué pasa al borrar:** la fila de `files` queda `rejected` (registro; todo el sistema ya excluye ese estado), se borra su clasificación y el archivo del bucket público, y se la saca de la revisión de fotos pendiente (si no queda ninguna foto, la revisión se cancela). Una foto borrada no se puede volver a aprobar (la aprobación solo toca fotos `pending_review`). Auditoría: `residence_photo_deleted`.
4. **UI:** botón «Borrar» en cada foto de la galería con confirmación en línea («¿Borrar esta foto?»). El mensaje del tope de 60 («pedile a Soporte») sigue igual: Soporte ya no hace falta para borrar, pero el copy del tope no se tocó.

**Supuesto reversible.** El piso solo rige en residencias publicadas. Se usa `rejected` y no `archived` para no tocar los filtros existentes (`neq rejected`).

**Seguridad de la subida (mismo día, auditoría `seguridad`):** el tipo de la imagen sale de su firma real (JPEG/PNG/WebP), no del MIME del cliente; la ruta vieja del formulario aplica el tope de 60; las fotos rechazadas por el admin se borran del bucket público.

### DR37: ficha de residencia más corta y con la comunidad al frente (2026-11-03, sin migración)

**Decisión del dueño (relevamiento, lote 2).** La ficha pública se achica y destaca lo que más pesa para elegir.

**Reglas.**
1. **Menú de la ficha:** solo Servicios, Comunidad, Tarifas y condiciones, Ubicación y Preguntas (las secciones Edad y Convivencia siguen en la página, sin entrada propia).
2. **Se quitan de la ficha** «Qué pagás y a quién» y «Qué revisó EstuRed»: ya están explicados en la landing, en el flujo de solicitud y en las preguntas frecuentes (componentes `WhoGetsPaid` y `VerificationScope` eliminados).
3. **Edad promedio actual** en «Edad de los residentes»: solo con comunidad activa (Gestión Operativa) y **más de 10 residentes** con fecha de nacimiento válida; promedio de toda la comunidad vigente, redondeado a años enteros, sin mostrar nunca una edad individual (`lib/residents/averageAge.ts`).
4. **«Ver los N perfiles»** pasa a ser un banner verde con avatares y flecha (es la función central de la ficha), no un enlace de texto.
5. **Condiciones de admisión:** las 6 tarjetas son más chicas (alto fijo) y al tocarlas **giran** (volteo 3D) para mostrar el texto explicativo.
6. **Reglamento descargable en PDF** (A4, formato básico: título, versión o aviso de modelo, artículos con títulos y viñetas, pie con página) en lugar de .txt. El borrador del editor del dueño sigue en .txt.
7. **Nombres cortos de universidades** en tarjetas y ficha (solo presentación; el dato guardado y los filtros no cambian): UBA + especialidad sin «Facultad de» (`UBA Derecho`, `UBA FADU`), sigla cuando la hay (`UCA`, `UTN FRBA`), y «U.», «Fac.», «Nac.» en el resto (`lib/residences/universityLabel.ts`).
8. **Preguntas:** «¿Tenés otra pregunta?» pide revisar que la respuesta no esté ya en la ficha o en las preguntas frecuentes antes de enviarla.
9. **Fotos por área y tipo:** las secciones de la galería salen solo de las áreas comunes elegidas (incluidos los «Otro», con marca «Pendiente» hasta aprobarse), los tipos de habitación activos y «Fachada / Exterior»; una foto cuya sección ya no existe pasa a «Sin clasificar» en el editor y a «Fotos adicionales» en la ficha, sin perderse ni guardarse el cambio.

**Supuesto reversible.** El mínimo de 10 residentes para el promedio es de privacidad; subirlo es seguro, bajarlo no.

### DR38: documentación de la estadía configurable por residencia (2026-11-03, migración 0077)

**Decisión del dueño.** La tarjeta «Documentación de tu estadía» solo pide los documentos que el estudiante **no tiene ya cargados en su perfil**. Cada residencia elige, al configurarse, qué documentos le pide a sus residentes, y su equipo ve en la gestión de cada residente si lo entregó.

**Reglas.**
1. **Catálogo estándar** (casillas en el perfil de la residencia): Documento de identidad o pasaporte y Certificado de estudios (~~y Antecedentes penales~~: quitado por DR65 (a), 2026-11-22). Más hasta **5** documentos propios («Otro»), de hasta 80 caracteres cada uno, sin HTML ni saltos de línea.
2. **Default** de una residencia que nunca configuró nada: identidad + certificado de estudios (lo que se pedía hasta ahora). Una residencia puede quedarse sin pedir ninguno.
3. **Quién edita:** solo el dueño; el staff lo ve en solo lectura (como el resto del perfil, DR10). Cambiarlo **no requiere aprobación del admin**: no es contenido público (no se muestra en la ficha) ni cambia condiciones económicas.
4. **Estudiante:** ve «Ya tenés N de M en tu perfil» y, de lo que falta, solo lo que le corresponde subir; los ya cargados aparecen atenuados con ✓. Si no falta nada: «Documentación completa». Un documento del perfil vale para todas las residencias; los «Otro» se reconocen por su nombre (sin distinguir mayúsculas ni espacios).
5. ~~Superado por DR48 (2026-11-14): la residencia autorizada puede abrir el archivo.~~ **Residencia:** en cada residente ve cada requisito con «Entregado» (y la fecha de carga) o «Falta». **Solo estado: nunca el archivo ni un enlace.** Los documentos sensibles siguen viéndose únicamente con justificación registrada (más arriba en este documento). Sin cuenta de estudiante vinculada: «Sin cuenta: no podemos ver su documentación».
6. **Dónde se guarda:** `residence_profile_sections` con `section_type = 'stay_documents'` y `content = { items: [claves estándar], other: [etiquetas] }` (sin tocar `residences`). Claves: `identity`, `academic_proof`, `criminal_record`. Los archivos: `student_identity`, `student_academic_proof`, `student_criminal_record` (valor nuevo del enum `document_type`) y `other` con `files.requirement_label` (columna nueva) para saber a qué requisito «Otro» responde.
7. **Sin la migración 0077** todo degrada al comportamiento anterior: se piden solo identidad y certificado de estudios, no se ofrece «Antecedentes penales» ni los «Otro» (el dueño igual puede guardar su lista: queda lista para cuando se aplique).

**Supuesto reversible.** Cambiar la lista no avisa a los residentes actuales ni los obliga a nada: solo ajusta lo que ven como faltante.

### DR39: relevamiento lote 3 — búsqueda, panel del estudiante y Mi residencia (2026-11-03, sin migración)

Decisiones del dueño tras revisar flujos y dashboards:

1. **Nombres cortos:** «UBA Ciencias Económicas» se muestra «UBA Económicas» (también Exactas, Sociales, Veterinarias, Agrarias). Solo presentación.
2. **`/search`:** el encabezado suma a la derecha un panel con datos reales del catálogo (cantidad de residencias, barrios y precio desde). La tarjeta de resultado queda compacta: nombre, barrio, **plazas totales** con sello de género (Mixta / Solo hombres / Solo mujeres), tipos de habitación como **íconos de personas** (1 = individual, 2 = doble…) con el nombre al pasar el mouse, **solo las 2 universidades más cercanas**, una línea de servicios y otra de áreas comunes (el «+N» lista el resto al pasar el mouse).
3. **Checklist de llegada:** cerrado por defecto detrás de «Checklist para antes de viajar». **Solo para la reserva inicial**: una reserva nacida de un cambio de residencia (`stay_change_intents.resolved_reservation_id`) no lo lleva y la cuenta regresiva se muestra en la tarjeta «Tu casa». Las renovaciones no crean reserva nueva. Mismo criterio en la vista del familiar.
4. **Mi perfil:** el subtítulo aclara que los perfiles más completos tienen mejores chances; aviso de que documentos y datos están protegidos; la vista previa de «Tu perfil en la comunidad» se actualiza en vivo con lo que se escribe (sin guardar) y separa hábitos de intereses.
5. **Comunidad:** la ficha flotante de cada residente va en un portal con posición fija: no la recortan los contenedores ni la tapan las tarjetas vecinas.
6. **Mi residencia:** el encabezado es una presentación (foto, servicios, áreas comunes); después «Sobre tu residencia» con las reglas y el reglamento descargable en PDF.
7. **Documentación de la estadía:** ver DR38.

### DR40: lista de espera con mes de ingreso y vencimiento automático (2026-11-07, migración 0078)

**Decisión del dueño (2026-11-07).** Reemplaza la regla «la lista no vence automáticamente por tiempo» (`docs/04` §11.3 y §24 regla 5, `docs/05`, `docs/08` §6.10). *(Se numera DR40 porque DR33 ya está tomado por disponibilidad por tipo y género.)*

**Reglas.**
1. **Mes de ingreso.** Al sumarse, TODO estudiante elige **un mes específico** (del mes actual a +12 meses; con una reserva vigente, solo meses desde el que termina su período) o **«Cuando haya lugar»** (sin mes: lugar «para cuando sea»). Tiene que elegir una de las dos; ya no hay fecha exacta.
2. **Vencimiento automático.** Si el mes elegido terminó (fin del último día del mes, hora de Buenos Aires), la entrada sale sola de la lista: estado nuevo `expired`. **Sin mes no vence nunca por fecha** (rige el recordatorio de 90 días de siempre: `retention_check_sent` no es terminal). Al vencer se notifica una sola vez al estudiante («Podés sumarte de nuevo»).
3. **Lista de la residencia, ordenada y priorizada.** Por tipo de habitación; dentro de cada grupo: (a) quien tiene una respuesta corriendo (avisado / chequeo de retención) primero; (b) luego por mes elegido ascendente (el más cercano primero; el mes en curso es **urgente**); (c) desempate por antigüedad (FIFO, `joined_at`); (d) «Cuando haya lugar» al final, también FIFO. Se muestra «Ingreso: noviembre 2026» / «Cuando haya lugar» / «Vence a fin de mes», con un resumen arriba (total, urgentes este mes, esperando respuesta).

**Supuestos reversibles (documentados, no pedidos por el dueño).**
- **Sin cambiar columnas:** `desired_start_date` guarda el **día 1** del mes elegido; `null` = «Cuando haya lugar».
- **Superposición con una reserva vigente (DR1/DR3):** con un mes se evalúa con el **último día del mes** (criterio no excesivamente estricto: solo se bloquea si todo el mes cae dentro del período vigente). Sin mes se sigue evaluando desde hoy.
- **El job NO vence `availability_notification_sent`** (están a mitad de flujo: ya se les avisó que hay lugar). Sí vence `active` y `retention_check_sent`.
- **Defensa en profundidad:** las vistas (residencia, estudiante, admin) ocultan las entradas activas cuyo mes ya terminó aunque el cron todavía no haya corrido.
- **Consecuencia:** con una reserva/estadía vigente (sin aviso «Quiero cambiar» que lo exceptúe) el formulario NO ofrece «Cuando haya lugar»: sin mes se considera superpuesto (`docs/04` §5.6bis); tiene que elegir un mes posterior a su período.
- `activateFromWaitlist` (pide fecha de ingreso nueva para la solicitud) no cambia. Las entradas viejas con fecha exacta se muestran por su mes y vencen a fin de ese mes.
- **Prioridad (b):** es un orden de presentación derivado (no se persiste), igual que antes.

### DR41: lista de espera — aviso por lote, «Avisados» aparte, decisión del estudiante y tablero (2026-11-07, migración 0079)

**Decisión del dueño (2026-11-07).** Extiende DR40 sin cambiar sus reglas de mes, vencimiento ni orden.

**Reglas.**
1. **Aviso por lote.** En la lista de la residencia se puede **seleccionar varias entradas** (casilla por fila, «seleccionar todos» por tipo de habitación) y avisar «hay lugar» a todas juntas con una barra de acción «Avisar a N». Exige el permiso `waitlist.manage` (DR11), valida del lado del servidor, manda **un aviso por estudiante** y deja **una auditoría por entrada** (`waitlist_availability_notified`). **Tope: 50 por lote.** Solo son avisables las entradas `active` o `retention_check_sent`; el resto (ya avisadas, vencidas, inexistentes) se ignora y se informa. Resultado parcial: «Avisamos a X; no pudimos con Y» (con el motivo). El aviso individual usa el mismo camino (lote de uno).
2. **«Avisados» aparte.** Las entradas `availability_notification_sent` se ven en su propia sección «Avisados · esperando respuesta», con la fecha en que se avisó (`notified_at`), separadas de «En espera». Siguen primero dentro de su tipo (DR40 (a)).
3. **El aviso al estudiante.** Notificación in-app enviada en nombre de la residencia (sin proveedor de email todavía: mismo criterio que el resto, `docs/00` §29). La notificación lleva a la tarjeta de esa entrada en `/students/waitlist`, donde decide entre tres opciones: **«Enviar solicitud»** (el flujo real que ya existe, `activateFromWaitlist`; texto fijo «Sujeta a confirmación de la residencia»; con «Cualquier tipo» lleva a la ficha de la residencia porque hay que elegir tipo), **«Seguir esperando»** y **«Salir de la lista»**. Las tres funcionan igual desde la notificación y desde la pantalla (es la misma tarjeta).
4. **«Decidió esperar».** Si elige seguir esperando, la entrada vuelve a `active` y guarda `waiting_confirmed_at`; la residencia ve la marca «Decidió esperar · 5 nov». Si la residencia la **vuelve a avisar**, la marca se limpia (y `notified_at` se actualiza). Salir de la lista mantiene el patrón vigente: estado `removed_by_student` (no se borra la fila, queda auditoría) y deja de listarse.
5. **Tablero.** `/residence/[id]/waitlist` pasa a columnas por tipo de habitación («Cualquier tipo» al final), con contador, scroll interno por columna, filtros rápidos (mes, «Este mes», «Cuando haya lugar», estado) y búsqueda por nombre; en móvil columnas con scroll horizontal y barra de acción fija abajo.

**Supuestos reversibles (documentados, no pedidos por el dueño).**
- **Persistencia:** columnas nuevas `notified_at` y `waiting_confirmed_at` (0079). Sin la migración las pantallas degradan: se ven igual, sin fecha de aviso ni marca.
- **Timeout del aviso sin respuesta (NO implementado):** hoy un aviso sin respuesta no vence (DR40: `availability_notification_sent` no se vence ni recibe el chequeo de 90 días). Propuesta: pasados **7 días** sin respuesta, un job la devolvería a `active` (sin marca «Decidió esperar») y la residencia podría volver a avisarla. No se implementó para no agregar un job nuevo sin que el dueño lo valide; mientras tanto la residencia ve «Avisado hace N días» y puede sacarla.
- **Aviso a retención:** una entrada `retention_check_sent` también se puede avisar; al avisarla pasa a «Avisados» y cuenta como respuesta al chequeo.
- **«Decidió esperar» solo tras un aviso «hay lugar»:** «Seguir esperando» desde un chequeo de retención vuelve a `active` pero no guarda `waiting_confirmed_at`.
- **Índice único parcial:** como `active` es único por estudiante + residencia + tipo, si el estudiante ya se sumó de nuevo en otra entrada activa del mismo tipo, «Seguir esperando» le dice que ya está en la lista.

---

## Preapertura (DR42–DR47, 2026-11-06 a 2026-11-08)

Decisiones del dueño para la preapertura pública. Detalle operativo, componentes y pendientes en `docs/23_PREAPERTURA.md`; referencia visual aprobada (v4) en `design-proposals/preapertura-2026-11/`. Protocolo `docs/13` §5: doc primero, código después (nada implementado al 2026-11-08). No cambia estados de `docs/04`; mantiene separadas las entidades (propuesta, solicitud, negociación, pago, fee, reserva, factura, comprobante).

### DR42: capa de preapertura con interruptor (2026-11-06)

1. **Interruptor `PREAPERTURA=on`** (env de Vercel prod). Páginas nuevas en `app/(preapertura)/` con header/footer propios; `next.config` reescribe `/` y `/for-students` a la versión de preapertura y redirige `/search`, `/register`, `/waitlist` a `/preregistro`. Landings actuales, Navbar y Footer **no se tocan**; al abrir se apaga el flag y vuelven.
2. **`/for-residences` NO se reescribe** (2026-11-07; **supera** el punto 6 original que la incluía): solo cambia el header por el de preapertura, sin «Crear cuenta». «Sumar mi residencia» va directo a `/register/residence` (excepción a la redirección de `/register`).
3. **`/guias` no se enlaza** en preapertura y **su URL no se redirige** (no perder SEO); se reactiva en la apertura. `/students/*` redirige a «Mi lugar» con el flag encendido.
4. **Tablas nuevas** (estudiantes preinscriptos, interesados); **no se reutiliza `waitlist_signups`** (RLS sin policies a propósito).
5. **Diseño (2026-11-08, v4 aprobada):** landing blureada (`inert`, `aria-hidden`) + popup flotante que no se puede cerrar; objetivo urgencia, mínimo de texto, «gratis». Pills de 34 px aceptadas como **excepción** a la regla interna de 44 px.

### DR43: registro de estudiantes y familiares en preapertura (2026-11-07/08)

1. **Cuenta real** (no preinscripción sin cuenta). **Paso 1:** email + contraseña, rol estudiante/familiar, fecha de nacimiento, casillero de términos obligatorio. Copy dice «Buenos Aires», sin campo ciudad. **Google:** variante con y sin botón; ver nota en DR26 (no hay OAuth en el código). Apple, después.
2. **Edad mínima de cuenta propia: 18** (2026-11-08), validada en el servidor. *(Fuera de la preapertura rige DR65 (e), 2026-11-25: cuenta de 14 a 17 en espera hasta el consentimiento del familiar.)* Un menor **no crea cuenta**: se lo deriva a pedirle a un familiar mayor que se registre primero y lo invite; entra solo con ese link (cuentas relacionadas). El menor invitado no puede activar la comunidad pública y nunca aparece en ella. Reutiliza `/register/family` + `family_links`; el familiar **no da consentimientos por el estudiante**. Una sola invitación, sin recordatorios (regla del sistema, no se comunica). **Supera** parcialmente `docs/10` §9 en el sentido de que en preapertura el menor no registra cuenta propia; DR32 (tutor) rige al abrir.
3. **Paso 2 (opcional):** nombre; país → provincia si Argentina; solo universidad (**sin zona**); carrera; tipo de habitación (Individual / Compartida / Me da igual); mes de ingreso **solo Ene/Feb/Mar/Abr + «Todavía no sé»** (**supera** «12 meses»; el año se asume próxima temporada y se guarda en el servidor); **2 hábitos y 2 intereses** como chips predefinidos con nombres neutros; «¿Ya estás en una residencia?» + cuál (no se muestra a esa residencia). Sin presupuesto. Dos tarjetas en vivo («Así te van a ver» y «Busca residencia»).
4. **«Mi lugar»** (pantalla final): posición (#N), mini resumen de los 5 pasos, carrusel y vista previa rotulada «se activa cuando abramos». **Se elimina** «qué compartís», «vos decidís», «Cómo funciona», «Tu privacidad», FAQ y avisos «la residencia nunca ve…»: todo eso vive solo en Términos y Privacidad.
5. **Contador** de registrados visible desde 25 (con menos, «Sé de los primeros»); «#N tu lugar si terminás ahora» = registrados + 1, sin prioridad ni reserva (se aclara en Términos). *(Propuesta del diseñador incluida en la v4 aprobada.)*

### DR44: comunidad pública y carrusel con ejemplos rotulados (2026-11-07/08)

1. Carrusel dinámico **público** (landing, paso 1, «Mi lugar»): nombre sin apellido, edad, país, carrera, hábitos e intereses como chips; avatar con inicial + bandera (reusa `CommunityBrowser`/`CommunityProfileCard`, campos `show_*_to_registered`); **nunca** la residencia actual. **Supera** `docs/00` §19 en preapertura (allí el perfil individual lo ven usuarios registrados): el dueño aceptó la exposición pública y el riesgo de identificación indirecta.
2. **Reglas:** lo tilda el estudiante (no el familiar), solo 18+, el casillero va **sin tildar**, en **una sola línea** («Mostrar mi perfil (nombre, edad, país, carrera, hábitos e intereses) en la comunidad de la web»); que sea público y retirable va en Términos §7; se retira con «Editar mi perfil» y la tarjeta desaparece. **Supera** el casillero de comunidad «separado» con explicación larga (decisión 8 del 2026-11-07).
3. **Ejemplos ficticios rotulados** («Ejemplo»), **excepción acotada** del dueño a «no datos falsos», solo en esta sección; contadores siempre reales. Se retiran **de a uno** con cada estudiante real y se apagan al llegar a ~12 reales (a confirmar).

### DR45: consentimiento mínimo, opción C y divulgación (2026-11-06/08)

1. **Opción C dentro de los términos** (2026-11-08): el casillero **obligatorio** del paso 1 dice «Acepto los Términos y la Privacidad, incluido mostrar mi búsqueda sin nombre ni contacto a residencias verificadas»; detalle en Términos §7. **Supera** la decisión 2 (casillero C opcional y separado) y el casillero C del paso 2. Mitigación: el contacto se entrega solo si el estudiante confirma con un clic aparte; la C se puede desactivar; nunca se ofrece a una residencia un estudiante que ya vive ahí ni se revela de qué otra residencia viene. **Riesgo asumido por el dueño: sin validación legal (Ley 25.326)**; alternativa si se quiere blindar: segunda casilla de una línea, tildada por el usuario.
2. **Servicio «1–2 opciones verificadas»:** solo residencias **externas** que ya aceptaron; Sin Fronteras queda fuera de las recomendaciones; se activa tras el primer acuerdo externo.
3. **Vínculo del dueño con Sin Fronteras:** NO se escribe en ningún lado por ahora (ni formulario ni web ni textos de preapertura); la divulgación es **oral y en persona**, antes de que la residencia entregue datos o acepte un candidato; nunca mentir si preguntan. **Supera** la idea inicial de nombrarlo en términos/política. La política igual debe nombrar al responsable legal del tratamiento (datos pendientes).

### DR46: Residencias fundadoras de preapertura (2026-11-07/08)

1. **Cupo REAL de 10** (cuenta solicitudes + residencias en verificación; si una no avanza, el lugar se libera y el contador puede subir). **PROHIBIDO** bajar el cupo sin altas reales (escasez fabricada). Cuenta regresiva a una **fecha de cierre real** (se define al lanzar; si llega sin abrir: cerrar igual o extender avisando). Contador de residencias visible desde 3 reales; contador de estudiantes siempre real.
2. **Frase «ya hay residencias registrándose»** solo cuando entre la primera residencia **externa** (Sin Fronteras no cuenta; aparece como fundadora recién al abrir).
3. **Beneficios:** insignia «Residencia fundadora» + jerarquía al abrir (con etiqueta explícita; regla nueva) y **Plan Premium bonificado el primer año** (vigente, DR12), mostrado en **una línea**, sin planes ni precios. **Sin descuento en comisión** (el fee lo pagan solo los estudiantes). «Gratis» se usa solo para sumarse.
4. **Registro sin cuenta:** `/register/residence` ya es solo una solicitud (`residence_signup_requests`); el equipo contacta, coordina charla y visita y recién ahí entrega la cuenta; **no hay «Mi lugar» para dueños** (pantalla de éxito + email). **Cinco campos obligatorios:** residencia, **dirección** (**reemplaza barrio**), nombre del responsable, teléfono/WhatsApp, email; Instagram y camas se piden en la charla. Validación en cliente y servidor.
5. Sin mención de Sin Fronteras ni de planes/comisión en la web ni en el mail de confirmación.

### DR47: captación y copy de preapertura (2026-11-06/08)

1. **Estudiantes:** campaña fuerte desde ya, **sin fecha de apertura**, copy honesto, contenido real cada 1–2 semanas; tope operativo y presupuesto a definir. **Residencias:** el objetivo es **entrante** (el dueño escribe primero); la opción C es la palanca; se miden por separado. Los registros tempranos de estudiantes son el argumento para las residencias.
2. **Copy:** beneficio principal «enterarte primero cuáles son las residencias verificadas»; «Sumarte es gratis» muy visible. Titulares recomendados: A «Encontrá tu residencia en Buenos Aires sin ir a ciegas.»; fundadoras «Menos mensajes, más residencia. Y gratis.». Sin promesas de disponibilidad, reserva ni match; «Soporte», no «mediación»; «acceso anticipado» sí. «Verificada/visitada en persona» permitido desde 2026-11-01.

### DR48: la residencia puede abrir los documentos de sus residentes y solicitantes con pago habilitado (2026-11-14, migración 0087)

**Decisión del dueño.** Reemplaza DR38 punto 5 («solo estado, nunca el archivo»). La residencia necesita ver los documentos que el estudiante subió a su perfil para operar el ingreso.

**Reglas.**
1. **Qué documentos:** solo los del perfil del estudiante en el bucket privado `student-documents` (`student_identity`, `student_academic_proof`, `student_criminal_record` y `other` con `requirement_label`). Nunca comprobantes, documentos de otras entidades ni de estudiantes sin vínculo con esa residencia.
2. **De quién:** (a) **residentes actuales** de ESA residencia (`resident_stays.is_current`); (b) **solicitantes** de ESA residencia cuya solicitud tiene el **pago a la residencia habilitado**: `residence_payment_pending` o `residence_payment_reported` (`docs/04` §5.2), o `converted_to_reservation` mientras la reserva siga viva (`pending_estured_fee`, `estured_fee_processing`, `estured_fee_failed`, `confirmed`, `receipt_pending`, `receipt_issued`). Antes del pago habilitado (`submitted` … `conditions_accepted`) y en estados cerrados (rechazada, vencida, cancelada, reserva cancelada/vencida/no show/completada) **no**.
3. **Quién:** el dueño siempre; el staff solo con el casillero del vínculo: «Residentes» (`residents.manage`) para residentes y «Pago a la residencia» (`payments.residence`) para solicitantes. Sin el casillero ve solo «Entregado/Falta».
4. **Registro:** sin motivo, pero cada apertura se registra **antes** de generar el link (sin registro no hay link) en `residence_document_access_log` (quién, rol, archivo, tipo, estudiante, residencia, vínculo, solicitud, cuándo; RLS sin policies, solo service role) y en el audit log `residence_document_accessed`. Link firmado de **300 s**. Freno: 60 aperturas por hora por usuario.
5. **Autorización:** siempre derivada de la base en el servidor (`lib/documents/residenceDocumentAccess.ts`); la pantalla solo manda residencia + archivo. Falla cerrado; «no existe» y «no es de un estudiante vinculado» devuelven el mismo mensaje.
6. **Familiares:** hoy no suben documentos (no hay flujo de carga de `family_identity` ni `student_family_authorization`), así que no hay nada que mostrar; si se agrega, se evalúa aparte.

**Supuesto reversible.** Incluir `converted_to_reservation` con reserva viva cubre el tramo entre la conversión y el alta de la estadía; si el dueño prefiere cortarlo en `residence_payment_reported`, alcanza con quitarlo de `LIVE_RESERVATION_STATUSES`.

### DR49: Residencia Sin Fronteras fuera del orden «Recomendado» (2026-11-14, sin migración)

**Decisión del dueño** (auditoría UX H6/CON-15). Las residencias que EstuRed opera o co-gestiona (hoy solo «Residencia Sin Fronteras») **no se ven ocultas ni marcadas**, pero quedan **al final del orden «Recomendado»** (`/search` y la landing). En los órdenes por precio y en los filtros se tratan como cualquier otra. Se identifican por slug en `EXCLUDED_FROM_RECOMMENDED_SLUGS` (`lib/residences/searchFilters.ts`). No cambia DR45 (divulgación solo oral) ni agrega etiqueta visible; si más adelante se quiere una etiqueta, es otra decisión. Supuesto reversible: vaciar la lista.

### DR50: aviso de rango de edad al solicitar (2026-11-14, sin migración)

**Decisión del dueño** (auditoría UX, hallazgo B «Valentina 17 vs «De 18 a 26 años»», CON-29). Si la edad del estudiante **a la fecha de ingreso elegida** queda fuera del rango que publica la residencia (DR14), el formulario de solicitud muestra un **aviso no bloqueante** debajo de la fecha: «A esa fecha tendrías N años y esta residencia publica «de X a Y años». Podés enviar la solicitud igual, pero tené en cuenta ese rango.». No bloquea el envío, no oculta residencias ni agrega reglas de admisión. La fecha de nacimiento solo viaja al navegador del propio estudiante (`ageRangeNotice` en `lib/residences/age.ts`). Sin fecha de nacimiento no se avisa (DR14).

### DR51: rótulo del filtro de edad en /search (2026-11-14, sin migración)

**Decisión del dueño** (auditoría UX H7/CON-16: 42 residencias con Camila logueada vs 43 deslogueada; la diferencia es el filtro de edad de DR14, no un error de conteo). Cuando un estudiante con fecha de nacimiento ve el catálogo y el filtro oculta residencias, `/search` muestra bajo la introducción: «Mostramos las residencias que aceptan tu edad[ a la fecha de ingreso elegida]. N más tienen otro rango de edad.». Visitantes y perfiles sin fecha de nacimiento no ven nada (no se excluye ninguna). `lib/residences/ageFilterNotice.ts`.

### DR52: un solo rótulo por estado vencido, entre roles (2026-11-14, sin migración)

**Decisión del dueño** (auditoría UX H15/CON-24: «Reserva vencida», «Reserva vencida — fee sin pagar», «Vencida — sin pago a la residencia» y «Venció por falta de pago» nombraban lo mismo según el rol). Los estados vencidos (`expired_no_residence_response`, `expired_no_student_payment`, `expired_offer_no_response`, `expired_fee_unpaid`) llevan **el mismo rótulo para estudiante, residencia y admin**; la perspectiva va solo en el texto de ayuda (`helper`). Rótulos: «Vencida — sin respuesta», «Vencida — sin pago a la residencia», «Vencida — propuesta sin respuesta» y «Reserva vencida». Ajusta las columnas de rótulo de `docs/04` §5.4 en lo que respecta a estos cuatro estados; los estados y transiciones no cambian. Fuente: `lib/applications/visibleStatus.ts`; el rótulo en tercera persona del familiar ya no necesita traducir el de la propuesta.

### DR53: tarjetas de condiciones solo con lo que cobra + explicación clara del mes vacío (2026-11-14, migración 0088 solo de texto)

**Decisión del dueño** (auditoría UX H8/H9/CON-27). **Reemplaza** de DR30 §4 la nota «SEIS tarjetas fijas»; DR18 t3 (segunda corrección) sigue siendo la regla de cálculo del mes vacío, sin cambios.

**1. Tarjetas.** En «Tarifas y condiciones» de la ficha pública solo hay tarjeta para lo que cobra algo: «Para reservar» (siempre, es un pago), «Matrícula» solo si cobra, «Depósito» solo si lo pide y «Mes vacío» solo si la residencia configuró un % mayor a 0. Lo que no cobra o no tiene dato («Ajuste de tarifa», «Documentos para admisión» y matrícula/depósito/mes vacío sin cobro) sale de las tarjetas y queda tras un único acceso «Ver condiciones completas» (`<details>` accesible) que lista las seis, con «No cobra…» y «A coordinar con la residencia». Lógica en `lib/residences/conditionCards.ts` (testeada).

**2. Explicación del mes vacío.** El texto anterior («con un descuento, ya que la plaza se bloquea para vos») confundía: no es un descuento sobre algo que se pagaría, es un **cargo parcial por guardar la plaza vacía**. Se conserva el término «mes vacío», definido la primera vez. Idea central, antes de los detalles: «Si reservás para ingresar más adelante y la plaza está libre mientras tanto, la residencia te la guarda: por ese tiempo sin vos adentro (el «mes vacío») se cobra un porcentaje de la renta, no la renta entera.» La tarjeta muestra solo el dato corto («50 % de la renta») y una línea; el detalle va al dorso/expander con el ejemplo (disponible hoy, ingreso en 45 días, 50 %: 1,5 meses × 50 % = 0,75 de una renta mensual) y a la FAQ. Copy único en `lib/residences/emptyMonthCopy.ts`, usado en ficha, desglose, configuración de la residencia (perfil) y reglamento modelo (art. 14). FAQ-51 (texto fijo) y FAQ-22 (plantilla de la residencia) se reescriben por la migración `0088` (solo `suggested_answer`; no toca `answer_override` por residencia).

**Docs actualizados:** este registro; `docs/propuestas/REGLAMENTO_MODELO_Y_FAQ.md` (art. 14, FAQ-22, FAQ-51); `docs/06` §8.1 (nota).

### DR54: cierre de decisiones de la auditoría de seguridad complementaria (2026-11-15)

Decisiones del dueño tras `docs/audits/AUDITORIA_SEGURIDAD_COMPLEMENTARIA_2026-11-15.md`:

1. **Documentos de solicitantes (ajusta DR48).** Una residencia que **no está activa** (`residences.status` distinto de `verified_active`: pausada por ella o por admin, suspendida, con cambios pedidos/verificación rechazada o vencida, archivada) **no abre documentos de solicitantes** aunque tengan el pago a la residencia habilitado. Los **residentes actuales** no cambian. Lo exige el servidor (`grantResidenceDocumentAccess`, falla cerrado) con el mensaje «La residencia no está activa en este momento…».
2. **Bloquear a un estudiante no lo saca del carrusel de preapertura.** Se deja como está (decisión explícita, no omisión).
3. **Fee de renovación vencido.** La oferta pasa a `expired_no_student_payment` (rótulo «Vencida — fee sin pagar»), se avisa al estudiante (y al pagador si es otra persona) y al equipo de la residencia con `renewals.manage`, y **la residencia debe enviar una renovación nueva**. No se reabre: `reopenRenewalOffer` solo vale para `expired` (sin respuesta). Lo hace el job `expire_estured_fee_windows` (`lib/jobs/expireEsturedFeeWindows.ts`). Cierra el pendiente de producto de SEG14-01.
4. Corregidos SEG15-01/02/03 (migración `0089`, cuotas de soporte, compare-and-set de reemisión): ver el informe.

### DR55: copy de las landings tras la auditoría de UX writing externa (2026-11-16)

Se evaluó `gemini-code-1794870999321.md` (auditoría de UX writing/CRO) contra DR13, DR15 y la regla 4. **Aplicado:** (1) home: subtítulo «visitadas en persona por nuestro equipo»; (2) disclaimer de los heroes de home y `/for-students` acortado a «Explorar es gratis · Cada solicitud la confirma la residencia» (el texto completo «sujeta a confirmación» sigue al solicitar, en la FAQ y en los términos); (3) `/for-students`: CTA «Ver residencias verificadas» y punto visible «Los menores no aparecen» en Comunidad (reemplaza «Convivencia que se elige», que repetía «Quiénes viven ahí»); (4) `/for-residences`: CTA «Sumá tu residencia, es gratis» (home, landing y panel de audiencias), «sin comisión sobre tu tarifa» en el hero y titular de salidas «Anticipate a las vacantes: enterate con tiempo cuándo se libera un lugar». **Descartado (no volver a proponer):** «reserva garantizada/protegida», «respaldo de punta a punta», «sin caer en estafas» en el H1, «cero comisiones ocultas / sin intermediarios inflados», «precio fijo garantizado / cancelable» del Plan Premium (política no definida), banner «Acceso anticipado… beneficios exclusivos», «Ocupación al 100%», «Soporte antes, durante y después», matriz «Por fuera vs. Con EstuRed» y bloque «Cómo funciona el pago» (ya existen: `BenefitCompare`, `MoneyFlow`, `WhatYouPay`) y cambios al buscador de la home (es un CTA a `/search` a propósito). | `components/marketing/*`; `docs/00` §31 (DR13, DR15) |

### DR56: listado de universidades ampliado y opción «Otra» (2026-11-17)

Por pedido del dueño, `lib/data/buenosAiresUniversities.ts` (fuente única de formularios, filtro, distancias y mapa) pasa de 23 a 55 instituciones con ubicación: las 13 facultades de la UBA (se suman Agronomía, Exactas, Veterinarias y Farmacia y Bioquímica) y las tres sedes del CBC; las universidades e institutos públicos (UNDEF, UNIPE, UNTREF, UNSAM, UniCABA, IUPFA, IUGNA, IUSE, IUNMa); y más privadas (San Andrés, UCEMA, Favaloro, Barceló, Maimónides, UFLO, UMSA, CAECE, UdeMM, UCINE, ISALUD, ESEADE, FLACSO, TEA y Deportea, ETER, IAG). Cinco instituciones se pueden elegir pero no tienen coordenadas confiables todavía (`UNLOCATED_UNIVERSITY_NAMES`: Austral, UMET, CEMIC, IUEAN, Siglo 21). Los nombres anteriores no cambian (están guardados en las fichas); se corrigieron coordenadas de las facultades que estaban corridas (p. ej. Ingeniería). **Mapa de `/search`:** Ciudad Universitaria, FADU y Exactas comparten pin; las facultades con varias sedes tienen un pin por sede (Psicología, Ingeniería, UTN y las 16 sedes de la UNA, solo en el mapa). **«Otra»:** el estudiante ya tenía «Otra universidad…» y «Otra carrera…»; la residencia suma «Otra universidad o instituto» en Proximidad (no se muestra al público ni cuenta para distancias). Las coordenadas salen del listado del dueño, con una verificación cruzada contra OpenStreetMap (la mayoría coincide a menos de 150 m); a confirmar: IUSE, UNA Multimediales, UMSA y CBC Montes de Oca. | `lib/data/buenosAiresUniversities.ts`, `lib/maps/universityPins.ts`, `lib/residences/options.ts` |

### DR57: compartir la ficha por WhatsApp, FAQ destacadas y foto principal (2026-11-17, migraciones 0095, 0096 y 0097)

Fase 5 del rediseño de la ficha («placa porteña», propuesta A). **Compartir tu ficha:** cada residencia tiene un mensaje inicial editable para mandar su ficha por WhatsApp. Es un **botón manual** (`https://wa.me/?text=…`): nunca la API de WhatsApp Business. Plantilla original (texto del dueño del producto) con datos que se completan solos: `{LINK}` (`<URL base>/r/<slug>`), `{PRICE_FROM}` y `{PRICE_FROM_ARS}` (precio «desde» con la misma regla de la ficha y su referencia con la cotización vigente), `{ZONE}`, `{UNIVERSITY}` (la universidad más cercana que cargó, nombre corto) y `{STAY_CONDITIONS}` (estadía mínima, matrícula y depósito, cada monto con su ARS). Siempre «USD» (nunca «US$»). Si falta un dato se omite la línea entera. La residencia puede guardar su versión y volver al original; reglas validadas en el servidor: máximo 1.000 caracteres (también el texto ya resuelto), contiene `{LINK}`, solo placeholders conocidos, sin «US$». Guardar el texto original borra la versión propia. **Permisos:** editar, guardar y restablecer requieren `profile.edit` (el dueño siempre); el resto del equipo solo **ve y comparte** (abrir WhatsApp, copiar). Pantalla `/residence/[id]/share` («Compartir ficha» en el panel) y hoja «Compartir esta ficha» desde la ficha pública (solo equipo de esa residencia). Tabla `residence_share_messages` (RLS: lectura de miembros activos; escribe solo el service role). **FAQ destacadas:** `is_featured` + `featured_order` (1 a 6) en las del catálogo que la residencia muestra y en las libres respondidas (las 5 fijas del perfil no se destacan); máximo 6 entre ambas tablas (validación en el servidor y trigger en la base), con el orden elegido; permiso `faq.manage`. Sin ninguna elegida, la ficha destaca las primeras 6 como hasta ahora. **Foto principal:** `is_cover` en `residence_photo_meta` con índice único parcial (una por residencia): la del hero de la ficha y de la imagen de vista previa del link; va primera aunque no esté entre las 5 «de portada» (que siguen rotando en la ficha y la búsqueda); solo fotos aprobadas; permiso `profile.edit`. Todo degrada sin las migraciones. | `lib/share/*`, `lib/faq/featured*.ts`, `lib/residences/photoMeta.ts`, `app/residence/[residence_id]/{share,faq,profile}`; `db/migrations/0095`–`0097` |

### DR59: requisitos para enviar la residencia a revisión y fortaleza del perfil (2026-11-20, sin migración)

Decisión del dueño: «Enviar para revisión» (y «Reenviar» tras `needs_changes` o `verification_expired`) exige una lista de requisitos, y la «fortaleza del perfil» muestra esa misma lista en vivo. Obligatorios: (1) datos básicos: nombre, barrio, dirección (se fijan al registrarse), eslogan y descripción de más de 20 caracteres; (2) al menos 1 servicio y al menos 1 área común; (3) al menos 1 regla de convivencia; (4) reglamento publicado (versión `published` propia o adaptada del modelo; el modelo base sin adaptar y un borrador no cuentan; un PDF de reglamento cargado y no rechazado también cuenta); (5) al menos 3 preguntas esenciales listas (FAQ-07, 09, 15, 25, 33 y 36: elegidas y sin campos `{…}` pendientes); (6) al menos 2 universidades cercanas; (7) al menos 1 tipo de habitación, todos con tarifa mayor a 0; (8) al menos 3 fotos propias subidas (`MIN_PUBLISH_PHOTOS`; cuentan las pendientes de revisión, no las rechazadas); (9) condiciones de reserva completas (ajuste de tarifa, pago inicial coherente con lo que cobra, matrícula y depósito excluyentes, matrícula manual con monto y, si cobra mes vacío, su porcentaje); (10) **cobro de la reserva (DR63, agregado 2026-11-20, implementado en `submitReadiness.ts` en la fase 2a):** al menos una opción activa: «Cobro con medios habilitados» con al menos 1 medio y sus datos de cobro completos, o «Contacto directo por WhatsApp» (sin dato extra: la residencia contacta al estudiante). Condicionales, solo si la residencia eligió la opción: depósito con monto (en USD o en meses de renta) y salida anticipada con costos Y condiciones (se considera elegida si escribió alguno de los dos). No son obligatorias: promociones, mínimo de estadía («Sin mínimo» es válido), cláusulas del depósito, documentos que se piden a residentes. **Dónde se aplica:** solo con `intent = "submit"` y cuando el envío mueve la residencia de estado (`draft`, `needs_changes`, `verification_expired`). «Guardar cambios» y el guardado de una residencia publicada no se bloquean. El servidor recalcula SIEMPRE desde la base + el formulario enviado (nunca confía en conteos del cliente), antes de escribir nada, y rechaza con un mensaje que lista lo que falta. **Supuestos reversibles:** el perfil no tiene campo de contacto propio, por eso no se exige (sigue vigente: DR63 (j) 2 descartó el campo, porque el estudiante nunca contacta a la residencia); la salida anticipada no tiene interruptor, por eso «elegida» = escribió costos o condiciones; si el catálogo de preguntas o los reglamentos no existen todavía en el entorno (migración pendiente), ese requisito no se exige; el umbral de 3 esenciales y de 2 universidades vive en `lib/residences/submitReadiness.ts`. | `lib/residences/submitReadiness.ts` (función pura, la usan el formulario y el servidor), `lib/residences/submitReadinessDb.ts`, `lib/residences/profileStrength.ts` (`strengthFromReadiness`), `app/residence/[residence_id]/profile/{actions.ts,page.tsx,ResidenceProfileForm.tsx,ProfileReadinessChecklist.tsx}` |

### DR59: página «Instalá la app» (`/instalar`) y dónde se ofrece (2026-11-20, sin migración)

Decisión del dueño: página pública con el paso a paso para instalar la PWA en Android (Chrome) y iPhone (Safari), con los beneficios: ícono en la pantalla principal, pantalla completa, apertura rápida y **avisos de la solicitud** (p. ej. cuando una residencia la aprueba). Los avisos push se construyen en otra tarea; la página los promete por decisión del dueño, así que **no se publica hasta que el push esté activo**. En iPhone el push exige la app instalada e iOS 16.4+ (se aclara en la página). Android muestra un botón «Instalar» real si el navegador emite `beforeinstallprompt`; si no, los pasos manuales. Detecta el sistema, abre la pestaña que corresponde y avisa si la app ya está instalada.

**CTA:** (1) aviso descartable `InstallBanner` arriba del contenido en `/students/*` (estudiante y familiar) y `/residence/[id]/*`, solo en celular y solo si no está instalada (se descarta con `localStorage`); (2) ítem «Instalá la app» en la hoja «Más» de la barra inferior de estudiante y residencia; (3) enlace en la confirmación de solicitud enviada (`?enviada=1`, solo celular); (4) enlace «Instalá la app» en el pie público. Fuera: banners en la home y el buscador (distraen del CTA principal). Código: `components/install/*`, `app/(public)/instalar/page.tsx`. Pendiente de la tarea de push: pedir el permiso de avisos tras instalar.

### DR61: notificaciones push web (PWA) para estudiantes, familiares, residencias y admins (2026-11-20, migración 0101)

Decisión del dueño: avisos push que llegan al celular con la app cerrada y un contador (badge) en el ícono de la app instalada. **Reemplaza** la frase de `docs/11` §4 («PWA no obligatoria en el MVP»): la PWA con service worker pasa a ser parte del producto. Seis decisiones, tomadas de a una:

1. **Qué dispara push (2.a, opción A): solo lo accionable.** El usuario debe actuar o cambió el estado de su solicitud, reserva o pago. Lo informativo queda solo in-app (categoría `none`). Cinco categorías de push: `requests_reservations` (solicitudes y reservas), `payments_fee` (pagos y fee), `deadlines` (plazos y vencimientos), `admin_requests` (acciones pendientes de administración) y `admin_signups` (registros nuevos). La clasificación evento por evento vive en el código (`lib/notifications/categories.ts`); `none` es el valor por defecto, así que solo cambian los llamadores elegibles.
2. **Cuándo se pide permiso (2.b, A).** Nunca al cargar la página. Una tarjeta propia de EstuRed aparece tras una acción con valor (estudiante: al enviar su primera solicitud; familiar: al vincularse; residencia: al recibir su primera solicitud; admin: al entrar al panel por primera vez). Botones «Activar avisos» y «Ahora no». El diálogo del navegador solo se abre tras «Activar avisos». «Ahora no» se silencia 14 días (supuesto reversible). En iPhone sin la app instalada (iOS 16.4+ exige instalarla) la tarjeta lleva a `/instalar`.
3. **Preferencias (2.c, A).** Push es un canal **adicional**: `users.preferred_notification_channel` (`email`/`in_app`) no cambia. Cada dispositivo tiene su suscripción y se puede desactivar por dispositivo. Además hay un interruptor por categoría (`push_preferences`); sin fila significa activado. Los admins ven también las categorías `admin_*`; los demás roles no.
4. **Privacidad (2.d, A).** El push **nunca** lleva `title` ni `body` del aviso in-app. Muestra un texto genérico fijo por categoría (sin nombres, montos, documentos, nombre de la residencia ni motivos). El payload lleva solo `category`, un `tag`, la URL de destino y el contador. El detalle se ve al abrir la app.
5. **Horario (2.e, B).** Nunca antes de las 9:00 hora de Argentina (mismo criterio que los avisos de llegada). No hay tope nocturno. Lo generado entre las 0:00 y las 8:59 queda `push_status = 'queued'` y lo envía el job horario existente de `pg_cron` (`/api/cron/expire-stale-records`) en la primera corrida desde las 9:00. No se agrega un cron nuevo. Demora máxima: una corrida horaria.
6. **Badge (2.f, A).** El contador es la cantidad de avisos no leídos en `notifications` (el mismo número de la campana, todas las categorías). El servidor lo calcula **al enviar** (no al encolar) y lo manda en el payload. La app abierta lo recalcula al abrir y al marcar leídos (Badging API del cliente). No hay pushes silenciosos: cada push muestra una notificación (Chrome e iOS lo exigen; iOS revoca la suscripción si no).

**Destinatarios de administración (decisión del dueño):** los usuarios con rol `superadmin` y también `admin` (salvo el aviso de cambio de datos de cobro, que sigue solo a `superadmin`). Categoría `admin_signups` con interruptor propio porque puede ser frecuente.

**Eventos nuevos que hoy no avisan y entran en este ciclo** (cada uno cita `docs/06` §21): al **estudiante**: contacto establecido / solicitud aceptada, pago a la residencia habilitado, propuesta de ajuste recibida, fee pendiente con su plazo, reserva confirmada y comprobante emitido, oferta de renovación enviada. A la **residencia**: propuesta de ajuste respondida (si hoy no avisa). A **administración**: registro de estudiante, registro de residencia, solicitud que pasa a «debe abonar el fee» (pago de la residencia registrado), residencia pide revisión (envío o reenvío), contacto a Soporte, pedido de revocación del fee, edición de perfil pendiente de revisión y verificación anual por vencer o vencida. **Fuera de este ciclo, por no tener flujo:** «pago rechazado» (la acción «Rechazar pago manual» está diferida), «comprobante subido a la residencia» y la baja o borrado de cuenta (no existe el flujo; requiere decisión propia de producto y legal).

**Reglas técnicas.** Envío con `web-push` (VAPID) **fuera de la ruta crítica**: un fallo nunca rompe la mutación (misma regla que `createAuditLog`); en requests se difiere con `after()` de `next/server` y fuera de un request (jobs, tests) se espera dentro de un `try/catch`. El endpoint de cada suscripción debe ser `https` de un proveedor push conocido (FCM, Mozilla, Windows, Apple): el servidor hace POST ahí y una lista abierta sería un SSRF. Máximo 10 suscripciones activas por usuario. Suscripciones con respuesta 404/410 se revocan. Si faltan las claves VAPID el push se degrada a solo in-app (sin error). `VAPID_SUBJECT` es la URL del sitio, no un email personal. Sin WhatsApp (regla 2 del proyecto).

### DR58: documento de identidad del estudiante como dato (2026-11-20, migración 0100)

Decisión del dueño. Hasta hoy el estudiante solo subía el **archivo** `student_identity`; no había número. Se agrega el dato en la tabla privada `student_identity_documents` (una fila por estudiante: `document_type` = `dni` | `passport` | `other`, y `document_number`). Va en tabla aparte y no en columnas de `student_profiles` porque esa tabla tiene `select *` con la sesión del usuario y una policy de lectura para el familiar vinculado: un grant por columna sería frágil. Se pide el tipo porque muchos estudiantes son extranjeros. **Dónde se pide:** en `/students/profile` (perfil completo), opcional; no se pide en el registro (Ciclo 35) ni bloquea solicitar. **Formato (validación server-side):** se guarda normalizado (mayúsculas, sin espacios, puntos ni guiones). DNI: 7 u 8 dígitos. Pasaporte y otro: 5 a 20 caracteres alfanuméricos. **Quién lo ve:** (1) el propio estudiante; (2) su familiar vinculado activo solo mientras el estudiante es menor (`docs/10` §9); (3) la residencia con la misma regla y el mismo vínculo que el archivo (DR48: residente vigente, o solicitante con pago a la residencia habilitado o reserva viva; casillero `residents.manage` o `payments.residence`); (4) admin, con justificación (`docs/10` §10.3). Antes del contacto la residencia nunca lo ve (`docs/10` §7.5). **Cómo se guarda:** tabla con RLS y sin policies (solo service role), registrada en `privateTables` de `scripts/sensitive-columns.json`; toda lectura y escritura va por service role. La auditoría registra el cambio sin el número (`docs/10` §10.6: no loguear números de documento).

**Fase 2 (2026-11-20, sin migración): la residencia lee el número.** Decisión del dueño: sí. Supuesto reversible, **más estricto que el archivo (DR48)** y que ajusta el punto (3) de arriba:
1. **Cuándo:** solo con una **estadía vigente** de ESE estudiante en ESA residencia, o una **reserva confirmada** (`confirmed`, `receipt_pending`, `receipt_issued`) nacida de su solicitud a ESA residencia. **Nunca antes** (solicitud, pago a la residencia habilitado, fee pendiente o fallido) y nunca otra residencia. Para volver al alcance de DR48 alcanza con ampliar `IDENTITY_NUMBER_RESERVATION_STATUSES`.
2. **Quién:** el dueño siempre; el staff con «Residentes» (`residents.manage`) para residentes y «Pago a la residencia» (`payments.residence`) para reservas. Residencia no activa: no ve el de solicitantes (igual que DR48); el de residentes sí.
3. **Cómo:** botón «Ver número» en la ficha del residente y en el detalle de la solicitud con reserva confirmada. El número **no viaja con la pantalla ni en listados**: se pide al servidor al hacer clic (`requestStudentIdentityNumber`), que deriva todo de la base, vuelve a autorizar y devuelve el número solo en esa respuesta. Falla cerrado; «sin vínculo» y «sin permiso» no revelan existencia. Freno: 60 lecturas por hora por usuario.
4. **Registro:** cada lectura se inserta **antes** de devolver el número en `residence_document_access_log` (`document_type = 'identity_number'`, sin archivo; la tabla ya admite `file_id` nulo) y en el audit log `student_identity_number_accessed`. Ninguno guarda el número (`docs/10` §10.6). Si el registro falla, no hay número.
5. **Código:** `lib/documents/studentIdentityNumberAccess.ts`, `lib/documents/requestStudentIdentityNumber.ts`, `components/residences/IdentityNumberReveal.tsx`. Tests con caso negativo (otra residencia, antes de la reserva, sin casillero) en `studentIdentityNumberAccess.fake.test.ts`.
6. **Sigue pendiente:** que el familiar de un menor vea el número en su pantalla.

### DR62: reglamento — PDF propio versionado, campos del modelo y aviso al guardián (2026-11-20, sin migración)

**Fuente:** decisión del dueño (2026-11-20): completar lo pendiente de DR14 (ideas 3 y 7 de `docs/archive/IDEAS_DEL_DUENO_2026-10-23.md`). Protocolo `docs/13` §5: doc primero. **No cambia las cláusulas legales del modelo** (siguen a la espera del asesor).

| # | Decisión |
|---|---|
| DR62 (a) | **PDF propio del reglamento.** Además del texto, la residencia puede publicar una versión del reglamento que es **un archivo PDF** (`source = own`). Tope **5 MB** (decisión del dueño); solo PDF, validado por firma `%PDF-` en el servidor. Mismo permiso (`profile.edit`) y mismas reglas que el texto: sin revisión del admin, rige apenas se publica, solo para solicitudes nuevas, inmutable, versionado. El `content_hash` es el SHA-256 **de los bytes del archivo**: identifica exactamente lo que aceptó cada estudiante. El archivo vive en el bucket privado existente `private-residence-documents` (sin policies de Storage; se entrega por enlace firmado generado en el servidor desde `/residencias/[slug]/reglamento`). **Supuesto reversible:** el dato del archivo se guarda en `content.pdf` (`path`, `filename`, `size_bytes`) en vez de `file_id`, para no tocar la función `publish_residence_regulation`; `file_id` queda sin uso. **Un solo reglamento (decisión del dueño, 2026-11-20):** el PDF que la residencia sube al configurar su ficha (campo «Reglamento completo» del perfil) y el de la pantalla Reglamento son **el mismo**: ambos publican la versión vigente. Es el que se descarga desde la ficha y desde cualquier pantalla, y el que se acepta. Reemplaza al «PDF del reglamento» con revisión del admin (`residence_rules_document`): ya no se crea; los archivos antiguos solo se sirven si la residencia no tiene reglamento propio publicado. Subir el mismo PDF dos veces no crea una versión nueva. |
| DR62 (b) | **Multiple choice en el asistente.** El asistente («Armarlo paso a paso») completa los `{campos}` de cada artículo incluido con controles: opción múltiple donde hay opciones fijas (moneda, política de visitas, fumar, mascotas, etc.), hora, número o texto. El resultado sigue siendo **texto** (`content.text`); sin tabla nueva. Los campos sin completar siguen bloqueando la publicación. |
| DR62 (c) | **Guardián (menor).** La aceptación por el familiar vinculado ya existía desde `/students/applications/[id]`. Se suma: **aviso in-app al familiar** cuando queda pendiente su aceptación y **vista de la aceptación guardada** (versión, fecha, quién aceptó) para estudiante y familiar. El guardián ve el **reglamento completo** (texto o PDF) antes de aceptar. Sin cambios de permisos. |

### DR63: cobro de la reserva a la residencia y medios de pago del fee (2026-11-20, migración propuesta 0102, sin implementar)

**Fuente:** decisión del dueño (2026-11-20). Protocolo `docs/13` §5: doc primero, código después. **Reemplaza en parte** `docs/00` §14.5. Las partes (a) a (h) son decisión del dueño. La parte (i) y el punto (k) son supuestos reversibles. El punto (j) es el cierre de los pendientes, resuelto por el dueño el 2026-11-20.

**Principio.** El pago sigue ejecutándose fuera de EstuRed. EstuRed no custodia fondos ni integra la API de WhatsApp Business. Cambia dónde se definen las condiciones: la residencia las configura una vez y la solicitud las muestra.

| # | Decisión |
|---|---|
| DR63 (a) | **Catálogo de medios de pago.** Es una constante de código, `lib/payments/paymentMethods.ts`, sin migración para el catálogo. Medios: efectivo, MercadoPago, transferencia en pesos, transferencia en dólares, Belo, Prex, Ualá, Brubank, PayPal, Airtm, Western Union y «Otro» (texto libre). Se amplía agregando una entrada. Claves propuestas (supuesto reversible): `cash`, `mercadopago`, `transfer_ars`, `transfer_usd`, `belo`, `prex`, `uala`, `brubank`, `paypal`, `airtm`, `western_union`, `other`. **Aclaración de términos:** «MercadoPago» del catálogo es un pago a la cuenta de quien cobra. No es el proveedor `mercado_pago` de `PaymentProvider`, que cobra el fee en forma automática. |
| DR63 (b) | **Sección «Cobro de la reserva» en la ficha (configuración de la residencia).** Define solo cómo se cobra la reserva. Los pagos posteriores los acuerda cada residencia con cada estudiante. La UI lo dice literalmente. La residencia activa una o ambas opciones. **Opción A, «Cobro con medios habilitados»:** la residencia elige los medios que acepta. Carga una sola vez los datos de cobro de cada medio (alias, CBU, usuario o instrucciones). **Opción B, «Contacto directo por WhatsApp»:** la residencia escribe al estudiante y coordina el pago. EstuRed no interviene en ese chat. La UI aclara que esto deja la coordinación en la residencia, el trabajo que EstuRed busca ahorrarle, y que la responsabilidad es suya. **Datos de cobro:** son dato sensible. Solo el dueño los edita (`profile.edit` restringido al dueño; el staff no). Se muestran al estudiante solo cuando la residencia habilita el pago de esa solicitud. **Requisito para «Enviar para revisión»:** al menos una opción, con A completa (1 medio o más y sus datos) o B. Es el requisito 10 de DR59. **Una sola opción:** el camino queda fijo. **Ambas:** la residencia elige por solicitud, al aceptarla. Textos fijos (borrador del dueño): «Esto define solo el pago de la reserva. Los pagos siguientes los acordás con cada estudiante.» / «Con contacto directo, la coordinación del pago queda en tu equipo. Es el trabajo que EstuRed busca ahorrarte.» / «Con medios habilitados, EstuRed te evita ese chat hasta la confirmación final.» |
| DR63 (c) | **Solicitud del estudiante.** Antes de enviar, el estudiante ve cómo se cobrará. Con medios habilitados, ve los medios aceptados. Con contacto directo, ve «La residencia te va a escribir por WhatsApp con el monto final y cómo pagar». Si la residencia tiene medios, el estudiante puede elegir uno como preferencia. Es opcional y trae «Lo coordino con la residencia». Se guarda en `application_requests.preferred_payment_method`. No es vinculante. |
| DR63 (d) | **Aceptar y habilitar el pago.** La residencia acepta (`submitted` o `under_review` a `contact_established`) y después habilita el pago. **Camino A:** la residencia confirma el monto final, precargado desde `snapshot_final`. Confirma el medio, precargado con la preferencia del estudiante y los datos guardados. No hay WhatsApp hasta la confirmación final, salvo que el estudiante avise un problema (l) (supuesto: «Pago recibido»). La solicitud pasa a `residence_payment_pending`. Monto, medio e instrucciones quedan congelados en `external_residence_payments` (`expected_amount_usd`, `expected_amount_ars`, `chosen_method`, `instructions_snapshot`). **Camino B:** igual que hoy. El estudiante ve solo «La residencia te va a escribir por WhatsApp». Nunca ve un número ni un botón para escribirle a la residencia (principio de (j) 2). |
| DR63 (e) | **«Ya pagué» del estudiante.** El estudiante informa el pago con el botón «Ya pagué» (aviso explícito). El comprobante es **opcional** (concepto, montos y medio ya existen). Setea `student_reported_paid_at` y el estado nuevo `student_reported_paid` de `external_residence_payments`. Avisa a la residencia (in-app y push de DR61 si corresponde). La pantalla de la residencia muestra el comprobante junto a «Pago recibido». Hoy no hay aviso ni la residencia ve el comprobante: es un hueco que se cierra. **Solo la residencia confirma** con «Pago recibido» (`docs/04` §6.3, sin cambios). |
| DR63 (f) | **Vencimiento.** «Ya pagué» **detiene** el vencimiento de 48 horas de `residence_payment_pending`. Sin esto la solicitud vence aunque el estudiante pagó. Mecanismo: el job `expireApplicationRequests` excluye las solicitudes cuyo `external_residence_payments.student_reported_paid_at` no es nulo. El sync del job deja de pasar a `expired` las filas en `student_reported_paid`. **Recordatorios (supuesto reversible):** aviso a la residencia a las 24 horas de «Ya pagué» sin confirmar. Aviso al estudiante 12 horas antes del plazo, solo si no informó el pago ni avisó un problema (l). |
| DR63 (g) | **Seguridad.** La UI avisa que EstuRed no garantiza ni custodia el pago a la residencia. Avisa que no se deben transferir fondos a datos que no vinieron por la solicitud. Pago a la residencia, fee, reserva y comprobante siguen como entidades separadas (regla 3 de `CLAUDE.md`). Los datos de cobro de la residencia y los del fee tienen configuraciones separadas. **Cláusula de responsabilidad (decisión del dueño, 2026-11-20), versión corta:** EstuRed no es responsable de ningún pago ni del medio de pago elegido. No custodia fondos. Los pagos posteriores a la reserva los acuerdan la residencia y el estudiante. **Salvedad:** el fee EstuRed lo cobra EstuRed por sus propios medios. La cláusula no cambia las reglas del fee ni del derecho de revocación (DR6). Textos legales actualizados: `docs/10` §14.5, `docs/19` §9.4, `docs/20` y `docs/21`. Sin asesor legal por decisión del dueño (2026-11-25); revisar antes de escalar. |
| DR63 (h) | **Opciones abiertas, no se implementan.** Listadas en `docs/NEXT_STEPS.md`, «Opciones para conversar con residencias pioneras»: medio fuera del catálogo; monto distinto según el medio; comisión del medio a cargo del estudiante; varias cuentas por medio; seña en vez del monto completo; pago en efectivo al llegar (hoy no cabe: el fee exige «Pago recibido» antes de la reserva). **Descartado:** que EstuRed cobre por la residencia (implicaría custodia de fondos). |
| DR63 (i) | **Pista 2: medios del fee EstuRed (supuestos reversibles; desarrollada en DR64, 2026-11-21).** Estado real hoy: el fee se cobra solo por transferencia manual a una cuenta única (`payment_settings`, 0038, una fila). El comprobante es obligatorio. `payment_channel` es texto libre. MercadoPago y PayU automáticos no están activos. Propuesta: (1) admin o superadmin configura qué medios del catálogo habilita para el fee y sus datos de cobro; la tabla es por medio y distinta de la de la residencia. Los proveedores automáticos siguen como `PaymentProvider`. (2) El pagador (estudiante o familiar pagador) elige el medio al pagar; §14.5 sigue vigente para el fee. (3) En medios manuales la pantalla muestra los datos con botón «Copiar», el botón «Ya pagué» y el comprobante (`manual_payment_file_id`). El admin valida con DR8, sin cambios. (4) En medios en USD el monto sale del tipo de cambio del `snapshot_final` (`docs/04` §8.4). (5) «Ya pagué» detiene el vencimiento de 48 horas hasta que el admin valide o rechace. **Choque con DR8 (4):** hoy `expireEsturedFeeWindows` vence también `pending_manual_payment`, y un fee vencido no se puede marcar pagado. El punto (5) exige excluir ese estado del job. **Resuelto y desarrollado en DR64 (2026-11-21):** el job deja de vencer `pending_manual_payment` y la validación no revisa `expires_at` en ese estado; DR8 (4) sigue para `pending_payment_method`. Supuesto del agente, pendiente de ratificación del dueño. En el fee el comprobante sigue obligatorio (DR8); sin comprobante solo vale el override. **Soporte:** el estudiante escribe a Soporte de EstuRed (`/students/support`). El botón análogo «No pude realizar el pago» del fee quedó decidido por el dueño: DR64 (e). |
| DR63 (j) | **Pendientes del dueño: resueltos y ratificados el 2026-11-20.** **1. Salida tras «Ya pagué»:** a las 72 horas sin «Pago recibido», alerta al admin y caso de Soporte. No hay transición automática a `disputed`. **«No recibí el pago» (decidido):** botón de la residencia sobre un pago en `student_reported_paid`. Registra la negativa con motivo de al menos 10 caracteres. Marca el pago `disputed` (`docs/04` §6.2). Avisa al estudiante. Abre un caso de Soporte. El admin resuelve. La solicitud pasa a `disputed` solo por acción de Sistema o Admin (`docs/04` §5.4, «Cualquier no terminal a `disputed`»). **2. Principio de contacto (decisión del dueño):** el estudiante nunca contacta a la residencia. Siempre la residencia lo contacta a él. No hay campo de contacto propio de la residencia (se descartó `payment_contact_phone`). En el camino B el estudiante ve solo «La residencia te va a escribir por WhatsApp». Nunca ve un número ni un botón para escribirle. La residencia usa el botón de WhatsApp existente, al número de `contact_target`. El estudiante pide ayuda a Soporte de EstuRed (`/students/support`). **3. Datos de cobro congelados (`instructions_snapshot`):** se restringe por columna. Revoke de SELECT de la columna a `authenticated`. Lectura por server action solo para el dueño de la residencia y para el estudiante de esa solicitud. El familiar vinculado de un menor también la lee, solo lectura y solo si es el pagador de esa solicitud. El staff no la lee. **4. Rótulo:** se mantiene «Cobro con medios habilitados». **5. Cambio de datos de cobro:** requiere siempre aprobación del admin (`docs/03` §7.3). Los datos nuevos quedan pendientes. Rigen los anteriores hasta la aprobación. Las solicitudes ya habilitadas conservan su `instructions_snapshot`. La primera carga la aprueba el admin al verificar la residencia. Un medio solo se ofrece al estudiante si sus datos están aprobados. Se audita con CBU enmascarado y se avisa al dueño (precedente `notifyPaymentSettingsChange`, 0038). **Fee:** el punto 5 de (i) y el choque con DR8 (4) se resuelven en DR64 (d). |
| DR63 (k) | **Supuestos reversibles de implementación.** **Residencias ya publicadas sin configuración:** se tratan como «Contacto directo por WhatsApp» (comportamiento actual). El requisito 10 igual exige elegir al enviar a revisión. **Camino A tras una propuesta de ajuste:** `conditions_accepted` a `residence_payment_pending` es automático. El sistema precarga monto de `snapshot_final` y medio de la preferencia del estudiante o del único medio. Si no resuelve el medio, la residencia lo elige desde el detalle y el plazo de 48 horas se reinicia al elegirlo. **Estado `contact_established`:** conserva su nombre. En el camino A se alcanza con «Aceptar», sin abrir WhatsApp. **«Confirmación final»:** es «Pago recibido», no la reserva confirmada. **Enum:** `student_reported_paid` se agrega con `add value if not exists` después de `student_reference_uploaded`, que queda para filas viejas. |
| DR63 (l) | **«No pude realizar el pago» (camino A, decisión del dueño 2026-11-20; efectos son supuestos reversibles).** Botón del estudiante en la tarjeta de pago, con motivo opcional corto. Avisa a la residencia (in-app y push de DR61). Habilita a la residencia a elegir por solicitud: «Contactar por WhatsApp» (botón al número de `contact_target`, como en el camino B) o «Cambiar medio / volver a habilitar el pago». **Supuestos:** (i) detiene el vencimiento de 48 horas, como «Ya pagué», hasta que la residencia responda. Al responder, el plazo de 48 horas se reinicia. (ii) Dato mínimo: `external_residence_payments.student_payment_issue_at` y `student_payment_issue_reason`, sin estado nuevo del enum. El estado sigue en `pending`. (iii) Sin respuesta: aviso a la residencia a las 24 horas y alerta al admin con caso de Soporte a las 72 horas, igual que «Ya pagué». (iv) No cambia las reglas del fee. El estudiante nunca contacta a la residencia: solo avisa con este botón o pide ayuda a Soporte. |
| DR63 (m) | **Estudiante menor de edad (decisión del dueño, 2026-11-20).** Si el estudiante es menor, la residencia contacta siempre al familiar vinculado, nunca al menor (regla vigente de `docs/00` §17.3, `application_requests.contact_target = family_member`). Aplica a todo el cobro de la reserva. **Camino B:** el botón de WhatsApp usa el teléfono del familiar. **«Ya pagué» y «No pude realizar el pago»:** los avisos y el contacto de la residencia van al familiar vinculado. **Datos de cobro y tarjeta de pago:** los ve el familiar pagador (DR63 (j).3). El menor no queda sin canal: no hay solicitud sin familiar con teléfono cargado. |

**Reemplazado en parte por DR66 (2026-11-25):** (c), (d) y (j) 2 en el copy al estudiante (ya no dice «por WhatsApp»; el contacto de la residencia al estudiante es el mismo, solo cambia el texto); (c) «Lo coordino con la residencia» pasa a «Otro»; (f) y (l) (iii) ganan el escalado a 7 días a los superadmin; la propuesta de tope de reaperturas de `docs/NEXT_STEPS.md` queda aprobada. (j) 5 y la fase 2b ya habían sido reemplazados por DR65 (c). El contacto de la residencia por WhatsApp (d) sigue igual.

**Archivos que reflejan DR63:** `docs/03` §7.1 y §12; `docs/04` §5.2, §5.8, §6, §8.10 y §13.3; `docs/06` §4.6, §8.1, §11.1, §12.1 y §12.2; `docs/07` §16; `docs/08` §6.5, §6.7, §7.2 y §7.8; `docs/NEXT_STEPS.md`.
**Textos legales actualizados por decisión del dueño (2026-11-20):** `docs/10` §14.5, `docs/19` §9.4, `docs/20` (cláusula de pago a la residencia) y `docs/21` (medios de pago). Sin asesor legal por decisión del dueño (2026-11-25); revisar antes de escalar.

### DR64: Pista 2, cobro del fee de EstuRed con medios del catálogo (2026-11-21, migración 0105 aplicada en dev, sin código)

**Fuente:** pedido del dueño del 2026-11-21 («Pista 2: misma idea para el fee de EstuRed») y su decisión de incluir «No pude realizar el pago» (punto (e)). Protocolo `docs/13` §5: doc primero, código después. Desarrolla y reemplaza el punto (i) de DR63. **Todo lo demás son supuestos del agente, pendientes de ratificación del dueño.** Se cambian en un solo lugar cada uno (ver «Reversión»).

**Principio.** Lo que cambia es cómo EstuRed muestra y recibe SU fee. EstuRed cobra su fee por sus propios medios; no custodia fondos de la residencia. Propuesta del familiar, solicitud, negociación, pago a la residencia, fee, reserva, factura y comprobante siguen como entidades separadas (regla 3 de `CLAUDE.md`). El estado `estured_fee_status` no cambia.

| # | Decisión |
|---|---|
| DR64 (a) | **Los medios del fee los configura el admin.** Tabla `estured_fee_collection_methods` (0105): una fila por medio del catálogo común (`lib/payments/paymentMethods.ts`, DR63 (a)), con `details` (datos de cobro de EstuRed), `currency` (`ARS` o `USD`) e `is_enabled`. Es distinta de `residence_collection_accounts`. RLS sin policies: solo service role. **Quién escribe:** solo un `superadmin`, igual que `payment_settings` (0038). El admin común ve un resumen con datos enmascarados (`maskPaymentDetails`). Cada cambio se audita con datos enmascarados y avisa a todos los superadmin, sin datos de cobro. **Sin aprobación de un segundo admin (supuesto):** en dev hay un solo superadmin y el flujo se trabaría; el aviso a todos los superadmin es la mitigación. Si el dueño la quiere, se suman columnas `pending_*` como en 0102. **Moneda por medio:** la define el admin en cada fila; fija `estured_fee_payments.payment_currency` y la comparación de monto de DR8 (2). **Respaldo:** mientras no haya ningún medio habilitado, el código usa la fila de `payment_settings` como `transfer_ars` (comportamiento de hoy). El admin la importa a la tabla nueva desde su pantalla, por server action. Ninguna migración copia el CBU. Los proveedores automáticos (`mercado_pago`, `payu_argentina`) siguen como `PaymentProvider` y no están activos. «MercadoPago» del catálogo es un pago a la cuenta de EstuRed, no ese proveedor. |
| DR64 (b) | **El pagador ve y elige.** Pagador = el designado del fee (`payer_user_id`, DR4): el estudiante, o el familiar vinculado con `can_pay_estured_fee` (en un menor, el familiar pagador). El servidor revalida el vínculo y el permiso en cada acción. Ve el monto en la moneda del medio, los medios habilitados, los datos de cobro con botón «Copiar» y el n.º de reserva como referencia. En USD el monto sale del tipo de cambio del `snapshot_final` (`docs/04` §8.4). Al elegir, el servidor guarda `chosen_method` y `payment_currency` y congela `instructions_snapshot`. Puede cambiar de medio mientras el fee esté en `pending_payment_method`. Los datos de cobro se leen por server action solo para el pagador designado y el admin; la residencia no los ve. El pagador no escribe a EstuRed por chat: usa Soporte. |
| DR64 (c) | **«Ya pagué» con comprobante obligatorio.** «Ya pagué» es el registro del pago que ya existe (`registerManualFeePayment`, `docs/07` §17.3). **No se relaja DR8 (1):** el comprobante sigue obligatorio (a diferencia de la reserva, DR63 (e)), porque el admin valida contra él. Pasa el fee de `pending_payment_method` a `pending_manual_payment` y setea `student_reported_paid_at`. El medio queda fijo. Avisa a los admins. «Confirmar sin comprobante» sigue siendo solo del admin (DR8 (1)). Quien no tiene comprobante usa «No pude realizar el pago» (e). |
| DR64 (d) | **Validación del admin y choque con DR8 (4).** La validación es la de DR8, con una sola enmienda: **un fee en `pending_manual_payment` no vence.** Razón: el registro del pago exige plazo vigente, así que un fee en ese estado ya fue informado a tiempo. Hoy el job `expireEsturedFeeWindows` lo vence igual, y DR8 (4) impide marcar pagado un fee vencido: el estudiante que pagó a tiempo perdería la reserva por la demora de EstuRed. Solución: el job excluye `pending_manual_payment` (cubre también filas anteriores, sin backfill) y la validación no revisa `expires_at` en ese estado. **DR8 (4) sigue vigente** para `pending_payment_method`: sin «Ya pagué», un fee vencido no se marca pagado ni con el override. Vale para reservas y renovaciones (misma tabla y mismo job). **«No recibí el pago» (decisión de modelo):** el admin escribe un motivo de 10 a 500 caracteres. **No hay estado nuevo:** se guardan `admin_disputed_at`, `admin_dispute_reason` y `admin_disputed_by_user_id`; el fee sigue en `pending_manual_payment` y la reserva en `pending_estured_fee`. La reserva no pasa a `disputed`: eso cambia `LIVE_RESERVATION_STATUSES` y `docs/04` §5.4 lo reserva a Sistema o Admin. Avisa al pagador con texto genérico (sin el motivo) y abre un caso de Soporte de tema `estured_fee_payment` (0040, sin residencia). Con disputa abierta el fee no vence ni se re-alerta. **Salida:** Soporte (superadmin o admin) valida con DR8 (limpia la disputa) o **reabre**: el fee vuelve a `pending_payment_method`, `expires_at = now() + 48 h`, se limpian `student_reported_paid_at`, `manual_payment_file_id` y la disputa, y el pagador sube otro comprobante. Es la acción `reopenEsturedFeeWindow`, extendida (hoy solo vale para `expired`). Sin la reapertura, `registerManualFeePayment` rechazaría la carga por plazo vencido. |
| DR64 (e) | **«No pude realizar el pago» (decisión del dueño; efectos son supuestos).** Botón del pagador con motivo opcional (si lo escribe, de 10 a 200 caracteres). Guarda `student_payment_issue_at` y `student_payment_issue_reason`. El fee sigue en `pending_payment_method`. **Frena el vencimiento de 48 h** mientras `student_payment_issue_resolved_at` sea nulo. Avisa a los admins (in-app y push de DR61). El admin responde con una de dos acciones, y las dos reinician `expires_at` a 48 h y cierran el aviso: **«Contactar al pagador»** (abre un caso de Soporte `estured_fee_payment` a nombre del pagador) o **«Reabrir el pago»** (permite elegir otro medio). Un aviso nuevo tras una respuesta pisa `student_payment_issue_at` y limpia `_resolved_at` (una marca por pago). Con «Ya pagué» y aviso abierto a la vez, se rechaza «Ya pagué» hasta que el admin responda (igual que DR63). El botón existente «Tengo un problema con el pago» (Soporte, `docs/08` §6.8) sigue como enlace secundario. El pagador nunca contacta a EstuRed por WhatsApp. |
| DR64 (f) | **Recordatorios y alerta.** Job nuevo `remindFeePayments`, dentro de `runExpirationJobs`, cada hora e idempotente con marcas `*_sent_at` (`docs/07` §17.10). **12 h antes de `expires_at`**, sin «Ya pagué» ni aviso de problema: aviso al pagador (`payer_reminder_sent_at`). **24 h** de `student_reported_paid_at` sin validar ni disputa, o de `student_payment_issue_at` sin responder: aviso a los admins (`admin_reminder_sent_at`). **72 h** de lo mismo: alerta a los admins y caso de Soporte `estured_fee_payment`, único por reserva (`admin_alert_sent_at`). Sin transición automática. El servidor limpia las tres marcas en cada evento nuevo (nuevo «Ya pagué» o aviso). Las filas anteriores a 0105 no tienen `student_reported_paid_at` y no reciben estos avisos (no hay datos reales en producción). |
| DR64 (g) | **Texto legal (sin asesor legal por decisión del dueño, 2026-11-25; revisar antes de escalar).** EstuRed cobra su propio fee y por eso no puede decir «no se responsabiliza» de ese cobro. Redacción propuesta: «EstuRed responde por registrar, validar y comprobar el pago de su propio fee. EstuRed no responde por fallas, demoras o costos de bancos, billeteras o medios de pago de terceros, ni por pagos hechos a datos que no vinieron de su pantalla de pago.» La cláusula de DR63 (g) sobre pagos a la residencia no cambia. Reflejado en `docs/10` §14.5, `docs/19` §9.4, `docs/20` y `docs/21`, marcado `LEGAL_REVIEW_PENDING` (sin asesor: DR66 (d)). |
| DR64 (h) | **Opciones abiertas, no se implementan.** Solo listadas en `docs/NEXT_STEPS.md`: varias cuentas por medio; recargo o descuento según el medio; fee en cuotas; cobro automático con MercadoPago o PayU; aprobación de un segundo admin para cambiar datos de cobro; conciliación automática por webhook. |
| DR64 (i) | **Tope de reaperturas y escalado: aprobado y reemplazado por DR66 (a) (2026-11-25).** Máximo 2 reaperturas por fee. Un «Ya pagué» o «No pude realizar el pago» sin respuesta no vence a los 7 días: escala a todos los superadmin, una sola vez. La propuesta original de vencer a los 7 días el «No pude realizar el pago» quedó descartada. |

**Alcance.** El congelamiento del vencimiento y la regla de plazo de (d) aplican a todo fee en `pending_manual_payment`, de reserva o de renovación. La pantalla de medios y la tarjeta del pagador se implementan primero para el fee de la reserva. La renovación (`registerRenewalManualFeePayment`, `recordRenewalManualFeePayment`) mantiene `payment_settings` como respaldo hasta una fase posterior. DR8 (f) no cambia.

**Reversión.** (a): sin aprobación del segundo admin, se agrega `pending_*`. (c): el comprobante opcional exigiría cambiar DR8 (1). (d): volver al job anterior exige borrar la enmienda y mover la validación a un plazo propio. (e) y (f): no hay otro dato que la marca; se quitan sin migración. La migración 0105 es aditiva y trae su `REVERTIR`.

**Archivos que reflejan DR64:** `docs/03` §13; `docs/04` §8.4, §8.8 y §8.10; `docs/06` §8.9 y §13.2; `docs/07` §17.3 y §17.6 a §17.11; `docs/08` §6.8 y §8.10; `docs/NEXT_STEPS.md`; `db/migrations/0105_estured_fee_collection.sql`.
**Textos legales (sin asesor legal por decisión del dueño, 2026-11-25; revisar antes de escalar):** `docs/10` §14.5, `docs/19` §9.4, `docs/20` y `docs/21`.

### DR65: Ola 0 de la auditoría legal, decisiones del dueño sin asesor (2026-11-22)

**Fuente:** `docs/audits/AUDITORIA_LEGAL_2026-11-21.md`, «Respuestas del dueño sin asesor» y «Ola 0 ajustada». Protocolo `docs/13` §5: doc primero, código después. Los riesgos N1 que no se cierran quedan como **riesgo aceptado por el dueño**, no como resueltos.

| # | Decisión |
|---|---|
| DR65 (a) | **Sin antecedentes penales (LEG-003).** EstuRed no pide ni deja pedir certificados de antecedentes penales. Se quita «Antecedentes penales» del catálogo de DR38 (clave `criminal_record`), del perfil del estudiante y del acceso de la residencia a documentos (DR48). El valor `student_criminal_record` queda en el enum (Postgres no borra valores); los archivos viejos quedan sin acceso para la residencia y se ven solo desde admin. Una configuración guardada con `criminal_record` se ignora al leerla. Reemplaza DR38 (1), (6) y (7) en lo que nombran antecedentes. |
| DR65 (b) | **Arrepentimiento sin «uso indebido» (LEG-009).** Dentro de los 10 días corridos el reintegro del fee es incondicional: no hace falta explicar el motivo y el uso del servicio (contacto con la residencia, acuerdos por fuera) **no** es causa para denegarlo. Se quitan «salvo que la revisión detecte un uso indebido» y el cotejo con la residencia por uso indebido. El admin igual registra el reintegro (no es automático: se transfiere a mano). Denegar dentro del plazo queda solo para causas que no son el uso del servicio, por ejemplo un pedido duplicado o hecho por error, siempre con motivo. **Se mantiene el login** (decisión del dueño, riesgo aceptado frente al botón sin cuenta). **Código de seguimiento:** al registrar la revocación se envía por email a quien revocó un código `ARR-XXXXXXXXXX` (derivado del id de la reserva) y se muestra en «Botón de arrepentimiento». Reemplaza en DR6 el «causa justificada» genérico y el cotejo por bypass. |
| DR65 (c) | **EstuRed no aprueba los datos de cobro de la reserva (LEG-014).** Cada residencia responde por los datos que carga. El dueño guarda los datos de cobro y quedan **vigentes al guardar** (`details`/`method_label`); se elimina la aprobación del admin (`/admin/collection-approvals`, `lib/residences/collectionApproval*.ts`) y el paso `pending_*` (las columnas quedan en el esquema sin uso; la migración 0109 promueve los pendientes y las limpia). Se mantiene: solo el dueño edita (el staff no), auditoría con datos enmascarados y aviso in-app al dueño en cada cambio (control contra cambios no autorizados). Lo ya congelado en una solicitud (camino A) no cambia. Textos: TP-04 §5 en `/terms/residencias` y TP-06 en `/terms` §14 y en la tarjeta de pago («EstuRed no revisa ni aprueba esos datos»). Reemplaza en DR63 la aprobación del admin de (b), (j) punto 5 y la fase 2b. |
| DR65 (d) | **MFA de admin y confirmación de email en el alta (LEG-025; decisiones del dueño 2026-11-25; implementado en `6c58053`).** MFA TOTP obligatorio (`aal2`) para admin y superadmin, exigido en `getAdminSession`/`requireAdmin` (las acciones admin usan service role: RLS no alcanza); la pantalla de enrolar/verificar queda fuera del layout admin protegido. **Los admins demo quedan exentos en staging:** solo se salta con `DEMO_LOGIN_ENABLED`, que jamás va a Production. **Confirmación de email solo en el registro abierto** (estudiante y familiar) y **solo con dominio verificado** (`EMAIL_FROM` configurado): en staging (Resend sandbox) el alta sigue sin confirmar. Las invitaciones de staff y de residencia ya prueban el email con el enlace del token. |
| DR65 (e) | **Cuenta del menor en espera hasta el consentimiento del familiar (LEG-004; decisión del dueño 2026-11-21, «cuenta en espera»).** Un estudiante de 14 a 17 años (minoría calculada por `birth_date` al momento de cada acción, no por `is_minor`) puede crear su cuenta, pero queda **en espera**: solo puede vincular a su familiar, verlo y pedir Soporte. No puede cargar documentos ni su número de documento, editar su perfil, enviar solicitudes, aprobar propuestas del familiar, aceptar reglamentos, sumarse o activarse desde la lista de espera, pedir o activar una estadía (también por invitación de una residencia, que además sigue DR32). Sale de la espera cuando un familiar con **vínculo activo** registra su consentimiento (`consents`, `consent_type = guardian_consent`, `user_id` = el familiar, `related_entity` = el perfil del estudiante; texto TP-07 en `lib/legal/clauses.ts`). Tampoco guarda favoritos ni envía preguntas con sesión; el familiar sin consentimiento propio no propone solicitudes ni sugiere favoritos para el menor (decisión del dueño, 2026-11-25). Si el vínculo se revoca, el consentimiento de ese familiar deja de contar. El control vive en el servidor (cada acción) y la UI lo explica con un aviso. **Reemplaza en DR43 (2)** «el familiar no da consentimientos por el estudiante» y el piso de 18 años para la cuenta propia fuera de la preapertura. La preapertura conserva su regla (18). |

### DR66: tope de reaperturas, copy sin WhatsApp, «Otro» y sin asesor legal en el cobro de la reserva y del fee (2026-11-25, migración 0110)

**Fuente:** decisiones del dueño del 2026-11-25. Protocolo `docs/13` §5: doc primero, código después. Cierra los pendientes de DR63 (`docs/NEXT_STEPS.md`) y DR64 (i). **Reemplaza en parte** DR63 (c), (d), (f), (j) 2 y (l), y DR64 (i).

| # | Decisión |
|---|---|
| DR66 (a) | **Tope de reaperturas y escalado a 7 días.** Máximo **2 reaperturas por pago**, en la reserva y en el fee. Contador `reopen_count int not null default 0` en `external_residence_payments` y en `estured_fee_payments` (0110). **Reserva:** cuenta «Volver a habilitar el pago» de la residencia. **Fee:** cuenta la reapertura de un fee vencido, la reapertura tras «No recibí el pago» y «Reabrir el pago» como respuesta a «No pude realizar el pago»; la renovación usa la misma tabla y el mismo contador. Con 2 reaperturas hechas, el botón se deshabilita con mensaje claro y el servidor rechaza: después solo resuelve Soporte. El servidor lo hace cumplir con compare-and-set sobre `reopen_count` (dos reaperturas simultáneas no pasan el tope). **Sin vencimiento a los 7 días:** un aviso sin respuesta (reserva y fee: «Ya pagué» sin confirmar o validar, «No pude realizar el pago» sin responder) a los 7 días **escala a todos los superadmin**: aviso in-app, una sola vez, idempotente con la marca `admin_escalated_at` (columna nueva en las dos tablas, reclamada con update condicional y devuelta si el aviso no salió, igual que los recordatorios de DR63 (f) y DR64 (f)). No vence ni cambia estado. El escalado es una pasada aparte dentro de `remindResidencePayments` y `remindFeePayments` (sin endpoint nuevo), porque a los 7 días la alerta de 72 h ya salió. Un pago en disputa no escala (ya lo atiende Soporte). Cada evento nuevo limpia también `admin_escalated_at`. Las columnas nuevas no se conceden a `authenticated` (solo service role). |
| DR66 (b) | **Copy al estudiante sin WhatsApp y opción «Otro».** Ningún texto que ve el estudiante o su familiar sobre cómo lo contacta la residencia nombra WhatsApp. Ejemplo: «La residencia te va a escribir por WhatsApp con el monto final y cómo pagar» pasa a «La residencia te va a indicar el monto final y cómo pagar». Aplica a la tarjeta de pago, los avisos de pago habilitado, el estado visible y los mensajes de error del estudiante. **No cambia** el lado de la residencia: el contacto de la residencia al estudiante por WhatsApp (botón con el número de `contact_target`) sigue siendo la regla de DR63 (d). **«Otro»:** en la preferencia de medio de la solicitud (`ReservationCollectionPreference`), el estudiante puede elegir «Otro» cuando ningún medio ofrecido le sirve. Reemplaza y absorbe «Lo coordino con la residencia». Al elegirlo ve exactamente «La residencia se pondrá en contacto con vos para definir una forma de pago alternativa.»; con un menor, la variante «La residencia se pondrá en contacto con tu familiar vinculado para definir una forma de pago alternativa.» (supuesto, por DR63 (m)). Se guarda en `application_requests.preferred_payment_method` con la clave reservada `alternative` (no es la clave `other` del catálogo, que configura la residencia con nombre propio). Cumple el CHECK de 0102: sin cambio de esquema; 0110 solo actualiza el comentario de la columna. Sin elegir nada, la preferencia queda en `null` = «sin preferencia» (antes `null` era «Lo coordino»; ya no hay opción marcada por defecto). Con la oferta de contacto directo no hay selector. Validación en servidor (`resolvePreferredPaymentMethod`): acepta una clave ofrecida, `alternative` o vacío; cualquier otra clave es error. La residencia ve «Otro: coordinar forma de pago alternativa» en el panel de cobro de la solicitud. El estudiante nunca contacta a la residencia; si es menor, el contacto va al familiar vinculado. En el pago de la reserva el estudiante no elige medio (lo fija la residencia, DR63 (d)) y en el fee EstuRed no se agrega «Otro»: la selección con «Otro» es solo la preferencia de la solicitud. |
| DR66 (c) | **El requisito 10 de «Enviar para revisión» (DR59/DR63) no exige datos de cobro aprobados.** Tras DR65 (c) la aprobación del admin no existe y el código ya no la pide. Se mantiene (supuesto reversible): elegir al menos una opción de cobro («Contacto directo por WhatsApp» o «Cobro con medios habilitados») y, con medios, cargar los datos de cada medio aceptado. Si el dueño prefiere quitar el requisito entero, se borra `evaluateCollectionRequirement` del cálculo de `submitReadiness` y su test. Se actualizó el texto de `submitReadiness.ts` que todavía hablaba de «aprobados o pendientes de aprobación». |
| DR66 (d) | **Sin asesor legal por ahora.** Los textos de `docs/10`, `docs/19`, `docs/20` y `docs/21` sobre la reserva y el fee los redacta el equipo lo mejor posible. Las marcas «pendiente de revisión legal / del asesor» de DR63 y DR64 se reemplazaron por «sin asesor legal por decisión del dueño (2026-11-25); revisar antes de escalar». No se toca el contenido legal de DR65 ni `lib/legal/*`. |
| DR66 (e) | **Supuestos reversibles.** (1) **«Contactar por WhatsApp»** (respuesta de la residencia a «No pude realizar el pago») y **«Contactar al pagador»** (fee) no cuentan como reapertura y no se bloquean con el tope: no reabren el pago. Tras «Contactar por WhatsApp» la solicitud queda en `whatsapp_direct` y ya no se puede volver a habilitar. (2) La primera habilitación del pago (`enableResidencePaymentCore`, `chooseResidencePaymentCollectionCore`) no es una reapertura. (3) En un fee vencido con el tope alcanzado no queda un camino en pantalla para el admin: decidido en DR66 (f). (4) El escalado avisa a los superadmin activos; sin ninguno, devuelve la marca y reintenta en la próxima corrida. (5) Las renovaciones no tienen contador propio: su fee usa el de `estured_fee_payments`, y las reaperturas de `reopenRenewalRequest` y `reopenRenewalOffer` reabren solicitudes y ofertas, no pagos. |
| DR66 (f) | **Fee vencido con el tope alcanzado: sin override (dueño, 2026-11-25).** No se agrega una acción de superadmin para reabrir más veces. Soporte resuelve manualmente. Ningún botón revive ese fee: un fee `expired` no se valida (`evaluateManualFeePayment`) y la reapertura se rechaza por el tope. |
| DR66 (g) | **«Otro» habilita el contacto directo en esa solicitud (dueño, 2026-11-25, opción (b)).** Con `preferred_payment_method = alternative`, «Contacto directo por WhatsApp» es un camino válido para esa solicitud, aunque la residencia cobre solo con medios. La residencia ve el botón de contacto desde `contact_established`, y en `residence_payment_pending` mientras no definió el camino. Con un menor, el botón va al familiar vinculado. Esto adelanta la visibilidad del teléfono: sin «Otro», una residencia solo con medios no lo ve. La residencia elige entre ambos caminos; la pantalla preselecciona el contacto directo (supuesto reversible). Lo puede usar quien tenga `payments.residence`, incluido el staff (misma regla de DR63 para el contacto directo). El servidor lo valida en `availableCollectionPaths`. Sin «Otro», nada cambia. Sin migración. |

**Reversión.** (a): subir el tope es cambiar `MAX_PAYMENT_REOPENS` en `lib/payments/reopenCap.ts` (no hay CHECK de máximo en la base). Quitar el escalado es borrar la pasada `runSuperadminEscalation` de los dos jobs. (b): el valor `alternative` ya guardado queda como texto inocuo si se quita el selector. La migración 0110 es aditiva e idempotente y trae su `REVERTIR`.

**Archivos que reflejan DR66:** `docs/04` §5.8, §8.8 y §8.10; `docs/06` §8.x (`preferred_payment_method`), §12.1 y §13.2; `docs/07` §16.8, §16.10 y §17.9b; `docs/08` §4.5/§6.5 y §6.7; `docs/NEXT_STEPS.md`; `docs/PLAN_SALIDA_PRODUCCION.md`; `db/migrations/0110_payment_reopen_cap_and_escalation.sql`.

### DR67: WhatsApp, Google, registro sin contraseña, número de registro y popup de preapertura (2026-11-25, implementado en parte: bloque A)

**Fuente:** decisiones del dueño del 2026-11-25. Protocolo `docs/13` §5: doc primero, código después. Reemplaza DR26. Modifica DR43 (paso 1 y número) y `docs/23` §3.

| # | Decisión |
|---|---|
| DR67 (a) | **Se elimina la prohibición de la API de WhatsApp Business.** EstuRed puede usar WhatsApp para sus comunicaciones: bienvenida, número de registro, instrucciones y novedades. La persona elige mail o WhatsApp. Envío solo con consentimiento explícito. Sin proveedor configurado, el sistema degrada sin romper. El contacto residencia–estudiante no cambia (botón manual `wa.me`). Prevalece sobre las menciones contrarias en `docs/02`–`21`. |
| DR67 (b) | **Registro con Google.** Se suma «Continuar con Google» para estudiantes y familiares. La cuenta de preapertura se crea recién tras pedir fecha de nacimiento (18+), casillero de términos y canal. Residencias y staff siguen solo por invitación. En navegadores internos (Instagram, Facebook) Google bloquea el acceso: ahí se ofrece email o abrir en el navegador. |
| DR67 (c) | **Paso 1 sin contraseña.** Email obligatorio. El servidor genera una contraseña interna aleatoria. La persona define la suya con un enlace. El popup ya no muestra «¿Ya te sumaste? Ingresá». El aviso «Ya hay una cuenta con ese email» ofrece mandar un enlace. |
| DR67 (d) | **Número de registro.** Aparece solo después de registrarse. Empieza en 11 y nadie recibe del 1 al 10. Se guarda fijo en cada fila (secuencia), no se recalcula. Texto: «Tu número de registro». Se quitan «persona en sumarse», «Es solo el orden en que te sumaste» y el «#N si terminás ahora» del paso 1. El contador público de estudiantes sigue siendo real. Supuesto reversible: solo los estudiantes reciben número. |
| DR67 (e) | **Popup.** Título: «Muy pronto: encontrá y reservá tu residencia en Buenos Aires, con la seguridad de elegir bien.». «Enterate primero» destacado. «Acceso anticipado abierto» más visible, animado solo con `transform` y `opacity`. «Soy familiar» pasa al paso 1. En celular, la tarjeta de fundadoras se ve sin desplazarse y el carrusel baja. **Propuesta pendiente de aprobar con el mockup:** tres beneficios en vez de «Sumarte es gratis», botón «Quiero enterarme primero», «1 minuto · Gratis», y tarjeta de fundadoras con los beneficios de DR46. |
| DR67 (f) | **15 lugares de fundadora** (modifica DR46.1). El medidor sigue mostrando solo altas reales. El dueño confirmó (2026-11-25) que existen 4 residencias fundadoras: se cargan por `/fundadoras/datos` y el medidor las cuenta. Si una es propia, no va por ese formulario (contaría como externa, DR46.2). |
| DR67 (g) | **Perfil obligatorio** (modifica DR43.4). «Completar mi perfil» es la acción principal tras el registro; se quita «Lo completo después». Supuesto reversible: obligatorios nombre, país, universidad, carrera, mes de ingreso y tipo de habitación; opcionales hábitos, intereses y comunidad (consentimiento). |
| DR67 (h) | **Carrusel** (modifica DR44.3): 10 perfiles ficticios, sin rótulo en la sección ni en las fichas, y sin borde punteado. Mientras haya al menos un ficticio, el título es «Así vas a ver a tus posibles compañeros», sin punto «en vivo». «Se están sumando» vuelve solo cuando todas las fichas sean reales. Fichas más grandes: avatar con bandera, carrera y dos etiquetas. El contador sigue desde 25 registrados reales. |
| DR67 (i) | **Popup:** microcopy «Gratis. Sin tarjeta.» (reemplaza «1 minuto · Gratis»). Se quita la etiqueta «Así se va a ver EstuRed» (también en fundadoras). Términos y Privacidad al pie de ambos popups. La etiqueta de «Mi lugar» sigue. **Implementado:** etiqueta, enlaces y, el 2026-11-26, el resto del popup (bloque A). Beneficios del popup (dueño, 2026-11-26): «Residencias verificadas en persona», «Reglas y costos claros», «Conocé la comunidad antes de elegir» (reemplaza «Aviso apenas abramos»). |

**Pendientes del dueño:** número de WhatsApp y cuenta de Meta; plantillas; cliente OAuth de Google (dev y prod).
**Pendiente antes de enviar WhatsApp:** Privacidad (teléfono, Meta como encargado), `lib/legal/termsText.ts` (hoy dice que WhatsApp no es canal), `docs/21` y versión de consentimiento.
**Estado (2026-11-26):** bloque A implementado en `staging`: (d), (e) sin «Soy familiar» en la entrada, (f), (g), (h) e (i). Migración 0111 aplicada en dev; en producción, pendiente. Sin código: (a), (b) y (c).
**Supuestos reversibles del bloque A:** los ejemplos se apagan con 10 perfiles reales; las fichas muestran 2 etiquetas; con el perfil completo el botón principal es Instagram; en celular el popup ocupa la pantalla; con la convocatoria cerrada no se listan beneficios de fundadora; el retiro de la comunidad se guarda aunque falten datos del perfil.
**Reversión:** (i) vuelve restaurando la etiqueta en `BlurredPreview` y quitando `LegalLinks`. El bloque A vuelve revirtiendo sus commits; la columna de 0111 puede quedar sin uso.

### DR68: textos de las páginas públicas, «solicitar», orden de las landings y apertura (2026-11-26)

**Fuente:** el dueño aprobó cada texto de a uno (2026-11-25 y 26). Protocolo `docs/13` §5. Textos exactos: `docs/propuestas/TEXTOS_PUBLICOS_2026-11-26.md`.

| # | Decisión |
|---|---|
| DR68 (a) | **Frases vetadas.** Se quitan «Explorar es gratis» y «Cada solicitud la confirma la residencia», y sus paráfrasis. Reemplaza DR55 (2). «Sujeta a confirmación» sigue en ficha, formulario, reglamento, emails y legales (DR25 se mantiene). |
| DR68 (b) | **«Solicitar».** El copy dice «enviar tu solicitud de reserva», en páginas públicas, ficha, registro, paneles y metadata. Renovación y cambio de habitación usan «pedir». `StatusTag`: «Disponibilidad informada por la residencia. Requiere confirmación al enviar tu solicitud de reserva.» |
| DR68 (c) | **Home.** Textos nuevos de hero. Orden: hero, 4 pasos, «Por qué EstuRed», residencias con comunidad, audiencias, guías, 5 preguntas y cierre. Reemplaza DR22 A.2, A.4 y A.5. La home deja de mencionar la propuesta de ajuste (`docs/08` §4.1). |
| DR68 (d) | **Comprobante.** «Comprobante verificable» y «código verificable» pasan a «comprobante de reserva» y «código y QR». Modifica DR13 (1) y DR15 (1). `/verify` no cambia. |
| DR68 (e) | **`/for-students`.** Hero y beneficios nuevos. «Qué pagás y cuándo» reemplaza «Paso a paso» y «Qué pagás y a quién». Modifica DR22 B y DR15 (2). |
| DR68 (f) | **`/for-residences` y `/fundadoras`.** Título «Menos mensajes repetidos, mejor gestión». La ficha pública se presenta antes de «Previsibilidad». |
| DR68 (g) | **Buscadores.** Las descripciones dicen «visitadas en persona», sin «verificadas» (LEG-017). |
| DR68 (h) | **Apertura con el sello.** Dura 2,5 s, aparece una vez por visita y un toque la saltea. Con «reducir movimiento» el sello queda quieto. |
| DR68 (i) | **Riesgos avisados y aceptados por el dueño:** «seguridad de elegir bien» (LEG-015/016), «todo queda registrado» (la conversación por fuera no se registra) y la bajada de comunidad (carrera, intereses y hábitos vienen apagados). |

**Sin cambios:** `/terms`, `/privacy` y `docs/20`/`docs/21` conservan «al solicitar»; cambiarlos exige versionar el texto legal. Pendiente del dueño.

### DR69: desde el día 45 sin actualizar disponibilidad no entran solicitudes (2026-11-26)

**Fuente:** decisión del dueño. Reemplaza la regla de `docs/03` §9.6 y `docs/04` §10.4.

| # | Decisión |
|---|---|
| DR69 (a) | **Días 30 a 45** (`not_updated`): la habitación admite solicitudes, con advertencia visible. |
| DR69 (b) | **Desde el día 45** (`hidden_from_search_at` con valor): ese tipo de habitación no admite solicitudes nuevas, tampoco con el link directo. Se valida en el servidor. |
| DR69 (c) | **Alcance:** solicitud del estudiante, propuesta del familiar, envío de una propuesta aceptada y activación desde la lista de espera. Lo ya enviado no cambia. No habilita lista de espera. |
| DR69 (d) | **Reactivación:** la residencia actualiza su disponibilidad y el tipo vuelve a recibir solicitudes. |

**Pendiente:** el job no avisa a la residencia, aunque `docs/07` §14.3 dice «notificar». Hoy solo hay aviso en su panel (`GAPS.md`).

### DR70: monto fijo en «Pago recibido» (2026-11-25, sin implementar)

**Fuente:** decisión del dueño (opción A). Aclara DR63 (d).

| # | Decisión |
|---|---|
| DR70 (a) | «Pago recibido» muestra el monto acordado, sin editar. La residencia elige la moneda y confirma. Aplica solo a solicitudes. |
| DR70 (b) | Si el monto no coincide, la residencia no confirma y abre un caso de Soporte. |
| DR70 (c) | Las renovaciones siguen como hoy, con monto libre (dueño, 2026-11-26). |

**Estado:** textos aprobados (`docs/propuestas/TEXTOS_PESOS_Y_PAGO_2026-11-26.md` §4). Falta el código. El choque con §13.3 lo resolvió DR72.

**Pendiente:** `docs/03` §16.3 pide «monto requerido para asegurar renovación, si aplica». La oferta no tiene ese campo (`GAPS.md`).


### DR71: ajustes del popup de preapertura (2026-11-26)

**Fuente:** decisión del dueño, tras revisar staging. Modifica DR67 (e) y DR68 (f).

| # | Decisión |
|---|---|
| DR71 (a) | **Título de la entrada:** «Muy pronto: Reservá tu residencia en Buenos Aires, con la seguridad de elegir bien.». Sin «Encontrá». |
| DR71 (b) | **Celular:** la entrada vuelve a verse como popup sobre la página blureada, con margen y bordes redondeados. |
| DR71 (c) | **Tarjeta de fundadoras del popup:** etiqueta, pregunta y cupo centrados. |
| DR71 (d) | **`/fundadoras`:** título «Menos mensajes repetidos, mejor gestión.» y debajo «Sin costo para tu residencia.». El botón «Quiero que me contacten» va después del encabezado. La insignia y el Plan Premium pasan a la lista de beneficios. |

### DR72: la cotización en pesos queda fija al enviar la solicitud de reserva (2026-11-26)

**Fuente:** decisión del dueño. Reemplaza la regla «al momento del pago» de §13.3 y de `docs/03` §8.1 y §8.5 (3).

| # | Decisión |
|---|---|
| DR72 (a) | La cotización del snapshot queda fija al enviar la solicitud de reserva. En la propuesta del familiar, al aprobarla el estudiante. Vale para el pago de la reserva y el fee. La propuesta de ajuste no la cambia (§13.4). |
| DR72 (b) | La residencia asume la variación del dólar entre el envío y el cobro. |
| DR72 (c) | Supuesto reversible (`docs/13` §4): en renovaciones, la cotización queda fija cuando la residencia crea la oferta. Es el comportamiento actual. |
| DR72 (d) | Supuesto reversible (`docs/13` §4): los pagos posteriores los acuerda cada residencia con cada estudiante (DR63 (b)). Esta regla no los alcanza. |
| DR72 (e) | El pago de la reserva en pesos queda fijo redondeado a múltiplos de 500 (§13.5). Vale para solicitudes nuevas. Las enviadas conservan su monto. El fee no cambia. |
| DR72 (f) | Con contacto directo, la tarjeta de pago muestra el monto en USD y ARS y la fecha límite. Nunca un teléfono. Modifica DR63 (c) y (d). |

**Textos exactos:** `docs/propuestas/TEXTOS_PESOS_Y_PAGO_2026-11-26.md`. (a) a (e) aplicados en la fase 1 (`staging`, 2026-11-26); (f), en la fase 2. Al publicar hay que avisar los cambios antes de que rijan (`/terms` §30; condiciones de residencias §13).

### DR73: un caso de Soporte por el pago frena el vencimiento (2026-11-26, sin implementar)

**Fuente:** decisión del dueño. Modifica DR63 (f).

| # | Decisión |
|---|---|
| DR73 (a) | Un caso de Soporte abierto sobre el pago de una reserva frena el vencimiento de 48 horas de esa solicitud. |
| DR73 (b) | Sin «Ya pagué» ni caso abierto, la solicitud vence en plazo. El estudiante puede abrir un caso en Soporte para intentar resolverlo. |
| DR73 (c) | Si el caso se cierra con el plazo vencido y sin «Pago recibido», corre un plazo nuevo de 24 horas. Se avisa al estudiante y a la residencia. |
| DR73 (d) | Los formularios de Soporte y `/terms` suman la excepción a «abrir un caso no suspende». Modifica `docs/03`, `04`, `05`, `07`, `20` y `21` en ese punto. |

**Supuesto reversible** (`docs/13` §4): el plazo nuevo solo corre si nada más lo frena («Ya pagué» o un problema de pago abierto).

### DR74: alertas de pago de la reserva (2026-11-26, sin implementar)

**Fuente:** decisión del dueño. El pago pendiente es una instancia crítica. Modifica DR63 (d) y (j).

| # | Decisión |
|---|---|
| DR74 (a) | Alertas por mail y WhatsApp a las 12, 24, 36 y 42 horas del plazo de 48, mientras no se haga el pago. Avisan lo que puede pasar. |
| DR74 (b) | A las 42 horas se avisa también a la residencia. Puede contactar al estudiante para que pague, o saber que la solicitud puede vencer. |
| DR74 (c) | El contacto directo suma «Ya pagué», con comprobante opcional, como en medios habilitados. Frena el plazo y dispara los mismos avisos. |

**Supuestos reversibles** (`docs/13` §4): las horas cuentan desde que corre el plazo y se reinician si el plazo se reinicia. Reemplazan el recordatorio de 12 horas antes. Se frenan con «Ya pagué», un problema de pago abierto, un caso abierto o «Pago recibido». No llevan montos ni datos de cobro. Con un menor, avisan también al familiar. A las 42 horas la residencia ve el botón de contacto en ambos caminos. No alcanzan a las renovaciones.

**Límites conocidos:** los avisos del estudiante hoy salen solo en la app y por push; el mail es código nuevo. WhatsApp depende de DR67 (a): sin proveedor, plantillas ni consentimiento, y `/terms` dice que no es canal. Hasta entonces: app, push y mail. El cron es horario. Staging no tiene cron ni clave de Resend. Requiere migración.

**Textos aprobados:** `docs/propuestas/TEXTOS_PESOS_Y_PAGO_2026-11-26.md` §5.
