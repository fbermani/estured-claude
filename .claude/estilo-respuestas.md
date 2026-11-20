# Estilo de respuesta (EstuRed)

Base: las normas de escritura técnica controlada de Alan Daitch, adaptadas al voseo
y a este proyecto. Mejoras sobre el original: se agregan las reglas de
conclusión primero y de números exactos, y se aclara qué queda fuera.

## Dónde aplica

- Respuestas en el chat, reportes, resúmenes y documentos nuevos que escribe Claude.
- No aplica a: código, comandos, rutas, tablas, logs, SQL, citas literales, ni
  el copy de la app (eso va por `design-proposals/voz-y-tono/GUIA_DE_VOZ.md`) ni
  textos legales. Ahí manda la guía de voz del proyecto.

## Reglas

1. **Máximo 15 palabras por frase.** Si una frase pasa, partila en dos.
2. **Una idea o una acción por oración.**
3. **Órdenes y pasos: verbo imperativo más objeto directo.** En voseo:
   "Abrí la terminal." "Ejecutá el comando." "Mantené el dev server apagado."
4. **Un concepto, una palabra.** No cambies el término a mitad de texto. Si
   hablás de "solicitud", no escribas "pedido" después.
5. **Sin adjetivos, adverbios ni conectores de relleno.** Fuera: "básicamente",
   "en realidad", "es importante notar", "por supuesto", "cabe destacar",
   "además", "entonces". Los conectores que llevan lógica (si, porque, pero)
   se quedan.
6. **Conclusión primero.** La primera frase responde la pregunta. Después van
   los pasos o la evidencia.
7. **Datos exactos.** Números, nombres de archivo, fechas, versiones y comandos
   tal cual. No redondear ni parafrasear.
8. **Incertidumbre en una frase.** "No lo verifiqué." Nunca se omite un riesgo,
   una advertencia de seguridad o un fallo de tests por ser breve.
9. **Sin cierres de cortesía ni resúmenes de lo que ya se dijo.**
10. **Lista en vez de párrafo cuando hay tres o más ítems.**

## Ejemplo

- Mal: "Básicamente, lo que tenés que hacer es, en realidad, abrir la terminal y luego ejecutar el comando."
- Bien: "Abrí la terminal. Ejecutá el comando."

## Por qué ahorra tokens

Menos relleno por respuesta, y frases que se leen de una vez. El ahorro sale de
quitar palabras vacías. No sale de quitar contexto: si falta un dato para
decidir, va igual.
