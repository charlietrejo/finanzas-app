"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Pencil, Trash2, X, Repeat, Ban } from "lucide-react";
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
  createLoanGiven,
  confirmRecurringOccurrence,
  stopRecurringTemplate,
  type ActionState,
} from "./actions";
import type { Account, Category, Debt, Merchant, RecurringFrequency, TransactionType } from "@/types/database";
import type { TransactionRow } from "./page";

interface Props {
  transactions: TransactionRow[];
  recurringTemplates: TransactionRow[];
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

const RECURRING_FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: "Semanal",
  monthly: "Mensual",
  annual: "Anual",
  custom: "Personalizada (cada N días)",
};

export function TransactionsClient({
  transactions,
  recurringTemplates,
  accounts,
  creditCards,
  categories: initialCategories,
  merchants,
}: Props) {
  const [categories, setCategories] = useState(initialCategories);
  const router = useRouter();
  const searchParams = useSearchParams();
  // Sección 3.4.1 del doc ("Ver mis recurrencias de un vistazo"): "Todos"
  // sigue siendo la lista normal (recientes, limitada a 200); "Recurrentes"
  // usa recurringTemplates (todas las plantillas, sin límite ni filtro de
  // fecha) — no es un filtro client-side sobre `transactions`, porque una
  // plantilla vieja podría no estar entre los 200 movimientos más recientes.
  const [filter, setFilter] = useState<"all" | "recurring">("all");
  const visibleTransactions = filter === "recurring" ? recurringTemplates : transactions;
  // Sección 3.6.1 del doc: el botón central "+" del menú inferior enlaza a
  // /transactions?new=1 para abrir el formulario directo, sin pantalla
  // intermedia — inicializador perezoso, no un efecto que llame setState
  // (evita el cascading render que marca react-hooks/set-state-in-effect).
  const [creating, setCreating] = useState(() => searchParams.get("new") === "1");
  const [editingId, setEditingId] = useState<string | null>(null);
  // Secciones 3.2/3.4.1 del doc: el botón "Marcar como pagada" del Dashboard
  // enlaza a /transactions?new=1&templateId=<id> — capturado una sola vez
  // al montar (mismo motivo que `creating`: el efecto de abajo limpia la
  // URL poco después, y no queremos que la plantilla desaparezca a medio
  // formulario cuando searchParams se actualice).
  const [confirmTemplate] = useState<TransactionRow | null>(() => {
    const templateId = searchParams.get("templateId");
    if (!templateId) return null;
    // Busca también en recurringTemplates (no solo en transactions, limitada
    // a los 200 movimientos más recientes): una plantilla vieja podría no
    // estar ahí y sí en la lista completa de recurrentes.
    return transactions.find((t) => t.id === templateId) ?? recurringTemplates.find((t) => t.id === templateId) ?? null;
  });

  // La limpieza de la URL sí es un efecto legítimo (sincroniza con el
  // router, un sistema externo) — no llama setState, así que no dispara esa
  // regla; solo evita que un refresh reabra el formulario solo.
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      router.replace("/transactions");
    }
  }, [searchParams, router]);

  const addCategory = (category: Category) => setCategories((prev) => [...prev, category]);

  if (accounts.length === 0 && creditCards.length === 0) {
    return (
      <div className="flex flex-col gap-6 animate-fade-in">
        <h1 className="text-2xl font-light text-ink md:text-3xl">Movimientos</h1>
        <Card>
          <p className="text-sm text-slate">
            Necesitas al menos una cuenta antes de registrar movimientos. Ve a{" "}
            <Link href="/accounts" className="font-medium text-violet-text">
              Cuentas
            </Link>{" "}
            para crear una.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
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
          confirmTemplate={confirmTemplate ?? undefined}
          onAddCategory={addCategory}
          onDone={() => setCreating(false)}
        />
      )}

      {/* Sección 3.4.1 del doc ("Ver mis recurrencias de un vistazo"):
          responde "¿cuáles son mis gastos domiciliados?" sin tener que
          buscar entre el historial completo. */}
      <div className="flex items-center gap-1">
        {(["all", "recurring"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={
              "min-h-11 rounded-pill px-4 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet " +
              (filter === f ? "bg-monday-violet text-white" : "bg-pebble/40 text-slate hover:bg-pebble/60")
            }
          >
            {f === "all" ? "Todos" : "Recurrentes"}
          </button>
        ))}
      </div>

      {visibleTransactions.length === 0 && !creating ? (
        <Card>
          <p className="text-sm text-slate">
            {filter === "recurring" ? "No tienes plantillas recurrentes." : "Aún no tienes movimientos registrados."}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleTransactions.map((t) =>
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
                    {/* Sección 3.4.1 del doc ("Ver mis recurrencias de un
                        vistazo"): toda plantilla (is_recurring=true) se
                        marca como tal, distinguiendo domiciliada de manual
                        (antes un solo badge genérico "Recurrente"). */}
                    {t.is_recurring && (
                      <Badge tone={t.recurring_is_automatic ? "info" : "warning"} className="gap-1">
                        <Repeat size={12} /> {t.recurring_is_automatic ? "Domiciliado" : "Manual"}
                      </Badge>
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
                      (t.type === "expense"
                        ? "text-danger-text"
                        : t.type === "income"
                          ? "text-success-text"
                          : "text-ink")
                    }
                  >
                    {t.type === "expense" ? "-" : t.type === "income" ? "+" : ""}
                    {formatMXN(t.amount)}
                  </p>
                  <button
                    aria-label="Editar movimiento"
                    onClick={() => setEditingId(t.id)}
                    className="flex h-11 w-11 items-center justify-center rounded-badge text-slate transition-colors hover:bg-pebble/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet"
                  >
                    <Pencil size={16} />
                  </button>
                  {/* Sección 3.4.1 del doc ("Los dos botones de eliminar
                      nunca coexisten en la misma fila"): una plantilla
                      (is_recurring=true) solo ofrece "Eliminar recurrencia"
                      — el genérico revertiría el saldo de su primera
                      ocurrencia de forma incorrecta. Una ocurrencia normal
                      solo ofrece el genérico; el concepto de "recurrencia"
                      no le aplica. */}
                  {t.is_recurring ? (
                    <StopRecurringButton id={t.id} name={t.note || t.category?.name || "esta plantilla"} />
                  ) : (
                    <DeleteTransactionButton id={t.id} />
                  )}
                </div>
              </Card>
            )
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Sección 3.4.1 del doc ("Eliminar una recurrencia"): distinta del trash de
 * abajo (DeleteTransactionButton) — esa borra la FILA (y revierte su efecto
 * de saldo, correcto para un movimiento normal). Una plantilla recurrente ya
 * tuvo un efecto de saldo real desde que se creó (su propio `date`/`amount`
 * es la primera ocurrencia); "eliminar la recurrencia" debe detener SOLO las
 * futuras repeticiones, sin revertir eso ni tocar las ocurrencias ya
 * generadas (filas independientes, is_recurring=false, sin relación por FK
 * con la plantilla) — por eso usa stopRecurringTemplate (solo limpia los
 * campos de recurrencia) en vez de deleteTransaction.
 */
function StopRecurringButton({ id, name }: { id: string; name: string }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      aria-label="Eliminar recurrencia"
      title="Eliminar recurrencia"
      disabled={pending}
      onClick={async () => {
        if (
          !confirm(
            `¿Eliminar la recurrencia de "${name}"? Deja de repetirse hacia adelante; los movimientos ya generados en el pasado no se ven afectados.`
          )
        )
          return;
        setPending(true);
        await stopRecurringTemplate(id);
        setPending(false);
      }}
      className="flex h-11 w-11 items-center justify-center rounded-badge text-slate transition-colors hover:bg-pebble/40 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet"
    >
      <Ban size={16} />
    </button>
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
      className="flex h-11 w-11 items-center justify-center rounded-badge text-slate transition-colors hover:bg-danger/10 hover:text-danger-text disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet"
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
  confirmTemplate,
  onAddCategory,
  onDone,
}: {
  accounts: Account[];
  creditCards: Debt[];
  categories: Category[];
  merchants: Merchant[];
  transaction?: TransactionRow;
  confirmTemplate?: TransactionRow;
  onAddCategory: (c: Category) => void;
  onDone: () => void;
}) {
  const isEdit = !!transaction;
  // Secciones 3.2/3.4.1 del doc: "Marcar como pagada" abre este mismo formulario
  // prellenado (monto, categoría, cuenta) desde la plantilla recurrente
  // manual — crea un movimiento nuevo de una sola ocurrencia, no edita la
  // plantilla, así que solo se usa para los defaults, nunca como `isEdit`.
  const isConfirm = !!confirmTemplate;
  const prefillSource = confirmTemplate ?? transaction;
  const [type, setType] = useState<TransactionType>(prefillSource?.type ?? "expense");
  const payWithOptions = useMemo(() => {
    const accountOpts = accounts.map((a) => ({ value: `account:${a.id}`, label: a.name }));
    if (type !== "expense") return accountOpts;
    const cardOpts = creditCards.map((d) => ({ value: `debt:${d.id}`, label: `${d.name} (tarjeta)` }));
    return [...accountOpts, ...cardOpts];
  }, [accounts, creditCards, type]);
  const defaultPayWith = prefillSource?.debt_id
    ? `debt:${prefillSource.debt_id}`
    : prefillSource?.account_id
      ? `account:${prefillSource.account_id}`
      : payWithOptions[0]?.value;
  const [merchantQuery, setMerchantQuery] = useState(transaction?.merchant?.name ?? "");
  const [merchantId, setMerchantId] = useState<string>(transaction?.merchant_id ?? "");
  const [categoryId, setCategoryId] = useState<string>(prefillSource?.category_id ?? "");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [showMerchantList, setShowMerchantList] = useState(false);
  const [isRecurring, setIsRecurring] = useState((transaction?.is_recurring ?? false) && type !== "transfer");
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>(
    transaction?.recurring_frequency ?? "monthly"
  );
  const [recurringIsAutomatic, setRecurringIsAutomatic] = useState(transaction?.recurring_is_automatic ?? true);

  const filteredMerchants = useMemo(() => {
    if (!merchantQuery.trim()) return merchants.slice(0, 8);
    const q = merchantQuery.toLowerCase();
    return merchants.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 8);
  }, [merchantQuery, merchants]);

  const categoriesForType = useMemo(
    () => categories.filter((c) => c.type === (type === "income" ? "income" : "expense")),
    [categories, type]
  );

  // Sección 3.4.2 del doc: "Préstamo" es una categoría especial — se
  // identifica por nombre (igual que la sugerencia de categoría por
  // comercio, más abajo) porque categories no tiene un flag "especial"
  // propio. Solo aplica al CREAR (no al editar un movimiento ya existente,
  // ni al confirmar una ocurrencia recurrente: ninguna plantilla recurrente
  // usa la categoría "Préstamo", sección 3.4.2).
  const isNewLoan =
    !isEdit && !isConfirm && type === "expense" && categories.find((c) => c.id === categoryId)?.name === "Préstamo";

  const action = isConfirm
    ? (confirmRecurringOccurrence as (id: string, prev: ActionState, fd: FormData) => Promise<ActionState>).bind(
        null,
        confirmTemplate!.id
      )
    : isEdit
      ? (updateTransaction as (id: string, prev: ActionState, fd: FormData) => Promise<ActionState>).bind(
          null,
          transaction!.id
        )
      : isNewLoan
        ? createLoanGiven
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
        <h2 className="font-medium text-ink">
          {isConfirm
            ? `Marcar como pagada: ${confirmTemplate!.note || confirmTemplate!.category?.name || "movimiento recurrente"}`
            : isEdit
              ? "Editar movimiento"
              : "Nuevo movimiento"}
        </h2>
        <button onClick={onDone} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center rounded-badge text-slate transition-colors hover:bg-pebble/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet">
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
            onChange={(e) => {
              const nextType = e.target.value as TransactionType;
              setType(nextType);
              if (nextType === "transfer") setIsRecurring(false);
            }}
          >
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
            <option value="transfer">Transferencia</option>
          </Select>
        </div>

        {/* Secciones 3.2/3.4.1 del doc: "Marcar como pagada" crea un movimiento
            de una sola ocurrencia — nunca se vuelve a preguntar si es
            recurrente (la plantilla ya existe y sigue siendo la que manda). */}
        {type !== "transfer" && !isConfirm && (
          <div className="flex flex-col gap-3 rounded-card bg-cloud p-4">
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
                ¿Es recurrente?
              </Label>
            </div>

            {isRecurring && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="recurring_frequency">Frecuencia</Label>
                  <Select
                    id="recurring_frequency"
                    name="recurring_frequency"
                    value={recurringFrequency}
                    onChange={(e) => setRecurringFrequency(e.target.value as RecurringFrequency)}
                  >
                    {(Object.keys(RECURRING_FREQUENCY_LABELS) as RecurringFrequency[]).map((f) => (
                      <option key={f} value={f}>
                        {RECURRING_FREQUENCY_LABELS[f]}
                      </option>
                    ))}
                  </Select>
                </div>

                {recurringFrequency === "custom" && (
                  <div>
                    <Label htmlFor="recurring_interval_days">Cada cuántos días</Label>
                    <Input
                      id="recurring_interval_days"
                      name="recurring_interval_days"
                      type="number"
                      min="1"
                      step="1"
                      required
                      defaultValue={transaction?.recurring_interval_days ?? undefined}
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="recurring_end_date">Fecha de fin (opcional)</Label>
                  <Input
                    id="recurring_end_date"
                    name="recurring_end_date"
                    type="date"
                    defaultValue={transaction?.recurring_end_date ?? ""}
                  />
                </div>

                <div>
                  <Label htmlFor="recurring_is_automatic">¿Se cobra solo o lo registras tú?</Label>
                  <Select
                    id="recurring_is_automatic"
                    name="recurring_is_automatic"
                    value={recurringIsAutomatic ? "true" : "false"}
                    onChange={(e) => setRecurringIsAutomatic(e.target.value === "true")}
                  >
                    <option value="true">Domiciliado / automático</option>
                    <option value="false">Manual (yo lo registro)</option>
                  </Select>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="pay_with">
              {type === "transfer" ? "Cuenta origen" : type === "expense" ? "Pagar con" : "Cuenta destino"}
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
              defaultValue={prefillSource?.amount}
            />
          </div>

          <div>
            <Label htmlFor="date">Fecha</Label>
            {/* Sección 3.4.1 del doc: "Marcar como pagada" confirma la
                ocurrencia fechada en la next_occurrence_date que le
                correspondía, NUNCA en la fecha real de hoy en que el
                usuario confirma — por eso va fija (disabled, no editable)
                solo en este modo, con un input oculto que sí se envía
                (uno disabled no viaja en el FormData). */}
            <Input
              id="date"
              type="date"
              required={!isConfirm}
              disabled={isConfirm}
              name={isConfirm ? undefined : "date"}
              defaultValue={isConfirm ? confirmTemplate!.next_occurrence_date ?? undefined : transaction?.date ?? new Date().toISOString().slice(0, 10)}
            />
            {isConfirm && <input type="hidden" name="date" value={confirmTemplate!.next_occurrence_date ?? ""} />}
          </div>
        </div>

        {type !== "transfer" && (
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
        )}

        {isNewLoan && (
          <div className="grid grid-cols-1 gap-4 rounded-card bg-cloud p-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="borrower_name">¿A quién le prestas?</Label>
              <Input id="borrower_name" name="borrower_name" required maxLength={120} placeholder="Nombre" />
            </div>
            <div>
              <Label htmlFor="expected_return_date">Fecha esperada de devolución (opcional)</Label>
              <Input id="expected_return_date" name="expected_return_date" type="date" />
            </div>
          </div>
        )}

        {type === "expense" && (
          <>
            <div className="relative">
              <Label htmlFor="merchant_search">Comercio (opcional)</Label>
              <Input
                id="merchant_search"
                value={merchantQuery}
                autoComplete="off"
                role="combobox"
                aria-expanded={showMerchantList && filteredMerchants.length > 0}
                aria-controls="merchant-suggestions"
                onFocus={() => setShowMerchantList(true)}
                onChange={(e) => {
                  setMerchantQuery(e.target.value);
                  setMerchantId("");
                  setShowMerchantList(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setShowMerchantList(false);
                }}
                placeholder="Ej. Walmart, Netflix..."
              />
              <input type="hidden" name="merchant_id" value={merchantId} />
              {showMerchantList && filteredMerchants.length > 0 && (
                <ul
                  id="merchant-suggestions"
                  aria-label="Sugerencias de comercio"
                  className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-badge border border-mist bg-snow shadow-[var(--shadow-card)]"
                >
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
                <button type="button" onClick={acceptSuggestion} className="font-medium text-violet-text">
                  Usar
                </button>
              </div>
            )}

            <div>
              <Label htmlFor="tags">Etiquetas (separadas por coma)</Label>
              <Input id="tags" name="tags" defaultValue={transaction?.tags.join(", ")} placeholder="viaje, trabajo" />
            </div>
          </>
        )}

        <div>
          <Label htmlFor="note">Nota</Label>
          <Input id="note" name="note" defaultValue={transaction?.note ?? ""} maxLength={500} />
        </div>

        {state?.error && <p role="alert" className="text-sm text-danger-text">{state.error}</p>}

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
