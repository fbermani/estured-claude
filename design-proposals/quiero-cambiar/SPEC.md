# "Quiero cambiar": diseño del flujo de cambio de residencia (DR3)

**Estado:** propuesta de diseño, sin implementar. **Autor:** agente `disenador`, 2026-10-23.
**Reglas de producto (fuente de verdad, ya escritas por el documentador):** `docs/00` §31 DR3 · `docs/04` §5.6bis y §12bis · `docs/06` §4.22, §14bis, §27.11 · `docs/08` §4.2, §4.3, §4.5, §6.1, §6.10, §6.15, §6.16, §7.12, Flujo M · `GAPS.md` ("Flujo Quiero cambiar", preguntas 1 a 10). Este SPEC no cambia ninguna regla: donde una regla es supuesto o pregunta abierta, el diseño lo marca como **decisión pendiente** (§13).
**Mockups:**
- `mockup-desktop.html`: un solo archivo responsive con las 5 superficies y todos sus estados. Tiene un panel flotante "Estados del mockup" y acepta hash, por ejemplo `#s=res&st=respond` (`s` = `mi` | `ficha` | `res` | `fam` | `land`). Con `&bare=1` se oculta el panel.
- `mockup-mobile.html`: 13 teléfonos de 375 px que cargan `mockup-desktop.html` en distintos estados (tiene que estar en la misma carpeta). Para revisar todos los estados en mobile, abrí `mockup-desktop.html` con la ventana en 375 px.
- Las etiquetas violetas punteadas ("Decisión pendiente" / "Supuesto a confirmar") son anotaciones del mockup, **no** van al producto.
**Capturas:** `assets/` (lista en §15).

---

## 1. Personas, objetivo y problema

| Quién | Qué decide | Qué teme | Qué necesita ver |
|---|---|---|---|
| **Estudiante alojada** (Lucía, Río de la Plata) | Si avisa que busca otro lugar y, después, a dónde se muda | Que la residencia la trate distinto, perder el depósito sin saberlo, perder su lugar actual por avisar | Qué pasa y qué **no** pasa al avisar, quién ve qué, cuánto le cuesta salir, cómo se arrepiente |
| **Residencia actual** (Ricardo, owner) | Cómo responde y cómo planifica la plaza | Enterarse el día que el estudiante se va; reclamos por costos mal comunicados | Quién busca, desde cuándo, salida estimada, contexto de su estadía; una forma rápida y segura de informar costos |
| **Familiar vinculado** (Martín) | Si acompaña y propone opciones | Sorpresas con depósito y fechas | Estado del aviso y lo que informó la residencia, sin poder decidir por el estudiante |

**Problema actual** (`assets/actual-mi-residencia-1280.jpg`, `assets/actual-mi-residencia-375.jpg`, `assets/actual-ficha-panel-reserva-vigente-1280.jpg`): Mi residencia no ofrece ninguna salida explícita. La ficha bloquea por DR1 con "Ya tenés una reserva hasta el 20/07/2027. Podés solicitar para fechas posteriores.", sin camino para quien quiere mudarse antes. El estudiante que se quiere ir termina buscando por fuera, sin avisar, y la residencia se entera tarde. Tampoco hay un lugar donde la residencia comunique por escrito los costos de salida.

**Objetivo del diseño:** que avisar sea seguro y fácil para el estudiante (sin miedo a perder el lugar ni a quedar expuesto) y útil para la residencia (previsibilidad y costos por escrito), con EstuRed como plataforma intermediaria visible: informa y registra, no fija ni cobra costos ni media.

## 2. Direcciones exploradas

| | **A · Bloque de estado en Mi residencia + sección en Residentes** (recomendada) | B · Pantalla propia `/students/residency/cambio` (asistente de 3 pasos) | C · Banner global + notificaciones |
|---|---|---|---|
| Idea | Un único bloque en Mi residencia que pasa de **explicativo** a **estado** (abierto, respondido, por vencer, resuelto). La residencia lo ve como sección destacada arriba de su tabla de Residentes y responde en una hoja lateral. | Ruta nueva con asistente (explicación, datos, confirmación) y página de seguimiento. | Un banner fijo en todo el panel del estudiante y la respuesta de la residencia vive en Notificaciones. |
| A favor | Respeta `docs/08` §6.16 (la ruta existe y "se amplía"). El estudiante ve el estado al lado de su estadía, con el contexto (contrato, renovación). Reutiliza el patrón de modal de `StartRenewalModal` y el de hoja de `RequestSheet`. | Mucho espacio para explicar. | Máxima visibilidad. |
| En contra | El bloque tiene que ser compacto para no empujar el resto de Mi residencia (resuelto con atajos en grilla). | Un clic más, separa el aviso de la estadía y agrega una ruta que los docs no piden. | Ruidoso y efímero: la respuesta con costos tiene que poder releerse, no perderse en una lista de notificaciones. |

**Recomendación: A.** Es la que menos inventa, la que mejor mantiene el contexto y la única que convierte la respuesta de la residencia en un documento consultable.

## 3. Mi residencia (estudiante) · `/students/residency` · `docs/08` §6.16

### 3.1 Jerarquía (desktop ≥ 900 px; columna principal + columna derecha de 300 px, como hoy)

