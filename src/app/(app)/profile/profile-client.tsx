"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { blobatar } from "blobatar";
import { Pencil, Trash2, X, Plus, Download, Check, ArrowLeftRight, PiggyBank, Target, HandCoins } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { signOut } from "@/app/(auth)/actions";
import { buildCsv, downloadCsv } from "@/lib/csv-export";
import {
  updateDisplayName,
  changePassword,
  createCategory,
  updateCategory,
  deleteCategory,
  exportTransactions,
} from "./actions";
import type { ActionState } from "./actions";
import type { Category } from "@/types/database";
import type { ExportTransactionRow } from "./page";

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ProfileClient({
  userId,
  email,
  fullName,
  initialTheme,
  categories,
  transactionCount,
  appVersion,
}: {
  userId: string;
  email: string;
  fullName: string;
  initialTheme: "light" | "dark";
  categories: Category[];
  transactionCount: number;
  appVersion: string;
}) {
  // user.id (no email): estable aunque el usuario cambie su correo desde
  // Seguridad (sección 3.7) — mismo criterio que el avatar del sidebar (layout.tsx).
  const avatarSvg = blobatar(userId, { size: 72, background: "circle" });

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <h1 className="text-2xl font-light text-ink md:text-3xl">Cuenta</h1>

      <ShortcutsSection />

      <ProfileHeader email={email} fullName={fullName} avatarSvg={avatarSvg} />

      <Card className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-medium text-ink">Apariencia</h2>
          <p className="text-sm text-slate">Modo oscuro</p>
        </div>
        <ThemeToggle initialTheme={initialTheme} />
      </Card>

      <CategoriesSection categories={categories} />

      <DataSection transactionCount={transactionCount} />

      <SecuritySection />

      <Card className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-medium text-ink">Sesión</h2>
          <p className="text-sm text-slate">{email}</p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            Cerrar sesión
          </Button>
        </form>
      </Card>

      <p className="text-center text-xs text-slate">Finanzas v{appVersion}</p>
    </div>
  );
}

const SHORTCUTS = [
  { href: "/transactions", label: "Movimientos", icon: ArrowLeftRight },
  { href: "/budgets", label: "Presupuestos", icon: PiggyBank },
  { href: "/goals", label: "Metas", icon: Target },
  { href: "/loans", label: "Préstamos", icon: HandCoins },
];

/**
 * Sección 3.6.1/3.7 del doc: desde que estas pantallas perdieron su ícono
 * propio en el menú inferior, quedan a 2 toques (avatar → acceso) en vez de
 * perdidas — por eso van al inicio, antes de las secciones de perfil.
 */
function ShortcutsSection() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {SHORTCUTS.map(({ href, label, icon: Icon }) => (
        <Card key={href}>
          <Link
            href={href}
            className="flex flex-col items-center gap-2 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-periwinkle text-violet-text">
              <Icon size={20} />
            </span>
            <span className="text-xs font-medium text-ink">{label}</span>
          </Link>
        </Card>
      ))}
    </div>
  );
}

function ProfileHeader({ email, fullName, avatarSvg }: { email: string; fullName: string; avatarSvg: string }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await updateDisplayName(prev, fd);
    if (!result?.error) setEditing(false);
    return result;
  }, null);

  return (
    <Card className="flex items-center gap-4">
      <div
        className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full"
        // blobatar() devuelve un <svg>...</svg> ya armado (paquete
        // determinístico a partir del email/nombre — mismo avatar siempre
        // para el mismo usuario, sin necesidad de subir foto).
        dangerouslySetInnerHTML={{ __html: avatarSvg }}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        {editing ? (
          <form action={formAction} className="flex items-center gap-2">
            <Input
              name="full_name"
              defaultValue={fullName}
              placeholder="Tu nombre"
              maxLength={80}
              autoFocus
              className="max-w-xs"
            />
            <Button type="submit" disabled={pending} aria-label="Guardar nombre">
              <Check size={16} />
            </Button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              aria-label="Cancelar"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-badge text-slate transition-colors hover:bg-pebble/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet"
            >
              <X size={18} />
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-ink">{fullName || "Sin nombre para mostrar"}</p>
            <button
              onClick={() => setEditing(true)}
              aria-label="Editar nombre"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-badge text-slate transition-colors hover:bg-pebble/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet"
            >
              <Pencil size={15} />
            </button>
          </div>
        )}
        <p className="truncate text-sm text-slate">{email}</p>
        {state?.error && (
          <p role="alert" className="mt-1 text-sm text-danger-text">
            {state.error}
          </p>
        )}
      </div>
    </Card>
  );
}

