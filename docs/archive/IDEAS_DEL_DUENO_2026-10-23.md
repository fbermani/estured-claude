# Ideas y reglas del dueño — 2026-10-23 (pendientes de diseñar e implementar)

Fuente: mensaje del dueño. No son reglas vigentes todavía: cada punto pasa por el protocolo de `docs/13` §5 (docs primero, código después) cuando se priorice. Las decisiones se le plantean al dueño de a una.

## 1. "Mes vacío" (reserva en diferido) configurable en la ficha de registro de la residencia
- Al cargar los datos de la residencia, esta elige **si cobra o no "mes vacío"** (reserva con ingreso diferido: p. ej. reserva en octubre para enero).
- Se le explica que, si cobra, debe elegir **a qué porcentaje** se cobran esos meses y que **esos meses se descuentan de la disponibilidad** para evitar reservas duplicadas.
- Estado actual: el modelo ya tiene `empty_month_charge_percent` (docs/06, migración 0024/0025) con un tope de 3 meses en el cálculo; falta el flujo guiado, la explicación y el descuento de disponibilidad.

## 2. Sin prorrateo de tarifa por fecha de ingreso
- Por ahora **no hay forma de fraccionar la tarifa** según el día de ingreso. La residencia debe entenderlo al configurar su ficha.
- El estudiante selecciona solo **mes de ingreso** y **cantidad de meses** (según el mínimo establecido por la residencia).
- Al estudiante se le aclara que **la fecha exacta de ingreso se acuerda con la residencia una vez hecha la reserva** y que cualquier fracción de tarifa se acuerda de forma particular con el establecimiento.

## 3. Reglamento de la residencia con modelo estándar
- En la sección de reglas/reglamento habrá un **archivo modelo** basado en el reglamento completo del dueño, que cada residencia puede adaptar (aplicando cambios) y que sirve de estándar para las que no tengan.
- Alternativa: si no quieren usar el modelo, un **multiple choice** con las reglas básicas más usuales e importantes.
- Insumo pendiente del dueño: el reglamento original.

## 4. Preguntas frecuentes sugeridas
- Un **catálogo de preguntas frecuentes comunes** a casi todas las residencias; cada residencia **elige cuáles mostrar** y completa o complementa la respuesta (cada pregunta trae una **respuesta sugerida** editable).
- Objetivo: que el estudiante o la familia **no tengan dudas y casi nunca deban contactar a la residencia**.
- Se suma a la FAQ simple ya implementada (D9: pregunta libre que responde la residencia). Ver `docs/08` §7.16 (catálogo de preguntas predefinidas, hoy fuera de alcance).

## 5. Edad mínima y máxima de los residentes (2026-10-25) — DECIDIDA (DR14, 2026-10-25; registrada en `docs/00` §31)
- **Decisión:** mínima 18 años cumplidos; si la residencia habilita expresamente menores (supuesto reversible) aparece un apartado especial para menores (guardián, `docs/05`/DR3b). La edad se calcula a la fecha de ingreso solicitada (supuesto reversible). Sin fecha de nacimiento cargada el filtro no excluye y se pide completar el perfil.
- Cada residencia elige la **edad mínima y máxima** de sus residentes.
- Funciona como **filtro de búsqueda**: al estudiante solo le aparecen residencias compatibles con su edad.
- A definir al diseñarlo: qué pasa con la edad de quien está dentro de un grupo familiar o con menores (guardián), y cómo se calcula la edad (a la fecha de ingreso).

## 6. Seguimiento automático después del ingreso (2026-10-25) — DECIDIDA (DR14, 2026-10-25; registrada en `docs/00` §31)
- **Decisión:** a los 5 días del ingreso (a) la residencia recibe un recordatorio para consultar por su cuenta; (b) EstuRed pregunta al estudiante cómo va todo y si era lo esperado; (c) la residencia NO ve la respuesta; (d) el admin decide después si comunica algo. Supuestos reversibles: «ingreso» = inicio efectivo en `resident_stays`; una encuesta por estadía; respuestas solo para admin/superadmin; si el estudiante es menor, también se pregunta al guardián.
- Una semana después de cada ingreso: **recordatorio automático a la residencia** para que consulte cómo va la estadía, y/o **mensaje automático de la plataforma al estudiante** ("¿cómo va todo hasta ahora? ¿era lo que esperabas?").
- A definir: plazo exacto, si el mensaje al estudiante registra respuesta, y qué ve la residencia de esa respuesta (privacidad).

## 7. Reglamento modelo y FAQ (insumo recibido: "Reglamento 2026-1.pdf") — DECIDIDA (DR14, 2026-10-25; registrada en `docs/00` §31)
- **Decisión:** el estudiante accede al reglamento completo y ACEPTA los términos (reglamento) al enviar la solicitud. Cada residencia sube/edita su reglamento o parte del modelo (`docs/propuestas/REGLAMENTO_MODELO_Y_FAQ.md`, Parte A y multiple choice); el modelo es base para quien no tiene. Supuestos reversibles: se guarda la aceptación con versión/hash y fecha por solicitud; si la residencia cambia el reglamento, las solicitudes ya aceptadas conservan la versión aceptada; sin reglamento propio se muestra el modelo. FAQ: lista única (Parte B); cada residencia elige cuáles mostrar y edita la respuesta sugerida.
- El dueño aportó su reglamento. Se arma un **reglamento modelo** (base o guía; las residencias lo adaptan o complementan).
- Del reglamento y de preguntas comunes se arma **una única lista de preguntas frecuentes publicable**; cada residencia elige cuáles mostrar y edita la respuesta sugerida.
- Preguntas semilla del dueño: ¿visita presencial o virtual? · ¿puede ingresar cualquiera? · ¿qué es la matrícula de ingreso? · ¿requisitos para ingresar? · ¿hay un responsable en la residencia? · ¿hay toque de queda? · ¿se permiten visitas? · ¿qué tengo que llevar?
