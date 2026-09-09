# Pruebas — Finanzas

Cobertura de pruebas del proyecto, mapeada contra los casos de prueba pedidos en la sección "Fase 7" del documento de requerimientos (`requerimientos-app-financiera.md`).

## Automatizadas

### Unitarias (lógica pura) — `npm run test` (Vitest)

| Archivo | Qué prueba |
|---|---|
| `src/lib/validations/balance.test.ts` | Regla de saldo negativo / límite de crédito (espejo de la RPC de transacciones) |
| `src/lib/budget-status.test.ts` | Estado de presupuesto (ok / alerta / excedido) |
| `src/lib/amortization.test.ts` | Simulador de amortización de deudas |
| `src/lib/debt-strategy.test.ts` | Orden bola de nieve / avalancha |
| `src/lib/goal-projection.test.ts` | Proyección de cumplimiento de metas de ahorro |
| `src/lib/cash-flow.test.ts` | Agrupación de ingresos/gastos por mes |
| `src/lib/category-distribution.test.ts` | Distribución de gastos por categoría (incluye agrupar en "Otros") |
| `src/lib/net-worth.test.ts` | Cálculo y proyección de patrimonio neto histórico |
| `src/lib/csv-export.test.ts` | Generación de CSV (escapado de comas/comillas) |

### Integración contra Supabase real — `scripts/verify-*.mjs`

Requieren credenciales de un proyecto Supabase real (ver README → Setup). Cada script crea sus propios datos de prueba y los borra al terminar.

| Caso de prueba (doc, Fase 7) | Cubierto por |
|---|---|
| No se puede registrar un gasto que deje saldo negativo en cuenta efectivo/débito/ahorro | `verify-transaction-rpc.mjs` |
| Sí se puede gastar en cuenta de crédito hasta el `credit_limit`, se rechaza al superarlo | `verify-transaction-rpc.mjs` |
| Transferencia entre cuentas se rechaza sin fondos suficientes, sin afectar la cuenta destino | `verify-transaction-rpc.mjs` |
| Pago de deuda descuenta la cuenta Y actualiza `current_balance` de la deuda atómicamente; si falla, ambas se revierten | `verify-debt-payment-rpc.mjs` |
| Aportación a meta de ahorro descuenta correctamente la cuenta de origen | `verify-goal-contribution-rpc.mjs` |
| RLS: un usuario no puede ver ni modificar cuentas/transacciones/deudas/metas de otro usuario | `verify-cross-user-isolation.mjs` |
| Reportes: los totales de flujo de efectivo y patrimonio neto cuadran contra la suma manual de transacciones de prueba | `verify-reports-data.mjs` |

Además, sin caso explícito en el doc pero cubierto: `verify-budgets.mjs` (constraint único categoría/mes, cálculo gastado-vs-presupuestado, aislamiento entre meses).

### Correr todo de una vez

```bash
npm run verify:all
```

Crea dos usuarios de prueba temporales directo por SQL (evita el rate-limit de envío de correo de Supabase), corre los 6 scripts de integración en orden, imprime un resumen, y borra los usuarios al terminar — incluso si algo falla a medio camino. Requiere la CLI de Supabase ya vinculada (`supabase link`, ya hecho en este proyecto) disponible en el `PATH`, y `.env.local` configurado.

También se puede correr cada uno por separado (siguen pidiendo un usuario de prueba propio vía variables de entorno, ver README): `npm run verify:transactions`, `verify:budgets`, `verify:debts`, `verify:goals`, `verify:reports`, `verify:isolation`.

## Manuales (checklist)

Cosas que no se prestan a automatización sin un dispositivo o navegador real:

- [ ] Registro → confirmación de correo → login, en un celular real
- [ ] Recuperar contraseña end-to-end (que el correo llegue y el link funcione)
- [ ] Crear cuenta, transacción, presupuesto, deuda y meta desde un iPhone (Safari) — que los formularios y botones sean cómodos con el pulgar
- [ ] Revisar las 3 gráficas de Reportes en una pantalla de ~375px de ancho (sin scroll horizontal roto, tooltips legibles)
- [ ] Exportar CSV desde Reportes y abrirlo en Excel/Sheets — que los acentos se vean bien (BOM UTF-8)
- [ ] Exportar PDF (imprimir) desde Reportes — que no aparezca el nav/sidebar en la hoja impresa
- [ ] "Agregar a pantalla de inicio" en un iPhone real contra la URL ya desplegada (requiere HTTPS — ver limitación en README, sección PWA)
- [ ] Con la PWA ya instalada, apagar el wifi/datos del celular y abrir la app — debe mostrar la última página cargada o la pantalla "Sin conexión", nunca un error en blanco del navegador
