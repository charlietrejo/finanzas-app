"use client";

import { useMemo, useRef, useState } from "react";
import { PlusCircle } from "lucide-react";
import Icon from "@/components/ui/icon-material";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createTransaction,
  deleteTransaction,
  listAccounts,
  listCategories,
  listDebts,
  listTransactions,
  updateTransaction,
} from "@/services/finance";
import type { Account, Category, Transaction, TransactionType, Debt } from "@/types";

const transactionTypes: TransactionType[] = ["INCOME", "EXPENSE", "TRANSFER", "DEBT_PAYMENT"];

const emptyForm = {
  type: "EXPENSE" as TransactionType,
  amount: "",
  description: "",
  notes: "",
  accountId: "",
  categoryId: "",
  destinationAccountId: "",
  debtId: "",
  transactionDate: new Date().toISOString().slice(0, 10),
};

const typeBadgeClass: Record<TransactionType, string> = {
  INCOME: "bg-emerald-50 text-emerald-700",
  EXPENSE: "bg-rose-50 text-rose-700",
  TRANSFER: "bg-indigo-50 text-indigo-700",
  DEBT_PAYMENT: "bg-amber-50 text-amber-700",
};

const typeLabel: Record<TransactionType, string> = {
  INCOME: "Ingreso",
  EXPENSE: "Gasto",
  TRANSFER: "Transferencia",
  DEBT_PAYMENT: "Pago de deuda",
};

