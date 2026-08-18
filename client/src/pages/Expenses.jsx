import React, { useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { useSync } from "../lib/SyncContext.jsx";
import { formatCurrency, formatDate } from "../lib/format.js";
import { useToast } from "../components/Toast.jsx";
import MonthSwitcher from "../components/MonthSwitcher.jsx";
import ExpenseFormModal from "../components/ExpenseFormModal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";

export default function Expenses() {
  const { push } = useToast();
  // Os gastos do mês já vieram na carga do app; filtrar aqui evita uma ida ao
  // Google a cada tecla digitada. Depois de gravar, a tela se atualiza sozinha
  // (a resposta traz uma revisão nova e a rotina de sincronização recarrega).
  const { report, categories, paymentMethods } = useSync();

  const [filterCategory, setFilterCategory] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const expenses = useMemo(() => {
    const termo = search.trim().toLowerCase();
    return report.expenses
      .filter((e) => !filterCategory || e.category === filterCategory)
      .filter((e) => !filterPayment || e.paymentMethod === filterPayment)
      .filter(
        (e) =>
          !termo ||
          e.title.toLowerCase().includes(termo) ||
          (e.observation || "").toLowerCase().includes(termo)
      )
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
  }, [report.expenses, filterCategory, filterPayment, search]);

  const total = useMemo(() => expenses.reduce((soma, e) => soma + e.amount, 0), [expenses]);

  async function handleSave(data) {
    if (editing) {
      await api.updateExpense(editing.id, data);
      push("Gasto atualizado.");
    } else {
      await api.createExpense(data);
      push("Gasto adicionado.");
    }
    setModalOpen(false);
    setEditing(null);
  }

  async function handleDelete() {
    const alvo = deleting;
    setDeleting(null);
    try {
      await api.deleteExpense(alvo.id);
      push("Gasto removido.");
    } catch (err) {
      push(err.message, "error");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink-primary dark:text-ink-primary-dark">Gastos</h1>
        <MonthSwitcher />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="input max-w-[160px]">
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
        <select value={filterPayment} onChange={(e) => setFilterPayment(e.target.value)} className="input max-w-[170px]">
          <option value="">Todas as formas</option>
          {paymentMethods.map((p) => (
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Buscar por título ou observação..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input flex-1 min-w-[180px]"
        />
        <button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="btn-primary ml-auto"
        >
          + Novo gasto
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line-hairline dark:border-line-hairline-dark text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Título</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Pagamento</th>
                <th className="px-4 py-3 font-medium text-right">Valor</th>
                <th className="px-4 py-3 font-medium">Observação</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-hairline dark:divide-line-hairline-dark">
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-surface-page dark:hover:bg-white/5">
                  <td className="whitespace-nowrap px-4 py-3 text-ink-secondary dark:text-ink-secondary-dark">{formatDate(e.date)}</td>
                  <td className="px-4 py-3 font-medium text-ink-primary dark:text-ink-primary-dark">{e.title}</td>
                  <td className="px-4 py-3"><CategoryBadge name={e.category} /></td>
                  <td className="px-4 py-3 text-ink-secondary dark:text-ink-secondary-dark">{e.paymentMethod}</td>
                  <td className="px-4 py-3 text-right font-medium text-ink-primary dark:text-ink-primary-dark" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatCurrency(e.amount)}
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-ink-muted">{e.observation}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setEditing(e);
                        setModalOpen(true);
                      }}
                      className="mr-2 text-xs font-medium text-brand dark:text-brand-dark"
                    >
                      Editar
                    </button>
                    <button onClick={() => setDeleting(e)} className="text-xs font-medium text-critical">
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {expenses.length > 0 && (
              <tfoot>
                <tr className="border-t border-line-hairline dark:border-line-hairline-dark font-semibold">
                  <td colSpan={4} className="px-4 py-3 text-right text-ink-secondary dark:text-ink-secondary-dark">Total do mês</td>
                  <td className="px-4 py-3 text-right text-ink-primary dark:text-ink-primary-dark" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatCurrency(total)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <ul className="divide-y divide-line-hairline dark:divide-line-hairline-dark md:hidden">
          {expenses.map((e) => (
            <li key={e.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink-primary dark:text-ink-primary-dark">{e.title}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">{formatDate(e.date)} · {e.paymentMethod}</p>
                </div>
                <span className="shrink-0 font-semibold text-ink-primary dark:text-ink-primary-dark" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(e.amount)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <CategoryBadge name={e.category} />
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setEditing(e);
                      setModalOpen(true);
                    }}
                    className="text-xs font-medium text-brand dark:text-brand-dark"
                  >
                    Editar
                  </button>
                  <button onClick={() => setDeleting(e)} className="text-xs font-medium text-critical">
                    Excluir
                  </button>
                </div>
              </div>
              {e.observation && <p className="mt-2 text-xs text-ink-muted">{e.observation}</p>}
            </li>
          ))}
        </ul>

        {expenses.length === 0 && (
          <div className="p-10 text-center text-sm text-ink-muted">
            {report.expenses.length === 0
              ? "Nenhum gasto registrado neste mês ainda."
              : "Nenhum gasto encontrado com esses filtros."}
          </div>
        )}

        {expenses.length > 0 && (
          <div className="flex justify-between border-t border-line-hairline dark:border-line-hairline-dark px-4 py-3 text-sm font-semibold md:hidden">
            <span className="text-ink-secondary dark:text-ink-secondary-dark">Total do mês</span>
            <span className="text-ink-primary dark:text-ink-primary-dark">{formatCurrency(total)}</span>
          </div>
        )}
      </div>

      <ExpenseFormModal
        open={modalOpen}
        categories={categories}
        paymentMethods={paymentMethods}
        initial={editing}
        onSave={handleSave}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Excluir gasto"
        message={deleting ? `Tem certeza que deseja excluir "${deleting.title}"?` : ""}
        confirmLabel="Excluir"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

function CategoryBadge({ name }) {
  return (
    <span className="inline-flex rounded-full bg-surface-page dark:bg-white/10 px-2.5 py-0.5 text-xs font-medium text-ink-secondary dark:text-ink-secondary-dark">
      {name}
    </span>
  );
}
