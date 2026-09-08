# Documento de Requerimientos — App de Finanzas Personales

## 1. Resumen del proyecto

Aplicación web de finanzas personales, de uso individual, mobile-first (se abre desde el navegador del iPhone y también funciona en PC), en pesos mexicanos (MXN), orientada a replicar funciones que normalmente cobran apps comerciales (reportes avanzados, proyecciones, control de deudas y metas de ahorro), usando exclusivamente servicios con capa gratuita.

## 2. Stack tecnológico

| Capa | Tecnología | Motivo |
|---|---|---|
| Frontend | Next.js (React) + Tailwind CSS | Mobile-first real, carga rápida en Safari móvil, SSR/SSG gratis, instalable como PWA en el iPhone sin Apple Developer |
| Backend / BD | Supabase (free tier) | Postgres real, Auth, RLS, Realtime — todo gratis |
| Gráficas | Recharts o Chart.js | Ligeras, se ven bien en pantallas pequeñas |
| Hosting | Vercel (ideal para Next.js) o Cloudflare Pages | Deploy automático gratis desde GitHub, HTTPS incluido |
| PWA | `next-pwa` o Service Worker manual | Permite "Agregar a pantalla de inicio" en iOS, ícono propio, funciona casi como app nativa |
| Notificaciones | Recordatorios in-app | iOS restringe push web fuera de PWA instalada; se usan recordatorios visuales al abrir la app en vez de push |
| Testing | Vitest/Jest + Testing Library (frontend), pgTAP o tests SQL directos (funciones RPC de Supabase) | Cubrir reglas de negocio y atomicidad sin costo |

**Nota sobre Flutter descartado:** se consideró Flutter Web, pero para un enfoque 100% web y mobile-first, Next.js da mejor rendimiento percibido en Safari móvil y evita el peso extra del motor de renderizado de Flutter en web.

**Nota sobre moneda única:** se descarta el soporte multi-moneda; toda la app opera en MXN, lo que simplifica cálculos, reportes y el modelo de datos.

**Nota sobre almacenamiento de recibos:** se descarta adjuntar fotos/archivos de recibos para no depender de Supabase Storage y mantener el proyecto dentro del free tier sin riesgo de exceder cuota.

## 3. Alcance funcional (prioridades del usuario)

Prioridad 1: Registro de ingresos/gastos y presupuestos
Prioridad 2: Control de deudas y metas de ahorro
Prioridad 3: Reportes y proyecciones avanzadas

### 3.1 Módulo: Cuentas
- Alta/baja/edición de cuentas (efectivo, débito, crédito, inversión, ahorro)
- Saldo inicial y saldo actual calculado
- Todo en MXN, sin conversión de moneda
- Al crear una cuenta bancaria, catálogo preseleccionable de bancos principales de México (ver sección 3.8) para asignar nombre/ícono, sin integración real a los bancos (solo catalogación visual)
- Cuentas tipo crédito permiten saldo negativo hasta un `credit_limit` definido; cuentas de efectivo/débito/ahorro NO permiten saldo negativo

### 3.2 Módulo: Transacciones
- Registro de ingresos, gastos y transferencias entre cuentas
- Categorías y subcategorías personalizables
- Catálogo precargado de negocios/comercios comunes en México (ver sección 3.8) para autocompletar el campo de comercio y sugerir categoría automáticamente
- Etiquetas (tags) libres para filtrado cruzado
- Transacciones recurrentes (renta, suscripciones, nómina)
- Nota de texto libre por transacción (sin adjuntar archivos/imágenes)
- **Regla de negocio:** no se puede registrar un gasto o transferencia si deja saldo negativo en una cuenta de efectivo/débito/ahorro (se rechaza la operación con mensaje claro); en cuentas de crédito se permite hasta el límite definido

### 3.3 Módulo: Presupuestos
- Presupuesto mensual por categoría
- Alertas al superar % configurable del presupuesto (ej. 80%, 100%)
- Comparativo presupuestado vs. real por periodo

### 3.4 Módulo: Deudas
- Registro de deudas (tarjeta, préstamo, persona)
- Tasa de interés, pago mínimo, fecha de corte/pago
- Simulador de amortización (tabla de pagos)
- Estrategias de pago (bola de nieve / avalancha) como sugerencia visual
- Pago de deuda desde una cuenta (ej. nómina) descuenta el saldo de esa cuenta y reduce `current_balance` de la deuda en la misma operación atómica

