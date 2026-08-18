import React, { useEffect, useState } from "react";
import { todayIso } from "../lib/format.js";

const emptyForm = {
  date: todayIso(),
  title: "",
  amount: "",
  direction: "a_receber",
  personId: "",
  personName: "",
  observation: "",
};

export default function DebtFormModal({ open, people, defaultDirection, onSave, onClose }) {
  const [form, setForm] = useState(emptyForm);
  const [useNewPerson, setUseNewPerson] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setError("");
      setUseNewPerson(people.length === 0);
      setForm({
        ...emptyForm,
        direction: defaultDirection || "a_receber",
        personId: people[0]?.id ? String(people[0].id) : "",
      });
    }
  }, [open, defaultDirection, people]);

  if (!open) return null;

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) return setError("Informe uma descrição.");
    const amount = Number(form.amount.toString().replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return setError("Informe um valor válido, maior que zero.");
    if (useNewPerson && !form.personName.trim()) return setError("Informe o nome da pessoa.");
    if (!useNewPerson && !form.personId) return setError("Selecione uma pessoa.");

    setSaving(true);
    try {
      await onSave({
        date: form.date,
        title: form.title,
        amount,
        direction: form.direction,
        observation: form.observation,
        personId: useNewPerson ? undefined : Number(form.personId),
        personName: useNewPerson ? form.personName : undefined,
      });
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
        <h3 className="text-base font-semibold text-ink-primary dark:text-ink-primary-dark">Nova dívida</h3>

        <div className="mt-4 flex rounded-lg border border-line-hairline dark:border-line-hairline-dark p-1">
          <button
            type="button"
            onClick={() => update("direction", "a_receber")}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium ${
              form.direction === "a_receber" ? "bg-good text-white" : "text-ink-secondary dark:text-ink-secondary-dark"
            }`}
          >
            Me devem
          </button>
          <button
            type="button"
            onClick={() => update("direction", "a_pagar")}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium ${
              form.direction === "a_pagar" ? "bg-critical text-white" : "text-ink-secondary dark:text-ink-secondary-dark"
            }`}
          >
            Eu devo
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Pessoa" span2>
            {useNewPerson || people.length === 0 ? (
              <input
                type="text"
                required
                placeholder="Nome da pessoa"
                value={form.personName}
                onChange={(e) => update("personName", e.target.value)}
                className="input"
              />
            ) : (
              <select value={form.personId} onChange={(e) => update("personId", e.target.value)} className="input">
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
            {people.length > 0 && (
              <button
                type="button"
                onClick={() => setUseNewPerson((v) => !v)}
                className="mt-1 self-start text-xs font-medium text-brand dark:text-brand-dark"
              >
                {useNewPerson ? "Escolher pessoa existente" : "+ Cadastrar nova pessoa"}
              </button>
            )}
          </Field>

          <Field label="Data" span2>
            <input type="date" required value={form.date} onChange={(e) => update("date", e.target.value)} className="input" />
          </Field>

          <Field label="Descrição" span2>
            <input
              type="text"
              required
              placeholder="Ex: Uber dividido"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              className="input"
            />
          </Field>

          <Field label="Valor (R$)" span2>
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
          <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? "Salvando..." : "Salvar"}</button>
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
