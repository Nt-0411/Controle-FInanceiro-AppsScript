import React from "react";
import { useSync } from "../lib/SyncContext.jsx";

/**
 * Segura a interface enquanto a primeira carga não chega, e mostra um caminho
 * de volta quando ela falha (sem rede, Google fora do ar, planilha sem as abas).
 */
export default function BootGate({ children }) {
  const { fase, erro, atualizar } = useSync();

  if (fase === "carregando") {
    return (
      <Centro>
        <Marca />
        <p className="mt-5 text-sm text-ink-muted">Buscando seus dados na planilha...</p>
        <div className="mt-4 h-1 w-40 overflow-hidden rounded-full bg-line-hairline dark:bg-white/10">
          <div className="h-full w-1/3 animate-[deslizar_1.1s_ease-in-out_infinite] rounded-full bg-brand dark:bg-brand-dark" />
        </div>
      </Centro>
    );
  }

  if (fase === "erro") {
    return (
      <Centro>
        <Marca />
        <h1 className="mt-5 text-base font-semibold text-ink-primary dark:text-ink-primary-dark">
          Não deu para carregar seus dados
        </h1>
        <p className="mt-2 max-w-sm text-sm text-ink-secondary dark:text-ink-secondary-dark">{erro}</p>
        <p className="mt-3 max-w-sm text-xs text-ink-muted">
          Confira a conexão e tente de novo. Se o erro falar em abas ou permissões, abra a planilha e use
          o menu <strong>Controle Financeiro → Configurar / reparar planilha</strong>.
        </p>
        <button onClick={atualizar} className="btn-primary mt-5">
          Tentar de novo
        </button>
      </Centro>
    );
  }

  return children;
}

function Centro({ children }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-page dark:bg-surface-page-dark p-6 text-center">
      {children}
    </div>
  );
}

function Marca() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand dark:bg-brand-dark text-lg font-bold text-white">
        R$
      </div>
      <div className="text-left">
        <p className="text-sm font-semibold text-ink-primary dark:text-ink-primary-dark leading-tight">
          Controle Financeiro
        </p>
        <p className="text-xs text-ink-muted leading-tight">na sua conta Google</p>
      </div>
    </div>
  );
}