### 3.5 Módulo: Metas de ahorro
- Meta con monto objetivo y fecha límite
- Aportaciones manuales o automáticas desde una cuenta
- Barra de progreso y proyección de cumplimiento según ritmo actual

### 3.6 Módulo: Reportes y proyecciones (prioridad marcada)
- Flujo de efectivo mensual/anual (ingresos vs egresos)
- Distribución de gastos por categoría (pie/bar chart)
- Tendencia histórica (línea de tiempo, 6-12-24 meses)
- Proyección de balance futuro basada en promedio de meses anteriores
- Patrimonio neto (activos - deudas) a lo largo del tiempo
- Exportar reportes a PDF/CSV

### 3.7 Módulo: Configuración
- Perfil de usuario (Supabase Auth)
- Categorías personalizadas
- Backup/exportación manual de datos (CSV/JSON)

### 3.8 Catálogos precargados (México)

**Bancos principales** (para nombrar/iconografiar cuentas, sin integración real):
BBVA, Santander, Banorte, Citibanamex, HSBC, Scotiabank, Inbursa, Banco Azteca, BanBajío, Banregio, Banco del Bienestar, Nu México, Klar, Hey Banco (Banregio).

**Negocios/comercios comunes** (para autocompletar y sugerir categoría):
- Supermercados: Walmart, Soriana, Chedraui, La Comer, Bodega Aurrerá
- Conveniencia: Oxxo, 7-Eleven, Extra
- Farmacias: Farmacias del Ahorro, Farmacias Guadalajara, Similares
- Restaurantes/delivery: Rappi, Uber Eats, Didi Food
- Transporte: Uber, Didi, Metro/Metrobús
- Streaming/suscripciones: Netflix, Spotify, Disney+, Amazon Prime
- Telecom: Telcel, AT&T México, Movistar, Izzi, Totalplay

## 4. Modelo de datos (borrador inicial — Postgres/Supabase)

```
users (manejado por Supabase Auth)

accounts
  id, user_id, name, type, bank_name (nullable), initial_balance,
  credit_limit (nullable, solo type=credit), created_at

categories
  id, user_id, name, parent_id (nullable), type (income/expense), icon, color

merchants (catálogo, no ligado a user_id — dato de referencia compartido)
  id, name, default_category_id (nullable)

transactions
  id, user_id, account_id, category_id, merchant_id (nullable), type (income/expense/transfer),
  amount, date, note, is_recurring, recurring_rule, created_at

budgets
  id, user_id, category_id, month, amount_limit, alert_threshold_pct

debts
  id, user_id, name, principal, interest_rate, minimum_payment,
  due_day, current_balance, created_at

debt_payments
  id, debt_id, account_id, amount, date, note

goals
  id, user_id, name, target_amount, current_amount, target_date, account_id

goal_contributions
  id, goal_id, amount, date
```

Row Level Security: todas las tablas con `user_id` filtradas por `user_id = auth.uid()`. Los catálogos (`merchants`) son de solo lectura para todos los usuarios autenticados.

## 5. Requerimientos no funcionales

- **Mobile-first**: diseño pensado primero para pantalla de iPhone (Safari), adaptado después a escritorio con breakpoints de Tailwind
- Instalable como PWA en el iPhone ("Agregar a pantalla de inicio"), con ícono y modo pantalla completa
- Funcionamiento offline básico vía Service Worker (cache de assets y última data cargada); sincronización al recuperar conexión, no en tiempo real
- Seguridad: RLS en Supabase + autenticación obligatoria
- **Atomicidad de transacciones**: operaciones que afectan más de una tabla o más de una cuenta (transferencias entre cuentas, aportación a meta que descuenta de una cuenta, pago de deuda que registra en `debt_payments`, actualiza `current_balance` de la deuda y descuenta el saldo de la cuenta de origen) deben ejecutarse como transacciones atómicas de Postgres (funciones RPC de Supabase con `BEGIN/COMMIT` implícito), nunca como escrituras separadas desde el cliente
- **Validación de saldo**: la restricción de "no saldo negativo" en cuentas no crédito debe validarse a nivel de base de datos (constraint o función RPC), no solo en el frontend, para evitar inconsistencias
- Costo: $0 en todos los servicios mientras se mantenga dentro de límites de free tier
- Sin necesidad de Mac, Xcode ni cuenta de Apple Developer

