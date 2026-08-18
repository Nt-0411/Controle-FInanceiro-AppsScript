import React, { useEffect, useState } from "react";
import { formatCurrency } from "../lib/format.js";

export default function PayDebtModal({ debt, onSave, onClose }) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (debt) {
      setError("");
      setAmount(String(debt.remaining ?? debt.amount - (debt.paidAmount || 0)).replace(".", ","));
    }
  }, [debt]);

  if (!debt) return null;

  const remaining = debt.remaining ?? debt.amount - (debt.paidAmount || 0);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const value = Number(amount.toString().replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return setError("Informe um valor válido, maior que zero.");
    if (value > remaining + 0.01) return setError(`O pagamento não pode ser maior que o saldo restante (${formatCurrency(remaining)}).`);
    setSaving(true);
    try {
      await onSave(value);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4 no-print" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl bg-surface dark:bg-surface-dark p-5 shadow-xl"
      >
        <h3 className="text-base font-semibold text-ink-primary dark:text-ink-primary-dark">Registrar pagamento</h3>
        <p className="mt-1 text-sm text-ink-secondary dark:text-ink-secondary-dark">
          {debt.title} · {debt.personName}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          Saldo restante: <span className="font-medium text-ink-primary dark:text-ink-primary-dark">{formatCurrency(remaining)}</span> de {formatCurrency(debt.amount)}
        </p>

        <label className="mt-4 flex flex-col gap-1">
          <span className="text-xs font-medium text-ink-secondary dark:text-ink-secondary-dark">Valor pago agora (R$)</span>
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
          />
        </label>
        <p className="mt-1 text-xs text-ink-muted">
          Pagamento parcial: o restante continua pendente. Pagamento igual ao saldo: a dívida é quitada.
        </p>

        {error && <p className="mt-3 text-sm text-critical">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "Salvando..." : "Registrar pagamento"}</button>
        </div>
      </form>
    </div>
  );
}
