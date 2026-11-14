# EstuRed — Auditoría de UX mediante recorrido de usuarios demo

**Fecha:** 14 de noviembre de 2026. **Entorno:** desarrollo local, `http://localhost:3000`.
**Entrega:** diagnóstico priorizado y evidencia; no se implementaron correcciones de producto.
**Autor:** Codex. **Referencia git durante el recorrido:** rama `staging`, `571a105`; al guardar el informe también se observó `cfab7d4`, incorporado por otra sesión. El checkout estuvo compartido y no fue una instantánea inmutable.

## Resultado ejecutivo

La búsqueda, la ficha y la separación entre solicitud, pago a residencia, fee y comprobante tienen una base clara. La recuperación de búsquedas sin resultados, la conservación del tipo de habitación al iniciar sesión y las explicaciones de confirmación son buenos puntos del recorrido.

Los problemas más importantes aparecen al gestionar información: una promesa de privacidad incorrecta, residentes inaccesibles desde la administración, contadores que no coinciden con la lista que abren y tareas pendientes ocultas entre formularios de configuración.

**12 hallazgos: 2 P1, 8 P2 y 2 P3. Ningún P0 confirmado en los estados recorridos.** Esto no acredita todos los estados ni reemplaza una prueba de punta a punta con casos nuevos y fechas vigentes.

| Orden | ID | Prioridad | Problema | Perfil afectado | Esfuerzo orientativo |
|---:|---|---|---|---|---|
| 1 | UX01 | P1 | Dirección declarada «privada» que se publica en la ficha | Residencia | Bajo |
| 2 | UX02 | P1 | Comunidad admin corta en 300 sin búsqueda ni paginación | Admin | Medio |
| 3 | UX03 | P2 | «4 activas» mientras los estados visibles corresponden a casos cerrados/confirmados | Admin | Medio |
| 4 | UX04 | P2 | «1 en ventana» abre Renovaciones sin elementos | Residencia | Medio |
| 5 | UX05 | P2 | Una pregunta sin responder aparece después de ~9.300 px de contenido | Residencia | Bajo/medio |
| 6 | UX06 | P2 | El panel presenta completar el 100 % del perfil como paso previo para solicitar | Estudiante | Bajo |
| 7 | UX07 | P2 | El último paso de solicitud no repite el desglose económico | Estudiante | Bajo/medio |
| 8 | UX08 | P2 | La residencia no puede revisar los valores que envió a aprobación | Residencia | Medio |
| 9 | UX09 | P2 | El dashboard admin mezcla pendientes y métricas; algunas tareas no tienen acceso directo | Admin | Bajo/medio |
| 10 | UX10 | P2 | La lista de espera dice que no hay lugares aunque otro tipo tiene disponibilidad | Estudiante | Bajo |
| 11 | UX11 | P3 | «6 fees cobrados» incluye uno reintegrado; el importe excluye ese reintegro | Admin/SuperAdmin | Bajo |
| 12 | UX12 | P3 | La vista del familiar usa copy dirigido al estudiante y repite aclaraciones | Familiar | Bajo |

Los esfuerzos indican tamaño relativo, no compromisos de plazo.

**Criterio de prioridad:** P0 = bloqueo crítico general; P1 = problema de confianza o tarea operativa inaccesible que conviene resolver antes de una beta externa; P2 = fricción relevante, información contradictoria o mala orientación; P3 = claridad y pulido. La prioridad es una evaluación del impacto; no proviene de métricas de conversión ni de estudios con usuarios reales.

## Alcance y método

Se inició sesión mediante «Simular usuario» con **Camila, Lucía, Valentina, Martín, Ricardo, Admin Operativo y SuperAdmin**, además del recorrido como visitante. Se probaron escritorio **1280 × 900** y móvil emulado **375 × 812**.

El registro conserva **106 estados válidos por etiqueta y 80 URLs distintas**, incluyendo filtros, pestañas y un control 404. El inventario de 94 archivos de página registra 68 rutas con recorrido directo y nueve aliases cuyo destino fue recorrido; el resto tiene límites documentados. Estos números no equivalen a completar todas las acciones: varias pantallas comparten URL o muestran un detalle dentro del panel.