1. Encabezado actual: H1 "Mi residencia", ubicación, chip de estado "Alojado" (existente) y, con aviso abierto, **segundo chip** "Buscando un cambio" (`orange-tint` / `orange-700`, ícono `swap_horiz`).
2. Avisos de sistema arriba de todo, solo cuando aplican: **Por vencer** (warning) y **Resuelto** (success).
3. Tarjeta "Tu estadía" (existente, sin cambios).
4. Banda de renovación (existente, sin cambios).
5. **Bloque "Quiero cambiar"** (nuevo, `id="quiero-cambiar"`, ancla para atajos desde la ficha y notificaciones). Con aviso abierto se convierte en la **tarjeta de estado** y debajo aparece la **respuesta de la residencia**.
6. Contenido actual (Sobre tu residencia, servicios, comunidad) sin cambios.
7. Columna derecha: Documentación (existente), **"Tu familiar vinculado"** (nuevo, solo con aviso abierto y familiar activo), Contacto y soporte (existente; copy ajustado, §3.6).
8. Sidebar: con aviso abierto vuelve a aparecer **"Buscar residencias"** (`StudentSidebar`, ítem `search`) debajo de Mi residencia; hoy el alojado no lo tiene.

Mobile (< 900 px): una columna en el mismo orden; la columna derecha baja al final. Los 4 atajos quedan en grilla de 2 × 2. Los pasos del aviso pasan a lista vertical.

### 3.2 Estados del bloque

| Estado (técnico → visible) | Qué se ve | Captura |
|---|---|---|
| Sin aviso | Card explicativa: eyebrow "¿Pensás en cambiarte?", H2, bajada, 3 ítems "qué pasa", pie con aclaración + botón primario **"Quiero cambiar"** y 3 preguntas desplegables | `propuesta-desktop-mi-sin-aviso.jpg`, `propuesta-mobile-mi-sin-aviso.jpg` |
| Renovación aceptada en pago/fee (`docs/04` §12bis.4) | Misma card sin botón; nota "Primero resolvé tu renovación." + enlace "Ver renovación" | mockup `#s=mi&st=renewlock` |
| Modal "Avisale a tu residencia…" | §3.3 | `propuesta-desktop-mi-modal-confirmacion.jpg`, `propuesta-mobile-mi-modal.jpg` |
| Enviando | Botón primario con spinner "Avisando a tu residencia…", `aria-disabled` | `#s=mi&st=sending` |
| Error al avisar | Alerta `role="alert"` arriba del modal; los campos conservan lo escrito | `#s=mi&st=error` |
| `open` sin respuesta | Tarjeta de estado (§3.4) + aviso neutro "Tu residencia todavía no respondió." | `propuesta-desktop-mi-aviso-abierto.jpg`, `propuesta-mobile-mi-aviso-abierto.jpg` |
| `open` con respuesta | Tarjeta de estado (paso 2 hecho, atajo "Mensaje de tu residencia" resaltado) + **card de respuesta** (§3.5). Al mostrarse se registra `response_seen_by_student_at` | `propuesta-desktop-mi-respuesta.jpg`, `propuesta-mobile-mi-respuesta.jpg` |
| Cancelar aviso | Modal con lo que se cierra (§3.6) | `propuesta-desktop-mi-cancelar.jpg`, `propuesta-mobile-mi-cancelar.jpg` |
| Cancelar bloqueado | Mismo modal: "Todavía no podés cancelar tu aviso" + la solicitud en pago con "Ver solicitud" | `#s=mi&st=cancelblocked` |
| Por vencer (día 80) | Aviso warning arriba: "Tu aviso de cambio vence en 10 días. ¿Seguís buscando?" con **Seguir buscando** / Cancelar aviso | `#s=mi&st=expiring` |
| `resolved_new_reservation` | Aviso success arriba + la respuesta de la residencia sigue visible (el estudiante la necesita para coordinar la salida) | `#s=mi&st=resolved` |
| `cancelled_by_student` / `expired` | Card explicativa con línea histórica ("Cancelaste tu aviso de cambio el {fecha}." / "Tu aviso de cambio venció el {fecha}.") y botón **"Volver a avisar"** | `#s=mi&st=closed` |
| Cargando | Skeleton de encabezado, estadía y bloque (`loading.tsx`) | `#s=mi&st=loading` |
| Sin estadía | `EmptyState` "Todavía no tenés una residencia activa en EstuRed" + "Buscar residencias" (la pantalla se titula "Mi estadía", como hoy) | `#s=mi&st=nostay` |

### 3.3 Modal "Avisale a tu residencia que buscás un cambio"

Patrón: el de `app/students/renewals/StartRenewalModal.tsx` (`role="dialog"`, `aria-modal`, scrim `forest-ink/40`). En mobile pasa a **hoja inferior** (radio 24 px arriba, 94 vh máx., pie fijo).

