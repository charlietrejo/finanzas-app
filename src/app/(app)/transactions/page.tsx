"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/ui/icon-material";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createTransaction, deleteTransaction, listAccounts, listCategories, listTransactions, updateTransaction, listDebts } from "@/services/finance";
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

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [transactionsData, accountsData, categoriesData, debtsData] = await Promise.all([listTransactions(), listAccounts(), listCategories(), listDebts()]);
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

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();

      // Preselecciona el tipo desde ?type= (acciones rápidas del dashboard).
      const presetType = new URLSearchParams(window.location.search).get("type");
      if (presetType && (transactionTypes as string[]).includes(presetType)) {
        setForm((prev) => ({ ...prev, type: presetType as TransactionType }));
      }
    });
  }, []);

  const selectedAccount = accounts.find((a) => a.id === form.accountId);
  const selectedLinkedDebt = debts.find((d) => d.id === selectedAccount?.debt_id);

  const money = (value: number) =>
    value.toLocaleString("es-MX", { style: "currency", currency: "MXN" });

  const filteredCategories =
  form.type === "TRANSFER" || form.type === "DEBT_PAYMENT"
    ? []
    : categories.filter((category) => category.type === form.type);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      const payload = {
        type: form.type,
        amount: Number(form.amount),
        description: form.description.trim(),
        notes: form.notes.trim() || undefined,
        accountId: form.accountId,
        categoryId: form.categoryId || null,
        destinationAccountId: form.destinationAccountId || null,
        transactionDate: form.transactionDate,
        debtId: form.debtId || null,
      };

      if (!payload.description) {
        throw new Error("La descripción es obligatoria.");
      }

      if (!payload.accountId) {
        throw new Error("Selecciona una cuenta.");
      }

      if (payload.type === "TRANSFER" && !payload.destinationAccountId) {
        throw new Error("Selecciona una cuenta destino para la transferencia.");
      }

      if (payload.type === "DEBT_PAYMENT" && !payload.debtId) {
  throw new Error("Selecciona la deuda que deseas pagar.");
}

      if (payload.type === "DEBT_PAYMENT" && payload.debtId) {
        const debt = debts.find((d) => d.id === payload.debtId);
        if (debt && Number(payload.amount) > Number(debt.current_balance)) {
          throw new Error("El pago no puede ser mayor a la deuda actual.");
        }
      }

      if (editingId) {
        await updateTransaction(editingId, payload);
      } else {
        await createTransaction(payload);
      }

      setForm(emptyForm);
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
    try {
      await deleteTransaction(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el movimiento.");
    }
  };

  return (
    <div className="space-y-6 p-2 sm:p-4">
      <div className="space-y-3 rounded-[32px] bg-gradient-to-br from-violet-600 via-indigo-600 to-sky-600 px-5 py-5 text-white shadow-lg shadow-slate-900/20 sm:flex sm:items-end sm:justify-between sm:px-6">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-200/80">
  Finanzas
</p>
          <h1 className="mt-3 text-2xl font-semibold">Registra tu movimiento</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-100/90">
            Crea ingresos, gastos o transferencias con una experiencia móvil conocida y clara.
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
                className="w-full h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-violet-400"
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
                      ? (selectedAccount?.type === "CREDIT_CARD" ? "Compra con tarjeta" : "Gasto")
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
                className="w-full h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-violet-400"
                placeholder="Importe"
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
              />
            </div>

            <input
              className="w-full h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-violet-400"
              placeholder="Descripción"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />

            <textarea
              className="min-h-24 w-full h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-violet-400"
              placeholder="Notas opcionales"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <select
  className="w-full h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-violet-400"
  value={form.accountId}
  onChange={(event) =>
    setForm((current) => ({
      ...current,
      accountId: event.target.value,
    }))
  }
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
                <strong>Tarjeta:</strong> {selectedLinkedDebt.name} • <strong>Disponible:</strong> {money(selectedLinkedDebt.initial_amount - selectedLinkedDebt.current_balance)}
              </div>
            )}
            {selectedAccount && selectedAccount.type === "CREDIT_CARD" && !selectedLinkedDebt && (
              <div className="mt-2 rounded-lg bg-slate-100/60 px-3 py-2 text-sm text-slate-700">
                <strong>Tarjeta:</strong> {selectedAccount.name} • <strong>Disponible:</strong> {money(Number(selectedAccount.initial_balance) - Number(selectedAccount.current_balance))}
              </div>
            )}
{form.type !== "DEBT_PAYMENT" && (
  <select
    className="w-full h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-violet-400"
    value={form.categoryId}
    onChange={(event) =>
      setForm((current) => ({
        ...current,
        categoryId: event.target.value,
      }))
    }
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
                className="w-full h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-violet-400"
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
    className="w-full h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-violet-400"
    value={form.debtId}
    onChange={(event) =>
      setForm((current) => ({
        ...current,
        debtId: event.target.value,
      }))
    }
  >
    <option value="">
      Selecciona una deuda
    </option>

    {debts.map((debt) => (
      <option key={debt.id} value={debt.id}>
        {debt.name} -{" "}
        {Number(debt.current_balance).toLocaleString("es-MX", {
          style: "currency",
          currency: "MXN",
        })}
      </option>
    ))}
  </select>
)}

            <input
              type="date"
              className="w-full h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none transition focus:border-violet-400"
              value={form.transactionDate}
              onChange={(event) => setForm((current) => ({ ...current, transactionDate: event.target.value }))}
            />

            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <Button type="submit" className="min-w-[190px]">
                <Icon name="add" className="h-4 w-4" />
                {editingId ? "Guardar cambios" : "Crear movimiento"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
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
          <CardDescription>{loading ? "Cargando..." : `${transactions.length} registros`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {transactions.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              Aún no hay transacciones. Registra la primera para ver tu flujo de dinero.
            </div>
          )}

          {transactions.map((transaction) => (
            <div key={transaction.id} className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-900">{transaction.description}</p>
                <p className="text-sm text-slate-500">
  {transaction.type === "INCOME"
    ? "Ingreso"
    : transaction.type === "EXPENSE"
    ? "Gasto"
    : transaction.type === "TRANSFER"
    ? "Transferencia"
    : "Pago de deuda"}{" "}
  • {transaction.transaction_date}
</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <span className="font-semibold text-slate-900">
                  {Number(transaction.amount).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
                </span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => handleEdit(transaction)}>
                    <Icon name="edit" className="h-4 w-4" />
                    Editar
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => void handleDelete(transaction.id)}>
                    <Icon name="delete" className="h-4 w-4" />
                    Eliminar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

