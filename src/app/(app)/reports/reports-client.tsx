"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Printer, Table2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { formatMXN } from "@/lib/format";
import { formatMonthShort } from "@/lib/date-utils";
import { CASH_FLOW_COLORS, CATEGORICAL_CHART_COLORS, NET_WORTH_COLOR } from "@/lib/constants/chart-colors";
import { buildCsv, downloadCsv } from "@/lib/csv-export";
import type { ReportsData } from "@/lib/reports-data";

const RANGES = [6, 12, 24] as const;

export function ReportsClient({ months, data }: { months: number; data: ReportsData }) {
  const router = useRouter();
  const [showTable, setShowTable] = useState(false);

  const { cashFlow, categoryDistribution, netWorth, monthlyInsights } = data;
  const essentialPct =
    monthlyInsights.totalExpenses > 0
      ? Math.round((monthlyInsights.essentialExpenses / monthlyInsights.totalExpenses) * 100)
      : 0;

  const categoryTotal = categoryDistribution.reduce((sum, s) => sum + s.amount, 0);

  let lastHistoricalIndex = 0;
  netWorth.forEach((p, i) => {
    if (!p.projected) lastHistoricalIndex = i;
  });
  const netWorthChartData = netWorth.map((p, i) => ({
    month: p.month,
    historical: i <= lastHistoricalIndex ? p.netWorth : null,
    projected: i >= lastHistoricalIndex ? p.netWorth : null,
  }));

  const csvRows = useMemo(() => {
    return cashFlow.map((c, i) => {
      const nw = netWorth[i];
      return [c.month, c.income, c.expense, c.net, nw ? nw.netWorth : ""];
    });
  }, [cashFlow, netWorth]);

  function handleExportCsv() {
    const csv = buildCsv(["Mes", "Ingresos", "Gastos", "Flujo neto", "Patrimonio neto"], csvRows);
    downloadCsv(`reporte-northstar-${months}m.csv`, csv);
  }

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-light text-ink md:text-3xl">Reportes</h1>
          <p className="text-sm text-slate">Flujo de efectivo, categorías y patrimonio neto</p>
        </div>
        <div className="flex items-center gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => router.push(`/reports?months=${r}`)}
              aria-pressed={months === r}
              className={
                "min-h-11 rounded-pill px-4 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-monday-violet " +
                (months === r ? "bg-monday-violet text-white" : "bg-pebble/40 text-slate hover:bg-pebble/60")
              }
            >
              {r} meses
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button variant="outline" onClick={() => setShowTable((v) => !v)}>
          <Table2 size={16} /> {showTable ? "Ver gráficas" : "Ver como tabla"}
        </Button>
        <Button variant="outline" onClick={handleExportCsv}>
          <Download size={16} /> Exportar CSV
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer size={16} /> Exportar PDF
        </Button>
      </div>

      {/* Secciones 3.6/3.8: dos cortes distintos de los gastos del mes en
          curso — a propósito por separado, uno por necesidad (esencial vs
          no) y otro por tamaño/frecuencia (gasto hormiga), aunque vienen de
          los mismos datos. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card tone="mint">
          <p className="text-sm font-medium text-slate">Gastos esenciales del mes</p>
          <p className="mt-2 text-3xl font-light text-ink">{formatMXN(monthlyInsights.essentialExpenses)}</p>
          <p className="mt-1 text-xs text-slate">
            {essentialPct}% de {formatMXN(monthlyInsights.totalExpenses)} gastados este mes
          </p>
        </Card>
        <Card tone="apricot">
          <p className="text-sm font-medium text-slate">Gasto hormiga</p>
          <p className="mt-2 text-3xl font-light text-ink">{formatMXN(monthlyInsights.antExpenseTotal)}</p>
          <p className="mt-1 text-xs text-slate">Compras menores a $200 este mes, sin importar categoría</p>
        </Card>
      </div>

      {showTable ? (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[500px] text-left text-sm">
            <thead>
              <tr className="text-slate">
                <th className="px-2 py-2">Mes</th>
                <th className="px-2 py-2">Ingresos</th>
                <th className="px-2 py-2">Gastos</th>
                <th className="px-2 py-2">Flujo neto</th>
                <th className="px-2 py-2">Patrimonio neto</th>
              </tr>
            </thead>
            <tbody>
              {cashFlow.map((c, i) => (
                <tr key={c.month} className="border-t border-mist">
                  <td className="px-2 py-1.5">{formatMonthShort(c.month)}</td>
                  <td className="px-2 py-1.5">{formatMXN(c.income)}</td>
                  <td className="px-2 py-1.5">{formatMXN(c.expense)}</td>
                  <td className="px-2 py-1.5">{formatMXN(c.net)}</td>
                  <td className="px-2 py-1.5">{netWorth[i] ? formatMXN(netWorth[i].netWorth) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-lg font-medium text-ink">Flujo de efectivo</h2>
            <Card>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={cashFlow}>
                  <CartesianGrid vertical={false} stroke="var(--color-mist)" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={formatMonthShort}
                    tick={{ fill: "var(--color-slate)", fontSize: 12 }}
                    axisLine={{ stroke: "var(--color-mist)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--color-slate)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={70}
                    tickFormatter={(v) => formatMXN(v)}
                  />
                  <Tooltip
                    content={(props) => (
                      <ChartTooltip
                        active={props.active}
                        label={props.label ? formatMonthShort(String(props.label)) : undefined}
                        formatter={formatMXN}
                        payload={props.payload?.map((p) => ({
                          name: String(p.name),
                          value: Number(p.value),
                          color: String(p.color),
                        }))}
                      />
                    )}
                  />
                  <Legend wrapperStyle={{ fontSize: 13, color: "var(--color-slate)" }} />
                  <Bar dataKey="income" name="Ingresos" fill={CASH_FLOW_COLORS.income} radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="expense" name="Gastos" fill={CASH_FLOW_COLORS.expense} radius={[4, 4, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium text-ink">Distribución de gastos por categoría</h2>
            <Card>
              {categoryDistribution.length === 0 ? (
                <p className="text-sm text-slate">No hay gastos registrados en este periodo.</p>
              ) : (
                <div className="flex flex-col items-center gap-4 sm:flex-row">
                  <ResponsiveContainer width="100%" height={260} className="sm:max-w-[260px]">
                    <PieChart>
                      <Pie
                        data={categoryDistribution}
                        dataKey="amount"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                      >
                        {categoryDistribution.map((slice, i) => (
                          <Cell key={slice.categoryId} fill={CATEGORICAL_CHART_COLORS[i % CATEGORICAL_CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={(props) => (
                          <ChartTooltip
                            active={props.active}
                            formatter={formatMXN}
                            payload={props.payload?.map((p) => ({
                              name: String(p.name),
                              value: Number(p.value),
                              color: String(p.payload?.fill),
                            }))}
                          />
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <ul className="flex flex-1 flex-col gap-1.5 text-sm">
                    {categoryDistribution.map((slice, i) => (
                      <li key={slice.categoryId} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-ink">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: CATEGORICAL_CHART_COLORS[i % CATEGORICAL_CHART_COLORS.length] }}
                          />
                          {slice.name}
                        </span>
                        <span className="text-slate">
                          {formatMXN(slice.amount)} ({((slice.amount / categoryTotal) * 100).toFixed(0)}%)
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium text-ink">
              Patrimonio neto y proyección
            </h2>
            <Card>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={netWorthChartData}>
                  <CartesianGrid vertical={false} stroke="var(--color-mist)" />
                  <XAxis
                    dataKey="month"
                    tickFormatter={formatMonthShort}
                    tick={{ fill: "var(--color-slate)", fontSize: 12 }}
                    axisLine={{ stroke: "var(--color-mist)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--color-slate)", fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    width={70}
                    tickFormatter={(v) => formatMXN(v)}
                  />
                  <Tooltip
                    content={(props) => (
                      <ChartTooltip
                        active={props.active}
                        label={props.label ? formatMonthShort(String(props.label)) : undefined}
                        formatter={formatMXN}
                        payload={props.payload
                          ?.filter((p) => p.value !== null && p.value !== undefined)
                          .map((p) => ({
                            name: p.dataKey === "projected" ? "Proyección" : "Patrimonio neto",
                            value: Number(p.value),
                            color: NET_WORTH_COLOR,
                          }))}
                      />
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="historical"
                    name="Patrimonio neto"
                    stroke={NET_WORTH_COLOR}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="projected"
                    name="Proyección"
                    stroke={NET_WORTH_COLOR}
                    strokeOpacity={0.4}
                    strokeDasharray="6 4"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="mt-2 text-xs text-slate">
                La línea punteada proyecta los próximos 6 meses según el promedio de flujo neto de este periodo.
              </p>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
