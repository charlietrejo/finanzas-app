"use client";

import { useActionState, useState } from "react";
import { HandCoins } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatMXN, formatDate } from "@/lib/format";
import { createLoanRepayment, type ActionState } from "./actions";
import type { Account } from "@/types/database";
import type { LoanGivenRow } from "./page";

export function LoansClient({ loans, accounts }: { loans: LoanGivenRow[]; accounts: Account[] }) {
  const [payingId, setPayingId] = useState<string | null>(null);

  const activeLoans = loans.filter((l) => l.status === "active");
  const paidLoans = loans.filter((l) => l.status === "paid");
  const totalPending = activeLoans.reduce((sum, l) => sum + l.current_balance, 0);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <h1 className="text-2xl font-light text-ink md:text-3xl">Préstamos</h1>

      {activeLoans.length > 0 && (
        <Card tone="periwinkle">
          <p className="text-sm font-medium text-slate">Total por cobrar</p>
          <p className="mt-2 text-3xl font-light text-ink">{formatMXN(totalPending)}</p>
        </Card>
      )}

      {loans.length === 0 ? (
        <Card>
          <p className="text-sm text-slate">
            Aún no le has prestado dinero a nadie. Para registrar uno, crea un gasto en Movimientos con categoría
            &quot;Préstamo&quot;.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {[...activeLoans, ...paidLoans].map((loan) =>
            payingId === loan.id ? (
              <RepaymentForm key={loan.id} loan={loan} accounts={accounts} onDone={() => setPayingId(null)} />
            ) : (
              <Card key={loan.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <Badge tone={loan.status === "paid" ? "success" : "info"}>
                      {loan.status === "paid" ? "Pagado" : "Activo"}
                    </Badge>
                    <p className="mt-2 font-medium text-ink">{loan.borrower_name}</p>
                    <p className="text-xs text-slate">
                      Prestado el {loan.transaction ? formatDate(loan.transaction.date) : "—"}
                      {loan.transaction ? ` · ${formatMXN(loan.transaction.amount)}` : ""}
                      {loan.expected_return_date
                        ? ` · Devolución esperada: ${formatDate(loan.expected_return_date)}`
                        : " · Sin fecha esperada"}
                    </p>
                  </div>
                </div>

                <p className="text-2xl font-light text-ink">
                  {loan.status === "paid" ? "Cobrado por completo" : `${formatMXN(loan.current_balance)} pendientes`}
                </p>

                {loan.status === "active" && (
                  <div>
                    <Button variant="outline" onClick={() => setPayingId(loan.id)}>
                      <HandCoins size={16} /> Registrar cobro
                    </Button>
                  </div>
                )}
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}

function RepaymentForm({
  loan,
  accounts,
  onDone,
}: {
  loan: LoanGivenRow;
  accounts: Account[];
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await createLoanRepayment(prev, fd);
    if (!result) onDone();
    return result;
  }, null);

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-medium text-ink">Registrar cobro — {loan.borrower_name}</h2>
      <p className="text-sm text-slate">Saldo pendiente: {formatMXN(loan.current_balance)}</p>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="loan_given_id" value={loan.id} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="amount">Monto cobrado (MXN)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={loan.current_balance}
              required
              defaultValue={loan.current_balance}
            />
          </div>
          <div>
            <Label htmlFor="date">Fecha</Label>
            <Input id="date" name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
        </div>

        <div>
          <Label htmlFor="account_id">Depositar a</Label>
          <Select id="account_id" name="account_id" required defaultValue={accounts[0]?.id}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>

        {state?.error && (
          <p role="alert" className="text-sm text-danger-text">
            {state.error}
          </p>
        )}

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
