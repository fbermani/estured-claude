# 10_PRIVACY_AND_LEGAL_RULES.md
# EstuRed — Reglas de Privacidad, Visibilidad, Responsabilidad y Compliance Operativo

Versión: 0.2
Estado: Documento actualizado para construcción; requiere revisión legal antes del lanzamiento público
Última actualización: 2026-06-27
Depende de: `00_DECISION_LOG.md`, `02_MVP_SCOPE.md`, `03_BUSINESS_RULES.md`, `04_STATE_MACHINES.md`, `05_ROLES_AND_PERMISSIONS.md`, `06_DATA_MODEL.md`, `07_API_SPEC.md`, `08_UI_SCREENS_AND_FLOWS.md`, `09_ADMIN_PANEL_SPEC.md`

---

## 1. Propósito de este documento

Este documento define las reglas operativas de privacidad, visibilidad, consentimiento, documentación, responsabilidad, soporte/resolución de conflictos, reembolsos, antidiscriminación y cumplimiento legal mínimo para construir el MVP de EstuRed.

No reemplaza términos y condiciones legales definitivos, política de privacidad, política de cookies, contrato con residencias ni asesoramiento legal profesional.

Su función es transformar las decisiones de producto en reglas implementables para:

- frontend;
- backend;
- base de datos;
- políticas de permisos;
- admin panel;
- textos de aceptación;
- auditoría;
- QA;
- soporte y resolución de conflictos;
- futuras instrucciones para Claude Code.

Antes del lanzamiento público, este documento debe ser revisado por asesoría legal especializada en Argentina, especialmente en materia de consumo, datos personales, intermediación digital, menores de edad, pagos, facturación, turismo/alojamiento y contratos entre privados.

---

## 2. Principio rector

EstuRed debe construirse bajo este principio:

> EstuRed facilita, registra y ordena el proceso de búsqueda, solicitud, negociación de condiciones, reserva, comprobante y acompañamiento operativo, pero no presta directamente el alojamiento ni garantiza el comportamiento futuro de residencias, estudiantes o familiares.

Esto significa que EstuRed no debe comunicarse como:

- garante absoluto de disponibilidad;
- garante legal del alojamiento;
- aseguradora;
- custodio universal de pagos;
- responsable directo por servicios prestados por residencias;
- autoridad disciplinaria sobre convivencia;
- reemplazo de contratos, reglamentos o acuerdos entre estudiante y residencia.

Sí debe comunicarse como:

- plataforma intermediaria;
- canal de solicitud registrada, con posibilidad de negociación estructurada de condiciones;
- sistema de reserva confirmada dentro de EstuRed;
- emisor de comprobante operativo y de factura fiscal del fee;
- soporte de trazabilidad;
- canal de soporte y resolución de conflictos opcional en ciertos casos;
- red de residencias verificadas bajo alcance limitado;
- herramienta de gestión para residencias, con módulos base gratuitos y Gestión Operativa como plan pago.

---

## 3. Alcance del rol de EstuRed

### 3.1 EstuRed actúa como plataforma intermediaria activa

EstuRed interviene en el proceso mediante:

- verificación de residencias;
- publicación de perfiles;
- gestión de solicitudes y de propuestas de solicitud iniciadas por un familiar vinculado;
- gestión de la instancia de negociación (la residencia puede proponer un único ajuste de condiciones por solicitud);
- registro de pagos informados a residencias;
- cobro del fee de servicio EstuRed (MercadoPago o PayU Argentina, en ARS o USD);
- emisión de comprobantes;
- emisión automática de Factura C del fee (vía TusFacturas.app);
- dashboards operativos, incluyendo gestión multi-residencia para un mismo owner;
- administración de visibilidad;
- soporte y resolución de conflictos opcional;
- auditoría;
- penalizaciones internas;
- gestión de acceso freemium a Gestión Operativa por residencia.

Por lo tanto, EstuRed no debe presentarse como un simple tablón de anuncios.

### 3.2 Residencia como prestadora del alojamiento

La residencia es responsable por:

- existencia y prestación efectiva del alojamiento;
- reglas internas;
- servicios ofrecidos;
- limpieza, mantenimiento y operación diaria;
- cobros propios;
- pagos mensuales;
- ajustes futuros;
- devoluciones o no devoluciones de montos abonados a la residencia;
- cumplimiento de sus condiciones publicadas y de las condiciones finales acordadas si hubo negociación;
- trato no discriminatorio;
- comunicación con estudiantes (fuera de la plataforma, vía WhatsApp con mensaje pre-formateado generado por EstuRed);
- cumplimiento de leyes aplicables a su actividad.

### 3.3 Estudiante como solicitante y beneficiario de la reserva

El estudiante es responsable por:

- veracidad de datos declarados;
- documentación cargada;
- pagos que decida realizar;
- cumplimiento de reglamentos de residencia;
- fechas de ingreso;
- comunicación oportuna;
- aceptación de términos, incluyendo la aceptación de una propuesta del familiar o de una propuesta de ajuste de la residencia;
- configuración de visibilidad de su perfil.

### 3.4 Familiar vinculado como acompañante operativo

El familiar vinculado puede:

- acompañar el proceso;
- sugerir favoritos;
- **crear propuestas de solicitud dirigidas al estudiante**, que quedan pendientes de aprobación y nunca llegan a la residencia sin que el estudiante las apruebe;
- cargar documentación;
- subir comprobantes;
- pagar el fee EstuRed;
- acceder a comprobantes;
- asistir a estudiantes menores de edad.

El familiar no debe ser tratado como reemplazo del estudiante, salvo en casos de menor de edad según reglas específicas y revisión legal. El familiar **no puede** aceptar una propuesta de ajuste de la residencia en nombre del estudiante: esa decisión es exclusiva del estudiante.

---

## 4. Referencias normativas a revisar

Este documento toma como referencia preliminar, no exhaustiva:

- Ley 25.326 de Protección de Datos Personales;
- derechos de acceso, rectificación, actualización y supresión;
- principios de finalidad, proporcionalidad, calidad de datos, seguridad y confidencialidad;
- Ley 24.240 de Defensa del Consumidor;
- reglas de contratación a distancia y trato digno;
- normativa de botón de arrepentimiento o revocación de aceptación cuando corresponda;
- normativa aplicable a menores de edad;
- normativa fiscal y de facturación aplicable a monotributistas (relevante porque EstuRed emite Factura C vía TusFacturas.app);
- normativa de pagos y prevención de fraude aplicable a MercadoPago y PayU Argentina;
- normativa local aplicable a residencias estudiantiles, alojamientos o actividades similares.

Pendiente crítico:

- Validar legalmente si el fee EstuRed puede ser tratado como no reembolsable en todos los casos deseados.
- Validar alcance del botón de arrepentimiento para el fee de servicio EstuRed (se resolvió a nivel producto que se ubica en el footer; falta validar su suficiencia legal).
- Validar estructura contractual entre EstuRed, estudiante, familiar pagador y residencia, incluyendo el caso de solicitudes originadas por propuesta del familiar.
- Validar requisitos fiscales de la Factura C a nombre del pagador ante AFIP/ARCA y los límites de facturación del monotributo.
- Validar obligaciones de EstuRed como responsable de base de datos.
- Validar tratamiento de datos de menores.
- Validar uso de imágenes, videos y evidencias en casos de soporte y resolución de conflictos.

---

## 5. Datos personales: principios internos

### 5.1 Minimización

EstuRed solo debe pedir datos necesarios para:

