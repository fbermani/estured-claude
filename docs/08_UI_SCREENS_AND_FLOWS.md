# 08_UI_SCREENS_AND_FLOWS.md
# EstuRed — Pantallas y Flujos UI del MVP

**Versión:** 0.2
**Estado:** Documento actualizado para construcción
**Última actualización:** 2026-06-27
**Depende de:** `00_DECISION_LOG.md`, `01_PRODUCT_BRIEF.md`, `02_MVP_SCOPE.md`, `03_BUSINESS_RULES.md`, `04_STATE_MACHINES.md`, `05_ROLES_AND_PERMISSIONS.md`, `06_DATA_MODEL.md`, `07_API_SPEC.md`

---

## 1. Propósito del documento

Este documento define la arquitectura de pantallas, rutas, flujos principales, estados visuales, acciones disponibles y responsabilidades de interfaz para el MVP de EstuRed.

Debe usarse para construir:

- navegación general;
- rutas públicas;
- dashboard de estudiantes y familiares;
- dashboard de residencias (incluyendo multi-residencia);
- dashboard admin de EstuRed;
- pantallas de propuesta del familiar, solicitud, negociación, reserva, pago y comprobante;
- flujos de disponibilidad, lista de espera y renovación;
- pantallas de configuración, comunidad visible, FAQ y privacidad;
- estados vacíos, loading, errores y confirmaciones críticas;
- QA funcional de UI.

Este documento no es un wireframe visual ni un design system. Define qué debe existir, qué debe mostrar cada pantalla, qué acciones permite y cómo se conecta con las reglas de negocio.

---

## 2. Principios obligatorios de UI

### 2.1. El loop principal manda sobre todo

El loop central definitivo del MVP es:

**Estudiante (o familiar con aprobación del estudiante) busca residencia → envía solicitud → residencia establece contacto → [negociación opcional: la residencia propone ajustes, una vez] → estudiante acepta condiciones finales → estudiante paga a la residencia → residencia marca "Pago recibido" → EstuRed cobra el fee → reserva confirmada → comprobante emitido.**

Toda pantalla debe ayudar directa o indirectamente a este loop. Si una pantalla no fortalece búsqueda, solicitud, negociación, confirmación, cobro, comprobante, renovación, disponibilidad o gestión operativa, debe quedar fuera del MVP.

### 2.2. Tres áreas autenticadas principales

- `/students` para estudiante y familiar vinculado.
- `/residence` para owner y staff de residencias (incluye multi-residencia, hasta 10).
- `/admin` para Admin y Superadmin EstuRed.

El familiar vinculado usa el área `/students`, con permisos limitados según el vínculo aprobado por el estudiante.

### 2.3. Separar propuesta, solicitud, negociación, pago, reserva y comprobante

La UI nunca debe tratar estos conceptos como una misma cosa.

- Una propuesta del familiar no es una solicitud (necesita aprobación del estudiante).
- Una solicitud no es una reserva.
- Una propuesta de ajuste de la residencia no cambia condiciones hasta que el estudiante la acepta.
- Un pago a residencia no confirma una reserva dentro de EstuRed por sí solo.
- Una reserva no queda confirmada en EstuRed sin fee EstuRed pagado.
- Un comprobante no se emite sin reserva confirmada.

### 2.4. Mostrar advertencias antes de acciones críticas

Antes de acciones sensibles, la UI debe mostrar resumen y aceptación explícita.

Acciones críticas:

- crear propuesta de solicitud (familiar);
- aprobar propuesta de solicitud (estudiante);
- enviar solicitud;
- establecer contacto por parte de la residencia;
- enviar propuesta de ajuste de condiciones (residencia) — con advertencia de límite de 1 vez;
- responder a propuesta de ajuste (estudiante);
- marcar "Pago recibido";
- pagar fee EstuRed;
- confirmar renovación;
- emitir o reemitir comprobante;
- cancelar solicitud, reserva o renovación;
- pausar residencia;
- suspender usuario o residencia;
- abrir caso de soporte;
- cambiar visibilidad de comunidad;
- editar tarifas.

### 2.5. No exponer datos sensibles

Nunca se muestran públicamente: apellido completo, email, teléfono, fecha de nacimiento, universidad, documentos, datos de pago, documentos de identidad, comprobantes privados.

Usuarios invitados ven información limitada. Usuarios registrados pueden ver perfiles individuales y comunidad visible según permisos configurados por cada estudiante.

### 2.6. La disponibilidad debe comunicarse con precisión

Modo Perfil Verificado:

**"Disponibilidad informada por la residencia. Requiere confirmación al solicitar."**

Modo Gestión Operativa, con disponibilidad actualizada por plaza/cama:

**"Disponibilidad asegurada."**

Nunca usar lenguaje que prometa una reserva antes de que el proceso esté confirmado.

### 2.7. La UI debe guardar contexto

Cada pantalla vinculada a solicitudes, negociación, reservas, pagos y comprobantes debe mostrar el snapshot relevante: precio USD, precio ARS referencial, tipo de cambio, fecha/hora del snapshot, duración inicial, matrícula, depósito, política de ajustes, monto base del fee, fee EstuRed, condiciones aceptadas (originales o finales si hubo negociación).

### 2.8. Modal de tipo de cambio referencial — OBLIGATORIO

Siempre que se muestren precios en ARS convertidos desde USD, debe aparecer un aviso o modal con este texto exacto:

> "El valor en pesos es referencial, calculado en base al dólar blue (valor venta) del día de hoy. El valor final en pesos será determinado en el momento en que realices el pago directamente a la residencia, según la cotización vigente en ese momento."

Debe aparecer en: ficha de residencia, resumen de solicitud, pantalla de negociación, pantalla de fee, y cualquier otra pantalla con conversión USD → ARS.

### 2.8bis. Enlace de revocación en el footer — OBLIGATORIO

El footer de toda la plataforma debe incluir un enlace visible ("Botón de arrepentimiento") que lleve a `/students/revocation` (requiere login). Es un requisito legal de contratación a distancia, no un elemento opcional de diseño.

### 2.9. WhatsApp es un botón, no un chat integrado

El contacto entre residencia y estudiante/familiar se realiza mediante un botón que abre WhatsApp con un mensaje pre-formateado. EstuRed **no** aloja conversaciones ni tiene integración con la API de WhatsApp Business.

La UI debe dejar claro que la conversación ocurre fuera de la plataforma, y que solo la propuesta formal de ajuste enviada dentro de EstuRed tiene efecto sobre las condiciones de la solicitud.

---

## 3. Arquitectura de rutas

### 3.1. Rutas públicas

| Ruta | Pantalla | Acceso |
|---|---|---|
| `/` | Landing principal | Público |
| `/for-students` | Landing estudiantes/familias | Público |
| `/for-residences` | Landing residencias | Público |
| `/search` | Búsqueda pública | Público con datos limitados |
| `/r/[slug]` | Detalle público de residencia | Público/registrado con visibilidad diferenciada |
| `/verify/[verification_code]` | Verificación pública de comprobante | Público |
| `/login` | Login | Público |
| `/register` | Selector de rol | Público |
| `/register/student` | Registro estudiante | Público |
| `/register/family` | Registro familiar | Público |
| `/register/residence` | Registro residencia | Público |

### 3.2. Rutas estudiante/familiar

Ruta base: `/students`

| Ruta | Pantalla | Acceso |
|---|---|---|
| `/students/dashboard` | Inicio estudiante/familiar | Estudiante/Familiar |
| `/students/favorites` | Favoritos | Estudiante/Familiar |
| `/students/family-proposals` | Propuestas del familiar pendientes | Estudiante |
| `/students/applications` | Solicitudes | Estudiante/Familiar |
| `/students/applications/[id]` | Detalle de solicitud | Estudiante/Familiar |
| `/students/applications/[id]/negotiation` | Propuesta de ajuste recibida | Estudiante |
| `/students/applications/[id]/fee` | Pago fee EstuRed | Estudiante/Familiar pagador |
| `/students/revocation` | Ejercer derecho de revocación del fee (accesible desde el enlace del footer) | Estudiante/Familiar pagador |
| `/students/receipts/[id]` | Comprobante | Estudiante/Familiar autorizado |
| `/students/waitlist` | Lista de espera | Estudiante/Familiar |
| `/students/renewals` | Renovaciones | Estudiante/Familiar |
| `/students/renewals/[id]` | Detalle de renovación | Estudiante/Familiar |
| `/students/profile` | Perfil estudiante | Estudiante |
| `/students/documents` | Documentos | Estudiante/Familiar con permisos |
| `/students/family-link` | Familiar vinculado | Estudiante/Familiar |
| `/students/settings` | Configuración | Estudiante/Familiar |
| `/students/support` | Soporte / resolución de conflictos | Estudiante/Familiar |

