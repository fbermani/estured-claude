# 18_RELEASE_AND_BETA_CHECKLIST.md

# EstuRed - Release & Beta Checklist

**Versión:** 1.1
**Estado:** Documento actualizado para construcción
**Última actualización:** 2026-06-27

## 1. Propósito de este documento

Define el checklist operativo para lanzar EstuRed a una beta controlada, evitando huecos críticos en producto, pagos, facturación fiscal, privacidad, admin, verificación, QA, soporte, métricas o legal.

Usar antes de cualquier lanzamiento a usuarios reales, incluso pequeño, privado o con residencias pioneras.

La beta no es una demo visual. Debe ser una operación real, limitada y controlada, capaz de completar el loop central del MVP:

**Estudiante (o familiar con aprobación del estudiante) busca residencia → envía solicitud → residencia establece contacto → [negociación opcional: la residencia propone un ajuste, una sola vez] → estudiante paga a la residencia → residencia marca "Pago recibido" → EstuRed cobra el fee (ARS o USD) → se emite factura fiscal → reserva confirmada → comprobante emitido.**

Si este loop no funciona de punta a punta, EstuRed no está listo para beta.

---

## 2. Definición de beta controlada

Primera operación real, limitada a CABA, con un grupo reducido de residencias verificadas y estudiantes reales o semi-reales.

Debe validar: si los estudiantes entienden y confían en la búsqueda; si las residencias aceptan gestionar solicitudes dentro de EstuRed; si el flujo de solicitud, contacto y **negociación de condiciones** reduce fricción; si el pago a residencia y el fee EstuRed (en ambos proveedores/monedas) se entienden; si el comprobante y **la factura fiscal** aportan valor; si las residencias mantienen disponibilidad actualizada; si el admin panel permite operar sin tocar base de datos; si la comunidad visible no genera rechazo o problemas de privacidad; si el fee del 5% es viable comercialmente; si renovaciones y Gestión Operativa (vía freemium) pueden empezar a justificar el valor de largo plazo; **si el mecanismo de propuesta del familiar tiene uso real y no genera fricción entre familiar y estudiante**.

La beta no busca escalar volumen. Busca validar operación, confianza y conversión.

---

## 3. Alcance recomendado de la beta

### 3.1. Mercado

CABA; estudiantes del interior de Argentina; estudiantes del exterior; familias que acompañan la búsqueda.

### 3.2. Oferta inicial

5 a 10 residencias verificadas en CABA; perfiles completos; fotos reales; reglas claras; tarifas en USD y ARS; política de ajustes publicada; condiciones de reserva publicadas; disponibilidad configurada; responsable validado; visita presencial completada; checklist firmado.

No lanzar con residencias incompletas solo para aparentar volumen.

### 3.3. Tipos de residencias beta

Idealmente: residencias en Modo Perfil Verificado; al menos 1 o 2 en Modo Gestión Operativa (**con feature flag freemium activo, siendo pioneras con 1 año de acceso gratuito**); al menos una completa para probar lista de espera; al menos una con tarifas y política de ajustes clara; al menos una que acepte renovar dentro de EstuRed; **idealmente, al menos un owner con más de una residencia para validar el dashboard multi-residencia en condiciones reales (no solo en QA)**.

---

## 4. Principio de lanzamiento

EstuRed no debe lanzarse cuando "la web se ve bien". Debe lanzarse cuando el sistema puede: registrar usuarios; verificar roles; mostrar residencias verificadas; permitir solicitudes directas **y vía propuesta del familiar**; pausar solicitudes alternativas; gestionar contacto; **gestionar una propuesta de ajuste de condiciones**; registrar pago a residencia; cobrar o registrar fee EstuRed **en ambos proveedores y monedas**; **emitir factura fiscal automáticamente**; confirmar reserva; emitir comprobante; auditar acciones críticas; operar desde admin (**incluyendo gestión de propuestas del familiar, negociaciones y feature flags freemium**); proteger datos personales; registrar reclamos; medir conversión y respuesta.

Si cualquiera de estos puntos falla, el lanzamiento debe bloquearse.

---

## 5. Gates de lanzamiento

### Gate 0 - Documentación lista

Deben existir y estar actualizados los 23 documentos del proyecto (`00` a `22`, ver `14_PROJECT_INDEX.md`).

Criterio de salida: no hay contradicciones críticas entre documentos; Claude Code tiene instrucciones suficientes; el scope del MVP está cerrado; los pendientes no bloqueantes están identificados; **las decisiones de proveedores (MercadoPago, PayU, monedapi.ar, TusFacturas.app) están confirmadas y no figuran como pendientes en ningún archivo**.

---

### Gate 1 - Local funcionando