function formatMoney(amount: number) {
  return amount.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function formatDay(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Hoy";
  if (sameDay(date, yesterday)) return "Ayer";
  const monthShort = date.toLocaleDateString("es-MX", { month: "short" });
  return `${date.getDate()} ${monthShort}`;
}

// QA-41 — Client Component hijo del Server Component transactions/page.tsx.
// Recibe los datos ya cargados en el servidor (initial*) para que el contenido
// sea visible aunque la hidratación esté bloqueada por la CSP estricta. Las
// mutaciones siguen usando el cliente browser de Supabase cuando hay
// hidratación.
export function TransactionsClient({
  initialTransactions,
  initialAccounts,
  initialCategories,
  initialDebts,
}: {
  initialTransactions: Transaction[];
  initialAccounts: Account[];
  initialCategories: Category[];
  initialDebts: Debt[];
}) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [debts, setDebts] = useState<Debt[]>(initialDebts);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    type: "" as TransactionType | "",
    accountId: "",
    categoryId: "",
    debtId: "",
    fromDate: "",
    toDate: "",
    search: "",
  });
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const idempotencyRef = useRef<string>(crypto.randomUUID());

  const loadData = async () => {
    setLoading(true);
    try {
      const [transactionsData, accountsData, categoriesData, debtsData] = await Promise.all([
        listTransactions(),
        listAccounts(),
        listCategories(),
        listDebts(),
      ]);
      setDebts(debtsData);
      setTransactions(transactionsData);
      setAccounts(accountsData);
      setCategories(categoriesData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la información.");
    } finally {
      setLoading(false);
    }
  };

  // Preselecciona el tipo desde ?type= (acciones rápidas del dashboard) al montar.
  if (typeof window !== "undefined" && !editingId && form.type === "EXPENSE") {
    const presetType = new URLSearchParams(window.location.search).get("type");
    if (presetType && (transactionTypes as string[]).includes(presetType)) {
      setForm((prev) => ({ ...prev, type: presetType as TransactionType }));
    }
  }

  const selectedAccount = accounts.find((a) => a.id === form.accountId);
  const selectedLinkedDebt = debts.find((d) => d.id === selectedAccount?.debt_id);

  const accountMap = useMemo(() => {
    const map = new Map<string, Account>();
    for (const a of accounts) map.set(a.id, a);
    return map;
  }, [accounts]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, Category>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const debtMap = useMemo(() => {
    const map = new Map<string, Debt>();
    for (const d of debts) map.set(d.id, d);
    return map;
  }, [debts]);

  const filteredCategories =
    form.type === "TRANSFER" || form.type === "DEBT_PAYMENT"
      ? []
      : categories.filter((category) => category.type === form.type);

  const visibleTransactions = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const filtered = transactions.filter((t) => {
      if (filters.type && t.type !== filters.type) return false;
      if (filters.accountId && t.account_id !== filters.accountId) return false;
      if (filters.categoryId && t.category_id !== filters.categoryId) return false;
      if (filters.debtId && t.debt_id !== filters.debtId) return false;
      if (filters.fromDate && t.transaction_date < filters.fromDate) return false;
      if (filters.toDate && t.transaction_date > filters.toDate) return false;
      if (search) {
        const inDesc = (t.description ?? "").toLowerCase().includes(search);
        const inNotes = (t.notes ?? "").toLowerCase().includes(search);
        if (!inDesc && !inNotes) return false;
      }
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      if (sortBy === "amount") {
        return (Number(a.amount) - Number(b.amount)) * dir;
      }
      return (a.transaction_date < b.transaction_date ? -1 : a.transaction_date > b.transaction_date ? 1 : 0) * dir;
    });
  }, [transactions, filters, sortBy, sortDir]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const amount = Number(form.amount);

    try {
      if (!form.description.trim()) {
        throw new Error("La descripción es obligatoria.");
      }
      if (!form.accountId) {
        throw new Error("Selecciona una cuenta.");
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("El monto debe ser un número mayor a cero.");
      }
      if ((form.type === "INCOME" || form.type === "EXPENSE") && !form.categoryId) {
        throw new Error("Selecciona una categoría.");
      }
      if (form.type === "TRANSFER" && !form.destinationAccountId) {
        throw new Error("Selecciona una cuenta destino para la transferencia.");
      }
      if (form.type === "TRANSFER" && form.destinationAccountId === form.accountId) {
        throw new Error("La cuenta de origen y destino no pueden ser la misma.");
      }
      if (form.type === "DEBT_PAYMENT" && !form.debtId) {
        throw new Error("Selecciona la deuda que deseas pagar.");
      }

      const payload = {
        type: form.type,
        amount,
        description: form.description.trim(),
        notes: form.notes.trim() || undefined,
        accountId: form.accountId,
        categoryId: form.categoryId || null,
        destinationAccountId: form.destinationAccountId || null,
        transactionDate: form.transactionDate,
        debtId: form.debtId || null,
      };

      if (editingId) {
        await updateTransaction(editingId, payload);
      } else {
        await createTransaction({ ...payload, idempotencyKey: idempotencyRef.current });
      }

      setForm(emptyForm);
      idempotencyRef.current = crypto.randomUUID();
      setEditingId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el movimiento.");
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setForm({
      type: transaction.type,
      amount: String(transaction.amount),
      description: transaction.description,
      notes: transaction.notes ?? "",
      accountId: transaction.account_id,
      categoryId: transaction.category_id ?? "",
      destinationAccountId: transaction.destination_account_id ?? "",
      transactionDate: transaction.transaction_date,
      debtId: transaction.debt_id ?? "",
    });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Eliminar este movimiento? Esta acción no se puede deshacer.")) {
      return;
    }
    try {
      await deleteTransaction(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el movimiento.");
    }
  };

  const resetFilters = () => {
    setFilters({ type: "", accountId: "", categoryId: "", debtId: "", fromDate: "", toDate: "", search: "" });
    setSortBy("date");
    setSortDir("desc");
  };

  const inputClass =
    "w-full h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-violet-400";

  const money = (value: number) =>
    value.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

  return (
    <div className="space-y-6 p-2 pb-28 sm:p-4 sm:pb-4">
      <div className="space-y-3 rounded-[32px] bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-600 px-5 py-5 text-white shadow-lg shadow-slate-900/20 sm:flex sm:items-end sm:justify-between sm:px-6">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-200/80">Finanzas</p>
          <h1 className="mt-3 text-2xl font-semibold">Registra tu movimiento</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-100/90">
            Crea ingresos, gastos, transferencias y pagos de deuda con una experiencia móvil conocida y clara.
          </p>
        </div>
        <div className="rounded-[28px] bg-white/15 px-4 py-3 text-sm text-white shadow-inner shadow-white/10">
          {transactions.length} movimientos
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Editar movimiento" : "Nuevo movimiento"}</CardTitle>
          <CardDescription>Registra ingresos, gastos, transferencias y pagos de deuda.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className={inputClass}
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    type: event.target.value as TransactionType,
                    categoryId: "",
                    debtId: "",
                    destinationAccountId: "",
                  }))
                }
              >
                {transactionTypes.map((type) => (
                  <option key={type} value={type}>
                    {type === "INCOME"
                      ? "Ingreso"
                      : type === "EXPENSE"
                        ? selectedAccount?.type === "CREDIT_CARD"
                          ? "Compra con tarjeta"
                          : "Gasto"
                        : type === "TRANSFER"
                          ? "Transferencia"
                          : "Pago de deuda"}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                className={inputClass}
                placeholder="Importe"
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
              />
            </div>

            <input
              className={inputClass}
              placeholder="Descripción"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />

            <textarea
              className="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base outline-none transition focus:border-violet-400"
              placeholder="Notas opcionales"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className={inputClass}
                value={form.accountId}
                onChange={(event) => setForm((current) => ({ ...current, accountId: event.target.value }))}
              >
                <option value="">Selecciona una cuenta</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
              {selectedAccount && selectedAccount.type === "CREDIT_CARD" && selectedLinkedDebt && (
                <div className="mt-2 rounded-lg bg-slate-100/60 px-3 py-2 text-sm text-slate-700">
                  <strong>Tarjeta:</strong> {selectedLinkedDebt.name} • <strong>Disponible:</strong>{" "}
                  {money(selectedLinkedDebt.initial_amount - selectedLinkedDebt.current_balance)}
                </div>
              )}
              {selectedAccount && selectedAccount.type === "CREDIT_CARD" && !selectedLinkedDebt && (
                <div className="mt-2 rounded-lg bg-slate-100/60 px-3 py-2 text-sm text-slate-700">
                  <strong>Tarjeta:</strong> {selectedAccount.name} • <strong>Disponible:</strong>{" "}
                  {money(Number(selectedAccount.initial_balance) - Number(selectedAccount.current_balance))}
                </div>
              )}
              {form.type !== "DEBT_PAYMENT" && (
                <select
                  className={inputClass}
                  value={form.categoryId}
                  onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
                >
                  <option value="">Selecciona una categoría</option>
                  {filteredCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {form.type === "TRANSFER" && (
              <select
                className={inputClass}
                value={form.destinationAccountId}
                onChange={(event) => setForm((current) => ({ ...current, destinationAccountId: event.target.value }))}
              >
                <option value="">Selecciona cuenta destino</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            )}

            {form.type === "DEBT_PAYMENT" && (
              <select
                className={inputClass}
                value={form.debtId}
                onChange={(event) => setForm((current) => ({ ...current, debtId: event.target.value }))}
              >
                <option value="">Selecciona una deuda</option>
                {debts.map((debt) => (
                  <option key={debt.id} value={debt.id}>
                    {debt.name} -{" "}
                    {Number(debt.current_balance).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
                  </option>
                ))}
              </select>
            )}

            <div className="relative">
              <input
                type="date"
                className={`${inputClass} pr-11 [color-scheme:light]`}
                value={form.transactionDate}
                onChange={(event) => setForm((current) => ({ ...current, transactionDate: event.target.value }))}
              />
              <Icon
                name="calendar_today"
                className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              />
            </div>

            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="flex flex-wrap justify-center gap-3 sm:items-center">
              <Button type="submit" className="w-auto">
                <PlusCircle className="h-4 w-4 text-base leading-none" />
                {editingId ? "Guardar cambios" : "Crear movimiento"}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="default"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm);
                  }}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de transacciones</CardTitle>
          <CardDescription>
            {loading ? "Cargando..." : `${visibleTransactions.length} de ${transactions.length} registros`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <select
                className={inputClass}
                value={filters.type}
                onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value as TransactionType | "" }))}
              >
                <option value="">Tipo: todos</option>
                {transactionTypes.map((type) => (
                  <option key={type} value={type}>
                    {typeLabel[type]}
                  </option>
                ))}
              </select>
              <select
                className={inputClass}
                value={filters.accountId}
                onChange={(e) => setFilters((f) => ({ ...f, accountId: e.target.value }))}
              >
                <option value="">Cuenta: todas</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <select
                className={inputClass}
                value={filters.categoryId}
                onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}
              >
                <option value="">Categoría: todas</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                className={inputClass}
                value={filters.debtId}
                onChange={(e) => setFilters((f) => ({ ...f, debtId: e.target.value }))}
              >
                <option value="">Deuda: todas</option>
                {debts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <input type="date" className={inputClass} placeholder="Desde" value={filters.fromDate} onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))} />
              <input type="date" className={inputClass} placeholder="Hasta" value={filters.toDate} onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className={inputClass}
                placeholder="Buscar por descripción o notas"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  className={inputClass}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as "date" | "amount")}
                >
                  <option value="date">Ordenar: fecha</option>
                  <option value="amount">Ordenar: monto</option>
                </select>
                <Button
                  type="button"
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                >
                  {sortDir === "asc" ? "Asc ↑" : "Desc ↓"}
                </Button>
              </div>
            </div>
            <div className="flex justify-center">
              <Button type="button" variant="default" onClick={resetFilters}>
                Limpiar filtros
              </Button>
            </div>
          </div>

          {transactions.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              Aún no hay transacciones. Registra la primera para ver tu flujo de dinero.
            </div>
          )}

          {transactions.length > 0 && visibleTransactions.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              Ningún movimiento coincide con los filtros seleccionados.
            </div>
          )}

          {visibleTransactions.map((transaction) => {
            const account = accountMap.get(transaction.account_id);
            const category = transaction.category_id ? categoryMap.get(transaction.category_id) : undefined;
            const debt = transaction.debt_id ? debtMap.get(transaction.debt_id) : undefined;
            const destination = transaction.destination_account_id
              ? accountMap.get(transaction.destination_account_id)
              : undefined;
            const isPositive = transaction.type === "INCOME";
            const sign = isPositive ? "+" : transaction.type === "TRANSFER" ? "" : "-";

            return (
              <div
                key={transaction.id}
                className="grid grid-cols-[5.5rem_1fr] items-start gap-y-2 divide-x divide-slate-100 py-3 first:pt-0 last:pb-0 sm:grid-cols-[6rem_1fr_auto_auto] sm:items-center sm:gap-y-0"
              >
                <span className={`mx-auto w-fit truncate rounded-lg px-2 py-0.5 text-center text-[10px] font-semibold ${typeBadgeClass[transaction.type]}`}>
                  {typeLabel[transaction.type]}
                </span>
                <div className="min-w-0 px-3">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-slate-800">{transaction.description}</p>
                    {debt && (
                      <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                        {debt.name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{formatDay(transaction.transaction_date)}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {account?.name ?? "Cuenta"}
                    {transaction.type === "TRANSFER" && destination ? ` → ${destination.name}` : ""}
                    {category ? ` · ${category.name}` : ""}
                  </p>
                  <p className={`mt-1 text-sm font-semibold sm:hidden ${isPositive ? "text-emerald-600" : transaction.type === "TRANSFER" ? "text-indigo-600" : "text-slate-700"}`}>
                    {sign}
                    {formatMoney(Number(transaction.amount))}
                  </p>
                </div>
                <p className={`hidden px-1 text-right text-sm font-semibold sm:block ${isPositive ? "text-emerald-600" : transaction.type === "TRANSFER" ? "text-indigo-600" : "text-slate-700"}`}>
                  {sign}
                  {formatMoney(Number(transaction.amount))}
                </p>
                <div className="col-span-2 flex justify-end gap-2 sm:col-span-1">
                  <Button type="button" variant="default" size="sm" onClick={() => handleEdit(transaction)}>
                    <Icon name="edit" className="h-4 w-4" />
                    Editar
                  </Button>
                  <Button type="button" variant="default" size="sm" onClick={() => void handleDelete(transaction.id)}>
                    <Icon name="delete" className="h-4 w-4" />
                    Eliminar
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