### 3.3. Rutas residencia

Ruta base: `/residence`

| Ruta | Pantalla | Acceso |
|---|---|---|
| `/residence/dashboard` | Inicio multi-residencia (scroll vertical + filtro) | Owner/Staff |
| `/residence/[residence_id]/profile` | Perfil de residencia activa | Owner/Staff con permiso |
| `/residence/[residence_id]/profile/preview` | Vista previa pública | Owner/Staff |
| `/residence/[residence_id]/verification` | Verificación | Owner |
| `/residence/[residence_id]/rooms` | Habitaciones y plazas (Gestión Operativa) | Owner/Staff con permiso |
| `/residence/[residence_id]/availability` | Disponibilidad | Owner/Staff con permiso |
| `/residence/[residence_id]/applications` | Solicitudes | Owner/Staff con permiso |
| `/residence/[residence_id]/applications/[id]` | Detalle de solicitud | Owner/Staff con permiso |
| `/residence/[residence_id]/applications/[id]/negotiation` | Enviar propuesta de ajuste | Owner/Staff con permiso |
| `/residence/[residence_id]/reservations` | Reservas | Owner/Staff con permiso |
| `/residence/[residence_id]/waitlist` | Lista de espera | Owner/Staff con permiso |
| `/residence/[residence_id]/residents` | Residentes (Gestión Operativa) | Owner/Staff con permiso |
| `/residence/[residence_id]/renewals` | Renovaciones | Owner/Staff con permiso |
| `/residence/[residence_id]/renewals/[id]` | Detalle de renovación | Owner/Staff con permiso |
| `/residence/[residence_id]/receipts` | Comprobantes | Owner/Staff con permiso |
| `/residence/[residence_id]/faq` | FAQ asistida | Owner/Staff con permiso |
| `/residence/[residence_id]/metrics` | Métricas básicas | Owner |
| `/residence/[residence_id]/plan` | Plan freemium / Gestión Operativa | Owner |
| `/residence/settings` | Configuración global, staff y residencias | Owner |
| `/residence/settings/new` | Alta de nueva residencia (hasta 10) | Owner |

### 3.4. Rutas admin

Ruta base: `/admin`

| Ruta | Pantalla | Acceso |
|---|---|---|
| `/admin/dashboard` | Admin dashboard | Admin/Superadmin |
| `/admin/residences` | Residencias | Admin/Superadmin |
| `/admin/residences/[id]` | Detalle admin de residencia | Admin/Superadmin |
| `/admin/residences/[id]/plan` | Gestión de feature flags freemium | Admin/Superadmin |
| `/admin/verifications` | Verificaciones | Admin/Superadmin |
| `/admin/profile-edits` | Ediciones de perfil | Admin/Superadmin |
| `/admin/pricing` | Tarifas y alertas | Admin/Superadmin |
| `/admin/applications` | Solicitudes | Admin/Superadmin |
| `/admin/family-proposals` | Propuestas del familiar | Admin/Superadmin |
| `/admin/negotiations` | Negociaciones activas | Admin/Superadmin |
| `/admin/reservations` | Reservas | Admin/Superadmin |
| `/admin/payments` | Pagos fee EstuRed | Admin/Superadmin |
| `/admin/invoices` | Facturas emitidas (TusFacturas.app) | Admin/Superadmin |
| `/admin/receipts` | Comprobantes | Admin/Superadmin |
| `/admin/users` | Usuarios | Admin/Superadmin |
| `/admin/community` | Comunidad visible | Admin/Superadmin |
| `/admin/support-cases` | Soporte y resolución de conflictos | Admin/Superadmin |
| `/admin/visibility` | Penalizaciones y visibilidad | Admin/Superadmin |
| `/admin/audit-log` | Auditoría | Admin/Superadmin |
| `/admin/exchange-rate` | Tipo de cambio | Admin/Superadmin |
| `/admin/settings` | Configuración global | Superadmin |

---

## 4. Área pública

### 4.1. Landing principal

**Ruta:** `/`

**Objetivo:** Explicar EstuRed en menos de 30 segundos y llevar al usuario a buscar residencia o sumar una residencia.

**Contenido mínimo:**
- Hero con propuesta de valor.
- Buscador inicial.
- Explicación: residencias verificadas en CABA.
- Cómo funciona el proceso (incluye mención breve de que la residencia puede proponer ajustes antes de confirmar).
- Beneficios para estudiantes, familias y residencias.
- Explicación breve de "Residencia Verificada".
- CTA principal: **Buscar residencia en CABA**.
- CTA secundario: **Sumar mi residencia**.
- FAQ generales.

**Estados:** cargando residencias destacadas; sin residencias destacadas; error al cargar contenido dinámico.

**Regla:** la landing no debe prometer disponibilidad confirmada. Debe usar lenguaje de solicitud y confirmación.

---

### 4.2. Landing estudiantes/familias

**Ruta:** `/for-students`

**Contenido mínimo:** mudarse a CABA con más confianza; residencias verificadas; solicitudes registradas; posibilidad de que un familiar proponga y acompañe; Comprobante de Reserva Confirmada; comunidad visible; disponibilidad sujeta a confirmación; pasos del proceso; FAQ.

**CTA principal:** Buscar residencia en CABA. **CTA secundario:** Crear cuenta de estudiante.

---

### 4.3. Landing residencias

**Ruta:** `/for-residences`

**Contenido mínimo:** menos consultas repetidas; gestión de solicitudes; posibilidad de proponer ajustes de condiciones antes de confirmar; lista de espera; renovaciones; comunidad visible; Residencia Verificada; Modo Perfil Verificado (gratuito); Modo Gestión Operativa (plan pago, gratis por 1 año para residencias pioneras); reglas de calidad.

**CTA principal:** Quiero sumar mi residencia. **CTA secundario:** Ver cómo funciona para residencias.

**Copy recomendado:** "EstuRed no reemplaza tu operación. La ordena, la hace más clara y te ayuda a convertir mejores solicitudes."

---

### 4.4. Búsqueda pública

**Ruta:** `/search`

**Contenido:** lista de residencias, filtros, ordenamiento, cards, estado de disponibilidad, precio USD y ARS referencial, sello "Residencia Verificada", tags de tipo de habitación, acceso a lista de espera.

**Filtros MVP:** zona/barrio, tipo de habitación/plaza, precio, disponibilidad, modo de residencia, completa/con lista de espera, servicios básicos.

**Card de residencia:** foto principal, nombre, zona, precio desde en USD y ARS referencial (con nota "al dólar blue de hoy"), tipo de habitación disponible, estado de disponibilidad, sello de verificación, CTA "Ver residencia".

**Estados visuales:** cargando; sin resultados; error; residencia completa; sin disponibilidad actualizada; disponibilidad informada; disponibilidad asegurada.

---

### 4.5. Detalle público de residencia

**Ruta:** `/r/[slug]`

**Objetivo:** convertir interés en solicitud de reserva o lista de espera.

**Contenido mínimo:**
- Galería de fotos, nombre, zona.
- Sello "Residencia Verificada" y su alcance.
- Precio en USD y ARS referencial + **modal de tipo de cambio obligatorio** (ver 2.8).
- Política de ajustes, matrícula, depósito, condiciones de reserva.
- Servicios incluidos, áreas comunes, reglas principales.
- Composición estructural de habitaciones.
- Disponibilidad.
- Comunidad visible individual y agregada según permisos.
- **FAQ de la residencia** (preguntas predefinidas elegidas + respuestas + campo de pregunta libre).
- CTA "Enviar solicitud de reserva".
- CTA "Sumarme a lista de espera" si está completa o sin disponibilidad.
- CTA "Crear cuenta para ver más" para invitados.