- **Título:** "Avisale a tu residencia que buscás un cambio"
- **Bajada:** "{Residencia} va a recibir este aviso. Tu reserva, tu lugar y tus pagos siguen igual."
- **Campo 1** (`Input type="date"`, opcional): "¿Cuándo te gustaría mudarte?" · ayuda: "Es una estimación para que la residencia se organice. La fecha exacta la acuerdan entre ustedes." → `estimated_exit_date`. Validación: no anterior a hoy. Si es posterior al fin de contrato, aviso suave: "Esa fecha es posterior al fin de tu contrato ({fecha}). No hace falta avisar para mudarte después: ya podés solicitar para esas fechas."
- **Campo 2** (`Textarea`, opcional, máx. 500 con contador): "Mensaje para tu residencia" · placeholder: "Por ejemplo: “Me cambio de facultad y busco algo más cerca de Ciudad Universitaria.”" · ayuda: "Tu residencia lo lee. Contar el motivo la ayuda a entender y, si puede, a ofrecerte otra opción." → `student_message`.
- **Qué ve / qué no ve** (dos cajas): *Tu residencia ve:* que estás buscando un cambio · tu fecha estimada de salida · tu mensaje, si escribís uno. *Tu residencia no ve:* a qué residencias escribís · tus solicitudes ni tus listas de espera.
- **Interruptor** (`role="switch"`, apagado por defecto) → `share_with_other_residences`: "Avisarles a las residencias que consulto que ya tengo alojamiento" · "Apagado: ven tu solicitud como cualquier otra. Encendido: ven “Ya tiene alojamiento, busca cambiar”, sin el nombre de tu residencia." (Copy neutro en género: el de `docs/08` dice "alojado/a".)
- **Línea del familiar** (solo con vínculo activo): "{Nombre}, tu familiar vinculado, también va a ver tu aviso y la respuesta de la residencia."
- **Confirmación explícita** (`docs/08` §6.16, §2.4): checkbox **sin marcar** por defecto: "Entiendo que avisar **no cancela mi reserva**, no me asegura lugar en otra residencia y que los costos de salida los informa mi residencia, no EstuRed." Hasta marcarlo, el botón queda `aria-disabled` con la ayuda "Marcalo para poder avisar."
- **Botones:** "Volver" (ghost) · **"Avisar a mi residencia"** (primario).
- **Éxito:** se cierra el modal, el bloque pasa a `open` y se anuncia en un `aria-live`: "Le avisamos a {Residencia}. Ya podés buscar con fechas que se superponen."
- **Error:** "No pudimos avisar a tu residencia. Tu aviso no se creó y no cambió nada. Probá de nuevo en unos minutos; si sigue pasando, escribinos a Soporte."

### 3.4 Tarjeta de estado "Estás buscando un cambio"

- Encabezado con degradé `orange-tint` → `#fff4ec` (ver §10), chip "Aviso abierto", H2 "Estás buscando un cambio", bajada: "Le avisaste a {Residencia} el {fecha}. Salida estimada: **{fecha}**. Ya podés solicitar y sumarte a listas de espera aunque las fechas se superpongan con tu estadía." (sin fecha: "Salida estimada: sin definir").
- **Pasos** (`<ol>`, no dependen solo del color: hecho = relleno, actual = anillo, pendiente = vacío): "Avisaste a tu residencia" → "Tu residencia responde / respondió" → "Buscás y solicitás" → "Confirmás tu nuevo lugar".
- **Atajos** (4, patrón `ModuleCard`): **Buscar residencias** ("Solicitud sujeta a confirmación") → `/search` · **Mis solicitudes** ("{n} de 2 activas por tu cambio") · **Listas de espera** ("{n} por tu cambio · te avisamos si se libera lugar") · **Mensaje de tu residencia** ("Todavía no respondió" / "Respondió el {dd/mm} · costos y condiciones", resaltado en naranja hasta que se ve) → ancla a la respuesta.
- **Pie:** "Las residencias que consultás no ven dónde vivís." (o "…ven que ya tenés alojamiento, sin el nombre de tu residencia." si el interruptor está encendido) · **Editar aviso** (ghost; ver §13, decisión 6) · **Cancelar aviso** (ghost en `danger-fg`).

### 3.5 Respuesta de la residencia (card compartida estudiante / familiar / vista previa de la residencia)

- Encabezado: avatar con iniciales de la residencia, "Lo que te informó {Residencia}", "Respuesta del {fecha} · {rol}" y `Badge` info "Informativo" (oculto en mobile).
- Mensaje en cita (borde izquierdo `forest`).
- Tres filas: **Costos de salida** (texto + monto de referencia USD si existe, fila con fondo cálido), **Condiciones**, **Detalles de la salida**. Las filas vacías no se muestran; si los tres campos están vacíos, solo el mensaje.
- Pie fijo: "Esta información la carga tu residencia. No modifica tu contrato; ante dudas, escribí a Soporte." · "Ver condiciones de mi reserva" (lleva al detalle de solicitud/comprobante) · "Escribir a Soporte".
- Si la residencia editó la respuesta: "Actualizada el {fecha}" en el encabezado y un punto de "nuevo" en el atajo hasta que se vuelva a ver.
- **No hay respuesta del estudiante dentro del flujo** (no existe chat): dudas o desacuerdos van por Soporte.

### 3.6 Cancelar aviso

- Título: "¿Cancelás tu aviso de cambio?" · bajada: "Le avisamos a {Residencia} que dejaste de buscar. Tu reserva sigue igual y vuelve el límite de fechas: solo vas a poder solicitar para después del {fin de contrato}."
- Lista "Esto se cierra al cancelar:" con cada solicitud ("Se cancela") y lista de espera ("Salís de la lista") creada bajo el aviso (`stay_change_intent_id`). Si no hay nada: "No tenés solicitudes ni listas de espera por tu cambio."
- Botones: **"Seguir buscando"** (outline, foco inicial: la acción segura) · **"Cancelar aviso y cerrar {n}"** (relleno `danger-fg`; sin nada que cerrar: "Cancelar aviso").
- Bloqueado (solicitud en `residence_payment_pending` o posterior): título "Todavía no podés cancelar tu aviso", bajada "Tenés una solicitud en etapa de pago a la residencia que se envió por tu cambio. Cerrala primero para no quedar con dos reservas que se superponen.", fila con "Ver solicitud", botón "Entendido".
- Ajuste de copy existente en "Contacto y soporte" de Mi residencia: hoy dice "coordinamos con la residencia por vos", lo que roza "mediación". Propuesta: "Para cualquier consulta sobre tu estadía o tu cambio, escribinos a Soporte."