- crear cuenta;
- evaluar solicitudes y propuestas de solicitud;
- operar reservas y negociaciones de condiciones;
- emitir comprobantes y facturas fiscales del fee;
- administrar pagos;
- verificar residencias;
- permitir comunidad visible;
- gestionar soporte;
- cumplir obligaciones legales, fiscales y operativas.

No se deben pedir datos por curiosidad, segmentación innecesaria o diseño aspiracional.

### 5.2 Finalidad

Cada dato debe tener una finalidad clara: identificación; contacto; reserva; negociación de condiciones; pago; comprobante; facturación fiscal; convivencia/comunidad visible; documentación; soporte; seguridad; auditoría; cumplimiento legal.

Los datos no deben usarse para finalidades incompatibles sin consentimiento adicional.

### 5.3 Transparencia

Durante el registro y antes de cada acción crítica, el usuario debe entender: qué datos se piden; para qué se usan; quién los puede ver; qué datos son obligatorios; qué datos son opcionales; qué datos nunca serán públicos; cómo modificar visibilidad; cómo solicitar baja o eliminación cuando corresponda.

### 5.4 Seguridad

Los datos deben protegerse mediante: control de acceso por rol; acceso por contexto; Row Level Security o equivalente; **acceso restringido por residencia para usuarios staff/owner que gestionan múltiples residencias** (un staff con acceso a la Residencia A no debe poder ver datos de la Residencia B del mismo owner salvo autorización explícita); URLs firmadas para documentos privados; buckets privados para documentos; auditoría de accesos sensibles; trazabilidad de cambios; separación entre datos públicos y privados; cifrado en tránsito; cifrado en reposo cuando aplique; backups; restricción de permisos admin; doble confirmación en acciones críticas.

### 5.5 Trazabilidad

Toda acción sensible debe quedar auditada: quién hizo la acción; cuándo; desde qué rol; sobre qué entidad; estado anterior; estado nuevo; motivo si aplica; IP/dispositivo si se implementa; evidencia asociada si existe.

---

## 6. Clasificación de datos

### 6.1 Datos públicos o semi-públicos de residencia

Nombre comercial; zona aproximada o dirección según decisión de producto; fotos aprobadas; descripción; servicios; reglas principales; tipos de habitación; capacidad; precios en USD y ARS (con aviso de tipo de cambio referencial); matrícula; depósito; política de ajustes; disponibilidad informada; sello Residencia Verificada; estado completa/sin disponibilidad; comunidad agregada; FAQ.

### 6.2 Datos privados de residencia

DNI del responsable; DNI del coordinador; documentación interna; checklist firmado; datos de contacto internos no publicados; notas admin; motivos internos de penalización; auditoría; documentos de verificación; casos de soporte; métricas internas no públicas; datos bancarios internos; **estado del feature flag freemium y su historial de otorgamiento**.

### 6.3 Datos visibles del estudiante según permisos

Nombre + inicial; foto o avatar; edad; nacionalidad/bandera; carrera; ciudad de origen; hábitos; intereses; objetivo académico declarado, solo en contextos específicos; estado de residente pendiente/activo, si aplica.

### 6.4 Datos nunca visibles públicamente del estudiante

Apellido completo; email; teléfono; fecha de nacimiento; universidad específica; DNI/pasaporte; documentación cargada; datos de pago; datos bancarios; dirección personal; datos familiares sensibles; notas internas; reclamos; auditoría; comunicaciones privadas fuera de contexto; **contenido de una propuesta de solicitud del familiar antes de que el estudiante la apruebe o rechace** (solo visible entre el familiar que la creó y el estudiante destinatario).

### 6.5 Datos visibles para residencias por contexto

La residencia puede ver datos del estudiante solo cuando exista un contexto legítimo: solicitud enviada (directamente o vía propuesta del familiar ya aprobada por el estudiante); reserva en proceso; reserva confirmada; renovación; residente cargado o activo; caso de soporte vinculado.

La residencia puede ver: perfil básico; datos de solicitud; duración deseada; fecha de ingreso; objetivo académico declarado; hábitos de convivencia relevantes; documentación autorizada para esa solicitud o relación; comprobantes vinculados a esa operación; datos del familiar si corresponde (por ejemplo, si la solicitud fue iniciada por el familiar, la residencia contacta directamente al familiar).

No debe ver documentos globales del estudiante fuera de contexto, ni propuestas de solicitud del familiar que el estudiante todavía no aprobó.

### 6.6 Datos sensibles que EstuRed debe evitar recolectar

Salud; discapacidad, salvo declaración voluntaria del usuario para requerimientos de accesibilidad; religión; ideología política; orientación sexual; vida sexual; origen étnico como dato sensible; afiliación sindical; datos biométricos; antecedentes penales; datos crediticios detallados; información económica profunda no necesaria.

El sistema debe evitar preguntas de onboarding que lleven a revelar datos sensibles.

---

## 7. Configuración de visibilidad del estudiante

### 7.1 Configuración inicial

Durante el onboarding, el estudiante debe configurar visibilidad de perfil con opciones claras. Debe existir una configuración recomendada por defecto, con posibilidad de editar.

### 7.2 Niveles de visibilidad

1. Invitados/no registrados.
2. Usuarios registrados.
3. Residencias con solicitud activa.
4. Residencia donde está alojado.
5. Compañeros/residentes de la misma residencia.

Usuarios registrados y compañeros pueden ver el mismo nivel de perfil, según lo que el estudiante acepte mostrar; invitados ven información muy limitada; datos sensibles nunca se muestran.

### 7.3 Datos visibles a invitados

Nombre + inicial; foto o avatar si el estudiante aceptó; condición genérica de plaza ocupada/residente, cuando aplique.

Recomendación de producto: evitar mostrar comunidad individual completa a invitados; usar perfiles completos solo para usuarios registrados.

### 7.4 Datos visibles a usuarios registrados

Nombre + inicial; foto/avatar; edad; nacionalidad/bandera; carrera; ciudad de origen; hábitos completos; intereses; perfil de comunidad — todo sujeto a lo que el estudiante habilitó.

### 7.5 Datos visibles a residencias con solicitud activa

Datos obligatorios de solicitud; perfil del estudiante; datos de convivencia/hábitos; documentos autorizados; familiar vinculado si corresponde (incluyendo si es el destinatario del contacto por haber iniciado la solicitud); comprobantes vinculados.

### 7.6 Cambios de visibilidad

El estudiante puede cambiar visibilidad desde su perfil. Los cambios deben aplicarse hacia adelante; el sistema debe guardar auditoría de cambios relevantes; si el estudiante oculta su perfil, la residencia debe seguir viendo datos necesarios para operaciones activas; los documentos compartidos en una solicitud ya enviada pueden requerir conservación por trazabilidad, pero no deben quedar disponibles fuera de contexto.

---

## 8. Comunidad visible

### 8.1 Principio

La comunidad visible es un diferencial de EstuRed, pero no debe justificar exposición excesiva de datos personales. Debe funcionar con: consentimiento; configuración de visibilidad; información limitada para invitados; acceso ampliado para registrados; datos agregados cuando no hay consentimiento individual; respeto por estudiantes no activados o que no desean mostrarse.

### 8.2 Residentes activados

Un residente activado puede aparecer con los datos que aceptó mostrar. Debe poder editar su configuración de visibilidad.

### 8.3 Residentes creados por residencia pero no activados

Si la residencia crea un residente con email y el estudiante no activó su cuenta, se muestra como `Residente pendiente de activar cuenta` o `Plaza ocupada`. No se muestran datos personales adicionales.

### 8.4 La residencia no puede forzar visibilidad completa

