import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnimatedAmount } from "@/components/ui/animated-amount";
import { formatMXN, formatDate } from "@/lib/format";
import { ACCOUNT_TYPE_LABELS } from "@/lib/constants/account-types";
import { getExpenseTotalsByCategory } from "@/lib/budgets-data";
import { getCurrentMonth, formatTodayLabel } from "@/lib/date-utils";
import { getBudgetStatus } from "@/lib/budget-status";
import { getUpcomingPayments } from "@/lib/upcoming-payments";
import { CalendarClock, HandCoins } from "lucide-react";
import type { Account, Budget, Debt, Goal, Transaction } from "@/types/database";

interface RecentTransactionRow {
  id: string;
  type: "income" | "expense" | "transfer";
  amount: number;
  date: string;
  account: { name: string } | null;
  debt: { name: string } | null;
  category: { name: string } | null;
}

interface LoanAlertRow {
  id: string;
  borrower_name: string;
  expected_return_date: string | null;
  current_balance: number;
}

const DAYS_WINDOW = 5;

export default async function DashboardPage() {
  const supabase = await createClient();
  const month = getCurrentMonth();

  const [
    {
      data: { user },
    },
    { data: accounts },
    { data: budgets },
    { data: debts },
    { data: recurringTransactions },
    { data: goals },
    { data: activeLoans },
    { data: recentTransactions },
    spentByCategory,
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("accounts").select("*").is("archived_at", null).order("created_at", { ascending: true }),
    supabase.from("budgets").select("*").eq("month", `${month}-01`),
    supabase.from("debts").select("*").is("archived_at", null),
    supabase.from("transactions").select("*").eq("is_recurring", true),
    supabase.from("goals").select("*"),
    // Sección 3.4.2 del doc: préstamos otorgados activos, para el
    // tratamiento especial en la zona de alertas (más abajo).
    supabase.from("loans_given").select("id, borrower_name, expected_return_date, current_balance").eq("status", "active"),
    // Sección 3.4.1 del doc ("Últimos movimientos"): solo ingreso/gasto (no
    // transferencias), las 5 más recientes.
    supabase
      .from("transactions")
      .select(
        "id, type, amount, date, account:accounts!transactions_account_id_fkey(name), debt:debts(name), category:categories(name)"
      )
      .in("type", ["income", "expense"])
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5),
    getExpenseTotalsByCategory(supabase, month),
  ]);

  // Fase de saludo: mismo user_metadata.full_name que Cuenta lee/edita —
  // cuentas creadas antes de este cambio no lo tienen, de ahí el respaldo.
  const fullName = (user?.user_metadata?.full_name as string | undefined)?.trim();
  const greeting = fullName ? `¡Hola, ${fullName}!` : "¡Hola!";

  const list = (accounts ?? []) as Account[];
  const totalBalance = list.reduce((sum, a) => sum + a.current_balance, 0);

  const debtList = (debts ?? []) as Debt[];
  const totalDebt = debtList.reduce((sum, d) => sum + d.current_balance, 0);
  const creditCardDebt = debtList
    .filter((d) => d.type === "credit_card")
    .reduce((sum, d) => sum + d.current_balance, 0);

  const budgetList = (budgets ?? []) as Budget[];
  const overOrWarningCount = budgetList.filter((b) => {
    const status = getBudgetStatus(spentByCategory[b.category_id] ?? 0, b.amount_limit, b.alert_threshold_pct);
    return status !== "ok";
  }).length;

  const goalList = (goals ?? []) as Goal[];
  const goalsCompleted = goalList.filter((g) => g.current_amount >= g.target_amount).length;

  const recentTransactionList = (recentTransactions ?? []) as unknown as RecentTransactionRow[];

  const upcomingPayments = getUpcomingPayments({
    debts: debtList,
    recurringTransactions: (recurringTransactions ?? []) as Transaction[],
  });

  // Sección 3.4.1 del doc: tratamiento especial de préstamos otorgados —
  // con fecha, solo si está próxima (mismo criterio que el resto de
  // alertas); sin fecha, se muestran SIEMPRE, sin depender de la ventana de
  // "próximos N días" (quedarían fuera para siempre si dependieran de ella).
  const todayMidnight = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  const loanAlerts = ((activeLoans ?? []) as LoanAlertRow[])
    .map((l) => {
      if (!l.expected_return_date) return { ...l, daysUntil: null };
      const [y, m, d] = l.expected_return_date.slice(0, 10).split("-").map(Number);
      const daysUntil = Math.round((Date.UTC(y, m - 1, d) - todayMidnight) / 86_400_000);
      return { ...l, daysUntil };
    })
    .filter((l) => l.daysUntil === null || l.daysUntil <= DAYS_WINDOW)
    .sort((a, b) => (a.daysUntil ?? -1) - (b.daysUntil ?? -1));

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-light text-ink md:text-3xl">{greeting}</h1>
        <p className="text-sm text-slate">{formatTodayLabel()}</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <Card tone="mint" className="w-full max-w-sm">
          <p className="text-sm font-medium text-slate">Saldo total</p>
          <p className="mt-2 text-3xl font-light text-ink">
            <AnimatedAmount value={totalBalance} />
          </p>
          <Link href="/accounts" className="mt-2 inline-block text-sm font-medium text-violet-text">
            Ver cuentas
          </Link>
        </Card>

        {goalList.length > 0 && (
          <Card tone="periwinkle" className="w-full max-w-sm">
            <p className="text-sm font-medium text-slate">Metas de ahorro</p>
            <p className="mt-2 text-3xl font-light text-ink">
              {goalsCompleted > 0 ? `${goalsCompleted} de ${goalList.length} cumplidas` : `${goalList.length} en progreso`}
            </p>
            <Link href="/goals" className="mt-2 inline-block text-sm font-medium text-violet-text">
              Ver metas
            </Link>
          </Card>
        )}

        {budgetList.length > 0 && (
          <Card tone={overOrWarningCount > 0 ? "apricot" : "mint"} className="w-full max-w-sm">
            <p className="text-sm font-medium text-slate">Presupuestos este mes</p>
            <p className="mt-2 text-3xl font-light text-ink">
              {overOrWarningCount > 0 ? `${overOrWarningCount} en alerta` : "Todo al día"}
            </p>
            <Link href="/budgets" className="mt-2 inline-block text-sm font-medium text-violet-text">
              Ver presupuestos
            </Link>
          </Card>
        )}

        {totalDebt > 0 && (
          <Card tone="lavender" className="w-full max-w-sm">
            <p className="text-sm font-medium text-slate">Deudas totales</p>
            <p className="mt-2 text-3xl font-light text-ink">
              <AnimatedAmount value={totalDebt} />
            </p>
            {creditCardDebt > 0 && (
              <p className="mt-1 text-xs text-slate">Incluye {formatMXN(creditCardDebt)} en tarjetas de crédito</p>
            )}
            <Link href="/debts" className="mt-2 inline-block text-sm font-medium text-violet-text">
              Ver deudas
            </Link>
          </Card>
        )}
      </div>

      {upcomingPayments.length > 0 && (
        <Card tone="apricot">
          <div className="mb-2 flex items-center gap-2">
            <CalendarClock size={18} className="text-monday-violet" />
            <p className="text-lg font-medium text-ink">Recordatorios de pago</p>
          </div>
          <ul className="flex flex-col gap-2">
            {upcomingPayments.map((p) => (
              <li key={p.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink">
                  {p.name}
                  {p.amount != null && <span className="text-slate"> · {formatMXN(p.amount)}</span>}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  {/* Secciones 3.2/3.4.1 del doc: solo las recurrencias
                      MANUALES (recurring_is_automatic=false) llevan este
                      botón — las automáticas ya se van a generar solas, el
                      recordatorio es puramente informativo. */}
                  {p.source === "recurring_transaction" && p.isAutomatic === false && (
                    <Link
                      href={`/transactions?new=1&templateId=${p.templateId}`}
                      className="rounded-pill bg-monday-violet px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-monday-violet/90"
                    >
                      Registrar ahora
                    </Link>
                  )}
                  <Badge tone={p.daysUntil <= 2 ? "danger" : "warning"}>
                    {p.daysUntil === 0 ? "Vence hoy" : p.daysUntil === 1 ? "Vence mañana" : `Vence en ${p.daysUntil} días`}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium text-ink">Cuentas</h2>
          <Link href="/accounts" className="text-sm font-medium text-violet-text">
            Ver todas
          </Link>
        </div>

        {list.length === 0 ? (
          <Card>
            <p className="text-sm text-slate">
              Aún no tienes cuentas.{" "}
              <Link href="/accounts" className="font-medium text-violet-text">
                Crea tu primera cuenta
              </Link>
              .
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((account) => (
              <Card key={account.id}>
                <p className="text-sm text-slate">{ACCOUNT_TYPE_LABELS[account.type]}</p>
                <p className="mt-1 font-medium text-ink">{account.name}</p>
                <p className="mt-3 text-xl font-light text-ink">
                  {formatMXN(account.current_balance)}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>

      {loanAlerts.length > 0 && (
        <Card tone="lavender" className="border-l-4 border-monday-violet">
          <div className="mb-2 flex items-center gap-2">
            <HandCoins size={18} className="text-monday-violet" />
            <p className="text-lg font-medium text-ink">Préstamos por cobrar</p>
          </div>
          <ul className="flex flex-col gap-2">
            {loanAlerts.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-ink">{l.borrower_name}</p>
                  <p className="text-sm text-slate">{formatMXN(l.current_balance)} pendientes</p>
                </div>
                {l.daysUntil === null ? (
                  <Badge tone="info">Sin fecha</Badge>
                ) : (
                  <Badge tone={l.daysUntil <= 2 ? "danger" : "warning"}>
                    {l.daysUntil <= 0 ? "Vence hoy" : l.daysUntil === 1 ? "Vence mañana" : `Vence en ${l.daysUntil} días`}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
          <Link href="/loans" className="mt-3 inline-block text-sm font-medium text-violet-text">
            Ver préstamos
          </Link>
        </Card>
      )}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium text-ink">Últimos movimientos</h2>
          <Link href="/transactions" className="text-sm font-medium text-violet-text">
            Ver todos
          </Link>
        </div>

        {recentTransactionList.length === 0 ? (
          <Card>
            <p className="text-sm text-slate">Aún no tienes movimientos registrados.</p>
          </Card>
        ) : (
          <Card className="flex flex-col gap-3">
            {recentTransactionList.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{t.category?.name ?? "Sin categoría"}</p>
                  <p className="truncate text-xs text-slate">
                    {formatDate(t.date)} · {t.account?.name ?? t.debt?.name ?? "—"}
                  </p>
                </div>
                <p className={`shrink-0 font-medium ${t.type === "income" ? "text-success-text" : "text-ink"}`}>
                  {t.type === "income" ? "+" : "-"}
                  {formatMXN(t.amount)}
                </p>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