Se combinaron navegación real, apertura de formularios sin enviarlos, inspección visual, árbol de accesibilidad, medidas del DOM y lectura puntual del código para explicar contradicciones. Se usaron los criterios de Impeccable, revisión de diseño y accesibilidad. No se asigna un puntaje global artificial ni se certifica WCAG.

- [Matriz completa de cobertura y pendientes](evidence/ux-2026-11-14/COBERTURA.md).
- [Índice navegable de estados y capturas](evidence/ux-2026-11-14/INDICE.md).
- [Registro estructurado de recorridos](evidence/ux-2026-11-14/recorridos-validos.json).
- [Mediciones de apoyo](evidence/ux-2026-11-14/mediciones.json).

### Qué se recorrió por perfil

| Perfil | Recorrido principal | Límite relevante |
|---|---|---|
| Visitante | Preapertura, preregistro estudiante/familiar, fundadoras y formulario, login/recuperación, registro, búsqueda/filtros/mapa, ficha, comunidad, guías, legales, verificación de comprobante | Sin crear cuentas, aceptar acuerdos ni enviar emails |
| Camila | Panel, perfil, solicitudes y detalle vencido, favoritos, espera, soporte, vínculo/residencia, revocación; solicitud hasta paso 2; espera por tipo completo | Sin enviar solicitud, aceptar reglamento ni anotarse en una lista |
| Lucía | Panel, estadía, cambio de habitación, renovación/listado/detalle y comprobante | Sin modificar estadía ni registrar pagos |
| Valentina | Panel, perfil y protecciones de menor; ficha de residencia con rango de edad publicado | Sin nueva solicitud ni confirmación del familiar |
| Martín | Panel familiar, vínculos y seguimiento de estadía/checklist; vista móvil | Datos compartidos alterados temporalmente por tests de otra sesión; ver límites |
| Ricardo | Selector de residencias, panel, solicitudes con detalle integrado, habitaciones, disponibilidad, residentes/alta, renovaciones, espera, FAQ, reglamento, perfil, equipo, soporte y plan | Gestión profunda sobre Norte; no se repitió cada configuración en todas las casas |
| Admin | Las 20 secciones del menú, pestañas de Actividad, revocación y formulario de resolución, documentos, usuarios y soporte | Sin aprobar/rechazar, moderar, bloquear ni cambiar permisos |
| SuperAdmin | Dashboard, pagos pendientes/cobrados y datos de cobro | Sin guardar información bancaria ni tocar permisos |

## Hallazgos detallados

### UX01 · P1 · La dirección se declara privada, pero se publica

**Hecho observado.** Ricardo → Norte → Editar perfil: «Dirección completa», con ayuda **«Privada. Escribinos si necesitás corregirla.»**. La ficha pública muestra exactamente esa dirección bajo el nombre y nuevamente en Ubicación y el mapa. La publicación está expresamente prevista en el código; el defecto es la explicación al dueño.

**Impacto.** La residencia toma decisiones con una expectativa de privacidad incorrecta. Puede interpretar que está entregando un dato interno cuando ya forma parte de su ficha pública.

**Cambio recomendado.** Corregir la ayuda a algo como «Se muestra en tu ficha pública. Para corregirla, escribinos a Soporte». Mantener el criterio de publicación vigente; ocultar la dirección sería una decisión de producto distinta.

**Aceptación.** El dueño puede identificar qué dirección se publica y cómo corregirla; ningún texto la describe como privada. Comparar el mismo valor en edición y ficha, con y sin sesión.

**Reproducción/evidencia:** Ricardo → Norte → Editar perfil → Datos; luego abrir la ficha como visitante. [Captura del campo](evidence/ux-2026-11-14/88-direccion-privada-contradiccion.jpg), [perfil](evidence/ux-2026-11-14/87-perfil-residencia-recheck.md), [ficha](evidence/ux-2026-11-14/08-ficha-visitante-mobile.md).

