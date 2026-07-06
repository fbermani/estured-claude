# 13_CLAUDE_PROJECT_INSTRUCTIONS.md

# Instrucciones de Proyecto para Claude Code — EstuRed

**Versión:** 0.2 (reducida)
**Estado:** Reescrito para eliminar duplicación con 00/03/04/06/07/10/11/12
**Última actualización:** 2026-06-27

---

## 0. Qué es y qué NO es este documento

Este documento define **cómo debe trabajar Claude Code**, no **qué debe construir**.

Las reglas de negocio, estados, permisos, modelo de datos, endpoints, pantallas, arquitectura y plan de fases viven en sus propios archivos (`00` a `12`). Este documento no las repite.

**Si necesitás saber una regla de negocio, un estado, un permiso o una decisión de producto: no está acá, está en el archivo correspondiente.** Repetir esas reglas en dos lugares es lo que genera contradicciones (72h vs 48h, "mediación" vs "soporte", fee en ARS vs ARS/USD, etc.) — esa es justamente la razón por la que este archivo se recortó.

---

## 1. Orden de lectura

1. `00_DECISION_LOG.md`
2. `01_PRODUCT_BRIEF.md`
3. `02_MVP_SCOPE.md`
4. `03_BUSINESS_RULES.md`
5. `04_STATE_MACHINES.md`
6. `05_ROLES_AND_PERMISSIONS.md`
7. `06_DATA_MODEL.md`
8. `07_API_SPEC.md`
9. `08_UI_SCREENS_AND_FLOWS.md`
10. `09_ADMIN_PANEL_SPEC.md`
11. `10_PRIVACY_AND_LEGAL_RULES.md`
12. `11_TECH_ARCHITECTURE.md`
13. `12_BUILD_PLAN.md`
14. `13_CLAUDE_PROJECT_INSTRUCTIONS.md` (este documento)

No saltear documentos. Si una instrucción de un archivo posterior parece contradecir una decisión anterior, detenerse y pedir aclaración — no resolver la contradicción por criterio propio.

## 2. Jerarquía documental ante contradicción

1. Decisiones consolidadas (`00_DECISION_LOG.md`) prevalecen sobre interpretaciones nuevas.
2. Reglas de negocio (`03`) prevalecen sobre preferencias de UI.
3. Máquinas de estado (`04`) prevalecen sobre nombres visuales.
4. Roles y permisos (`05`) prevalecen sobre accesos convenientes.
5. Privacidad/legal (`10`) prevalece sobre velocidad de desarrollo.
6. El alcance MVP (`02`) prevalece sobre ideas futuras.

**Ningún otro documento declara prevalencia propia: si un archivo afirma prevalecer sobre `00_DECISION_LOG.md`, esa cláusula es inválida.**

Si dos archivos activos se contradicen entre sí (no debería pasar tras esta auditoría, pero puede ocurrir en actualizaciones futuras), Claude Code debe detenerse y señalar la contradicción explícitamente, no elegir una versión silenciosamente.

---

## 3. Modo de trabajo obligatorio: fases pequeñas

Antes de implementar, Claude Code debe:

1. Identificar qué documentos aplican a la tarea puntual.
2. Resumir qué va a tocar (archivos, entidades, estados).
3. Confirmar dependencias con módulos ya construidos.
4. Implementar la menor unidad funcional coherente.
5. Ejecutar validaciones o tests posibles.
6. Explicar qué cambió.
7. Indicar riesgos o pendientes.

**Correcto:** crear tablas de solicitud → crear server actions → crear UI → crear tests de estados → conectar notificaciones, como pasos separados.

**Incorrecto:** implementar búsqueda, solicitudes, pagos, comprobantes y admin en una sola iteración.

---

## 4. Protocolo para resolver ambigüedades

Cuando falte una regla o haya duda, clasificar:

**Ambigüedad bloqueante** — afecta pagos, reservas, privacidad, legal, estados o permisos. Preguntar antes de avanzar. No asumir.

**Ambigüedad no bloqueante** — permite avanzar con un supuesto reversible. Proponer un default, marcarlo explícitamente como supuesto, y seguir.

**Ambigüedad visual** — no afecta lógica de negocio. Resolver con una solución simple y consistente con el design system, sin preguntar.

Claude Code nunca debe inventar reglas de negocio sensibles bajo ninguna de las tres categorías.

---

## 5. Protocolo para actualizar documentación durante la construcción

Si durante la construcción surge una decisión nueva o una ambigüedad que requiere resolución de producto:

1. No implementarla silenciosamente.
2. Marcarla como propuesta.
3. Explicar el impacto (qué archivos, qué entidades, qué riesgos).
4. Pedir aprobación explícita.
5. Actualizar el/los documento(s) correspondiente(s) primero.
6. Recién después implementar.

Documentos con mayor probabilidad de requerir actualización durante la construcción: `03`, `04`, `05`, `06`, `07`, `08`, `10`, `11`, `12`. Si la actualización toca reglas de negocio o privacidad, tratarla como ambigüedad bloqueante (sección 4).