**Bloque de FAQ:** el estudiante puede escribir una pregunta libre; el sistema responde solo con información cargada por la residencia (FAQ + archivos). Si no hay respuesta, se muestra: "No tenemos esa información todavía. Podés escribirle a la residencia una vez que envíes tu solicitud." La pregunta sin respuesta queda registrada para la residencia.

**Bloque de disponibilidad:**
- Perfil Verificado: "Disponibilidad informada por la residencia. Requiere confirmación al solicitar."
- Gestión Operativa: "Disponibilidad asegurada."
- Completa: "Residencia completa. Podés sumarte a la lista de espera."
- Sin actualización: "Sin disponibilidad actualizada. Podés consultar o sumarte a lista de espera si está habilitada."

**CTA principal:** Enviar solicitud de reserva. Debe exigir login y perfil mínimo.

---

### 4.6. Verificación pública de comprobante (nuevo)

**Ruta:** `/verify/[verification_code]`

**Objetivo:** permitir que cualquier persona (residencia, familia, terceros) verifique la autenticidad de un Comprobante de Reserva o Renovación Confirmada sin necesidad de login.

**Contenido:**
- Estado del comprobante: válido / anulado.
- Tipo: Comprobante de Reserva Confirmada / Comprobante de Renovación Confirmada.
- Residencia.
- Nombre del estudiante con inicial de apellido (ej. "Martina G.").
- Tipo de habitación/plaza.
- Fecha de ingreso y duración.
- Fecha de emisión.

**Nunca debe mostrar:** documentos, montos de pago, datos de contacto, apellido completo, email, teléfono.

**Estados:** código inválido o inexistente; comprobante anulado (mostrar aviso claro); comprobante válido.

---

## 5. Autenticación y onboarding

### 5.1. Login

**Ruta:** `/login`

**Opciones:** email/password, recuperar contraseña.

**Redirección:** estudiante/familiar → `/students/dashboard`; residencia → `/residence/dashboard`; admin → `/admin/dashboard`.

---

### 5.2. Selector de rol

**Ruta:** `/register`

**Opciones:** Soy estudiante / Soy padre, madre o familiar / Soy residencia.

**Regla:** el rol inicial determina el onboarding, pero no impide relaciones futuras autorizadas (ej. un estudiante luego puede vincular un familiar).

---

### 5.3. Registro estudiante

**Ruta:** `/register/student`

**Campos obligatorios:** nombre, apellido, nacionalidad, fecha de nacimiento, dónde va a estudiar, email, teléfono, contraseña, aceptación de términos, aceptación de privacidad, configuración inicial de visibilidad.

**Reglas:** apellido, fecha de nacimiento y universidad nunca son públicos. Si es menor, debe vincular familiar para finalizar registro.

---

### 5.4. Onboarding estudiante

**Ruta sugerida:** `/students/onboarding`

**Secciones:** datos básicos, objetivo académico declarado (obligatorio para comprobante), carrera, ciudad de origen, hábitos, intereses, foto/avatar, configuración de visibilidad, documentación opcional, preferencia de proveedor de pago para el fee (MercadoPago / PayU).

**Visibilidad:** definir qué se muestra a invitados, usuarios registrados, compañeros, residencias con solicitud/reserva, o a nadie.

---

### 5.5. Registro familiar

**Ruta:** `/register/family`

**Flujo:**
1. Familiar crea cuenta.
2. Busca o invita estudiante.
3. Solicita vinculación.
4. Estudiante aprueba.
5. Vínculo queda activo.

**Puede:** ver dashboard compartido, sugerir favoritos, cargar documentación, subir comprobantes, **crear propuestas de solicitud** (que el estudiante debe aprobar), pagar fee EstuRed (ARS o USD), ver comprobantes, recibir notificaciones.

**No puede:** decidir por el estudiante, enviar solicitudes directamente a la residencia, aceptar propuestas de ajuste en nombre del estudiante, vincularse sin aprobación.

---

### 5.6. Registro residencia

**Ruta:** `/register/residence`

**Campos:** nombre comercial, responsable, DNI responsable, coordinador (si existe), dirección, contacto, email owner, teléfono, modo elegido (Perfil Verificado o Gestión Operativa — sujeto a disponibilidad de plan), aceptación de términos, aceptación de responsabilidad, aceptación de reglas de EstuRed.

**Nota freemium:** si la residencia es pionera de beta, se le informa que tiene acceso gratuito a Gestión Operativa durante 1 año.

**Redirección:** después del registro, ir a `/residence/[residence_id]/profile` o `/residence/[residence_id]/verification`.

---

## 6. Dashboard estudiante/familiar

Ruta base: `/students`

---

### 6.1. Inicio estudiante/familiar

**Ruta:** `/students/dashboard`

**Cards principales:**
- Propuestas del familiar pendientes de aprobación (nuevo — solo visible para estudiante).
- Solicitudes activas.
- Solicitudes pausadas.
- Propuestas de ajuste pendientes de respuesta (nuevo).
- Reserva en proceso.
- Fee pendiente.
- Comprobante disponible.
- Favoritos.
- Lista de espera.
- Renovaciones.
- Documentación pendiente.
- Perfil incompleto.
- Familiar vinculado.

**Acciones rápidas:** buscar residencia, completar perfil, ver solicitudes, revisar propuesta de ajuste, pagar fee, ver comprobante, ver renovación, subir documento, abrir soporte.

**Estados:** sin solicitudes; propuesta del familiar esperando aprobación; solicitud avanzada con otra residencia; propuesta de ajuste recibida; fee pendiente; reserva confirmada; renovación pendiente; lista de espera con disponibilidad nueva.

---

### 6.2. Favoritos

**Ruta:** `/students/favorites`

**Contenido:** residencias favoritas, estado de disponibilidad, precio USD/ARS referencial, CTA "Ver residencia", CTA "Enviar solicitud", indicador de completa.

**Familiar vinculado:** puede sugerir favoritos. La UI diferencia entre favorito del estudiante y sugerido por familiar.

---

### 6.3. Propuestas del familiar (pantalla nueva)

**Ruta:** `/students/family-proposals`

**Objetivo:** que el estudiante revise, apruebe o rechace propuestas de solicitud creadas por su familiar vinculado.

**Contenido por propuesta:**
- Residencia sugerida (foto, nombre, zona).
- Tipo de habitación/plaza.
- Fecha de ingreso propuesta.
- Duración inicial propuesta.
- Precio USD/ARS referencial.
- Mensaje del familiar (si lo escribió).
- Tiempo restante para responder (48 horas).

**Acciones:**
- **Aprobar** — convierte la propuesta en solicitud real enviada a la residencia. El contacto de la residencia irá al familiar (no al estudiante), ya que la propuesta fue iniciada por él.
- **Rechazar** — cierra la propuesta y notifica al familiar. No permite editar los parámetros: si el estudiante quiere otra cosa, debe rechazar y pedirle al familiar una nueva propuesta, o iniciar una solicitud propia.

**Estados:** sin propuestas pendientes; propuesta por vencer (menos de 6 horas); propuesta vencida.

**Modal antes de aprobar:** debe mostrar claramente que, al aprobar, la residencia contactará al familiar (no al estudiante) y que se generará una solicitud real sujeta a las mismas reglas que cualquier otra (máx. 2 activas, snapshot congelado, etc.).

---

### 6.4. Solicitudes

**Ruta:** `/students/applications`

**Filtros:** activas; pausadas; en revisión; contacto habilitado; en negociación (nuevo); esperando pago a residencia; fee pendiente; confirmadas; rechazadas; vencidas; cerradas.

**Estados visibles para estudiante:**
- Solicitud enviada.
- En revisión.
- Contacto habilitado.
- **Propuesta de ajuste recibida — revisá los cambios** (nuevo).
- **Condiciones aceptadas** (nuevo).
- Esperando pago a residencia.
- Fee EstuRed pendiente.
- Reserva confirmada.
- Solicitud pausada.
- Solicitud rechazada.
- Solicitud vencida.
- Plaza tomada.
- En revisión por EstuRed.

