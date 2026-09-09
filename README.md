# Finanzas

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

Completa `.env.local` con la URL y anon key de tu proyecto Supabase (Project Settings → API). Para el motor de recurrencias (Fase 8) hacen falta además dos variables server-only (nunca con prefijo `NEXT_PUBLIC_`): `SUPABASE_SERVICE_ROLE_KEY` (mismo dashboard, Settings → API → service_role — bypassea RLS, no lo compartas ni lo subas a git) y `CRON_SECRET` (una cadena aleatoria que tú inventas, para que `/api/cron/generate-recurring` no sea invocable públicamente). En Vercel, agrega ambas en Project Settings → Environment Variables para que el Cron Job funcione en producción.

### Migraciones

Corre los archivos de `supabase/migrations/` en orden (001 → 019) contra tu proyecto, ya sea con el SQL Editor del dashboard de Supabase o con la CLI de Supabase (`supabase db push`).

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

### Motor de recurrencias (Fase 8)

Verifica los 3 casos del doc (Netflix mensual sin duplicarse, Strava anual sin generar en meses intermedios, recurrencia con `recurring_end_date` vencida) directo contra la función `generate_recurring_occurrence` — es `security definer` y solo la puede invocar el service role, así que este script no depende de un usuario de sesión, crea y borra el suyo propio:

```bash
npm run verify:recurring
```