**Código:** `app/residence/[residence_id]/profile/ResidenceProfileForm.tsx:580`–584; `profile/page.tsx:121`; `app/(public)/residencias/[slug]/page.tsx:272`–274 y 560. **Confianza: alta.**

### UX02 · P1 · No se puede llegar a todos los residentes desde Comunidad admin

**Hecho observado.** Admin → Comunidad presenta exactamente **300 filas**, sin búsqueda, filtro, paginación ni aviso del recorte. Norte y Río de la Plata no aparecen, aunque sus comunidades sí existen en las vistas recorridas. En móvil la tabla requiere desplazamiento horizontal dentro de un área de 308 px para 895 px de contenido.

**Causa corroborada.** La consulta ordena por creación descendente y aplica `.limit(300)`; la página no recibe parámetros de búsqueda o página. La limitación no es solo el esfuerzo de recorrer una lista larga: deja registros fuera de esta herramienta de moderación.

**Cambio recomendado.** Búsqueda en servidor por persona/residencia, filtro de estado y paginación; mostrar total y rango visible. Conservar acciones contextualizadas e identidad de la fila al desplazarse. Aumentar el límite solamente posterga el problema.

**Aceptación.** Buscar un residente conocido de Norte y otro de Río devuelve sus filas sin depender del orden de creación; se puede recorrer más allá de 300, con estados vacío/error y contexto de residencia. Verificar también móvil y teclado.

**Evidencia:** [vista desktop](evidence/ux-2026-11-14/60-community.jpg), [móvil](evidence/ux-2026-11-14/91-admin-comunidad-mobile.jpg), [medición de alcance](evidence/ux-2026-11-14/94-comunidad-alcance.json). **Código:** `app/admin/community/page.tsx:32`–44. **Confianza: alta.**

### UX03 · P2 · El número de solicitudes activas no representa los estados visibles

**Hecho observado.** Admin → Solicitudes muestra **«4 activa(s) de 15»**. Las filas visibles aparecen vencidas, revocadas, finalizadas o como una reserva confirmada. No se distinguen las cuatro que demandarían seguimiento activo.

**Causa corroborada.** El contador excluye una lista de estados persistidos. Las etiquetas de fila pasan por `getVisibleStatus`, que considera reserva y vencimientos efectivos. Se usan criterios diferentes para el resumen y la lista.

**Cambio recomendado.** Definir el mismo universo para indicador y filtro de activas según los estados oficiales. Si se necesita otra métrica, nombrarla expresamente y ofrecer una vista que explique sus integrantes. No resolverlo contando el texto renderizado ni inventando estados.

**Aceptación.** El número de activas coincide con las filas del filtro correspondiente antes/después de un vencimiento, una conversión a reserva y una revocación. No depende de que un job haya actualizado previamente la fila.

**Evidencia:** [revalidación de las 15 filas](evidence/ux-2026-11-14/93-admin-solicitudes-recheck.md). **Código:** `app/admin/applications/page.tsx:21`, 62 y 78. **Confianza: alta.**

### UX04 · P2 · El indicador de renovaciones abre una lista vacía

**Hecho observado.** Ricardo → Norte → Residentes muestra **«1 en ventana»** con acceso a Renovaciones; el destino no muestra renovaciones para gestionar.

**Causa corroborada.** El indicador cuenta pedidos pendientes y ofertas enviadas/vistas por residencia. La pantalla destino parte de reservas confirmadas y busca sus renovaciones. Además, «en ventana» nombra un período temporal que el contador no calcula.

**Cambio recomendado.** Unificar la elegibilidad entre contador y destino. Nombrar la métrica por lo que mide: pedidos/ofertas pendientes, o una ventana calculada realmente. Si hay un caso histórico no accionable, mostrarlo como tal y explicar su estado, siguiendo las reglas existentes.

**Aceptación.** Con el mismo conjunto de datos, cada unidad del contador lleva a un elemento identificable; al vencer/revocar una reserva no queda una tarea fantasma. Verificar cero, pedido pendiente y oferta enviada.

