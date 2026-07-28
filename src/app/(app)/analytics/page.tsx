"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CircleDollarSign, TrendingUp } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listCategories, listTransactions } from "@/services/finance";
import type { Category, Transaction } from "@/types";

export default function AnalyticsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(async () => {
      setLoading(true);
      try {
        const [transactionsData, categoriesData] = await Promise.all([listTransactions(), listCategories()]);
        setTransactions(transactionsData);
        setCategories(categoriesData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar el análisis.");
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const summary = useMemo(() => {
    const income = transactions.filter((item) => item.type === "INCOME").reduce((sum, item) => sum + item.amount, 0);
    const expense = transactions.filter((item) => item.type === "EXPENSE").reduce((sum, item) => sum + item.amount, 0);
    const transfers = transactions.filter((item) => item.type === "TRANSFER").reduce((sum, item) => sum + item.amount, 0);
    const net = income - expense;
    const savingRate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0;

    const categorySummaries = transactions
      .filter((item) => item.type === "EXPENSE")
      .reduce<Record<string, number>>((acc, item) => {
        const key = item.category_id ?? "Sin categoría";
        acc[key] = (acc[key] ?? 0) + item.amount;
        return acc;
      }, {});

    const sortedCategories = Object.entries(categorySummaries)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([categoryId, amount]) => ({
        id: categoryId,
        amount,
        label: categories.find((category) => category.id === categoryId)?.name ?? categoryId,
      }));

    return {
      income,
      expense,
      transfers,
      net,
      savingRate,
      transactionCount: transactions.length,
      topCategories: sortedCategories,
    };
  }, [transactions, categories]);

  return (
    <div className="space-y-6 p-2 sm:p-4">
      <div>
        <p className="text-sm font-medium text-slate-500">Análisis</p>
        <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Distribución, evolución y comparación</h1>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Ingresos</CardTitle>
            <CardDescription>Dinero recibido</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
            <div className="flex items-center gap-3">
              <CircleDollarSign className="h-6 w-6 text-emerald-600" />
              <p className="text-3xl font-semibold text-slate-950 dark:text-slate-100">{summary.income.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</p>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Total de ingresos en los registros actuales.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gastos</CardTitle>
            <CardDescription>Dinero gastado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-6 w-6 text-rose-600" />
              <p className="text-3xl font-semibold text-slate-950 dark:text-slate-100">{summary.expense.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</p>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Total de gastos actuales.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ahorro</CardTitle>
            <CardDescription>Ingresos menos gastos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-slate-600" />
              <p className="text-3xl font-semibold text-slate-950 dark:text-slate-100">{summary.net.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</p>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Tasa de ahorro {summary.savingRate}% sobre ingresos.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gastos por categoría</CardTitle>
            <CardDescription>Las categorías más importantes</CardDescription>
          </CardHeader>
          <CardContent className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
            {summary.topCategories.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No hay gastos con categoría en los registros actuales.</p>
            ) : (
              <div className="space-y-3">
                {summary.topCategories.map((category) => (
                  <div key={category.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                    <span>{category.label}</span>
                    <span>{category.amount.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumen rápido</CardTitle>
            <CardDescription>Transacciones totales</CardDescription>
          </CardHeader>
          <CardContent className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p>Total de movimientos: <strong className="text-slate-900 dark:text-slate-100">{summary.transactionCount}</strong></p>
              <p>Transferencias registradas: <strong className="text-slate-900 dark:text-slate-100">{transactions.filter((item) => item.type === "TRANSFER").length}</strong></p>
              <p>Meses activos: <strong className="text-slate-900 dark:text-slate-100">{new Set(transactions.map((item) => item.transaction_date.slice(0, 7))).size}</strong></p>
            </div>
          </CardContent>
        </Card>
      </div>

      {loading && (
        <Card>
          <CardHeader>
            <CardTitle>Cargando datos</CardTitle>
            <CardDescription>Obteniendo transacciones y categorías para el análisis.</CardDescription>
          </CardHeader>
          <CardContent className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800/70 dark:text-slate-300">
            Por favor espera un momento.
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200">
            {error}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
