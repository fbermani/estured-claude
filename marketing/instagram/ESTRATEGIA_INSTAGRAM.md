# Estrategia de marketing e Instagram de EstuRed

Documento vivo. Se actualiza al cerrar cada etapa. Última actualización: 2026-11-25.
Fuentes: `docs/23_PREAPERTURA.md`, `design-proposals/voz-y-tono/GUIA_DE_VOZ.md`, `design-proposals/identidad-marca-2026-10-30/SPEC.md`. Ante contradicción manda `docs/00_DECISION_LOG.md`.

## Estado de las etapas
| Etapa | Estado |
|---|---|
| 1. Identidad | Reabierta en lo visual (2026-11-25): brand kit en validación (`BRAND_KIT.md`) |
| 2. Bio y perfil | Cerrada (hay una propuesta de segundo link) |
| 3. Historias destacadas | Cerrada (2026-11-25): seis destacadas y 29 historias (`HISTORIAS_DESTACADAS.md`) |
| 4. Posteos | Cerrada (2026-11-25): 12 piezas aprobadas (`GUIONES_Y_POSTS.md`); producción en `PRODUCCION.md` |
| 5. Éxito desde el día 1 (hashtags, interacción, métricas, lanzamiento, automatización) | En validación |

## 0. Contexto y decisiones del dueño
- **Cuenta:** Instagram nueva, todavía no creada. Hay que crearla ya para ponerla en el formulario de fundadoras y en el footer (`docs/23` §9 la deja pendiente).
- **Dominio para la bio:** `estured.com` (provisorio; el repo hoy usa `estured.vercel.app`).
- **Publicidad en Meta:** dirigida a estudiantes que buscan alojamiento en Buenos Aires (el público más fácil de encontrar).
- **Objetivo:** captar preregistros de estudiantes y familias y, como consecuencia del tráfico, la atención de residencias fundadoras. Reparto **60/40**: 60% estudiantes y familias, 40% relato de EstuRed y propuesta a residencias.
- **Público principal:** estudiantes y familias del interior de Argentina y de Latinoamérica. Dos perfiles: quienes **no pueden viajar** antes (elegir a distancia) y quienes **sí pueden** (saber cuáles visitar y que todo quede registrado).
- **Propuesta a residencias:** gestión y administración, facilidades, hacer las cosas mejor, **previsibilidad, anticipación y mejor comunicación**. Se dice "residencias fundadoras", nunca "pioneras", "beta" ni "MVP".
- **Identidad:** faceless, joven y dinámica. Capturas reales de la app, tipografía cinética y motion graphics.
- **Recursos:** lo hace una sola persona. Objetivo: automatizar lo más posible (recomendaciones en Etapa 5). Sin fecha de lanzamiento definida.
- **Líneas rojas:** no mostrar ni nombrar residencias; no mostrar precios; no mencionar Sin Fronteras (`docs/23` §5); no decir que se verifican personas ("EstuRed verifica a las residencias").
- **Competidores y referentes:** referentes de nicho: Casa Rica, Wanna, Palo Alto, Casaires. Competencia real: boca a boca, grupos de Facebook, Marketplace, inmobiliarias, **Instagram y Google** como canales de búsqueda actuales de los estudiantes.

### Decisiones del 2026-11-25
- **Sin personajes animados:** restan seriedad y suman complejidad.
- **Tres carruseles fijados:** uno para familias, uno para estudiantes y uno para residencias.
- **Material:** capturas reales de escritorio y celular. En preapertura solo se ve el popup.
- **Familias:** leen todo. Los textos apuntan a ellas: empatía, guías, listas y acompañar sin decidir.
- **Estudiantes:** velocidad visual, filtros, transiciones, diseño y comunidad.
- **Residencias:** menos consultas, ficha propia, previsibilidad y lista de espera.
- **Piezas:** al menos 6 además de las fijadas. Reels con capturas, zoom, sonido claro y relato conciso.
- **Fuera de uso:** guiones v1 (`archivo/`), `assets/ilustraciones/` y el agente `ilustrador`. No se borraron.

