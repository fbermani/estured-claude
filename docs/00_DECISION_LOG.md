# 00_DECISION_LOG.md
# EstuRed — Registro de decisiones consolidadas

Última actualización: 2026-07-05

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
- Validación legal de la política de revocación "sin reembolso automático" frente a la Ley 24.240 (alternativa a consultar: reembolso por defecto dentro del plazo salvo servicio sustancialmente prestado).

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