Para probar la ruta del cron end-to-end en local (requiere `CRON_SECRET` en `.env.local`):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/generate-recurring
```

## Estado

Fase 1 completa: registro/login/recuperación de contraseña, CRUD de cuentas (con catálogo de bancos MX) y CRUD de transacciones (ingreso/gasto/transferencia, con catálogo de comercios MX, categorías, etiquetas y flag de recurrente), todo con la regla de "no saldo negativo" aplicada en la base de datos vía funciones RPC atómicas.

Fase 2 completa: presupuesto mensual por categoría con navegación de mes, comparativo presupuestado vs. real con barra de progreso, alertas visuales configurables (badge de estado ok/alerta/excedido) y widget de resumen en el Dashboard.

Fase 3 completa: CRUD de deudas (tarjeta/préstamo/persona) con registro de pagos atómico (RPC, descuenta cuenta y deuda a la vez), simulador de amortización, sugerencia visual de estrategia bola de nieve/avalancha; CRUD de metas de ahorro con aportaciones atómicas (RPC), barra de progreso y proyección de cumplimiento según ritmo actual.

Fase 4 completa: reportes con flujo de efectivo mensual (ingresos vs. gastos), distribución de gastos por categoría, tendencia de patrimonio neto histórico con proyección a 6 meses, selector de rango (6/12/24 meses), vista de tabla y exportación a CSV/PDF (impresión del navegador). Paleta de gráficas validada contra accesibilidad CVD con la skill dataviz.

Fase 5 completa: PWA instalable (manifest, ícono de marca propio en varios tamaños, modo standalone), service worker con cache de assets estáticos y de la última página cargada (con fallback a una pantalla "sin conexión" cuando no hay red ni caché previo — verificado apagando el servidor y recargando en el navegador), aviso de instalación para iOS Safari, y ajustes mobile-first (safe-area insets para el notch/home indicator del iPhone).

Fase 6 completa: auditoría de seguridad. Se revisaron las 12 migraciones, las 3 funciones RPC, el middleware y las Server Actions de auth. Atomización de operaciones multi-tabla: completa, sin huecos (transacciones, pagos de deuda y aportaciones a metas ya usaban RPC atómica desde Fases 1 y 3). Sesión/tokens: correcto, sigue el patrón oficial de `@supabase/ssr`, sin service role key en el código, mensajes de login/recuperación genéricos (no revelan si un correo existe). **Hallazgo real y corregido** (`013_rls_ownership_hardening.sql`): las políticas RLS de `insert`/`update` verificaban `user_id = auth.uid()` pero nunca que las columnas que referencian otra tabla (`account_id`, `category_id`, `debt_id`, `goal_id`, `parent_id`) pertenecieran también al mismo usuario — permitía, vía la API REST directa (sin pasar por la app), insertar filas propias apuntando a IDs de otro usuario. Corregido y verificado con `scripts/verify-cross-user-isolation.mjs` (16/16 pruebas), sin romper ningún flujo existente (43/43 pruebas de los scripts de fases anteriores siguen pasando).

Fase 7 completa: pruebas. De los 7 casos de prueba listados en el doc, 6 ya tenían cobertura automatizada repartida en los scripts de fases anteriores; se cerró el único hueco real (flujo de efectivo mensual vs. suma manual, agregado a `verify-reports-data.mjs`) y se consolidó todo en un solo comando: `npm run verify:all` crea usuarios de prueba temporales, corre los 6 scripts de integración (62 aserciones en total) y limpia todo al terminar — verificado de punta a punta contra el Supabase real del usuario. Ver `TESTING.md` para el mapeo completo caso-por-caso y la checklist de pruebas manuales (instalación en iPhone real, export CSV/PDF, apariencia en pantallas chicas) que el doc también pide y no se prestan a automatización.

Con esto se completan las 7 fases del documento de requerimientos. Desplegado en Vercel (`mi-finc.vercel.app`); manifest, íconos y service worker verificados en producción.

**Auditoría de rendimiento** (post-fases, sin ser parte del doc): se revisó separación client/server components (sin componentes de cliente innecesarios), patrones de queries (sin N+1, todo con `Promise.all`), índices, bundle size, loading states, caché de Next.js, y config de PWA. Dos hallazgos de alta prioridad corregidos en `014_performance_audit_fixes.sql`: (1) índice compuesto `transactions (user_id, type, date)` para la query de gasto-por-categoría-y-mes usada en Dashboard/Presupuestos/Reportes; (2) el catálogo de `merchants` (compartido, ~26 filas, no cambia) se cachea 1h con `unstable_cache` (`src/lib/merchants-data.ts`) en vez de reconsultarse completo en cada carga de `/transactions` — la política RLS se amplió a `anon, authenticated` porque no tiene datos de usuario. Hallazgo medio pendiente: no hay `loading.tsx`/`Suspense` en ninguna ruta (pantalla en blanco mientras cargan los Server Components).

**Pulido post-lanzamiento** (feedback de uso real): renombrado de "Northstar Finance" a "Finanzas"; fix de zoom automático de iOS Safari en inputs (subidos a 16px en mobile, `md:text-sm` en desktop — por debajo de 16px Safari hace zoom al enfocar); menú inferior con más separación entre items e íconos un poco más grandes (antes el texto se veía pegado y los íconos chicos para el dedo); **las cuentas de tipo crédito con saldo negativo ahora se reflejan también en Deudas** (`src/lib/credit-card-debt.ts`) y en el total de "Deudas totales" del Dashboard — se pagan con una transferencia normal desde Movimientos, no se duplica en la tabla `debts`; y un widget de **recordatorios de pago** en el Dashboard (`src/lib/debt-reminders.ts`) que avisa cuando el `due_day` de una deuda cae dentro de los próximos 7 días, interpretado siempre como "ese día de cada mes" (con `due_day=31` cae en el último día real del mes en meses más cortos).

**Categorías por defecto** (sección 3.8 del doc, agregada después de las 7 fases): `015_default_categories_seed.sql` precarga las 19 categorías de ingreso/gasto del doc (incluyendo "Otros gastos" como cajón genérico) — retroactivamente para usuarios existentes y, hacia adelante, vía un trigger en `auth.users` para cada alta nueva. Es idempotente (no duplica por `user_id + name + type`). Esto resuelve que el selector de categoría en Transacciones solo mostrara "Sin categoría": no era un bug de la query, la tabla `categories` simplemente estaba vacía — "Sin categoría" sigue siendo una opción explícita, ahora junto a las demás.

**Corrección de diseño: tarjetas de crédito, versión final** (sección 6 del doc — la primera corrección, descrita en el párrafo anterior, resultó ser una iteración intermedia que el propio doc marcó como problemática: "causó confusión de UX y discrepancias entre el saldo mostrado y la deuda real"). El diseño final es el opuesto: `accounts` **nunca** incluye tarjetas de crédito (solo efectivo/débito/inversión/ahorro); las tarjetas viven completa y únicamente en `debts` (que ganó `credit_limit`, `bank_name`, `cutoff_day` y `payment_due_day`, mutuamente excluyentes con el `due_day` de préstamos/personales), y un gasto se paga tomando como origen una cuenta O una tarjeta directamente vía `transactions.debt_id` (nuevo, nullable — exactamente uno de `account_id`/`debt_id` en un gasto, nunca ambos), sin pasar por `accounts` en ese segundo caso (`017_credit_cards_back_to_debts.sql`). La migración archivó (nunca borró) las cuentas tipo crédito que existían, reutilizó las deudas archivadas de la corrección anterior en vez de duplicarlas, y reasignó a `debt_id` cualquier gasto que hubiera quedado ligado a esas cuentas. Las funciones RPC (`create_transaction`/`update_transaction`/`apply_transaction_effect` y las que dependen de ellas — pagos de deuda, aportaciones a metas) se actualizaron para soportar el nuevo flujo sin duplicar lógica. Deudas vuelve a ser una sola lista simple sobre `debts` (tarjetas, préstamos y personales juntos); el selector "pagar con" en Movimientos combina cuentas y tarjetas en un mismo picker, solo para gastos.

⚠️ **Pendiente manual**: no fue posible verificar esta corrección en un navegador real durante el desarrollo (la extensión de Chrome no ha conectado en ninguna sesión reciente) — verificado con `tsc`, ESLint, Vitest y `npm run verify:all` (6/6) contra Supabase real, incluyendo un caso nuevo en `verify-transaction-rpc.mjs` para el gasto pagado directamente con tarjeta. Falta la prueba manual de clic-por-clic en la UI.

**Formulario dinámico de movimientos + recurrencia real** (secciones 3.2/4 del doc): el formulario de Movimientos pregunta el tipo primero, luego "¿es recurrente?" (antes que comercio/etiquetas/nota) y el resto de campos se condiciona al tipo — Ingreso ya no muestra comercio ni etiquetas, Transferencia sigue sin categoría/comercio/etiquetas y sin poder ser recurrente. `recurring_rule` (jsonb) se reemplazó por columnas explícitas: `recurring_frequency` (weekly/monthly/annual/custom), `recurring_interval_days` (solo si custom) y `recurring_end_date`.

**Fase 8 — Motor de recurrencias automáticas**: hasta aquí `recurring_frequency`/`recurring_end_date` eran puro metadato — nada generaba la transacción del siguiente periodo. Un **Vercel Cron Job** diario (`vercel.json`, 1 vez al día — límite del plan Hobby) llama a `/api/cron/generate-recurring`, protegida validando `Authorization: Bearer $CRON_SECRET` (el patrón oficial de Vercel Cron). La ruta usa un cliente con el **service role key** (`src/lib/supabase/admin.ts`) porque no hay sesión de usuario — por eso se agregó `api/` a las exclusiones del middleware, que si no la habría redirigido a `/login` antes de llegar al handler. La aritmética de fechas (avanzar un periodo según `recurring_frequency`) vive en un solo lugar (`src/lib/recurring.ts`, con Vitest), reusada al fijar el `next_occurrence_date` inicial de una transacción recurrente y por la propia ruta del cron; `upcoming-payments.ts` también se refactorizó para reusarla. La función `generate_recurring_occurrence` (`019_recurring_engine.sql`) hace todo lo demás atómicamente: valida elegibilidad (`next_occurrence_date <= hoy` y `recurring_end_date` no vencida), **verifica idempotencia** (no duplica si ya existe una ocurrencia generada para esa plantilla y esa fecha), aplica el efecto de saldo (rechaza si excede el `credit_limit` de una tarjeta o deja saldo negativo en una cuenta) e inserta la ocurrencia real (`is_recurring=false`). Es `security definer` con un chequeo explícito de `auth.role() = 'service_role'` más `revoke`/`grant` — ningún usuario autenticado ni anónimo puede invocarla vía la API pública (no reusa `apply_transaction_effect` a propósito: esa función depende de `auth.uid()`, que es `NULL` en una llamada de service role). Verificado con `npm run verify:recurring` (los 3 casos del doc) y `npm run verify:all` (6/6, sin regresiones); el histórico de dos transacciones recurrentes reales que ya existían se migró (`next_occurrence_date` calculado retroactivamente) sin tocar sus saldos. **`020_fix_recurring_null_serialization.sql`**: `generate_recurring_occurrence` devolvía `transactions` (tipo compuesto) — cuando el valor real era `NULL` (nada que generar), PostgREST lo exponía como un objeto JSON con todas las columnas en `null`, no como JSON `null`, porque expande un row type NULL en el `FROM` en vez de omitir la fila. Efecto real: la ruta del cron (`if (data) { generated++ } else { skipped++ }`) contaba como "generado" hasta lo que el motor correctamente omitió por idempotencia — detectado corriendo `verify:recurring` contra Supabase real (3 de 14 asserts fallaban pese a que la idempotencia en la BD sí funcionaba). Se cambió el retorno a `jsonb`; las 14 pruebas pasan.

**Fase 9 — Pulido de UX (modo oscuro, accesibilidad, animaciones)**:
- **Modo oscuro**: paleta oscura propia (`src/app/globals.css`) derivada a mano y validada por contraste WCAG AA con un script de una sola vez (no un invert automático) — `--color-monday-violet` (`#6161ff`) nunca cambia, sigue siendo el color de acción en ambos modos; los pastel (`mint`/`sky`/`apricot`/`lavender`/`periwinkle`/`cornflower`) sí se oscurecen de verdad porque `periwinkle`/`lavender` se usan a opacidad completa en varios sitios con texto encima. Toggle manual (`src/components/theme/theme-toggle.tsx`) + `prefers-color-scheme` como default, guardado en cookie (no solo localStorage) y aplicado sin parpadeo vía un script inline bloqueante en `<head>` (`src/app/layout.tsx`) — a propósito el layout raíz NO lee la cookie en el servidor (eso habría forzado renderizado dinámico en `/`, `/login`, `/register`, etc., hoy estáticas); el script ya evita el parpadeo en toda carga, no solo la primera.
- **Accesibilidad**: contraste AA verificado con un script propio (fórmula WCAG de relative luminance) contra las 34 combinaciones de texto/pastel/fondo oscuro reales de la app — 3 fallaban de verdad y se corrigieron: `--color-violet-text` en claro (4.17:1 → `#5b5bf0`, 4.62:1), `--color-slate` en oscuro contra pasteles oscuros (4.24:1 → `#a1a6bd`, ≥4.5:1 contra los seis), y el botón `danger` (`bg-red-500` con texto blanco daba 3.76:1 → `bg-red-600`/`hover:bg-red-700`, 4.83:1/6.47:1). Botones de ícono solo (editar/eliminar/cerrar, ~25 sitios) pasan de `p-1.5` (~28px) a un objetivo táctil de 44px manteniendo el ícono visualmente igual de chico, igual que los pills de estrategia (Deudas) y de rango (Reportes) que medían ~32px de alto; foco visible explícito (`focus-visible:ring-2 focus-visible:ring-monday-violet`) en `Button`, enlaces de navegación, pills y botones de ícono; mensajes de error de formulario con `role="alert"` (~18 sitios); las barras de progreso de presupuestos y metas ganan `role="progressbar"` + `aria-valuenow/min/max` (antes eran `div`s puramente visuales); los pills de estrategia/rango ganan `aria-pressed`; el autocompletar de comercio en Movimientos gana semántica de combobox (`role="combobox"`, `aria-expanded`, `aria-controls`, cierre con Escape).
- **Animaciones**: `Button` gana una micro-interacción de presión (`active:scale-[0.97]`) y `Card` una de hover (`--shadow-card-hover`, mismo tono un poco más presente); fade-in sutil al navegar entre pestañas (`src/components/navigation/route-fade.tsx`, remonta por `pathname`) y también al resolver el skeleton de cada `loading.tsx` hacia el contenido real (`animate-fade-in` en el contenedor raíz de cada página — antes solo se disparaba al cambiar de ruta, no al terminar de cargar dentro de la misma ruta); todo respeta `prefers-reduced-motion` con una sola regla global en `globals.css` (`animation-duration`/`transition-duration` a ~0 para quien lo tenga activado), en vez de condicionar cada animación una por una.
- **Fuera de alcance a propósito**: las gráficas de Reportes (`src/lib/constants/chart-colors.ts`) no se re-tocaron — están validadas por la skill dataviz contra una superficie blanca específicamente; darles su propia paleta oscura validada por CVD es un trabajo aparte, no un simple invert, y no se hizo en este pase.

⚠️ **Pendiente de tu confirmación**: la extensión de Chrome no ha conectado en ninguna sesión reciente, así que este pase se verificó con `tsc`, ESLint, Vitest (62/62), `npm run verify:recurring` (14/14 contra Supabase real) y un script de contraste WCAG propio, más smoke tests con `curl` contra el server de `next dev` (rutas responden 200/307 sin crashear, `/api/cron/generate-recurring` responde 401 sin secreto y 200 con él) — no una revisión visual real en navegador. Dado que este es un cambio visual amplio (modo oscuro en toda la app), te recomiendo probarlo tú mismo antes de darlo por bueno. El toggle está junto a "Cerrar sesión" (sidebar en escritorio, header en móvil).
