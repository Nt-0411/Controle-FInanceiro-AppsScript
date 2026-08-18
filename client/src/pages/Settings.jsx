import React, { useState } from "react";
import { api } from "../lib/api.js";
import { useSync } from "../lib/SyncContext.jsx";
import { formatCurrency } from "../lib/format.js";
import { useToast } from "../components/Toast.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import { categoricalColor } from "../lib/palette.js";

export default function Settings() {
  const { push } = useToast();
  const { categories, paymentMethods, people } = useSync();

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-ink-primary dark:text-ink-primary-dark">Ajustes</h1>

      <ManageList
        title="Categorias"
        items={categories.map((c, i) => ({ id: c.id, label: c.name, dot: categoricalColor(i) }))}
        placeholder="Nova categoria"
        onAdd={async (name) => {
          await api.createCategory({ name });
          push("Categoria adicionada.");
        }}
        onRemove={async (id) => {
          await api.deleteCategory(id);
          push("Categoria removida.");
        }}
        pushError={(msg) => push(msg, "error")}
      />

      <ManageList
        title="Formas de Pagamento"
        items={paymentMethods.map((p) => ({ id: p.id, label: p.name }))}
        placeholder="Nova forma de pagamento"
        onAdd={async (name) => {
          await api.createPaymentMethod({ name });
          push("Forma de pagamento adicionada.");
        }}
        onRemove={async (id) => {
          await api.deletePaymentMethod(id);
          push("Forma de pagamento removida.");
        }}
        pushError={(msg) => push(msg, "error")}
      />

      <div className="card p-4">
        <h2 className="text-sm font-semibold text-ink-primary dark:text-ink-primary-dark">Pessoas</h2>
        <p className="mt-1 text-xs text-ink-muted">Pessoas cadastradas ao registrar dívidas. Saldo positivo = te devem no total.</p>
        <ul className="mt-3 divide-y divide-line-hairline dark:divide-line-hairline-dark">
          {people.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="font-medium text-ink-primary dark:text-ink-primary-dark">{p.name}</span>
              <span className={`font-medium ${p.saldo >= 0 ? "text-good" : "text-critical"}`} style={{ fontVariantNumeric: "tabular-nums" }}>
                {formatCurrency(p.saldo)}
              </span>
            </li>
          ))}
          {people.length === 0 && <li className="py-6 text-center text-sm text-ink-muted">Nenhuma pessoa cadastrada ainda.</li>}
        </ul>
      </div>

      <SecaoPlanilha />
    </div>
  );
}

function SecaoPlanilha() {
  const { push } = useToast();
  const { spreadsheetUrl, spreadsheetName, ultimaSync, atualizando, atualizar } = useSync();
  const [reparando, setReparando] = useState(false);

  async function reparar() {
    setReparando(true);
    try {
      const resultado = await api.sincronizar();
      push(
        resultado.ajustes > 0
          ? `Planilha revisada: ${resultado.ajustes} linha(s) ajustada(s).`
          : "Planilha revisada. Estava tudo certo."
      );
    } catch (err) {
      push(err.message, "error");
    } finally {
      setReparando(false);
    }
  }

  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold text-ink-primary dark:text-ink-primary-dark">Planilha e sincronização</h2>

      <p className="mt-1 text-xs text-ink-secondary dark:text-ink-secondary-dark">
        Seus dados moram numa Planilha Google
        {spreadsheetName ? <> chamada <strong>{spreadsheetName}</strong></> : null}, na sua conta. O app lê e grava
        nela — e você também pode abrir a planilha e digitar direto por lá. Ao voltar para o app, ele percebe a
        mudança e se atualiza sozinho.
      </p>

      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-xs">
        <div>
          <dt className="text-ink-muted">Última atualização</dt>
          <dd className="font-medium text-ink-primary dark:text-ink-primary-dark">
            {ultimaSync ? ultimaSync.toLocaleString("pt-BR") : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Backup</dt>
          <dd className="font-medium text-ink-primary dark:text-ink-primary-dark">
            Histórico de versões do Google Sheets
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        {spreadsheetUrl && (
          <a href={spreadsheetUrl} target="_blank" rel="noreferrer" className="btn-secondary">
            Abrir a planilha
          </a>
        )}
        <button onClick={atualizar} disabled={atualizando} className="btn-secondary">
          {atualizando ? "Atualizando..." : "Atualizar agora"}
        </button>
        <button onClick={reparar} disabled={reparando} className="btn-secondary">
          {reparando ? "Revisando..." : "Revisar planilha"}
        </button>
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        “Revisar planilha” recria abas ou colunas que tenham sido apagadas sem querer e organiza as linhas que
        você digitou à mão (dando ID, status e cadastrando pessoas novas).
      </p>
    </div>
  );
}

function ManageList({ title, items, placeholder, onAdd, onRemove, pushError }) {
  const [value, setValue] = useState("");
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    try {
      await onAdd(value.trim());
      setValue("");
    } catch (err) {
      pushError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    const alvo = removing;
    setRemoving(null);
    try {
      await onRemove(alvo.id);
    } catch (err) {
      pushError(err.message);
    }
  }

  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold text-ink-primary dark:text-ink-primary-dark">{title}</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 rounded-full border border-line-hairline dark:border-line-hairline-dark py-1 pl-3 pr-1.5 text-sm">
            {item.dot && <span className="h-2 w-2 rounded-full" style={{ background: item.dot }} />}
            <span className="text-ink-primary dark:text-ink-primary-dark">{item.label}</span>
            <button
              onClick={() => setRemoving(item)}
              aria-label={`Remover ${item.label}`}
              className="rounded-full px-1.5 text-ink-muted hover:bg-critical/10 hover:text-critical"
            >
              ×
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="text-sm text-ink-muted">Nenhum item cadastrado.</li>}
      </ul>
      <form onSubmit={handleAdd} className="mt-3 flex gap-2">
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="input" />
        <button type="submit" disabled={busy} className="btn-primary shrink-0">Adicionar</button>
      </form>

      <ConfirmDialog
        open={!!removing}
        title={`Remover "${removing?.label}"`}
        message="Essa ação não pode ser desfeita."
        confirmLabel="Remover"
        danger
        onConfirm={handleRemove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}
