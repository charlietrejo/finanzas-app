"use client";

import { useActionState, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatMXN } from "@/lib/format";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES } from "@/lib/constants/account-types";
import { MEXICAN_BANKS } from "@/lib/constants/banks";
import { createAccount, deleteAccount, updateAccount, type ActionState } from "./actions";
import type { Account, AccountType } from "@/types/database";

export function AccountsClient({ accounts }: { accounts: Account[] }) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light text-ink md:text-3xl">Cuentas</h1>
        {!creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={18} /> Nueva cuenta
          </Button>
        )}
      </div>

      {creating && <CreateAccountForm onDone={() => setCreating(false)} />}

      {accounts.length === 0 && !creating ? (
        <Card>
          <p className="text-sm text-slate">Aún no tienes cuentas registradas.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) =>
            editingId === account.id ? (
              <EditAccountForm
                key={account.id}
                account={account}
                onDone={() => setEditingId(null)}
              />
            ) : (
              <Card key={account.id} className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <Badge tone="info">{ACCOUNT_TYPE_LABELS[account.type]}</Badge>
                    <p className="mt-2 font-medium text-ink">{account.name}</p>
                    {account.bank_name && (
                      <p className="text-xs text-slate">{account.bank_name}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      aria-label="Editar cuenta"
                      onClick={() => setEditingId(account.id)}
                      className="rounded-badge p-1.5 text-slate hover:bg-pebble/40"
                    >
                      <Pencil size={16} />
                    </button>
                    <DeleteAccountButton id={account.id} name={account.name} />
                  </div>
                </div>
                <p className="text-2xl font-light text-ink">
                  {formatMXN(account.current_balance)}
                </p>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}

function CreateAccountForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await createAccount(prev, formData);
      if (!result) onDone();
      return result;
    },
    null
  );
  const [type, setType] = useState<AccountType>("debit");

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-ink">Nueva cuenta</h2>
        <button onClick={onDone} aria-label="Cerrar" className="text-slate">
          <X size={18} />
        </button>
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" required placeholder="Ej. Nómina BBVA" />
        </div>

        <div>
          <Label htmlFor="type">Tipo</Label>
          <Select
            id="type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as AccountType)}
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {ACCOUNT_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="bank_name">Banco (opcional)</Label>
          <Select id="bank_name" name="bank_name" defaultValue="">
            <option value="">Sin banco / efectivo</option>
            {MEXICAN_BANKS.map((bank) => (
              <option key={bank.name} value={bank.name}>
                {bank.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <Label htmlFor="initial_balance">Saldo inicial (MXN)</Label>
          <Input
            id="initial_balance"
            name="initial_balance"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue="0"
          />
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

function EditAccountForm({ account, onDone }: { account: Account; onDone: () => void }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (prev, formData) => {
      const result = await updateAccount(account.id, prev, formData);
      if (!result) onDone();
      return result;
    },
    null
  );

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-ink">Editar cuenta</h2>
        <button onClick={onDone} aria-label="Cerrar" className="text-slate">
          <X size={18} />
        </button>
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="edit_name">Nombre</Label>
          <Input id="edit_name" name="name" required defaultValue={account.name} />
        </div>

        <div>
          <Label htmlFor="edit_bank_name">Banco</Label>
          <Select id="edit_bank_name" name="bank_name" defaultValue={account.bank_name ?? ""}>
            <option value="">Sin banco / efectivo</option>
            {MEXICAN_BANKS.map((bank) => (
              <option key={bank.name} value={bank.name}>
                {bank.name}
              </option>
            ))}
          </Select>
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

function DeleteAccountButton({ id, name }: { id: string; name: string }) {
  const [pending, setPending] = useState(false);

  return (
    <button
      aria-label="Eliminar cuenta"
      disabled={pending}
      onClick={async () => {
        if (
          !confirm(
            `¿Eliminar la cuenta "${name}"? Esto también eliminará sus movimientos. Esta acción no se puede deshacer.`
          )
        )
          return;
        setPending(true);
        await deleteAccount(id);
        setPending(false);
      }}
      className="rounded-badge p-1.5 text-slate hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      <Trash2 size={16} />
    </button>
  );
}