Criterios mínimos: app levanta sin errores; Supabase local conectado; migraciones corren correctamente (**incluyendo `family_application_proposals` y `application_negotiation_proposals`**); seeds cargan usuarios, residencias, habitaciones, solicitudes, reservas y admin (**incluyendo al menos una propuesta del familiar y una negociación, ver `17_SEED_DATA_AND_DEMO_SCENARIOS.md`**); rutas públicas funcionan; `/students`, `/residence` (**incluyendo vista multi-residencia**) y `/admin` funcionan; no hay errores graves en consola; tests base pasan.

No se avanza a staging si el entorno local depende de datos cargados manualmente sin documentar.

---

### Gate 2 - Staging operativo

Debe incluir: base de datos staging; auth configurado; storage configurado; RLS activo (**incluyendo aislamiento entre residencias del mismo owner**); variables de entorno separadas; **MercadoPago y PayU en modo test**; **monedapi.ar conectado o mockeado**; **TusFacturas.app en modo sandbox**; notificaciones en modo test (email + in-app); generación de PDF/QR; audit log activo; admin panel funcional (**incluyendo `/admin/family-proposals`, `/admin/negotiations`, `/admin/invoices`, gestión de freemium**); seeds de staging; logs visibles.

Criterio de salida: flujo E2E completo probado al menos 3 veces (**incluyendo al menos una vez con negociación y una vez con propuesta del familiar**); usuario estudiante no puede acceder a datos de otra persona; residencia no puede acceder a datos de otra residencia (**incluyendo entre residencias del mismo owner sin asignación explícita**); admin puede operar casos críticos; comprobante solo se emite después de reserva confirmada; **factura fiscal solo se emite después de fee pagado**; no hay bypass técnico evidente del fee.

---

### Gate 3 - Beta privada

Condiciones: 5 a 10 residencias verificadas; usuarios invitados por EstuRed; soporte manual cercano; monitoreo diario; capacidad de intervenir operaciones; medios de pago definidos (**MercadoPago y PayU activos, o modo manual como fallback**); términos y condiciones visibles; política de privacidad visible; textos de aceptación visibles (**incluyendo los de propuesta del familiar y negociación, ver `10_PRIVACY_AND_LEGAL_RULES.md` §17**); canal de contacto activo; plan de rollback operativo.

Criterio de salida: primeras solicitudes reales enviadas; residencias responden; al menos una reserva puede completarse de punta a punta (**con factura fiscal emitida**); se validan fricciones principales; no hay incidentes graves de privacidad, pagos, facturación o comprobantes.

---

### Gate 4 - Beta pública limitada

Solo si la beta privada demuestra que el loop principal funciona.

Condiciones: onboarding de residencias estable; admin panel estable; métricas mínimas disponibles; soporte preparado; documentación legal revisada; proceso de verificación repetible; contenido público listo; tracking de conversión activo; plan de adquisición inicial definido.

No escalar tráfico si las residencias no responden o si hay disponibilidad desactualizada recurrente.

---

## 6. Checklist de producto antes de beta

### 6.1. Landing y navegación pública

Debe estar listo: landing principal; landing estudiantes/familias; landing residencias; búsqueda pública; detalle público de residencia (**con FAQ y modal de tipo de cambio referencial**); CTAs claros; responsive mobile; estados loading/error/empty; copy claro sobre disponibilidad sujeta a confirmación; explicación de "Residencia Verificada"; explicación del fee EstuRed; explicación de comprobante.

Bloquea lanzamiento si: el usuario no entiende que la solicitud no confirma reserva; no se explica el fee antes de enviarse la solicitud; la disponibilidad parece garantizada cuando no lo está; una residencia no verificada puede aparecer como verificada.

---

### 6.2. Registro y onboarding

Debe estar listo: selector de rol; registro estudiante; registro familiar; registro residencia; onboarding estudiante; onboarding residencia; validación de menor de edad; vinculación familiar; aprobación del estudiante para familiar; configuración de visibilidad; aceptación de términos; aceptación de privacidad.

Bloquea lanzamiento si: un menor puede finalizar registro sin familiar vinculado; un familiar puede operar sin aprobación del estudiante; una residencia puede publicar sin aceptar términos; un usuario puede acceder a zonas de otro rol sin permiso.

---

### 6.3. Búsqueda y detalle de residencia

Debe estar listo: filtros mínimos; cards de residencia; precios USD/ARS; **modal de tipo de cambio referencial visible (fuente monedapi.ar)**; estado de disponibilidad; sello verificado; fotos; reglas; servicios; política de ajustes; condiciones de reserva; matrícula; depósito; comunidad visible según permisos; **FAQ funcional (listado predefinido + respuestas + pregunta libre)**; CTA solicitud; CTA lista de espera si corresponde.

