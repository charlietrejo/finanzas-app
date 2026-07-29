"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/icon-material";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { listAccounts } from "@/services/finance";
import type { Account } from "@/types";

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const data = await listAccounts();
        setAccounts(data);
      } catch (error) {
        console.error("Error cargando cuentas:", error);
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

  return (
    <div className="space-y-6 p-2 sm:p-4">
      <Card className="overflow-hidden rounded-[32px] p-0">
        <div className="bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-600 px-5 py-6 text-white sm:px-6">
          
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm opacity-90">Resumen</p>
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


        <div className="space-y-3 bg-white px-5 py-5 sm:px-6">

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-500">
              Cuentas registradas
            </p>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-slate-700">
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
                No tienes cuentas creadas todavía.
              </p>
            )}


            {accounts.map((account) => (
              <div
                key={account.id}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-slate-900"
              >
                <p className="text-sm font-medium">
                  {account.name}
                </p>

                <p className="mt-2 text-lg font-semibold">
                  {formatMoney(Number(account.current_balance))}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {account.type}
                </p>
              </div>
            ))}

          </div>


          <div className="mt-4 flex justify-end">
            <Link href="/transactions">
              <Button className="bg-slate-700 text-white hover:bg-slate-800">
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
            <div>
              <CardTitle>Gasto mensual</CardTitle>
              <CardDescription>
                Visualiza el gasto frente a ingresos en el periodo.
              </CardDescription>
            </div>

            <Badge className="bg-sky-50 text-sky-700">
              Nuevo
            </Badge>
          </CardHeader>


          <CardContent>
            <div className="rounded-[28px] bg-slate-50 p-4 text-sm text-slate-500">
              Próximamente conectado con transacciones.
            </div>
          </CardContent>
        </Card>



        <Card>
          <CardHeader>
            <CardTitle>Saldo neto</CardTitle>
            <CardDescription>
              Resumen rápido de patrimonio y tendencias.
            </CardDescription>
          </CardHeader>


          <CardContent>

            <div className="space-y-4 rounded-[28px] bg-slate-50 p-4">

              <div className="rounded-3xl bg-white p-4 text-slate-900 shadow-sm">

                <p className="text-sm text-slate-500">
                  Patrimonio actual
                </p>

                <p className="mt-2 text-3xl font-semibold">
                  {formatMoney(totalBalance)}
                </p>

              </div>


              <div className="space-y-3">

                <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold">
                    Activos
                  </p>

                  <p className="font-semibold">
                    {formatMoney(totalBalance)}
                  </p>
                </div>


                <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white p-4">
                  <p className="font-semibold">
                    Cuentas
                  </p>

                  <p className="font-semibold">
                    {accounts.length}
                  </p>
                </div>

              </div>

            </div>

          </CardContent>

        </Card>

      </div>

    </div>
  );
}