**Evidencia:** [Residentes](evidence/ux-2026-11-14/41-norte-residentes-mobile.md), [Renovaciones vacío](evidence/ux-2026-11-14/43-norte-renovaciones-mobile.md). **Código:** `app/residence/[residence_id]/residents/page.tsx:76`–91; `app/residence/[residence_id]/residents/ResidentsBrowser.tsx` (KPI «en ventana»); `app/residence/[residence_id]/renewals/page.tsx:37`–43. La divergencia entre consultas está confirmada; no se modificó ningún registro para corregirla. **Confianza: alta.**

### UX05 · P2 · La pregunta pendiente queda detrás de la configuración del catálogo

**Hecho observado.** Norte tiene una pregunta sin responder. Entrar a Preguntas abre primero explicaciones y editores del catálogo. A 375 × 812, «Preguntas de visitantes» comienza en **y ≈ 9.091 px** y «Sin responder» en **y ≈ 9.371 px**, sin enlace de salto en el contenido. La página mide unos 10.299 px en el estado inicial observado.

**Impacto.** El aviso de una tarea lleva a una pantalla de configuración; obliga a buscar el pendiente entre decenas de controles. Aumenta la posibilidad de que la consulta quede sin atender.

**Cambio recomendado.** Mostrar «Sin responder · 1» antes del catálogo o separar «Consultas de visitantes» y «Preguntas de mi ficha» en pestañas. El acceso desde un contador debe llevar al pendiente. Mantener independientes las preguntas del catálogo, las fijas del perfil y las de visitantes, explicando su función.

**Aceptación.** Desde el aviso, la pregunta pendiente y su acción se encuentran en la primera pantalla o con un acceso claramente visible; el catálogo sigue disponible sin bloquear la tarea.

**Evidencia:** [entrada móvil](evidence/ux-2026-11-14/83-pregunta-pendiente-recheck.jpg), [pregunta al final](evidence/ux-2026-11-14/84-pregunta-pendiente-al-final.jpg), [mediciones](evidence/ux-2026-11-14/mediciones.json). **Código:** `app/residence/[residence_id]/faq/page.tsx:154` ubica visitantes después del catálogo. **Confianza: alta.**

### UX06 · P2 · El perfil completo parece un requisito para empezar a solicitar

**Hecho observado.** Camila y Valentina, con perfil al 44 %, ven «Completá tu perfil para pedir residencia», «Paso 1 de 6» y faltantes como documento de identidad/comprobante de estudio. Sin completar esos documentos, Camila puede abrir una solicitud y llegar al paso 2; allí se dice correctamente que completar el perfil ayuda a que la residencia la conozca.

**Impacto.** El panel puede hacer que el estudiante postergue su búsqueda para reunir documentación que no bloquea esa etapa. La contradicción existe entre mensajes; no se concluye que toda validación de solicitud esté ausente.

**Cambio recomendado.** Separar requisitos reales de solicitud y recomendaciones para fortalecer el perfil. Si puede empezar, indicar «Podés buscar y solicitar; completá tu perfil para que te conozcan mejor». No exigir documentos adicionales como solución de copy.

**Aceptación.** Un perfil incompleto pero elegible entiende que puede avanzar. Un teléfono faltante o vínculo obligatorio de menor tiene una explicación específica. El progreso conserva sentido cuando todas las solicitudes anteriores están cerradas.

**Evidencia:** [panel de Camila](evidence/ux-2026-11-14/10-camila-dashboard-mobile.md), [Valentina revalidada](evidence/ux-2026-11-14/81-valentina-recheck.md), [solicitud paso 2](evidence/ux-2026-11-14/20-camila-solicitud-paso2.md). **Código:** `lib/students/journeyStage.ts:79`–88; `ApplyForm.tsx` documenta y muestra el porcentaje como ayuda no bloqueante. **Confianza: alta sobre el mensaje; impacto estimado por evaluación heurística.**

### UX07 · P2 · Falta un resumen económico al final de la solicitud