Bloquea lanzamiento si: los precios no guardan snapshot; no se distingue depósito reembolsable de matrícula/cargos no reembolsables; el usuario puede solicitar sin ver condiciones principales; la comunidad visible expone datos prohibidos.

---

### 6.4. Propuestas de solicitud del familiar (sección nueva)

Debe estar listo: familiar con vínculo activo puede crear propuesta; propuesta queda oculta para la residencia hasta aprobación; estudiante ve propuestas pendientes en `/students/family-proposals`; estudiante puede aprobar (crea solicitud con `contact_target = family_member`) o rechazar; propuesta vence a las 48h sin respuesta; propuestas pendientes no cuentan en el límite de 2 solicitudes activas.

Bloquea lanzamiento si: una propuesta llega a la residencia sin aprobación del estudiante; el familiar puede enviar solicitudes directamente; una propuesta pendiente bloquea el límite de solicitudes del estudiante indebidamente.

---

### 6.5. Solicitudes

Debe estar listo: crear solicitud (directa o vía propuesta aprobada); validar máximo 2 solicitudes activas; snapshot de condiciones original; estado `submitted`; residencia puede revisar; residencia puede establecer contacto; solicitud alternativa se pausa; residencia puede rechazar con motivo (enum); solicitud vence a **las 48 horas** (no 72h); residencia recibe recordatorios; estudiante ve estado claro, incluyendo botón "Actualizar con mismos parámetros" al vencer.

Bloquea lanzamiento si: se pueden crear más de 2 solicitudes activas; una solicitud alternativa se anula prematuramente en vez de pausarse; no se guarda snapshot; una residencia puede aceptar varias solicitudes para la misma plaza sin control; una residencia puede rechazar sin motivo interno; el vencimiento usa un plazo distinto a 48h en cualquier flujo.

---

### 6.6. Negociación de condiciones (sección nueva)

Debe estar listo: residencia puede enviar una propuesta de ajuste de condiciones (**máximo 1 por solicitud**, con advertencia bloqueante antes de enviarla); estudiante ve comparación original vs. propuesta; estudiante puede aceptar (genera `snapshot_final`, recalcula fee), rechazar y continuar con condiciones originales, o rechazar y cerrar; el plazo de 48h se reinicia al enviar la propuesta.

Bloquea lanzamiento si: una residencia puede enviar más de una propuesta de ajuste por solicitud; el fee se calcula sobre el snapshot original habiendo negociación aceptada; el estudiante puede editar la propuesta en vez de solo aceptar/rechazar; los campos del estudiante son modificables en la propuesta.

---

### 6.7. Pago a residencia

Debe estar listo: sección dentro del detalle de solicitud; instrucciones de contacto; **botón de WhatsApp pre-formateado (sin integración de API) con el número correcto según `contact_target`**; plazo de 48 horas; estudiante puede subir comprobante para referencia; residencia puede marcar "Pago recibido"; aceptación específica de la residencia antes de confirmar pago recibido.

Bloquea lanzamiento si: el comprobante subido por estudiante confirma reserva automáticamente; la residencia puede marcar pago recibido sin aceptar responsabilidades; no queda auditado quién marcó pago recibido; no se distingue pago a residencia de fee EstuRed; **existe cualquier integración de API de WhatsApp Business**.

---

### 6.8. Fee EstuRed y facturación fiscal

Debe estar listo: cálculo 5%; base de cálculo correcta **sobre `snapshot_final`**; inclusión de matrícula/cargos obligatorios no reembolsables; exclusión de depósito reembolsable; cálculo sobre tarifa actual, sin ajustes futuros; **cobro en ARS vía MercadoPago o en USD vía PayU, a elección del pagador**; conversión desde USD/ARS con tipo de cambio del snapshot; redondeo a múltiplos de 500 ARS; pago automático o manual; 3 intentos dentro de 48 horas si falla cobro automático; estados `paid`/`failed`/`expired`; admin puede validar pago manual; admin puede reembolsar con motivo; **factura fiscal (Factura C, TusFacturas.app) se emite automáticamente al confirmarse el pago**.

Bloquea lanzamiento si: el fee puede quedar impago y aun así confirmar reserva; el fee se calcula incluyendo depósito reembolsable; el fee cambia después del snapshot final sin aceptación; no hay forma de auditar pagos manuales; no hay forma de manejar reembolso; **se puede emitir factura fiscal antes de que el fee esté pagado**; **el fee solo puede cobrarse en un proveedor/moneda**.

