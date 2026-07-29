"use client";

import { useEffect, useState } from "react";
import { Pencil, PlusCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createCategory, deleteCategory, listCategories, updateCategory } from "@/services/finance";
import type { Category, CategoryType } from "@/types";

const categoryTypes: CategoryType[] = ["INCOME", "EXPENSE"];

const emptyForm = {
  name: "",
  type: "EXPENSE" as CategoryType,
  parentId: "",
  icon: "tag",
  color: "#64748b",
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadCategories = async () => {
    setLoading(true);
    try {
      setCategories(await listCategories());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las categorías.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadCategories();
    });
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        parentId: form.parentId || null,
        icon: form.icon,
        color: form.color,
      };

      if (!payload.name) {
        throw new Error("El nombre de la categoría es obligatorio.");
      }

      if (editingId) {
        await updateCategory(editingId, payload);
      } else {
        await createCategory(payload);
      }

      setForm(emptyForm);
      setEditingId(null);
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la categoría.");
    }
  };

  const handleEdit = (category: Category) => {
    setEditingId(category.id);
    setForm({
      name: category.name,
      type: category.type,
      parentId: category.parent_id ?? "",
      icon: category.icon ?? "tag",
      color: category.color ?? "#64748b",
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCategory(id);
      await loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la categoría.");
    }
  };

  return (
    <div className="space-y-6 p-2 sm:p-4">
      <div>
        <p className="text-sm font-medium text-slate-500">Categorías</p>
        <h1 className="text-2xl font-semibold text-slate-900">Jerarquías y personalización</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Editar categoría" : "Nueva categoría"}</CardTitle>
          <CardDescription>Agrega subcategorías, iconos y colores para tus ingresos y gastos.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleSubmit}>
            <input
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              placeholder="Nombre de la categoría"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as CategoryType }))}
            >
              {categoryTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <select
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
              value={form.parentId}
              onChange={(event) => setForm((current) => ({ ...current, parentId: event.target.value }))}
            >
              <option value="">Sin categoría padre</option>
              {categories
                .filter((category) => category.id !== editingId)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                placeholder="Icono"
                value={form.icon}
                onChange={(event) => setForm((current) => ({ ...current, icon: event.target.value }))}
              />
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none"
                placeholder="Color"
                value={form.color}
                onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
              />
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit">
                <PlusCircle className="h-4 w-4" />
                {editingId ? "Guardar cambios" : "Crear categoría"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listado</CardTitle>
          <CardDescription>{loading ? "Cargando..." : `${categories.length} categorías registradas`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {categories.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              No hay categorías aún. Crea la primera para clasificar mejor tus movimientos.
            </div>
          )}

          {categories.map((category) => (
            <div key={category.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-slate-900">{category.name}</p>
                <p className="text-sm text-slate-500">{category.type} {category.parent_id ? `• padre ${category.parent_id}` : "• raíz"}</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => handleEdit(category)}>
                  <Pencil className="h-4 w-4" />
                  Editar
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => void handleDelete(category.id)}>
                  <Trash2 className="h-4 w-4" />
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}


