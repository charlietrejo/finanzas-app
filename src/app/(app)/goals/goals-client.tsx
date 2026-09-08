"use client";

import { useActionState, useState } from "react";
import { Plus, Pencil, Trash2, X, HandCoins } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { formatDate, formatMXN } from "@/lib/format";
import { projectGoalCompletion } from "@/lib/goal-projection";
import {
  createGoal,
  createGoalContribution,
  deleteGoal,
  updateGoal,
  type ActionState,
} from "./actions";
import type { Account, Goal } from "@/types/database";

export function GoalsClient({ goals, accounts }: { goals: Goal[]; accounts: Account[] }) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contributingId, setContributingId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light text-ink md:text-3xl">Metas de ahorro</h1>
        {!creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={18} /> Nueva meta
          </Button>
        )}
      </div>

      {creating && <CreateGoalForm accounts={accounts} onDone={() => setCreating(false)} />}

      {goals.length === 0 && !creating ? (
        <Card>
          <p className="text-sm text-slate">Aún no tienes metas de ahorro.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {goals.map((goal) =>
            editingId === goal.id ? (
              <EditGoalForm key={goal.id} goal={goal} accounts={accounts} onDone={() => setEditingId(null)} />
            ) : (
              <Card key={goal.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-ink">{goal.name}</p>
                    <p className="text-xs text-slate">Fecha límite: {formatDate(goal.target_date)}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      aria-label="Editar meta"
                      onClick={() => setEditingId(goal.id)}
                      className="rounded-badge p-1.5 text-slate hover:bg-pebble/40"
                    >
                      <Pencil size={16} />
                    </button>
                    <DeleteGoalButton id={goal.id} name={goal.name} />
                  </div>
                </div>

                <GoalProgress goal={goal} />

                <div>
                  <Button
                    variant="outline"
                    onClick={() => setContributingId(contributingId === goal.id ? null : goal.id)}
                  >
                    <HandCoins size={16} /> Aportar
                  </Button>
                </div>

                {contributingId === goal.id && (
                  <ContributeForm goal={goal} accounts={accounts} onDone={() => setContributingId(null)} />
                )}
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}

function GoalProgress({ goal }: { goal: Goal }) {
  const pct = Math.min((goal.current_amount / goal.target_amount) * 100, 100);
  const projection = projectGoalCompletion({
    targetAmount: goal.target_amount,
    currentAmount: goal.current_amount,
    createdAt: goal.created_at,
    targetDate: goal.target_date,
  });

  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-badge bg-pebble">
        <div
          className={`h-full ${projection.status === "completed" ? "bg-mint" : projection.onTrack === false ? "bg-apricot" : "bg-monday-violet"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-slate">
        {formatMXN(goal.current_amount)} de {formatMXN(goal.target_amount)}
      </p>
      <p className="mt-1 text-xs text-slate">{projectionText(projection)}</p>
    </div>
  );
}

function projectionText(projection: ReturnType<typeof projectGoalCompletion>): string {
  switch (projection.status) {
    case "completed":
      return "¡Meta cumplida!";
    case "insufficient_data":
      return "Aún no hay suficiente historial para proyectar.";
    case "no_progress":
      return "Sin aportaciones registradas todavía.";
    case "projected":
      return projection.onTrack
        ? `A este ritmo, la cumples en ~${projection.monthsToGo} ${projection.monthsToGo === 1 ? "mes" : "meses"} (antes de la fecha límite).`
        : `A este ritmo, la cumples en ~${projection.monthsToGo} ${projection.monthsToGo === 1 ? "mes" : "meses"} — no alcanza antes de la fecha límite.`;
  }
}

function DeleteGoalButton({ id, name }: { id: string; name: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      aria-label="Eliminar meta"
      disabled={pending}
      onClick={async () => {
        if (!confirm(`¿Eliminar la meta "${name}"? Esto también eliminará su historial de aportaciones.`)) return;
        setPending(true);
        await deleteGoal(id);
        setPending(false);
      }}
      className="rounded-badge p-1.5 text-slate hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      <Trash2 size={16} />
    </button>
  );
}

function CreateGoalForm({ accounts, onDone }: { accounts: Account[]; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await createGoal(prev, fd);
    if (!result) onDone();
    return result;
  }, null);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-ink">Nueva meta</h2>
        <button onClick={onDone} aria-label="Cerrar" className="text-slate">
          <X size={18} />
        </button>
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" required placeholder="Ej. Fondo de emergencia" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="target_amount">Monto objetivo (MXN)</Label>
            <Input id="target_amount" name="target_amount" type="number" step="0.01" min="0.01" required />
          </div>
          <div>
            <Label htmlFor="target_date">Fecha límite</Label>
            <Input id="target_date" name="target_date" type="date" required />
          </div>
        </div>
        {accounts.length > 0 && (
          <div>
            <Label htmlFor="account_id">Cuenta preferida (opcional)</Label>
            <Select id="account_id" name="account_id" defaultValue="">
              <option value="">Sin preferencia</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

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

function EditGoalForm({ goal, accounts, onDone }: { goal: Goal; accounts: Account[]; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await updateGoal(goal.id, prev, fd);
    if (!result) onDone();
    return result;
  }, null);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-ink">Editar meta</h2>
        <button onClick={onDone} aria-label="Cerrar" className="text-slate">
          <X size={18} />
        </button>
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="edit_name">Nombre</Label>
          <Input id="edit_name" name="name" required defaultValue={goal.name} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="edit_target_amount">Monto objetivo (MXN)</Label>
            <Input
              id="edit_target_amount"
              name="target_amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              defaultValue={goal.target_amount}
            />
          </div>
          <div>
            <Label htmlFor="edit_target_date">Fecha límite</Label>
            <Input id="edit_target_date" name="target_date" type="date" required defaultValue={goal.target_date} />
          </div>
        </div>
        {accounts.length > 0 && (
          <div>
            <Label htmlFor="edit_account_id">Cuenta preferida (opcional)</Label>
            <Select id="edit_account_id" name="account_id" defaultValue={goal.account_id ?? ""}>
              <option value="">Sin preferencia</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
        )}

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

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

function ContributeForm({ goal, accounts, onDone }: { goal: Goal; accounts: Account[]; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await createGoalContribution(prev, fd);
    if (!result) onDone();
    return result;
  }, null);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-card bg-cloud p-4">
      <input type="hidden" name="goal_id" value={goal.id} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="contrib_account_id">Cuenta de origen</Label>
          <Select id="contrib_account_id" name="account_id" required defaultValue={goal.account_id ?? accounts[0]?.id}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="contrib_amount">Monto (MXN)</Label>
          <Input id="contrib_amount" name="amount" type="number" step="0.01" min="0.01" required />
        </div>
        <div>
          <Label htmlFor="contrib_date">Fecha</Label>
          <Input
            id="contrib_date"
            name="date"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div>
          <Label htmlFor="contrib_note">Nota (opcional)</Label>
          <Input id="contrib_note" name="note" maxLength={500} />
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || accounts.length === 0}>
          {pending ? "Aportando..." : "Aportar"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
      </div>
      {accounts.length === 0 && <p className="text-xs text-slate">Necesitas al menos una cuenta.</p>}
    </form>
  );
}