**No bloquea** (decisión de producto ya asumida): que la factura fiscal falle tras el fee pagado — en ese caso la reserva se confirma igual y la factura se reintenta por job. Sí bloquea que ese estado de falla no sea visible en `/admin/invoices`.

---

### 6.9. Reserva y comprobante

Debe estar listo: reserva nace luego de "Pago recibido" por residencia; reserva queda pendiente de fee; reserva confirma solo con fee pagado; comprobante se genera solo con reserva confirmada; comprobante tiene PDF; comprobante tiene **`verification_code` y QR verificable en `/verify/[codigo]`**; comprobante incluye monto informado por residencia; comprobante incluye fee EstuRed y moneda; comprobante incluye objetivo académico declarado; comprobante incluye duración inicial; comprobante incluye **condiciones finales (snapshot_final)**; comprobante incluye política de ajustes; comprobante incluye disclaimer; **comprobante referencia la factura fiscal asociada**; admin puede reemitir; admin puede anular; fallos de PDF quedan en `receipt_pending` o `generation_failed`.

Bloquea lanzamiento si: se puede emitir comprobante sin fee pagado; se puede confirmar reserva sin pago a residencia informado; el comprobante no aclara alcance de EstuRed; no se puede reemitir comprobante ante falla técnica; `/verify/[codigo]` expone datos sensibles.

---

### 6.10. Lista de espera

Sin cambios de fondo. Debe estar listo: sumarse a lista de espera; no cuenta como solicitud activa; lista por residencia/tipo/plaza/fecha/duración; notificación cuando aparece disponibilidad; estudiante decide activar solicitud; residencia puede eliminar manualmente; salida automática si confirma reserva en otra residencia; recordatorio a los 90 días; no vence automáticamente por tiempo.

---

### 6.11. Renovaciones

Debe estar listo: estudiante puede solicitar renovación (informal); residencia puede crear oferta formal; oferta incluye período, tarifa, moneda, política de ajustes, fecha límite; estudiante acepta o rechaza; pago a residencia si corresponde; residencia marca pago recibido; EstuRed cobra fee de renovación (**idéntico en lógica al fee de reserva inicial, sin excepciones**); **factura fiscal de renovación emitida automáticamente**; comprobante de renovación confirmada con `verification_code` propio; admin puede intervenir.

Bloquea lanzamiento si: se confirma renovación sin fee pagado; se emite comprobante sin confirmación; no queda claro que el estudiante solo solicita y la residencia emite oferta formal; no hay fecha límite de oferta; **el fee de renovación usa una fórmula distinta a la de la reserva inicial**.

---

### 6.12. Gestión Operativa y freemium (sección actualizada)

Debe estar listo para residencias con feature flag activo: habitaciones; tipos de habitación; plazas/camas; estado de plaza; residentes; disponibilidad real; solicitudes por plaza; reservas; renovaciones; comunidad visible; dashboard completo; métricas básicas; **panel de gestión del feature flag en `/residence/[residence_id]/plan` y `/admin/residences/[id]/plan`**.

No debe incluir todavía: tickets de mantenimiento; inventario avanzado; check-in/check-out detallado; IA avanzada; reportes complejos.

Bloquea lanzamiento si: Gestión Operativa rompe el flujo simple de Perfil Verificado; una residencia sin Gestión Operativa queda obligada a cargar residentes; una plaza puede quedar en estados contradictorios; **una residencia sin el feature flag activo puede acceder a funciones de Gestión Operativa mediante manipulación directa de requests (debe bloquearse server-side)**.

---

### 6.13. Multi-residencia (sección nueva)

Debe estar listo: owner puede gestionar hasta 10 residencias desde el mismo login; `/residence/dashboard` muestra bloques en scroll vertical con filtro, sin vista agregada; staff puede tener acceso a una o varias residencias del mismo owner; alta de nueva residencia desde `/residence/settings/new`.

Bloquea lanzamiento si: datos de una residencia son visibles en el contexto de otra del mismo owner sin asignación explícita; un staff ve residencias fuera de su asignación; existe una vista agregada con métricas consolidadas (no debería existir en el MVP).

---

### 6.14. Comunidad visible

Sin cambios de fondo. Datos nunca visibles: apellido completo; mail; teléfono; fecha de nacimiento; universidad; documentos.

Bloquea lanzamiento si: se exponen datos sensibles; no hay consentimiento; un residente pendiente muestra datos personales; la residencia puede forzar visibilidad completa; **el contenido de una propuesta del familiar es visible para alguien fuera del familiar creador y el estudiante destinatario**.

---

### 6.15. FAQ / bot limitado