La residencia puede invitar a un residente a activar su perfil, pero no debe poder obligarlo a mostrar perfil completo como condición dentro de EstuRed.

### 8.5 Datos agregados

Cuando no haya consentimiento suficiente, la residencia puede mostrar datos agregados: cantidad de residentes; distribución por habitaciones; plazas ocupadas; plazas disponibles; rangos de edad aproximados; nacionalidades agregadas; tipos de carreras de forma general; comunidad universitaria general.

No se deben generar agregados que permitan identificar a una persona en grupos muy pequeños.

---

## 9. Menores de edad

### 9.1 Registro

Si un estudiante es menor de 18 años: no puede finalizar registro completo sin familiar vinculado; debe requerirse aprobación/vinculación de padre, madre o responsable; el familiar vinculado se vuelve obligatorio; las acciones críticas deben requerir aceptación del familiar cuando corresponda.

### 9.2 Visibilidad de menores

Más restrictiva por defecto. Recomendación: no mostrar foto real de menor a invitados; no mostrar hábitos completos a usuarios generales sin revisión; permitir visibilidad a residencias solo en contexto de solicitud; revisar legalmente el alcance.

### 9.3 Pagos de menores

El familiar vinculado debe poder pagar el fee EstuRed (en ARS con MercadoPago o en USD con PayU Argentina). La Factura C del fee se emite a nombre de quien paga. El comprobante de reserva se emite a nombre del estudiante, con pagador/familiar vinculado cuando corresponda.

### 9.4 Propuestas del familiar y menores — DECISIÓN CONFIRMADA

El familiar puede crear propuestas de solicitud para el estudiante menor vinculado. **Confirmado: el estudiante, incluso siendo menor de edad, es quien aprueba o rechaza la propuesta.** El familiar no puede aprobarla en su representación bajo ninguna circunstancia. Esta regla aplica de forma idéntica a estudiantes mayores y menores de edad.

### 9.5 Contacto con menores — DECISIÓN CONFIRMADA

Cuando el estudiante es menor de edad, el contacto de la residencia se dirige **siempre** al familiar vinculado (`contact_target = family_member`), independientemente de quién haya iniciado la solicitud. El teléfono del familiar es obligatorio para que un menor pueda enviar o aprobar solicitudes.

### 9.6 Pendiente legal

Todo el flujo de menores requiere revisión legal antes del lanzamiento público.

---

## 10. Documentos y comprobantes cargados por usuarios

### 10.1 Principio

Los documentos son privados por defecto. No deben ser públicos ni visibles para residencias fuera de contexto.

### 10.2 Tipos de documentos posibles

Documentos de estudiante: DNI/pasaporte; constancia de estudio o inscripción; documentación solicitada por residencia; comprobante de pago a residencia; comprobantes relacionados con reserva o renovación; documentación cargada por familiar.

Documentos de residencia: DNI responsable; DNI coordinador; aceptación de términos; checklist firmado; evidencia de visita; documentación de verificación; recibos/comprobantes internos si aplica.

Documentos fiscales: Factura C del fee emitida vía TusFacturas.app.

### 10.3 Acceso a documentos

Estudiante ve sus documentos; familiar vinculado ve/carga documentos según permisos; residencia ve documentos autorizados en contexto (limitado a las residencias donde el usuario tiene acceso, en caso de staff multi-residencia); admin ve documentos cuando sea necesario para soporte, verificación, reclamo o auditoría, **con justificación registrada obligatoria antes del acceso**; todo acceso admin a documentos sensibles debe ser auditado.

### 10.4 Comprobante de pago a residencia

El estudiante debe poder cargar comprobante de pago a residencia para referencia. La residencia puede cargar comprobante o recibo para referencia propia.

Regla clave: el comprobante cargado por el estudiante no confirma reserva; solo la residencia puede marcar `Pago recibido`, con confirmación explícita y aceptación de términos; admin puede intervenir si la operación está trabada, con auditoría.

### 10.5 Conservación

Pendiente de revisión legal. Recomendación inicial: documentos asociados a operaciones confirmadas deben conservarse durante el plazo necesario para soporte, obligaciones legales y fiscales; documentos opcionales no usados deben poder eliminarse por el usuario; documentos de casos de soporte deben conservarse mientras exista caso activo y por un plazo razonable posterior; documentos fiscales (incluyendo Factura C) deben conservarse según normativa aplicable al monotributo.

---

## 11. Residencia Verificada

### 11.1 Alcance del sello

Identidad del responsable revisada; dirección revisada; visita presencial obligatoria; comparación básica entre fotos publicadas y lugar visitado; checklist firmado por ambas partes; aprobación admin; vigencia anual.

### 11.2 Lo que no significa

Garantía absoluta de legalidad integral; garantía de convivencia; garantía de disponibilidad permanente; garantía de precios futuros; garantía de que no habrá cambios operativos; garantía sobre conducta futura de la residencia o residentes; seguro; aval legal completo del inmueble.

### 11.3 Copy recomendado

> Residencia Verificada: EstuRed revisó identidad del responsable, ubicación y consistencia básica entre fotos publicadas y visita presencial. Esta verificación no reemplaza acuerdos, reglamentos ni condiciones propias de la residencia.

### 11.4 Vigencia

Vence anualmente. La residencia puede pasar a `verification_expired` si no renueva.

### 11.5 Pérdida del sello

Incumplimiento reiterado de términos; información engañosa; cancelaciones injustificadas; reclamos validados; negativa a corregir información; falta de actualización crítica; comportamiento discriminatorio comprobado; cambio de dirección o responsables sin revisión; falsificación documental; decisión admin justificada.

---

## 12. Disponibilidad y condiciones publicadas

### 12.1 Copy obligatorio

Modo Perfil Verificado: **"Disponibilidad informada por la residencia. Requiere confirmación al solicitar."**

Modo Gestión Operativa con datos actualizados: **"Disponibilidad asegurada."**

### 12.2 Responsabilidad de actualización

La residencia debe actualizarla al menos cada 30 días o marcar estado `Completa`. Si no actualiza y el estado `not_updated` persiste más de 15 días, la residencia deja de aparecer en búsquedas activas.

### 12.3 Estado Completa

Significa que la residencia no tiene cupos reales. No debe confundirse con `sin disponibilidad actualizada`.

### 12.4 Condiciones congeladas en solicitud (snapshot original)

Cuando el estudiante envía o aprueba una solicitud, se guarda snapshot de: residencia; tipo de habitación/plaza; tarifa USD; tarifa ARS referencial; tipo de cambio (fuente: monedapi.ar, dólar blue valor venta); fecha/hora del cálculo; matrícula; depósito; monto requerido para reservar; duración inicial; política de ajustes; reglas principales; condiciones de reserva; fee estimado EstuRed.

### 12.5 Condiciones finales tras negociación (snapshot final)

Si la residencia envía una propuesta de ajuste (permitida una única vez por solicitud) y el estudiante la acepta, se genera un **snapshot final** con las nuevas condiciones. El fee EstuRed se calcula siempre sobre el snapshot final, no sobre el original, cuando existe negociación aceptada.

Si el estudiante rechaza la propuesta y elige continuar, el snapshot final es igual al original. Si el estudiante rechaza y cierra la solicitud, no hay snapshot final ni continuidad.

Toda propuesta de ajuste y su resultado deben quedar auditados con el detalle de qué campos cambiaron.

---

## 13. Precios, moneda, tipo de cambio y redondeos

### 13.1 Publicación de tarifas

Las tarifas deben mostrarse en USD y ARS. El valor en ARS es siempre referencial hasta el momento del pago efectivo a la residencia.