## 1. Identidad
### Propuesta de valor
**Lema:** "Elegí tu residencia en Buenos Aires con todo a la vista." (el dueño votó esta opción; "sin ir a ciegas" descartado).
**Línea de apoyo (bio):** "Residencias visitadas en persona y todo tu proceso registrado."

### Personalidad y tono
- Tres rasgos: cercana, clara y seria. Hablamos de adulto a adulto con jóvenes que se mudan solos y con familias que acompañan sin decidir por ellos. Humor mínimo y siempre sobre situaciones.
- Voseo, frases cortas, hechos antes que adjetivos. Humor sobre situaciones, no sobre el miedo.
- Familias: tono más tranquilo ("seguís cada paso, la decisión es de tu estudiante").
- No hacemos: prometer disponibilidad ("garantizado", "asegurado"), decir "mediación", dramatizar, lunfardo fuerte. Detalle: guía de voz §4, §5, §7.

### Pilares de contenido
| Pilar | Peso | Qué es |
|---|---|---|
| 1. Mudarse con todo claro | 30% | Educativo y de guardado: qué preguntar al visitar, costos, alertas, checklist |
| 2. Llegar a Buenos Aires | 20% | Barrios, trámites, transporte (reutiliza el Centro de Guías) |
| 3. Convivencia y vida independiente | 10% | Comunidad, reglas y acompañamiento. Tono de adulto a adulto; nunca infantilizar ni apelar a "mamá/papá" |
| 4. Cómo funciona EstuRed | 25% | Capturas de la app, proceso, "enviar tu solicitud de reserva es gratis", comprobante |
| 5. Hacer las cosas mejor | 15% | Para dueños: previsibilidad, anticipación, mejor comunicación, residencias fundadoras. Sin nombrar ninguna |

### Lineamientos visuales
- La fuente única es `BRAND_KIT.md`: colores, tipografía, elementos, movimiento, sonido y tono.
- Base: tokens de la app. Se suma el naranja `#c0521d` para ganchos. Se retira la arena `#f1d9a8`.
- Capturas con datos de ejemplo, precios difuminados y rótulo «Así va a funcionar».
- **Logo definitivo:** casa con R y cama (`assets/logo/`). Marca única: **EstuRed**. El módulo de gestión queda fuera.
- Colores propios del logo y el avatar: `#252A31`, `#F0EAE3`, `#1A1F26`, `#F0EAE4`, `#A89484`, `#B09D8F`.
- Regla de copy: "fee EstuRed (5%)", nunca "comisión".

## 2. Bio y perfil (cerrada)
- **Usuario:** `@estured.residencias` (`@estured` no está disponible y `.ar` limitaría la expansión). Verificar disponibilidad y reservar la misma variante en TikTok y YouTube.
- **Nombre del perfil:** EstuRed | Residencias estudiantiles en Buenos Aires (51 caracteres; el campo es buscable).
- **Bio final (135 caracteres):**
```
Reservá tu residencia en Buenos Aires con todo a la vista.
Visitadas en persona. Proceso registrado.
Sumate gratis y enterate primero ↓
```
- **Riesgo aceptado por el dueño (2026-11-11):** "reservá" en el lema, para que la gente no vea las residencias "seguras" y reserve por fuera. Choca con "solicitud sujeta a confirmación" (guía de voz §4). Mitigación: en el resto del contenido y en los anuncios nunca decir "reserva garantizada", "asegurada" ni "inmediata"; aclarar "solicitud sujeta a confirmación" en piezas de proceso, y llevar la validación legal de "reservá" a la lista del asesor.
- **CTA:** "Sumate gratis y enterate primero ↓".
- **Link:** `estured.com/?utm_source=instagram&utm_medium=bio` (en producción lleva a `/preregistro`).
- **Propuesta 2026-11-25:** sumar un segundo link «Soy residencia» a `/fundadoras`, con su UTM.
- **Cuenta:** profesional (empresa), categoría de servicios de alojamiento o educación; necesaria para pautar en Meta.

## 3. Historias destacadas (cerrada)
Historia por historia: `HISTORIAS_DESTACADAS.md`.
Seis destacadas, nombres de hasta 11 caracteres. Portadas: círculo oscuro `#252A31` con ícono lineal crema y detalle arena; "Verificadas" en verde forest `#1f7d5c` como acento de confianza. Las destacadas se arman con historias ya publicadas: subirlas primero. Lanzar con las seis cargadas (3 a 5 historias cada una).