---

## 6. Definition of Done

Una tarea está terminada solo si:

- Respeta los documentos del proyecto sin contradecirlos.
- Usa los estados oficiales de `04_STATE_MACHINES.md`, no strings libres.
- Respeta los permisos de `05_ROLES_AND_PERMISSIONS.md`.
- Tiene validaciones server-side (nunca solo en cliente).
- Tiene auditoría si la acción es crítica.
- No expone datos sensibles.
- Maneja loading, empty y error.
- Maneja el caso de permiso denegado.
- No rompe rutas existentes.
- Tiene prueba o validación manual documentada.
- Deja claros los pendientes y supuestos asumidos.

---

## 7. Prompts base reutilizables

### 7.1. Iniciar una sesión nueva

```text
Estás trabajando en EstuRed, una webapp responsive para residencias
estudiantiles en CABA. Antes de implementar, leé los documentos del
proyecto en /docs en el orden de 13_CLAUDE_PROJECT_INSTRUCTIONS.md
sección 1.

No inventes reglas de negocio, estados, permisos ni flujos. Si algo
es ambiguo y bloqueante, preguntá antes de avanzar (ver sección 4).
Implementá por fases pequeñas (ver sección 3). Toda acción crítica
debe auditarse. Separá siempre: propuesta del familiar, solicitud,
negociación de condiciones, pago a residencia, fee EstuRed, reserva,
factura fiscal y comprobante — nunca fusionar estas entidades.

Ahora vamos a trabajar en: [DESCRIBIR TAREA].

Primero resumí qué documentos aplican, qué entendiste, qué archivos
vas a tocar y qué dudas bloqueantes existen. Después proponé un plan
corto antes de escribir código.
```

### 7.2. Revisar cambios

```text
Revisá los cambios implementados contra los documentos del proyecto.
Verificá especialmente: reglas de negocio (03), máquinas de estado
(04), permisos (05), modelo de datos (06), privacidad (10), pagos y
facturación fiscal, auditoría, disponibilidad, lista de espera y
renovaciones. Indicá cualquier contradicción, omisión o riesgo antes
de continuar.
```

### 7.3. Agregar una nueva feature

```text
Antes de agregar esta feature, clasificála como Must Have, Should
Have, Could Have o Later según 02_MVP_SCOPE.md. Indicá qué documentos
afecta, qué entidades modifica, qué permisos requiere, qué estados
toca, qué riesgos legales/privacidad/pagos existen, y si debe
actualizarse algún archivo de documentación antes de implementar
(ver sección 5 de este documento).
```

### 7.4. Trabajar en UI

```text
Implementá la pantalla siguiendo 08_UI_SCREENS_AND_FLOWS.md y
respetando 03_BUSINESS_RULES.md, 04_STATE_MACHINES.md y
05_ROLES_AND_PERMISSIONS.md. Incluí estados loading, empty, error y
permission denied cuando apliquen. No muestres estados técnicos al
usuario (traducir a lenguaje humano). No expongas datos sensibles.
```

### 7.5. Trabajar en backend

```text
Implementá la operación backend siguiendo 06_DATA_MODEL.md y
07_API_SPEC.md. Toda transición crítica debe validarse server-side
y auditarse. No permitas que el cliente cambie estados sensibles
directamente. Usá DTOs seguros. No expongas documentos o datos
sensibles fuera de contexto.
```

### 7.6. Trabajar en pagos y facturación

```text
Implementá la lógica de pagos siguiendo 03_BUSINESS_RULES.md,
04_STATE_MACHINES.md, 07_API_SPEC.md y 11_TECH_ARCHITECTURE.md.
Separá pago a residencia, fee EstuRed y factura fiscal. El fee debe
ser idempotente, abstracto por PaymentProvider (MercadoPago + PayU),
calculado sobre snapshot_final, y no debe confirmar reserva hasta
estar paid. La factura fiscal (TusFacturas.app) se emite recién
después del fee pagado, y su falla no bloquea la reserva. No emitas
comprobante antes de reserva confirmada.
```

### 7.7. Trabajar en admin panel

```text
Implementá esta parte del admin panel siguiendo
09_ADMIN_PANEL_SPEC.md. Toda acción crítica debe pedir confirmación,
motivo cuando aplique, y crear audit log. El admin puede intervenir
operaciones trabadas, pero no debe saltarse reglas críticas sin
dejar evidencia y motivo explícito.
```

---

## 8. Regla final

Claude Code debe construir EstuRed como producto operativo, no como demo.

La calidad del MVP depende menos de la cantidad de pantallas y más de la consistencia entre reglas de negocio, estados, permisos, privacidad, auditoría, operación admin, pagos, facturación y experiencia clara para estudiante y residencia.

Si una decisión parece conveniente para el código pero contradice el modelo de negocio, no debe implementarse sin aprobación explícita.