### 13.2 Tipo de cambio — fuente confirmada

**Fuente: monedapi.ar — dólar blue, valor de venta.**

- Debe existir una abstracción `ExchangeRateProvider` que no hardcodee la fuente en la lógica de negocio.
- Debe guardar `official_exchange_rate_ars_per_usd`, actualizado automáticamente una vez por día.
- Admin puede corregir manualmente si la fuente falla, con motivo obligatorio y auditoría.
- Cada solicitud guarda snapshot del tipo de cambio usado; **si hay negociación aceptada, el snapshot final hereda el tipo de cambio, la fuente y la fecha del snapshot original de la solicitud — la aceptación de la propuesta nunca actualiza la cotización** (decisión confirmada, ver `00_DECISION_LOG.md` §13.4).
- Todo precio en ARS mostrado en la interfaz debe ir acompañado de un aviso: **"Valor referencial en pesos según cotización del dólar blue (venta) del día. El valor final en pesos se determina al momento del pago a la residencia."**

### 13.3 Redondeo de tarifas

Tarifas en USD terminan en 0 o 5; tarifas en ARS terminan en 500 o 000; la residencia debe respetar este formato al editar tarifas; el sistema debe ayudar a redondear automáticamente.

### 13.4 Redondeo del fee

El fee EstuRed debe redondearse a múltiplos de 500 ARS. Calcular fee exacto, redondear al múltiplo de 500 más cercano (en empate exacto entre dos múltiplos, hacia arriba), guardar fee exacto interno y fee final cobrado si se decide conservar ambos.

### 13.5 Alertas de tarifas

Las tarifas, matrícula y depósito son editadas por la residencia sin aprobación previa. Deben quedar auditadas. Si suben o bajan más de 15% en una sola edición, se genera alerta admin.

---

## 14. Fee EstuRed

### 14.1 Regla de cálculo

> 5% fijo del total de la estadía inicial reservada, calculado sobre las condiciones finales aceptadas (snapshot final: original si no hubo negociación, o ajustado si la residencia propuso cambios y el estudiante los aceptó), sin considerar ajustes futuros posteriores a la confirmación.

Incluye: alojamiento mensual de la estadía inicial; matrícula; cargos de ingreso obligatorios no reembolsables.

Excluye: depósito reembolsable; servicios opcionales; consumos variables; multas; cargos no obligatorios.

### 14.2 Ajustes futuros

Los ajustes futuros de tarifa (posteriores a la confirmación de la reserva) no recalculan el fee. El comprobante debe aclarar que los meses siguientes pueden estar sujetos a modificaciones según la política de ajustes de la residencia.

### 14.3 Momento de cobro

El fee se cobra después de que la residencia marca `Pago recibido`. No existe reserva confirmada dentro de EstuRed hasta que el fee esté pagado o validado.

### 14.4 Proveedores y moneda del fee — decisión confirmada

- **MercadoPago** — cobro en ARS.
- **PayU Argentina** — cobro en USD, recomendado para pagadores fuera de Argentina.
- Pago manual validado por admin (transferencia, comprobante subido) como alternativa siempre disponible.
- La arquitectura debe usar una abstracción `PaymentProvider` que no hardcodee el proveedor en la lógica de negocio.

### 14.5 Medio preferido

El medio de pago preferido configurado por el usuario se usa para el fee EstuRed. El pago a residencia se acuerda durante el contacto posterior a la solicitud (fuera de la plataforma, vía WhatsApp con mensaje pre-formateado).

### 14.6 Reintentos

Si falla el cobro automático del fee: hasta 3 intentos dentro de 48 horas; notificar al usuario; permitir método alternativo; si vence, no se emite comprobante ni se confirma la reserva.

---

## 15. Política de reembolso

### 15.1 Fee EstuRed

> El fee EstuRed no es reembolsable salvo incumplimiento atribuible a la residencia, revisión de EstuRed y normativa aplicable.

Copy sugerido: "El fee de servicio no será reembolsable si cancelás por decisión propia, no te presentás o no continuás con la residencia. Solo podrá evaluarse un reintegro si la cancelación o incumplimiento fuera atribuible a la residencia, luego de revisión de EstuRed y sujeto a normativa aplicable."

### 15.2 Pagos hechos a residencia

El reembolso de lo abonado a la residencia depende de: condiciones de la residencia; acuerdo entre estudiante y residencia; normativa aplicable; eventual intervención de soporte; decisión de la residencia. EstuRed no debe prometer reembolsos de montos que no procesó.

### 15.3 Cancelación atribuible a residencia

Si la residencia cancela o no honra la reserva: el estudiante puede abrir un caso de soporte; EstuRed analiza evidencia; si se confirma incumplimiento atribuible a la residencia, puede devolver el fee EstuRed; EstuRed puede ayudar a buscar alternativa; la residencia puede recibir penalización de visibilidad, pausa o suspensión; el reembolso de pagos a residencia depende de la residencia y normativa aplicable.

### 15.4 Derecho de revocación del fee EstuRed — DECISIÓN CONFIRMADA

**Mecanismo:** enlace visible en el footer de la plataforma.

**Plazo:** 10 días corridos desde el pago del fee, alineado a la normativa de contratación a distancia (Ley 24.240 / Decreto 1798/94).

**Efecto al ejercerse:**

- la reserva pasa a cancelada (`cancelled_by_student`, `reason_code = student_revocation_right`);
- el comprobante emitido se anula (`voided`);
- el fee EstuRed **no se reembolsa automáticamente** — queda pendiente de revisión manual de admin;
- admin evalúa cada caso individualmente para detectar patrones de bypass (por ejemplo, revocar el fee después de haber usado el contacto establecido para acordar directamente con la residencia por fuera de la plataforma);
- admin puede cotejar con la residencia antes de resolver sobre el reembolso.

**Alcance:** el derecho de revocación aplica únicamente al fee EstuRed. EstuRed está exenta de reembolsar cualquier monto pagado directamente a la residencia — esa relación y sus condiciones de devolución son responsabilidad exclusiva de la residencia y el estudiante/familiar.

El sistema debe registrar: fecha/hora de la solicitud de revocación; asociación al pago del fee correspondiente; estado admin para su gestión y resolución; auditoría completa del caso.

---

## 16. Facturación, recibos y comprobantes

### 16.1 Factura del fee EstuRed — decisión confirmada

**EstuRed emite Factura C, operando como monotributista, mediante integración con TusFacturas.app.**

La factura se emite automáticamente cuando el fee se confirma como pagado (cobro automático o validación manual de admin). Se emite a nombre de quien paga. Si paga un familiar, sale a nombre del familiar pagador.

La descripción debe indicar el beneficiario del servicio reservado:

> Fee de servicio EstuRed asociado a reserva de [Nombre estudiante] en [Nombre residencia].

**Riesgo a vigilar (no bloqueante para el MVP):** el monotributo tiene límites de facturación anual. El panel admin debe eventualmente mostrar el acumulado facturado en el período fiscal vigente para anticipar un cambio de categoría fiscal antes de que se convierta en un problema operativo.

### 16.2 Comprobante de Reserva Confirmada

Se emite a nombre del estudiante. Si paga un familiar, el comprobante puede incluir: familiar pagador; relación; datos fiscales del pagador si corresponde; beneficiario de la reserva. Debe reflejar las **condiciones finales** (snapshot final), no las originales, cuando hubo negociación aceptada.

### 16.3 Monto abonado a residencia

El comprobante muestra el monto abonado a la residencia como: **"Monto informado por la residencia como recibido."** El estudiante puede cargar su comprobante para referencia; la residencia puede cargar recibo/comprobante para referencia.