function CategoriesSection({ categories: initialCategories }: { categories: Category[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleDelete(id: string, name: string) {
    if (
      !confirm(
        `¿Eliminar la categoría "${name}"? Los presupuestos que la usen también se eliminarán; los movimientos que la usaban quedarán sin categoría. Esta acción no se puede deshacer.`
      )
    )
      return;
    const result = await deleteCategory(id);
    if (!result?.error) setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-ink">Categorías</h2>
        {!creating && (
          <Button variant="outline" onClick={() => setCreating(true)}>
            <Plus size={16} /> Nueva
          </Button>
        )}
      </div>

      {creating && (
        <NewCategoryForm
          onDone={() => setCreating(false)}
          onCreated={(c) => setCategories((prev) => [...prev, c])}
        />
      )}

      {categories.length === 0 && !creating ? (
        <p className="text-sm text-slate">Aún no tienes categorías.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {categories.map((c) =>
            editingId === c.id ? (
              <EditCategoryRow
                key={c.id}
                category={c}
                onDone={() => setEditingId(null)}
                onSaved={(name, isEssential) =>
                  setCategories((prev) =>
                    prev.map((x) => (x.id === c.id ? { ...x, name, is_essential: isEssential } : x))
                  )
                }
              />
            ) : (
              <li key={c.id} className="flex items-center justify-between gap-2 rounded-badge px-2 py-1.5">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge tone={c.type === "income" ? "success" : "warning"}>
                    {c.type === "income" ? "Ingreso" : "Gasto"}
                  </Badge>
                  {c.type === "expense" && c.is_essential && <Badge tone="info">Esencial</Badge>}
                  <span className="truncate text-sm text-ink">{c.name}</span>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    aria-label="Editar categoría"
                    onClick={() => setEditingId(c.id)}
                    className="flex h-11 w-11 items-center justify-center rounded-badge text-slate transition-colors hover:bg-pebble/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    aria-label="Eliminar categoría"
                    onClick={() => handleDelete(c.id, c.name)}
                    className="flex h-11 w-11 items-center justify-center rounded-badge text-slate transition-colors hover:bg-danger/10 hover:text-danger-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            )
          )}
        </ul>
      )}
    </Card>
  );
}

function NewCategoryForm({
  onDone,
  onCreated,
}: {
  onDone: () => void;
  onCreated: (c: Category) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setPending(true);
    setError(null);
    const result = await createCategory(trimmed, type);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    if (result?.data) {
      onCreated(result.data as Category);
      onDone();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-card bg-cloud p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <Label htmlFor="new_category_name">Nombre</Label>
          <Input
            id="new_category_name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Viajes"
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor="new_category_type">Tipo</Label>
          <Select id="new_category_type" value={type} onChange={(e) => setType(e.target.value as "income" | "expense")}>
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </Select>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger-text">
          {error}
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
  );
}

function EditCategoryRow({
  category,
  onDone,
  onSaved,
}: {
  category: Category;
  onDone: () => void;
  onSaved: (name: string, isEssential: boolean) => void;
}) {
  const [isEssential, setIsEssential] = useState(category.is_essential);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const result = await updateCategory(prev, fd);
    if (!result?.error) {
      onSaved(String(fd.get("name") ?? "").trim(), fd.get("is_essential") === "on");
      onDone();
    }
    return result;
  }, null);

  return (
    <li className="rounded-badge bg-cloud px-2 py-2">
      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={category.id} />
        <div className="flex items-center gap-2">
          <Badge tone={category.type === "income" ? "success" : "warning"}>
            {category.type === "income" ? "Ingreso" : "Gasto"}
          </Badge>
          <Input name="name" defaultValue={category.name} autoFocus className="flex-1" />
          <Button type="submit" disabled={pending} aria-label="Guardar categoría">
            <Check size={16} />
          </Button>
          <button
            type="button"
            onClick={onDone}
            aria-label="Cancelar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-badge text-slate transition-colors hover:bg-pebble/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet"
          >
            <X size={18} />
          </button>
        </div>

        {/* Secciones 3.6/3.7/3.8: is_essential solo aplica a gasto — Reportes
            filtra "Gastos esenciales del mes" por esto, no tiene sentido en
            categorías de ingreso. */}
        {category.type === "expense" && (
          <div className="flex items-center gap-2 pl-1">
            <input
              id={`is_essential_${category.id}`}
              name="is_essential"
              type="checkbox"
              checked={isEssential}
              onChange={(e) => setIsEssential(e.target.checked)}
              className="h-4 w-4 rounded border-mist text-monday-violet focus:ring-monday-violet"
            />
            <Label htmlFor={`is_essential_${category.id}`} className="mb-0">
              Categoría esencial (renta, servicios, salud, etc.)
            </Label>
          </div>
        )}
      </form>
      {state?.error && (
        <p role="alert" className="mt-1 text-sm text-danger-text">
          {state.error}
        </p>
      )}
    </li>
  );
}

// Sección 3.7 del doc: el historial completo (con sus 5 joins) solo se trae
// al hacer clic en un botón de exportar (exportTransactions, actions.ts),
// no en cada visita a Cuenta — page.tsx solo pasa el conteo para el texto.
function DataSection({ transactionCount }: { transactionCount: number }) {
  const [pending, setPending] = useState<"csv" | "json" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function buildRows(transactions: ExportTransactionRow[]) {
    return transactions.map((t) => [
      t.date,
      t.type,
      t.amount,
      t.account?.name ?? t.debt?.name ?? "",
      t.to_account?.name ?? "",
      t.category?.name ?? "",
      t.merchant?.name ?? "",
      t.tags.join(" "),
      t.note ?? "",
    ]);
  }

  async function handleExport(format: "csv" | "json") {
    setPending(format);
    setError(null);
    try {
      const transactions = await exportTransactions();
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === "csv") {
        const csv = buildCsv(
          ["Fecha", "Tipo", "Monto", "Cuenta/Tarjeta", "Cuenta destino", "Categoría", "Comercio", "Etiquetas", "Nota"],
          buildRows(transactions)
        );
        downloadCsv(`movimientos-northstar-${stamp}.csv`, csv);
      } else {
        downloadJson(`movimientos-northstar-${stamp}.json`, transactions);
      }
    } catch {
      setError("No se pudo exportar. Intenta de nuevo.");
    } finally {
      setPending(null);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="font-medium text-ink">Datos</h2>
        <p className="text-sm text-slate">
          Respaldo manual de tus {transactionCount} movimiento{transactionCount === 1 ? "" : "s"}.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => handleExport("csv")} disabled={transactionCount === 0 || pending !== null}>
          <Download size={16} /> {pending === "csv" ? "Exportando..." : "Exportar CSV"}
        </Button>
        <Button variant="outline" onClick={() => handleExport("json")} disabled={transactionCount === 0 || pending !== null}>
          <Download size={16} /> {pending === "json" ? "Exportando..." : "Exportar JSON"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger-text">
          {error}
        </p>
      )}
    </Card>
  );
}

function SecuritySection() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(changePassword, null);

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="font-medium text-ink">Seguridad</h2>
      <form action={formAction} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="password">Nueva contraseña</Label>
            <Input id="password" name="password" type="password" required autoComplete="new-password" />
          </div>
          <div>
            <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" />
          </div>
        </div>
        {state?.error && (
          <p role="alert" className="text-sm text-danger-text">
            {state.error}
          </p>
        )}
        {state?.success && (
          <p role="status" className="text-sm text-success-text">
            {state.success}
          </p>
        )}
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : "Cambiar contraseña"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
