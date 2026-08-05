"use client";

import { useEffect, useState } from "react";
import { PlusCircle, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createBudget, deleteBudget, listBudgets, listCategories, updateBudget } from "@/services/finance";
import type { Budget, Category } from "@/types";

const budgetPeriods = ["MONTHLY", "WEEKLY", "YEARLY"] as const;

type BudgetForm = {
  categoryId: string;
  amount: string;
  period: (typeof budgetPeriods)[number];
  startDate: string;
};

const emptyForm: BudgetForm = {
  categoryId: "",
  amount: "",
  period: "MONTHLY",
  startDate: new Date().toISOString().slice(0, 10),
};

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<BudgetForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const expenseCategories = categories.filter((category) => category.type === "EXPENSE");

  const loadData = async () => {
    setLoading(true);
    try {
      const [budgetData, categoryData] = await Promise.all([listBudgets(), listCategories()]);
      setBudgets(budgetData);
      setCategories(categoryData);
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      const payload = {
        categoryId: form.categoryId,
        amount: Number(form.amount),
        period: form.period,
        startDate: form.startDate,
      };

      if (!payload.categoryId) {
        throw new Error("Selecciona una categoría.");
      }

      if (payload.amount <= 0) {
        throw new Error("El monto debe ser mayor que cero.");
      }

      if (editingId) {
        await updateBudget(editingId, payload);
      } else {
        await createBudget(payload);
      }

      setForm(emptyForm);
      setEditingId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el presupuesto.");
    }
  };

  const handleEdit = (budget: Budget) => {
    setEditingId(budget.id);
    setForm({
      categoryId: budget.category_id,
      amount: String(budget.amount),
      period: budget.period as typeof emptyForm.period,
      startDate: budget.start_date,
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBudget(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el presupuesto.");
    }
  };

  return (
    <div className="space-y-6 p-2 sm:p-4">
      <div>
        <p className="text-sm font-medium text-slate-500">Presupuestos</p>
        <h1 className="text-2xl font-semibold text-slate-900">Límites por categoría</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Editar presupuesto" : "Nuevo presupuesto"}</CardTitle>
          <CardDescription>Establece límites por categoría y periodo.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
          <Wallet className="h-6 w-6 text-slate-600" />
          <div className="w-full">
            <p className="text-sm font-semibold text-slate-900">Crea presupuestos por categoría</p>
            <p className="text-sm text-slate-500">Controla tus límites de gasto con periodos definidos.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Editar presupuesto" : "Nuevo presupuesto"}</CardTitle>
          <CardDescription>Establece límites por categoría y periodo.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <select
              className="w-full h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none"
              value={form.categoryId}
              onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
            >
              <option value="">Selecciona una categoría</option>
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="number"
                step="0.01"
                className="w-full h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none"
                placeholder="Monto del presupuesto"
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
              />
              <select
                className="w-full h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none"
                value={form.period}
                onChange={(event) => setForm((current) => ({ ...current, period: event.target.value as typeof emptyForm.period }))}
              >
                {budgetPeriods.map((period) => (
                  <option key={period} value={period}>
                    {period}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="date"
              className="w-full h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none"
              value={form.startDate}
              onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
            />
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit">
                <PlusCircle className="h-4 w-4" />
                {editingId ? "Guardar cambios" : "Crear presupuesto"}
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
          <CardTitle>Presupuestos activos</CardTitle>
          <CardDescription>{loading ? "Cargando..." : `${budgets.length} presupuestos registrados`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {budgets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              Aún no tienes presupuestos. Crea uno para vigilar tus gastos.
            </div>
          ) : (
            budgets.map((budget) => {
              const category = categories.find((item) => item.id === budget.category_id);
              return (
                <div key={budget.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{category?.name ?? "Categoría eliminada"}</p>
                    <p className="text-sm text-slate-500">{budget.period} • inicia {budget.start_date}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => handleEdit(budget)}>
                      Editar
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={() => void handleDelete(budget.id)}>
                      Eliminar
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </CardContent>
        </Card>
      )}
    </div>
  );
}