### 16.4 Comprobante de Renovación Confirmada

Misma lógica que reserva inicial, aplicada al período renovado. El fee de renovación usa exactamente la misma fórmula que el fee de la reserva inicial, sin variantes.

---

## 17. Textos de aceptación obligatorios

Estos textos son base de producto. Deben ser revisados por legal antes de lanzamiento.

### 17.1 Antes de enviar solicitud

**Revisá tu solicitud antes de enviarla**

> Estás por enviar una solicitud de reserva a [Nombre de residencia] para [tipo de habitación/plaza], con ingreso estimado el [fecha] y una estadía inicial declarada de [duración].
>
> Esta solicitud no confirma automáticamente tu reserva. La residencia deberá revisar tu perfil, confirmar disponibilidad y avanzar con el proceso de reserva. La residencia podrá proponerte, como máximo una vez, un ajuste de condiciones (por ejemplo de tarifa, fecha o tipo de habitación), que vos deberás aceptar o rechazar antes de continuar.
>
> Si la residencia decide avanzar, se habilitará el contacto directo para que puedas completar el pago solicitado por la residencia, que puede incluir seña, matrícula, depósito u otro concepto informado en sus condiciones.
>
> Los pagos mensuales de alojamiento, ajustes futuros, normas de permanencia y condiciones internas se gestionan directamente con la residencia, según sus reglas publicadas y los acuerdos que aceptes con ella.
>
> El fee de servicio de EstuRed se cobrará únicamente cuando la residencia informe que recibió el pago correspondiente para asegurar la reserva y la operación pueda ser confirmada dentro de la plataforma.

Checkbox:

> Declaro que revisé los datos de esta solicitud, entiendo que está sujeta a confirmación de la residencia y a una posible propuesta de ajuste de condiciones, y acepto que EstuRed actúa como plataforma intermediaria de solicitud, registro, soporte y comprobante, no como prestador directo del alojamiento.

### 17.1bis Consentimiento del familiar al crear una propuesta — texto nuevo

**Antes de enviar la propuesta al estudiante**

> Estás por sugerirle a [Nombre estudiante] una solicitud de reserva en [Nombre de residencia]. Si el estudiante la aprueba, la solicitud se enviará a la residencia y **tu número de teléfono será compartido con la residencia** como contacto de esta operación.

Checkbox:

> Acepto que, si el estudiante aprueba esta propuesta, mi número de teléfono sea compartido con la residencia para coordinar la reserva (consentimiento `family_contact_disclosure`).

Este mismo consentimiento aplica cuando el estudiante es menor de edad y el familiar es el destinatario del contacto por regla (ver §9.6).

### 17.2 Aprobación de propuesta de solicitud del familiar — texto nuevo

**Tu familiar te sugirió una residencia**

> [Nombre del familiar] sugirió enviar una solicitud de reserva a [Nombre de residencia] para [tipo de habitación/plaza], con ingreso estimado el [fecha] y una estadía inicial declarada de [duración].
>
> Esta propuesta no fue enviada todavía a la residencia. Si la aprobás, se convertirá en una solicitud real bajo tu perfil y quedará sujeta a las mismas condiciones y límites que cualquier otra solicitud (por ejemplo, el máximo de 2 solicitudes activas).
>
> Si tu familiar inició esta propuesta, cuando la residencia decida avanzar, el contacto será directamente con [Nombre del familiar] y no con vos.
>
> Podés aprobar o rechazar esta propuesta. Si querés modificar algún dato, debés rechazarla y pedirle a tu familiar que cree una nueva, o iniciar tu propia solicitud.

Checkbox (al aprobar):

> Confirmo que quiero convertir esta propuesta en una solicitud real de reserva, entiendo que el contacto de la residencia se dirigirá según corresponda, y acepto los mismos términos que rigen cualquier solicitud enviada a través de EstuRed.

### 17.3 Aceptación de propuesta de ajuste de condiciones — texto nuevo

**Revisá los cambios propuestos por la residencia**

> [Nombre de residencia] te propuso un ajuste a las condiciones originales de tu solicitud. Podés ver el detalle de qué cambia respecto a lo que solicitaste originalmente.
>
> Esta es la única propuesta de ajuste que la residencia puede enviarte para esta solicitud. Si la aceptás, tu solicitud continuará con estas nuevas condiciones, y el fee de servicio de EstuRed se calculará sobre estos valores actualizados, no sobre los originales.
>
> Si la rechazás, podés optar por continuar con las condiciones originales de tu solicitud, o cerrar la solicitud.

Checkbox (al aceptar):

> Acepto las condiciones propuestas por la residencia, entiendo que reemplazan a las condiciones originales de mi solicitud y que el fee de servicio EstuRed se calculará sobre estos nuevos valores.

### 17.4 Antes de pagar fee EstuRed

**Confirmación final de reserva**

> La residencia informó que recibió el pago necesario para asegurar tu plaza. Para confirmar la reserva dentro de EstuRed y emitir tu comprobante, corresponde abonar el fee de servicio de EstuRed.
>
> El fee de servicio equivale al 5% del total de la estadía inicial reservada, calculado sobre las condiciones finales de tu solicitud (las originales, o las que hayas aceptado si hubo una propuesta de ajuste) y excluyendo el depósito en garantía. Este fee permite registrar la operación, emitir el comprobante, mantener soporte de EstuRed y acceder a los beneficios de la plataforma durante tu experiencia.
>
> Podés pagar en pesos a través de MercadoPago, o en dólares a través de PayU. Una vez pagado el fee, la reserva quedará confirmada dentro de EstuRed, recibirás la factura fiscal correspondiente y se emitirá tu comprobante de reserva.
>
> Este fee no es reembolsable si decidís cancelar, no presentarte o no continuar con la residencia. Solo podrá ser evaluado para reintegro si la cancelación o incumplimiento fuera atribuible a la residencia, luego de revisión de EstuRed y sujeto a normativa aplicable.

Checkbox:

> Entiendo que al pagar el fee de servicio se confirma mi reserva dentro de EstuRed, se emitirá el comprobante y la factura correspondiente, y acepto las condiciones de no reembolso indicadas, salvo incumplimiento atribuible a la residencia, revisión de EstuRed y normativa aplicable.

### 17.5 Residencia antes de marcar Pago recibido

**Confirmar pago recibido**

> Estás por informar que recibiste el pago requerido para asegurar la reserva de [Nombre estudiante] en [tipo de habitación/plaza], con ingreso estimado el [fecha] y estadía inicial declarada de [duración].
>
> Al marcar "Pago recibido", confirmás que la residencia recibió el importe correspondiente según las condiciones publicadas o aceptadas en esta solicitud (incluyendo cualquier ajuste de condiciones que hayas propuesto y el estudiante haya aceptado), y que la plaza queda reservada para el estudiante, sujeta al pago del fee de servicio EstuRed y a la emisión del comprobante final.
>
> También declarás que la información de precio, condiciones, disponibilidad, reglas y características publicadas para esta solicitud es correcta, vigente y no induce a error.

Checkbox:

> Declaro que la residencia recibió el pago correspondiente para asegurar esta reserva, que la plaza queda retenida para el estudiante y que la información asociada a esta solicitud es correcta y vigente.

### 17.6 Residencia al confirmar reserva

**Responsabilidad de la residencia**