| # | Nombre | Ícono | Objetivo | Contenido sugerido |
|---|---|---|---|---|
| 1 | Cómo funciona | Escalera de pasos | Entender el proceso en 30 s | Pasos del flujo con capturas de la app (nombres y precios difuminados): perfil, solicitud, contacto, pago, comprobante |
| 2 | Costos | Signo $ | Sacar la duda de la plata | "Enviar tu solicitud de reserva es gratis"; qué se paga a la residencia; fee EstuRed (5%, sin contar el depósito); a quién y cuándo |
| 3 | Guías | Libro abierto | Atraer por utilidad | Una historia por guía del Centro de Guías, con enlace |
| 4 | Familias | Casa con dos figuras | Hablarle a quien acompaña | Qué ve y qué hace el familiar; privacidad; "la decisión es de tu estudiante" |
| 5 | Verificadas | Casa con tilde (verde) | Confianza | Cómo se verifica una residencia en persona, sin nombrar ninguna |
| 6 | Fundadoras | Casa con estrella | Atraer dueños | Previsibilidad, anticipación y mejor comunicación; cupo real de fundadoras; cómo sumarse |

Propuesta 2026-11-25: portadas en forest oscuro `#0c3a2c` en lugar de `#252A31`.

Fee verificado el 2026-11-25: «sin contar el depósito» coincide con `docs/03` §13.2 y con la app. Pendiente cerrado.

Notas: "Fundadoras" reemplaza a "Residencias" para no sugerir un listado de residencias para mirar. Mantener coherencia con la regla de `docs/23` §6 (cupo real, sin escasez fabricada). Si el programa de fundadoras termina, renombrar.

## 4. Plan de posteos (cerrada)
Detalle y textos: `GUIONES_Y_POSTS.md`. Producción, una pieza por chat: `PRODUCCION.md`. Sin fechas: solo orden y contenido.

| Grupo | Piezas |
|---|---|
| Fijados | P1 familias, P2 estudiantes, P3 residencias (carruseles) |
| Estudiantes | P4 filtros, P7 ficha por dentro, P9 comunidad (reels) |
| Familias | P5 verificación, P8 checklist, P11 acompañar, P12 pagos (carruseles) |
| Residencias | P6 consultas repetidas, P10 lista de espera (reels) |

- Total: 12 piezas, 7 carruseles y 5 reels. Residencias: 3 de 12.
- Historias: una por día, en cinco series.
- Comunidad: motivo para sumarse, no promesa central.
- Publicar recién cuando el link de la bio abra el popup en producción.
- Ritmo: los 3 fijados juntos y luego 4 por semana.
- Meta Ads arranca **después** de las 12 piezas.

### Banco de ideas para más adelante
- Alertas al visitar una residencia.
- Barrios para estudiar.
- Errores comunes al mudarte (guía 03).
- Residencia o departamento compartido (guía 07).
- Miniacuerdo de convivencia (guía 04).

## 5. Éxito desde el día 1 (puntos 3, 4 y 5 se definen más adelante)
Decisión del dueño: métricas (5.3), plan de lanzamiento (5.4) y automatización (5.5) quedan como borrador hasta después de armar los guiones y de elegir la herramienta de producción. Los guiones están en `GUIONES_Y_POSTS.md`.

### 5.1 Hashtags y búsqueda
- Instagram funciona como buscador: pesa más la **palabra clave en el texto, el nombre del perfil y el texto en pantalla** que el hashtag. Usar pocos hashtags (3 a 5) por post, en el final del texto.
- Combinar: 1 de marca (`#EstuRed`), 2 de nicho (`#ResidenciaEstudiantil`, `#EstudiarEnBuenosAires`), 1 a 2 del tema del post (`#MudarseABuenosAires`, `#VidaUniversitaria`, etc.).
- Volúmenes y variantes se **verifican dentro de Instagram** antes de fijarlos; no se inventan cifras.
- Palabras clave a repetir en textos y voz en off: residencia estudiantil, estudiar en Buenos Aires, mudarse a Buenos Aires, estudiante del interior, familias.

