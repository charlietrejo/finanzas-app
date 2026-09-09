"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, X, HandCoins, Calculator, CreditCard, ArrowRightLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatMXN } from "@/lib/format";
import { DEBT_TYPE_LABELS, DEBT_TYPES } from "@/lib/constants/debt-types";
import { sortAvalanche, sortSnowball } from "@/lib/debt-strategy";
import { buildAmortizationSchedule } from "@/lib/amortization";
import { buildUnifiedDebts } from "@/lib/unified-debts";
import { createDebt, createDebtPayment, deleteDebt, updateDebt, type ActionState } from "./actions";
import { createTransaction, type ActionState as TransactionActionState } from "../transactions/actions";
import type { Account, Debt, DebtType } from "@/types/database";

type Strategy = "none" | "snowball" | "avalanche";

export function DebtsClient({ debts, accounts }: { debts: Debt[]; accounts: Account[] }) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [payingKey, setPayingKey] = useState<string | null>(null);
  const [simulatingKey, setSimulatingKey] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<Strategy>("none");

  const unified = useMemo(() => buildUnifiedDebts(debts, accounts), [debts, accounts]);

  const ordered = useMemo(() => {
    if (strategy === "snowball") return sortSnowball(unified);
    if (strategy === "avalanche") return sortAvalanche(unified);
    return unified;
  }, [unified, strategy]);

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

      {unified.length > 1 && (
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

      {unified.length === 0 && !creating ? (
        <Card>
          <p className="text-sm text-slate">Aún no tienes deudas ni tarjetas de crédito registradas.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {ordered.map((item, index) =>
            editingId === item.key && item.source === "debt" ? (
              <EditDebtForm key={item.key} debt={item.raw as Debt} onDone={() => setEditingId(null)} />
            ) : (
              <Card key={item.key} className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      {strategy !== "none" && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-periwinkle text-xs font-medium text-monday-violet">
                          {index + 1}
                        </span>
                      )}
                      {item.source === "credit_account" && <CreditCard size={16} className="text-monday-violet" />}
                      <Badge tone={item.source === "credit_account" ? "warning" : "info"}>{item.typeLabel}</Badge>
                    </div>
                    <p className="mt-2 font-medium text-ink">{item.name}</p>
                    <p className="text-xs text-slate">
                      Tasa anual: {item.interest_rate}% · Pago mínimo: {formatMXN(item.minimum_payment)}
                      {item.due_day ? ` · Día de pago: ${item.due_day}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {item.source === "debt" ? (
                      <>
                        <button
                          aria-label="Editar deuda"
                          onClick={() => setEditingId(item.key)}
                          className="rounded-badge p-1.5 text-slate hover:bg-pebble/40"
                        >
                          <Pencil size={16} />
                        </button>
                        <DeleteDebtButton id={(item.raw as Debt).id} name={item.name} />
                      </>
                    ) : (
                      <Link
                        href="/accounts"
                        className="rounded-badge px-2 py-1.5 text-xs font-medium text-monday-violet hover:bg-pebble/40"
                      >
                        Editar en Cuentas
                      </Link>
                    )}
                  </div>
                </div>

                <p className="text-2xl font-light text-ink">{formatMXN(item.current_balance)}</p>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setPayingKey(payingKey === item.key ? null : item.key)}>
                    {item.source === "credit_account" ? (
                      <>
                        <ArrowRightLeft size={16} /> Registrar pago
                      </>
                    ) : (
                      <>
                        <HandCoins size={16} /> Registrar pago
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setSimulatingKey(simulatingKey === item.key ? null : item.key)}
                  >
                    <Calculator size={16} /> Simular amortización
                  </Button>
                </div>

                {payingKey === item.key && item.source === "debt" && (
                  <RegisterPaymentForm debt={item.raw as Debt} accounts={accounts} onDone={() => setPayingKey(null)} />
                )}
                {payingKey === item.key && item.source === "credit_account" && (
                  <RegisterTransferForm
                    creditAccount={item.raw as Account}
                    accounts={accounts}
                    onDone={() => setPayingKey(null)}
                  />
                )}

                {simulatingKey === item.key && (
                  <AmortizationSimulator
                    id={item.key}
                    current_balance={item.current_balance}
                    interest_rate={item.interest_rate}
                    minimum_payment={item.minimum_payment}
                  />
                )}
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
  const [type, setType] = useState<DebtType>(DEBT_TYPES[0]);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-ink">Nueva deuda</h2>
        <button onClick={onDone} aria-label="Cerrar" className="text-slate">
          <X size={18} />
        </button>
      </div>
      <p className="text-xs text-slate">
        Para tarjetas de crédito, crea o usa una cuenta tipo crédito en{" "}
        <Link href="/accounts" className="font-medium text-monday-violet">
          Cuentas
        </Link>
        — aparecerá aquí automáticamente.
      </p>
      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" required placeholder="Ej. Préstamo personal" />
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

function RegisterTransferForm({
  creditAccount,
  accounts,
  onDone,
}: {
  creditAccount: Account;
  accounts: Account[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<TransactionActionState, FormData>(async (prev, fd) => {
    const result = await createTransaction(prev, fd);
    if (!result) onDone();
    return result;
  }, null);

  const sourceAccounts = accounts.filter((a) => a.id !== creditAccount.id);
  const owed = Math.max(0, -creditAccount.current_balance);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-card bg-cloud p-4">
      <input type="hidden" name="type" value="transfer" />
      <input type="hidden" name="to_account_id" value={creditAccount.id} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="transfer_account_id">Cuenta de origen</Label>
          <Select id="transfer_account_id" name="account_id" required defaultValue={sourceAccounts[0]?.id}>
            {sourceAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="transfer_amount">Monto (MXN)</Label>
          <Input
            id="transfer_amount"
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={Math.min(creditAccount.minimum_payment ?? 0, owed) || undefined}
          />
        </div>
        <div>
          <Label htmlFor="transfer_date">Fecha</Label>
          <Input
            id="transfer_date"
            name="date"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </div>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending || sourceAccounts.length === 0}>
          {pending ? "Registrando..." : "Registrar pago"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
      </div>
      {sourceAccounts.length === 0 && <p className="text-xs text-slate">Necesitas otra cuenta desde la cual pagar.</p>}
    </form>
  );
}

function AmortizationSimulator({
  id,
  current_balance,
  interest_rate,
  minimum_payment,
}: {
  id: string;
  current_balance: number;
  interest_rate: number;
  minimum_payment: number;
}) {
  const [monthlyPayment, setMonthlyPayment] = useState(minimum_payment || current_balance / 12 || 100);

  const result = useMemo(
    () => buildAmortizationSchedule({ balance: current_balance, annualRatePct: interest_rate, monthlyPayment }),
    [current_balance, interest_rate, monthlyPayment]
  );

  return (
    <div className="rounded-card bg-cloud p-4">
      <div className="mb-3 flex items-end gap-3">
        <div>
          <Label htmlFor={`sim-${id}`}>Pago mensual a simular (MXN)</Label>
          <Input
            id={`sim-${id}`}
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
