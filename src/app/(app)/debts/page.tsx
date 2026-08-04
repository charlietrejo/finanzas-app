"use client";

import { useEffect, useState } from "react";
import { Pencil, PlusCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

import {
    createDebt,
    deleteDebt,
    listDebts,
    updateDebt,
} from "@/services/finance";


type Debt = {
    id: string;
    name: string;
    type: string;
    initial_amount: number;
    current_balance: number;
    due_date?: string | null;
};


const debtTypes = [
    {
        value: "CREDIT_CARD",
        label: "Tarjeta de crédito",
    },
    {
        value: "LOAN",
        label: "Préstamo",
    },
    {
        value: "MORTGAGE",
        label: "Hipoteca",
    },
    {
        value: "OTHER",
        label: "Otro",
    },
];


const emptyForm = {
    name: "",
    type: "CREDIT_CARD",
    initialAmount: "",
    currentBalance: "",
    dueDate: "",
};


export default function DebtsPage() {

    const [debts, setDebts] = useState<Debt[]>([]);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);


    const money = (value: number) =>
        value.toLocaleString("es-MX", {
            style: "currency",
            currency: "MXN"
        });


    const typeLabel = (type: string) =>
        debtTypes.find(item => item.value === type)?.label ?? type;


    const loadDebts = async () => {

        setLoading(true);

        try {

            const data = await listDebts();

            setDebts(data);

        } catch (error) {

            setError(
                error instanceof Error
                    ? error.message
                    : "No se pudieron cargar las deudas."
            );

        } finally {
            setLoading(false);
        }
    };


    useEffect(() => {
        queueMicrotask(() => {
            void loadDebts();
        });
    }, []);



    const handleSubmit = async (
        event: React.FormEvent<HTMLFormElement>
    ) => {
        event.preventDefault();
        try {
            const payload = {
                name: form.name.trim(),
                type: form.type,
                initialAmount: Number(form.initialAmount),
                currentBalance: Number(form.currentBalance),
                dueDate: form.dueDate || null,
            };


            if (!payload.name) {
                throw new Error(
                    "El nombre de la deuda es obligatorio."
                );
            }

            if (payload.initialAmount <= 0) {
                throw new Error(
                    form.type === "CREDIT_CARD"
                        ? "Ingresa el límite de crédito."
                        : "Ingresa el monto original."
                );
            }

            if (payload.currentBalance < 0) {
                throw new Error("La deuda actual no puede ser negativa.");
            }

            if (payload.currentBalance > payload.initialAmount) {
                throw new Error(
                    "La deuda actual no puede ser mayor que el límite de crédito."
                );
            }


            if (editingId) {
                await updateDebt(editingId, {
                    name: payload.name,
                    type: payload.type,
                    initialAmount: payload.initialAmount,
                    currentBalance: payload.currentBalance,
                    dueDate: payload.dueDate,
                });
            } else {
                await createDebt(payload);
            }


            setForm(emptyForm);
            setEditingId(null);
            await loadDebts();

        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "No se pudo guardar."
            );
        }
    };

    const editDebt = (debt: Debt) => {
        setEditingId(debt.id);
        setForm({
            name: debt.name,
            type: debt.type,
            initialAmount: String(debt.initial_amount),
            currentBalance: String(debt.current_balance),
            dueDate: debt.due_date ?? ""
        });
    };


    const removeDebt = async (id: string) => {
        await deleteDebt(id);
        await loadDebts();
    };



    return (
        <div className="space-y-6 p-2 sm:p-4">

            <Card>
                <CardHeader>
                    <CardTitle>
                        {editingId ? "Editar deuda" : "Nueva deuda"}
                    </CardTitle>
                    <CardDescription>
                        Administra tarjetas, préstamos y obligaciones pendientes.
                    </CardDescription>
                </CardHeader>

                <CardContent>

                    <form
                        onSubmit={handleSubmit}
                        className="space-y-3"
                    >

                        <input
                            className="w-full rounded-2xl border bg-slate-50 px-4 py-3"
                            placeholder="Nombre de la deuda"
                            value={form.name}
                            onChange={(e) =>
                                setForm({ ...form, name: e.target.value })
                            }
                        />


                        <select
                            className="w-full rounded-2xl border bg-slate-50 px-4 py-3"
                            value={form.type}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    type: e.target.value,
                                    initialAmount: "",
                                    currentBalance: "",
                                })
                            }
                        >
                            {
                                debtTypes.map(type => (
                                    <option
                                        key={type.value}
                                        value={type.value}
                                    >
                                        {type.label}
                                    </option>
                                ))
                            }
                        </select>


                        <div className="grid gap-3 sm:grid-cols-2">

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-600">
                                    {form.type === "CREDIT_CARD"
                                        ? "Límite de crédito"
                                        : "Monto original"}
                                </label>

                                <input
                                    type="number"
                                    className="w-full rounded-2xl border bg-slate-50 px-4 py-3"
                                    placeholder={
                                        form.type === "CREDIT_CARD"
                                            ? "Ej. 50000"
                                            : "Ej. 150000"
                                    }
                                    value={form.initialAmount}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            initialAmount: e.target.value,
                                        })
                                    }
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-600">
                                    Saldo pendiente
                                </label>

                                <input
                                    type="number"
                                    className="w-full rounded-2xl border bg-slate-50 px-4 py-3"
                                    placeholder={
                                        form.type === "CREDIT_CARD"
                                            ? "Ej. 12000"
                                            : "Ej. 80000"
                                    }
                                    value={form.currentBalance}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            currentBalance: e.target.value,
                                        })
                                    }
                                />
                            </div>

                        </div>


                        <input
                            type="date"
                            className="w-full rounded-2xl border bg-slate-50 px-4 py-3"
                            value={form.dueDate}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    dueDate: e.target.value
                                })
                            }
                        />

                        {
                            error &&
                            <p className="text-sm text-red-600">
                                {error}
                            </p>
                        }


                        <Button>
                            <PlusCircle className="h-4 w-4" />
                            Guardar deuda
                        </Button>


                    </form>


                </CardContent>

            </Card>





            <Card>

                <CardHeader>

                    <CardTitle>
                        Deudas registradas
                    </CardTitle>

                    <CardDescription>
                        {
                            loading
                                ? "Cargando..."
                                : `${debts.length} deudas`
                        }
                    </CardDescription>


                </CardHeader>



                <CardContent className="space-y-3">


                    {debts.map((debt) => {

                        const availableCredit =
                            debt.initial_amount - debt.current_balance;

                        const usedPercent =
                            debt.initial_amount > 0
                                ? (debt.current_balance / debt.initial_amount) * 100
                                : 0;

                        return (

                            <div
                                key={debt.id}
                                className="rounded-3xl border bg-slate-50 p-4"
                            >

                                <div className="flex justify-between">

                                    <div>
                                        <p className="font-semibold text-slate-900">
                                            {debt.name}
                                        </p>

                                        <p className="text-sm text-slate-500">
                                            {typeLabel(debt.type)}
                                        </p>
                                    </div>

                                    <p className="font-semibold text-red-600">
                                        {money(debt.current_balance)}
                                    </p>

                                </div>


                                <div className="mt-4 space-y-2">

                                    <div className="flex justify-between text-sm">

                                        <span className="text-slate-500">
                                            Límite de crédito
                                        </span>

                                        <span className="font-medium">
                                            {money(debt.initial_amount)}
                                        </span>

                                    </div>


                                    <div className="flex justify-between text-sm">

                                        <span className="text-slate-500">
                                            Disponible
                                        </span>

                                        <span className="font-medium text-green-600">
                                            {money(availableCredit)}
                                        </span>

                                    </div>


                                    <div className="flex justify-between text-sm">

                                        <span className="text-slate-500">
                                            Uso de crédito
                                        </span>

                                        <span className="font-medium">
                                            {usedPercent.toFixed(0)}%
                                        </span>

                                    </div>


                                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">

                                        <div
                                            className="h-full rounded-full bg-violet-500"
                                            style={{
                                                width: `${Math.min(usedPercent, 100)}%`
                                            }}
                                        />

                                    </div>

                                </div>


                                <div className="mt-4 flex gap-2">


                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => editDebt(debt)}
                                    >

                                        <Pencil className="h-4 w-4" />

                                        Editar

                                    </Button>


                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => void removeDebt(debt.id)}
                                    >

                                        <Trash2 className="h-4 w-4" />

                                        Eliminar

                                    </Button>


                                </div>


                            </div>

                        );

                    })}




                </CardContent>


            </Card>


        </div>

    );

}