> Al confirmar esta reserva, la residencia acepta que la plaza indicada quedará reservada para el estudiante bajo las condiciones informadas. La residencia es responsable por la prestación del alojamiento, sus condiciones, reglas internas, pagos mensuales, ajustes, permanencia y servicios ofrecidos.
>
> Cualquier cambio relevante de precio, tipo de habitación, fecha, servicios o condiciones debe ser propuesto formalmente a través de EstuRed (como máximo una vez por solicitud) y aceptado explícitamente por el estudiante. La residencia no podrá usar criterios discriminatorios para aceptar, rechazar o cancelar solicitudes. La falta reiterada de respuesta, disponibilidad incorrecta, información engañosa o cancelaciones injustificadas podrán afectar su visibilidad, verificación o permanencia en EstuRed.

Checkbox:

> Acepto las responsabilidades de la residencia, confirmo que la plaza queda reservada para el estudiante y entiendo que EstuRed podrá auditar esta operación y tomar medidas si se incumplen las condiciones aceptadas.

### 17.7 Estudiante al pagar fee

**Aceptación del estudiante**

> Al pagar el fee de servicio EstuRed, aceptás que tu reserva quedará confirmada dentro de EstuRed una vez aprobado el pago. El comprobante de reserva se emitirá con las condiciones finales de tu solicitud, los datos informados por la residencia y por tu perfil.
>
> Los pagos mensuales, reglas de convivencia, condiciones de permanencia y ajustes futuros son definidos por la residencia. El monto de meses futuros puede variar según la política de ajustes publicada por la residencia.
>
> EstuRed no presta directamente el alojamiento ni garantiza el comportamiento futuro de la residencia o de otros residentes. EstuRed podrá intervenir como canal de soporte y resolución de conflictos en determinados casos, según sus términos, sin asumir responsabilidad directa por la prestación del alojamiento.
>
> Si cancelás por decisión propia, no te presentás o no continuás con la residencia, el fee EstuRed no será reembolsable, salvo normativa aplicable o revisión excepcional por incumplimiento atribuible a la residencia.

Checkbox:

> Acepto las condiciones de confirmación de reserva, el cobro del fee de servicio EstuRed, la política de reembolso y el alcance de intervención de EstuRed como plataforma intermediaria.

### 17.8 Familiar vinculado si paga

**Pago realizado por familiar vinculado**

> Estás por pagar el fee de servicio EstuRed asociado a la reserva de [Nombre estudiante] en [Nombre residencia].
>
> Al realizar este pago, declarás que tenés autorización del estudiante vinculado para acompañar esta operación y entendés que la reserva corresponde al estudiante, no al familiar pagador.
>
> El comprobante podrá incluir tus datos como familiar vinculado o pagador, pero las condiciones de alojamiento, permanencia, convivencia y relación con la residencia corresponden al estudiante y a la residencia.
>
> El pago del fee confirma la reserva dentro de EstuRed y habilita la emisión del comprobante y la factura correspondientes.

Checkbox:

> Declaro que estoy autorizado a realizar este pago como familiar vinculado, acepto las condiciones del fee de servicio y entiendo que la reserva corresponde al estudiante asociado a mi cuenta.

---

## 18. Antidiscriminación

### 18.1 Principio

EstuRed debe prohibir rechazos, cancelaciones, maltrato o decisiones basadas en criterios discriminatorios.

### 18.2 Condiciones estructurales declaradas

Una residencia puede declarar condiciones estructurales del alojamiento si forman parte objetiva del producto ofrecido: residencia femenina; residencia masculina; residencia mixta; habitaciones separadas por género; duración mínima; edad mínima/máxima si tiene fundamento operativo y legal; requisitos académicos razonables; reglas de convivencia.

Estas condiciones deben estar publicadas antes de la solicitud. No deben usarse como excusa para discriminación arbitraria o no declarada.

### 18.3 Rechazos

Motivos predefinidos permitidos: sin disponibilidad; perfil incompleto; documentación insuficiente; no cumple requisitos declarados de la residencia; fechas incompatibles; duración incompatible; no respondió a tiempo; otro candidato avanzó primero; otro motivo con explicación interna obligatoria.

### 18.4 Rechazos sistemáticos

El admin debe poder detectar: rechazos frecuentes por falta de disponibilidad; rechazos sistemáticos de ciertos perfiles; patrones sospechosos; reclamos por discriminación.

Si se comprueba comportamiento inadecuado: advertencia; reducción de visibilidad; pausa; suspensión; expulsión de la red.

---

## 19. Soporte y resolución de conflictos

*(Sección renombrada: se usa "Soporte y Resolución de Conflictos" en lugar de "Mediación" en toda comunicación pública y en la terminología del producto, para evitar implicancias legales del término "mediación" formal bajo la Ley 26.589 de Argentina. El término técnico interno `support_cases` puede mantenerse en base de datos.)*

### 19.1 Inicio

Cualquier usuario con contexto legítimo puede abrir un caso desde `Soporte` o desde la entidad relacionada: perfil; solicitud; propuesta del familiar; negociación de condiciones; reserva; renovación; comprobante; residencia; comunidad visible.

### 19.2 Reminder obligatorio

Antes de proceder, el sistema debe mostrar: términos aplicables; alcance de la intervención de EstuRed; deslinde de responsabilidad; aclaración de que EstuRed puede no intervenir si el caso no amerita; posibilidad de pedir evidencia.

### 19.3 Evidencia permitida

Fotos; videos; capturas (incluyendo capturas de la conversación de WhatsApp, ya que EstuRed no tiene acceso directo a esa conversación); audios; documentos; comprobantes; mensajes relevantes.

### 19.4 Uso de evidencia

Solo debe usarse para: analizar el caso; contactar partes; registrar soporte; tomar decisiones admin; cumplir obligación legal si aplica. No debe mostrarse públicamente.

### 19.5 Efecto operativo

Abrir un caso de soporte no suspende automáticamente: solicitud; propuesta del familiar; negociación; reserva; renovación; pago; comprobante. Admin puede suspender manualmente si el caso lo amerita.

### 19.6 Resultados posibles

Cerrado sin acción; pedido de más información; acuerdo entre partes; reembolso de fee EstuRed; penalización de residencia; pausa temporal; suspensión; expulsión; bloqueo de usuario; reemisión o anulación de comprobante; reemisión o anulación de factura fiscal; recomendación de alternativa para estudiante.

---

## 20. Cancelaciones, no-show y casos borde

### 20.1 Cancelación por estudiante antes de pagar a residencia

El estudiante puede cancelar solicitud antes de pagar a residencia. Debe mostrarse advertencia sobre riesgos de bypass y pérdida de beneficios de EstuRed si continúa por fuera.

### 20.2 Cancelación por estudiante después de reserva confirmada

Fee EstuRed no reembolsable salvo normativa aplicable o incumplimiento atribuible a residencia; pagos a residencia se rigen por condiciones de residencia; la residencia puede liberar plaza según sus reglas.

### 20.3 Cancelación por residencia

Estudiante puede reclamar (abrir caso de soporte); admin revisa; posible reembolso de fee; posible penalización; EstuRed puede ayudar a buscar alternativa; EstuRed no garantiza conseguir alternativa equivalente.

### 20.4 No-show

Si el estudiante no se presenta dentro de las 24 horas posteriores a la fecha/hora acordada y no responde por canales registrados: residencia puede marcar `No show`; plaza puede liberarse; fee EstuRed no se reembolsa; residencia conserva lo cobrado según sus condiciones; queda registro interno.

### 20.5 Diferencias entre publicado y real

Solo ameritan reclamo operativo si son sustanciales, comprobables, no meras expectativas subjetivas, y relacionadas con información publicada o condiciones aceptadas (originales o tras negociación). Ejemplos: habitación diferente de la solicitada sin aceptación; precio distinto sin aceptación; dirección incorrecta; servicios principales inexistentes; reglas ocultas relevantes; disponibilidad falsa reiterada.

