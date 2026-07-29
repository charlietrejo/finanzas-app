"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/ui/icon-material";
import { translateLabel } from "@/lib/i18n";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listCategories, listTransactions } from "@/services/finance";
import type { Category, Transaction } from "@/types";

const chartPoints = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"];
const progressItems = [
  { label: "Ingreso", value: "$5,369", detail: "2 eventos de ingreso", color: "from-sky-500 to-cyan-500" },
  { label: "Facturas y servicios", value: "$1,109", detail: "28% de ingresos", color: "from-violet-500 to-fuchsia-500" },
  { label: "Gastos", value: "$2,586", detail: "$140 más que Jul", color: "from-emerald-500 to-lime-500" },
  { label: "Disponible para ahorro", value: "$2,783", detail: "51% de tus ingresos", color: "from-slate-500 to-slate-400" },
];

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
      net,
      savingRate,
      transactionCount: transactions.length,
      topCategories: sortedCategories,
    };
  }, [transactions, categories]);

  return (
    <div className="space-y-6 p-2 sm:p-4">
      <div>
        <p className="text-sm font-medium text-slate-500">Gastos</p>
        <h1 className="text-2xl font-semibold text-slate-950">Reporte mensual</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Patrimonio total</CardTitle>
              <CardDescription>Resumen de patrimonio y tendencias.</CardDescription>
            </div>
            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-violet-700 dark:bg-violet-950 dark:text-violet-300">
              1M
            </span>
          </CardHeader>
          <CardContent className="space-y-4 rounded-[28px] bg-slate-50 p-4 dark:bg-slate-950/70">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Patrimonio total</p>
                <p className="mt-2 text-3xl font-semibold text-slate-950">$8,341</p>
              </div>
              <div className="rounded-3xl bg-white px-3 py-2 text-sm text-slate-950 shadow-sm dark:bg-slate-900 dark:text-white">
                +$437
              </div>
            </div>

            <div className="grid gap-3 rounded-[32px] bg-white p-4 shadow-sm dark:bg-slate-950">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs uppercase tracking-[0.25em] text-slate-500">1M</span>
                <span className="text-xs uppercase tracking-[0.25em] text-slate-500">Todo</span>
              </div>
              <div className="flex items-end gap-2 h-48">
                {chartPoints.map((label, index) => (
                  <div key={label} className="flex-1">
                    <div
                      style={{ height: `${30 + index * 8}px` }}
                      className="mx-auto w-full rounded-full bg-gradient-to-b from-violet-500 to-slate-200"
                    />
                    <p className="mt-3 text-center text-xs text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
            <CardDescription>Activos, deuda y patrimonio.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 rounded-[28px] bg-slate-50 p-4 dark:bg-slate-950/70">
            {[
              { label: "Activos", amount: "$17.7k", trend: "+1%" },
              { label: "Deuda", amount: "$17.7k", trend: "+1%" },
              { label: "Patrimonio", amount: "$17.7k", trend: "+5%" },
              { label: "Negocio", amount: "$17.7k", trend: "+1%" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-950">{item.label}</p>
                  <p className="text-xs text-slate-500">Resumen</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-950">{item.amount}</p>
                  <p className="text-xs text-slate-500">{item.trend}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Flujo mensual</CardTitle>
            <CardDescription>Ingresos y gastos por categoría.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 rounded-[28px] bg-slate-50 p-4 dark:bg-slate-950/70">
            {progressItems.map((item) => (
              <div key={item.label} className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-4 text-sm font-semibold text-slate-950 dark:text-white">
                  <span>{item.label}</span>
                  <span>{item.value}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Insights</CardTitle>
            <CardDescription>Gastos totales y ahorro.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 rounded-[28px] bg-slate-50 p-4 dark:bg-slate-950/70">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-slate-950">Ahorro neto</p>
                <p className="text-lg font-semibold text-slate-950">{summary.net.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">{summary.savingRate}% de ahorro sobre ingresos</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-semibold text-slate-950">Transacciones</p>
                <p className="text-lg font-semibold text-slate-950">{summary.transactionCount}</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">Movimientos totales registrados</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