**Regla:** mostrar claramente el máximo de 2 solicitudes activas (las propuestas del familiar pendientes de aprobación no cuentan).

---

### 6.5. Detalle de solicitud

**Ruta:** `/students/applications/[id]`

**Objetivo:** guiar paso a paso hasta reserva confirmada o cierre.

**Contenido:**
- Estado actual y timeline.
- Indicador de quién inició la solicitud (estudiante o familiar) y a quién contactará la residencia (si el estudiante es menor de edad, siempre al familiar vinculado).
- Residencia, tipo de habitación/plaza, fecha de ingreso, duración inicial.
- Precio USD/ARS referencial + tipo de cambio usado (con modal referencial).
- Matrícula, depósito, política de ajustes.
- Monto que debe pagarse a la residencia.
- Fee EstuRed estimado o final.
- Snapshot de condiciones **originales** y, si hubo negociación, **condiciones finales aceptadas**.
- Documentación compartida.
- Plazos (con cuenta regresiva de 48 horas cuando aplique).
- Acciones disponibles.

**Acciones:** cancelar solicitud; ver contacto habilitado; revisar propuesta de ajuste (si existe); subir comprobante de pago a residencia; pagar fee EstuRed; ver comprobante; abrir soporte; solicitar "Actualizar con mismos parámetros" si venció.

**Nota:** la pantalla de pago a residencia vive dentro de esta pantalla, no es un checkout separado porque ese pago ocurre fuera de EstuRed.

---

### 6.6. Propuesta de ajuste recibida (pantalla nueva)

**Ruta:** `/students/applications/[id]/negotiation`

**Objetivo:** que el estudiante revise con claridad los cambios propuestos por la residencia y decida.

**Contenido — vista comparativa lado a lado:**

| Condición | Original | Propuesta de la residencia |
|---|---|---|
| Tarifa mensual | $XXX USD | $XXX USD (si cambia) |
| Matrícula | $XXX USD | $XXX USD (si cambia) |
| Depósito | $XXX USD | $XXX USD (si cambia) |
| Tipo de habitación | Individual | Doble (si cambia) |
| Fecha de ingreso | DD/MM | DD/MM (si cambia) |
| Duración | 6 meses | 6 meses (si cambia) |
| Monto a pagar para reservar | $XXX | $XXX (si cambia) |
| Fee EstuRed estimado | $XXX ARS | $XXX ARS (recalculado) |

- Condiciones especiales o descuento explicado por la residencia (texto libre).
- Aclaración: "Esta es la única propuesta de ajuste que la residencia puede enviarte para esta solicitud."
- Tiempo restante para responder (48 horas desde el envío de la propuesta).

**Acciones:**
- **Aceptar propuesta** — actualiza las condiciones finales de la solicitud y recalcula el fee sobre los nuevos valores.
- **Rechazar y continuar con condiciones originales** — la solicitud sigue con los valores originales.
- **Rechazar y cerrar solicitud** — cancela la solicitud.

**Regla:** el estudiante solo puede aceptar o rechazar. No puede editar la propuesta.

---

### 6.7. Pago a residencia dentro del detalle de solicitud

**Objetivo:** explicar que el estudiante debe pagar directamente a la residencia para avanzar.

**Contenido:** monto a pagar (según condiciones finales), concepto, plazo de 48 horas, aviso de que la residencia debe marcar "Pago recibido", subida opcional de comprobante para referencia.

**Regla:** el comprobante subido por el estudiante no confirma la reserva. Solo sirve como evidencia.

---

### 6.8. Pago fee EstuRed (actualizado)

**Ruta:** `/students/applications/[id]/fee`

**Contenido:**
- Base de cálculo (sobre condiciones finales, aclarando si hubo ajuste).
- Tarifa actual, duración inicial, matrícula incluida, depósito excluido.
- Fee 5%.
- **Selector de moneda y proveedor:** pagar en ARS (MercadoPago) o pagar en USD (PayU Argentina).
- Monto final en la moneda elegida.
- Si es USD: aclaración "El monto en USD se calculó usando la cotización del dólar blue al momento de crear la solicitud."
- Datos de facturación (nombre, CUIT/CUIL opcional, condición IVA) para la Factura C.
- Estado del pago.
- Política de no reembolso.
- Checkbox de aceptación.

**Estados:** medio de pago pendiente; pago manual pendiente; cobro automático pendiente; procesando; pagado; fallido; vencido; reembolsado.

**Regla:** si falla el cobro, hasta 3 intentos dentro de 48 horas. Al pagar, se emite automáticamente la Factura C, que se envía por email al pagador y puede descargarse desde la pantalla del comprobante (`/students/receipts/[id]`). **No existe una pantalla separada "Mis facturas" en el MVP.**

---

### 6.9. Comprobante (actualizado)

**Ruta:** `/students/receipts/[id]`

**Nombre:** Comprobante de Reserva Confirmada

**Contenido:** ID de reserva, QR/código verificable (enlaza a `/verify/[codigo]`), fecha de emisión, datos del estudiante, familiar pagador si aplica, datos de residencia, tipo de habitación/plaza, fecha estimada de ingreso, duración inicial, objetivo académico declarado, **condiciones finales aceptadas** (originales o ajustadas), monto abonado a residencia informado por residencia, fee EstuRed y moneda usada, política de ajustes futuros, disclaimer, estado del comprobante.

**Acciones:** descargar PDF, compartir enlace de verificación, descargar Factura C, abrir soporte, ver reserva.

---

### 6.9bis. Revocación del fee (pantalla nueva)

**Ruta:** `/students/revocation` — accesible desde el enlace "Botón de arrepentimiento" del footer.

**Objetivo:** permitir que el estudiante o familiar pagador ejerza el derecho de revocación del fee dentro de los 10 días corridos desde el pago.

**Contenido:**
- Reserva asociada (residencia, fecha de ingreso, fee pagado, fecha de pago).
- Días restantes del plazo de 10 días corridos.
- Consecuencias, explicadas antes de confirmar: la reserva se cancela; el comprobante se anula; **el fee no se reembolsa automáticamente** — EstuRed revisa el caso individualmente (pudiendo cotejar con la residencia) antes de resolver sobre el reembolso.
- Aclaración de que la revocación no alcanza a los montos pagados directamente a la residencia.
- Campo opcional de motivo.
- Checkbox de aceptación de las consecuencias.

**CTA:** "Ejercer revocación" — con confirmación explícita.

**Estados:** sin reservas revocables; dentro de plazo; fuera de plazo (mensaje claro, sin botón); revocación registrada — en revisión por EstuRed.

### 6.10. Lista de espera

**Ruta:** `/students/waitlist`

Sin cambios de fondo respecto al original. Contenido: residencia, tipo de habitación/plaza, fecha deseada, duración deseada, fecha de inscripción, estado, notificación de disponibilidad.

**Reglas:** no cuenta como solicitud activa; no vence automáticamente; a los 90 días se notifica; sale automáticamente si confirma reserva en otra residencia.

**Acciones:** salir de lista, quedarme en lista, activar solicitud, ver residencia.

---

### 6.11. Renovaciones

**Ruta:** `/students/renewals`

**Contenido:** solicitudes de renovación, ofertas recibidas, estado, fecha límite, período renovado, precio, política de ajustes, monto a residencia, fee EstuRed (misma lógica que reserva inicial), Comprobante de Renovación Confirmada.

**Acciones:** solicitar renovación, ver oferta, aceptar, rechazar, subir comprobante de pago a residencia, pagar fee EstuRed, ver comprobante.

---

### 6.12. Detalle de renovación

**Ruta:** `/students/renewals/[id]`

Contenido: oferta de residencia, período, tarifa actual, política de ajustes, monto a pagar a residencia, fee de renovación, plazos, estado, comprobante.

**Regla:** el comprobante se llama "Comprobante de Renovación Confirmada".

---

### 6.13. Perfil estudiante

**Ruta:** `/students/profile`

**Secciones:** datos personales, datos académicos, objetivo académico, carrera, ciudad de origen, hábitos, intereses, foto/avatar, visibilidad, proveedor de pago preferido, familiar vinculado.

**Datos nunca visibles:** apellido completo, email, teléfono, fecha de nacimiento, universidad, documentos.

