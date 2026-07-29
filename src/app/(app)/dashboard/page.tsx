import Link from "next/link";
import Icon from "@/components/ui/icon-material";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const summaryCards = [
  { label: "Balance total", amount: "$3,298", hint: "Este mes" },
  { label: "Ingresos", amount: "$7,520", hint: "+12% vs mes anterior" },
  { label: "Gastos", amount: "$4,222", hint: "10% menos" },
];

const accountsSummary = [
  { label: "Cuenta corriente", amount: "$5,848", color: "bg-sky-100 text-sky-700" },
  { label: "Saldo tarjeta", amount: "$2,001", color: "bg-violet-100 text-violet-700" },
  { label: "Efectivo neto", amount: "$3,847", color: "bg-emerald-100 text-emerald-700" },
  { label: "Inversiones", amount: "$0", color: "bg-slate-100 text-slate-700" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6 p-2 sm:p-4">
      <Card className="overflow-hidden rounded-[32px] p-0">
        <div className="bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-600 px-5 py-6 text-white sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm opacity-90">Resumen</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">$3,298</h1>
            </div>
              <div className="inline-flex items-center gap-2 rounded-3xl bg-white/15 px-3 py-2 text-sm text-white backdrop-blur">
              <Icon name="sparkles" className="h-4 w-4" />
              $98 por debajo del gasto promedio
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
                  <span key={index} className={`mx-auto inline-flex h-full w-3 rounded-full bg-white/50 ${index === 4 ? "h-[55%]" : index === 3 ? "h-[48%]" : index === 2 ? "h-[40%]" : index === 1 ? "h-[35%]" : index === 0 ? "h-[30%]" : "h-[48%]"}`} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 bg-white px-5 py-5 sm:px-6 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-500">Pago en 8 días</p>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Próximo
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {accountsSummary.map((item) => (
              <div key={item.label} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-slate-900">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="mt-2 text-lg font-semibold">{item.amount}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Link href="/transactions">
              <Button className="bg-slate-950 text-white hover:bg-slate-800">
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
              <CardDescription>Visualiza el gasto frente a ingresos en el periodo.</CardDescription>
            </div>
            <Badge className="bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300">Nuevo</Badge>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <div className="space-y-3 rounded-[28px] bg-slate-50 p-4 dark:bg-slate-900/70">
                {['Ingreso', 'Facturas y servicios', 'Gastos', 'Disponible para ahorro', 'Pago'].map((item, index) => (
                  <div key={item} className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item}</p>
                      <p className="text-sm text-slate-500">{index === 0 ? '2 eventos' : index === 2 ? '$140 más que Jul' : `${index + 1} evento`}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{index === 0 ? '$5,369' : index === 1 ? '$1,109' : index === 2 ? '$2,586' : index === 3 ? '$2,783' : '$5,369'}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saldo neto</CardTitle>
            <CardDescription>Resumen rápido de patrimonio y tendencias.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 rounded-[28px] bg-slate-50 p-4 dark:bg-slate-900/70">
              <div className="rounded-3xl bg-white p-4 text-slate-950 shadow-sm dark:bg-slate-950 dark:text-white">
                <p className="text-sm text-slate-500">Total net worth</p>
                <p className="mt-2 text-3xl font-semibold">$8,341</p>
                <p className="mt-3 text-sm text-slate-500">$437 in the last month</p>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'Assets', value: '$17.7k', trend: '1%' },
                  { label: 'Debt', value: '$17.7k', trend: '1%' },
                  { label: 'Net Worth', value: '$17.7k', trend: '5%' },
                  { label: 'Side Business', value: '$17.7k', trend: '1%' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.label}</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{item.trend} increase</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.value}</p>
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
