import { useEffect, useRef, useState } from "react";

const LIMITE = 70; // px de arrasto para disparar a atualização
const MAXIMO = 110; // até onde o indicador acompanha o dedo

/**
 * Puxar a tela para baixo (estando no topo da página) para atualizar — o gesto
 * que todo mundo já tenta por reflexo no celular.
 */
export function usePullToRefresh(aoAtualizar, ativo = true) {
  const [distancia, setDistancia] = useState(0);
  const acaoRef = useRef(aoAtualizar);
  acaoRef.current = aoAtualizar;

  useEffect(() => {
    if (!ativo) return undefined;

    let inicioY = null;
    let atual = 0;

    const noTopo = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

    const registrar = (valor) => {
      atual = valor;
      setDistancia(valor);
    };

    function aoTocar(e) {
      if (e.touches.length !== 1 || !noTopo()) return;
      inicioY = e.touches[0].clientY;
    }

    function aoArrastar(e) {
      if (inicioY === null) return;
      const delta = e.touches[0].clientY - inicioY;

      // Rolando para cima ou já saiu do topo: cancela o gesto
      if (delta <= 0 || !noTopo()) {
        inicioY = null;
        if (atual) registrar(0);
        return;
      }

      // Resistência: quanto mais puxa, mais devagar o indicador anda
      registrar(Math.min(delta * 0.5, MAXIMO));
    }

    function aoSoltar() {
      if (inicioY === null) return;
      inicioY = null;
      const disparar = atual >= LIMITE;
      registrar(0);
      if (disparar) acaoRef.current();
    }

    window.addEventListener("touchstart", aoTocar, { passive: true });
    window.addEventListener("touchmove", aoArrastar, { passive: true });
    window.addEventListener("touchend", aoSoltar, { passive: true });
    window.addEventListener("touchcancel", aoSoltar, { passive: true });

    return () => {
      window.removeEventListener("touchstart", aoTocar);
      window.removeEventListener("touchmove", aoArrastar);
      window.removeEventListener("touchend", aoSoltar);
      window.removeEventListener("touchcancel", aoSoltar);
    };
  }, [ativo]);

  return { distancia, pronto: distancia >= LIMITE };
}