Debe estar Must Have (ya no opcional): responde solo desde datos cargados (preguntas del listado predefinido + respuestas + archivos); no inventa precios; no confirma disponibilidad no cargada; no promete condiciones; registra preguntas no respondidas; residencia puede agregar FAQ; admin puede revisar.

Bloquea lanzamiento si: el bot puede alucinar disponibilidad, precio o condiciones; no queda registro de preguntas problemáticas; el usuario confunde respuesta del bot con confirmación formal de reserva.

---

## 7. Checklist admin antes de beta

### 7.1. Residencias

Ver residencias por estado; crear/editar; pausar; suspender; archivar; ver auditoría; ver modo de residencia; ver disponibilidad; ver alertas; **gestionar feature flag freemium con motivo y fecha límite**.

### 7.2. Verificación

Revisar DNI responsable; revisar coordinador si aplica; registrar visita presencial; guardar checklist firmado; aprobar/rechazar verificación; pedir cambios; marcar vencimiento anual.

### 7.3. Tarifas

Ver historial de tarifas; ver USD/ARS; ver tipo de cambio usado; detectar cambios mayores a ±15%; marcar alerta como revisada; contactar residencia; pausar si hay abuso.

### 7.4. Solicitudes

Ver todas las solicitudes; filtrar por estado (**incluyendo negociación activa y origen `initiated_by`**); anular; pausar; reiniciar; editar con motivo; intervenir; ver rechazos por falta de disponibilidad.

### 7.5. Propuestas del familiar (sección nueva)

Ver listado en `/admin/family-proposals`; ver estado, familiar, estudiante, residencia sugerida, tiempo de respuesta; derivar a soporte si hay disputa entre familiar y estudiante.

### 7.6. Negociaciones (sección nueva)

Ver listado en `/admin/negotiations`; ver campos modificados, fechas, respuesta del estudiante; intervenir en solicitud asociada si está trabada.

### 7.7. Reservas

Ver reservas por estado; confirmar manualmente solo con override auditado; cancelar; marcar no-show; abrir caso de soporte; ver comprobante; ver fee; **ver factura fiscal asociada**.

### 7.8. Pagos

Ver fees pendientes/procesando/fallidos/vencidos/pagados/reembolsados **con columna de proveedor (MercadoPago/PayU/manual) y moneda**; validar pagos manuales; registrar comprobantes; iniciar reembolso; registrar chargeback.

### 7.9. Facturas fiscales (sección nueva)

Ver listado en `/admin/invoices`; ver estados `pending_emission`/`emitted`/`emission_failed`; reintentar emisión fallida; reemitir con motivo; descargar PDF.

### 7.10. Comprobantes

Generar; reemitir; anular; descargar; ver `verification_code`/QR; ver fallos.

### 7.11. Usuarios

Ver estudiantes; ver familiares; ver vínculos; ver residencias (**con indicador de owner multi-residencia**); ver staff (**con indicador de residencias asignadas**); bloquear; desbloquear; auditar.

### 7.12. Soporte y resolución de conflictos (renombrado de "Mediaciones")

Ver casos; pedir evidencia; contactar partes; cerrar sin acción; registrar acuerdo; tomar acción admin; reembolsar fee si corresponde; penalizar residencia si corresponde.

### 7.13. Auditoría

Debe registrar: quién hizo la acción; qué entidad afectó; estado anterior; estado nuevo; timestamp; motivo; fuente (user/admin/system/payment_provider); metadata relevante.

Bloquea lanzamiento si: una acción crítica no queda auditada; admin no puede intervenir solicitudes trabadas; admin no puede ver pagos fallidos; admin no puede reemitir comprobantes o facturas; admin no puede suspender residencias; **admin no puede gestionar propuestas del familiar, negociaciones o feature flags freemium**.

---

## 8. Checklist técnico antes de beta

### 8.1. Infraestructura

Repositorio estable; variables de entorno documentadas (**incluyendo MercadoPago, PayU, monedapi.ar, TusFacturas.app**); local/staging/prod separados; Supabase configurado; migraciones versionadas; RLS activo; storage buckets configurados (**incluyendo `fiscal-documents`**); backups definidos; logs accesibles; hosting configurado; dominio o subdominio de beta.

### 8.2. Seguridad

RLS validado (**incluyendo aislamiento multi-residencia**); **2FA activo y obligatorio para admin/superadmin (TOTP vía Supabase Auth MFA)**; service role solo server-side; documentos protegidos; usuarios no acceden a otro tenant; staff no cruza residencias sin asignación; admin actions auditadas; datos sensibles no aparecen en frontend; rate limiting básico en acciones sensibles; validación server-side en todos los flujos críticos, **incluyendo el límite de 1 propuesta de ajuste por solicitud**.

### 8.3. Pagos y facturación (actualizado)

