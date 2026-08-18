# QA-41 — Estado local listo para deploy

**Fecha:** 2026-08-18
**Commit local:** `e9a521e` (sin push — pendiente de créditos Netlify + autorización)
**Working tree:** limpio

## Qué se hizo
- Conversión de todas las rutas `(app)` a Server Component-first (page.tsx servidor
  con `*-client.tsx` islands) para resolver regresión CSP sin `window.location.reload()`.
- Eliminado `AppShell` anidado en `auth-guard.tsx` (causa raíz del **doble menú**).
- Alineado breakpoint sidebar `md→lg` con `MobileNav lg:hidden` (sin solapamiento 768–1023px).
- Padding equilibrado en `AppShell` (`pb/pt` con `safe-area`, sin anulación por `pb-safe`).
- Estandarización de **todos** los botones de acción al estilo "Guardar deuda"
  (`Button` gradiente) y centrados (formularios, listas, analytics, transactions,
  dashboard, settings).
- "Ver tarjetas y deudas" / "Administrar deudas" ajustados a `w-auto` (tamaño del texto).
- Tabla "Últimos movimientos" en **3 columnas** (tipo | desc+fecha | monto a la derecha),
  sin divisiones visibles.

## Validación (build final, CSP estricta, viewport 1264px)
| Ruta | Menú | Datos | Botones | Notas |
|---|---|---|---|---|
| /dashboard | 1 | ✅ $9,199.00 | ✅ gradiente+centrados | tabla 3 col, monto der. |
| /accounts | 1 | ✅ | ✅ | Crear/Editar/Eliminar centrados |
| /transactions | 1 | ✅ | ✅ | Desc/Asc, Limpiar, Editar/Eliminar |
| /debts | 1 | ✅ | ✅ | "Guardar deuda" centrado |
| /analytics | 1 | ✅ | ✅ | rango 3/6/12 meses gradiente |
| /categories | 1 | ✅ 21 cat | ✅ | Crear/Editar/Eliminar |
| /budgets | 1 | ✅ | ✅ | Crear presupuesto |
| /goals | 1 | ✅ | ✅ | Crear meta |
| /settings | 1 | ✅ | ✅ | Cerrar sesión gradiente |

- `tsc --noEmit`: 0 errores
- `npm run lint`: 0 errores (10 warnings preexistentes)
- `npm run build`: EXIT 0

## Para deploy (cuando haya créditos)
1. Autorizar `git push origin main`.
2. Netlify auto-despliega (OpenNext ya configurado, sin `netlify.toml`).
3. Verificar en producción.

## Notas
- El dev server en :3000 del usuario es anterior a estos cambios; reiniciarlo
  (`Ctrl+C` + `npm run dev`) para verlos localmente, o usar el server de validación.
- Servers zombies de QA en puertos 3100–5900 fueron marcados con taskkill pero
  permanecen en LISTENING (zombies del SO, inofensivos). No afectan el trabajo.