**Hecho observado.** El paso 1 muestra un desglose; al pasar a «Sobre vos»/reglamento solo queda un resumen como **«Doble, USD 187/mes · Ingreso 02/03/2027, 6 meses»**. El fee, el pago inicial y el depósito no se repiten junto a la acción final. En móvil, la hoja favorece que el usuario solo tenga a la vista este segundo paso.

**Cambio recomendado.** Agregar una revisión compacta de tipo/fechas y montos estimados, con destinatarios separados y acceso a editar. Reutilizar los cálculos existentes y explicar qué queda sujeto a confirmación. La solicitud sigue siendo gratuita: no introducir un pago ni nuevas condiciones en este paso.

**Aceptación.** Antes de enviar se pueden distinguir pago a residencia, fee EstuRed y depósito sin retroceder; cambiar tipo/meses actualiza el resumen y volver conserva lo ya ingresado.

**Evidencia:** [paso 2](evidence/ux-2026-11-14/20-camila-solicitud-paso2.jpg), [árbol del formulario](evidence/ux-2026-11-14/20-camila-solicitud-paso2.md). **Código:** `app/(public)/residencias/[slug]/ApplyForm.tsx`, resumen del paso 2 y pie de envío. **Confianza: alta sobre la ausencia; recomendación heurística, sin abandono medido.**

### UX08 · P2 · Los cambios enviados a aprobación no se pueden revisar

**Hecho observado.** En el perfil de Norte se informa «Mínimo de estadía · enviado el 02/11/2026» y se aclara que los campos muestran los valores publicados, **«no los que enviaste»**. Se evita una mentira de estado, pero la residencia no puede consultar en esa vista qué valor propuso.

**Cambio recomendado.** Mostrar comparación de publicado → enviado, fecha y estado, en lectura. Reutilizar el modelo de comparación que el admin ya tiene. Las posibilidades de editar/reemplazar una propuesta pendiente deben seguir la regla documentada.

**Aceptación.** Al regresar días después o con otro integrante autorizado, se sabe qué dato está pendiente y cuál sigue publicado; guardar otros campos no induce a creer que se perdió la propuesta.

**Evidencia:** [banner y formulario](evidence/ux-2026-11-14/87-perfil-residencia-recheck.jpg); comparación admin en [Ediciones de perfil](evidence/ux-2026-11-14/53-profile-edits.md). **Código:** `app/residence/[residence_id]/profile/ResidenceProfileForm.tsx:484`–488. **Confianza: alta.**

### UX09 · P2 · El dashboard no lleva siempre del pendiente a la tarea

**Hecho observado.** El panel muestra una verificación pendiente, una revocación de 24 días y cuatro ediciones de perfil pendientes. La tarjeta de ediciones dice «Requiere acción» pero no tiene el «Ver detalle» que otras tarjetas sí ofrecen. En móvil las métricas y los pendientes se apilan y la revocación queda después de indicadores generales.

**Cambio recomendado.** Una sección inicial de pendientes con acceso directo, antigüedad y motivo de prioridad. Mantener las métricas generales después. Toda tarjeta con «Requiere acción» debe llevar a su lista filtrada. La política de orden/SLA debe respetar las reglas existentes; los 24 días son un dato demo, no prueba de incumplimiento real.

**Aceptación.** Se llega en una acción a las cuatro ediciones pendientes; revocaciones y verificaciones se reconocen sin recorrer métricas generales, en 375 y 1280 px.

**Evidencia:** [dashboard móvil](evidence/ux-2026-11-14/52-admin-dashboard-mobile.jpg), [SuperAdmin](evidence/ux-2026-11-14/62-superadmin-dashboard.md). **Código:** `app/admin/dashboard/page.tsx:147`–164; la tarjeta de ediciones carece de `href`. **Confianza: alta sobre navegación; orden propuesto por criterio heurístico.**

### UX10 · P2 · La lista de espera generaliza el estado de un tipo de habitación