`PaymentProvider` abstracto con **MercadoPago y PayU implementados**; modo manual funcionando; webhooks validados por proveedor; idempotencia; reintentos; reembolsos manuales; estados internos independientes del proveedor; **`FiscalInvoiceProvider` abstracto con TusFacturas.app implementado**; emisión automática tras fee pagado; reintento independiente si falla.

### 8.4. Tipo de cambio

`ExchangeRateProvider` abstracto; **fuente confirmada: monedapi.ar (dólar blue, valor venta)**; actualización diaria; override admin con motivo; snapshot por solicitud (original y final si hubo negociación); logs de fallo; redondeo aplicado.

### 8.5. PDF / QR

Generación server-side; `verification_code` único e impredecible; almacenamiento seguro; reemisión; anulación; manejo de errores.

### 8.6. Notificaciones (corregido)

Canales: **email** (mínimo obligatorio) e **in-app**. **WhatsApp no es un canal de notificación** — no hay integración de API; el único artefacto es el botón manual pre-formateado. Plantillas básicas; registro de envío; fallos registrados; recordatorios críticos.

Eventos mínimos: solicitud enviada/recibida; **propuesta del familiar creada/aprobada/rechazada/vencida**; residencia establece contacto; **propuesta de ajuste enviada/respondida/vencida**; plazo de 48h iniciado; pago recibido informado; fee pendiente/pagado; **factura fiscal emitida/fallida**; reserva confirmada; comprobante emitido; solicitud vencida; lista de espera con disponibilidad; renovación enviada; caso de soporte abierto.

---

## 9. Checklist legal-operativo antes de beta

No reemplaza revisión legal profesional. Debe estar listo: términos y condiciones para estudiantes; términos y condiciones para residencias; política de privacidad; política de cookies si aplica; política de fee; política de reembolso; **política de soporte y resolución de conflictos** (no "mediación"); política antidiscriminación; deslinde de responsabilidad; aceptación de residencia al marcar pago recibido; aceptación de estudiante antes de pagar fee; aceptación de familiar pagador; **aceptación del estudiante al aprobar propuesta del familiar**; **aceptación del estudiante al responder propuesta de ajuste**; texto sobre "Residencia Verificada"; texto sobre disponibilidad sujeta a confirmación; tratamiento de menores (**decisión confirmada: decide el estudiante, incluso menor — ver `10_PRIVACY_AND_LEGAL_RULES.md` §9.4; y el contacto de la residencia se dirige siempre al familiar vinculado — §9.5; la revisión legal debe validar ambas reglas**); tratamiento de datos personales; criterios para suspensión/expulsión; revisión de normativa aplicable sobre contratación a distancia; **suficiencia legal del botón de arrepentimiento en el footer (el flujo ya está implementado en el MVP: enlace + pantalla + revisión admin)**.

Bloquea lanzamiento si: no hay términos visibles; no hay política de privacidad; no se explica el alcance de EstuRed; no se explica el alcance de Residencia Verificada; no se explica el fee; no hay consentimiento para comunidad visible; no hay regla clara para menores; **no existen los textos de aceptación de propuesta del familiar y de negociación**.

---

## 10. Checklist de residencias pioneras

Sin cambios de fondo, agregar: **acceso freemium a Gestión Operativa activado explícitamente con fecha límite a 1 año, si corresponde**; **owner informado de si gestiona una o varias residencias en EstuRed**.

No lanzar una residencia si: no fue visitada; no tiene condiciones claras; no tiene precio; no tiene disponibilidad o estado completa; no aceptó términos; no hay responsable validado.

---

## 11. Checklist de usuarios beta

Agregar a la lista existente: **propuesta del familiar probada de punta a punta**; **negociación de condiciones probada de punta a punta**.

Para estudiantes internacionales: tarifas USD/ARS claras; tipo de cambio visible; **medio de pago en USD disponible (PayU) o alternativa manual**; documentación opcional clara.

---

## 12. Checklist de contenido y microcopy

Agregar a la lista existente: **texto de advertencia de "única propuesta de ajuste" antes de que la residencia la envíe**; **texto de vista comparativa de negociación para el estudiante**.

Criterios: no prometer más de lo que EstuRed controla; no decir "garantizado" salvo disponibilidad asegurada por Gestión Operativa; no ocultar fee; no usar lenguaje confuso sobre pagos; no presentar "Residencia Verificada" como garantía absoluta; no mostrar comunidad visible como ranking; **no usar la palabra "mediación" en textos públicos**.

---

## 13. Checklist de métricas antes de beta

