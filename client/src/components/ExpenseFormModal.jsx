import React, { useEffect, useState } from "react";
import { todayIso } from "../lib/format.js";

const emptyForm = {
  date: todayIso(),
  title: "",
  category: "",
  amount: "",
  paymentMethod: "",
  observation: "",
};

export default function ExpenseFormModal({ open, categories, paymentMethods, initial, onSave, onClose }) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setError("");
      if (initial) {
        setForm({
          date: initial.date,
          title: initial.title,
          category: initial.category,
          amount: String(initial.amount),
          paymentMethod: initial.paymentMethod,
          observation: initial.observation || "",
        });
      } else {
        setForm({
          ...emptyForm,
          category: categories[0]?.name || "",
          paymentMethod: paymentMethods[0]?.name || "",
        });
      }
    }
  }, [open, initial, categories, paymentMethods]);

  if (!open) return null;

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) return setError("Informe um título para o gasto.");
    const amount = Number(form.amount.toString().replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return setError("Informe um valor válido, maior que zero.");

    setSaving(true);
    try {
      await onSave({ ...form, amount });
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
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-surface dark:bg-surface-dark p-5 shadow-xl max-h-[92vh] overflow-y-auto"
      >
        <h3 className="text-base font-semibold text-ink-primary dark:text-ink-primary-dark">
          {initial ? "Editar gasto" : "Novo gasto"}
        </h3>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Data" span2>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => update("date", e.target.value)}
              className="input"
            />
          </Field>

          <Field label="Título" span2>
            <input
              type="text"
              required
              placeholder="Ex: Mercado do mês"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              className="input"
            />
          </Field>

          <Field label="Valor (R$)">
            <input
              type="text"
              inputMode="decimal"
              required
              placeholder="0,00"
              value={form.amount}
              onChange={(e) => update("amount", e.target.value)}
              className="input"
            />
          </Field>

          <Field label="Categoria">
            <select value={form.category} onChange={(e) => update("category", e.target.value)} className="input" required>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Forma de Pagamento" span2>
            <select value={form.paymentMethod} onChange={(e) => update("paymentMethod", e.target.value)} className="input" required>
              {paymentMethods.map((p) => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Observação" span2>
            <textarea
              rows={2}
              placeholder="Opcional"
              value={form.observation}
              onChange={(e) => update("observation", e.target.value)}
              className="input resize-none"
            />
          </Field>
        </div>

        {error && <p className="mt-3 text-sm text-critical">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-secondary dark:text-ink-secondary-dark hover:bg-surface-page dark:hover:bg-white/5">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="rounded-lg bg-brand dark:bg-brand-dark px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60">
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, span2, children }) {
  return (
    <label className={`flex flex-col gap-1 ${span2 ? "col-span-2" : ""}`}>
      <span className="text-xs font-medium text-ink-secondary dark:text-ink-secondary-dark">{label}</span>
      {children}
    </label>
  );
}
