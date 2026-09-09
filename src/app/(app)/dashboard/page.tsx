import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnimatedAmount } from "@/components/ui/animated-amount";
import { formatMXN } from "@/lib/format";
import { ACCOUNT_TYPE_LABELS } from "@/lib/constants/account-types";
import { getExpenseTotalsByCategory } from "@/lib/budgets-data";
import { getCurrentMonth } from "@/lib/date-utils";
import { getBudgetStatus } from "@/lib/budget-status";
import { getUpcomingPayments } from "@/lib/upcoming-payments";
import { CalendarClock } from "lucide-react";
import type { Account, Budget, Debt, Transaction } from "@/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();
  const month = getCurrentMonth();

  const [{ data: accounts }, { data: budgets }, { data: debts }, { data: recurringTransactions }, spentByCategory] =
    await Promise.all([
      supabase.from("accounts").select("*").is("archived_at", null).order("created_at", { ascending: true }),
      supabase.from("budgets").select("*").eq("month", `${month}-01`),
      supabase.from("debts").select("*").is("archived_at", null),
      supabase.from("transactions").select("*").eq("is_recurring", true),
      getExpenseTotalsByCategory(supabase, month),
    ]);

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

  const upcomingPayments = getUpcomingPayments({
    debts: debtList,
    recurringTransactions: (recurringTransactions ?? []) as Transaction[],
  });

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-light text-ink md:text-3xl">Dashboard</h1>
        <p className="text-sm text-slate">Resumen de tus finanzas en MXN</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <Card tone="mint" className="w-full max-w-sm">
          <p className="text-sm font-medium text-slate">Saldo total</p>
          <p className="mt-2 text-3xl font-light text-ink">
            <AnimatedAmount value={totalBalance} />
          </p>
        </Card>

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
            <p className="font-medium text-ink">Recordatorios de pago</p>
          </div>
          <ul className="flex flex-col gap-2">
            {upcomingPayments.map((p) => (
              <li key={p.key} className="flex items-center justify-between text-sm">
                <span className="text-ink">
                  {p.name}
                  {p.amount != null && <span className="text-slate"> · {formatMXN(p.amount)}</span>}
                </span>
                <Badge tone={p.daysUntil <= 2 ? "danger" : "warning"}>
                  {p.daysUntil === 0 ? "Vence hoy" : p.daysUntil === 1 ? "Vence mañana" : `Vence en ${p.daysUntil} días`}
                </Badge>
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
    </div>
  );
}