## 4. Ficha pública con aviso abierto · `/residencias/[slug]` · `docs/08` §4.5

Se modifica solo el aviso de `RequestPanel` (rol estudiante) y la hoja `RequestSheet`/`ApplyForm`/`JoinWaitlistForm`.

| Caso | Panel | Captura |
|---|---|---|
| Reserva vigente, **sin aviso** | Mensaje actual de `describeReservationWindow` + segunda línea: "**¿Querés mudarte antes?** Quiero cambiar de residencia" (enlace a `/students/residency#quiero-cambiar`). CTA y `min` de fecha como hoy. | `propuesta-desktop-ficha-sin-aviso.jpg` |
| **Aviso abierto** | Aviso warning con ícono `swap_horiz`: "**Estás buscando cambiar de residencia;** tu residencia actual fue avisada. Podés solicitar para cualquier fecha, aunque se superponga con tu estadía." Se quita el `min` de fecha. "Ir a Mi residencia" pasa a un enlace secundario. | `#s=ficha&st=open` |
| Hoja con fecha superpuesta | Debajo del mes de ingreso, aviso warning (`aria-describedby` del select): "Esta fecha se superpone con tu estadía actual (hasta el {fecha}). Podés enviarla porque tenés abierto tu aviso de cambio. Si se confirma, coordiná tu salida con tu residencia: ver lo que te informó." Resumen con "Solicitudes activas: {n} de 2". Línea de privacidad: "{Residencia} no ve dónde vivís hoy. Lo podés cambiar en tu aviso, en Mi residencia." (o "…ve que ya tenés alojamiento, sin el nombre de tu residencia."). Pie: "Solicitud sujeta a confirmación de la residencia. Enviarla no te asegura el lugar." | `propuesta-desktop-ficha-hoja.jpg`, `propuesta-mobile-ficha-hoja.jpg` |
| Tope de 2 solicitudes | Aviso neutro "Ya tenés 2 solicitudes activas. Para enviar otra, esperá una respuesta o cancelá una en Mis solicitudes." + CTA deshabilitado (la regla §5.6 no cambia) | `#s=ficha&st=limit` |
| Lista de espera | Igual que la solicitud; en `/students/waitlist` la entrada lleva la etiqueta "Por tu cambio de residencia" (`docs/08` §6.10) | — |

La residencia consultada **no** recibe ningún dato de la residencia actual. Con el interruptor encendido, en su inbox ve solo la etiqueta "Ya tiene alojamiento, busca cambiar".

## 5. Residencia actual · `/residence/[id]/residents` + notificación + Panel · `docs/08` §7.12

### 5.1 Residentes (`ResidentsBrowser`)

1. Encabezado y botón "Agregar residente" (existentes) + campana con contador.
2. KPIs: los 4 actuales + **"Buscan cambiar"** (quinto; borde y número en naranja cuando es > 0). En mobile, grilla de 2 columnas como hoy.
3. **Sección "N residentes buscan cambiar"** (nueva; solo si hay al menos un aviso `open` o resuelto en los últimos 30 días), arriba del buscador:
   - Encabezado con degradé naranja suave: H2 "{n} residentes buscan cambiar" (es el contador de cabecera que pide `docs/08` §7.12) + "Te avisaron con tiempo que están buscando otro lugar. Respondé con los costos, las condiciones y los detalles de la salida: así deciden con información clara y vos planificás la plaza." + enlace "¿Cómo funciona?" (abre un `InfoTip`/popover con el bloque de ayuda de beneficios).
   - Una fila por aviso: residente (inicial, nombre corto, bandera, tipo y habitación) · **Avisó** (fecha + "hace X") · **Salida estimada** (+ "Contrato hasta") · estado de respuesta (`Badge`: "Sin responder" ámbar con ícono reloj / "Respondida" / "Respondida · vista" con doble check) · acción (**Responder** primario / **Editar respuesta** o "Ver respuesta" outline).
   - Aviso resuelto: fila atenuada "Confirmó un nuevo alojamiento · Ingresa allí el {fecha}" (sin nombre de la residencia nueva) + `Badge` "Aviso cerrado" + **Registrar salida** (abre el flujo existente con la fecha sugerida = día anterior al ingreso nuevo o la salida estimada). Cancelado/vencido: la fila desaparece y queda la notificación.
   - Pie de planificación: "Si se van en las fechas estimadas, se libera **1 Individual** desde diciembre y **1 Doble** desde marzo." + "Revisar disponibilidad" → `/availability`. Se calcula de los avisos abiertos; no cambia la disponibilidad sola.
4. Filtro nuevo en las pills: **"Buscan cambiar"** con contador naranja. En la tabla, el estado existente suma un segundo `Badge` "Busca cambiar" (en la vista expandida "Gestionar" se lee completo: "Busca cambiar de residencia · avisó el {fecha}").
5. Sidebar (`ResidenceSidebar`): contador naranja en "Residentes" = avisos sin responder.

