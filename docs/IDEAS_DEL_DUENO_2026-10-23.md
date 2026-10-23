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