**Hecho observado.** En Wanna Tango, Individual muestra disponibilidad informada a USD 420/mes; Doble, Triple y Cuádruple figuran completas. Al tocar «Lista de espera» en Doble, el panel preselecciona bien ese tipo, pero afirma **«No hay lugares disponibles en este momento»** sin limitar la frase a Doble.

**Impacto.** Parece que la residencia entera está completa, contradiciendo la alternativa que el usuario acaba de ver. El panel inicial tampoco ofrece una explicación breve de los tipos completos: solo lista el Individual solicitable.

**Cambio recomendado.** Vincular el mensaje al tipo elegido («Doble: completa») y, si corresponde, indicar que hay otros tipos con disponibilidad informada. Con «Cualquiera», evitar afirmar un estado global que no se calculó. Mantener visible la separación entre lista de espera, solicitud y reserva.

**Aceptación.** Probar residencia parcialmente completa, totalmente completa y cambio de tipo dentro de la espera. El mensaje coincide con el alcance de la selección y no promete una plaza.

**Evidencia:** [ficha con estados mixtos](evidence/ux-2026-11-14/100-ficha-tipos-completos.md), [formulario de espera](evidence/ux-2026-11-14/101-lista-espera-formulario.md). **Código:** `app/(public)/residencias/[slug]/JoinWaitlistForm.tsx:48` contiene la afirmación incondicional. Revisar también la frase equivalente en `ProposeForm.tsx`. **Confianza: alta.**

### UX11 · P3 · El resumen de pagos mezcla cantidad histórica e importe vigente

**Hecho observado.** Pagos → Cobrados muestra **«6 fee(s) cobrados — ARS 596.000 en total»**. La tabla contiene cinco cobrados y un reintegrado de ARS 59.500. El importe mostrado excluye correctamente el reintegrado; la cantidad incluye las seis operaciones.

**Cambio recomendado.** Explicitar «5 cobrados · 1 reintegrado» y qué representa el importe. Es un problema de denominación del resumen, no una prueba de cálculo contable incorrecto. No sumar el reintegro al total para hacer coincidir visualmente seis filas.

**Aceptación.** Con pagos cobrados y reintegrados, cada número se puede reconciliar con su estado y con el alcance temporal del listado.

**Evidencia:** [historial de pagos](evidence/ux-2026-11-14/64-superadmin-cobrados.md). **Código:** `app/admin/payments/PaidFeesView.tsx:45`–59: consulta ambos estados, totaliza solo `paid` y rotula `rows.length` como cobrados. **Confianza: alta.**

### UX12 · P3 · El familiar recibe mensajes redactados para el estudiante

**Hecho observado.** Aunque el encabezado reconoce «Estadía de Lucia», el contenido mantiene «Tu estadía», «Ya renovaste tu estadía» y «Tus compañeros de residencia». En el dashboard se repite consecutivamente la explicación de que el checklist es de solo lectura.

**Cambio recomendado.** Usar el estudiante seleccionado como sujeto y una sola aclaración breve de alcance. Conservar las restricciones y la autonomía del estudiante: el hallazgo no implica que el familiar haya podido ejecutar acciones prohibidas.

**Aceptación.** El familiar identifica de quién es la estadía y quién debe actuar, tanto en encabezado como en tarjetas y estados. Si hay varios vínculos, cambiar de estudiante actualiza también el copy.

**Evidencia:** [estadía familiar revalidada](evidence/ux-2026-11-14/89-familiar-residencia-recheck.md), [checklist y explicaciones duplicadas](evidence/ux-2026-11-14/31-martin-dashboard-desktop.md). **Código orientativo:** `app/students/residency/page.tsx:731` y componentes compartidos de estadía/checklist. **Confianza: alta para el texto; multivínculo estable pendiente de repetir.**

## Aspectos que conviene conservar

