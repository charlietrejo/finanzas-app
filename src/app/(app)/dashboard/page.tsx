import Link from "next/link";
import { connection } from "next/server";
import Icon from "@/components/ui/icon-material";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedMoney } from "@/components/dashboard/animated-money";

import {
  listAccountsServer,
  listTransactionsServer,
  listDebtsServer,
  listCategoriesServer,
} from "@/services/finance.server";
import {
  formatMoney,
  monthShort,
  formatDay,
  isCurrentMonth,
  transactionLabel,
  typeBadgeClass,
} from "@/lib/format";
import type { Account, Category, Debt, Transaction } from "@/types";

// QA-37 — Dashboard como Server Component. El fetching y el render inicial
// ocurren en el servidor con el cliente Supabase server-side (cookies de
// sesión), por lo que los datos se incluyen en el HTML y son visibles AUNQUE
// la hidratación de Client Components esté bloqueada por la CSP estricta
// (script-src 'self'). Única isla client: AnimatedMoney (contador animado con
// fallback estático). No se modifican Supabase/RLS/RPC ni variables de entorno.

const quickActions: {
  label: string;
  icon: string;
  href: string;
  bg: string;
  border: string;
  iconColor: string;
  shadow: string;
}[] = [
  { label: "Ingreso", icon: "add", href: "/transactions?type=INCOME", bg: "bg-emerald-50", border: "border-emerald-200", iconColor: "text-emerald-600", shadow: "shadow-emerald-200/70" },
  { label: "Gasto", icon: "remove", href: "/transactions?type=EXPENSE", bg: "bg-rose-50", border: "border-rose-200", iconColor: "text-rose-600", shadow: "shadow-rose-200/70" },
  { label: "Transferencia", icon: "swap_horiz", href: "/transactions?type=TRANSFER", bg: "bg-sky-50", border: "border-sky-200", iconColor: "text-sky-600", shadow: "shadow-sky-200/70" },
  { label: "Pago tarjeta", icon: "credit_card", href: "/transactions?type=DEBT_PAYMENT", bg: "bg-violet-50", border: "border-violet-200", iconColor: "text-violet-600", shadow: "shadow-violet-200/70" },
];

export default async function DashboardPage() {
  // Fuerza dynamic rendering: el dashboard lee la sesión desde cookies vía el
  // cliente Supabase server-side, por lo que no puede ser estático (QA-37).
  await connection();

  let accounts: Account[] = [];
  let transactions: Transaction[] = [];
  let debts: Debt[] = [];
  let categories: Category[] = [];
  let error: string | null = null;

  try {
    [accounts, transactions, debts, categories] = await Promise.all([
      listAccountsServer(),
      listTransactionsServer(),
      listDebtsServer(),
      listCategoriesServer(),
    ]);
  } catch (err) {
    const message =
      err && typeof err === "object" && "message" in err
        ? (err as { message?: string }).message
        : String(err);
    error = message
      ? `No se pudieron cargar tus datos (${message}). Intenta de nuevo.`
      : "Ocurrió un error inesperado.";
  }

  if (error) {
    return (
      <div className="space-y-6 p-2 pb-28 sm:p-4 sm:pb-4">
        <Card>
          <CardContent className="space-y-4 py-6 text-center">
            <p className="text-sm text-slate-600">{error}</p>
            <Link href="/dashboard">
              <Button>Reintentar</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Dinero disponible = cuentas que NO son tarjeta de crédito.
  const availableMoney = accounts
    .filter((account) => account.type !== "CREDIT_CARD")
    .reduce((total, account) => total + Number(account.current_balance || 0), 0);

  let monthlyIncome = 0;
  let monthlyExpense = 0;
  for (const t of transactions) {
    if (!isCurrentMonth(t.transaction_date)) continue;
    if (t.type === "INCOME") monthlyIncome += Number(t.amount);
    else if (t.type === "EXPENSE") monthlyExpense += Number(t.amount);
  }
  const monthlyBalance = monthlyIncome - monthlyExpense;

  const categoryMap = new Map<string, Category>();
  for (const c of categories) categoryMap.set(c.id, c);

  const debtMap = new Map<string, Debt>();
  for (const d of debts) debtMap.set(d.id, d);

  const creditCards = accounts
    .filter((account) => account.type === "CREDIT_CARD")
    .map((account) => {
      const linkedDebt = account.debt_id ? debtMap.get(account.debt_id) : undefined;
      const current = Number(
        linkedDebt ? linkedDebt.current_balance : account.current_balance || 0,
      );
      const limit = Number(
        linkedDebt ? linkedDebt.initial_amount : account.initial_balance || 0,
      );
      const available = limit - current;
      const usedPercent = limit > 0 ? (current / limit) * 100 : 0;
      return { id: account.id, name: account.name, current, limit, available, usedPercent };
    });

  const totalUsedCredit = creditCards.reduce((sum, c) => sum + c.current, 0);
  const totalAvailableCredit = creditCards.reduce((sum, c) => sum + c.available, 0);

  const totalDebt = debts.reduce((sum, d) => sum + Number(d.current_balance || 0), 0);

  const upcomingDues = debts
    .filter((d) => d.due_date)
    .slice()
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
    .slice(0, 3)
    .map((d) => ({ id: d.id, name: d.name, dueDate: d.due_date! }));

  const recentTransactions = transactions
    .slice()
    .sort((a, b) => (a.transaction_date < b.transaction_date ? 1 : -1))
    .slice(0, 5);

  return (
    <div className="space-y-6 p-2 sm:p-4">
      {/* Bloque principal: dinero disponible (isla animada, fallback estático) */}
      <div className="rounded-[32px] bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-600 px-6 py-7 text-white shadow-lg shadow-indigo-500/20">
        <p className="text-sm opacity-90">Dinero disponible</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">
          <AnimatedMoney target={availableMoney} />
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
          <Badge className="bg-violet-50 text-violet-700">{creditCards.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {creditCards.length === 0 ? (
            <p className="text-sm text-slate-500">No tienes tarjetas registradas.</p>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{formatMoney(totalUsedCredit)} utilizados</span>
                <span className="font-medium text-slate-700">
                  {formatMoney(totalAvailableCredit)} disponibles
                </span>
              </div>
              <div className="space-y-4">
                {creditCards.map((card) => (
                  <div key={card.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-800">{card.name}</span>
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
          <div className="flex justify-center">
            <Link href="/debts">
              <Button variant="default" className="w-auto">
                Ver tarjetas y deudas
                <Icon name="arrow_right" className="h-4 w-4" />
              </Button>
            </Link>
          </div>
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
                <div key={due.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{due.name}</span>
                  <span className="text-slate-500">
                    {new Date(due.dueDate + "T00:00:00").getDate()}{" "}
                    {monthShort(new Date(due.dueDate + "T00:00:00"))}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-center">
            <Link href="/debts">
              <Button variant="default" className="w-auto">
                Administrar deudas
                <Icon name="arrow_right" className="h-4 w-4" />
              </Button>
            </Link>
          </div>
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
                t.description?.trim() || category?.name || transactionLabel(t.type);
              return (
                <div key={t.id} className="grid grid-cols-3 items-center gap-3 py-2">
                  <span
                    className={`justify-self-start rounded-lg px-2 py-0.5 text-[10px] font-semibold ${typeBadgeClass[t.type]}`}
                  >
                    {transactionLabel(t.type)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{label}</p>
                    <p className="text-xs text-slate-400">{formatDay(t.transaction_date)}</p>
                  </div>
                  <p
                    className={`justify-self-end text-right text-sm font-semibold ${
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