Agregar a la lista existente: **propuestas del familiar creadas/aprobadas/rechazadas/vencidas**; **negociaciones iniciadas/aceptadas/rechazadas/vencidas**; **facturas fiscales emitidas/fallidas**; **desglose de fee por proveedor y moneda**.

Métricas internas de visibilidad sin cambios: respuesta y velocidad 25%; disponibilidad actualizada 20%; conversión a reserva 20%; perfil completo/verificado 15%; baja tasa de reclamos validados 10%; uso operativo de plataforma 10%. No mostrar ranking público en MVP.

---

## 14. Checklist QA antes de beta

Agregar a la lista existente: **test E2E de propuesta del familiar (aprobada y rechazada)**; **test E2E de negociación de condiciones (aceptada y rechazada)**; **test de fee en ambos proveedores (MercadoPago y PayU)**; **test de emisión de factura fiscal y de su fallo no bloqueante**; **test de dashboard multi-residencia sin cruce de datos**; **test de bloqueo server-side de Gestión Operativa sin feature flag**.

Bloquea lanzamiento si falla: privacidad; permisos; pagos; **facturación fiscal**; comprobantes; admin; audit log; reservas; verificación; **límite de 1 propuesta de ajuste**; **aislamiento multi-residencia**.

---

## 15. Plan operativo para beta

### 15.1. Antes de abrir beta

Seleccionar residencias pioneras; completar verificación; cargar perfiles; revisar tarifas; configurar disponibilidad; **activar feature flag freemium para pioneras que corresponda**; capacitar owners (**incluyendo cómo funciona la negociación de condiciones y sus límites**); crear usuarios admin; probar notificaciones; cargar seed real o datos iniciales; revisar legal; preparar soporte; definir canal de emergencia; ejecutar smoke test; congelar cambios no críticos.

### 15.2. Día de apertura

Validar que producción esté activa; probar login admin; probar búsqueda; probar una solicitud test (**incluyendo una vía propuesta del familiar**); probar notificaciones; revisar logs; revisar pagos **en ambos proveedores**; **revisar emisión de factura fiscal de prueba**; revisar admin dashboard; monitorear errores; invitar primeros usuarios; registrar feedback manual.

### 15.3. Primeras 48 horas

Revisar diariamente: solicitudes enviadas; solicitudes sin respuesta; **propuestas del familiar pendientes**; errores de usuario; errores técnicos; dudas recurrentes; residencias que no responden; confusión sobre fee; confusión sobre pago a residencia; **confusión sobre la propuesta de ajuste de condiciones**; uso de lista de espera; problemas de privacidad; problemas mobile.

### 15.4. Primera semana

Revisar: conversión búsqueda → solicitud; conversión solicitud → contacto; **contacto → negociación (si aplica) → pago residencia**; pago residencia → fee; fee → factura fiscal → comprobante; tiempo respuesta residencias; motivos de rechazo; objeciones sobre fee; objeciones sobre datos visibles; utilidad percibida del comprobante; **utilidad percibida de la propuesta del familiar**; **frecuencia de uso de la negociación de condiciones**; carga operativa admin; performance.

### 15.5. Primer mes

Decidir: mantener fee 5%; ajustar comunicación del fee; mejorar onboarding residencia; reforzar lista de espera; mejorar comunidad visible; automatizar pagos; simplificar dashboard residencia; **evaluar si el plazo de 48h en la negociación es suficiente o genera fricción**; **evaluar si el límite de 1 propuesta de ajuste es adecuado**; preparar expansión o mantener beta cerrada.

---

## 16. Criterios de éxito de beta

Agregar a la lista existente: **al menos una propuesta del familiar completada de punta a punta**; **al menos una negociación de condiciones completada de punta a punta**; **fee cobrado exitosamente en ambos proveedores al menos una vez cada uno**; **al menos una factura fiscal emitida correctamente**; **si hay owner multi-residencia en beta, el dashboard funciona sin cruce de datos**.

---

## 17. Criterios de no lanzamiento

Agregar a la lista existente: **no hay forma de emitir factura fiscal**; **no hay forma de cobrar el fee en al menos un proveedor funcional**; **no hay forma de que el familiar cree una propuesta de solicitud**; **no hay forma de que la residencia envíe una propuesta de ajuste con el límite de 1 respetado**.

---

## 18. Rollback y contingencia

Agregar a la lista existente: **pausar la emisión automática de facturas fiscales (modo degradado: admin emite manualmente)**; **desactivar temporalmente el flujo de negociación si genera abuso o confusión (la solicitud sigue funcionando sin ese paso)**; **desactivar temporalmente la creación de nuevas propuestas del familiar sin afectar las existentes**.

Si algo falla en beta, EstuRed debe poder operar manualmente sin perder trazabilidad.

---

## 19. Incidentes críticos

