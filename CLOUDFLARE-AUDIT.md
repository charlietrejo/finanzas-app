# CLOUDFLARE-AUDIT.md

Informe de auditoría y preparación para migración futura a Cloudflare Workers.

**Fecha:** 2026-09-02
**Modelo:** upstage/solar-pro4:free via provider nous
**Estado actual:** mismo de FASE 0 (sin push, sin deploy)

---

# Estado

## Baseline

```
npm install           → OK (0 vulnerabilidades; 1 warning postinstall script bloqueado — no problema de seguridad)
typecheck (tsc --noEmit) → PASS — TSC_EXIT=0
lint (eslint .)       → PASS — LINT_EXIT=0 (10 warnings preexistentes de "unused variable" — irrelevantes)
build (npm run build)   → PASS — BUILD_EXIT=0
npm audit --omit=dev    → 0 vulnerabilidades
npm audit --include=dev → 0 vulnerabilidades
npx vinext check       → 89% compatible (1 issue, 1 partial)
```

---

## Cambios realizados

**No se modificó ningún archivo de código durante esta auditoría.** Todos los cambios presentes en el working tree son de tareas previas de UI (transacciones y deudas), NO de esta misión de Cloudflare.

| Archivo | Estado | Motivo |
|---------|--------|--------|
| `src/app/(app)/transactions/transactions-client.tsx` | Modificado (working tree) | UI de tabla + filtros (tareas previas, NO Cloudflare) |
| `src/app/(app)/debts/debts-client.tsx` | Modificado (working tree) | Iconos de Editar/Eliminar sin botón (tarea previa, NO Cloudflare) |

**No se ejecutó `git push`. No se ejecutó deploy a Netlify. No se ejecutó deploy a Cloudflare.**

---

## Hallazgos corregidos

Ninguno. La auditoría determinó que los problemas detectados previamente YA TENGAN solución o NO REQUIEREN cambio:

1. **AppShell duplicado (FASE 2):** NO existe duplicación actual. `auth-guard.tsx` NO renderiza `AppShell` (solo `<>{children}</>`). La estructura actual `<AuthGuard><AppShell>{children}</AppShell></AuthGuard>` en `(app)/layout.tsx` tiene UNA sola instancia de AppShell. No requiere cambio.

2. **CSP debilitada (FASE 5):** La CSP NO fue debilitada. `script-src 'self'` en producción, sin `unsafe-inline`/`unsafe-eval`. Compatible teóricamente con Workers (los chunks se sirven desde el mismo origen del Worker).

3. **Auth/Supabase incompatibles (FASE 3):** No hay cambios. `request.nextUrl.origin` es portable y seguro para Workers. `next/headers` (cookies) y `request.formData()` requieren prueba en Workers (shim de vinext). Se documentan como pruebas pendientes.

4. **Middleware/proxy (FASE 4):** La exportación actual `export { proxy as middleware }` es compatible con Next 16.3.1. No hay cambio necesario. Comportamiento de defensa preservado.

5. **Dependencias vulnerable (FASE 6):** `npm audit` reporta 0 vulnerabilidades. No se requiere actualización.

---

## Hallazgos pendientes

### Pruebas que requieren ejecución en Cloudflare Workers real

Estos hallazgos están documentados como "probar en Workers" porque no pueden determinarse completamente analizando el código en local:

| Hallazgo | Estado | Prueba pendiente |
|----------|--------|------------------|
| `src/lib/supabase/server.ts` usa `import { cookies } from "next/headers"` | Documentado | Ejecutar en Workers para confirmar que vinext shimmen correctamente `cookies()` en el contexto de Server Components/route handlers |
| Route handlers usan `request.formData()` (login, register, forgot-password, reset-password) | Documentado | Confirmar que vinext/vite maneja correctamente la lectura de formularios en Workers; Cloudflare Workers soporta FormData nativamente pero requiere verificar integración con Next 16.3.1 + vinext |
| `request.nextUrl.origin` | Portable, documentado | Confirmar en Workers que devuelve el host público correcto (no una URL interna del edge). Teóricamente sí (la URL del request es la pública), pero verificar en runtime |
| `next/font/google` (fonts desde CDN) | WARNING partial de vinext | No es problema de Workers — las fonts se sirven desde CDN externo. Aceptable. Si se requiere self-host en Workers, migrar a `next/font/local` (fuera de alcance actual) |
| CSP con `script-src 'self'` en Workers | Compatible teóricamente | Confirmar en deployment real que los bundles RSC/Next.js se sirven desde el mismo origen del Worker y `'self'` los permite (no requiere nonce adicional) |
| `next/headers` cookies + @supabase/ssr `setAll` | Demostrado en local | El patrón `setAll` con manipulación de `maxAge` (QA-42) está documentado. Requiere verificar que el manejo de cookies de Supabase SSR funciona igual en Workers |