- **Búsqueda sin resultados:** explica el vacío y ofrece quitar filtros con alternativas; no deja una pantalla sin salida. Filtros y mapa son utilizables en los dos tamaños recorridos.
- **Continuidad de la intención:** el visitante conserva el tipo de habitación al ir a login/registro mediante el retorno a la ficha. El formulario en dos pasos reduce densidad sin perder la selección.
- **Condiciones y dinero:** se distinguen pago a residencia y fee; la solicitud se comunica sujeta a confirmación. El comprobante histórico conserva sus propios datos y la verificación pública funciona sin sesión.
- **Espera:** el panel explica que anotarse no es una solicitud ni reserva un lugar y pide el mes; el tipo tocado llega preseleccionado.
- **Herramientas del dueño:** disponibilidad y camas tienen funciones diferenciadas; la edición extensa ya incluye navegación por secciones y guardado fijo. No hace falta reemplazar todo el editor para resolver UX08.
- **Revisión admin:** la comparación de ediciones y las validaciones de verificación aportan contexto; la resolución de revocación separa motivo interno, mensaje al usuario y registro del reintegro externo.
- **Privacidad contextual:** hay avisos sobre qué se comparte, estados de consentimiento y restricciones de menor. Esto describe las pantallas recorridas, no una auditoría nueva de permisos.

## Accesibilidad y móvil: evidencia y límites

En las capturas medidas no se detectó desbordamiento horizontal del documento: `scrollWidth` coincidió con 375 o 1280 px. Hay contenedores con scroll horizontal deliberado; no se reportan como un fallo global. La tabla de Comunidad conserva ese mecanismo, aunque su usabilidad queda limitada por UX02.

Se comprobó apertura/cierre del filtro móvil, cierre con Escape y retorno del foco. Los controles de texto visibles muestreados en el perfil de residencia tenían etiquetas asociadas. Las acciones muestreadas de Comunidad medían aproximadamente 50 px de alto.

La comprobación de contraste de texto sobre fondos sólidos no arrojó candidatos por debajo del umbral entre **240 elementos de FAQ, 189 del perfil y 1.203 de Comunidad admin**. Es una muestra DOM con exclusiones para gradientes, transparencias, estados deshabilitados y otros casos que requieren revisión visual. No cubre todos los textos/estados, contraste no textual ni imágenes. El detector de código aplicado únicamente a `ApplyForm.tsx` devolvió `[]`; tampoco acredita accesibilidad global.

