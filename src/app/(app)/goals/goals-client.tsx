"use client";

import { useState } from "react";
import { PlusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createGoal, deleteGoal, listGoals, updateGoal } from "@/services/finance";
import type { Goal } from "@/types";

const emptyForm = {
  name: "",
  targetAmount: "",
  currentAmount: "",
  targetDate: new Date().toISOString().slice(0, 10),
};

// QA-41 — Client Component hijo del Server Component goals/page.tsx.
// Recibe las metas ya cargadas en el servidor (initialGoals) para que el
// contenido sea visible aunque la hidratación esté bloqueada por la CSP
// estricta. Las mutaciones siguen usando el cliente browser de Supabase.
export function GoalsClient({ initialGoals }: { initialGoals: Goal[] }) {
  const [goals, setGoals] = useState<Goal[]>(initialGoals);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      setGoals(await listGoals());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las metas.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      const payload = {
        name: form.name.trim(),
        targetAmount: Number(form.targetAmount),
        currentAmount: Number(form.currentAmount),
        targetDate: form.targetDate || null,
      };

      if (!payload.name) {
        throw new Error("El nombre de la meta es obligatorio.");
      }

      if (payload.targetAmount <= 0) {
        throw new Error("El objetivo debe ser mayor que cero.");
      }

      if (payload.currentAmount < 0) {
        throw new Error("El monto actual no puede ser negativo.");
      }

      if (editingId) {
        await updateGoal(editingId, payload);
      } else {
        await createGoal(payload);
      }

      setForm(emptyForm);
      setEditingId(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la meta.");
    }
  };

  const handleEdit = (goal: Goal) => {
    setEditingId(goal.id);
    setForm({
      name: goal.name,
      targetAmount: String(goal.target_amount),
      currentAmount: String(goal.current_amount),
      targetDate: goal.target_date ?? new Date().toISOString().slice(0, 10),
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteGoal(id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la meta.");
    }
  };

  return (
    <div className="space-y-6 p-2 sm:p-4">
      <div>
        <p className="text-sm font-medium text-slate-500">Metas</p>
        <h1 className="text-2xl font-semibold text-slate-900">Ahorro y objetivos financieros</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Editar meta" : "Nueva meta"}</CardTitle>
          <CardDescription>Define objetivos y visualiza el avance.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <input
              className="w-full h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none"
              placeholder="Nombre de la meta"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="number"
                step="0.01"
                className="w-full h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none"
                placeholder="Monto objetivo"
                value={form.targetAmount}
                onChange={(event) => setForm((current) => ({ ...current, targetAmount: event.target.value }))}
              />
              <input
                type="number"
                step="0.01"
                className="w-full h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none"
                placeholder="Monto actual"
                value={form.currentAmount}
                onChange={(event) => setForm((current) => ({ ...current, currentAmount: event.target.value }))}
              />
            </div>
            <input
              type="date"
              className="w-full h-12 rounded-2xl border border-slate-200 bg-white px-4 text-base outline-none"
              value={form.targetDate}
              onChange={(event) => setForm((current) => ({ ...current, targetDate: event.target.value }))}
            />
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="flex justify-center gap-2">
              <Button type="submit">
                <PlusCircle className="h-4 w-4" />
                {editingId ? "Guardar cambios" : "Crear meta"}
              </Button>
              {editingId && (
                <Button type="button" variant="default" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Metas activas</CardTitle>
          <CardDescription>{loading ? "Cargando..." : `${goals.length} metas registradas`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {goals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              Aún no hay metas. Crea una para empezar a ahorrar con rumbo.
            </div>
          ) : (
            goals.map((goal) => {
              const progress = goal.target_amount > 0 ? Math.min((goal.current_amount / goal.target_amount) * 100, 100) : 0;
              return (
                <div key={goal.id} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{goal.name}</p>
                      <p className="text-sm text-slate-500">Fecha objetivo: {goal.target_date ?? "Sin fecha"}</p>
                    </div>
                    <div className="text-right text-sm text-slate-600">
                      <p>{goal.current_amount.toLocaleString("es-MX", { style: "currency", currency: "MXN" })} / {goal.target_amount.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}</p>
                      <p>{Math.round(progress)}%</p>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="flex w-full justify-center gap-2">
                    <Button type="button" variant="default" size="sm" onClick={() => handleEdit(goal)}>
                      Editar
                    </Button>
                    <Button type="button" variant="default" size="sm" onClick={() => void handleDelete(goal.id)}>
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
