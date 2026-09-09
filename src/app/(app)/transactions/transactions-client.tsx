"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, X, Repeat } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatMXN, formatDate } from "@/lib/format";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
  createCategory,
  type ActionState,
} from "./actions";
import type { Account, Category, Debt, Merchant, TransactionType } from "@/types/database";
import type { TransactionRow } from "./page";

interface Props {
  transactions: TransactionRow[];
  accounts: Account[];
  creditCards: Debt[];
  categories: Category[];
  merchants: Merchant[];
}

const TYPE_LABELS: Record<TransactionType, string> = {
  income: "Ingreso",
  expense: "Gasto",
  transfer: "Transferencia",
};

const TYPE_BADGE_TONE: Record<TransactionType, "success" | "danger" | "info"> = {
  income: "success",
  expense: "danger",
  transfer: "info",
};

export function TransactionsClient({ transactions, accounts, creditCards, categories: initialCategories, merchants }: Props) {
  const [categories, setCategories] = useState(initialCategories);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const addCategory = (category: Category) => setCategories((prev) => [...prev, category]);

  if (accounts.length === 0 && creditCards.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-light text-ink md:text-3xl">Movimientos</h1>
        <Card>
          <p className="text-sm text-slate">
            Necesitas al menos una cuenta antes de registrar movimientos. Ve a{" "}
            <a href="/accounts" className="font-medium text-monday-violet">
              Cuentas
            </a>{" "}
            para crear una.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light text-ink md:text-3xl">Movimientos</h1>
        {!creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={18} /> Nuevo movimiento
          </Button>
        )}
      </div>

      {creating && (
        <TransactionForm
          accounts={accounts}
          creditCards={creditCards}
          categories={categories}
          merchants={merchants}
          onAddCategory={addCategory}
          onDone={() => setCreating(false)}
        />
      )}

      {transactions.length === 0 && !creating ? (
        <Card>
          <p className="text-sm text-slate">Aún no tienes movimientos registrados.</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {transactions.map((t) =>
            editingId === t.id ? (
              <TransactionForm
                key={t.id}
                accounts={accounts}
                creditCards={creditCards}
                categories={categories}
                merchants={merchants}
                transaction={t}
                onAddCategory={addCategory}
                onDone={() => setEditingId(null)}
              />
            ) : (
              <Card key={t.id} className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={TYPE_BADGE_TONE[t.type]}>{TYPE_LABELS[t.type]}</Badge>
                    {t.is_recurring && (
                      <span className="text-slate" title="Recurrente">
                        <Repeat size={14} />
                      </span>
                    )}
                    <span className="text-xs text-slate">{formatDate(t.date)}</span>
                  </div>
                  <p className="truncate font-medium text-ink">
                    {t.merchant?.name ?? t.category?.name ?? TYPE_LABELS[t.type]}
                  </p>
                  <p className="truncate text-xs text-slate">
                    {t.account?.name ?? (t.debt ? `${t.debt.name} (tarjeta)` : "")}
                    {t.type === "transfer" && t.to_account ? ` → ${t.to_account.name}` : ""}
                    {t.category?.name && t.merchant?.name ? ` · ${t.category.name}` : ""}
                    {t.note ? ` · ${t.note}` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <p
                    className={
                      "text-lg font-light " +
                      (t.type === "expense" ? "text-red-600" : t.type === "income" ? "text-emerald-700" : "text-ink")
                    }
                  >
                    {t.type === "expense" ? "-" : t.type === "income" ? "+" : ""}
                    {formatMXN(t.amount)}
                  </p>
                  <button
                    aria-label="Editar movimiento"
                    onClick={() => setEditingId(t.id)}
                    className="rounded-badge p-1.5 text-slate hover:bg-pebble/40"
                  >
                    <Pencil size={16} />
                  </button>
                  <DeleteTransactionButton id={t.id} />
                </div>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}

function DeleteTransactionButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      aria-label="Eliminar movimiento"
      disabled={pending}
      onClick={async () => {
        if (!confirm("¿Eliminar este movimiento? El saldo de la cuenta se ajustará.")) return;
        setPending(true);
        await deleteTransaction(id);
        setPending(false);
      }}
      className="rounded-badge p-1.5 text-slate hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      <Trash2 size={16} />
    </button>
  );
}

function TransactionForm({
  accounts,
  creditCards,
  categories,
  merchants,
  transaction,
  onAddCategory,
  onDone,
}: {
  accounts: Account[];
  creditCards: Debt[];
  categories: Category[];
  merchants: Merchant[];
  transaction?: TransactionRow;
  onAddCategory: (c: Category) => void;
  onDone: () => void;
}) {
  const isEdit = !!transaction;
  const [type, setType] = useState<TransactionType>(transaction?.type ?? "expense");
  const payWithOptions = useMemo(() => {
    const accountOpts = accounts.map((a) => ({ value: `account:${a.id}`, label: a.name }));
    if (type !== "expense") return accountOpts;
    const cardOpts = creditCards.map((d) => ({ value: `debt:${d.id}`, label: `${d.name} (tarjeta)` }));
    return [...accountOpts, ...cardOpts];
  }, [accounts, creditCards, type]);
  const defaultPayWith = transaction?.debt_id
    ? `debt:${transaction.debt_id}`
    : transaction?.account_id
      ? `account:${transaction.account_id}`
      : payWithOptions[0]?.value;
  const [merchantQuery, setMerchantQuery] = useState(transaction?.merchant?.name ?? "");
  const [merchantId, setMerchantId] = useState<string>(transaction?.merchant_id ?? "");
  const [categoryId, setCategoryId] = useState<string>(transaction?.category_id ?? "");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [showMerchantList, setShowMerchantList] = useState(false);
  const [isRecurring, setIsRecurring] = useState(transaction?.is_recurring ?? false);

  const filteredMerchants = useMemo(() => {
    if (!merchantQuery.trim()) return merchants.slice(0, 8);
    const q = merchantQuery.toLowerCase();
    return merchants.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 8);
  }, [merchantQuery, merchants]);

  const categoriesForType = useMemo(
    () => categories.filter((c) => c.type === (type === "income" ? "income" : "expense")),
    [categories, type]
  );

  const action = isEdit
    ? (updateTransaction as (id: string, prev: ActionState, fd: FormData) => Promise<ActionState>).bind(
        null,
        transaction!.id
      )
    : createTransaction;

  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await action(prev, fd);
    if (!result) onDone();
    return result;
  }, null);

  function selectMerchant(m: Merchant) {
    setMerchantQuery(m.name);
    setMerchantId(m.id);
    setShowMerchantList(false);

    if (m.default_category_name) {
      const match = categories.find(
        (c) => c.name.toLowerCase() === m.default_category_name!.toLowerCase() && c.type === (type === "income" ? "income" : "expense")
      );
      if (match) {
        setCategoryId(match.id);
        setSuggestion(null);
      } else {
        setSuggestion(m.default_category_name);
      }
    }
  }

  async function acceptSuggestion() {
    if (!suggestion) return;
    const result = await createCategory(suggestion, type === "income" ? "income" : "expense");
    if (result.data) {
      onAddCategory(result.data as Category);
      setCategoryId((result.data as Category).id);
    }
    setSuggestion(null);
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-ink">{isEdit ? "Editar movimiento" : "Nuevo movimiento"}</h2>
        <button onClick={onDone} aria-label="Cerrar" className="text-slate">
          <X size={18} />
        </button>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="type">Tipo</Label>
          <Select
            id="type"
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as TransactionType)}
          >
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
            <option value="transfer">Transferencia</option>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="pay_with">
              {type === "transfer" ? "Cuenta origen" : type === "expense" ? "Pagar con" : "Cuenta"}
            </Label>
            <Select id="pay_with" name="pay_with" required defaultValue={defaultPayWith}>
              {payWithOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>

          {type === "transfer" && (
            <div>
              <Label htmlFor="to_account_id">Cuenta destino</Label>
              <Select id="to_account_id" name="to_account_id" required defaultValue={transaction?.to_account_id ?? ""}>
                <option value="" disabled>
                  Selecciona...
                </option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="amount">Monto (MXN)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              defaultValue={transaction?.amount}
            />
          </div>

          <div>
            <Label htmlFor="date">Fecha</Label>
            <Input
              id="date"
              name="date"
              type="date"
              required
              defaultValue={transaction?.date ?? new Date().toISOString().slice(0, 10)}
            />
          </div>
        </div>

        {type !== "transfer" && (
          <>
            <div className="relative">
              <Label htmlFor="merchant_search">Comercio (opcional)</Label>
              <Input
                id="merchant_search"
                value={merchantQuery}
                autoComplete="off"
                onFocus={() => setShowMerchantList(true)}
                onChange={(e) => {
                  setMerchantQuery(e.target.value);
                  setMerchantId("");
                  setShowMerchantList(true);
                }}
                placeholder="Ej. Walmart, Netflix..."
              />
              <input type="hidden" name="merchant_id" value={merchantId} />
              {showMerchantList && filteredMerchants.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-badge border border-mist bg-snow shadow-[var(--shadow-card)]">
                  {filteredMerchants.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => selectMerchant(m)}
                        className="block w-full px-4 py-2 text-left text-sm text-ink hover:bg-periwinkle/50"
                      >
                        {m.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {suggestion && (
              <div className="flex items-center justify-between rounded-badge bg-lavender px-4 py-2 text-sm text-ink">
                <span>Categoría sugerida: {suggestion}</span>
                <button type="button" onClick={acceptSuggestion} className="font-medium text-monday-violet">
                  Usar
                </button>
              </div>
            )}

            <div>
              <Label htmlFor="category_id">Categoría</Label>
              <Select
                id="category_id"
                name="category_id"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Sin categoría</option>
                {categoriesForType.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </>
        )}

        <div>
          <Label htmlFor="tags">Etiquetas (separadas por coma)</Label>
          <Input id="tags" name="tags" defaultValue={transaction?.tags.join(", ")} placeholder="viaje, trabajo" />
        </div>

        <div>
          <Label htmlFor="note">Nota</Label>
          <Input id="note" name="note" defaultValue={transaction?.note ?? ""} maxLength={500} />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="is_recurring"
            name="is_recurring"
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            className="h-4 w-4 rounded border-mist text-monday-violet focus:ring-monday-violet"
          />
          <Label htmlFor="is_recurring" className="mb-0">
            Es recurrente
          </Label>
        </div>

        {isRecurring && (
          <div>
            <Label htmlFor="recurring_frequency">Frecuencia</Label>
            <Select
              id="recurring_frequency"
              name="recurring_frequency"
              defaultValue={transaction?.is_recurring ? undefined : "monthly"}
            >
              <option value="monthly">Mensual</option>
              <option value="weekly">Semanal</option>
              <option value="daily">Diaria</option>
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
