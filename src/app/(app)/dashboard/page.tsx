import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { formatMXN } from "@/lib/format";
import { ACCOUNT_TYPE_LABELS } from "@/lib/constants/account-types";
import { getExpenseTotalsByCategory } from "@/lib/budgets-data";
import { getCurrentMonth } from "@/lib/date-utils";
import { getBudgetStatus } from "@/lib/budget-status";
import type { Account, Budget } from "@/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();
  const month = getCurrentMonth();

  const [{ data: accounts }, { data: budgets }, spentByCategory] = await Promise.all([
    supabase.from("accounts").select("*").order("created_at", { ascending: true }),
    supabase.from("budgets").select("*").eq("month", `${month}-01`),
    getExpenseTotalsByCategory(supabase, month),
  ]);

  const list = (accounts ?? []) as Account[];
  const totalBalance = list.reduce((sum, a) => sum + a.current_balance, 0);

  const budgetList = (budgets ?? []) as Budget[];
  const overOrWarningCount = budgetList.filter((b) => {
    const status = getBudgetStatus(spentByCategory[b.category_id] ?? 0, b.amount_limit, b.alert_threshold_pct);
    return status !== "ok";
  }).length;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-light text-ink md:text-3xl">Dashboard</h1>
        <p className="text-sm text-slate">Resumen de tus finanzas en MXN</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <Card tone="mint" className="w-full max-w-sm">
          <p className="text-sm font-medium text-slate">Saldo total</p>
          <p className="mt-2 text-3xl font-light text-ink">{formatMXN(totalBalance)}</p>
        </Card>

        {budgetList.length > 0 && (
          <Card tone={overOrWarningCount > 0 ? "apricot" : "mint"} className="w-full max-w-sm">
            <p className="text-sm font-medium text-slate">Presupuestos este mes</p>
            <p className="mt-2 text-3xl font-light text-ink">
              {overOrWarningCount > 0 ? `${overOrWarningCount} en alerta` : "Todo al día"}
            </p>
            <Link href="/budgets" className="mt-2 inline-block text-sm font-medium text-monday-violet">
              Ver presupuestos
            </Link>
          </Card>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium text-ink">Cuentas</h2>
          <Link href="/accounts" className="text-sm font-medium text-monday-violet">
            Ver todas
          </Link>
        </div>

        {list.length === 0 ? (
          <Card>
            <p className="text-sm text-slate">
              Aún no tienes cuentas.{" "}
              <Link href="/accounts" className="font-medium text-monday-violet">
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
