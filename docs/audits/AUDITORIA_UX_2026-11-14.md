# Auditoría de UX/CX — 2026-11-14

Alcance: dev server local (`estured-dev`, http://localhost:3000), solo lectura. Roles recorridos con «Simular usuario»: Camila (en búsqueda), Lucía (alojada), Valentina (menor), Martín (familiar), Ricardo (dueño), admin operativo; flujo logueado-fuera (popup, preregistro, fundadoras). Desktop 1280 px y mobile 375 px. No se ejecutó ninguna acción que mute datos. Las capturas quedaron en la sesión del navegador (no se guardaron archivos); cada hallazgo cita ruta y texto exacto para reproducirlo.

## 1. Resumen ejecutivo

El producto está en muy buen estado conceptual: el copy respeta voseo, «Soporte» (no hay «mediación» en la UI), no promete disponibilidad ni garantías, los precios muestran USD + ARS referencial con aclaración, el popup de preapertura es claro y en mobile el CTA queda sobre el pliegue, y el fondo del popup está `inert`/`aria-hidden`. Los problemas están en (a) contradicciones entre lo que dice el popup de preapertura y lo que se ve/lee detrás, (b) contadores y estados que cuentan historias distintas según el rol o la sesión, y (c) dashboards con hitos desfasados respecto de los datos reales del usuario.

Problemas principales:
1. Preapertura: el popup dice «estamos visitando residencias, enterate primero» mientras la landing real detrás (y la meta/SEO) vende un sitio abierto con 42 residencias «Verificadas» y «Ya podés buscar… y enviar tu solicitud».
2. Contadores «reales» alimentados por filas de seed/prueba («Quedan 4 de 10 lugares», «Ya hay residencias registrándose») en un entorno (staging) que se muestra a terceros.
3. El stepper del dashboard de la estudiante contradice su propio estado (Camila, 9 solicitudes, aparece en «Paso 1 de 6 · Completá tu perfil para pedir residencia»).
4. «Residencia Sin Fronteras» figura en el catálogo público como cualquier otra «Verificada», sin marca de relación con EstuRed (decisión de producto pendiente sobre transparencia).
5. Un mismo hecho se muestra distinto entre roles (ingreso de Lucía 20/07/2026 vs 15/02/2027; ocupación 29/35 vs «34 cargados»; catálogo 42 vs 43 residencias según sesión).

## 2. Hallazgos

Convención: [DOC] = desvío objetivo de docs; [OP] = opinión de producto.

### Preapertura y captación

**H1 · Alto · [OP + DOC 23 §1/§7] · Estudiante nueva · `/`, `/preregistro`**
Qué pasa: el popup promete «Estamos visitando residencias una por una. Sumate y enterate primero cuáles quedaron verificadas». Detrás, la landing real (inerte y blureada, pero indexable y con `<h1>` propio) dice «Reservá y pagá desde donde estés», «Ya podés buscar, comparar y enviar tu solicitud a las primeras residencias verificadas» (`components/marketing/HomeLanding.tsx:314`) y lista decenas de «Verificada». Hay dos `<h1>` en la página (`Elegí tu residencia…` y `Creá tu cuenta`).
Por qué importa: quien lee el fondo o el snippet de buscadores recibe la promesa contraria a la del popup («abierto» vs. «todavía no»); rompe «sin promesas de disponibilidad» y la urgencia real.
Sugerencia: en modo preapertura, variante de `HomeLanding` con copy de «acceso anticipado» (hero y CTA final), un solo `<h1>` visible para lectores, y `meta description` alineada. Si es escenografía, al menos no mostrar el catálogo con «Verificada» ni el CTA «Buscar residencia».

**H2 · Alto · [DOC 23 §6/§1 «contadores siempre reales»] · Residencias · `/fundadoras`**
Qué pasa: «Ya hay residencias registrándose, quedan 4 de 10 lugares» y en `/` «Quedan 4 de 10 lugares de Residencia fundadora». El cupo ocupado sale de filas de seed y prueba (`Residencia Seed Palermo`, `Residencia de prueba 756d8897`… visibles en `/admin/solicitudes-alta`).
Por qué importa: en staging (visible para el dueño y potenciales socios) la escasez es fabricada; si se copia el patrón a prod sin limpiar, también. DR46 pide mostrarlo solo con la primera externa real.
Sugerencia: excluir de los conteos públicos las filas `test-*`/seed (o marcarlas con flag), y limpiar con el script de cleanup antes de mostrar staging.

**H3 · Medio · [OP] · `/preregistro` paso 1 y `/mi-lugar`**
- «#15 Tu lugar en la lista si terminás ahora» sugiere una fila con prioridad; el doc dice «sin prioridad ni reserva». Reemplazar por «Sos la persona N que se suma» o quitar el ordinal.
- `/mi-lugar` para quien ya tiene cuenta activa (Camila) muestra «¡Listo! Ya estás adentro» y paso 1 «Creá tu cuenta y buscá»: el primer paso ya está hecho. Variante para cuentas ya activas, y el panel de fondo dice solo «Hola» (sin nombre).
- Paso 1 mezcla «Fecha de nacimiento» nativa (`dd/mm/yyyy`, difícil en mobile) con un «Necesitamos saber si ya cumpliste 18» sin explicar qué pasa si no (se descubre recién al enviar). Anticipar: «Si sos menor, tu familiar te invita».

**H4 · Medio · Residencias · `/fundadoras/datos`**
El formulario («¿Cómo te contactamos?») no dice qué sigue (quién llama, en cuánto tiempo, que primero visitan), ni recuerda el beneficio ni el lugar que se reserva. «Tu nombre» sin placeholder; «No completar» (dev) no distingue de «Volver». Agregar una línea «Te escribimos en 48 h para coordinar una visita» (solo si es un compromiso operativo real) y estado de éxito con próximos pasos.

**H5 · Bajo · Dev** — Widgets dev (Turnstile «solo para pruebas», «Pantallas (dev)», «Cerrar (solo dev)») ocupan el 20 % del alto en mobile y tapan contenido (p. ej. «Simular usuario» sobre la primera card de `/search`). Ocultarlos en capturas de demo o moverlos al borde; el `Saltar al contenido` apunta a un `main` inerte.

### Catálogo y solicitud

**H6 · Alto · [OP] · Público · `/search`, `/residencias/[slug]`**
«Residencia Sin Fronteras» aparece como «Verificada por EstuRed» igual que el resto, sin ninguna señal de relación con EstuRed (DR45 prevé divulgación solo oral y la deja fuera de «opciones»). En un producto cuyo valor es la neutralidad, la ausencia de una marca visible es un riesgo de confianza si alguien la descubre. Decisión del dueño: etiqueta sobria («Operada por el equipo de EstuRed») o excluirla del ranking «Recomendadas».

**H7 · Medio · Inconsistencia · `/search`**
El mismo catálogo muestra «42 residencias» con Camila logueada y «43» deslogueado; el admin muestra «43 residencias activas». Si hay una oculta por regla (visibilidad/penalización/ya solicitada) debería explicarse; si no, es un bug de conteo (derivar a `depurador`).

**H8 · Medio · Estudiante · ficha `/residencias/wanna-tango`**
- El panel de solicitud solo ofrece «Individual» (las otras 3 tipologías son «completa» con «Lista de espera» en otra sección, bastante abajo). Quien busca Doble a 315 no tiene un CTA «Anotarme en lista de espera» junto al formulario.
- Siete tarjetas giratorias de «Tarifas y condiciones» (Para reservar, Matrícula, Depósito, Ajuste, Mes vacío, Documentos…) con «Ver detalle»: mucha información en el momento de decidir, y varias dicen «No cobra» (ruido). Mostrar solo las que cobran y un único «Condiciones completas».
- La carga inicial muestra «Cargando la residencia…» durante varios segundos en dev; en prod usar skeleton con la forma de la ficha.
- Galería de 4 fotos con 2 recuadros beige vacíos mientras cargan (CLS).

**H9 · Medio · `/search`** — Tarjetas con zona de foto gris vacía y puntos de carrusel mientras no cargan (lazy en 18/30 imágenes); las residencias sin foto muestran «Foto próximamente», pero las que cargan tarde se ven iguales a las rotas. Fondo con la inicial/barrio como placeholder consistente.

### Dashboards por rol

**H10 · Alto · Estudiante en búsqueda · `/students/dashboard`**
Camila (9 solicitudes) ve «Paso 1 de 6 · Completá tu perfil para pedir residencia» y el hero «Armemos tu camino a la residencia». Valentina (0 solicitudes) ve idéntico estado y %. El stepper no refleja el historial ni que Camila ya pidió residencia 9 veces; además perfil «al 44 %» y «Falta 56 %» mezclan dos métricas. Sugerencia: calcular el hito por la solicitud más avanzada activa, o esconder el stepper si no hay solicitud activa y mostrar «Tus solicitudes» arriba. Aclarar con un solo número (perfil) vs. etapa (camino).

**H11 · Medio · Estudiante · `/students/applications`**
La lista mezcla 9 solicitudes (todas cerradas: vencidas, revocadas, finalizadas) sin separar «Activas» de «Historial»; el texto de demostración `[DEMO-NEG] Demo negociación` y «Tu objetivo académico: …» repetido 9 veces dominan la vista. Agrupar (activas arriba, historial plegado) y no repetir el objetivo si es el mismo.

**H12 · Medio · Estudiante alojada · `/students/dashboard` (Lucía)**
«Hola, Lucia. Ya tenés tu lugar.» + chip «ALOJADO» + «Ya renovaste tu estadía» + «Faltan 93 días» para llegar. Mezcla estados de «reserva confirmada», «alojada» y «renovación» para alguien que todavía no se mudó (ingreso previsto 15/02/2027). Y para el familiar la reserva confirmada figura con «Ingreso 20/07/2026» (Martín, `/students/dashboard`): dos fechas de ingreso distintas para el mismo hecho. Alinear nombres/estados («Reserva confirmada · llegás en 93 días») y fechas entre estudiante y familiar. «Lucia» (sin tilde) en dashboard y familia vs. «Lucía» en el selector: normalizar datos demo.

**H13 · Medio · Familiar · `/students/dashboard` (Martín)**
- Texto confuso: «Lucia confirmó una reserva en otra residencia desde el 15/08/2026. Residencia Río de la Plata registra su salida cuando se retire.» — «otra residencia» sugiere que ya se mudó, y a la vez habla de su salida. Reescribir con la residencia actual y la fecha.
- Duplicados: «Solo lectura: el checklist lo completa el estudiante.» y «Solo lectura: el checklist lo completa el estudiante y los ítems están escritos para él o ella.» seguidos.
- El bloque «Si X quiere cambiarse, no te enterás a último momento…» se repite por cada estudiante y es texto promocional dentro de un panel operativo. Plegarlo.
- «Vínculo activo / Activo» redundante por vínculo.

**H14 · Medio · Estudiante menor · `/students/dashboard` (Valentina)**
Nada en el panel de Valentina (17) le dice que su tutor ve sus solicitudes y reserva (solo lectura), ni que es menor. Para «privacidad visible con menores» agregar en el bloque «Padre, madre o tutor» una línea «Martin ve tus solicitudes y reservas. No puede decidir por vos». Además el tutor aparece como «Martin Fernandez · padre.lucia@example.com» (mail de otra estudiante; dato demo a limpiar) y el botón «Desvincular» se ofrece a una menor sin aclarar consecuencias (evaluar contra docs/05).

**H15 · Medio · Residencia · `/residence/[id]`**
- «Ocupación 29 / 35 plazas operativas · 35 operativas (1 fuera de servicio)» junto a «Residentes 34 cargados» y «5 pendientes»: tres cifras para la misma población sin leyenda. Definir y rotular («29 ocupadas», «34 residentes cargados incl. 5 por confirmar»).
- La lista «Solicitudes recientes» repite filas idénticas (Camila R. · Individual · 24/10/2026 · revocada ×2): no se distinguen sin la fecha de ingreso. Incluir fecha de ingreso y duración.
- Estados con vocabulario distinto del lado estudiante/familia: «Reserva vencida — fee sin pagar» (residencia) vs «Reserva vencida» (estudiante) vs «Vencida — sin pago a la residencia» (familia) vs «Venció por falta de pago» (residencia, otra fila). Unificar etiquetas por entidad (docs/04) y variar solo la perspectiva en la descripción.

**H16 · Bajo · Dueño multi-residencia · `/residence/dashboard`** — Tarjetas con «0 nuevas / 0 pendientes / 0 abiertos» repetidas ×4, sin bandeja unificada de «qué requiere mi atención hoy» entre residencias (el panel por residencia sí la tiene: «Para hacer hoy»). Agregar una franja resumen arriba.

**H17 · Medio · Admin · `/admin/dashboard`**
- No hay métricas del embudo de preapertura (preinscriptos, con consentimiento comunidad, familiares invitados, cupo de fundadoras X/10, tiempo sin contactar) en el dashboard; el feed de «Actividad reciente» son 8 líneas idénticas «Estudiante se registró… desde la preapertura» sin identificar quién (no accionable). Agrupar («8 registros en las últimas 3 h») y mostrar cupo y solicitudes de alta sin contactar.
- Naming confuso en el menú: «Solicitudes de alta» (fundadoras), «Residencias pedidas» (pedidos de estudiantes), «Solicitudes» (de reserva), «Propuestas familiar».
- «Revocaciones sin resolver · la más vieja espera hace 24 días» (la política de revocación es de 10 días): marcar visualmente como vencida de SLA.

### Copy, tono y confianza

- Positivo: ninguna aparición de «mediación» ni «reserva garantizada» en `app/` y `components/` (solo advertencias y legales de «no garantiza»); voseo consistente; avisos «Sujeta a confirmación de la residencia / responde en hasta 48 horas»; tabla «Con EstuRed vs. por fuera» honesta.
- **H18 · Bajo [OP]:** «Reservá y pagá desde donde estés» (hero de la landing y `/preregistro` de fondo) puede leerse como que se paga en EstuRed; el flujo real es pago a la residencia + fee. Cambiar por «Solicitá y coordiná desde donde estés».
- **H19 · Bajo:** «Abrir WhatsApp» en la tarjeta de llegada de Lucía es un botón manual `wa.me` (cumple la regla de no integrar la API); aclarar que abre la app del estudiante y que el mensaje es un borrador.

## 3. Lo que funciona bien

- Popup de preapertura: jerarquía clara, un solo CTA primario, «Sumarte es gratis, sin tarjeta, sin compromiso», mobile con CTA sobre el pliegue, fondo inerte.
- `/search`: filtros con histograma de precio, «Comunidad activa», mapa/lista/grilla, aclaración «Disponibilidad informada por la residencia». Sin scroll horizontal a 375 px.
- Ficha: precios USD con ARS referencial y tipo de cambio, 3 pasos de «qué pagás y a quién», Soporte visible, comunidad real de la residencia con consentimiento.
- Panel de residencia: bloque «Para hacer hoy» y próximos ingresos/salidas.
- Estados vacíos y copy de estados vencidos/revocados accionables («escribinos a Soporte»).

## 4. Quick wins vs. cambios de fondo

Quick wins (ciclo chico): H5, H3 (copy de «#N» y variante de `/mi-lugar`), H4 (próximos pasos), H11 (agrupar), H13 (texto duplicado y frase confusa), H14 (línea de privacidad), H15 (leyendas y fecha de ingreso en filas), H17 (agrupar feed), H18/H19 (copy), H2 (excluir seed/test de conteos públicos), normalizar nombres demo (Lucia/Lucía, mail del tutor).

Decisión de producto del dueño: H6 (transparencia sobre Sin Fronteras), H1 (qué muestra el fondo en preapertura y SEO), H10 (lógica del stepper/hitos), H8 (CTA de lista de espera en la solicitud), unificación de vocabulario de estados entre roles (H15), H7 (regla de conteo).

## 5. No auditado

- Sofía (staff) y superadmin: no entré con ellos (el selector actual no incluye a Sofía por el cambio de etiquetas).
- Flujos que mutan: enviar solicitud, pagar, confirmar, negociación y envío de formularios de preapertura (solo vi estados y formularios vacíos).
- Producción y staging remoto: no tocados; los contadores y seeds corresponden a `estured-dev`.
- Contraste/foco con herramienta automática y lector de pantalla: solo comprobaciones programáticas puntuales (inert/aria-hidden, `h1`).
- Derivar a `depurador`: H7 (conteo 42/43) y la latencia de la ficha («Cargando la residencia…», probablemente compilación dev).
