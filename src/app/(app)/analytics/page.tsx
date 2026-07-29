"use client";

import { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import {
  listAccounts,
  listCategories,
  listTransactions,
} from "@/services/finance";

import type {
  Account,
  Category,
  Transaction,
} from "@/types";


const chartPoints = [
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
];


export default function AnalyticsPage() {

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);



  const formatMoney = (amount: number) =>
    amount.toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
    });



  useEffect(() => {

    queueMicrotask(async () => {

      setLoading(true);

      try {

        const [
          transactionsData,
          categoriesData,
          accountsData,
        ] = await Promise.all([
          listTransactions(),
          listCategories(),
          listAccounts(),
        ]);


        setTransactions(transactionsData);
        setCategories(categoriesData);
        setAccounts(accountsData);

        setError(null);


      } catch (err) {

        setError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar el análisis."
        );


      } finally {

        setLoading(false);

      }

    });


  }, []);




  const summary = useMemo(() => {


    const income = transactions

      .filter(
        item => item.type === "INCOME"
      )

      .reduce(
        (sum, item) =>
          sum + Number(item.amount),
        0
      );



    const expense = transactions

      .filter(
        item => item.type === "EXPENSE"
      )

      .reduce(
        (sum, item) =>
          sum + Number(item.amount),
        0
      );



    const assets = accounts

      .filter(
        account =>
          account.type !== "CREDIT_CARD"
      )

      .reduce(
        (sum, account) =>
          sum + Number(account.current_balance),
        0
      );



    const debt = accounts

      .filter(
        account =>
          account.type === "CREDIT_CARD"
      )

      .reduce(
        (sum, account) =>
          sum + Number(account.current_balance),
        0
      );



    const netWorth = assets - debt;



    const savingRate =
      income > 0
        ? Math.round(
            ((income - expense) / income) * 100
          )
        : 0;




    const categorySummaries =
      transactions

        .filter(
          item =>
            item.type === "EXPENSE"
        )

        .reduce<Record<string, number>>(
          (acc, item) => {

            const key =
              item.category_id ??
              "Sin categoría";


            acc[key] =
              (acc[key] ?? 0) +
              Number(item.amount);


            return acc;

          },
          {}
        );



    const topCategories =
      Object.entries(categorySummaries)

        .sort(
          (a, b) =>
            b[1] - a[1]
        )

        .slice(0, 3)

        .map(
          ([categoryId, amount]) => ({

            id: categoryId,

            amount,

            label:
              categories.find(
                category =>
                  category.id === categoryId
              )?.name ??
              "Sin categoría",

          })
        );



    return {

      income,

      expense,

      assets,

      debt,

      netWorth,

      savingRate,

      transactionCount:
        transactions.length,

      topCategories,

    };


  }, [
    transactions,
    categories,
    accounts,
  ]);




  return (

    <div className="space-y-6 p-2 sm:p-4">


      <div>

        <p className="text-sm font-medium text-slate-500">
          Gastos
        </p>


        <h1 className="text-2xl font-semibold text-slate-900">
          Reporte mensual
        </h1>


      </div>


      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">


        <Card>

          <CardHeader>

            <CardTitle>
              Patrimonio total
            </CardTitle>


            <CardDescription>
              Resumen real basado en tus cuentas.
            </CardDescription>


          </CardHeader>



          <CardContent className="space-y-4 rounded-[28px] bg-slate-50 p-4">


            <div className="flex items-center justify-between gap-4">


              <div>

                <p className="text-sm text-slate-500">
                  Patrimonio actual
                </p>


                <p className="mt-2 text-3xl font-semibold text-slate-900">
                  {formatMoney(summary.netWorth)}
                </p>


              </div>


              <div className="rounded-3xl bg-white px-3 py-2 text-sm text-slate-900 shadow-sm">

                {summary.savingRate}% ahorro

              </div>


            </div>
                    <div className="grid gap-3 rounded-[32px] bg-white p-4 shadow-sm">

          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Activos
            </span>

            <span className="text-sm font-semibold text-slate-900">
              {formatMoney(summary.assets)}
            </span>
          </div>


          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Deuda
            </span>

            <span className="text-sm font-semibold text-slate-900">
              {formatMoney(summary.debt)}
            </span>
          </div>


          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Transacciones
            </span>

            <span className="text-sm font-semibold text-slate-900">
              {summary.transactionCount}
            </span>
          </div>

        </div>



        <div className="grid gap-3 rounded-[32px] bg-white p-4 shadow-sm">


          <div className="flex items-center justify-between gap-4">

            <span className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Mes
            </span>


            <span className="text-xs uppercase tracking-[0.25em] text-slate-500">
              Tendencia
            </span>


          </div>



          <div className="flex items-end gap-2 h-48">

            {chartPoints.map((label, index) => (

              <div
                key={label}
                className="flex-1"
              >

                <div
                  style={{
                    height: `${30 + index * 8}px`,
                  }}
                  className="mx-auto w-full rounded-full bg-gradient-to-b from-violet-500 to-slate-200"
                />


                <p className="mt-3 text-center text-xs text-slate-400">
                  {label}
                </p>


              </div>

            ))}

          </div>


        </div>



      </CardContent>

    </Card>




    <Card>

      <CardHeader>

        <CardTitle>
          Resumen financiero
        </CardTitle>


        <CardDescription>
          Activos, deuda y patrimonio actual.
        </CardDescription>


      </CardHeader>



      <CardContent className="space-y-3 rounded-[28px] bg-slate-50 p-4">


        {[
          {
            label: "Activos",
            amount: formatMoney(summary.assets),
            detail: "Dinero disponible e inversiones",
          },

          {
            label: "Deuda",
            amount: formatMoney(summary.debt),
            detail: "Tarjetas de crédito",
          },

          {
            label: "Patrimonio",
            amount: formatMoney(summary.netWorth),
            detail: "Valor neto actual",
          },

        ].map((item) => (

          <div
            key={item.label}
            className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white px-4 py-3"
          >

            <div>

              <p className="font-semibold text-slate-900">
                {item.label}
              </p>


              <p className="text-xs text-slate-500">
                {item.detail}
              </p>


            </div>


            <p className="font-semibold text-slate-900">
              {item.amount}
            </p>


          </div>

        ))}



      </CardContent>


    </Card>


  </div>





  <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">


    <Card>

      <CardHeader>

        <CardTitle>
          Flujo mensual
        </CardTitle>


        <CardDescription>
          Ingresos y gastos registrados.
        </CardDescription>


      </CardHeader>



      <CardContent className="space-y-3 rounded-[28px] bg-slate-50 p-4">


        {[
          {
            label: "Ingresos",
            value: summary.income,
          },

          {
            label: "Gastos",
            value: summary.expense,
          },

          {
            label: "Disponible para ahorro",
            value: summary.income - summary.expense,
          },

        ].map((item) => (

          <div
            key={item.label}
            className="rounded-3xl border border-slate-200 bg-white p-4"
          >

            <div className="flex items-center justify-between text-sm font-semibold text-slate-900">

              <span>
                {item.label}
              </span>


              <span>
                {formatMoney(item.value)}
              </span>

            </div>


          </div>

        ))}


      </CardContent>


    </Card>





    <Card>


      <CardHeader>

        <CardTitle>
          Insights
        </CardTitle>


        <CardDescription>
          Análisis de tus movimientos.
        </CardDescription>


      </CardHeader>




      <CardContent className="space-y-3 rounded-[28px] bg-slate-50 p-4">


        <div className="rounded-3xl border border-slate-200 bg-white p-4">

          <div className="flex items-center justify-between gap-4">

            <p className="text-sm font-semibold text-slate-900">
              Ahorro neto
            </p>


            <p className="text-lg font-semibold text-slate-900">
              {formatMoney(summary.income - summary.expense)}
            </p>


          </div>


          <p className="mt-1 text-xs text-slate-500">
            {summary.savingRate}% de ahorro sobre ingresos
          </p>


        </div>




        <div className="rounded-3xl border border-slate-200 bg-white p-4">


          <p className="text-sm font-semibold text-slate-900">
            Categorías principales
          </p>


          <div className="mt-3 space-y-2">


            {summary.topCategories.length === 0 && (

              <p className="text-xs text-slate-500">
                Aún no hay gastos categorizados.
              </p>

            )}



            {summary.topCategories.map((category) => (

              <div
                key={category.id}
                className="flex items-center justify-between text-sm"
              >

                <span className="text-slate-600">
                  {category.label}
                </span>


                <span className="font-semibold text-slate-900">
                  {formatMoney(category.amount)}
                </span>


              </div>

            ))}


          </div>


        </div>


      </CardContent>


    </Card>


  </div>




  {loading && (

    <Card>

      <CardContent className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">

        Cargando información financiera...

      </CardContent>

    </Card>

  )}




  {error && (

    <Card>

      <CardContent className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">

        {error}

      </CardContent>

    </Card>

  )}



</div>

  );

}