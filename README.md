# Northstar Finance

App de finanzas personales mobile-first en MXN, instalable como PWA. Fases 1-5: Next.js + Supabase Auth + Cuentas + Transacciones + Presupuestos + Deudas + Metas de ahorro + Reportes + PWA/offline. Ver `requerimientos-app-financiera.md` para el alcance completo del proyecto.

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

Corre los archivos de `supabase/migrations/` en orden (001 → 012) contra tu proyecto, ya sea con el SQL Editor del dashboard de Supabase o con la CLI de Supabase (`supabase db push`).

### Desarrollo

```bash
npm run dev
```

### Pruebas

```bash
npm run test
```

Para verificar las reglas de negocio (saldo negativo, límite de crédito, atomicidad de transferencias) contra tu proyecto real, crea un usuario de prueba y corre:

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

## Estado

Fase 1 completa: registro/login/recuperación de contraseña, CRUD de cuentas (con catálogo de bancos MX) y CRUD de transacciones (ingreso/gasto/transferencia, con catálogo de comercios MX, categorías, etiquetas y flag de recurrente), todo con la regla de "no saldo negativo" aplicada en la base de datos vía funciones RPC atómicas.

Fase 2 completa: presupuesto mensual por categoría con navegación de mes, comparativo presupuestado vs. real con barra de progreso, alertas visuales configurables (badge de estado ok/alerta/excedido) y widget de resumen en el Dashboard.

Fase 3 completa: CRUD de deudas (tarjeta/préstamo/persona) con registro de pagos atómico (RPC, descuenta cuenta y deuda a la vez), simulador de amortización, sugerencia visual de estrategia bola de nieve/avalancha; CRUD de metas de ahorro con aportaciones atómicas (RPC), barra de progreso y proyección de cumplimiento según ritmo actual.

Fase 4 completa: reportes con flujo de efectivo mensual (ingresos vs. gastos), distribución de gastos por categoría, tendencia de patrimonio neto histórico con proyección a 6 meses, selector de rango (6/12/24 meses), vista de tabla y exportación a CSV/PDF (impresión del navegador). Paleta de gráficas validada contra accesibilidad CVD con la skill dataviz.

Fase 5 completa: PWA instalable (manifest, ícono de marca propio en varios tamaños, modo standalone), service worker con cache de assets estáticos y de la última página cargada (con fallback a una pantalla "sin conexión" cuando no hay red ni caché previo — verificado apagando el servidor y recargando en el navegador), aviso de instalación para iOS Safari, y ajustes mobile-first (safe-area insets para el notch/home indicator del iPhone).

Próximas fases (ver el documento de requerimientos): auditoría de seguridad (Fase 6), pruebas formales (Fase 7). El despliegue a Vercel/Cloudflare Pages tampoco se ha hecho todavía — es necesario para probar "Agregar a pantalla de inicio" en un iPhone real.