Estados: lista (`propuesta-desktop-residentes.jpg`, `propuesta-mobile-residentes.jpg`), cargando (skeleton de KPIs y filas), **vacío con filtro activo** (`EmptyState` icono `swap_horiz`: "Nadie está buscando cambiar" / "Cuando un residente avise que busca otro lugar, lo vas a ver acá y te va a llegar una notificación con su fecha estimada de salida. Así te enterás con tiempo, no el día que se va."; `propuesta-desktop-residentes-vacio.jpg`), sin avisos y sin filtro (la sección no se renderiza).

### 5.2 Hoja "Responder a {nombre}"

Hoja lateral derecha de 560 px (mismo componente que `RequestSheet`, generalizado; en mobile, pantalla completa con pie fijo).

1. **Contexto** (solo lectura, `dl`): ingreso · contrato hasta · estadía mínima y cuándo se cumple · depósito de la reserva (del snapshot) · salida estimada (naranja) · renovación (si hay) · mensaje del estudiante (si hay).
2. **Plantillas sugeridas** (`aria-pressed`): "Estadía mínima no cumplida" (preseleccionada solo si la salida estimada es anterior al cumplimiento de la estadía mínima), "Sin costos de salida", "Preaviso y entrega", "Queremos escucharte". Completan los 4 campos con datos reales de la estadía; ayuda: "Completamos las fechas con los datos de la estadía. Revisá y editá antes de enviar." Elegir otra plantilla después de editar pide confirmación ("¿Reemplazar lo que escribiste?").
3. **Campos** (todos `Textarea`; mapeo 1:1 a `docs/06` §14bis): Mensaje para {nombre} (obligatorio, mínimo 20 caracteres) → `residence_response_message` · Costos de salida anticipada → `residence_exit_costs_text` · Monto de referencia USD (opcional, `money`) → `residence_exit_costs_usd`, ayuda "Solo informativo: EstuRed no lo cobra ni lo convierte en un pago." · Condiciones → `residence_exit_conditions_text` · Detalles de la salida → `residence_exit_details_text`.
4. **Guía de tono** (caja `butter`): "**Escribí información, no promesas.** Contá lo que aplica según lo que acordaron en la reserva. Evitá “te aseguramos”, “seguro hay lugar” o presiones para que se quede. {Nombre} y su familiar vinculado lo leen tal cual." Opcional (mejora): aviso suave en vivo si el texto contiene "garantiz", "asegur", "mediación".
5. **Pie fijo:** texto legal (§12) · **"Ver como {nombre}"** (outline → vista previa con la card de §3.5; `propuesta-desktop-residentes-vista-previa.jpg`) · **"Enviar respuesta"** (primario).
6. Éxito: toast `role="status"` "Respuesta enviada a {nombre}. La ve en Mi residencia junto con su familiar vinculado. Podés editarla mientras el aviso siga abierto." y la fila pasa a "Respondida".
7. Error: alerta arriba "No pudimos enviar tu respuesta. Revisá tu conexión y probá de nuevo. Lo que escribiste sigue acá." + error de campo bajo el mensaje.

### 5.3 Notificación y Panel

- **Campana** (`NotificationBell`): "**{Nombre} avisó que busca cambiar de residencia.** Salida estimada: {fecha}. Respondele con los costos y condiciones de salida." + botón "Responder" que abre la hoja. Otros eventos: "{Nombre} vio tu respuesta sobre su salida." · "{Nombre} canceló su aviso de cambio: se queda." · "{Nombre} confirmó un nuevo alojamiento desde el {fecha}. Registrá su salida cuando corresponda." · "El aviso de cambio de {nombre} venció."
- **Panel / dashboard** (`docs/08` §7.1): en el bloque de la residencia, una línea "{n} residentes buscan cambiar · {m} sin responder" con enlace a Residentes filtrado (`?filtro=buscan-cambiar`). Sin mockup propio: mismo estilo que los ítems de "próximos movimientos".

## 6. Familiar vinculado · `/students/dashboard` (rol familiar) · `docs/08` §6.15

- En la card del estudiante vinculado: chip "Buscando un cambio" y bloque de solo lectura (etiqueta "Solo lectura" con ícono `visibility`).
- **Sin aviso:** "{Nombre} no está buscando un cambio. Si decide hacerlo, ella avisa a su residencia desde su panel y vos lo ves acá: la fecha estimada de salida y lo que la residencia informe sobre costos de salida."
- **Abierto:** "{Nombre} avisó a su residencia el {fecha} que busca otro lugar. Salida estimada: {fecha}. Su reserva actual sigue vigente." + (sin respuesta) "La residencia todavía no informó costos ni condiciones de salida. Te avisamos cuando responda." / (con respuesta) las 3 filas compactas de §3.5.
- Acciones: **"Proponerle una residencia"** (flujo de propuestas existente; la validación DR1 contempla el aviso abierto) · "Buscar residencias". Nota: "La decisión es de {nombre}: vos podés proponerle opciones y ella decide si envía la solicitud. Solo ella puede cancelar el aviso."
- **Resuelto:** "{Nombre} confirmó una reserva en otra residencia desde el {fecha}. {Residencia actual} registra su salida." + "Ver comprobante".
- **Bloque de beneficio** (siempre visible, fondo `mint`): "Si {nombre} quiere cambiarse, no te enterás a último momento" + texto + 3 píldoras ("Te avisamos cada novedad", "Costos de salida por escrito", "Podés proponerle residencias").
- El familiar **no** ve el mensaje del estudiante a la residencia (privacidad por defecto, sobre todo con menores; ver §13, decisión 4).
- Capturas: `propuesta-desktop-familiar.jpg`, `propuesta-mobile-familiar.jpg`.

