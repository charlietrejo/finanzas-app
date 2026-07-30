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
    initialAmount: "0",
    currentBalance: "0",
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

        void loadDebts();

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


            if (editingId) {

                await updateDebt(editingId, {
                    currentBalance: payload.currentBalance
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
                                setForm({ ...form, type: e.target.value })
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


                            <input
                                type="number"
                                className="rounded-2xl border bg-slate-50 px-4 py-3"
                                placeholder="Monto inicial"
                                value={form.initialAmount}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        initialAmount: e.target.value
                                    })
                                }
                            />


                            <input
                                type="number"
                                className="rounded-2xl border bg-slate-50 px-4 py-3"
                                placeholder="Saldo pendiente"
                                value={form.currentBalance}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        currentBalance: e.target.value
                                    })
                                }
                            />


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


                    {
                        debts.map(debt => (


                            <div
                                key={debt.id}
                                className="rounded-3xl border bg-slate-50 p-4"
                            >


                                <div className="flex justify-between">

                                    <div>

                                        <p className="font-semibold">
                                            {debt.name}
                                        </p>

                                        <p className="text-sm text-slate-500">
                                            {typeLabel(debt.type)}
                                        </p>

                                    </div>


                                    <p className="font-semibold">
                                        {money(debt.current_balance)}
                                    </p>


                                </div>



                                <div className="mt-3 flex gap-2">


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


                        ))
                    }


                </CardContent>


            </Card>


        </div>

    );

}