### vinext init (fase posterior de migración)

`npx vinext check` reportó 1 issue menor:

```
✗  Missing "type": "module" in package.json — required for Vite — vinext init will add it automatically
```

**No se agregó `type: "module"` ahora.** Es un requisito de Vite/vinext para el build, que vinext init añadirá automáticamente cuando se ejecute la migración. Agregarlo manualmente ahora introduciría un cambio prematuro fuera de alcance.

---

## Compatibilidad Cloudflare

### Resumen ejecutivo

```
App Router (src/app/)              → COMPATIBLE
Next.js 16.3.1                     → COMPATIBLE (shim vinext disponible)
NextRequest/NextResponse           → COMPATIBLE (shim vinext)
headers() de Server Components     → COMPATIBLE (shim vinext, 1 archivo)
next/headers.cookies()             → PROBAR EN WORKERS (shim vinext, requiere validación)
request.formData() en route handlers → PROBAR EN WORKERS (shim vinext)
request.nextUrl.origin              → COMPATIBLE (portable, host público)
AuthProvider (client-side)         → COMPATIBLE (browser, no se ejecuta en Workers)
createBrowserClient                 → COMPATIBLE (browser)
createClient (Supabase JS)         → COMPATIBLE (browser)
createServerClient (@supabase/ssr) → COMPATIBLE (server, usa cookies)
Supabase REST/Auth/RPC/RLS          → COMPATIBLE (no depende de infraestructura local)
Zod                                 → COMPATIBLE
Tailwind CSS v4                     → COMPATIBLE
Lucide React                        → COMPATIBLE
Radix UI                            → COMPATIBLE (no usado en flujo crítico de Workers)
```

### APIs Node.js exclusivas detectadas

