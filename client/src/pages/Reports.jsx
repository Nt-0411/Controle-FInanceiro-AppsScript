import React, { useState } from "react";
import { useMonth } from "../lib/MonthContext.jsx";
import { useSync } from "../lib/SyncContext.jsx";
import { api } from "../lib/api.js";
import { formatCurrency, formatDate } from "../lib/format.js";
import { baixarCsv } from "../lib/exportCsv.js";
import { useToast } from "../components/Toast.jsx";
import MonthSwitcher from "../components/MonthSwitcher.jsx";
import CategoryDonutChart from "../components/charts/CategoryDonutChart.jsx";
import PaymentBarChart from "../components/charts/PaymentBarChart.jsx";

export default function Reports() {
  const { month, year } = useMonth();
  const { report } = useSync();
  const { push } = useToast();
  const [gerando, setGerando] = useState(false);
  const [gerado, setGerado] = useState(null);

  /**
   * Exportar virou uma aba formatada na própria planilha: abre no app do Google
   * Sheets no celular e de lá dá para baixar em Excel, PDF ou CSV — sem
   * depender de nenhum servidor ligado.
   *
   * O link aparece como botão em vez de abrir sozinho: navegador nenhum deixa
   * abrir uma aba depois de uma espera, e um toque a mais é melhor que um
   * popup bloqueado sem explicação.
   */
  async function exportarParaPlanilha() {
    setGerando(true);
    try {
      setGerado(await api.gerarRelatorio(month, year));
    } catch (err) {
      push(err.message, "error");
    } finally {
      setGerando(false);
    }
  }

  function exportarCsv() {
    if (!baixarCsv(report)) {
      push("O navegador bloqueou o download. Use “Gerar na planilha” e baixe por lá.", "error");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <h1 className="text-xl font-semibold text-ink-primary dark:text-ink-primary-dark">Relatório mensal</h1>
        <MonthSwitcher />
      </div>

      <div className="flex flex-wrap gap-2 no-print">
        <button onClick={exportarParaPlanilha} disabled={gerando} className="btn-secondary">
          {gerando ? "Gerando..." : "📊 Gerar na planilha"}
        </button>
        <button onClick={exportarCsv} className="btn-secondary">⬇ Baixar CSV</button>
        <button onClick={() => window.print()} className="btn-secondary">🖨 Imprimir / PDF</button>
      </div>

      {gerado && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 no-print">
          <p className="text-sm text-ink-secondary dark:text-ink-secondary-dark">
            Relatório de <strong>{gerado.label}</strong> pronto na aba{" "}
            <strong>Relatório</strong> da planilha — de lá dá para baixar em Excel ou PDF.
          </p>
          <a href={gerado.url} target="_blank" rel="noreferrer" className="btn-primary shrink-0">
            Abrir na planilha
          </a>
        </div>
      )}

      <div className="print-area flex flex-col gap-5">
        <div className="text-center hidden print:block">
          <h2 className="text-lg font-semibold">Relatório de Gastos — {report.label}</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-ink-primary dark:text-ink-primary-dark">Por categoria</h2>
            <div className="mt-2">
              <CategoryDonutChart data={report.byCategory} />
            </div>
          </div>
          <div className="card p-4">
            <h2 className="text-sm font-semibold text-ink-primary dark:text-ink-primary-dark">Por forma de pagamento</h2>
            <div className="mt-2">
              <PaymentBarChart data={report.byPaymentMethod} />
            </div>
          </div>
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line-hairline dark:border-line-hairline-dark bg-surface-page dark:bg-white/5 text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Título</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium text-right">Valor</th>
                <th className="px-4 py-3 font-medium">Forma de Pagamento</th>
                <th className="px-4 py-3 font-medium">Observações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-hairline dark:divide-line-hairline-dark">
              {report.expenses.map((e, idx) => (
                <tr key={e.id} className={idx % 2 === 1 ? "bg-surface-page/50 dark:bg-white/[0.02]" : ""}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink-secondary dark:text-ink-secondary-dark">{formatDate(e.date)}</td>
                  <td className="px-4 py-2.5 font-medium text-ink-primary dark:text-ink-primary-dark">{e.title}</td>
                  <td className="px-4 py-2.5 text-ink-secondary dark:text-ink-secondary-dark">{e.category}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-ink-primary dark:text-ink-primary-dark" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatCurrency(e.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-ink-secondary dark:text-ink-secondary-dark">{e.paymentMethod}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{e.observation}</td>
                </tr>
              ))}
              {report.expenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-ink-muted">Nenhum gasto neste mês.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line-baseline dark:border-line-baseline-dark font-semibold">
                <td colSpan={3} className="px-4 py-3 text-right text-ink-secondary dark:text-ink-secondary-dark">TOTAL GERAL</td>
                <td className="px-4 py-3 text-right text-ink-primary dark:text-ink-primary-dark" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(report.totalGeral)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <SummaryTable title="Totais por categoria" rows={report.byCategory.map((c) => [c.category, c.total, c.percent])} />
          <SummaryTable title="Totais por forma de pagamento" rows={report.byPaymentMethod.map((p) => [p.method, p.total, p.percent])} />
        </div>
      </div>
    </div>
  );
}

function SummaryTable({ title, rows }) {
  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold text-ink-primary dark:text-ink-primary-dark">{title}</h2>
      <table className="mt-2 w-full text-sm">
        <tbody className="divide-y divide-line-hairline dark:divide-line-hairline-dark">
          {rows.map(([label, total, percent]) => (
            <tr key={label}>
              <td className="py-2 text-ink-secondary dark:text-ink-secondary-dark">{label}</td>
              <td className="py-2 text-right text-ink-muted">{percent.toFixed(1)}%</td>
              <td className="py-2 text-right font-medium text-ink-primary dark:text-ink-primary-dark" style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatCurrency(total)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="py-6 text-center text-ink-muted">Sem dados.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
