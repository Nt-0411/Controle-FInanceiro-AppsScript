import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, aoMudarRevisao } from "./api.js";
import { useMonth } from "./MonthContext.jsx";

/**
 * Rotina de atualização.
 *
 * O app inteiro trabalha em cima de uma única fotografia dos dados, buscada de
 * uma vez só (`api.estado`). Como cada ida ao Apps Script custa quase um
 * segundo, isso deixa a navegação instantânea depois que o app abre.
 *
 * A fotografia é renovada quando:
 *   • o app abre;
 *   • você volta para ele (troca de aba, desbloqueia o celular, reabre o atalho);
 *   • o celular reconecta à internet;
 *   • a cada 60s com o app em primeiro plano;
 *   • você registra/edita/apaga qualquer coisa;
 *   • você puxa a tela para baixo, ou toca em "Atualizar".
 *
 * As verificações periódicas não baixam tudo: perguntam só o número de revisão
 * (resposta minúscula) e, se ele mudou — seja porque você mexeu na planilha
 * pelo Google, seja por outro aparelho — aí sim recarregam.
 */

const SyncContext = createContext(null);

const INTERVALO_VERIFICACAO = 60_000;

export function SyncProvider({ children }) {
  const { month, year } = useMonth();

  const [dados, setDados] = useState(null);
  const [fase, setFase] = useState("carregando"); // carregando | pronto | erro
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState("");
  const [ultimaSync, setUltimaSync] = useState(null);

  const carregandoRef = useRef(false);
  const pendenteRef = useRef(false);
  const temDadosRef = useRef(false);

  const carregar = useCallback(
    async ({ silencioso = false } = {}) => {
      if (carregandoRef.current) {
        pendenteRef.current = true;
        return;
      }
      carregandoRef.current = true;
      if (silencioso) setAtualizando(true);

      try {
        const novo = await api.estado(month, year);
        setDados(novo);
        temDadosRef.current = true;
        setUltimaSync(new Date());
        setErro("");
        setFase("pronto");
      } catch (err) {
        setErro(err.message);
        if (!temDadosRef.current) setFase("erro");
      } finally {
        carregandoRef.current = false;
        setAtualizando(false);
        if (pendenteRef.current) {
          pendenteRef.current = false;
          carregar({ silencioso: true });
        }
      }
    },
    [month, year]
  );

  /** Pergunta barata: "mudou alguma coisa desde a última vez?" */
  const verificar = useCallback(async () => {
    if (carregandoRef.current || !temDadosRef.current) return;
    try {
      // A resposta atualiza a revisão conhecida; se ela mudou, o assinante
      // registrado abaixo dispara o recarregamento.
      await api.revisao();
    } catch (err) {
      // Sem rede ou Google fora do ar: tenta de novo na próxima oportunidade.
    }
  }, []);

  // Recarrega quando o mês muda (e na primeira montagem)
  useEffect(() => {
    carregar();
  }, [carregar]);

  // Qualquer resposta com revisão diferente da conhecida cai aqui — inclusive
  // as respostas de cadastro/edição, o que dispensa cada tela recarregar sozinha.
  useEffect(
    () =>
      aoMudarRevisao(() => {
        if (carregandoRef.current) return; // o resultado em andamento já é mais novo
        carregar({ silencioso: true });
      }),
    [carregar]
  );

  // Voltar ao app, reconectar e batida periódica
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === "visible") verificar();
    };

    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", verificar);
    window.addEventListener("online", verificar);
    const timer = setInterval(aoVoltar, INTERVALO_VERIFICACAO);

    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", verificar);
      window.removeEventListener("online", verificar);
      clearInterval(timer);
    };
  }, [verificar]);

  const valor = {
    dados,
    fase,
    erro,
    atualizando,
    ultimaSync,

    // Atalhos para o que as telas usam
    report: dados?.report ?? null,
    trend: dados?.trend ?? [],
    debts: dados?.debts ?? [],
    debtsSummary: dados?.debtsSummary ?? { aReceber: 0, aPagar: 0, saldo: 0 },
    categories: dados?.categories ?? [],
    paymentMethods: dados?.paymentMethods ?? [],
    people: dados?.people ?? [],
    spreadsheetUrl: dados?.spreadsheetUrl ?? "",
    spreadsheetName: dados?.spreadsheetName ?? "",

    atualizar: () => carregar({ silencioso: true }),
    verificar,
  };

  return <SyncContext.Provider value={valor}>{children}</SyncContext.Provider>;
}

export function useSync() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync deve ser usado dentro de SyncProvider");
  return ctx;
}
