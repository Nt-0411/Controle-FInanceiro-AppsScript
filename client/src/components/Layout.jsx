import React, { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useSync } from "../lib/SyncContext.jsx";
import { usePullToRefresh } from "../lib/usePullToRefresh.js";

const NAV_ITEMS = [
  { to: "/", label: "Painel", icon: HomeIcon, end: true },
  { to: "/gastos", label: "Gastos", icon: ListIcon },
  { to: "/dividas", label: "Dívidas", icon: HandshakeIcon },
  { to: "/relatorios", label: "Relatórios", icon: ChartIcon },
  { to: "/configuracoes", label: "Ajustes", icon: GearIcon },
];

export default function Layout() {
  const { atualizar, atualizando, ultimaSync, erro } = useSync();
  const puxar = useCallback(() => atualizar(), [atualizar]);
  const { distancia, pronto } = usePullToRefresh(puxar, !atualizando);

  return (
    <div className="min-h-screen md:flex">
      <IndicadorPuxar distancia={distancia} pronto={pronto} atualizando={atualizando} />

      <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-line-hairline dark:md:border-line-hairline-dark md:bg-surface dark:md:bg-surface-dark no-print">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand dark:bg-brand-dark text-white font-bold">R$</div>
          <div>
            <p className="text-sm font-semibold text-ink-primary dark:text-ink-primary-dark leading-tight">Controle Financeiro</p>
            <p className="text-xs text-ink-muted leading-tight">na sua conta Google</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand/10 text-brand dark:bg-brand-dark/15 dark:text-brand-dark"
                    : "text-ink-secondary dark:text-ink-secondary-dark hover:bg-surface-page dark:hover:bg-white/5"
                }`
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-line-hairline dark:border-line-hairline-dark p-3">
          <BotaoSincronizar atualizando={atualizando} ultimaSync={ultimaSync} erro={erro} onClick={atualizar} completo />
        </div>
      </aside>

      <div className="flex-1 pb-20 md:pb-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line-hairline dark:border-line-hairline-dark bg-surface/90 dark:bg-surface-dark/90 px-4 py-2 backdrop-blur md:hidden no-print">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand dark:bg-brand-dark text-xs font-bold text-white">R$</div>
            <span className="text-sm font-semibold text-ink-primary dark:text-ink-primary-dark">Controle Financeiro</span>
          </div>
          <BotaoSincronizar atualizando={atualizando} ultimaSync={ultimaSync} erro={erro} onClick={atualizar} />
        </header>

        <main className="mx-auto max-w-6xl px-4 py-5 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex justify-around border-t border-line-hairline dark:border-line-hairline-dark bg-surface dark:bg-surface-dark py-1.5 md:hidden no-print">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[11px] font-medium ${
                isActive ? "text-brand dark:text-brand-dark" : "text-ink-muted"
              }`
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function IndicadorPuxar({ distancia, pronto, atualizando }) {
  if (!distancia && !atualizando) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center no-print"
      style={{ transform: `translateY(${atualizando ? 12 : Math.max(distancia - 20, 0)}px)` }}
    >
      <div className="rounded-full bg-surface dark:bg-surface-dark px-3 py-1.5 shadow-lg">
        <RefreshIcon
          className={`h-4 w-4 text-brand dark:text-brand-dark ${atualizando ? "animate-spin" : ""}`}
          style={{ transform: atualizando ? undefined : `rotate(${distancia * 3}deg)`, opacity: pronto ? 1 : 0.55 }}
        />
      </div>
    </div>
  );
}

function BotaoSincronizar({ atualizando, ultimaSync, erro, onClick, completo }) {
  const rotulo = useTempoRelativo(ultimaSync);

  return (
    <button
      onClick={onClick}
      disabled={atualizando}
      title="Buscar novidades na planilha"
      className={`flex items-center gap-2 rounded-lg text-xs font-medium text-ink-secondary dark:text-ink-secondary-dark disabled:opacity-60 ${
        completo ? "w-full px-3 py-2 hover:bg-surface-page dark:hover:bg-white/5" : "px-2 py-1.5"
      }`}
    >
      <RefreshIcon className={`h-4 w-4 shrink-0 ${atualizando ? "animate-spin text-brand dark:text-brand-dark" : ""}`} />
      <span className={completo ? "text-left" : "sr-only"}>
        {atualizando ? "Atualizando..." : erro ? "Sem conexão" : rotulo ? `Atualizado ${rotulo}` : "Atualizar"}
      </span>
      {erro && !atualizando && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-critical" />}
    </button>
  );
}

/** "agora", "há 3 min", "há 2 h" — re-renderiza sozinho a cada 30s. */
function useTempoRelativo(data) {
  const [, forcar] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => forcar((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  if (!data) return "";
  const segundos = Math.floor((Date.now() - data.getTime()) / 1000);
  if (segundos < 45) return "agora";
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  return data.toLocaleDateString("pt-BR");
}

function RefreshIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" strokeLinecap="round" />
      <path d="M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function HomeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ListIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M8 6h13M8 12h13M8 18h13" strokeLinecap="round" />
      <circle cx="3.5" cy="6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="3.5" cy="18" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
function HandshakeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M2 12l4-4 4 3 4-3 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 12l3 6h4l1-2 2 2h4l3-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChartIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M4 20V10M12 20V4M20 20v-7" strokeLinecap="round" />
      <path d="M2 20h20" strokeLinecap="round" />
    </svg>
  );
}
function GearIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 13.5a7.9 7.9 0 0 0 0-3l1.9-1.5-2-3.4-2.3.6a7.9 7.9 0 0 0-2.6-1.5L14 2h-4l-.4 2.7a7.9 7.9 0 0 0-2.6 1.5l-2.3-.6-2 3.4L4.6 10.5a7.9 7.9 0 0 0 0 3L2.7 15l2 3.4 2.3-.6a7.9 7.9 0 0 0 2.6 1.5L10 22h4l.4-2.7a7.9 7.9 0 0 0 2.6-1.5l2.3.6 2-3.4-1.9-1.5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
