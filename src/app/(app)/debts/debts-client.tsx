"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, X, HandCoins, Calculator, CreditCard } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatMXN } from "@/lib/format";
import { DEBT_TYPE_LABELS, DEBT_TYPES } from "@/lib/constants/debt-types";
import { sortAvalanche, sortSnowball } from "@/lib/debt-strategy";
import { buildAmortizationSchedule } from "@/lib/amortization";
import type { CreditCardDebt } from "@/lib/credit-card-debt";
import { createDebt, createDebtPayment, deleteDebt, updateDebt, type ActionState } from "./actions";
import type { Account, Debt, DebtType } from "@/types/database";

type Strategy = "none" | "snowball" | "avalanche";

export function DebtsClient({
  debts,
  accounts,
  creditCardDebts,
}: {
  debts: Debt[];
  accounts: Account[];
  creditCardDebts: CreditCardDebt[];
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [simulatingId, setSimulatingId] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<Strategy>("none");

  const orderedDebts = useMemo(() => {
    if (strategy === "snowball") return sortSnowball(debts);
    if (strategy === "avalanche") return sortAvalanche(debts);
    return debts;
  }, [debts, strategy]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light text-ink md:text-3xl">Deudas</h1>
        {!creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={18} /> Nueva deuda
          </Button>
        )}
      </div>

      {debts.length > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate">Estrategia:</span>
          {(["none", "snowball", "avalanche"] as Strategy[]).map((s) => (
            <button
              key={s}
              onClick={() => setStrategy(s)}
              className={
                "rounded-pill px-4 py-1.5 " +
                (strategy === s ? "bg-monday-violet text-snow" : "bg-pebble/40 text-slate hover:bg-pebble/60")
              }
            >
              {s === "none" ? "Sin ordenar" : s === "snowball" ? "Bola de nieve" : "Avalancha"}
            </button>
          ))}
        </div>
      )}

      {creating && <CreateDebtForm onDone={() => setCreating(false)} />}

      {creditCardDebts.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-slate">Tarjetas de crédito (desde Cuentas)</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {creditCardDebts.map((cc) => (
              <Card key={cc.accountId} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <CreditCard size={16} className="text-monday-violet" />
                  <Badge tone="warning">Tarjeta</Badge>
                </div>
                <p className="font-medium text-ink">{cc.name}</p>
                <p className="text-2xl font-light text-ink">{formatMXN(cc.owed)}</p>
                {cc.creditLimit != null && (
                  <p className="text-xs text-slate">Límite: {formatMXN(cc.creditLimit)}</p>
                )}
                <Link href="/accounts" className="text-sm font-medium text-monday-violet">
                  Ver en Cuentas
                </Link>
              </Card>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate">
            Se calcula solo con el saldo de la cuenta — para pagarlas, registra una transferencia hacia esta
            cuenta desde Movimientos.
          </p>
        </div>
      )}

      {debts.length === 0 && !creating && creditCardDebts.length === 0 ? (
        <Card>
          <p className="text-sm text-slate">Aún no tienes deudas registradas.</p>
        </Card>
      ) : debts.length === 0 ? null : (
        <div className="flex flex-col gap-4">
          {orderedDebts.map((debt, index) =>
            editingId === debt.id ? (
              <EditDebtForm key={debt.id} debt={debt} onDone={() => setEditingId(null)} />
            ) : (
              <Card key={debt.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {strategy !== "none" && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-periwinkle text-xs font-medium text-monday-violet">
                          {index + 1}
                        </span>
                      )}
                      <Badge tone="info">{DEBT_TYPE_LABELS[debt.type]}</Badge>
                    </div>
                    <p className="mt-2 font-medium text-ink">{debt.name}</p>
                    <p className="text-xs text-slate">
                      Tasa anual: {debt.interest_rate}% · Pago mínimo: {formatMXN(debt.minimum_payment)}
                      {debt.due_day ? ` · Día de pago: ${debt.due_day}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      aria-label="Editar deuda"
                      onClick={() => setEditingId(debt.id)}
                      className="rounded-badge p-1.5 text-slate hover:bg-pebble/40"
                    >
                      <Pencil size={16} />
                    </button>
                    <DeleteDebtButton id={debt.id} name={debt.name} />
                  </div>
                </div>

                <p className="text-2xl font-light text-ink">{formatMXN(debt.current_balance)}</p>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setPayingId(payingId === debt.id ? null : debt.id)}>
                    <HandCoins size={16} /> Registrar pago
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setSimulatingId(simulatingId === debt.id ? null : debt.id)}
                  >
                    <Calculator size={16} /> Simular amortización
                  </Button>
                </div>

                {payingId === debt.id && (
                  <RegisterPaymentForm debt={debt} accounts={accounts} onDone={() => setPayingId(null)} />
                )}

                {simulatingId === debt.id && <AmortizationSimulator debt={debt} />}
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}

function DeleteDebtButton({ id, name }: { id: string; name: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      aria-label="Eliminar deuda"
      disabled={pending}
      onClick={async () => {
        if (!confirm(`¿Eliminar la deuda "${name}"? Esto también eliminará su historial de pagos.`)) return;
        setPending(true);
        await deleteDebt(id);
        setPending(false);
      }}
      className="rounded-badge p-1.5 text-slate hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      <Trash2 size={16} />
    </button>
  );
}

function CreateDebtForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await createDebt(prev, fd);
    if (!result) onDone();
    return result;
  }, null);
  const [type, setType] = useState<DebtType>("credit_card");

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-ink">Nueva deuda</h2>
        <button onClick={onDone} aria-label="Cerrar" className="text-slate">
          <X size={18} />
        </button>
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" required placeholder="Ej. Tarjeta Santander" />
        </div>

        <div>
          <Label htmlFor="type">Tipo</Label>
          <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value as DebtType)}>
            {DEBT_TYPES.map((t) => (
              <option key={t} value={t}>
                {DEBT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="principal">Saldo actual (MXN)</Label>
            <Input id="principal" name="principal" type="number" step="0.01" min="0" required defaultValue="0" />
          </div>
          <div>
            <Label htmlFor="interest_rate">Tasa de interés anual (%)</Label>
            <Input id="interest_rate" name="interest_rate" type="number" step="0.01" min="0" required defaultValue="0" />
          </div>
          <div>
            <Label htmlFor="minimum_payment">Pago mínimo (MXN)</Label>
            <Input id="minimum_payment" name="minimum_payment" type="number" step="0.01" min="0" required defaultValue="0" />
          </div>
          <div>
            <Label htmlFor="due_day">Día de pago (opcional)</Label>
            <Input id="due_day" name="due_day" type="number" min="1" max="31" />
          </div>
        </div>

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

function EditDebtForm({ debt, onDone }: { debt: Debt; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await updateDebt(debt.id, prev, fd);
    if (!result) onDone();
    return result;
  }, null);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-ink">Editar deuda</h2>
        <button onClick={onDone} aria-label="Cerrar" className="text-slate">
          <X size={18} />
        </button>
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="edit_name">Nombre</Label>
          <Input id="edit_name" name="name" required defaultValue={debt.name} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="edit_interest_rate">Tasa de interés anual (%)</Label>
            <Input
              id="edit_interest_rate"
              name="interest_rate"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={debt.interest_rate}
            />
          </div>
          <div>
            <Label htmlFor="edit_minimum_payment">Pago mínimo (MXN)</Label>
            <Input
              id="edit_minimum_payment"
              name="minimum_payment"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={debt.minimum_payment}
            />
          </div>
          <div>
            <Label htmlFor="edit_due_day">Día de pago (opcional)</Label>
            <Input id="edit_due_day" name="due_day" type="number" min="1" max="31" defaultValue={debt.due_day ?? ""} />
          </div>
        </div>

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

function RegisterPaymentForm({
  debt,
  accounts,
  onDone,
}: {
  debt: Debt;
  accounts: Account[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await createDebtPayment(prev, fd);
    if (!result) onDone();
    return result;
  }, null);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-card bg-cloud p-4">
      <input type="hidden" name="debt_id" value={debt.id} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="pay_account_id">Cuenta de origen</Label>
          <Select id="pay_account_id" name="account_id" required defaultValue={accounts[0]?.id}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="pay_amount">Monto (MXN)</Label>
          <Input
            id="pay_amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            max={debt.current_balance}
            required
            defaultValue={Math.min(debt.minimum_payment, debt.current_balance) || undefined}
          />
        </div>
        <div>
          <Label htmlFor="pay_date">Fecha</Label>
          <Input id="pay_date" name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
        <div>
          <Label htmlFor="pay_note">Nota (opcional)</Label>
          <Input id="pay_note" name="note" maxLength={500} />
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || accounts.length === 0}>
          {pending ? "Registrando..." : "Registrar pago"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
      </div>
      {accounts.length === 0 && <p className="text-xs text-slate">Necesitas al menos una cuenta.</p>}
    </form>
  );
}

function AmortizationSimulator({ debt }: { debt: Debt }) {
  const [monthlyPayment, setMonthlyPayment] = useState(debt.minimum_payment || debt.current_balance / 12 || 100);

  const result = useMemo(
    () =>
      buildAmortizationSchedule({
        balance: debt.current_balance,
        annualRatePct: debt.interest_rate,
        monthlyPayment,
      }),
    [debt.current_balance, debt.interest_rate, monthlyPayment]
  );

  return (
    <div className="rounded-card bg-cloud p-4">
      <div className="mb-3 flex items-end gap-3">
        <div>
          <Label htmlFor={`sim-${debt.id}`}>Pago mensual a simular (MXN)</Label>
          <Input
            id={`sim-${debt.id}`}
            type="number"
            step="0.01"
            min="0"
            value={monthlyPayment}
            onChange={(e) => setMonthlyPayment(Number(e.target.value) || 0)}
          />
        </div>
      </div>

      {result.neverPaysOff ? (
        <p className="text-sm text-red-600">
          Con este pago mensual nunca se termina de pagar la deuda (no cubre el interés generado).
        </p>
      ) : (
        <>
          <p className="mb-2 text-sm text-slate">
            Se saldaría en {result.months} {result.months === 1 ? "mes" : "meses"}.
          </p>
          <div className="max-h-64 overflow-auto rounded-badge border border-mist">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-snow">
                <tr className="text-slate">
                  <th className="px-3 py-2">Mes</th>
                  <th className="px-3 py-2">Pago</th>
                  <th className="px-3 py-2">Interés</th>
                  <th className="px-3 py-2">Capital</th>
                  <th className="px-3 py-2">Saldo restante</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.month} className="border-t border-mist">
                    <td className="px-3 py-1.5">{row.month}</td>
                    <td className="px-3 py-1.5">{formatMXN(row.payment)}</td>
                    <td className="px-3 py-1.5">{formatMXN(row.interest)}</td>
                    <td className="px-3 py-1.5">{formatMXN(row.principal)}</td>
                    <td className="px-3 py-1.5">{formatMXN(row.remainingBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
