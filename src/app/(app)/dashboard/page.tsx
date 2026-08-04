"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/icon-material";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { listAccounts, listTransactions } from "@/services/finance";
import type { Account, Transaction } from "@/types";

function monthShort(d: Date) {
  return d.toLocaleString("en-US", { month: "short" });
}

function lastNMonths(n: number) {
  const now = new Date();
  return Array.from({ length: n }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (n - 1 - index), 1);
    return {
      label: monthShort(date),
      year: date.getFullYear(),
      month: date.getMonth() + 1,
    };
  });
}

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState(6);
  const chartRanges = [3, 6, 12] as const;

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [accountData, transactionData] = await Promise.all([
          listAccounts(),
          listTransactions(),
        ]);

        setAccounts(accountData);
        setTransactions(transactionData);
      } catch (error) {
        console.error("Error cargando datos del dashboard:", error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const totalBalance = accounts.reduce(
    (total, account) => total + Number(account.current_balance || 0),
    0
  );

  const formatMoney = (amount: number) =>
    amount.toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
    });

  const accountTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      CASH: "Efectivo",
      BANK: "Banco",
      CREDIT_CARD: "Tarjeta de crédito",
      SAVINGS: "Ahorro",
      INVESTMENT: "Inversión",
      OTHER: "Otro",
    };

    return types[type] ?? type;
  };

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

      <Card className="overflow-hidden rounded-[32px] p-0">

        <div className="bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-600 px-5 py-6 text-white sm:px-6">

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm opacity-90">
                Resumen
              </p>

              <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                {formatMoney(totalBalance)}
              </h1>
            </div>

            <div className="inline-flex items-center gap-2 rounded-3xl bg-white/15 px-3 py-2 text-sm text-white backdrop-blur">
              <Icon name="sparkles" className="h-4 w-4" />
              Balance actualizado
            </div>
          </div>


          <div className="mt-6 h-56 rounded-[32px] bg-white/10 p-4 text-sm">

            <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/80">
              <span>Feb</span>
              <span>Jul</span>
            </div>

            <div className="relative mt-4 h-full">
              <div className="absolute inset-x-0 bottom-0 grid grid-cols-6 gap-3">

                {Array.from({ length: 6 }).map((_, index) => (
                  <span
                    key={index}
                    className={`mx-auto inline-flex h-full w-3 rounded-full bg-white/50 ${
                      index === 4
                        ? "h-[55%]"
                        : index === 3
                        ? "h-[48%]"
                        : index === 2
                        ? "h-[40%]"
                        : index === 1
                        ? "h-[35%]"
                        : index === 0
                        ? "h-[30%]"
                        : "h-[48%]"
                    }`}
                  />
                ))}

              </div>
            </div>

          </div>

        </div>


        <div className="space-y-4 bg-white px-5 py-5 sm:px-6">


          <div className="flex items-center justify-between">

            <div>
              <p className="text-sm font-medium text-slate-500">
                Mis cuentas
              </p>

              <p className="text-xs text-slate-400">
                Administra tus bancos, efectivo e inversiones
              </p>
            </div>


            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {accounts.length}
            </span>

          </div>



          <div className="grid gap-3 sm:grid-cols-2">

            {loading && (
              <p className="text-sm text-slate-500">
                Cargando cuentas...
              </p>
            )}


            {!loading && accounts.length === 0 && (
              <p className="text-sm text-slate-500">
                Todavía no tienes cuentas registradas.
              </p>
            )}



            {accounts.map((account) => (

              <div
                key={account.id}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
              >

                <p className="font-semibold text-slate-900">
                  {account.name}
                </p>


                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {formatMoney(Number(account.current_balance))}
                </p>


                <p className="mt-1 text-xs text-slate-500">
                  {accountTypeLabel(account.type)}
                </p>

              </div>

            ))}

          </div>



          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">


            <Link href="/accounts">

              <Button className="w-full bg-indigo-600 text-white hover:bg-indigo-700">

                <Icon name="add" className="h-4 w-4" />

                Agregar cuenta

              </Button>

            </Link>



            <Link href="/transactions">

              <Button
                variant="outline"
                className="w-full"
              >

                Registrar movimiento

                <Icon name="arrow_right" className="h-4 w-4" />

              </Button>

            </Link>


          </div>


        </div>


      </Card>





      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">


        <Card>

          <CardHeader>

            <CardTitle>
              Gasto mensual
            </CardTitle>

            <CardDescription>
              Visualiza el gasto frente a ingresos en el periodo.
            </CardDescription>

            <Badge className="bg-sky-50 text-sky-700">
              Nuevo
            </Badge>

          </CardHeader>


          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-[28px] bg-slate-50 px-4 py-3 text-sm text-slate-500">
              <span>Últimos {selectedRange} meses</span>
              <div className="flex flex-wrap gap-2">
                {chartRanges.map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setSelectedRange(range)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      selectedRange === range
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                    }`}
                  >
                    {range} meses
                  </button>
                ))}
              </div>
            </div>

            {monthlyExpenseHistory.every((item) => item.total === 0) ? (
              <div className="rounded-[28px] bg-slate-50 p-8 text-center text-sm text-slate-500">
                No hay gastos registrados en este rango.
              </div>
            ) : (
              <div className="rounded-[28px] bg-slate-50 p-4">
                <div className="flex items-end gap-2 h-52">
                  {monthlyExpenseHistory.map((month) => {
                    const max = Math.max(1, ...monthlyExpenseHistory.map((item) => item.total));
                    const height = Math.max(28, (month.total / max) * 192);

                    return (
                      <div key={`${month.label}-${month.year}`} className="flex-1">
                        <div className="group relative mx-auto flex h-full w-full items-end justify-center">
                          <div className="absolute -top-9 left-1/2 flex -translate-x-1/2 items-center justify-center whitespace-nowrap rounded-full bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white opacity-0 transition duration-200 group-hover:opacity-100">
                            {formatMoney(month.total)}
                          </div>
                          <div
                            style={{ height: `${height}px` }}
                            className="w-full rounded-full bg-gradient-to-b from-sky-500 to-slate-200"
                            title={`${month.label} ${month.year}: ${formatMoney(month.total)}`}
                          />
                        </div>
                        <p className="mt-3 text-center text-xs text-slate-400">
                          {month.label}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>

        </Card>





        <Card>

          <CardHeader>

            <CardTitle>
              Saldo neto
            </CardTitle>

            <CardDescription>
              Resumen rápido de patrimonio y tendencias.
            </CardDescription>

          </CardHeader>



          <CardContent>

            <div className="space-y-4 rounded-[28px] bg-slate-50 p-4">


              <div className="rounded-3xl bg-white p-4 shadow-sm">

                <p className="text-sm text-slate-500">
                  Patrimonio actual
                </p>


                <p className="mt-2 text-3xl font-semibold">
                  {formatMoney(totalBalance)}
                </p>


              </div>



              <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white p-4">

                <p className="font-semibold">
                  Cuentas activas
                </p>

                <p className="font-semibold">
                  {accounts.length}
                </p>

              </div>



            </div>

          </CardContent>


        </Card>


      </div>


    </div>
  );
}