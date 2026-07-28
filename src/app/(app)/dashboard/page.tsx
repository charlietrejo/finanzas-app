import Link from "next/link";
import { ArrowRight, ArrowUpRight, Banknote, PiggyBank, Sparkles, Wallet2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const summaryCards = [
  { label: "Balance total", amount: "$0.00", hint: "Sin movimientos aún" },
  { label: "Ingresos del periodo", amount: "$0.00", hint: "Listo para conectar Supabase" },
  { label: "Gastos del periodo", amount: "$0.00", hint: "Preparado para RLS" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6 p-2 sm:p-4">
      <div className="flex flex-col gap-4 rounded-[28px] bg-slate-950 p-5 text-white sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm text-slate-200">
            <Sparkles className="h-4 w-4" />
            Experiencia premium mobile-first
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Tu dinero, organizado con claridad.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300 sm:text-base">
            La base de la app ya está preparada para ingresos, gastos, presupuestos, metas y un futuro módulo de autenticación y sincronización con Supabase.
          </p>
        </div>
        <Link href="/transactions">
          <Button className="bg-white text-slate-950 hover:bg-slate-100">
            Registrar movimiento
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((item) => (
          <Card key={item.label} className="border-slate-200/70">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-slate-500">{item.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-slate-950 dark:text-white">{item.amount}</p>
              <p className="text-sm text-slate-500">{item.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Resumen de la semana</CardTitle>
              <CardDescription>Vista inicial de la experiencia de finanzas personales.</CardDescription>
            </div>
            <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">En progreso</Badge>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <Wallet2 className="h-4 w-4" />
                Ahorro neto
              </div>
              <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">$0.00</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <PiggyBank className="h-4 w-4" />
                Progreso de ahorro
              </div>
              <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">0%</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Próximos pasos</CardTitle>
            <CardDescription>La arquitectura ya está lista para avanzar por fases.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <li className="flex items-start gap-2">
                <ArrowUpRight className="mt-0.5 h-4 w-4 text-emerald-600" />
                Conectar Supabase Auth y middleware.
              </li>
              <li className="flex items-start gap-2">
                <ArrowUpRight className="mt-0.5 h-4 w-4 text-emerald-600" />
                Crear migraciones y RLS.
              </li>
              <li className="flex items-start gap-2">
                <ArrowUpRight className="mt-0.5 h-4 w-4 text-emerald-600" />
                Integrar transacciones, presupuestos y metas.
              </li>
            </ul>
            <Button variant="outline" className="mt-4 w-full">
              <Banknote className="h-4 w-4" />
              Ver módulos
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