## 7. Landings

### 7.1 `/for-students` (`docs/08` §4.2): sección nueva entre "Beneficios" y "Paso a paso"

Fondo `paper` con bordes `line` (alterna con las secciones vecinas). Grilla 1.05fr/0.95fr; en mobile, una columna.
- Eyebrow (pastilla `orange-tint`): "Si ya vivís en una residencia"
- H2: "Cambiarte de residencia, sin esconderte y sin sorpresas"
- Bajada: "Si el lugar donde vivís ya no es para vos, avisale con un botón y buscá otro aunque tu contrato siga vigente. Antes de decidir, sabés qué costos tiene salir."
- 3 pasos numerados: **Avisás con un botón** ("Desde Mi residencia tocás “Quiero cambiar”. Tu residencia se entera con tiempo y tu reserva sigue igual.") · **Buscás sin trabas de fechas** ("Solicitás y te sumás a listas de espera aunque se superpongan con tu estadía. Te avisamos si se libera lugar.") · **Conocés los costos antes** ("Tu residencia te informa por escrito depósito, preaviso y entrega. Lo ves vos y tu familia.")
- CTAs: "Ir a Mi residencia" (con sesión de alojado) o "Crear cuenta de estudiante" (invitado) · "Buscar residencias".
- Letra chica: "Lo cancelás cuando quieras. Las otras residencias no ven que vivís en una, salvo que vos lo decidas. Los costos de salida los informa cada residencia: EstuRed no los fija ni los cobra. Toda solicitud está sujeta a confirmación."
- Composición visual: réplica estática de la tarjeta "Estás buscando un cambio" con 2 tarjetas flotantes ("Tu reserva sigue igual", "Costos de salida, por escrito"), mismo lenguaje que el hero actual. `aria-hidden`.
- **Franja para familias** (dentro de la sección): "Para familias: te enterás de todo" + texto + "Vincularme como familiar" → `/register/family`.
- Opcional: sumar un 7.º ítem a `RotatingBenefits` ("¿Ya vivís en una residencia?") que ancle a esta sección.
- Capturas: `propuesta-desktop-for-students.jpg`, `propuesta-mobile-for-students.jpg`.

### 7.2 `/for-residences` (`docs/08` §4.3): sección nueva después de "Beneficios"

Fondo `forest-ink` (mismo tratamiento que el hero de esa landing), texto claro.
- Eyebrow: "Previsibilidad" (`orange-light` sobre fondo oscuro, uso permitido por `globals.css`).
- H2: "Enterate de una salida con tiempo, no el día que se van"
- Bajada: "Muchos estudiantes se cambian sin avisar, y eso desordena tu ocupación, tu planificación y tus renovaciones. Con “Quiero cambiar”, el residente te avisa cuando empieza a buscar."
- 4 beneficios: **Anticipás la salida** · **Comunicás los costos antes** · **Planificás la plaza** · **Tenés la oportunidad de escuchar** (copy en el mockup).
- Letra chica: "Tu respuesta es informativa: no reemplaza el contrato ni el preaviso que acordaste con el residente. Las otras residencias no ven a tus residentes. EstuRed es una plataforma intermediaria y no fija ni cobra costos de salida."
- Visual: réplica de la sección de Residentes con 2 filas + notificación flotante. **Sin métricas inventadas** (nada de "reducí un X % las salidas").
- Captura: `propuesta-desktop-for-residences.jpg`.

## 8. Notificaciones (estudiante y familiar)

| Evento | Estudiante | Familiar |
|---|---|---|
| Creado | "Le avisamos a {Residencia} que buscás un cambio. Ya podés solicitar con fechas que se superponen." | "{Nombre} avisó a su residencia que busca cambiar." |
| Respondido / editado | "{Residencia} te informó costos y condiciones de salida." | "La residencia de {nombre} informó costos y condiciones de salida." |
| Por vencer | "Tu aviso de cambio vence en 10 días. ¿Seguís buscando?" | — |
| Vencido | "Tu aviso de cambio venció. Si seguís buscando, podés avisar de nuevo." | "El aviso de cambio de {nombre} venció." |
| Cancelado | — | "{Nombre} canceló su aviso de cambio." |
| Resuelto | (la de reserva confirmada, + "Tu residencia actual ya sabe la fecha de tu ingreso.") | "{Nombre} confirmó su nuevo lugar desde el {fecha}." |

Todas enlazan a `/students/residency#quiero-cambiar` (sumar el tipo a `lib/notifications/links.ts`).

## 9. Componentes

**Reutilizar:** `Card`, `Button` (primary/outline/ghost), `Badge` (estados de respuesta y "Busca cambiar": es visual, **no** usar `StatusTag`), `Icon`, `EmptyState`, `Input`/`Textarea`/`Select` de `components/ui/Input.tsx`, `InfoTip`, `ExpandableCard` (preguntas de la card explicativa), `ModuleCard` (atajos), `SectionHeader` y `Reveal` (landings), `NotificationBell`, `StudentSidebar`/`ResidenceSidebar`, patrón de modal de `StartRenewalModal`, `RequestSheet` (hoja lateral), `RequestPanel` (solo el aviso), `ResidentsBrowser` (sección + filtro + badge).