---

### 6.14. Documentos

**Ruta:** `/students/documents`

Contenido: documentos cargados, estado, tipo, solicitudes donde fue compartido, visibilidad/autorización.

**Regla:** la residencia solo accede a documentos autorizados dentro del contexto de solicitud, reserva, residente o renovación.

---

### 6.15. Familiar vinculado

**Ruta:** `/students/family-link`

**Para estudiante:** aprobar vínculo, rechazar vínculo, revocar vínculo, ver permisos (incluyendo si puede crear propuestas), ver actividad del familiar.

**Para familiar:** ver estudiante vinculado, crear propuestas de solicitud, pagar fee, cargar documentos, subir comprobantes, sugerir favoritos, ver comprobantes.

**Reglas:** un estudiante puede tener solo un familiar vinculado; un familiar puede vincular varios estudiantes; menores requieren familiar vinculado.

---

## 7. Dashboard residencia (multi-residencia)

Ruta base: `/residence`

---

### 7.1. Inicio multi-residencia (rediseñado)

**Ruta:** `/residence/dashboard`

**Objetivo:** ser el cockpit operativo del owner, mostrando todas sus residencias (hasta 10) sin un dashboard agregado.

**Comportamiento:**
- Los dashboards individuales de cada residencia se muestran en **scroll vertical simultáneo**, uno debajo del otro.
- En la parte superior hay un **filtro/selector** para elegir qué residencias mostrar (todas, o un subconjunto).
- **No existe una vista agregada con métricas consolidadas.** Cada bloque de residencia es independiente y completo.
- Cada bloque de residencia muestra su nombre de forma prominente para evitar confusión.
- Al hacer clic en cualquier acción dentro del bloque de una residencia, el sistema entra al contexto de esa residencia específica (rutas `/residence/[residence_id]/...`).

**Cada bloque individual de residencia contiene (igual que el dashboard de una sola residencia):**
- Solicitudes nuevas, solicitudes por vencer, negociaciones pendientes de respuesta.
- Contactos establecidos.
- Pagos a residencia pendientes.
- Pagos recibidos pendientes de fee.
- Reservas confirmadas.
- Lista de espera.
- Renovaciones pendientes.
- Disponibilidad.
- Habitaciones/plazas (si tiene Gestión Operativa).
- Residentes (si tiene Gestión Operativa).
- Alertas de tarifas.
- Indicador de plan (Perfil Verificado / Gestión Operativa / acceso gratuito hasta fecha X).

**Si el owner tiene una sola residencia:** el filtro no se muestra, y el comportamiento es igual a un dashboard simple.

**Acción para agregar residencia:** botón visible "Agregar otra residencia" (hasta el límite de 10), que lleva a `/residence/settings/new`.

---

### 7.2. Perfil de residencia

**Ruta:** `/residence/[residence_id]/profile`

**Secciones:** fotos, descripción, servicios, áreas comunes, reglas, condiciones de reserva, política de ajustes, precios (recomendado en USD), matrícula, depósito, **medios de pago aceptados para pagos a la residencia**, tipos de habitación, capacidad, FAQ, comunidad visible.

**Reglas:** tarifas, matrícula y depósito editables sin aprobación previa, auditadas, generan alerta si varían más de 15%. Campos críticos (fotos, dirección, reglas, servicios, condiciones de reserva, capacidad) requieren revisión admin.

**Nota de recomendación de moneda:** al configurar precios, mostrar sugerencia: "Recomendamos configurar tus tarifas en dólares. El sistema las convierte automáticamente a pesos al dólar blue del día, redondeadas para mayor comodidad."

---

### 7.3. Vista previa pública

**Ruta:** `/residence/[residence_id]/profile/preview`

Sin cambios de fondo. Acciones: volver a editar, solicitar publicación, revisar visibilidad, ver versión invitado y versión registrado.

---

### 7.4. Verificación

**Ruta:** `/residence/[residence_id]/verification`

Sin cambios de fondo. Contenido: estado de residencia, DNI responsable/coordinador, dirección, checklist, fecha de visita, vigencia anual, observaciones admin.

Estados: borrador; pendiente de verificación; visita programada; verificada activa; necesita cambios; verificación vencida.

---

### 7.5. Habitaciones y plazas

**Ruta:** `/residence/[residence_id]/rooms`

Solo visible si la residencia tiene `has_operational_management_access = true`.

Si no tiene acceso: mostrar pantalla de upsell explicando Gestión Operativa y botón "Solicitar acceso" (dirige a admin o a `/residence/[residence_id]/plan`).

Contenido y acciones sin cambios de fondo respecto al original.

---

### 7.6. Disponibilidad

**Ruta:** `/residence/[residence_id]/availability`

Sin cambios de fondo. Modo Perfil Verificado: disponibilidad por tipo, estado Completa, actualización cada 30 días. Modo Gestión Operativa: disponibilidad por plaza/cama.

**Regla nueva:** si la disponibilidad no se actualiza por más de 15 días consecutivos en estado `not_updated`, mostrar advertencia prominente: "Tu residencia dejó de aparecer en las búsquedas activas por falta de actualización."

---

### 7.7. Solicitudes

**Ruta:** `/residence/[residence_id]/applications`

**Filtros:** nuevas; en revisión; contacto establecido; **en negociación (propuesta enviada, esperando respuesta)** (nuevo); esperando pago; pago recibido; fee pendiente; confirmadas; rechazadas; vencidas; en cola.

**Acciones:** abrir solicitud, establecer contacto, **enviar propuesta de ajuste**, rechazar con motivo, marcar pago recibido, pedir información adicional, ver documentos autorizados.

---

### 7.8. Detalle de solicitud residencia

**Ruta:** `/residence/[residence_id]/applications/[id]`

**Contenido:**
- Perfil estudiante y datos visibles.
- **Indicador de quién inició la solicitud** (estudiante o familiar) y a quién dirigirse en el contacto.
- Documentos autorizados.
- Resumen de solicitud y snapshot de condiciones.
- Monto de reserva requerido.
- Plazos (con cuenta regresiva).
- Historial de la solicitud (incluyendo negociación si existió).
- Cola asociada a la plaza.

**Acciones críticas:**
- **Contactar para avanzar** — genera el botón de WhatsApp pre-formateado con el número correcto (estudiante o familiar según quién inició la solicitud).
- **Enviar propuesta de ajuste** — ver 7.9.
- Marcar pago recibido.
- Rechazar (con motivo enum).
- Pedir información.
- Abrir soporte.
- Ver auditoría resumida.

**Modal obligatorio antes de "Pago recibido":** debe mostrar responsabilidades y aceptación específica de la residencia.

---

### 7.9. Enviar propuesta de ajuste (pantalla nueva)

**Ruta:** `/residence/[residence_id]/applications/[id]/negotiation`

**Objetivo:** permitir que la residencia formalice cambios acordados por WhatsApp dentro de la plataforma.

**Advertencia obligatoria al ingresar (bloqueante, requiere click en "Entiendo"):**

> "Solo podés enviar una propuesta de ajuste por solicitud. Una vez enviada, no podés modificarla. Asegurate de haber acordado todos los detalles con el estudiante antes de continuar."

**Formulario editable (todo modificable excepto datos del estudiante):**
- Tarifa mensual (USD/ARS).
- Matrícula.
- Depósito.
- Tipo de habitación / plaza.
- Fecha de ingreso.
- Duración inicial.
- Política de ajustes.
- Monto requerido para reservar.
- Condiciones especiales / descuento (texto libre).
- Notas internas (no visibles para el estudiante).

**Vista previa antes de enviar:** comparación lado a lado condiciones originales vs. nueva propuesta, igual que la pantalla 6.6 del estudiante, para que la residencia vea exactamente lo que verá el estudiante.

**CTA final:** "Enviar propuesta definitiva" — con segunda confirmación ("¿Confirmás que esta es tu única propuesta de ajuste para esta solicitud?").

**Tras el envío:** la pantalla pasa a modo solo lectura, mostrando "Propuesta enviada — esperando respuesta del estudiante" con cuenta regresiva de 48 horas.

---

### 7.10. Reservas

**Ruta:** `/residence/[residence_id]/reservations`

