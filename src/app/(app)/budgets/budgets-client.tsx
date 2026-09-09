"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatMXN } from "@/lib/format";
import { formatMonthLabel, shiftMonth } from "@/lib/date-utils";
import { getBudgetStatus } from "@/lib/budget-status";
import { createCategory } from "@/app/(app)/transactions/actions";
import { createBudget, deleteBudget, updateBudget, type ActionState } from "./actions";
import type { Category } from "@/types/database";
import type { BudgetRow } from "./page";

interface Props {
  month: string;
  budgets: BudgetRow[];
  categories: Category[];
  spentByCategory: Record<string, number>;
}

const STATUS_BADGE: Record<ReturnType<typeof getBudgetStatus>, { tone: "success" | "warning" | "danger"; label: string }> = {
  ok: { tone: "success", label: "Al día" },
  warning: { tone: "warning", label: "Cerca del límite" },
  over: { tone: "danger", label: "Excedido" },
};

const STATUS_BAR_COLOR: Record<ReturnType<typeof getBudgetStatus>, string> = {
  ok: "bg-monday-violet",
  warning: "bg-apricot",
  over: "bg-red-500",
};

export function BudgetsClient({ month, budgets, categories: initialCategories, spentByCategory }: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const budgetedCategoryIds = new Set(budgets.map((b) => b.category_id));
  const availableCategories = categories.filter((c) => !budgetedCategoryIds.has(c.id));

  function goToMonth(newMonth: string) {
    router.push(`/budgets?month=${newMonth}`);
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light text-ink md:text-3xl">Presupuestos</h1>
        {!creating && availableCategories.length > 0 && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={18} /> Nuevo presupuesto
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          aria-label="Mes anterior"
          onClick={() => goToMonth(shiftMonth(month, -1))}
          className="flex h-11 w-11 items-center justify-center rounded-badge text-slate transition-colors hover:bg-pebble/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet"
        >
          <ChevronLeft size={20} />
        </button>
        <p className="min-w-[10rem] text-center font-medium text-ink">{formatMonthLabel(month)}</p>
        <button
          aria-label="Mes siguiente"
          onClick={() => goToMonth(shiftMonth(month, 1))}
          className="flex h-11 w-11 items-center justify-center rounded-badge text-slate transition-colors hover:bg-pebble/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {creating && (
        <CreateBudgetForm
          month={month}
          categories={availableCategories}
          onAddCategory={(c) => setCategories((prev) => [...prev, c])}
          onDone={() => setCreating(false)}
        />
      )}

      {budgets.length === 0 && !creating ? (
        <Card>
          <p className="text-sm text-slate">
            {categories.length === 0
              ? "Aún no tienes categorías de gasto. Crea un presupuesto para agregar la primera."
              : "No tienes presupuestos para este mes."}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => {
            const spent = spentByCategory[budget.category_id] ?? 0;
            const status = getBudgetStatus(spent, budget.amount_limit, budget.alert_threshold_pct);
            const pct = Math.min((spent / budget.amount_limit) * 100, 100);

            return editingId === budget.id ? (
              <EditBudgetForm key={budget.id} budget={budget} onDone={() => setEditingId(null)} />
            ) : (
              <Card key={budget.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-ink">{budget.category?.name ?? "Categoría"}</p>
                    <Badge tone={STATUS_BADGE[status].tone} className="mt-1">
                      {STATUS_BADGE[status].label}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <button
                      aria-label="Editar presupuesto"
                      onClick={() => setEditingId(budget.id)}
                      className="flex h-11 w-11 items-center justify-center rounded-badge text-slate transition-colors hover:bg-pebble/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet"
                    >
                      <Pencil size={16} />
                    </button>
                    <DeleteBudgetButton id={budget.id} categoryName={budget.category?.name ?? "esta categoría"} />
                  </div>
                </div>

                <div>
                  <div
                    className="h-2 w-full overflow-hidden rounded-badge bg-pebble"
                    role="progressbar"
                    aria-valuenow={Math.round(pct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Presupuesto de ${budget.category?.name ?? "esta categoría"}: ${formatMXN(spent)} de ${formatMXN(budget.amount_limit)}`}
                  >
                    <div
                      className={`h-full ${STATUS_BAR_COLOR[status]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-sm text-slate">
                    {formatMXN(spent)} de {formatMXN(budget.amount_limit)}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DeleteBudgetButton({ id, categoryName }: { id: string; categoryName: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      aria-label="Eliminar presupuesto"
      disabled={pending}
      onClick={async () => {
        if (!confirm(`¿Eliminar el presupuesto de "${categoryName}"?`)) return;
        setPending(true);
        await deleteBudget(id);
        setPending(false);
      }}
      className="flex h-11 w-11 items-center justify-center rounded-badge text-slate transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950 dark:hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet"
    >
      <Trash2 size={16} />
    </button>
  );
}

function CreateBudgetForm({
  month,
  categories,
  onAddCategory,
  onDone,
}: {
  month: string;
  categories: Category[];
  onAddCategory: (c: Category) => void;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await createBudget(prev, fd);
    if (!result) onDone();
    return result;
  }, null);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [creatingCategory, setCreatingCategory] = useState(false);

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    setCreatingCategory(true);
    const result = await createCategory(newCategoryName.trim(), "expense");
    setCreatingCategory(false);
    if (result.data) {
      const category = result.data as Category;
      onAddCategory(category);
      setCategoryId(category.id);
      setNewCategoryOpen(false);
      setNewCategoryName("");
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-ink">Nuevo presupuesto — {formatMonthLabel(month)}</h2>
        <button onClick={onDone} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center rounded-badge text-slate transition-colors hover:bg-pebble/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet">
          <X size={18} />
        </button>
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="month" value={month} />

        <div>
          <Label htmlFor="category_id">Categoría</Label>
          {categories.length > 0 ? (
            <Select
              id="category_id"
              name="category_id"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          ) : (
            <input type="hidden" name="category_id" value={categoryId} />
          )}

          {!newCategoryOpen ? (
            <button
              type="button"
              onClick={() => setNewCategoryOpen(true)}
              className="mt-2 text-sm font-medium text-violet-text"
            >
              + Nueva categoría de gasto
            </button>
          ) : (
            <div className="mt-2 flex gap-2">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Ej. Supermercado"
              />
              <Button type="button" variant="outline" disabled={creatingCategory} onClick={handleCreateCategory}>
                Crear
              </Button>
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="amount_limit">Límite mensual (MXN)</Label>
          <Input id="amount_limit" name="amount_limit" type="number" step="0.01" min="0.01" required />
        </div>

        <div>
          <Label htmlFor="alert_threshold_pct">Alertar al superar (%)</Label>
          <Input
            id="alert_threshold_pct"
            name="alert_threshold_pct"
            type="number"
            min="1"
            max="100"
            required
            defaultValue={80}
          />
        </div>

        {state?.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

        <div className="flex gap-2">
          <Button type="submit" disabled={pending || !categoryId}>
            {pending ? "Guardando..." : "Guardar"}
          </Button>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}

function EditBudgetForm({ budget, onDone }: { budget: BudgetRow; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await updateBudget(budget.id, prev, fd);
    if (!result) onDone();
    return result;
  }, null);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-ink">{budget.category?.name}</h2>
        <button onClick={onDone} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center rounded-badge text-slate transition-colors hover:bg-pebble/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet">
          <X size={18} />
        </button>
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="edit_amount_limit">Límite mensual (MXN)</Label>
          <Input
            id="edit_amount_limit"
            name="amount_limit"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={budget.amount_limit}
          />
        </div>

        <div>
          <Label htmlFor="edit_alert_threshold_pct">Alertar al superar (%)</Label>
          <Input
            id="edit_alert_threshold_pct"
            name="alert_threshold_pct"
            type="number"
            min="1"
            max="100"
            required
            defaultValue={budget.alert_threshold_pct}
          />
        </div>

        {state?.error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : "Guardar"}
          </Button>
          <Button type="button" variant="outline" onClick={onDone}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}