**Nuevos:**
- `components/students/StayChangeCard.tsx`: bloque de Mi residencia por estado (sin aviso / bloqueado por renovación / abierto / histórico).
- `components/students/StayChangeModal.tsx` y `StayChangeCancelModal.tsx` (client).
- `components/students/StayChangeResponse.tsx`: card de respuesta (server), reutilizada por estudiante, familiar y vista previa de la residencia (prop `variant: "student" | "family" | "preview"`).
- `components/students/StayChangeSteps.tsx`: los 4 pasos.
- `app/residence/[residence_id]/residents/StayChangeSection.tsx` y `StayChangeResponseSheet.tsx` (client; plantillas en `lib/stayChange/templates.ts`, puro y testeable).
- `components/marketing/StayChangeHighlight.tsx` con variantes `students` / `residences`.
- Copy de estados visibles en un único lugar (`lib/stayChange/copy.ts`), mismo criterio que `StatusTag`: el usuario nunca ve `open`, `cancelled_by_student`, etc.

## 10. Tokens

Solo tokens existentes de `globals.css`: `orange`, `orange-700`, `orange-tint` (aviso abierto, sin responder, KPI), `forest*`/`mint` (hecho, beneficio familia), `butter`/`butter-fg` (guía de tono), `sky`/`sky-fg`, `info-*`, `danger-*`, `cream*`, `line*`, `field-border`, radios `card`/`sm`/`field`, sombras `card`/`card-hover`/`float`, `ease-bounce`. Los degradés (`orange-tint` → `#fff4ec`/`#fff6ef`) y fondos `#fff9f4`/`#fff7f1` son mezclas a mano de `orange-tint` con blanco: implementarlos como `bg-gradient-to-br from-orange-tint to-paper` y `bg-orange-tint/40` (sin token nuevo). **No se propone ningún cambio en `globals.css`.** El violeta de las etiquetas "Decisión pendiente" es solo del mockup.

## 11. Accesibilidad

- Modales: `role="dialog"`, `aria-modal`, título en `aria-labelledby`, foco inicial en el primer campo (aviso) o en "Seguir buscando" (cancelar), foco atrapado, `Esc` cierra, al cerrar el foco vuelve al botón que lo abrió, scroll del body bloqueado.
- El interruptor es `input type="checkbox" role="switch"` con texto visible; el checkbox de confirmación tiene label completo; el botón deshabilitado usa `aria-disabled` + ayuda visible (no solo opacidad).
- Estados nunca solo por color: chips con texto, pasos con relleno/anillo + texto, badges con ícono + texto ("Sin responder", "Respondida · vista").
- Contraste: `orange-700` sobre `orange-tint` (AA según `scripts/check-contrast.mjs`), `forest-700` sobre `forest-tint`, `butter-fg` sobre `butter`, `#cfe2d9`/`#a9c6b9` sobre `forest-ink` (> 7:1). Sumar a `check-contrast.mjs` el par `danger-fg` + blanco del botón "Cancelar aviso".
- Táctiles ≥ 44 px (botones, plantillas de 40 px con 8 px de separación, filas de preguntas). Inputs de 16 px en mobile (ya resuelto en `Input.tsx`).
- `aria-live="polite"` para éxito al avisar y al enviar la respuesta; `role="alert"` para errores. Errores de campo enlazados con `aria-describedby`.
- `prefers-reduced-motion`: sin rebote ni skeleton animado.

## 12. Copy legal fijo y ajustes propuestos a `docs/08`

- Bajo el formulario de la residencia, `docs/08` §7.12 pide: "Esta información es informativa. EstuRed no fija ni cobra estos costos ni reemplaza el contrato con el residente." Se propone (mismo contenido, sin la redundancia "información es informativa"): **"Tu respuesta es informativa: EstuRed no fija ni cobra estos costos y no reemplaza el contrato con tu residente. Podés editarla mientras el aviso siga abierto."** Necesita OK del dueño o del documentador porque es copy de doc.
- Interruptor: `docs/08` dice "Avisar a las residencias que consulto que ya estoy alojado/a"; se propone la versión neutra "Avisarles a las residencias que consulto que ya tengo alojamiento".
- Etiqueta en la tabla de Residentes: `docs/08` dice "Busca cambiar de residencia"; en la tabla se usa "Busca cambiar" por ancho, y la frase completa en la sección y en el detalle.
- Revisión legal pendiente del texto de responsabilidad (`GAPS` DR3 #6, `docs/21`).

**Recortado por reglas de negocio:** respuesta del estudiante dentro del flujo (sería un chat), cualquier "garantía" de devolución, botón de pago de costos de salida (EstuRed no cobra), métricas de retención en las landings, nombre de la residencia nueva para la actual.

## 13. Decisiones pendientes del dueño (de a una)

Las 10 preguntas de `GAPS.md` siguen abiertas. Estas son las que **cambian el diseño**, en orden de impacto:

1. **¿Dónde se define la política de salida anticipada?** (GAPS #1)
   A) Solo como texto libre al responder (hoy, supuesto). B) **Recomendada:** la residencia la carga una vez en su perfil (en "Condiciones de reserva"); se muestra en la ficha pública **antes** de reservar y precarga la respuesta. C) Ambas, con la del perfil como base editable. B y C suman una fila "Si te vas antes" a "Tarifas y condiciones" de la ficha.