### 5.2 Rutina de interacción (20 a 30 min por día)
1. Primera hora tras publicar: responder todos los comentarios (con una pregunta cuando se pueda).
2. Responder mensajes directos del día; guardar las preguntas repetidas como ideas de posts.
3. Comentar con valor en 5 a 10 cuentas del nicho: los 4 referentes, universidades, centros de estudiantes, cuentas de mudanza y vida universitaria.
4. Seguir de forma activa a cuentas de estudiantes del interior y de Latinoamérica; no seguir en masa ni comprar seguidores.
5. Historias: una encuesta o caja de preguntas por semana.

### 5.3 Métricas (Insights nativos; la cuenta es profesional)
Se juzgan por señales de calidad, no por seguidores:
| Métrica | Para qué |
|---|---|
| Envíos (compartidos por mensaje) por alcance | La señal que más mueve el alcance a no seguidores |
| Guardados | Utilidad del contenido (carruseles) |
| Retención y tiempo de reproducción en reels | Si el gancho funciona |
| Visitas al perfil y toques en el link | Intención |
| Preregistros por UTM (`utm_source=instagram`, un `utm_content` por post) | Resultado real |
- No inventar referencias: **las bases se miden en las primeras 4 semanas** y recién ahí se fijan metas.
- Revisión semanal de 20 min: los 2 mejores y los 2 peores posts, qué se repite, qué se corta.

### 5.4 Plan de lanzamiento
| Fase | Qué se hace |
|---|---|
| Preparación | Reservar usuario en Instagram, TikTok y YouTube; crear la cuenta profesional; cargar avatar, bio y link; capturas desde el Preview de `staging` con datos de ejemplo; producir las 12 piezas y las historias de las 6 destacadas |
| Apertura | Publicar y fijar P1 a P3; historias diarias; armar las 6 destacadas con esas historias |
| Semanas 1 a 3 | P4 a P12 a 4 por semana; rutina de interacción diaria |
| Después de las 12 piezas | Arrancar Meta Ads: tráfico al preregistro, público de estudiantes que buscan alojamiento en Buenos Aires; probar 2 a 3 piezas ya publicadas |
- **Medición (2026-11-25):** el píxel de Meta con consentimiento y la captura de UTM ya están en `staging` (migración 0106, aplicada en dev). Faltan en producción: seguir `docs/PLAN_SALIDA_PRODUCCION.md`, «Medición». No hay API de conversiones.
- **Pendiente de la app:** `AttributionCapture` y el píxel solo están en `app/(preapertura)/layout.tsx`. Un link a `/guias` con UTM no guarda la atribución.
- Pautas y anuncios: nunca "reserva garantizada/asegurada/inmediata" (riesgo de "reservá" ya registrado en §2).

### 5.5 Automatización (el dueño hace todo solo)
| Tarea | Cómo automatizarla |
|---|---|
| Escribir guiones, textos y variantes | Claude Code a partir de este documento, las guías del repo y la guía de voz |
| Videos con motion graphics | HyperFrames o Remotion (ya hay un video de lanzamiento en `video/`); plantillas reutilizables por formato |
| Carruseles | Plantilla HTML con marca renderizada a imágenes 4:5; Claude llena el contenido |
| Capturas de la app | Script de Playwright sobre el Preview de `staging`, con datos de ejemplo y precios difuminados |
| Programar publicaciones | Meta Business Suite (gratis), por lotes: un día fijo de producción por semana |
| Informe semanal | Exportar Insights y que Claude arme el resumen; tarea programada si se quiere |
| Respuestas frecuentes | Banco de respuestas guardadas en Instagram (respuestas rápidas) |
| Opcionales para más adelante | Publicación por la API de Instagram y respuestas automáticas por palabra clave en mensajes: sirven, pero requieren configuración y revisión de Meta; solo si el volumen lo justifica |
- Tiempo realista: un bloque semanal de producción por lotes (guiones, render, programación) más 20 a 30 min diarios de interacción.
- Lo que no se automatiza: comentar y responder con criterio, decidir qué sigue según métricas, y revisar legal/voz antes de publicar.
