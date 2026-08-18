import React, { useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { useSync } from "../lib/SyncContext.jsx";
import { formatCurrency, formatDate } from "../lib/format.js";
import { useToast } from "../components/Toast.jsx";
import DebtFormModal from "../components/DebtFormModal.jsx";
import PayDebtModal from "../components/PayDebtModal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import StatCard from "../components/StatCard.jsx";

export default function Debts() {
  const { push } = useToast();
  const { debts, people, debtsSummary } = useSync();

  const [direction, setDirection] = useState("a_receber");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [paying, setPaying] = useState(null);

  const grouped = useMemo(() => {
    const visiveis = debts
      .filter((d) => d.direction === direction)
      .filter((d) => statusFilter === "all" || d.status === statusFilter);

    const mapa = new Map();
    for (const d of visiveis) {
      if (!mapa.has(d.personName)) mapa.set(d.personName, []);
      mapa.get(d.personName).push(d);
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [debts, direction, statusFilter]);

  async function handleSave(data) {
    await api.createDebt(data);
    push("Dívida registrada.");
    setModalOpen(false);
  }

  async function handleReopen(debt) {
    try {
      await api.setDebtStatus(debt.id, "pending");
      push("Dívida reaberta.");
    } catch (err) {
      push(err.message, "error");
    }
  }

  async function handlePay(amount) {
    // Sem fechar antes de gravar: se der erro, o modal mostra a mensagem.
    await api.payDebt(paying.id, amount);
    push("Pagamento registrado.");
    setPaying(null);
  }

  async function handleDelete() {
    const alvo = deleting;
    setDeleting(null);
    try {
      await api.deleteDebt(alvo.id);
      push("Dívida removida.");
    } catch (err) {
      push(err.message, "error");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink-primary dark:text-ink-primary-dark">Dívidas</h1>
        <button onClick={() => setModalOpen(true)} className="btn-primary">+ Nova dívida</button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="A receber" tone="good" value={formatCurrency(debtsSummary.aReceber)} />
        <StatCard label="A pagar" tone="critical" value={formatCurrency(debtsSummary.aPagar)} />
        <StatCard label="Saldo" tone={debtsSummary.saldo >= 0 ? "good" : "critical"} value={formatCurrency(debtsSummary.saldo)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-line-hairline dark:border-line-hairline-dark p-1">
          <button
            onClick={() => setDirection("a_receber")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${
              direction === "a_receber" ? "bg-good text-white" : "text-ink-secondary dark:text-ink-secondary-dark"
            }`}
          >
            Me devem
          </button>
          <button
            onClick={() => setDirection("a_pagar")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium ${
              direction === "a_pagar" ? "bg-critical text-white" : "text-ink-secondary dark:text-ink-secondary-dark"
            }`}
          >
            Eu devo
          </button>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input max-w-[150px]">
          <option value="pending">Pendentes</option>
          <option value="paid">Pagas</option>
          <option value="all">Todas</option>
        </select>
      </div>

      <div className="flex flex-col gap-4">
        {grouped.map(([personName, items]) => {
          const subtotal = items.reduce((soma, d) => soma + (d.status === "paid" ? 0 : d.remaining ?? d.amount - (d.paidAmount || 0)), 0);
          return (
            <div key={personName} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line-hairline dark:border-line-hairline-dark px-4 py-3">
                <h3 className="text-sm font-semibold text-ink-primary dark:text-ink-primary-dark">{personName}</h3>
                <span className="text-sm font-semibold text-ink-primary dark:text-ink-primary-dark" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatCurrency(subtotal)}
                </span>
              </div>
              <ul className="divide-y divide-line-hairline dark:divide-line-hairline-dark">
                {items.map((d) => {
                  const paidAmount = d.paidAmount || 0;
                  const remaining = d.remaining ?? d.amount - paidAmount;
                  const partial = d.status !== "paid" && paidAmount > 0;
                  return (
                    <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className={`font-medium text-ink-primary dark:text-ink-primary-dark ${d.status === "paid" ? "line-through opacity-60" : ""}`}>
                          {d.title}
                        </p>
                        <p className="text-xs text-ink-muted">{formatDate(d.date)}{d.observation ? ` · ${d.observation}` : ""}</p>
                        {partial && (
                          <p className="mt-0.5 text-xs font-medium text-good">
                            {formatCurrency(paidAmount)} pago de {formatCurrency(d.amount)} · falta {formatCurrency(remaining)}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="font-medium text-ink-primary dark:text-ink-primary-dark" style={{ fontVariantNumeric: "tabular-nums" }}>
                          {formatCurrency(d.status === "paid" ? d.amount : remaining)}
                        </span>
                        {d.status === "paid" ? (
                          <button
                            onClick={() => handleReopen(d)}
                            className="rounded-md px-2 py-1 text-xs font-medium bg-surface-page dark:bg-white/10 text-ink-secondary dark:text-ink-secondary-dark"
                          >
                            Reabrir
                          </button>
                        ) : (
                          <button
                            onClick={() => setPaying(d)}
                            className="rounded-md px-2 py-1 text-xs font-medium bg-good/10 text-good"
                          >
                            {partial ? "Registrar mais" : "Registrar pagamento"}
                          </button>
                        )}
                        <button onClick={() => setDeleting(d)} className="text-xs font-medium text-critical">Excluir</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        {grouped.length === 0 && (
          <div className="card p-10 text-center text-sm text-ink-muted">
            Nenhuma dívida {statusFilter === "paid" ? "quitada" : "pendente"} registrada.
          </div>
        )}
      </div>

      <DebtFormModal
        open={modalOpen}
        people={people}
        defaultDirection={direction}
        onSave={handleSave}
        onClose={() => setModalOpen(false)}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Excluir dívida"
        message={deleting ? `Tem certeza que deseja excluir "${deleting.title}"?` : ""}
        confirmLabel="Excluir"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />

      <PayDebtModal debt={paying} onSave={handlePay} onClose={() => setPaying(null)} />
    </div>
  );
}
