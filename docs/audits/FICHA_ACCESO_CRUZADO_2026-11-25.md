# Ficha de acceso cruzado (control 09)

Objetivo: probar que A no lee ni modifica datos de B, y que un anónimo no entra.
Entorno: https://estured.vercel.app contra `estured-dev`. Nunca producción con datos reales.

## 1. Anónimo: hecho el 2026-11-25

Pedidos GET sin sesión, sin seguir redirecciones, con IDs en cero.

| Ruta | Resultado | Estado |
|---|---|---|
| `/students/`: dashboard, applications, applications/{id} (+ fee, negotiation), receipts/{id} (+ pdf), renewals/{id}, followup/{id}, profile | 307 a `/login?next=…` | OK |
| `/residence/`: dashboard (+ pdf), {id}, applications (+ detalle), residents, collection, team | 307 a `/login?next=…` | OK |
| `/admin/`: dashboard, users, payments, logs, documents, residences/{id} | 307 a `/login?next=…` | OK |
| `/api/cron/expire-stale-records` | 503 «CRON_SECRET no configurado» | OK: cierra por defecto. Probar 401 en producción |

No cubierto: server actions y escrituras por HTTP. La base directa se auditó con SQL el 2026-11-21.

## 2. A contra B: pendiente

Prepará dos ventanas privadas. Usá cuentas demo.

- A y B: dos estudiantes.
- R1 y R2: dos dueños de residencias distintas.

Anotá en B (o R2) la URL completa de cada recurso. Pegala en la sesión de A (o R1).
Pasa si ve «no encontrado», redirige o rechaza. Falla si ve cualquier dato ajeno.

| # | Actor | URL ajena | Esperado | Obtenido | OK |
|---|---|---|---|---|---|
| 1 | A | `/students/applications/{id de B}` | sin datos | | |
| 2 | A | `/students/applications/{id de B}/fee` | sin datos | | |
| 3 | A | `/students/applications/{id de B}/negotiation` | sin datos | | |
| 4 | A | `/students/receipts/{id de B}` | sin datos | | |
| 5 | A | `/students/receipts/{id de B}/pdf` | sin archivo | | |
| 6 | A | `/students/renewals/{id de B}` | sin datos | | |
| 7 | A | `/students/followup/{id de B}` | sin datos | | |
| 8 | A | `/residence/{id de R1}/applications` | rechazo | | |
| 9 | A | `/admin/dashboard` | rechazo | | |
| 10 | R1 | `/residence/{id de R2}` | rechazo | | |
| 11 | R1 | `/residence/{id de R2}/applications/{id}` | sin datos | | |
| 12 | R1 | `/residence/{id de R1}/applications/{id de R2}` | sin datos | | |
| 13 | R1 | `/residence/{id de R2}/residents` | rechazo | | |
| 14 | R1 | `/residence/{id de R2}/collection` | rechazo | | |
| 15 | R1 | `/admin/payments` | rechazo | | |
| 16 | Staff sin `payments.residence` | `/residence/{id propio}/collection` | rechazo | | |
| 17 | Familiar sin vínculo | `/students/applications/{id de B}` | sin datos | | |

La fila 12 importa: mezcla un ID propio con uno ajeno.

## 3. Cierre

- Fecha y quién probó:
- Commit desplegado:
- Fallas encontradas (con captura, sin datos personales):
