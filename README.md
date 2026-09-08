# Northstar Finance

App de finanzas personales mobile-first en MXN. Fases 1-3: Next.js + Supabase Auth + Cuentas + Transacciones + Presupuestos + Deudas + Metas de ahorro. Ver `requerimientos-app-financiera.md` para el alcance completo del proyecto.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- Supabase (Postgres, Auth, RLS)
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

## Estado

Fase 1 completa: registro/login/recuperación de contraseña, CRUD de cuentas (con catálogo de bancos MX) y CRUD de transacciones (ingreso/gasto/transferencia, con catálogo de comercios MX, categorías, etiquetas y flag de recurrente), todo con la regla de "no saldo negativo" aplicada en la base de datos vía funciones RPC atómicas.

Fase 2 completa: presupuesto mensual por categoría con navegación de mes, comparativo presupuestado vs. real con barra de progreso, alertas visuales configurables (badge de estado ok/alerta/excedido) y widget de resumen en el Dashboard.

Fase 3 completa: CRUD de deudas (tarjeta/préstamo/persona) con registro de pagos atómico (RPC, descuenta cuenta y deuda a la vez), simulador de amortización, sugerencia visual de estrategia bola de nieve/avalancha; CRUD de metas de ahorro con aportaciones atómicas (RPC), barra de progreso y proyección de cumplimiento según ritmo actual.

Próximas fases (ver el documento de requerimientos): Reportes/proyecciones, PWA/offline, auditoría de seguridad.