Referencias utilizadas: [WCAG 2.2: contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [etiquetas e instrucciones](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html) y [tamaño mínimo de objetivos](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). El mínimo AA de objetivos es 24 × 24 CSS px con excepciones de separación; 44 px es una referencia más exigente, no el umbral general AA.

Quedan pendientes lector de pantalla real, zoom 200–400 %, teclado virtual, otros navegadores y revisión completa de foco/contraste en todos los diálogos. No se midieron Core Web Vitals: tiempos de compilación y carga de `next dev` no representan producción.

## Condiciones de desarrollo que no se contabilizan como defectos del producto

1. **Estados envejecidos.** Muchas solicitudes demo ya estaban cerradas o vencidas. No se fabricaron reservas/pagos nuevos para llenar estados faltantes. Hay que renovar fixtures con fechas relativas antes del próximo pase de punta a punta.
2. **Trabajo concurrente.** Durante el recorrido otra sesión ejecutó tests y cambios de seguridad sobre el mismo checkout/base dev. Se observaron residencias «Test Integración» y vínculos temporales; luego se revalidaron pantallas principales. También se incorporó DR48 (apertura de documentos por la residencia): su acceso nuevo no quedó validado de punta a punta en navegador. No se atribuyen estos cambios de cantidad o vinculación a un bug de UX.
3. **Demo familiar.** El selector describe a Martín como familiar de Valentina; en la revalidación estable su estadía consultable correspondía a Lucía. Esto limita la reproducibilidad del caso menor/familiar y requiere ordenar la preparación de demos, no cambiar permisos para hacer coincidir una captura.
4. **Staff ausente.** La documentación menciona Sofía, pero el selector expone siete usuarios. Staff con/sin permisos queda pendiente; no se inventaron credenciales ni se alteró el selector.
5. **Interrupciones locales.** Se recuperó el servidor/pestaña cuando hubo interrupciones del entorno. Un 404 transitorio de `/for-students` quedó descartado tras verificar el enlace correctamente. `/students/family-proposals` abierto directamente como familiar no se considera un enlace roto observado.
6. **Fotos demo.** «Foto próximamente» está previsto; no se confunde con un error de carga confirmado. Los widgets «solo dev» tampoco se evalúan como si fueran la interfaz pública final.
7. **Cifras de ocupación.** «Residentes cargados», residentes activos, plazas y camas fuera de servicio no son el mismo universo. No se declara inconsistencia solo por comparar 34 cargados con 29 activos.
8. **Preapertura y legales.** El fondo inerte muestra la app futura y las páginas legales avisan que son borradores. Antes de una demostración externa debe verificarse el copy/los contadores con datos adecuados; no se concluye que seeds o borradores locales estén publicados en producción.

### Decisión de producto a revisar, sin imponer una regla nueva

Valentina (17) puede abrir el formulario de una ficha que informa «De 18 a 26 años», y el panel recomienda residencias «Desde 18». Conviene decidir cómo anticipar esa condición al solicitar según la edad a la fecha de ingreso. El recorrido **no prueba** que exista una prohibición automática por rango ni que haya que bloquear, ocultar o rechazar al estudiante: eso debe contrastarse con las reglas oficiales. No se cuenta como fallo de autorización ni como uno de los 12 hallazgos confirmados.

## Orden recomendado de trabajo

**Lote 1 — Confianza y tareas alcanzables:** UX01 + UX02. Corregir la descripción de la dirección y dar acceso al universo completo de Comunidad. Verificación con visitante, dueño y admin, desktop/móvil.

**Lote 2 — Coherencia operativa:** UX03 + UX04 + UX05 + UX09. Unificar contadores y listas; llevar los avisos a tareas concretas y priorizar pendientes. Usar casos vigentes, vencidos y revocados con el mismo reloj de prueba.

**Lote 3 — Decisión del estudiante y feedback al dueño:** UX06 + UX07 + UX08 + UX10. Aclarar requisitos, repetir los importes al revisar, mostrar propuestas enviadas y contextualizar la espera por tipo.

**Lote 4 — Pulido:** UX11 + UX12 y repetición del recorrido familiar con fixtures estables.

Antes de cerrar una beta: preparar un caso coherente de solicitud completa, otro de renovación, una espera con respuesta vigente y un menor con vínculo estable; repetir el recorrido con un staff limitado. La [matriz de cobertura](evidence/ux-2026-11-14/COBERTURA.md) enumera las rutas sin visita directa y los envíos pendientes.

## Verificación técnica y conservación del trabajo

- `npm run typecheck`: **OK**.
- `npm run build`: **OK**, con advertencias existentes. Se detuvo el servidor dev antes del build y se volvió a iniciar después.
- `npm run lint`: **no pasó**: siete errores y 51 advertencias. Los siete errores se concentran en el archivo existente `docs/audits/evidence/2026-11-14/repro-actions.cjs` (`no-require-imports` y `no-assign-module-variable`), de la evidencia de seguridad. No se modificó ese archivo para encubrir la validación.
- No se ejecutó la suite de integración: este trabajo agrega documentación/evidencia y evita crear/borrar filas compartidas. Los checks anteriores no prueban los flujos de UX pendientes.
- No se implementaron fixes de interfaz, cambios de reglas, migraciones, deploy, commit ni push. Se conservaron los cambios concurrentes.

Este documento complementa el archivo existente `AUDITORIA_UX_2026-11-14.md` mediante un recorrido con evidencia persistida. No lo sobrescribe ni adopta automáticamente sus conclusiones.

## Instrucción de traspaso para Claude

Leer primero este informe y la matriz de cobertura. Reproducir UX01 y UX02 en el checkout actual antes de editar: los datos y las líneas pueden haber cambiado. Implementar por lotes pequeños, conservar reglas/permisos/entidades y no tocar producción. En cada corrección verificar el criterio de aceptación y registrar evidencia nueva. Las sugerencias de copy no autorizan crear SLA, nuevas exigencias documentales ni decisiones de admisión.
