# Salida a producción de «pesos y pago» (DR72–DR74)

**Estado al 2026-11-27:** plan armado. Nada enviado. Nada publicado en `main`.
Texto de los mails: `AVISO_TERMINOS_2026-11-27.md`. `[FECHA]` sigue sin completar.

`main` = `4f82924`. `staging` revisado = `16961d0`.

## Decisiones pendientes

1. ~~¿Las 2 cuentas de prod son tus pruebas?~~ **Sí** (dueño, 2026-11-27).
   - No hay destinatarios reales. Los mails no condicionan la fecha.
   - Recuento 18:33: sin cambios (`terms` 2, `residence_terms` 0).
2. Fecha de vigencia. Recomendada: hoy, 27/11.
   - Coincide con la fecha visible en `/terms`.
   - Publica todo `staging` de una vez, incluido el popup.
   - Antes: recontar y validar el commit exacto.
3. Fecha visible en `/terms`. Dirá «27 de noviembre»; el mail dirá `[FECHA]`.
   - Los consentimientos nuevos guardarán `2026-11-27` desde la publicación.
   - Recomendación: dejarla. Es la fecha del cambio.
4. Publicar antes de la fecha mails, footer y copys.
5. Publicar el popup nuevo. Teclado sin probar en teléfono real.

Nota: en preapertura rige la sección «Términos de la preapertura» de `/terms`.
El resto aplica al abrir.

## Destinatarios en prod (SQL de solo lectura, 2026-11-27)

| `consent_type` | Personas | Mail |
|---|---|---|
| `terms` | 2 (rol estudiante) | 1 |
| `residence_terms` | 0 | 2: sin destinatarios |

- Cuentas con ambos: 0.
- Solicitudes de residencia: 2, ambas `discarded`. Sin consentimiento.

## Envío propuesto (requiere tu OK)

- Cupo Resend: 100 por día. Usados al consultar: 13. Se reinicia 20:59 (Argentina).
- Cupo mensual: 13 de 3000.
- Canal: conector de Resend, un envío por persona. Reemplaza la copia oculta.
- Para enviar, leo en prod las direcciones. Hasta hoy solo conté.
- Alternativa: los mandás vos desde `hola@`, con copia oculta.
- Remitente `EstuRed <no-reply@estured.com>`, respuesta a `hola@estured.com`.
- Plantilla con la marca (`lib/email/layout.ts`).
- Primero una prueba a `hola@`. Después el envío. Después control de entrega.
- Con más de 70 destinatarios: tandas de 70 por día. Quedan 30 para mails automáticos.
- La fecha debe ser posterior a la última tanda.

## Antes de la fecha (opcional)

Sin migraciones ni cambios en `/terms`. Ramas locales, armadas desde `main`.

| Opción | Commit | Incluye | Validado |
|---|---|---|---|
| A | `f9e3b57` (`publicar/web-sin-popup-2026-11-27`) | Mails, footer, copys | typecheck, lint, build, 43 tests |
| B | `bf98b95` (`publicar/web-2026-11-27`) | A + popup y campos (DR75) | typecheck, lint, build, 67 tests |

- Ninguna se vio en una URL. Sin suite completa.
- Las dos contienen `publicar/mails-2026-11-27` (`89f8544`), de otra sesión.
- Usá un solo comando: A o B. No hace falta publicar la rama de mails aparte.
- Si esa rama o `main` avanzan, [Yo] rearmo y valido.
- Popup: otra sesión sigue activa. Commits posteriores a `16961d0` quedan fuera.
- `docs/00` en B queda como en la rama de mails. DR75 llega con `staging`.

Pasos:

1. [Yo] Confirmo que `main` sigue en `4f82924`.
2. [Vos] Corré **uno** de los dos:

```bash
git push origin f9e3b57:main
```

```bash
git push origin bf98b95:main
```

3. [Vos] Pegá en Supabase `docs/mail/recuperar-contrasena.html` de ese commit.
4. [Yo] Mergeo `main` en `staging` y pusheo. Simulado con B: sin conflictos.

Orden de commits sobre `main`:

1. Mails (6, hasta `89f8544`).
2. Footer: `24debb8`, `803a092`.
3. Copys y banderas: `7a568f2`, `173e78d`, `cf80a1e`, `58db926`.
4. Solo B: `7e23978`, `adfc509`, `6b98145`, `2516f07`, `2a6a416`, `16961d0`.

## Solo en la fecha

Commits de «pesos y pago», ya en `staging`:
`038f5dd`, `93a8758`, `d5883f9`, `e8ca556`, `6ed5f8f`, `ebe3fb8`.

1. [Yo] Cuento destinatarios otra vez. Envío a quienes se registraron después, con tu OK.
2. [Yo] Verifico que `staging` contiene `main`.
3. [Yo] Listo lo que haya sin terminar en `staging`. Si hay algo, armo una rama.
4. [Yo] Valido el commit exacto en un worktree limpio, con la suite completa.
5. [Vos] `git push origin <commit validado>:main`. Publica todo hasta ese commit.
6. [Yo] Verifico en `estured.com` `/terms` y `/terms/residencias`.

- Migración 0112: aplicada en prod.
- El runbook marca sin cargar el secreto del cron en Vault. Sin él, el cron no se prueba.
- Cron y push en dispositivo: sin probar.
- *Instant Rollback* también devuelve los textos legales anteriores.

## Verificación del 2026-11-27

| URL | `/terms` | `/terms/residencias` |
|---|---|---|
| `estured.vercel.app` | 27 de noviembre, con «queda fija» | 27 de noviembre |
| `estured.com` | 25 de noviembre | 22 de noviembre |
