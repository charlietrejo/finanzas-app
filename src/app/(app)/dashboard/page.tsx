"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/icon-material";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  listAccounts,
  listTransactions,
  listDebts,
  listCategories,
} from "@/services/finance";
import type { Account, Transaction, Debt, Category } from "@/types";

function monthShort(d: Date) {
  return d.toLocaleString("es-MX", { month: "short" });
}

function formatMoney(amount: number) {
  return amount.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  });
}

function transactionLabel(type: Transaction["type"]) {
  const labels: Record<Transaction["type"], string> = {
    INCOME: "Ingreso",
    EXPENSE: "Gasto",
    TRANSFER: "Transferencia",
    DEBT_PAYMENT: "Pago de deuda",
  };
  return labels[type];
}

function isCurrentMonth(dateStr: string) {
  const now = new Date();
  const [year, month] = dateStr.split("-").map(Number);
  return year === now.getFullYear() && month === now.getMonth() + 1;
}

function formatDay(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Hoy";
  if (sameDay(date, yesterday)) return "Ayer";
  return `${date.getDate()} ${monthShort(date)}`;
}

function useCountUp(target: number, durationMs = 900) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      queueMicrotask(() => setValue(target));
      return;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [accountData, transactionData, debtData, categoryData] =
          await Promise.all([
            listAccounts(),
            listTransactions(),
            listDebts(),
            listCategories(),
          ]);

        setAccounts(accountData);
        setTransactions(transactionData);
        setDebts(debtData);
        setCategories(categoryData);
        setError(null);
      } catch (err) {
        // Promise.all rechaza con el primer error, pero oculta qué consulta
        // falló. Ejecutamos cada una de forma aislada para etiquetar el origen
        // y revelar el mensaje real de Supabase (no el "{}" del console.error).
        const probes: Array<[string, () => Promise<unknown>]> = [
          ["cuentas", listAccounts],
          ["transacciones", listTransactions],
          ["deudas", listDebts],
          ["categorías", listCategories],
        ];
        for (const [label, fn] of probes) {
          try {
            await fn();
          } catch (e) {
            console.error(`[dashboard] Falló la carga de ${label}:`, e);
            if (!err) err = e;
          }
        }

        const message =
          err && typeof err === "object" && "message" in err
            ? (err as { message?: string }).message
            : String(err);
        console.error("Error cargando datos del dashboard:", err);
        setError(
          message
            ? `No se pudieron cargar tus datos (${message}). Intenta de nuevo.`
            : "Ocurrió un error inesperado."
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  // Dinero disponible = cuentas que NO son tarjeta de crédito (la tarjeta
  // representa deuda, no saldo disponible).
  const availableMoney = useMemo(
    () =>
      accounts
        .filter((account) => account.type !== "CREDIT_CARD")
        .reduce((total, account) => total + Number(account.current_balance || 0), 0),
    [accounts]
  );

  const animatedAvailable = useCountUp(availableMoney);

  // Totales del mes actual (excluye TRANSFER y DEBT_PAYMENT).
  const { monthlyIncome, monthlyExpense, monthlyBalance } = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      if (!isCurrentMonth(t.transaction_date)) continue;
      if (t.type === "INCOME") income += Number(t.amount);
      else if (t.type === "EXPENSE") expense += Number(t.amount);
    }
    return { monthlyIncome: income, monthlyExpense: expense, monthlyBalance: income - expense };
  }, [transactions]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  // Tarjetas de crédito: cuentas tipo CREDIT_CARD con su deuda asociada.
  const creditCards = useMemo(() => {
    const debtMap = new Map<string, Debt>();
    for (const d of debts) debtMap.set(d.id, d);

    return accounts
      .filter((account) => account.type === "CREDIT_CARD")
      .map((account) => {
        // Deuda enlazada si existe; si no, el saldo de la cuenta es la deuda.
        const linkedDebt = account.debt_id ? debtMap.get(account.debt_id) : undefined;
        const current = Number(
          linkedDebt ? linkedDebt.current_balance : account.current_balance || 0
        );
        const limit = Number(
          linkedDebt ? linkedDebt.initial_amount : account.initial_balance || 0
        );
        const available = limit - current;
        const usedPercent = limit > 0 ? (current / limit) * 100 : 0;
        return {
          id: account.id,
          name: account.name,
          current,
          limit,
          available,
          usedPercent,
        };
      });
  }, [accounts, debts]);

  const totalUsedCredit = creditCards.reduce((sum, c) => sum + c.current, 0);
  const totalAvailableCredit = creditCards.reduce((sum, c) => sum + c.available, 0);

  // Resumen de deudas (todas, incluidas tarjetas en deudas sueltas).
  const totalDebt = debts.reduce((sum, d) => sum + Number(d.current_balance || 0), 0);
  const upcomingDues = useMemo(() => {
    return debts
      .filter((d) => d.due_date)
      .slice()
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
      .slice(0, 3)
      .map((d) => ({
        id: d.id,
        name: d.name,
        dueDate: d.due_date!,
      }));
  }, [debts]);

  // Últimos movimientos (top 5).
  const recentTransactions = useMemo(
    () =>
      transactions
        .slice()
        .sort((a, b) => (a.transaction_date < b.transaction_date ? 1 : -1))
        .slice(0, 5),
    [transactions]
  );

  const typeBadgeClass: Record<Transaction["type"], string> = {
    INCOME: "bg-emerald-50 text-emerald-700",
    EXPENSE: "bg-rose-50 text-rose-700",
    TRANSFER: "bg-sky-50 text-sky-700",
    DEBT_PAYMENT: "bg-violet-50 text-violet-700",
  };

  const quickActions: {
    label: string;
    icon: string;
    href: string;
    bg: string;
    border: string;
    iconColor: string;
    shadow: string;
  }[] = [
    {
      label: "Ingreso",
      icon: "add",
      href: "/transactions?type=INCOME",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      iconColor: "text-emerald-600",
      shadow: "shadow-emerald-200/70",
    },
    {
      label: "Gasto",
      icon: "remove",
      href: "/transactions?type=EXPENSE",
      bg: "bg-rose-50",
      border: "border-rose-200",
      iconColor: "text-rose-600",
      shadow: "shadow-rose-200/70",
    },
    {
      label: "Transferencia",
      icon: "swap_horiz",
      href: "/transactions?type=TRANSFER",
      bg: "bg-sky-50",
      border: "border-sky-200",
      iconColor: "text-sky-600",
      shadow: "shadow-sky-200/70",
    },
    {
      label: "Pago tarjeta",
      icon: "credit_card",
      href: "/transactions?type=DEBT_PAYMENT",
      bg: "bg-violet-50",
      border: "border-violet-200",
      iconColor: "text-violet-600",
      shadow: "shadow-violet-200/70",
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6 p-2 pb-28 sm:p-4 sm:pb-4">
        <div className="h-40 animate-pulse rounded-[32px] bg-slate-200/70" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-28 animate-pulse rounded-[24px] bg-slate-200/70" />
          <div className="h-28 animate-pulse rounded-[24px] bg-slate-200/70" />
        </div>
        <div className="h-40 animate-pulse rounded-[24px] bg-slate-200/70" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-2 pb-28 sm:p-4 sm:pb-4">
        <Card>
          <CardContent className="space-y-4 py-6 text-center">
            <p className="text-sm text-slate-600">{error}</p>
            <Button onClick={() => window.location.reload()}>Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-2 pb-28 sm:p-4 sm:pb-4">
      {/* Bloque principal: dinero disponible */}
      <div className="rounded-[32px] bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-600 px-6 py-7 text-white shadow-lg shadow-indigo-500/20">
        <p className="text-sm opacity-90">Dinero disponible</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          {formatMoney(animatedAvailable)}
        </h1>
        <p className="mt-2 text-xs opacity-80">
          Saldo de tus cuentas (sin deudas de tarjeta)
        </p>
      </div>

      {/* Resumen del periodo */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 py-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Ingresos</p>
                <p className="mt-1 text-3xl font-extrabold text-emerald-600">
                  {formatMoney(monthlyIncome)}
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                <Icon name="arrow_downward" className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 py-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Gastos</p>
                <p className="mt-1 text-3xl font-extrabold text-rose-600">
                  {formatMoney(monthlyExpense)}
                </p>
              </div>
              <div className="rounded-2xl bg-rose-50 p-3 text-rose-600">
                <Icon name="arrow_upward" className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <p className="text-lg font-bold text-slate-900">Balance del mes</p>
          <p
            className={`text-lg font-semibold ${
              monthlyBalance >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}
          >
            {monthlyBalance >= 0 ? "+" : "-"}
            {formatMoney(Math.abs(monthlyBalance))}
          </p>
        </CardContent>
      </Card>

      {/* Tarjetas de crédito */}
      <Card>
        <CardHeader>
          <CardTitle>Tarjetas de crédito</CardTitle>
          <Badge className="bg-violet-50 text-violet-700">{
            creditCards.length
          }</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {creditCards.length === 0 ? (
            <p className="text-sm text-slate-500">No tienes tarjetas registradas.</p>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  {formatMoney(totalUsedCredit)} utilizados
                </span>
                <span className="font-medium text-slate-700">
                  {formatMoney(totalAvailableCredit)} disponibles
                </span>
              </div>
              <div className="space-y-4">
                {creditCards.map((card) => (
                  <div key={card.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-800">
                        {card.name}
                      </span>
                      <span className="text-slate-500">
                        {formatMoney(card.current)} / {formatMoney(card.limit)}
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-lg bg-slate-100">
                      <div
                        className="h-full rounded-lg bg-gradient-to-r from-violet-500 to-indigo-500"
                        style={{ width: `${Math.min(100, card.usedPercent)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <Link href="/debts" className="block">
            <Button variant="outline" className="w-full">
              Ver tarjetas y deudas
              <Icon name="arrow_right" className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Deudas */}
      <Card>
        <CardHeader>
          <CardTitle>Deudas</CardTitle>
          <Badge className="bg-amber-50 text-amber-700">{debts.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">Deuda total</p>
              <p className="mt-1 text-3xl font-extrabold text-slate-900">
                {formatMoney(totalDebt)}
              </p>
            </div>
            <div className="text-right text-xs text-slate-400">
              {debts.length} deuda{debts.length === 1 ? "" : "s"} activa
              {debts.length === 1 ? "" : "s"}
            </div>
          </div>

          {upcomingDues.length > 0 && (
            <div className="space-y-2 rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Próximos vencimientos
              </p>
              {upcomingDues.map((due) => (
                <div
                  key={due.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-700">{due.name}</span>
                  <span className="text-slate-500">
                    {new Date(due.dueDate + "T00:00:00").getDate()}{" "}
                    {monthShort(new Date(due.dueDate + "T00:00:00"))}
                  </span>
                </div>
              ))}
            </div>
          )}

          <Link href="/debts" className="block">
            <Button variant="outline" className="w-full">
              Administrar deudas
              <Icon name="arrow_right" className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Últimos movimientos */}
      <Card>
        <CardHeader>
          <CardTitle>Últimos movimientos</CardTitle>
          <Link href="/transactions">
            <span className="text-xs font-semibold text-indigo-600">Ver todos</span>
          </Link>
        </CardHeader>
        <CardContent className="space-y-1">
          {recentTransactions.length === 0 ? (
            <p className="text-sm text-slate-500">Aún no hay movimientos.</p>
          ) : (
            recentTransactions.map((t) => {
              const category = t.category_id ? categoryMap.get(t.category_id) : undefined;
              const isPositive = t.type === "INCOME";
              const sign = t.type === "INCOME" ? "+" : "-";
              const label =
                t.description?.trim() ||
                category?.name ||
                transactionLabel(t.type);
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between py-2"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold ${typeBadgeClass[t.type]}`}
                    >
                      {transactionLabel(t.type)}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{label}</p>
                      <p className="text-xs text-slate-400">
                        {formatDay(t.transaction_date)}
                      </p>
                    </div>
                  </div>
                  <p
                    className={`text-sm font-semibold ${
                      isPositive ? "text-emerald-600" : "text-slate-700"
                    }`}
                  >
                    {sign}
                    {formatMoney(Number(t.amount))}
                  </p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Acciones rápidas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {quickActions.map((action) => (
          <Link key={action.label} href={action.href} className="block tap-feedback">
            <div className={`flex h-24 flex-col items-center justify-center gap-2 rounded-2xl border ${action.border} ${action.bg} shadow-sm ${action.shadow} transition active:scale-[0.98]`}>
              <Icon name={action.icon} className={`h-6 w-6 ${action.iconColor}`} />
              <span className="text-xs font-semibold text-slate-700">{action.label}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
