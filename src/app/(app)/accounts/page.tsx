"use client";

import { useEffect, useState } from "react";
import { Pencil, PlusCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createAccount, deleteAccount, listAccounts, updateAccount } from "@/services/finance";
import type { Account, AccountType } from "@/types";

const accountTypes: AccountType[] = ["CASH", "BANK", "CREDIT_CARD", "SAVINGS", "INVESTMENT", "OTHER"];

const emptyForm = {
  name: "",
  type: "BANK" as AccountType,
  initialBalance: "0",
  currentBalance: "0",
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      setAccounts(await listAccounts());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las cuentas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadAccounts();
    });
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        initialBalance: Number(form.initialBalance),
        currentBalance: Number(form.currentBalance),
      };

      if (!payload.name) {
        throw new Error("El nombre de la cuenta es obligatorio.");
      }

      if (editingId) {
        await updateAccount(editingId, payload);
      } else {
        await createAccount(payload);
      }

      setForm(emptyForm);
      setEditingId(null);
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la cuenta.");
    }
  };

  const handleEdit = (account: Account) => {
    setEditingId(account.id);
    setForm({
      name: account.name,
      type: account.type,
      initialBalance: String(account.initial_balance),
      currentBalance: String(account.current_balance),
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAccount(id);
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la cuenta.");
    }
  };

  return (
    <div className="space-y-6 p-2 sm:p-4">
      <div>
        <p className="text-sm font-medium text-slate-500">Cuentas</p>
        <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Múltiples fuentes de dinero</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Editar cuenta" : "Nueva cuenta"}</CardTitle>
          <CardDescription>Gestiona efectivo, banco, tarjetas, ahorro e inversión.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
              placeholder="Nombre de la cuenta"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as AccountType }))}
            >
              {accountTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="number"
                step="0.01"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                placeholder="Saldo inicial"
                value={form.initialBalance}
                onChange={(event) => setForm((current) => ({ ...current, initialBalance: event.target.value }))}
              />
              <input
                type="number"
                step="0.01"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none dark:border-slate-700 dark:bg-slate-800"
                placeholder="Saldo actual"
                value={form.currentBalance}
                onChange={(event) => setForm((current) => ({ ...current, currentBalance: event.target.value }))}
              />
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit">
                <PlusCircle className="h-4 w-4" />
                {editingId ? "Guardar cambios" : "Crear cuenta"}
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
          <CardTitle>Listado</CardTitle>
          <CardDescription>{loading ? "Cargando..." : `${accounts.length} cuentas registradas`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Aún no hay cuentas. Crea la primera para organizar tus recursos.
            </div>
          )}

          {accounts.map((account) => (
            <div key={account.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/70 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{account.name}</p>
                <p className="text-sm text-slate-500">{account.type} • saldo actual {account.current_balance.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => handleEdit(account)}>
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => void handleDelete(account.id)}>
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