## 6. Fases sugeridas de desarrollo

1. **Fase 1 — Base**: Next.js + Supabase Auth + Cuentas + Transacciones (CRUD completo)
2. **Fase 2 — Control**: Presupuestos + alertas
3. **Fase 3 — Deudas y metas**: módulos completos con simuladores
4. **Fase 4 — Reportes**: gráficas, proyecciones, exportación
5. **Fase 5 — PWA y pulido**: instalación en iPhone, offline cache, ajustes mobile-first finales
6. **Fase 6 — Auditoría de seguridad y atomización**: revisión de políticas RLS por tabla, conversión de operaciones multi-tabla a funciones RPC atómicas, revisión de manejo de sesión/tokens de Supabase Auth, pruebas de que un usuario no pueda leer/escribir datos de otro usuario
7. **Fase 7 — Pruebas**: casos de prueba automatizados y manuales, entre ellos:
   - No se puede registrar un gasto que deje saldo negativo en una cuenta de efectivo/débito/ahorro
   - Sí se puede registrar un gasto en cuenta de crédito hasta el `credit_limit`, y se rechaza al superarlo
   - Un pago de deuda desde la cuenta de nómina descuenta correctamente el saldo de la cuenta Y actualiza `current_balance` de la deuda en la misma operación (si una falla, ambas se revierten)
   - Transferencia entre cuentas: si la cuenta origen no tiene fondos suficientes, se rechaza sin afectar la cuenta destino
   - Aportación a meta de ahorro descuenta correctamente de la cuenta de origen
   - Pruebas de RLS: un usuario no puede ver ni modificar cuentas/transacciones/deudas de otro usuario
   - Pruebas de reportes: los totales de flujo de efectivo y patrimonio neto cuadran contra la suma manual de transacciones de prueba

## 7. Diseño visual

Se usará como referencia de diseño el sistema de **monday.com** (vía Refero Styles: https://styles.refero.design/style/77ee57e9-9f8e-4ec1-93f7-cc1c4b84307a), adaptado a Tailwind v4.

**Resumen del lenguaje visual:**
- Paleta: violeta de marca `#6161ff` como único color de acción; fondo de página `#f5f6f8`; superficies de tarjeta en blanco `#ffffff`; acentos pastel (menta `#bcfe90`, cielo `#abf0ff`, lavanda `#eddff7`, periwinkle `#e7ecff`) para tarjetas de categoría/feature, nunca en texto ni botones
- Tipografía: Poppins como tipografía única (peso 300 para títulos grandes, 500-700 para labels/botones/nav); fallback Manrope/DM Sans
- Forma: botones tipo píldora (`border-radius: 160px`, no negociable), tarjetas con radio 24px, badges/inputs con radio 6px
- Sombra única suave: `rgba(205,208,223,0.4) 0px 2px 48px 0px` para elevar tarjetas, sin sombras pesadas
- Espaciado: unidad base 8px, padding de tarjeta 24px, separación entre secciones 64px
- Texto en negro cálido `#333333` (Ink), nunca `#000000` puro

**Aplicación sugerida a los módulos de esta app:**
- Botones primarios (guardar transacción, crear meta, etc.) en violeta `#6161ff`, forma píldora
- Tarjetas de resumen (saldo total, presupuesto del mes, progreso de meta) con fondos pastel diferenciados por tipo de dato (ej. menta para ingresos, apricot/naranja para gastos, lavanda para metas)
- Gráficas de reportes usando la paleta de acento (menta, cielo, apricot, cornflower) para mantener consistencia con las tarjetas
- Badges de categoría/estatus (ej. "sobre presupuesto", "al día") con radio 6px y fondo tintado, siguiendo el patrón de Status Pill del sistema
- Mantener el criterio mobile-first: aunque el sistema base es de una web de escritorio (monday.com), los componentes (píldoras, tarjetas 24px, tipografía Poppins) se adaptan bien a pantallas pequeñas sin perder identidad

El archivo DESIGN.md completo (tokens CSS, variables Tailwind v4, guía de componentes) se obtiene directamente del link de Refero al iniciar el proyecto con Claude Code.

## 8. Límites del free tier a monitorear

- Supabase free: 500MB BD, pausa el proyecto tras 7 días de inactividad (hay que reactivarlo entrando al dashboard)
- Vercel / Cloudflare Pages: sin costo para tráfico personal, sin límite práctico para este caso de uso
