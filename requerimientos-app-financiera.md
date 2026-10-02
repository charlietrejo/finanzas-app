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
| Avatar | `blobatar` (paquete npm, https://blobatar.dev) | Genera un avatar geométrico determinístico a partir de un string (ej. el email del usuario) sin subir ni almacenar ninguna imagen — evita depender de Supabase Storage y no expone el email a un servicio externo (se usa el paquete npm local, no el endpoint hosteado) |

**Nota sobre Flutter descartado:** se consideró Flutter Web, pero para un enfoque 100% web y mobile-first, Next.js da mejor rendimiento percibido en Safari móvil y evita el peso extra del motor de renderizado de Flutter en web.

**Nota sobre moneda única:** se descarta el soporte multi-moneda; toda la app opera en MXN, lo que simplifica cálculos, reportes y el modelo de datos.

**Nota sobre almacenamiento de recibos:** se descarta adjuntar fotos/archivos de recibos para no depender de Supabase Storage y mantener el proyecto dentro del free tier sin riesgo de exceder cuota.

## 3. Alcance funcional (prioridades del usuario)

Prioridad 1: Registro de ingresos/gastos y presupuestos
Prioridad 2: Control de deudas y metas de ahorro
Prioridad 3: Reportes y proyecciones avanzadas

### 3.1 Módulo: Cuentas

- Alta/baja/edición de cuentas **solo de tipo**: efectivo, débito, inversión, ahorro. **Las tarjetas de crédito NO se dan de alta como cuenta** — viven exclusivamente en el módulo de Deudas (sección 3.4)
- Saldo inicial y saldo actual calculado
- Todo en MXN, sin conversión de moneda
- Al crear una cuenta bancaria, catálogo preseleccionable de bancos principales de México (ver sección 3.8) para asignar nombre/ícono, sin integración real a los bancos (solo catalogación visual)
- Ninguna cuenta permite saldo negativo (al no existir ya el tipo crédito, esta regla aplica de forma uniforme a todas las cuentas)
- **Ajustar saldo (reconciliación manual)**: como el saldo actual se calcula (saldo inicial + suma de movimientos), puede desalinearse de la realidad si algo no se capturó (una comisión bancaria, un cargo no registrado, etc.). Cada cuenta tiene una opción "Ajustar saldo": el usuario captura el saldo real que ve en su banco, el sistema calcula la diferencia contra el saldo calculado, y crea automáticamente un movimiento de ajuste (ingreso o gasto según el signo de la diferencia) con `is_adjustment = true` — esto reconcilia el saldo sin que el usuario tenga que encontrar manualmente qué movimiento falta

### 3.2 Módulo: Transacciones

- Registro de ingresos, gastos y transferencias entre cuentas
- **Un gasto se paga desde exactamente uno de estos dos orígenes:**
  - una **cuenta** (efectivo, débito, inversión, ahorro), o
  - una **tarjeta de crédito** (de Deudas) — en este caso el monto se suma directo a `current_balance` de esa deuda, sin tocar ninguna cuenta
- Los ingresos y las transferencias entre cuentas SIEMPRE usan cuentas (nunca una tarjeta de crédito como destino de un ingreso)
- Categorías y subcategorías personalizables
- Catálogo precargado de negocios/comercios comunes en México (ver sección 3.8) para autocompletar el campo de comercio y sugerir categoría automáticamente
- Etiquetas (tags) libres para filtrado cruzado
- Nota de texto libre por transacción (sin adjuntar archivos/imágenes)
- **Regla de negocio (cuentas):** no se puede registrar un gasto o transferencia que deje saldo negativo en una cuenta
- **Regla de negocio (tarjetas de crédito):** no se puede registrar un gasto con tarjeta que deje `current_balance` por encima de `credit_limit` de esa tarjeta

**Formulario dinámico según tipo de movimiento** (el formulario cambia los campos que muestra en vivo, no es un solo formulario fijo con todo):

1. **Selector de tipo primero**: Ingreso / Gasto / Transferencia — esto decide todo lo demás
2. **¿Es recurrente?** se pregunta justo después del tipo (antes que comercio/etiquetas/nota), porque si es recurrente cambia qué más se pide:
   - Si es recurrente, se pide de una vez: **frecuencia** (semanal / mensual / anual / personalizada cada N días), opcionalmente **fecha de fin** (si no se da, se repite indefinidamente), y **¿se cobra solo o lo registras tú?**:
     - **Domiciliado/automático**: el cron de la Fase 8 sigue generando la transacción real solo, en la fecha correspondiente, sin intervención — para cargos que el banco/servicio cobra sin que el usuario haga nada (Netflix, Telmex)
     - **Manual**: el cron **NO crea la transacción**; en su lugar, cuando se acerca la fecha (dentro de la ventana de alertas, sección 3.4.1), aparece un recordatorio "Pendiente: {nombre} — ${monto}" con un botón **"Registrar ahora"** que abre el formulario de nuevo movimiento prellenado (monto, categoría, cuenta) para que el usuario lo confirme cuando realmente lo haga — la transacción real solo existe hasta que el usuario la confirma así, y `next_occurrence_date` de la plantilla solo avanza en ese momento (no antes)
   - Ejemplos de referencia que el formulario debe soportar sin fricción: pago mensual de Telmex domiciliado (automático, mensual), suscripción de Netflix domiciliada (automático, mensual), anualidad de Strava domiciliada (automático, anual), pago semanal de $400 en efectivo que el usuario hace a mano (manual, semanal)
3. **Campos restantes, condicionados al tipo:**
   - **Ingreso**: cuenta destino, categoría, monto, fecha, nota. **NO muestra comercio ni etiquetas** (no aplican a un ingreso)
   - **Gasto**: origen (cuenta o tarjeta de crédito, ver arriba), categoría, comercio (con autocompletado), etiquetas, monto, fecha, nota
   - **Transferencia**: cuenta origen, cuenta destino, monto, fecha, nota. Sin categoría, sin comercio, sin etiquetas. No aplica el flujo de "recurrente" del paso 2 para transferencias (se puede omitir ese paso cuando el tipo es transferencia)

### 3.3 Módulo: Presupuestos
- Presupuesto mensual por categoría
- Alertas al superar % configurable del presupuesto (ej. 80%, 100%)
- Comparativo presupuestado vs. real por periodo (incluye gastos pagados con cuenta Y con tarjeta de crédito, ambos cuentan para el presupuesto de su categoría; excluye movimientos con `is_adjustment = true`, sección 3.1 — un ajuste de saldo no debe contar contra el presupuesto de ninguna categoría)

### 3.4 Módulo: Deudas

**Todo lo que implica una deuda vive aquí, incluidas las tarjetas de crédito:**

- **Tarjetas de crédito**: nombre, banco (catálogo de sección 3.8), `credit_limit`, `current_balance` (aumenta con cada gasto pagado con esa tarjeta, disminuye con cada pago), tasa de interés, pago mínimo del periodo actual, día de corte, día límite de pago
- **Préstamos**: monto principal, tasa de interés, pago mínimo, fecha de pago, saldo actual
- **Deudas personales** (con alguien, no con un banco): monto, con quién, fecha de pago, saldo actual
- El **pago mínimo** de una tarjeta de crédito es un campo editable en cualquier momento (no fijo), porque cambia cada periodo/estado de cuenta; el usuario lo actualiza manualmente cuando le llega su nuevo estado de cuenta
- **Saldo del periodo actual (calculado, informativo)**: a diferencia del pago mínimo (que depende de la fórmula propia de cada banco y no se puede replicar con certeza), el **monto gastado entre el último corte y el próximo sí es calculable** directamente de los movimientos pagados con esa tarjeta — es solo una suma por rango de fechas. Se muestra junto al campo de pago mínimo como referencia ("Llevas $X gastados en este periodo"), **sin reemplazar la captura manual del pago mínimo** — el usuario sigue actualizando ese campo a mano contra su estado de cuenta real, para no arriesgar que confíe en un número que la app no puede calcular con exactitud
- Simulador de amortización (tabla de pagos) para préstamos y para tarjetas de crédito
- Estrategias de pago (bola de nieve / avalancha) considerando el total de deudas (tarjetas + préstamos + personales)
- **Pago de una deuda** (cualquier tipo, incluida tarjeta de crédito) desde una cuenta (ej. nómina): descuenta el saldo de la cuenta origen y reduce `current_balance` de la deuda, registrado en `debt_payments`, en la misma operación atómica

### 3.4.1 Módulo: Dashboard — Alertas de próximos pagos y Últimos movimientos

**Encabezado del Dashboard**: en lugar del título genérico "Dashboard", muestra un saludo personalizado usando el nombre/apodo capturado en el registro (sección 3.7): **"¡Hola, {nombre}!"**. Si el usuario no capturó nombre (cuentas creadas antes de este cambio), usar un saludo genérico ("¡Hola!") en vez de dejarlo vacío o mostrar "Dashboard".

- Zona visible en el Dashboard (pantalla principal) que lista los próximos pagos a vencer, ordenados por fecha, combinando:
  - Tarjetas de crédito: próxima **fecha de corte** (`cutoff_day`) Y próxima **fecha límite de pago** (`payment_due_day`, mostrando el pago mínimo actual) — ambas como eventos separados en la lista, no solo la fecha límite de pago
  - Préstamos/deudas personales: próxima fecha de pago
  - Transacciones recurrentes próximas a ejecutarse (ej. renta, suscripciones) — si son **domiciliadas/automáticas**, es solo informativo (el cron ya las va a generar solo); si son **manuales** (sección 3.2), el recordatorio incluye un botón **"Marcar como pagada"** que abre el formulario de nuevo movimiento **con todos los campos editables** (monto, categoría, y **cuenta/tarjeta de origen prellenados con los valores de la plantilla, pero cambiables** — puede que ese pago en particular haya salido de una cuenta distinta a la habitual) — al guardar, cuenta como confirmación
  - **Préstamos otorgados** (sección 3.4.2) con `expected_return_date` próxima a cumplirse
- Ventana de "próximos N días": **5 días** para todos los eventos (corte de tarjeta, fecha límite de pago, deudas, recurrencias, préstamos otorgados)
- Indicador visual de urgencia (ej. rojo si vence en ≤2 días, ámbar si ≤5 días)

**Persistencia, acumulación y ventana de recordatorios manuales (recurrencias con `recurring_is_automatic = false`):** distinto del resto de las alertas (que usan la ventana general de 5 días, sección arriba), un recordatorio manual usa su **propia ventana de 3 días antes de la fecha programada** (`next_occurrence_date`). Ejemplo concreto: si el día de pago es lunes, el recordatorio debe aparecer el viernes anterior (3 días antes), no antes de eso.

- **Se acumulan, no se quedan en un solo "vencido" genérico**: como `next_occurrence_date` siempre representa la ocurrencia más antigua sin confirmar, el número de pagos atrasados se calcula (sin columna nueva) como los periodos completos transcurridos entre esa fecha y hoy: `pagos_atrasados = 1 + floor((hoy - next_occurrence_date) / intervalo_en_días)`. El recordatorio debe mostrar ese conteo y el monto acumulado (ej. "Llevas 2 pagos de $400 sin registrar — $800 atrasados, desde hace 10 días")
- **"Marcar como pagada" confirma UNA ocurrencia a la vez** (la más antigua pendiente), fechada en la `next_occurrence_date` que le correspondía (no en la fecha real de hoy), y avanza `next_occurrence_date` un intervalo (regla de anclaje ya definida). Si seguían quedando pagos atrasados, el recordatorio se mantiene visible con el conteo ya reducido en uno, para que el usuario se ponga al día confirmando de uno en uno
- **Nunca desaparece por el paso del tiempo** — solo baja su conteo al confirmar, hasta llegar a cero pagos pendientes, momento en el que desaparece hasta que la siguiente fecha vuelva a entrar en su ventana de 3 días
- Esto aplica igual sin importar la frecuencia (semanal, quincenal, mensual)

**Eliminar una recurrencia:** en la lista de Transacciones, cualquier movimiento que sea una plantilla recurrente (`is_recurring = true`) debe mostrarse marcado como tal (ej. badge "Recurrente"), con una acción para eliminarla. Eliminar la plantilla **detiene las futuras repeticiones únicamente** — nunca borra las transacciones ya generadas en el pasado a partir de ella (esas son filas independientes con `is_recurring = false`, no se ven afectadas). Aplica tanto a recurrencias automáticas como manuales.

**Los dos botones de eliminar nunca coexisten en la misma fila** (para que no haya ambigüedad de cuál usar): una fila de plantilla (`is_recurring = true`) solo muestra **"Eliminar recurrencia"** — el borrado genérico de movimiento no debe estar disponible ahí, precisamente porque revertiría el saldo de su primera ocurrencia de forma incorrecta. Una fila de una ocurrencia normal (`is_recurring = false`, generada por el cron o confirmada a mano) solo muestra el **"Eliminar movimiento"** genérico de siempre — el concepto de "eliminar recurrencia" no le aplica, no es una plantilla.

**Ver mis recurrencias de un vistazo:** como las plantillas recurrentes quedan mezcladas cronológicamente con todos los demás movimientos en Transacciones, se agrega un filtro/pestaña en esa misma pantalla — **"Todos" / "Recurrentes"** — que al activarse muestra solo las filas con `is_recurring = true` (tanto automáticas como manuales, cada una con su badge distinguiendo cuál es cuál: "Domiciliado" vs "Manual"), sin importar cuándo se crearon. Esta es la forma de responder "¿cuáles son mis gastos domiciliados?" sin tener que buscar entre el historial completo.

**Tratamiento especial de préstamos otorgados (más propensos a olvidarse que una tarjeta o una suscripción):**
- **Con `expected_return_date`**: aparece en la zona de alertas con **mayor prominencia** que el resto (ej. tamaño más grande, color de acento distintivo, o posición fija al inicio de la lista) en vez de mezclarse igual que una alerta de tarjeta o recurrencia — el dinero prestado a una persona es más fácil de olvidar que una cuenta por pagar
- **Sin `expected_return_date`**: como no hay fecha contra la cual medir "próximos N días", **se muestra igual, de forma persistente**, cada vez que el usuario abre el Dashboard, en vez de quedar fuera de las alertas por no tener fecha — permanece visible hasta que el préstamo se marque como pagado (`status = paid`) en su totalidad

**Últimos movimientos**: sección adicional en el Dashboard, debajo de las cards de resumen, que muestra los **5 movimientos más recientes** (ingresos y gastos, ordenados por fecha descendente), con categoría, monto y de qué cuenta/tarjeta salió. Incluye un enlace "Ver todos" que lleva a la pantalla de Transacciones (accesible desde Cuenta, sección 3.6.1).

### 3.4.2 Módulo: Préstamos otorgados (dinero por cobrar)

Concepto distinto al de Deudas (3.4): ahí se rastrea dinero que **el usuario debe**; aquí se rastrea dinero que **le deben al usuario** — un préstamo que él le hizo a alguien más.

- **"Préstamo" es una categoría especial** dentro de las categorías de gasto (sección 3.8): al seleccionarla en el formulario de nuevo movimiento (sección 3.2), el formulario se expande **en el mismo paso** para pedir dos campos adicionales: **a quién** se le prestó, y **fecha esperada de devolución** (opcional)
- Al guardar, se crean dos cosas de forma atómica: (1) la transacción de gasto normal (el dinero sale de la cuenta/tarjeta elegida, como cualquier otro gasto), y (2) un registro en `loans_given` con el monto total como saldo pendiente inicial
- **Cobro de un préstamo** (total o parcial): se registra como un **ingreso** normal en el formulario de movimientos, pero ligado a ese préstamo específico — reduce `current_balance` del préstamo en la misma operación atómica que registra el ingreso
- Pantalla de seguimiento: lista de préstamos otorgados con su saldo pendiente, a quién, fecha esperada, y estado (activo/pagado). Acceso desde Cuenta, igual que Transacciones/Presupuestos/Metas (sección 3.6.1)
- **Impacto en patrimonio neto** (sección 3.6): el saldo pendiente total de préstamos otorgados se suma como un activo — patrimonio neto = saldo de cuentas + préstamos otorgados pendientes de cobro − deudas totales. Antes de este módulo, ese dinero se contaba como gasto perdido, subestimando el patrimonio real mientras el préstamo sigue vigente

### 3.5 Módulo: Metas de ahorro
- Meta con monto objetivo y fecha límite
- Aportaciones manuales o automáticas desde una cuenta
- Barra de progreso y proyección de cumplimiento según ritmo actual

### 3.6 Módulo: Reportes y proyecciones (prioridad marcada)
- Flujo de efectivo mensual/anual (ingresos vs egresos, incluyendo gastos pagados con tarjeta de crédito)
- Distribución de gastos por categoría (pie/bar chart)
- Tendencia histórica (línea de tiempo, 6-12-24 meses)
- Proyección de balance futuro: combina dos componentes en vez de solo un promedio simple —
  1. **Base histórica**: promedio móvil del flujo neto (ingresos − gastos, incluidos los pagados con tarjeta) de los últimos 3-6 meses, excluyendo transacciones marcadas como recurrentes (para no contarlas dos veces con el punto 2) **y excluyendo movimientos con `is_adjustment = true`** (un ajuste de saldo puntual y grande sesgaría el promedio varios meses)
  2. **Recurrencias conocidas**: suma explícita de las transacciones recurrentes activas (sección 3.2/Fase 8 — Netflix, Telmex, Strava, etc.) que van a ocurrir en cada mes proyectado, según su `recurring_frequency` y `next_occurrence_date`
  - La proyección de cada mes futuro = saldo del mes anterior + (promedio histórico no-recurrente) + (suma de recurrencias que caen en ese mes)
  - Esto captura mejor los cargos ya conocidos (ej. Strava solo pesa en su mes de renovación anual, no se diluye en el promedio de todos los meses) sin necesitar un modelo estadístico complejo
- **Gastos esenciales del mes**: suma de gastos cuya categoría tiene `is_essential = true` (sección 3.8), comparado contra el total del mes — responde directo "¿cuánto de lo que gasté era necesidad, y cuánto no?" (excluye movimientos con `is_adjustment = true`, sección 3.1, **y excluye la categoría especial "Préstamo"**, sección 3.4.2 — prestarle dinero a alguien es transferir un activo, no gastarlo, así que no debe contar ni como esencial ni como no esencial)
- **Gasto hormiga**: identifica transacciones de gasto **menores a $200 MXN** (umbral inicial, pensado para ajustarse después si se vuelve configurable) sin importar su categoría, y suma su total del mes — el objetivo es exponer el monto acumulado de compras pequeñas y frecuentes que individualmente no se sienten importantes pero suman más de lo evidente. Se muestra por separado de "gastos esenciales", ya que son dos cortes distintos de los mismos datos (uno por tipo de necesidad, otro por tamaño/frecuencia de transacción). Excluye movimientos con `is_adjustment = true` — un ajuste de saldo no es una compra real, por chico que sea — **y excluye la categoría "Préstamo"** por la misma razón que en gastos esenciales: no es un gasto real, es dinero que sigue siendo del usuario
- Patrimonio neto (saldo de cuentas + préstamos otorgados pendientes de cobro, sección 3.4.2 − deudas totales, incluidas tarjetas) a lo largo del tiempo
- Exportar reportes a PDF/CSV

### 3.6.1 Módulo: Navegación principal (rediseño estilo TikTok)

El menú inferior pasa de listar todas las pantallas a un esquema de **4 íconos + 1 botón central**, igual que TikTok:

- **Dashboard** (inicio)
- **Cuentas** (bancarias: efectivo/débito/inversión/ahorro, sección 3.1)
- **botón central (+)**: no navega a ninguna pantalla — abre directo el formulario de "nuevo movimiento" (sección 3.2)
- **Deudas** (sección 3.4, incluye tarjetas de crédito)
- **Reportes** (sección 3.6)

**Pantallas que ya no tienen ícono propio en el menú inferior**: Transacciones (como lista), Presupuestos, Metas, y Cuenta (perfil/configuración). Su acceso se resuelve así:
- Un **ícono de avatar** (usando `blobatar`, sección 3.7) en la esquina superior de todas las pantallas, siempre visible, que abre **Cuenta**
- Dentro de Cuenta, se agregan tres accesos directos al inicio de la pantalla (antes de las secciones de perfil/ajustes): **Transacciones**, **Presupuestos**, **Metas** — quedan a 2 toques (avatar → acceso) en vez de perdidos
- Adicionalmente, las cards de resumen en el Dashboard (saldo total, presupuesto del mes, progreso de metas, alertas de próximos pagos) llevan un enlace "Ver más" que salta directo a Transacciones/Presupuestos/Metas respectivamente — así el camino más frecuente (desde Dashboard) queda en 1 toque

### 3.7 Módulo: Cuenta

Hoy esta pantalla solo tiene el botón de cerrar sesión — se expande para verse a la altura de una app de pago:

- **Accesos directos** (nuevo, ver 3.6.1): Transacciones, Presupuestos, Metas — al inicio de la pantalla, antes de todo lo demás
- **Encabezado de perfil**: avatar generado con `blobatar`, sembrado con el **user id** de Supabase Auth (no el email) para que sea verdaderamente estable — el user id nunca cambia, mientras que el email sí se puede cambiar desde Seguridad más abajo, lo que rompería la determinística si se usara como semilla. Nombre para mostrar y correo se muestran junto al avatar
- **Editar nombre para mostrar**: guardado en `user_metadata` de Supabase Auth (no requiere tabla nueva). **Se captura por primera vez en el registro** (pantalla de crear cuenta pide nombre/apodo además de correo y contraseña), y sigue siendo editable después desde aquí
- **Apariencia**: switch de modo oscuro/claro (el mismo de la Fase 9, pero accesible también desde aquí, no solo desde un ícono suelto en la nav)
- **Categorías personalizadas**: gestión de categorías (crear/editar/eliminar), incluyendo marcar cada categoría de gasto como esencial o no esencial (sección 3.6/3.8) — ya estaba contemplado, nunca se construyó la UI
- **Datos**: exportar todos los movimientos a CSV/JSON (backup manual — ya estaba contemplado en el alcance original, nunca se construyó)
- **Seguridad**: cambiar contraseña (vía `supabase.auth.updateUser`)
- **Cuenta**: cerrar sesión (ya existe); opcionalmente una zona de "Eliminar cuenta" separada visualmente (zona de peligro, confirmación explícita antes de borrar, cascada de todos los datos del usuario vía RLS)
- **Pie de página**: versión de la app (ej. "v1.0.0"), como detalle de pulido que refuerza la sensación de app terminada

**Nota para el desarrollo:** esto es una ampliación de una pantalla existente, no una reescritura — Claude Code debe limitarse a esta página/componente y a las nuevas piezas que dependan directamente de ella (avatar, export, cambio de contraseña), sin tocar lógica de otras pantallas que ya funcionan.

### 3.8 Catálogos precargados (México)

**Bancos principales** (para nombrar/iconografiar cuentas y tarjetas, sin integración real):
BBVA, Santander, Banorte, Citibanamex, HSBC, Scotiabank, Inbursa, Banco Azteca, BanBajío, Banregio, Banco del Bienestar, Nu México, Klar, Hey Banco (Banregio), **Mercado Pago** (ya emite tarjeta de crédito propia en México, faltaba en el catálogo).

**Logos reales (uso nominativo, identificación únicamente):** cada banco del catálogo se muestra con su logo real, obtenido vía **Logo.dev** (sucesor oficial de Clearbit Logo API, descontinuada en diciembre 2025) — su plan gratuito no exige atribución visible para proyectos personales/no comerciales, que es el caso de esta app. Los logos son solo para identificar visualmente de qué banco es cada cuenta/tarjeta — nunca implican patrocinio o afiliación con la institución.

**Negocios/comercios comunes** (para autocompletar y sugerir categoría):
- Supermercados: Walmart, Soriana, Chedraui, La Comer, Bodega Aurrerá
- Conveniencia: Oxxo, 7-Eleven, Extra
- Farmacias: Farmacias del Ahorro, Farmacias Guadalajara, Similares
- Restaurantes/delivery: Rappi, Uber Eats, Didi Food
- Transporte: Uber, Didi, Metro/Metrobús
- Streaming/suscripciones: Netflix, Spotify, Disney+, Amazon Prime
- Telecom: Telcel, AT&T México, Movistar, Izzi, Totalplay

**Categorías por defecto** (precargadas para que el usuario no arranque con la lista vacía; siguen siendo editables/ampliables desde Configuración). Cada una viene con `is_essential` sugerido por defecto (editable después, sección 3.7):

*Ingresos:*
Nómina/Salario, Freelance/Negocio propio, Reembolsos, Otros ingresos

*Gastos — esenciales por defecto:*
Vivienda (renta/hipoteca), Servicios (luz, agua, gas, internet), Salud, Transporte, Pago de tarjetas/deudas

*Gastos — no esenciales por defecto:*
Comida y supermercado, Restaurantes y antojos, Entretenimiento, Ropa y accesorios, Educación, Suscripciones, Ahorro e inversión, Mascotas, Regalos y donaciones, **Préstamo** (categoría especial — ver sección 3.4.2, dispara campos extra de seguimiento en el formulario), **Otros gastos** (categoría genérica de cajón para lo que no encaje en ninguna otra, distinta de dejar el campo vacío)

Nota: "Comida y supermercado" queda como no esencial por defecto de forma deliberada, aunque comer sí es una necesidad — la razón es que el usuario ya la trata en la práctica como una categoría donde se mezcla lo esencial (despensa) con lo prescindible (antojos), y es más útil dejarla editable/revisable por el usuario que asumir un valor que probablemente no coincida con su realidad.

El campo de categoría en el formulario de transacciones debe listar estas categorías por defecto desde el primer uso — dejar el movimiento "sin categoría" debe ser una opción explícita más, no la única disponible.

## 4. Modelo de datos (Postgres/Supabase)

```
users (manejado por Supabase Auth)

accounts (SOLO efectivo, débito, inversión, ahorro — NUNCA tarjeta de crédito)
  id, user_id, name, type, bank_name (nullable), initial_balance, created_at

categories
  id, user_id, name, parent_id (nullable), type (income/expense), icon, color,
  is_essential (nullable, solo aplica a type=expense — ver sección 3.8, sugerido por
  defecto y editable por el usuario)

merchants (catálogo, no ligado a user_id — dato de referencia compartido)
  id, name, default_category_id (nullable)

transactions
  id, user_id, account_id (nullable), debt_id (nullable — solo cuando type=expense
    y se paga con tarjeta de crédito; en ese caso account_id es NULL),
  category_id, merchant_id (nullable — solo aplica a type=expense), type (income/expense/transfer),
  amount, date, note, tags (nullable — solo aplica a type=expense),
  is_adjustment (default false — true solo en movimientos de ajuste de saldo, sección 3.1;
    se excluye de gasto hormiga, gastos esenciales/no esenciales y presupuestos, pero
    sí afecta el saldo calculado de la cuenta),
  is_recurring, recurring_frequency (nullable — weekly/monthly/annual/custom, solo si is_recurring),
  recurring_interval_days (nullable — solo si recurring_frequency=custom),
  recurring_end_date (nullable — si es NULL, la recurrencia no tiene fecha de fin),
  recurring_is_automatic (nullable, solo si is_recurring — true = domiciliado, el cron genera
    la transacción solo; false = manual, solo genera recordatorio hasta que el usuario confirma),
  created_at
  -- regla: exactamente uno de account_id / debt_id debe estar definido en un gasto;
  -- income y transfer siempre usan account_id (nunca debt_id), y nunca llevan merchant_id ni tags

budgets
  id, user_id, category_id, month, amount_limit, alert_threshold_pct

debts (incluye tarjetas de crédito, préstamos y deudas personales)
  id, user_id, name, type (credit_card/loan/personal),
  credit_limit (nullable, solo type=credit_card),
  bank_name (nullable, solo type=credit_card — catálogo de bancos),
  interest_rate, minimum_payment (editable cada periodo, sobre todo credit_card),
  due_day (préstamo/personal) / cutoff_day y payment_due_day (nullable, solo credit_card),
  current_balance (aumenta con gastos pagados con esta deuda, disminuye con pagos),
  created_at

debt_payments
  id, debt_id, account_id, amount, date, note

goals
  id, user_id, name, target_amount, current_amount, target_date, account_id

goal_contributions
  id, goal_id, amount, date

loans_given (préstamos que el usuario le da a alguien más — sección 3.4.2, opuesto a debts)
  id, user_id, transaction_id (la transacción de gasto original que lo originó),
  borrower_name, expected_return_date (nullable), current_balance,
  status (active/paid), created_at

loan_repayments
  id, loan_given_id, transaction_id (el ingreso que registra el cobro), amount, date

push_subscriptions (Fase 10 — Web Push)
  id, user_id, endpoint, keys_p256dh, keys_auth, created_at
```

Row Level Security: todas las tablas con `user_id` filtradas por `user_id = auth.uid()`. Los catálogos (`merchants`) son de solo lectura para todos los usuarios autenticados.

## 5. Requerimientos no funcionales

- **Mobile-first**: diseño pensado primero para pantalla de iPhone (Safari), adaptado después a escritorio con breakpoints de Tailwind
- Instalable como PWA en el iPhone ("Agregar a pantalla de inicio"), con ícono y modo pantalla completa
- Funcionamiento offline básico vía Service Worker (cache de assets y última data cargada); sincronización al recuperar conexión, no en tiempo real
- Seguridad: RLS en Supabase + autenticación obligatoria
- **Atomicidad de transacciones**: operaciones que afectan más de una tabla (transferencias entre cuentas, aportación a meta que descuenta de una cuenta, gasto pagado con tarjeta que actualiza `current_balance` de la deuda, pago de deuda que registra en `debt_payments` y descuenta el saldo de la cuenta de origen) deben ejecutarse como transacciones atómicas de Postgres (funciones RPC de Supabase con `BEGIN/COMMIT` implícito), nunca como escrituras separadas desde el cliente
- **Validación de saldo/límite**: la restricción de "no saldo negativo" en cuentas y la de "no exceder `credit_limit`" en tarjetas deben validarse a nivel de base de datos (constraint o función RPC), no solo en el frontend, para evitar inconsistencias
- Costo: $0 en todos los servicios mientras se mantenga dentro de límites de free tier
- Sin necesidad de Mac, Xcode ni cuenta de Apple Developer

## 6. Historial de corrección de diseño: tarjetas de crédito

Este punto pasó por dos iteraciones antes de llegar al modelo final (sección 3.1/3.2/3.4 y el modelo de datos arriba ya reflejan la versión final; esta sección documenta el porqué, para referencia):

1. **Diseño original**: tarjeta de crédito como registro duplicado en `debts`, sin relación con `accounts`. Problema: no se podía pagar un gasto con tarjeta de crédito.
2. **Primer intento de corrección**: mover la tarjeta de crédito a `accounts` (tipo `credit`) y eliminar el duplicado en `debts`. Problema: causó confusión de UX y discrepancias entre el saldo mostrado y la deuda real al usarse en paralelo con datos ya capturados.
3. **Diseño final (vigente)**: `accounts` **nunca** incluye tarjetas de crédito — solo efectivo, débito, inversión, ahorro. Las tarjetas de crédito viven completa y únicamente en `debts`, y un gasto puede pagarse tomando como origen una cuenta O una tarjeta de crédito directamente (campo `debt_id` en `transactions`), sin pasar por `accounts` en ese segundo caso.

**Tareas de migración para Claude Code (de la iteración 2 a la final):**
- Quitar el tipo `credit` de `accounts` (o impedir que se sigan creando cuentas de ese tipo)
- Quitar las columnas `credit_limit`, `interest_rate`, `minimum_payment`, `cutoff_day`, `payment_due_day` de `accounts` si ya se habían agregado ahí
- Agregar esas mismas columnas a `debts` (ver modelo de datos, sección 4), junto con `bank_name`
- Para cada cuenta existente tipo `credit`: crear su registro correspondiente en `debts` (type=credit_card) con los valores capturados (saldo usado como `current_balance`, límite, tasa, pago mínimo, fechas), y **archivar la cuenta** (agregar `archived_at` a `accounts` si no existe, marcarla en vez de borrarla) para no perder el dato real ya capturado
- Agregar la columna `debt_id` (nullable) a `transactions`; para cada transacción de gasto que haya quedado ligada a una cuenta que en realidad era tarjeta de crédito, reasignarla al `debt_id` correspondiente y limpiar su `account_id`
- Actualizar el formulario de gastos para que el selector de "pagar con" muestre cuentas Y tarjetas de crédito (de `debts`) como opciones de un mismo picker, marcando cuál es cuál
- Actualizar la vista de Deudas para mostrar tarjetas, préstamos y deudas personales juntos
- Construir la zona de alertas de próximos pagos en el Dashboard (sección 3.4.1)

## 7. Fases sugeridas de desarrollo

1. **Fase 1 — Base**: Next.js + Supabase Auth + Cuentas + Transacciones (CRUD completo)
2. **Fase 2 — Control**: Presupuestos + alertas
3. **Fase 3 — Deudas y metas**: módulos completos con simuladores
4. **Fase 4 — Reportes**: gráficas, proyecciones, exportación
5. **Fase 5 — PWA y pulido**: instalación en iPhone, offline cache, ajustes mobile-first finales
6. **Fase 6 — Auditoría de seguridad y atomización**: revisión de políticas RLS por tabla, conversión de operaciones multi-tabla a funciones RPC atómicas, revisión de manejo de sesión/tokens de Supabase Auth, pruebas de que un usuario no pueda leer/escribir datos de otro usuario
7. **Fase 7 — Pruebas**: casos de prueba automatizados y manuales, entre ellos:
   - No se puede registrar un gasto que deje saldo negativo en una cuenta
   - Sí se puede registrar un gasto con tarjeta de crédito hasta el `credit_limit`, y se rechaza al superarlo
   - Un pago de deuda (tarjeta, préstamo o personal) desde una cuenta descuenta correctamente el saldo de la cuenta Y actualiza `current_balance` de la deuda en la misma operación (si una falla, ambas se revierten)
   - Un gasto pagado con tarjeta de crédito aumenta correctamente `current_balance` de esa tarjeta, sin tocar ninguna cuenta
   - Transferencia entre cuentas: si la cuenta origen no tiene fondos suficientes, se rechaza sin afectar la cuenta destino
   - Aportación a meta de ahorro descuenta correctamente de la cuenta de origen
   - Pruebas de RLS: un usuario no puede ver ni modificar cuentas/transacciones/deudas de otro usuario
   - Pruebas de reportes: los totales de flujo de efectivo y patrimonio neto cuadran contra la suma manual de transacciones de prueba (incluyendo gastos con tarjeta)
8. **Fase 8 — Motor de recurrencias automáticas**: hoy `recurring_frequency`/`recurring_end_date` solo son metadatos; nada genera la transacción del siguiente periodo automáticamente. Implementación:
   - Agregar columna `next_occurrence_date` a `transactions` (solo relevante cuando `is_recurring = true`)
   - Un **Vercel Cron Job** (disponible en el plan gratuito, ejecutable 1 vez al día) llama diariamente a una ruta protegida (ej. `/api/cron/generate-recurring`), validando un secreto compartido para que no sea invocable públicamente
   - Esa ruta busca transacciones plantilla (`is_recurring = true`, **`recurring_is_automatic = true`**) con `next_occurrence_date <= hoy` y (`recurring_end_date IS NULL` o `recurring_end_date >= hoy`); por cada una, crea una nueva transacción real (`is_recurring = false`, es solo una ocurrencia) con los mismos datos (cuenta/tarjeta, categoría, monto, comercio), y actualiza `next_occurrence_date` de la plantilla sumando el intervalo según `recurring_frequency`
   - **Las plantillas con `recurring_is_automatic = false` (manuales) NO se tocan en este cron** — se manejan solo como recordatorio persistente en la zona de alertas del Dashboard (sección 3.4.1), y su `next_occurrence_date` únicamente avanza cuando el usuario confirma el movimiento a mano vía el botón "Marcar como pagada" — nunca se avanza ni se oculta el recordatorio solo por el paso del tiempo
   - **Regla de anclaje al confirmar tarde (aplica solo a manuales)**: el nuevo `next_occurrence_date` se calcula sumando el intervalo (`recurring_frequency`) **a partir de la `next_occurrence_date` que ya tenía programada**, nunca a partir de la fecha real en que el usuario confirma. Así, si el día ancla es "cada lunes" y el usuario confirma en miércoles porque se le pasó, el siguiente recordatorio sigue siendo el próximo lunes — el ciclo nunca se recorre por confirmar tarde
   - **Idempotencia obligatoria**: antes de crear la ocurrencia, verificar que no exista ya una transacción generada para esa plantilla y esa fecha (evita duplicados si el cron corre dos veces o falla a medias)
   - Casos de prueba: Netflix (mensual) genera exactamente una transacción por mes sin duplicarse; Strava (anual) no genera nada en los meses intermedios; una recurrencia con `recurring_end_date` ya vencida deja de generar
9. **Fase 9 — Pulido de UX**: modo oscuro, accesibilidad y animaciones/transiciones
   - **Modo oscuro**: el sistema de diseño de referencia (monday.com/Refero) es exclusivamente claro — no trae variante oscura definida. Se debe derivar una paleta oscura propia (invertir `--color-cloud`/`--color-snow` por tonos oscuros, ajustar los pasteles de acento para que mantengan contraste legible sobre fondo oscuro) manteniendo violeta `#6161ff` como color de acción en ambos modos. Toggle manual + respeto de `prefers-color-scheme` del sistema como default, guardado en cookie o localStorage
   - **Accesibilidad**: contraste mínimo AA en texto sobre fondos pastel y oscuros, foco visible en todo elemento interactivo, `aria-label` en íconos sin texto visible, tamaño mínimo de 44px en objetivos táctiles (dado el enfoque mobile-first), formularios navegables y anunciables por lector de pantalla
   - **Animaciones/transiciones**: microinteracciones sutiles en botones y cards (hover/press), transición suave entre estados de carga (skeleton → contenido) y al navegar entre pestañas, respetando `prefers-reduced-motion` para quien lo tenga activado
10. **Fase 10 — Notificaciones push reales (Web Push en iOS)**: hasta ahora las "Alertas de próximos pagos" (sección 3.4.1) solo se ven al abrir la app. Desde iOS 16.4+, Safari soporta Web Push real para PWAs instaladas en pantalla de inicio (que es un requisito que la app ya cumple). Implementación:
    - Generar par de llaves VAPID (librería `web-push`, gratis, sin cuenta externa) — la privada como variable de entorno en Vercel, la pública en el frontend
    - Nueva tabla `push_subscriptions` (ver sección 4): guarda el endpoint de suscripción push por usuario y dispositivo
    - En Cuenta (sección 3.7), agregar un switch "Activar notificaciones" que pida permiso del navegador y guarde la suscripción
    - Agregar listener del evento `push` al Service Worker existente (Fase 5) para mostrar la notificación del sistema
    - **No se reutiliza el cron de recurrencias de la Fase 8 tal cual** — ese cron (`generate-recurring`) solo dispara cuando `next_occurrence_date <= hoy`, es decir, el día exacto del cargo, y no toca tarjetas, deudas ni préstamos otorgados en absoluto. Se necesita un **cron nuevo y separado** (o una segunda función dentro del mismo job) que replique la misma consulta que ya usa la zona de alertas del Dashboard (sección 3.4.1: tarjetas, deudas, recurrencias y préstamos otorgados dentro de la ventana de "próximos N días") y, para cada resultado, envíe la notificación push real a los endpoints guardados del usuario
    - **Limitaciones conocidas de iOS a aceptar, no a "arreglar"**: la entrega no es 100% confiable (reportes de desuscripciones inesperadas tras reiniciar el dispositivo), y no soporta push silencioso (no puede actualizar datos en segundo plano, solo mostrar la notificación) — por eso las alertas visuales del Dashboard se mantienen como respaldo, esto es un complemento, no un reemplazo
    - No se puede probar en local/desarrollo — requiere HTTPS real, se prueba directo contra el deploy de Vercel desde el iPhone

## 8. Diseño visual

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

**Corrección (confirmado por auditoría de código):** `DESIGN.md` nunca se creó como archivo — los tokens reales de este sistema viven implementados directamente en `src/app/globals.css` (`--color-monday-violet`, `--color-mint`, `--color-apricot`, `--color-lavender`, `--color-sky`, `--color-periwinkle`, `--shadow-card`, clases `rounded-card`/`rounded-pill`, etc.). Cualquier trabajo de diseño futuro debe referenciar `globals.css` como fuente de verdad, no un archivo `DESIGN.md` que no existe en el repositorio.

**Arquitectura de componentes (confirmado por auditoría de código):** `src/components/ui/` (Button, Card, Badge, Input) es **100% custom, no shadcn/ui** — no hay `components.json`, ni dependencias `@radix-ui/*`, ni `class-variance-authority`; son elementos HTML planos con el helper `cn()` (clsx + tailwind-merge) y variantes escritas a mano. Adoptar shadcn/ui de verdad implicaría un refactor aparte (correr su CLI puede sobrescribir estos 4 componentes), no una instalación aditiva — no se debe asumir compatibilidad automática con librerías que "se instalan vía CLI de shadcn" sin antes decidir explícitamente si se migra o no.

**Ícono de la app (PWA / pantalla de inicio de iPhone):** fondo cuadrado violeta `#6161ff`, anillo blanco centrado (grosor ~8% del ancho del ícono), símbolo `$` centrado dentro del anillo en tipografía **Manrope** peso 800 (extra bold), color blanco. Manrope ya es el primer sustituto definido para Poppins en este mismo sistema de diseño, así que se carga igual vía `next/font/google` sin agregar una fuente nueva fuera del stack ya aprobado. El archivo fuente debe exportarse como cuadrado completo sin esquinas redondeadas (iOS aplica su propia máscara de recorte).

## 9. Límites del free tier a monitorear

- Supabase free: 500MB BD, pausa el proyecto tras 7 días de inactividad (hay que reactivarlo entrando al dashboard)
- Vercel / Cloudflare Pages: sin costo para tráfico personal, sin límite práctico para este caso de uso

## 10. Ideas a futuro (no priorizadas todavía)

**Carga de gastos por voz** — complejidad estimada: 7/10. No se agenda en ninguna fase activa; queda documentada aquí para retomarla cuando se decida avanzar.

- Riesgo de confiabilidad en iOS: la Web Speech API del navegador (gratis) ha sido históricamente inconsistente en Safari/iOS, especialmente dentro de una PWA instalada en modo standalone — hay que probarlo directo en el iPhone real antes de comprometerse, igual que con las notificaciones push (Fase 10)
- Dos caminos para interpretar el texto transcrito y convertirlo en una transacción estructurada (monto, comercio, categoría):
  1. **100% gratis**: reglas simples (regex + el catálogo de comercios/categorías de la sección 3.8) — funciona para frases simples y predecibles, se rompe con lenguaje natural variado
  2. **Casi gratis, más confiable**: enviar el texto transcrito a un modelo de lenguaje (ej. API de Claude) para interpretarlo — mucho más robusto ante frases naturales, pero deja de ser exactamente $0 (costo estimado en fracciones de centavo por uso personal)
- **Requisito no negociable si se construye**: pantalla de confirmación que muestre lo que se entendió (monto, comercio, categoría) antes de guardar la transacción — nunca guardar directo desde el resultado de voz sin revisión, dado que es una app de finanzas reales

