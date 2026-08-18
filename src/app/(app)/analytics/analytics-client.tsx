"use client";

import { useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Account, Category, Transaction } from "@/types";

const monthShort = (d: Date) =>
  d.toLocaleString("en-US", { month: "short" });

function lastNMonths(n: number) {
  const res: { label: string; year: number; month: number }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    res.push({ label: monthShort(d), year: d.getFullYear(), month: d.getMonth() + 1 });
  }
  return res;
}

const formatMoney = (amount: number) =>
  amount.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  });

// QA-41 — Client Component hijo del Server Component analytics/page.tsx.
// Recibe transacciones/categorías/cuentas ya cargadas en el servidor
// (initial*) para que el reporte sea visible aunque la hidratación esté
// bloqueada por la CSP estricta. El gráfico y los selectores de rango son
// interactividad client-side que funciona cuando hay hidratación.
export function AnalyticsClient({
  initialTransactions,
  initialCategories,
  initialAccounts,
}: {
  initialTransactions: Transaction[];
  initialCategories: Category[];
  initialAccounts: Account[];
}) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [selectedRange, setSelectedRange] = useState(6);

  const chartRanges = [3, 6, 12] as const;

  const summary = useMemo(() => {
    const income = transactions
      .filter((item) => item.type === "INCOME")
      .reduce((sum, item) => sum + Number(item.amount), 0);

    const expense = transactions
      .filter((item) => item.type === "EXPENSE")
      .reduce((sum, item) => sum + Number(item.amount), 0);

    const assets = accounts
      .filter((account) => account.type !== "CREDIT_CARD")
      .reduce((sum, account) => sum + Number(account.current_balance), 0);

    const debt = accounts
      .filter((account) => account.type === "CREDIT_CARD")
      .reduce((sum, account) => sum + Number(account.current_balance), 0);

    const netWorth = assets - debt;

    const savingRate =
      income > 0 ? Math.round(((income - expense) / income) * 100) : 0;

    const categorySummaries = transactions
      .filter((item) => item.type === "EXPENSE")
      .reduce<Record<string, number>>((acc, item) => {
        const key = item.category_id ?? "Sin categoría";
        acc[key] = (acc[key] ?? 0) + Number(item.amount);
        return acc;
      }, {});

    const topCategories = Object.entries(categorySummaries)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([categoryId, amount]) => ({
        id: categoryId,
        amount,
        label:
          categories.find((category) => category.id === categoryId)?.name ??
          "Sin categoría",
      }));

    return {
      income,
      expense,
      assets,
      debt,
      netWorth,
      savingRate,
      transactionCount: transactions.length,
      topCategories,
    };
  }, [transactions, categories, accounts]);

  const monthlyExpenseHistory = useMemo(() => {
    const months = lastNMonths(selectedRange);
    return months.map((month) => {
      const total = transactions
        .filter((transaction) => {
          const [year, monthIndex] = transaction.transaction_date.split("-");
          return (
            Number(year) === month.year &&
            Number(monthIndex) === month.month &&
            transaction.type === "EXPENSE"
          );
        })
        .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

      return { ...month, total };
    });
  }, [selectedRange, transactions]);

  return (
    <div className="space-y-6 p-2 sm:p-4">
      <div>
        <p className="text-sm font-medium text-slate-500">Gastos</p>
        <h1 className="text-2xl font-semibold text-slate-900">Reporte mensual</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Patrimonio total</CardTitle>
            <CardDescription>Resumen real basado en tus cuentas.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 rounded-[28px] bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Patrimonio actual</p>
                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {formatMoney(summary.netWorth)}
                </p>
              </div>
              <div className="rounded-3xl bg-white px-3 py-2 text-sm text-slate-900 shadow-sm">
                {summary.savingRate}% ahorro
              </div>
            </div>
            <div className="grid gap-3 rounded-[32px] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.25em] text-slate-500">Activos</span>
                <span className="text-sm font-semibold text-slate-900">{formatMoney(summary.assets)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.25em] text-slate-500">Deuda</span>
                <span className="text-sm font-semibold text-slate-900">{formatMoney(summary.debt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.25em] text-slate-500">Transacciones</span>
                <span className="text-sm font-semibold text-slate-900">{summary.transactionCount}</span>
              </div>
            </div>

            <div className="grid gap-3 rounded-[32px] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs uppercase tracking-[0.25em] text-slate-500">Mes</span>
                <span className="text-xs uppercase tracking-[0.25em] text-slate-500">Tendencia</span>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-slate-900">Últimos {selectedRange} meses</span>
                  <div className="flex flex-wrap justify-center gap-2">
                    {chartRanges.map((range) => (
                      <Button
                        key={range}
                        type="button"
                        size="sm"
                        variant={selectedRange === range ? "default" : "outline"}
                        onClick={() => setSelectedRange(range)}
                      >
                        {range} meses
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex items-end gap-2 h-56">
                  {monthlyExpenseHistory.map((month) => {
                    const max = Math.max(1, ...monthlyExpenseHistory.map((item) => item.total));
                    const height = Math.max(28, (month.total / max) * 180);

                    return (
                      <div key={`${month.label}-${month.year}`} className="flex-1">
                        <div className="group relative mx-auto flex h-full w-full items-end justify-center">
                          <div className="absolute -top-8 left-1/2 flex -translate-x-1/2 items-center justify-center whitespace-nowrap rounded-full bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white opacity-0 transition duration-200 group-hover:opacity-100">
                            {formatMoney(month.total)}
                          </div>
                          <div
                            style={{ height: `${height}px` }}
                            className="w-full rounded-full bg-gradient-to-b from-violet-500 to-slate-200"
                            title={`${month.label} ${month.year}: ${formatMoney(month.total)}`}
                          />
                        </div>
                        <p className="mt-3 text-center text-xs text-slate-400">{month.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumen financiero</CardTitle>
            <CardDescription>Activos, deuda y patrimonio actual.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 rounded-[28px] bg-slate-50 p-4">
            {[
              { label: "Activos", amount: formatMoney(summary.assets), detail: "Dinero disponible e inversiones" },
              { label: "Deuda", amount: formatMoney(summary.debt), detail: "Tarjetas de crédito" },
              { label: "Patrimonio", amount: formatMoney(summary.netWorth), detail: "Valor neto actual" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-slate-900">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.detail}</p>
                </div>
                <p className="font-semibold text-slate-900">{item.amount}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Flujo mensual</CardTitle>
            <CardDescription>Ingresos y gastos registrados.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 rounded-[28px] bg-slate-50 p-4">
            {[
              { label: "Ingresos", value: summary.income },
              { label: "Gastos", value: summary.expense },
              { label: "Disponible para ahorro", value: summary.income - summary.expense },
            ].map((item) => (
              <div key={item.label} className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
                  <span>{item.label}</span>
                  <span>{formatMoney(item.value)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Perspectivas</CardTitle>
            <CardDescription>Análisis de tus movimientos.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 rounded-[28px] bg-slate-50 p-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-slate-900">Ahorro neto</p>
                <p className="text-lg font-semibold text-slate-900">
                  {formatMoney(summary.income - summary.expense)}
                </p>
              </div>
              <p className="mt-1 text-xs text-slate-500">{summary.savingRate}% de ahorro sobre ingresos</p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">Categorías principales</p>
              <div className="mt-3 space-y-2">
                {summary.topCategories.length === 0 && (
                  <p className="text-xs text-slate-500">Aún no hay gastos categorizados.</p>
                )}
                {summary.topCategories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{category.label}</span>
                    <span className="font-semibold text-slate-900">{formatMoney(category.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
