# Northstar Finance

App de finanzas personales mobile-first en MXN, instalable como PWA. Fases 1-6: Next.js + Supabase Auth + Cuentas + Transacciones + Presupuestos + Deudas + Metas de ahorro + Reportes + PWA/offline + auditoría de seguridad. Ver `requerimientos-app-financiera.md` para el alcance completo del proyecto.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- Supabase (Postgres, Auth, RLS)
- Recharts (gráficas, paleta validada con la skill dataviz — ver `src/lib/constants/chart-colors.ts`)
- Vitest + Testing Library

## Setup

```bash
npm install
cp .env.example .env.local
```

Completa `.env.local` con la URL y anon key de tu proyecto Supabase (Project Settings → API).

### Migraciones

Corre los archivos de `supabase/migrations/` en orden (001 → 013) contra tu proyecto, ya sea con el SQL Editor del dashboard de Supabase o con la CLI de Supabase (`supabase db push`).

### Desarrollo

```bash
npm run dev
```

### Pruebas

Ver `TESTING.md` para la cobertura completa (mapeada contra los casos de prueba del doc de requerimientos) y la checklist manual.

```bash
npm run test
```

Para correr toda la suite de integración contra Supabase real de una sola vez (crea y limpia usuarios de prueba automáticamente):

```bash
npm run verify:all
```

También se puede correr cada verificación por separado. Para las reglas de negocio (saldo negativo, límite de crédito, atomicidad de transferencias), crea un usuario de prueba y corre:

```bash
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
TEST_USER_EMAIL=... TEST_USER_PASSWORD=... \
node scripts/verify-transaction-rpc.mjs
```

Para verificar las reglas de presupuestos (constraint único por categoría/mes, cálculo de gastado vs. presupuestado, aislamiento entre meses):

```bash
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
TEST_USER_EMAIL=... TEST_USER_PASSWORD=... \
node scripts/verify-budgets.mjs
```

Para verificar pagos de deuda (atomicidad cuenta+deuda, rechazo si excede el saldo, reversión al eliminar) y aportaciones a metas (atomicidad cuenta+meta):

```bash
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
TEST_USER_EMAIL=... TEST_USER_PASSWORD=... \
node scripts/verify-debt-payment-rpc.mjs
node scripts/verify-goal-contribution-rpc.mjs
```

Para verificar la fórmula de patrimonio neto histórico usada en Reportes:

```bash
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
TEST_USER_EMAIL=... TEST_USER_PASSWORD=... \
node scripts/verify-reports-data.mjs
```

### PWA (íconos, manifest, service worker)

Los íconos se generan con PowerShell + `System.Drawing` (Windows only, sin dependencias npm):

```powershell
pwsh ./scripts/generate-icons.ps1
```

El service worker (`public/sw.js`) solo se activa en producción (`NODE_ENV=production`), nunca en `npm run dev`, para no interferir con el hot-reload. Para probarlo localmente:

```bash
npm run build
npm run start
```

Y luego, con el navegador apuntando a `http://localhost:3000`, verificar en DevTools → Application → Service Workers que está activo, y que `/manifest.webmanifest` responde JSON válido. "Agregar a pantalla de inicio" en iPhone requiere HTTPS real (no funciona sobre `http://localhost`), así que la prueba final en un iPhone físico solo se puede hacer una vez desplegada la app (Vercel/Cloudflare Pages).

### Auditoría de seguridad (aislamiento entre usuarios)

Con dos usuarios de prueba ya confirmados, verifica que ninguno pueda leer, insertar-referenciando, actualizar ni borrar datos del otro:

```bash
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
USER_A_EMAIL=... USER_A_PASSWORD=... \
USER_B_EMAIL=... USER_B_PASSWORD=... \
node scripts/verify-cross-user-isolation.mjs
```

## Estado

Fase 1 completa: registro/login/recuperación de contraseña, CRUD de cuentas (con catálogo de bancos MX) y CRUD de transacciones (ingreso/gasto/transferencia, con catálogo de comercios MX, categorías, etiquetas y flag de recurrente), todo con la regla de "no saldo negativo" aplicada en la base de datos vía funciones RPC atómicas.

Fase 2 completa: presupuesto mensual por categoría con navegación de mes, comparativo presupuestado vs. real con barra de progreso, alertas visuales configurables (badge de estado ok/alerta/excedido) y widget de resumen en el Dashboard.

Fase 3 completa: CRUD de deudas (tarjeta/préstamo/persona) con registro de pagos atómico (RPC, descuenta cuenta y deuda a la vez), simulador de amortización, sugerencia visual de estrategia bola de nieve/avalancha; CRUD de metas de ahorro con aportaciones atómicas (RPC), barra de progreso y proyección de cumplimiento según ritmo actual.

Fase 4 completa: reportes con flujo de efectivo mensual (ingresos vs. gastos), distribución de gastos por categoría, tendencia de patrimonio neto histórico con proyección a 6 meses, selector de rango (6/12/24 meses), vista de tabla y exportación a CSV/PDF (impresión del navegador). Paleta de gráficas validada contra accesibilidad CVD con la skill dataviz.

Fase 5 completa: PWA instalable (manifest, ícono de marca propio en varios tamaños, modo standalone), service worker con cache de assets estáticos y de la última página cargada (con fallback a una pantalla "sin conexión" cuando no hay red ni caché previo — verificado apagando el servidor y recargando en el navegador), aviso de instalación para iOS Safari, y ajustes mobile-first (safe-area insets para el notch/home indicator del iPhone).

Fase 6 completa: auditoría de seguridad. Se revisaron las 12 migraciones, las 3 funciones RPC, el middleware y las Server Actions de auth. Atomización de operaciones multi-tabla: completa, sin huecos (transacciones, pagos de deuda y aportaciones a metas ya usaban RPC atómica desde Fases 1 y 3). Sesión/tokens: correcto, sigue el patrón oficial de `@supabase/ssr`, sin service role key en el código, mensajes de login/recuperación genéricos (no revelan si un correo existe). **Hallazgo real y corregido** (`013_rls_ownership_hardening.sql`): las políticas RLS de `insert`/`update` verificaban `user_id = auth.uid()` pero nunca que las columnas que referencian otra tabla (`account_id`, `category_id`, `debt_id`, `goal_id`, `parent_id`) pertenecieran también al mismo usuario — permitía, vía la API REST directa (sin pasar por la app), insertar filas propias apuntando a IDs de otro usuario. Corregido y verificado con `scripts/verify-cross-user-isolation.mjs` (16/16 pruebas), sin romper ningún flujo existente (43/43 pruebas de los scripts de fases anteriores siguen pasando).

Fase 7 completa: pruebas. De los 7 casos de prueba listados en el doc, 6 ya tenían cobertura automatizada repartida en los scripts de fases anteriores; se cerró el único hueco real (flujo de efectivo mensual vs. suma manual, agregado a `verify-reports-data.mjs`) y se consolidó todo en un solo comando: `npm run verify:all` crea usuarios de prueba temporales, corre los 6 scripts de integración (62 aserciones en total) y limpia todo al terminar — verificado de punta a punta contra el Supabase real del usuario. Ver `TESTING.md` para el mapeo completo caso-por-caso y la checklist de pruebas manuales (instalación en iPhone real, export CSV/PDF, apariencia en pantallas chicas) que el doc también pide y no se prestan a automatización.

Con esto se completan las 7 fases del documento de requerimientos. Pendiente, sin ser parte de ninguna fase explícita: desplegar a Vercel/Cloudflare Pages — necesario para probar "Agregar a pantalla de inicio" en un iPhone real.
