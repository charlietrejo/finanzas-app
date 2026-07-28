"use client";

import { useEffect, useState } from "react";
import { Pencil, PlusCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createTransaction, deleteTransaction, listAccounts, listCategories, listTransactions, updateTransaction } from "@/services/finance";
import type { Account, Category, Transaction, TransactionType } from "@/types";

const transactionTypes: TransactionType[] = ["INCOME", "EXPENSE", "TRANSFER"];

const emptyForm = {
  type: "EXPENSE" as TransactionType,
  amount: "",
  description: "",
  notes: "",
  accountId: "",
  categoryId: "",
  destinationAccountId: "",
  transactionDate: new Date().toISOString().slice(0, 10),
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [transactionsData, accountsData, categoriesData] = await Promise.all([listTransactions(), listAccounts(), listCategories()]);
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
    });
  }, []);

  const filteredCategories = form.type === "TRANSFER" ? [] : categories.filter((category) => category.type === form.type);

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
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Movimientos</p>
          <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Historial y filtros</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Editar movimiento" : "Nuevo movimiento"}</CardTitle>
          <CardDescription>Registra ingresos, gastos y transferencias con categorías y cuentas.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                value={form.type}
                onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as TransactionType, categoryId: "" }))}
              >
                {transactionTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                placeholder="Importe"
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
              />
            </div>

            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
              placeholder="Descripción"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />

            <textarea
              className="min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
              placeholder="Notas opcionales"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
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
              <select
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                value={form.categoryId}
                onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
              >
                <option value="">Sin categoría</option>
                {filteredCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {form.type === "TRANSFER" && (
              <select
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
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

            <input
              type="date"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
              value={form.transactionDate}
              onChange={(event) => setForm((current) => ({ ...current, transactionDate: event.target.value }))}
            />

            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit">
                <PlusCircle className="h-4 w-4" />
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
          <CardTitle>Últimos movimientos</CardTitle>
          <CardDescription>{loading ? "Cargando..." : `${transactions.length} registros`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {transactions.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              No hay movimientos aún. Crea el primero para empezar a construir tu historial.
            </div>
          )}

          {transactions.map((transaction) => (
            <div key={transaction.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{transaction.description}</p>
                <p className="text-sm text-slate-500">{transaction.type} • {transaction.transaction_date}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {Number(transaction.amount).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
                </span>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => handleEdit(transaction)}>
                    <Pencil className="h-4 w-4" />
                    Editar
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => void handleDelete(transaction.id)}>
                    <Trash2 className="h-4 w-4" />
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