Sin cambios de fondo. Contenido: estudiante, plaza, fecha de ingreso, duración inicial, estado, fee EstuRed, comprobante, no-show, cancelación, renovación.

---

### 7.11. Lista de espera

**Ruta:** `/residence/[residence_id]/waitlist`

Sin cambios de fondo.

---

### 7.12. Residentes

**Ruta:** `/residence/[residence_id]/residents`

Solo visible con Gestión Operativa. Sin cambios de fondo respecto al original.

---

### 7.13. Renovaciones

**Ruta:** `/residence/[residence_id]/renewals`

Sin cambios de fondo, salvo aclaración de que el fee de renovación usa exactamente la misma lógica que la reserva inicial (5% simple, sin variantes).

---

### 7.14. Detalle de renovación

**Ruta:** `/residence/[residence_id]/renewals/[id]`

Sin cambios de fondo.

---

### 7.15. Comprobantes

**Ruta:** `/residence/[residence_id]/receipts`

Sin cambios de fondo. Incluye Factura C asociada visible/descargable si es relevante para la residencia (referencia, no el documento fiscal del pagador).

---

### 7.16. FAQ asistida (actualizado — pasa a Must Have)

**Ruta:** `/residence/[residence_id]/faq`

**Objetivo:** reducir consultas repetidas con respuestas configuradas por la residencia.

**Contenido:**
- **Listado de preguntas predefinidas por EstuRed** organizadas por categoría (precios, reglas, disponibilidad, convivencia, servicios, documentación, otros), con checkbox para elegir cuáles usar.
- Editor de respuesta para cada pregunta elegida.
- Posibilidad de agregar preguntas personalizadas no incluidas en el listado.
- Carga de archivos (reglamento interno, normas de convivencia, información de servicios) que también alimentan las respuestas.
- Listado de preguntas hechas por estudiantes que **no** obtuvieron respuesta, para que la residencia las revise y agregue.

**Restricciones (mostradas como nota fija en la pantalla):** el sistema no inventa respuestas, no confirma disponibilidad ni precios que no estén cargados explícitamente, y no reemplaza la comunicación directa por WhatsApp.

---

### 7.17. Métricas básicas

**Ruta:** `/residence/[residence_id]/metrics`

**Métricas:** tasa de respuesta, velocidad de respuesta, solicitudes vencidas, contactos establecidos, reservas confirmadas, rechazos por falta de disponibilidad, actualización de disponibilidad, reclamos validados, **propuestas de ajuste enviadas / aceptadas** (nuevo).

**Regla:** no mostrar ranking público en MVP.

---

### 7.18. Plan freemium / Gestión Operativa (pantalla nueva)

**Ruta:** `/residence/[residence_id]/plan`

**Objetivo:** que la residencia entienda y gestione su acceso a Gestión Operativa.

**Contenido:**
- Plan actual: Perfil Verificado (gratuito) o Gestión Operativa (pago).
- Si es residencia pionera: "Acceso gratuito a Gestión Operativa hasta [fecha]."
- Comparación de funcionalidades entre ambos planes.
- Si no tiene acceso: CTA "Solicitar acceso a Gestión Operativa" (genera solicitud a admin).
- Si tiene acceso pago próximo a vencer (residencias pioneras): aviso con anticipación.

**Nota:** el precio del plan pago se define antes del lanzamiento público; en el MVP, este flujo puede mostrar "Contactanos para más información" en vez de un checkout de suscripción.

---

### 7.19. Configuración global, staff y residencias (rediseñado)

**Ruta:** `/residence/settings`

**Objetivo:** gestionar todas las residencias del owner, usuarios internos y preferencias generales.

**Secciones:**
- **Mis residencias:** listado de hasta 10 residencias con estado de cada una. Botón "Agregar residencia" si no llegó al límite.
- **Staff:** invitar staff, asignar permisos **por residencia específica o por múltiples residencias** (selector múltiple de residencias al invitar).
- Editar datos de contacto del owner.
- Configurar notificaciones.
- Configurar medios de contacto.

**Alta de nueva residencia:** `/residence/settings/new` — mismo formulario que `/register/residence`, pero accedido desde una cuenta owner ya existente.

---

## 8. Admin EstuRed

Ruta base: `/admin`

---

### 8.1. Admin dashboard

**Ruta:** `/admin/dashboard`

**Cards:** residencias pendientes, solicitudes activas, **propuestas del familiar pendientes** (nuevo), **negociaciones activas/vencidas** (nuevo), reservas en proceso, fees pendientes, comprobantes fallidos, **facturas fiscales fallidas** (nuevo), casos de soporte abiertos, alertas de tarifas, disponibilidad vencida, residencias con baja respuesta, lista de espera activa, renovaciones pendientes.

---

### 8.2. Residencias

**Ruta:** `/admin/residences`

Sin cambios de fondo. Filtros: borrador, pendiente verificación, verificada, pausada, suspendida, verificación vencida.

Acciones: ver detalle, pausar, suspender, editar, ver auditoría, ver métricas, **gestionar plan freemium** (nuevo, enlaza a 8.2bis).

---

### 8.2bis. Gestión de plan freemium por residencia (pantalla nueva)

**Ruta:** `/admin/residences/[id]/plan`

**Contenido:**
- Estado actual del feature flag `has_operational_management_access`.
- Si es pionera: fecha de fin de acceso gratuito.
- Historial de cambios (otorgado por quién, cuándo, motivo).

**Acciones:**
- Otorgar acceso (con motivo: pionera_beta / compra / extensión / cortesía, y fecha límite opcional).
- Revocar acceso (con motivo obligatorio).

Toda acción queda auditada.

---

### 8.3. Verificaciones

**Ruta:** `/admin/verifications`

Sin cambios de fondo.

---

### 8.4. Ediciones de perfil

**Ruta:** `/admin/profile-edits`

Sin cambios de fondo.

---

### 8.5. Tarifas y alertas

**Ruta:** `/admin/pricing`

Sin cambios de fondo.

---

### 8.6. Solicitudes

**Ruta:** `/admin/applications`

Sin cambios de fondo, salvo agregar filtro por `initiated_by` (estudiante / familiar) y estado de negociación.

---

### 8.7. Propuestas del familiar (pantalla nueva)

**Ruta:** `/admin/family-proposals`

**Objetivo:** monitorear el uso del flujo de propuestas del familiar y detectar problemas (ej. familiares que crean muchas propuestas rechazadas).

**Contenido:** listado con estado, familiar, estudiante, residencia, fecha, tiempo de respuesta del estudiante.

**Acciones:** ver detalle, intervenir en caso de disputa entre familiar y estudiante (derivar a soporte).

---

### 8.8. Negociaciones activas (pantalla nueva)

**Ruta:** `/admin/negotiations`

**Objetivo:** detectar negociaciones trabadas o vencidas sin respuesta, y monitorear el uso general del flujo.

**Contenido:** listado con estado, residencia, solicitud, campos modificados, fecha de envío, fecha de expiración, respuesta del estudiante si existe.

**Acciones:** ver detalle completo, intervenir en solicitud asociada.

---

### 8.9. Reservas

**Ruta:** `/admin/reservations`

Sin cambios de fondo.

---

### 8.10. Pagos fee EstuRed

**Ruta:** `/admin/payments`

**Contenido:** pendientes, procesando, fallidos, vencidos, pagados, reembolsados, chargebacks. Agregar columna de **proveedor** (MercadoPago / PayU / manual) y **moneda** (ARS / USD).

**Acciones:** validar pago manual, reintentar, reembolsar, marcar chargeback, ver evidencia.

---

### 8.11. Facturas fiscales (pantalla nueva)

**Ruta:** `/admin/invoices`

**Objetivo:** monitorear la emisión automática de Facturas C vía TusFacturas.app.

**Contenido:** listado de facturas emitidas, pendientes y fallidas, vinculadas al pago del fee correspondiente.

**Acciones:** reintentar emisión fallida, reemitir con motivo, descargar PDF, ver detalle del pago asociado.

---

### 8.12. Comprobantes

**Ruta:** `/admin/receipts`

Sin cambios de fondo. Acciones: generar, reemitir, anular, descargar, ver QR/código de verificación.

---

