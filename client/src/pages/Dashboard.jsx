import React from "react";
import { Link } from "react-router-dom";
import { useSync } from "../lib/SyncContext.jsx";
import { formatCurrency, formatDate } from "../lib/format.js";
import MonthSwitcher from "../components/MonthSwitcher.jsx";
import StatCard from "../components/StatCard.jsx";
import CategoryDonutChart from "../components/charts/CategoryDonutChart.jsx";
import PaymentBarChart from "../components/charts/PaymentBarChart.jsx";
import TrendLineChart from "../components/charts/TrendLineChart.jsx";

export default function Dashboard() {
  const { report, trend, debtsSummary } = useSync();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink-primary dark:text-ink-primary-dark">Painel</h1>
        <MonthSwitcher />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Gasto no mês" value={formatCurrency(report.totalGeral)} />
        <StatCard label="Lançamentos" value={report.expenses.length} />
        <StatCard label="A receber" tone="good" value={formatCurrency(debtsSummary.aReceber)} />
        <StatCard label="A pagar" tone="critical" value={formatCurrency(debtsSummary.aPagar)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-ink-primary dark:text-ink-primary-dark">Gastos por categoria</h2>
          <div className="mt-2">
            <CategoryDonutChart data={report.byCategory} />
          </div>
        </div>
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-ink-primary dark:text-ink-primary-dark">Gastos por forma de pagamento</h2>
          <div className="mt-2">
            <PaymentBarChart data={report.byPaymentMethod} />
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="text-sm font-semibold text-ink-primary dark:text-ink-primary-dark">Últimos 6 meses</h2>
        <div className="mt-2">
          <TrendLineChart data={trend} />
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink-primary dark:text-ink-primary-dark">Lançamentos recentes</h2>
          <Link to="/gastos" className="text-xs font-medium text-brand dark:text-brand-dark">Ver todos</Link>
        </div>
        <ul className="mt-2 divide-y divide-line-hairline dark:divide-line-hairline-dark">
          {[...report.expenses].reverse().slice(0, 6).map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-ink-primary dark:text-ink-primary-dark">{e.title}</p>
                <p className="text-xs text-ink-muted">{formatDate(e.date)} · {e.category}</p>
              </div>
              <span className="shrink-0 font-medium text-ink-primary dark:text-ink-primary-dark" style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatCurrency(e.amount)}
              </span>
            </li>
          ))}
          {report.expenses.length === 0 && (
            <li className="py-6 text-center text-sm text-ink-muted">Nenhum gasto registrado neste mês ainda.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