---

## 21. Renovaciones

### 21.1 Regla general

Must Have del MVP. La renovación formal la emite la residencia. El estudiante puede solicitar renovación, pero esa solicitud no crea oferta vinculante.

### 21.2 Fee de renovación

**Misma lógica que reserva inicial, sin excepciones:** 5% del período renovado; tarifa actual; sin considerar ajustes futuros; incluye cargos obligatorios no reembolsables si aplican; excluye depósito reembolsable.

### 21.3 Comprobante

**Comprobante de Renovación Confirmada.** Debe mostrar: período renovado; tarifa actual; política de ajustes futuros; monto abonado a residencia informado por residencia; fee EstuRed; estado de pago; factura fiscal asociada; disclaimer.

---

## 22. Notificaciones y comunicaciones

### 22.1 Canal obligatorio — decisión confirmada

Cada usuario debe tener al menos un canal de notificación activo. Canales técnicos soportados: **email (obligatorio como respaldo)** e **in-app**.

**WhatsApp no es un canal de notificación del sistema.** No hay integración con la API de WhatsApp Business. El único uso de WhatsApp es un botón que la residencia acciona manualmente para abrir una conversación con un mensaje pre-formateado generado por EstuRed. EstuRed no envía notificaciones automáticas por WhatsApp ni tiene acceso a esa conversación.

### 22.2 Eventos obligatorios

Solicitud enviada; solicitud recibida por residencia; propuesta de solicitud del familiar creada; propuesta de solicitud aprobada/rechazada por el estudiante; contacto establecido; propuesta de ajuste de condiciones recibida; propuesta de ajuste aceptada/rechazada; inicio de plazo de 48 horas; 24 horas restantes; pago a residencia marcado como recibido; fee EstuRed pendiente; fee fallido; fee pagado; factura fiscal emitida; reserva confirmada; comprobante emitido; solicitud vencida; solicitud pausada; solicitud cerrada por otra reserva; lista de espera con disponibilidad; recordatorio de 90 días en lista de espera; oferta de renovación; vencimiento de renovación; caso de soporte abierto; caso de soporte actualizado; verificación de residencia; cambios críticos de perfil; alertas admin.

### 22.3 Botón de contacto por WhatsApp

Cuando la residencia decide avanzar con una solicitud, el sistema debe registrar: fecha/hora en que la residencia presionó el botón; usuario que lo activó; mensaje estructurado generado (nombre del estudiante o familiar contacto, residencia, condiciones); solicitud asociada; plazo de 48 horas iniciado; estado posterior.

No se debe asumir que EstuRed controla o registra el contenido de la conversación que ocurre fuera de la plataforma.

---

## 23. FAQ / Bot limitado

### 23.1 Alcance MVP

El bot/FAQ está limitado a información cargada por la residencia (preguntas elegidas de un listado predefinido por EstuRed, respuestas propias, y archivos como reglamento interno) y campos estructurados del perfil.

Puede: responder preguntas frecuentes; mostrar información ya publicada; registrar preguntas sin respuesta; sugerir a la residencia agregar nueva respuesta.

No puede: inventar precios; confirmar disponibilidad no cargada; prometer condiciones; reemplazar términos; dar asesoramiento legal; decir que una reserva está confirmada si no lo está; modificar estados.

### 23.2 IA avanzada

Queda fuera del MVP. Si se implementa en el futuro, debe usar límites estrictos y fuentes verificadas.

---

## 24. Administración interna y auditoría

### 24.1 Acciones admin sensibles

Deben requerir motivo y auditoría: confirmar reserva manualmente; reembolsar fee; emitir o reemitir comprobante manual; anular comprobante; reemitir o anular factura fiscal; suspender residencia; pausar residencia; bloquear usuario; modificar estados; acceder a documentos sensibles (con justificación previa registrada); aprobar/rechazar verificación; cambiar visibilidad; resolver caso de soporte; aplicar penalización; **otorgar o revocar acceso freemium a Gestión Operativa**.

### 24.2 Superadmin

Puede ejecutar acciones críticas globales. Debe usarse con mínimo privilegio. **Decisión confirmada: 2FA (TOTP vía Supabase Auth MFA) es obligatorio para admin y superadmin desde la beta privada.** Además: registro de sesiones; límites de acceso por necesidad operativa.

### 24.3 Sistema

El rol `system` puede ejecutar jobs: vencimientos de solicitudes, propuestas del familiar y propuestas de ajuste; recordatorios; salida automática de listas de espera por reserva confirmada; actualización de tipo de cambio; generación de alertas; notificaciones; reintentos de fee; reintentos de emisión de factura fiscal.

Toda acción automática debe tener log.

---

## 25. Penalizaciones y visibilidad

### 25.1 Métricas internas aprobadas

Respuesta y velocidad: 25%; disponibilidad actualizada: 20%; conversión a reserva: 20%; perfil completo/verificado: 15%; baja tasa de reclamos validados: 10%; uso operativo de la plataforma: 10%.

### 25.2 Uso

Internas en MVP. No deben mostrarse como ranking público.

### 25.3 Penalizaciones

`normal_visibility`; `warning`; `reduced_visibility`; `temporarily_paused`; `suspended`; `removed_from_network`.

### 25.4 Motivos

Baja tasa de respuesta; solicitudes vencidas; rechazos por falta de disponibilidad; falta de actualización; cancelaciones atribuibles a residencia; reclamos validados; información engañosa; discriminación; cambios abusivos de condiciones (fuera del mecanismo formal de propuesta de ajuste); incumplimiento de términos.

---

## 26. Marketing, emails y comunicaciones comerciales

### 26.1 Consentimiento separado

El consentimiento para usar EstuRed no debe mezclarse automáticamente con consentimiento para marketing. El usuario debe poder aceptar o rechazar comunicaciones comerciales.

### 26.2 Comunicaciones transaccionales

No requieren el mismo tratamiento que marketing porque son necesarias para operar: solicitudes; propuestas del familiar; negociaciones; pagos; reservas; comprobantes; facturas fiscales; renovaciones; seguridad; cambios de términos; soporte.

### 26.3 Baja de marketing

Debe existir opción de baja de comunicaciones comerciales.

---

## 27. Retención, eliminación y exportación de datos

### 27.1 Pendiente legal

La política exacta de retención debe ser validada legalmente.

### 27.2 Reglas operativas iniciales

El sistema debe permitir: solicitar baja de cuenta; solicitar rectificación de datos; solicitar eliminación de datos no necesarios; desactivar perfil visible; anonimizar datos cuando corresponda; conservar datos necesarios para operaciones, auditoría, pagos, obligaciones fiscales o reclamos.

### 27.3 Eliminación no debe romper trazabilidad

Si un usuario elimina cuenta, las operaciones confirmadas deben conservar trazabilidad mínima: reserva; pago; comprobante; factura fiscal; residencia; auditoría; obligaciones legales/fiscales. Cuando sea posible, datos personales no necesarios deben anonimizarse.

---

## 28. Seguridad técnica mínima

### 28.1 Autenticación

Email/password o magic link; OAuth opcional; 2FA para admin/superadmin (recomendado); verificación de email; recuperación segura de cuenta.

### 28.2 Autorización

No confiar en el frontend. Toda acción crítica debe validarse server-side, incluyendo el acceso restringido por residencia para usuarios que gestionan múltiples residencias.

### 28.3 Storage — nombres alineados con `06_DATA_MODEL.md`