2. **Qué se cierra al cancelar el aviso** (GAPS #10). A) **Recomendada (supuesto actual):** se cierran solicitudes sin pago iniciado y listas creadas bajo el aviso; cancelar se bloquea con pago en curso. B) Se mantienen las que no se superponen con el contrato y solo se cierran las superpuestas. C) El estudiante elige en el modal. (B y C suman una columna de checkboxes al modal de §3.6.)
3. **Qué sabe la residencia actual al resolverse** (GAPS #5). A) **Recomendada (supuesto):** solo la fecha de ingreso a la nueva, sin nombre. B) También el nombre de la residencia nueva.
4. **Menores de edad** (GAPS #7). A) Solo el estudiante crea y cancela; el familiar ve y recibe avisos (supuesto). B) **Recomendada para menores:** el aviso de un menor queda "pendiente de tu familiar" hasta que el familiar lo confirme (mismo patrón que las propuestas del familiar, a la inversa). C) El familiar puede crearlo por el menor. En los tres casos, el familiar no ve el mensaje privado del estudiante salvo decisión en contrario.
5. **Dinero ya pagado y fee de EstuRed** (GAPS #2, #3). No se resolvió en el diseño: la card explicativa remite a "las condiciones de tu reserva" y la respuesta de la residencia. Hace falta decidir si EstuRed muestra algún texto sobre el fee de la reserva nueva si después no se muda.
6. **¿El estudiante puede editar el aviso abierto** (fecha estimada, mensaje, interruptor)? A) **Recomendada:** sí, auditado, y la residencia ve "Actualizado el {fecha}". B) No: para cambiar algo, cancela y vuelve a avisar (más fricción y más ruido para la residencia). El mockup muestra "Editar aviso" como A.
7. **Confirmación explícita.** A) **Recomendada:** checkbox obligatorio en el modal (como en el mockup). B) Solo el botón, con el "qué pasa / qué no pasa" a la vista (un paso menos).
8. **Vencimiento de 90 días con recordatorio a los 80** (GAPS #4): el diseño lo soporta; confirmar el plazo.

## 14. Notas de implementación (para `constructor` + `interfaz`)

- Depende de la migración de `stay_change_intents` (+ `stay_change_intent_id` en `application_requests` y `waitlist_entries`), de la excepción en la validación DR1 (`lib/students/reservationWindow.ts`: `loadReservationWindowForUser` debe devolver el aviso abierto para que `describeReservationWindow` elija el mensaje y quite `minRequestStartDate`) y de los tipos de notificación de `docs/06` §21. Eso es de `constructor`/`base-datos`; `interfaz` construye las pantallas encima.
- Mutaciones (todas server actions con validación server-side y auditoría): `openStayChange`, `updateStayChange` (si se aprueba la decisión 6), `cancelStayChange` (devuelve lo que cerró), `confirmStillSearching`, `respondStayChange` (solo staff de `current_residence_id`), `markStayChangeResponseSeen`.
- Formularios: patrón ya usado en el repo (`useActionState` + `useFormStatus` en un subcomponente; botones con `name="intent"` si hay más de una acción).
- RLS: la residencia actual lee solo sus avisos; **ninguna otra residencia** lee la tabla (la proyección "Ya tiene alojamiento, busca cambiar" se resuelve server-side en la carga del inbox). El familiar, solo lectura y sin `student_message` (salvo decisión 4). Pedir revisión de `seguridad`.
- Seed demo (`feedback_seed_data_per_cycle`): Lucía con aviso abierto y respuesta de Río de la Plata (datos de este mockup); Tomás (o un residente cargado) con aviso respondido y visto; uno resuelto para ver "Registrar salida"; Martín ve el de Lucía.
- No tocar `StatusTag.tsx` ni `globals.css`. Las pantallas existentes cambian solo lo que dice este SPEC.

## 15. Capturas (`assets/`)

**Estado actual:** `actual-mi-residencia-1280.jpg`, `actual-mi-residencia-375.jpg`, `actual-ficha-panel-reserva-vigente-1280.jpg`.
**Propuesta desktop (1280):** `propuesta-desktop-mi-sin-aviso.jpg`, `propuesta-desktop-mi-modal-confirmacion.jpg`, `propuesta-desktop-mi-aviso-abierto.jpg`, `propuesta-desktop-mi-respuesta.jpg`, `propuesta-desktop-mi-cancelar.jpg`, `propuesta-desktop-ficha-sin-aviso.jpg`, `propuesta-desktop-ficha-hoja.jpg`, `propuesta-desktop-residentes.jpg`, `propuesta-desktop-residentes-responder.jpg`, `propuesta-desktop-residentes-vista-previa.jpg`, `propuesta-desktop-residentes-vacio.jpg`, `propuesta-desktop-familiar.jpg`, `propuesta-desktop-for-students.jpg`, `propuesta-desktop-for-residences.jpg`.
**Propuesta mobile (375):** `propuesta-mobile-mi-sin-aviso.jpg`, `propuesta-mobile-mi-modal.jpg`, `propuesta-mobile-mi-aviso-abierto.jpg`, `propuesta-mobile-mi-respuesta.jpg`, `propuesta-mobile-mi-cancelar.jpg`, `propuesta-mobile-ficha-hoja.jpg`, `propuesta-mobile-residentes.jpg`, `propuesta-mobile-residentes-responder.jpg`, `propuesta-mobile-familiar.jpg`, `propuesta-mobile-for-students.jpg`.
Algunas capturas se tomaron antes de los últimos ajustes menores de copy (interruptor neutro, checkbox sin marcar); el mockup es la referencia final.
