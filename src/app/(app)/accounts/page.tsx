"use client";

import { useEffect, useState } from "react";
import { Pencil, PlusCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createAccount, deleteAccount, listAccounts, updateAccount, listDebts } from "@/services/finance";
import type { AccountPayload } from "@/services/finance";
import type { Account, AccountType, Debt } from "@/types";

const accountTypes = [
  { value: "CASH", label: "💵 Efectivo" },
  { value: "BANK", label: "🏦 Cuenta bancaria" },
  { value: "CREDIT_CARD", label: "💳 Tarjeta de crédito" },
  { value: "SAVINGS", label: "🐷 Ahorro" },
  { value: "INVESTMENT", label: "📈 Inversión" },
  { value: "OTHER", label: "📦 Otro" },
] as const;

const emptyForm = {
  name: "",
  type: "BANK" as AccountType,
  initialBalance: "0",
  debtId: "",
  currentBalance: "0",
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const [accountsData, debtsData] = await Promise.all([listAccounts(), listDebts()]);
      setAccounts(accountsData);
      setDebts(debtsData);
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
      // Validaciones específicas para tarjetas sin vincular
      if (form.type === "CREDIT_CARD" && !form.debtId) {
        const limit = Number(form.initialBalance);
        const current = Number(form.currentBalance ?? 0);

        if (!form.initialBalance || limit <= 0) {
          throw new Error("Ingresa el límite de crédito.");
        }

        if (isNaN(current) || current < 0) {
          throw new Error("La deuda actual no puede ser negativa.");
        }

        if (current > limit) {
          throw new Error("La deuda actual no puede ser mayor que el límite de la tarjeta.");
        }
      }

      const payload: AccountPayload = {
        name: form.name.trim(),
        type: form.type,
        initialBalance: Number(form.initialBalance),
        currentBalance:
          form.type === "CREDIT_CARD" && !form.debtId
            ? Number(form.currentBalance ?? 0)
            : Number(form.initialBalance),
        debtId: form.debtId || null,
      };

      if (!payload.name) throw new Error("El nombre de la cuenta es obligatorio.");

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
      debtId: account.debt_id ?? "",
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

  const accountTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      CASH: "💵 Efectivo",
      BANK: "🏦 Cuenta bancaria",
      CREDIT_CARD: "💳 Tarjeta de crédito",
      SAVINGS: "🐷 Ahorro",
      INVESTMENT: "📈 Inversión",
      OTHER: "📦 Otro",
    };
    return types[type] ?? type;
  };

  return (
    <div className="space-y-6 p-2 sm:p-4">
      <div>
        <p className="text-sm font-medium text-slate-500">Cuentas</p>
        <h1 className="text-2xl font-semibold text-slate-900">Múltiples fuentes de dinero</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Editar cuenta" : "Nueva cuenta"}</CardTitle>
          <CardDescription>Gestiona efectivo, bancos, tarjetas, ahorro e inversión.</CardDescription>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Nombre de la cuenta</label>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                placeholder="Ej. BBVA Nómina"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Tipo de cuenta</label>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                value={form.type}
                onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as AccountType, debtId: "" }))}
              >
                {accountTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {form.type === "CREDIT_CARD" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Vincular a deuda (opcional)</label>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                  value={form.debtId}
                  onChange={(event) => setForm((current) => ({ ...current, debtId: event.target.value }))}
                >
                  <option value="">No vincular</option>
                  {debts.map((debt) => (
                    <option key={debt.id} value={debt.id}>
                      {debt.name} — {Number(debt.current_balance).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {form.type === "CREDIT_CARD" && !form.debtId && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Límite de crédito (MXN)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                    placeholder="Ej. 50000"
                    value={form.initialBalance}
                    onChange={(event) => setForm((current) => ({ ...current, initialBalance: event.target.value }))}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Deuda actual (MXN)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                    placeholder="0"
                    value={form.currentBalance}
                    onChange={(event) => setForm((current) => ({ ...current, currentBalance: event.target.value }))}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Saldo inicial</label>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                placeholder="Ej. 5000"
                value={form.initialBalance}
                onChange={(event) => setForm((current) => ({ ...current, initialBalance: event.target.value }))}
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
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Aún no hay cuentas. Crea la primera para organizar tus recursos.</div>
          )}

          {accounts.map((account) => (
            <div key={account.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-900">{account.name}</p>
                <p className="text-sm text-slate-500">{accountTypeLabel(account.type)} • {account.current_balance.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</p>
                {account.debt_id && (
                  <p className="text-sm text-slate-500">Vinculada a deuda: {debts.find((d) => d.id === account.debt_id)?.name ?? "-"}</p>
                )}
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