Agregar a la lista existente: **factura fiscal emitida con datos incorrectos**; **fee cobrado dos veces en proveedores distintos para la misma reserva**; **residencia envía más de una propuesta de ajuste por solicitud**; **residencia sin feature flag accede a Gestión Operativa**; **residencia de un owner ve datos de otra residencia del mismo owner sin autorización**.

Acción ante incidente: 1) pausar funcionalidad afectada; 2) registrar incidente; 3) revisar audit log; 4) contactar partes si corresponde; 5) corregir dato o estado; 6) documentar causa; 7) ejecutar test de regresión; 8) decidir si se reactiva.

---

## 20. Feedback y aprendizaje

Agregar a la lista existente: **¿El familiar entiende que su propuesta necesita aprobación del estudiante?** **¿La negociación de condiciones se siente clara o confusa?** **¿El límite de 1 propuesta de ajuste es suficiente en la práctica?**

---

## 21. Qué no debe optimizarse todavía

Sin cambios de fondo: SEO masivo; campañas pagas grandes; expansión geográfica; app nativa; IA avanzada; reviews; Señales de Convivencia; marketplace de servicios; PMS complejo; reportes avanzados; automatización total; **dashboard agregado multi-residencia con métricas consolidadas**.

---

## 22. Regla para Claude Code

Antes de marcar una fase como terminada, verificar: si cumple el scope; si respeta reglas de negocio; si respeta estados (incluyendo `family_application_proposal` y negociación); si respeta permisos (incluyendo aislamiento multi-residencia); si respeta privacidad; si audita acciones críticas; si tiene QA mínimo; si no rompe el loop central (incluyendo su instancia opcional de negociación); si no introduce features fuera de MVP; **si no emite factura fiscal antes de fee pagado**; **si no permite más de 1 propuesta de ajuste por solicitud**.

Claude no debe suavizar bloqueos de lanzamiento. Si un criterio crítico no se cumple, debe marcarlo como blocker.

---

## 23. Checklist compacto de release — actualizado

- [ ] 5 a 10 residencias verificadas.
- [ ] Admin panel operativo (incluyendo propuestas del familiar, negociaciones, facturas fiscales, freemium).
- [ ] RLS y permisos probados (incluyendo aislamiento multi-residencia).
- [ ] Residencias publicadas con perfil completo.
- [ ] Propuestas del familiar funcionan de punta a punta.
- [ ] Solicitudes funcionan.
- [ ] Negociación de condiciones funciona con límite de 1 propuesta respetado.
- [ ] Contacto estructurado funciona (botón WhatsApp, sin API).
- [ ] Pago a residencia queda registrado.
- [ ] Fee EstuRed funciona en MercadoPago y PayU.
- [ ] Factura fiscal se emite automáticamente.
- [ ] Comprobante se emite con `verification_code` verificable.
- [ ] Revocación del fee funciona (enlace en footer + pantalla + revisión admin) y se bloquea fuera de los 10 días.
- [ ] Fee vencido deja la reserva en `expired_fee_unpaid`.
- [ ] Contacto con estudiantes menores se dirige al familiar vinculado.
- [ ] Renovaciones funcionan con fee idéntico al inicial.
- [ ] Lista de espera funciona.
- [ ] Gestión Operativa funciona para residencias con feature flag activo.
- [ ] Multi-residencia funciona sin cruce de datos.
- [ ] Comunidad visible respeta permisos.
- [ ] Documentos protegidos.
- [ ] Auditoría activa.
- [ ] Notificaciones críticas activas (email + in-app).
- [ ] Tipo de cambio operativo (monedapi.ar).
- [ ] Tarifas USD/ARS visibles con modal referencial.
- [ ] Alertas de tarifas ±15% activas.
- [ ] Términos visibles (incluyendo textos de propuesta del familiar y negociación).
- [ ] Privacidad visible.
- [ ] Soporte/contacto visible.
- [ ] Soporte y resolución de conflictos disponible.
- [ ] QA completo ejecutado.
- [ ] Smoke test aprobado.
- [ ] Rollback definido.
- [ ] Residencias capacitadas.
- [ ] Métricas instrumentadas.

---

## 24. Estado de este documento

Listo para usarse como checklist de beta.

Debe actualizarse si cambia cualquiera de estas decisiones: fee; proveedores de pago; proveedor de tipo de cambio; proveedor de facturación fiscal; política de reembolso; alcance de renovaciones; alcance de Gestión Operativa/freemium; reglas de multi-residencia; comunidad visible; verificación de residencias; privacidad; rutas principales; lista de espera; admin panel; reglas de negociación de condiciones; reglas de propuesta del familiar; lanzamiento público.