### 8.13. Usuarios

**Ruta:** `/admin/users`

Sin cambios de fondo respecto al original.

---

### 8.14. Comunidad visible

**Ruta:** `/admin/community`

Sin cambios de fondo.

---

### 8.15. Soporte y resolución de conflictos (renombrado)

**Ruta:** `/admin/support-cases`

*(Antes "Mediaciones". Renombrado para evitar implicancias legales del término "mediación" en Argentina.)*

Sin cambios de fondo en el contenido y acciones (emitir advertencia, reducir visibilidad, pausar, suspender, restaurar).

---

### 8.16. Auditoría

**Ruta:** `/admin/audit-log`

Sin cambios de fondo. Debe auditar además: propuestas del familiar, propuestas de ajuste de negociación, cambios de feature flag freemium, override de tipo de cambio.

---

### 8.17. Tipo de cambio

**Ruta:** `/admin/exchange-rate`

**Contenido:** tipo de cambio diario, **fuente: monedapi.ar (dólar blue, valor venta)**, última actualización, fallos, override manual (con motivo obligatorio), historial.

**Reglas:** actualización diaria automática; snapshot por solicitud; admin puede corregir si falla la fuente; no se recalculan solicitudes ya enviadas.

---

## 9. Pantallas transversales y modales críticos

### 9.1. Modal antes de enviar solicitud

Debe mostrar: residencia, tipo de habitación/plaza, fecha de ingreso, duración inicial, precio USD/ARS con modal de tipo de cambio referencial, matrícula, depósito, política de ajustes, fee estimado, pasos siguientes, aceptación de condiciones.

**CTA:** Enviar solicitud de reserva.

---

### 9.2. Modal antes de crear propuesta de solicitud (familiar) (nuevo)

Debe mostrar: residencia elegida, condiciones básicas, mensaje opcional para el estudiante, aclaración de que el estudiante debe aprobar antes de que la solicitud se active, y que si el familiar la inició, el contacto de la residencia será con él (no con el estudiante).

**CTA:** Enviar propuesta al estudiante.

---

### 9.3. Modal de contacto establecido para residencia

Debe mostrar: responsabilidad de la residencia, datos de solicitud, condiciones congeladas, plazo de 48 horas, aviso de que solo puede avanzar una solicitud por plaza, y a quién se dirigirá el botón de WhatsApp (estudiante o familiar).

**CTA:** Contactar para avanzar.

---

### 9.4. Modal de advertencia antes de propuesta de ajuste (nuevo)

Ver sección 7.9. Bloqueante, requiere confirmación explícita antes de habilitar el formulario.

---

### 9.5. Modal "Pago recibido"

Debe mostrar: estudiante, plaza, monto informado recibido, confirmación de que la plaza queda retenida, aviso de que falta fee EstuRed para comprobante, aceptación de responsabilidad.

**CTA:** Confirmar pago recibido.

---

### 9.6. Modal antes de pagar fee

Debe mostrar: base de cálculo (sobre condiciones finales), fee 5%, depósito excluido, matrícula incluida, selector de moneda/proveedor, monto final, no reembolso salvo excepciones, alcance de EstuRed.

**CTA:** Pagar fee y confirmar reserva.

---

### 9.7. Modal de cancelación

Debe mostrar consecuencias según estado: cancelar antes de contacto; con contacto establecido; con negociación pendiente; después de pagar a residencia; después de fee; cancelar renovación.

---

### 9.8. Modal de soporte / resolución de conflictos (renombrado)

Debe mostrar: recordatorio de términos, alcance de la intervención de EstuRed, deslinde de responsabilidad, pedido de evidencia, aviso de que EstuRed puede no intervenir si no corresponde.

---

### 9.9. Modal de tipo de cambio referencial (nuevo — reutilizable)

Aparece como tooltip o modal breve en cualquier punto donde se muestre una conversión USD → ARS.

Texto exacto (ver sección 2.8).

---

### 9.10. Modal de revocación del fee (nuevo)

Ver sección 6.9bis. Debe mostrar: consecuencias (cancelación de reserva, anulación de comprobante, sin reembolso automático — revisión admin), plazo restante, alcance limitado al fee EstuRed, checkbox de aceptación y confirmación explícita final.

---

## 10. Flujos principales

### Flujo A — Búsqueda y solicitud directa (estudiante)

1. Invitado entra a landing.
2. Busca residencia.
3. Abre detalle, ve información limitada, consulta FAQ.
4. Se registra para solicitar.
5. Completa perfil mínimo.
6. Revisa snapshot con modal de tipo de cambio.
7. Acepta condiciones.
8. Envía solicitud.
9. Solicitud entra en dashboard de la residencia correspondiente.

### Flujo A2 — Propuesta del familiar (nuevo)

1. Familiar vinculado explora residencias.
2. Encuentra una que le interesa para el estudiante.
3. Crea propuesta de solicitud con parámetros básicos.
4. Estudiante recibe notificación.
5. Estudiante revisa en `/students/family-proposals`.
6. Estudiante aprueba → se crea la solicitud real, con contacto dirigido al familiar.
   - O estudiante rechaza → familiar notificado, sin solicitud creada.
7. Si no responde en 48 horas → propuesta expira, familiar notificado.

### Flujo B — Solicitud a reserva confirmada (sin negociación)

1. Residencia recibe solicitud.
2. Revisa perfil/documentos autorizados.
3. Decide avanzar → "Contactar para avanzar".
4. Se genera botón de WhatsApp (al estudiante o familiar según quién inició).
5. Estado: contacto establecido, timer de 48 horas.
6. Estudiante paga a la residencia.
7. Residencia marca "Pago recibido".
8. EstuRed cobra fee (ARS o USD).
9. Se emite Factura C automáticamente.
10. Reserva confirmada, comprobante generado con QR.
11. Otras solicitudes del estudiante se cierran.

### Flujo B2 — Solicitud a reserva confirmada (con negociación) (nuevo)

1-5. Igual que Flujo B hasta "contacto establecido".
6. Residencia y estudiante/familiar conversan por WhatsApp (fuera de la plataforma) y acuerdan cambios.
7. Residencia entra a "Enviar propuesta de ajuste", ve advertencia de 1 sola vez, completa formulario, confirma.
8. Timer se reinicia a 48 horas.
9. Estudiante recibe notificación, revisa comparación en `/students/applications/[id]/negotiation`.
10. Estudiante acepta → condiciones finales actualizadas, fee recalculado sobre nuevos valores.
    - O estudiante rechaza y elige condiciones originales → continúa con snapshot original.
    - O estudiante rechaza y cierra → solicitud cancelada.
11. Si aceptó o eligió continuar: estudiante paga a la residencia según condiciones finales.
12. Continúa igual que Flujo B desde el paso 7.

### Flujo C — Segunda solicitud pausada

Sin cambios de fondo respecto al original.

### Flujo D — Plaza con múltiples interesados

Sin cambios de fondo.

### Flujo E — Lista de espera

Sin cambios de fondo.

### Flujo F — Renovación

1. Estudiante solicita renovación o residencia crea oferta directamente.
2. Residencia emite oferta formal (misma lógica de fee que reserva inicial).
3. Estudiante acepta.
4. Paga a residencia si corresponde.
5. Residencia marca "Pago recibido".
6. EstuRed cobra fee de renovación, factura emitida automáticamente.
7. Se confirma renovación.
8. Se emite Comprobante de Renovación Confirmada.

### Flujo G — Onboarding residencia

1. Residencia se registra.
2. Elige modo inicial: Perfil Verificado (o solicita Gestión Operativa, sujeto a aprobación/plan).
3. Carga perfil completo (recomendación de tarifas en USD).
4. Acepta términos.
5. Carga DNI responsable/coordinador.
6. EstuRed programa visita.
7. Se completa checklist firmado.
8. Admin aprueba.
9. Residencia queda verificada y publicada.

### Flujo H — Gestión Operativa

Sin cambios de fondo, salvo que requiere `has_operational_management_access = true`.

### Flujo I — Comunidad visible

Sin cambios de fondo.

### Flujo J — Soporte / resolución de conflictos (renombrado)