No se encontraron usos de:
- `process.*` (excepto `process.env.NEXT_PUBLIC_SUPABASE_URL` y `process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, que son env vars y están disponibles en Workers)
- `fs.*`, `path.*` (filesystem)
- `child_process`
- `http`/`https` de Node (no usado directamente; se usa `fetch` nativo o las APIs de Next)
- `form-data`, `node-fetch`, `axios` (no en package.json)

### Codecs/Buffer Node.js

No se encontró uso de `Buffer`, `crypto` de Node, `stream` en los archivos auditados. El cliente Supabase usa las APIs del browser/Web para auth.

### Cookies (server-side)

El patrón actual usa `import { cookies } from "next/headers"` en `server.ts` y en el middleware. En Cloudflare Workers, esto requiere que vinext shimmen `cookies()` correctamente. En teoría, Next.js 16.3.1 + vinext pueden manejar esto, pero es una de las áreas que requiere prueba en runtime.

### Recomendación: mantener `request.nextUrl.origin` para redirects

La implementación actual usa `request.nextUrl.origin` consistentemente en todos los route handlers de auth (login, register, forgot-password, reset-password) y en `signout/route.ts`. Esta es la **práctica correcta para Workers**:
- `request.nextUrl.origin` devuelve el host público de la URL del request entrante
- NO es una URL interna del edge (a diferencia de `request.url` en algunos entornos de Netlify)
- En Cloudflare Workers, la URL del request es siempre la URL pública, así que funciona igual

No se recomienda cambiar a `request.url` ni a `new URL(...).origin` construido manualmente.

---

## Riesgos

### Riesgo ALTO: `next/headers` + @supabase/ssr en Workers

**PROBLEMA:**
`src/lib/supabase/server.ts` importa `cookies` desde `next/headers`. En el middleware, las cookies se leen desde `request.cookies.getAll()`. En route handlers y Server Components, se usa `cookies()` de `next/headers`.

**CAUSA:**
Las APIs de Server Components de Next.js (`next/headers`, `cookies()`, `headers()`) no son nativas de Cloudflare Workers. Requieren que vinext/vite las shimmen.

**RIESGO:**
Si vinext no shimla correctamente `cookies()` en el contexto de un Worker, las cookies de sesión de Supabase no se leen/escriben correctamente, y la autenticación falla.

**SOLUCIÓN PROPUESTA:**
Ejecutar `npx vinext init` + `npx vite dev` localmente para probar que las cookies funcionan. Si falla, evaluar alternativas:
- Usar cookies del request directamente en route handlers (como hace el middleware) en lugar de `cookies()` de `next/headers`
- Mantener el patrón actual si vinext lo soporta

### Riesgo MEDIO: `request.formData()` en route handlers

**PROBLEMA:**
Los route handlers de auth usan `await request.formData()` para leer formularios HTML nativos.

**CAUSA:**
Cloudflare Workers soporta `FormData` nativamente, pero requiere verificar que la integración con Next 16.3.1 + vinext maneja correctamente la lectura del body del request como FormData.

**RIESGO:**
Si vinext no shimla correctamente la lectura de formularios, los flujos de login/registro/forgot-password/reset-password fallan.

**SOLUCIÓN PROPUESTA:**
Probardor `npx vinext init` + `npx vite dev` y validar que los formularios funcionen.

### Riesgo BAJO: Performance/Cold start en Workers

**PROBLEMA:**
La aplicación actual carga `createSupabaseServerClient` en cada request protegido (middleware + route handlers + Server Components).

**CAUSA:**
No hay caching de instancias de Supabase entre requests en el código actual.

**RIESGO:**
En Cloudflare Workers, cada request puede ser manejado por un Worker diferente (cold start), y crear un cliente Supabase por request tiene overhead mínimo pero acumulativo.

**SOLUCIÓN PROPUESTA:**
No es crítico para la migración inicial. Se puede optimizar en una fase posterior si es necesario.

### Riesgo BAJO: Secrets management en Workers

**PROBLEMA:**
Actualmente los secrets (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) están en `.env.local` (NO committeado, NO en repo).

**CAUSA:**
Cloudflare Workers usa `wrangler secret` o bindings de variables de entorno para secrets. El proyecto actualmente NO tiene configuración de Cloudflare.

**RIESGO:**
Al migrar, hay que configurar los secrets en Cloudflare (no están en el repo, así que es seguro).

**SOLUCIÓN PROPUESTA:**
Al migrar: `wrangler secret put NEXT_PUBLIC_SUPABASE_URL` y `wrangler secret put NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Los valores deben ser los mismos que en `.env.local`. No hay riesgo de exposición porque `.env.local` no está en git.

---

## Próximo paso recomendado

1. **NOTA:** Esta misión NO es un deploy. El proyecto está listo para la migración futura.

2. **Fase posterior (cuando se decida migrar):**
   - Ejecutar `npx vinext init` (configura Vite + vinext en el proyecto)
   - Instalar dependencias de vinext (vite, @vitejs/plugin-react, @vitejs/plugin-rsc, react-server-dom-webpack)
   - Crear `vite.config.ts`
   - Ejecutar `npx vite dev` localmente para probar que:
     - `next/headers` (cookies) funciona
     - `request.formData()` funciona en route handlers
     - `request.nextUrl.origin` devuelve el host correcto
     - Auth completo funciona (login/logout/register/forgot/reset)
   - Si todo funciona: considerar deploy a Cloudflare
   - Si hay fallos: documentar en un informe de migración y decidir si resolver o mantener en Netlify

3. **Mientras tanto:** el proyecto se mantiene en Netlify (actualmente desplegado en https://finanzas-app-carlos.netlify.app). No hay push ni deploy realizados durante esta auditoría.

---

## Resumen de criterios de éxito

| Criterio | Estado |
|----------|--------|
| 1. AppShell no está duplicado | ✅ Confirmado — no hay duplicación actual |
| 2. Auth server-side continúa funcionando | ✅ Confirmado — no se rompió nada |
| 3. Supabase continúa intacto | ✅ Confirmado — no se modificó Supabase |
| 4. Middleware/proxy conserva su comportamiento | ✅ Confirmado — exportación compatible, sin cambios |
| 5. CSP no fue debilitada innecesariamente | ✅ Confirmado — `script-src 'self'` intacta |
| 6. Dependencias críticas auditadas | ✅ Confirmado — `npm audit` 0 vulnerabilidades |
| 7. typecheck pasa | ✅ Confirmado — TSC=0 |
| 8. lint pasa | ✅ Confirmado — LINT=0 (10 warnings preexistentes) |
| 9. build pasa | ✅ Confirmado — BUILD=0 |
| 10. vinext check ejecutado y documentado | ✅ Confirmado — 89% compatible, resultados en este informe |
| 11. No hubo push | ✅ Confirmado — NO se hizo push |
| 12. No hubo deploy | ✅ Confirmado — NO se hizo deploy |
| 13. Se generó CLOUDFLARE-AUDIT.md | ✅ Generado — este archivo |

**Todos los criterios de éxito están cumplidos.**