- `public-residence-media` — fotos aprobadas de residencias.
- `private-user-documents` — documentos de estudiantes y familiares.
- `private-residence-documents` — DNI de responsables, checklist, documentación interna.
- `payment-proofs` — comprobantes de pago a residencia y pagos manuales del fee.
- `generated-receipts` — PDFs de comprobantes de reserva y renovación.
- `fiscal-documents` — Facturas C generadas por TusFacturas.app.
- `support-evidence` — evidencia de casos de soporte.

### 28.4 URLs firmadas

Documentos privados y comprobantes deben servirse mediante URLs firmadas o endpoints autorizados. La única excepción pública es la verificación de comprobante en `/verify/[verification_code]`, que expone únicamente datos mínimos no sensibles.

### 28.5 Logs sensibles

No loguear: documentos; números completos de documentos; tarjetas; tokens; datos bancarios; archivos de evidencia; contraseñas.

### 28.6 Backups

Deben existir backups y plan de recuperación.

---

## 29. Reglas para Claude Code

1. No exponer documentos privados en rutas públicas.
2. No devolver perfiles completos de estudiantes a invitados.
3. No mostrar apellido, email, teléfono, fecha de nacimiento, universidad o documentos en comunidad visible.
4. No permitir que residencia vea documentos fuera de contexto.
5. No permitir que cliente cambie estados críticos directamente.
6. No confirmar reservas sin fee EstuRed pagado o override admin auditado.
7. No emitir comprobantes antes de reserva confirmada.
8. No emitir factura fiscal antes de que el fee esté pagado.
9. No tratar `Residencia Verificada` como garantía total.
10. No usar rankings públicos de reputación en MVP.
11. No crear IA que invente disponibilidad, precios o condiciones.
12. No omitir auditoría en acciones admin.
13. No hardcodear proveedor de pagos (MercadoPago/PayU) ni fuente de tipo de cambio (monedapi.ar) ni proveedor de facturación (TusFacturas.app) en la lógica de negocio: usar las abstracciones correspondientes.
14. No hardcodear textos legales sin permitir versión/configuración futura.
15. No eliminar datos operativos necesarios al borrar una cuenta; usar anonimización cuando corresponda.
16. No permitir acciones de menores sin reglas de familiar vinculado.
17. No permitir que una propuesta de solicitud del familiar llegue a la residencia sin aprobación explícita del estudiante.
18. No permitir más de una propuesta de ajuste de condiciones por solicitud.
19. No calcular el fee EstuRed sobre el snapshot original si existe un snapshot final aceptado.
20. No integrar la API de WhatsApp Business; el contacto es siempre un botón manual con mensaje pre-formateado.
21. No otorgar acceso a Gestión Operativa sin que exista el feature flag habilitado explícitamente para esa residencia.

---

## 30. QA legal-operativo mínimo

Antes de lanzamiento, testear:

### Privacidad

Invitado no ve datos sensibles; registrado ve solo datos permitidos; residencia ve documentos solo con solicitud activa; admin accede a documentos con audit log y justificación previa; menor no completa registro sin familiar; residente no activado aparece sin datos personales; estudiante puede cambiar visibilidad; **propuesta del familiar no visible para la residencia antes de aprobación**; **staff con acceso a Residencia A no ve datos de Residencia B del mismo owner sin autorización explícita**.

### Solicitud, negociación y aceptación

Textos legales aparecen antes de enviar solicitud; checkbox obligatorio; snapshot original se guarda; **propuesta de ajuste respeta el límite de una por solicitud**; **snapshot final se genera solo tras aceptación explícita**; cambios posteriores requieren aceptación; solicitud pausada no muestra datos indebidos.

### Pagos, comprobantes y facturación

Fee no se cobra antes de `Pago recibido`; fee fallido no confirma reserva; comprobante no se emite sin fee pagado; **factura fiscal no se emite antes del fee pagado**; **fee se calcula sobre snapshot final si existe**; factura se emite al pagador; comprobante se emite al estudiante; monto a residencia aparece como informado por residencia; **selector de proveedor MercadoPago/PayU funciona con ambas monedas**.

### Reembolsos y cancelaciones

Cancelación por estudiante muestra política; cancelación por residencia habilita caso de soporte; reembolso fee requiere admin y auditoría; no-show queda registrado; pagos a residencia no se prometen como reembolsables por EstuRed.

### Residencias

No publica sin verificación; sello muestra alcance limitado; tarifas se auditan; cambios mayores a 15% generan alerta; disponibilidad vencida genera recordatorio y ocultamiento a los 15 días de `not_updated`; `Completa` funciona como estado manual; **feature flag freemium controla acceso a Gestión Operativa**.

### Soporte y resolución de conflictos

Reminder de términos aparece; evidencia se guarda privada; abrir caso no suspende automáticamente; admin puede tomar acción auditada.

---

## 31. Pendientes críticos antes del lanzamiento público

1. Redacción legal final de Términos y Condiciones para estudiantes.
2. Redacción legal final de Términos y Condiciones para residencias.
3. Política de Privacidad.
4. Política de Cookies si aplica.
5. Política de Reembolsos y Cancelaciones.
6. Suficiencia legal del botón de arrepentimiento ubicado en el footer (§15.4), incluyendo consultar la alternativa "reembolso por defecto dentro del plazo, salvo servicio sustancialmente prestado con consentimiento" — el esquema actual de revisión manual sin reembolso automático puede ser débil frente a la regla general de devolución de la Ley 24.240; el sistema debe poder soportar ambas políticas.
7. Validación fiscal del modelo de Factura C vía TusFacturas.app y monitoreo de límites del monotributo.
8. Contrato o adhesión para residencias pioneras, incluyendo cláusula de acceso freemium a Gestión Operativa.
9. Política de tratamiento de datos de menores (la decisión sobre propuestas ya está confirmada en §9.4 — decide el estudiante, incluso menor; la revisión legal debe validarla, junto con la regla de que el contacto con menores se dirige siempre al familiar vinculado).
10. Política de documentos y retención.
11. Política de soporte y resolución de conflictos.
12. Política antidiscriminación final.
13. Reglas de transferencia internacional de datos si se usa infraestructura cloud fuera de Argentina (Supabase).
14. Validación legal del copy `Residencia Verificada`.
15. Validación del modelo de pagos manuales/integrados (MercadoPago, PayU Argentina).
16. ~~Decisión final sobre 2FA obligatorio para admin/superadmin.~~ → Resuelto: obligatorio desde la beta privada (§24.2).
17. Validación legal del uso del "dólar blue" como referencia en textos comerciales y comprobantes (evaluar la fórmula neutra "cotización de referencia informada por la fuente configurada por EstuRed" en textos legales, manteniendo la transparencia de la fuente en la UI).

---

## 32. Resultado esperado

Si este documento se implementa correctamente, EstuRed podrá:

- operar con mayor seguridad jurídica y técnica;
- proteger datos personales, incluyendo los de propuestas del familiar antes de su aprobación;
- limitar exposición innecesaria;
- sostener comunidad visible sin romper privacidad;
- gestionar negociaciones de condiciones con trazabilidad completa;
- emitir comprobantes y facturas fiscales con alcance claro;
- cobrar fee con reglas transparentes en dos proveedores y dos monedas;
- ofrecer soporte y resolución de conflictos sin prometer garantías absolutas;
- penalizar malas prácticas con trazabilidad;
- construir confianza sin sobreprometer.

La confianza de EstuRed no debe depender solo de diseño o copy. Debe depender de reglas, procesos, consentimiento, trazabilidad y límites claros.