1. Usuario abre caso desde soporte.
2. Se muestra reminder de términos y alcance.
3. Usuario confirma que quiere proceder.
4. Sube evidencia.
5. Admin revisa, puede pedir más información o contactar a la otra parte.
6. Admin cierra sin acción, aplica penalización, suspende o reembolsa fee si corresponde.

### Flujo K — Multi-residencia (nuevo)

1. Owner con varias residencias entra a `/residence/dashboard`.
2. Ve todas sus residencias en scroll vertical.
3. Usa el filtro para enfocarse en una o varias.
4. Hace clic en una acción de una residencia específica → entra al contexto de esa residencia.
5. Vuelve al dashboard general con el botón de navegación.
6. Puede agregar una nueva residencia (hasta 10) desde `/residence/settings/new`.

### Flujo L — Solicitud vencida y actualización de parámetros (nuevo)

1. Solicitud no avanzó dentro de las 48 horas y vence.
2. Estudiante ve el detalle completo de la solicitud vencida.
3. Sistema muestra botón "Actualizar con mismos parámetros".
4. Al presionar, el sistema verifica disponibilidad actual y tarifa/tipo de cambio actualizados.
5. Se muestra al estudiante la comparación (tarifa anterior vs. actual) con el modal de tipo de cambio.
6. Si hay disponibilidad y el estudiante confirma: se crea una nueva solicitud con parámetros actualizados.
7. Si no hay disponibilidad: se ofrece la opción de entrar en lista de espera.

---

## 11. Estados vacíos obligatorios

### Estudiante/familiar

- Sin solicitudes.
- **Sin propuestas del familiar pendientes** (nuevo).
- Sin favoritos.
- Sin documentos.
- Sin comprobantes.
- Sin lista de espera.
- Sin renovaciones.
- Sin familiar vinculado.
- Perfil incompleto.

### Residencia

- Sin solicitudes.
- **Sin negociaciones activas** (nuevo).
- Sin habitaciones.
- Sin plazas.
- Sin residentes.
- Sin disponibilidad.
- Residencia completa.
- Sin lista de espera.
- Sin renovaciones.
- Sin comprobantes.
- Sin métricas suficientes.
- Verificación pendiente.
- **Sin FAQ configuradas** (nuevo).
- **Solo una residencia (sin mostrar filtro multi-residencia)** (nuevo).

### Admin

- Sin casos de soporte.
- Sin alertas.
- Sin verificaciones pendientes.
- Sin pagos pendientes.
- Sin comprobantes fallidos.
- **Sin propuestas del familiar** (nuevo).
- **Sin negociaciones activas** (nuevo).
- **Sin facturas fallidas** (nuevo).

---

## 12. Estados de error obligatorios

- Error al cargar residencia.
- Error al enviar solicitud.
- Error al crear propuesta del familiar (nuevo).
- Propuesta del familiar vencida (nuevo).
- Solicitud vencida.
- Solicitud pausada por otra solicitud.
- Error al enviar propuesta de ajuste — ya existe una propuesta (nuevo).
- Propuesta de ajuste vencida (nuevo).
- Plaza tomada.
- Error al cargar comprobante.
- Error al pagar fee.
- Pago rechazado.
- Fee vencido.
- Comprobante no generado.
- QR no disponible.
- **Error al emitir factura fiscal** (nuevo).
- **Revocación fuera de plazo** (nuevo).
- **Teléfono de contacto faltante al enviar solicitud** (nuevo).
- Permiso denegado.
- Documento no accesible.
- Residencia suspendida.
- Verificación vencida.
- Disponibilidad vencida.
- Tipo de cambio no disponible.
- Error de notificación.
- **Acceso a Gestión Operativa no habilitado** (nuevo).
- **Código de verificación de comprobante inválido** (nuevo).

---

## 13. Loading states obligatorios

Búsqueda; detalle de residencia; registro/login; envío de solicitud; envío de propuesta del familiar; envío de propuesta de ajuste; carga de dashboard; carga de dashboard multi-residencia; pago fee; generación de comprobante; emisión de factura fiscal; carga de documentos; actualización de disponibilidad; creación de renovación; admin tables; auditoría.

---

## 14. Responsive y mobile-first

La webapp debe ser responsive desde el MVP.

Prioridad mobile: búsqueda, detalle de residencia, solicitud, negociación (comparación de condiciones debe ser legible en mobile, apiladas verticalmente si es necesario), pago fee, comprobante, dashboard estudiante, dashboard residencia (los bloques multi-residencia se apilan verticalmente, que es el comportamiento nativo del diseño).

En mobile, los dashboards complejos deben priorizar cards y acciones principales. Tablas grandes deben convertirse en listas filtrables.

---

## 15. Reglas para Claude Code

1. No crear pantallas fuera de este documento sin justificarlo.
2. No cambiar rutas base `/students`, `/residence`, `/admin`.
3. No fusionar propuesta, solicitud, negociación, reserva, pago y comprobante.
4. No implementar Señales de Convivencia en MVP.
5. No implementar reviews funcionales en MVP.
6. No implementar app móvil nativa.
7. No crear ranking público de residencias.
8. No exponer datos sensibles.
9. No permitir acciones críticas sin confirmación y auditoría.
10. No permitir que el frontend cambie estados críticos directamente.
11. Usar server actions o endpoints seguros para toda transición.
12. Respetar estados definidos en `04_STATE_MACHINES.md`.
13. Respetar permisos definidos en `05_ROLES_AND_PERMISSIONS.md`.
14. Respetar entidades definidas en `06_DATA_MODEL.md`.
15. Respetar operaciones definidas en `07_API_SPEC.md`.
16. No permitir que la residencia envíe más de una propuesta de ajuste por solicitud (la UI debe bloquear el formulario tras el envío).
17. No permitir que el familiar envíe solicitudes directamente; siempre pasan por aprobación del estudiante.
18. Siempre mostrar el modal de tipo de cambio referencial junto a cualquier precio convertido de USD a ARS.
19. El dashboard multi-residencia nunca debe mostrar una vista agregada consolidada; solo bloques individuales en scroll.
20. No construir el chat de WhatsApp dentro de la plataforma; solo el botón con mensaje pre-formateado.
21. El enlace de revocación del fee debe estar visible en el footer de toda la plataforma (ver 2.8bis y 6.9bis).
22. Si el estudiante es menor de edad, toda la UI de contacto debe reflejar que el destinatario es el familiar vinculado.

---

## 16. Pantallas fuera del MVP

No construir todavía: Señales de Convivencia, reviews funcionales, evaluaciones estudiante↔residencia, evaluaciones entre estudiantes, tickets de mantenimiento, inventario, check-in/check-out avanzado, marketplace de servicios, ranking público, badges públicos complejos, IA avanzada/bot libre, app móvil nativa, dashboard agregado multi-residencia con métricas consolidadas.

---

## 17. Criterio de finalización UI del MVP

La UI del MVP se considera lista cuando:

- un estudiante puede buscar residencias y consultar FAQ;
- puede registrarse y completar su perfil;
- un familiar puede vincularse, crear propuestas de solicitud y el estudiante puede aprobarlas/rechazarlas;
- puede enviar solicitud directamente o vía propuesta aprobada;
- la residencia puede revisar la solicitud y establecer contacto (botón WhatsApp);
- la residencia puede enviar una propuesta de ajuste (única) y el estudiante puede aceptarla o rechazarla con comparación clara;
- el estudiante puede ver instrucciones de pago a residencia;
- la residencia puede marcar "Pago recibido";
- EstuRed puede cobrar/validar fee en ARS o USD (MercadoPago/PayU);
- se emite Factura C automáticamente;
- se puede emitir comprobante con QR verificable en `/verify/[codigo]`;
- se pueden gestionar renovaciones con la misma lógica de fee que la reserva inicial;
- se puede usar lista de espera;
- una residencia puede operar perfil, disponibilidad, habitaciones/plazas y residentes si tiene Gestión Operativa habilitada;
- un owner puede gestionar hasta 10 residencias desde un dashboard en scroll vertical con filtro, sin vista agregada;
- admin puede verificar, auditar, intervenir, gestionar feature flags freemium y gestionar casos críticos;
- no hay exposición de datos sensibles;
- todos los estados vacíos, errores y loading están contemplados.
