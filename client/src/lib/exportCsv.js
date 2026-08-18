/**
 * Gera o CSV do mês no próprio navegador (com ; e vírgula decimal, do jeito
 * que o Excel brasileiro espera). Antes isso era feito pelo servidor Node;
 * fazendo aqui, o download continua funcionando sem servidor nenhum ligado.
 */

const CABECALHO = ["Data", "Título", "Categoria", "Valor (R$)", "Forma de Pagamento", "Observações"];

function celula(valor) {
  return `"${String(valor ?? "").replace(/"/g, '""')}"`;
}

export function montarCsv(report) {
  const linhas = [CABECALHO.join(";")];

  for (const gasto of report.expenses) {
    linhas.push(
      [
        gasto.date,
        gasto.title,
        gasto.category,
        gasto.amount.toFixed(2).replace(".", ","),
        gasto.paymentMethod,
        gasto.observation,
      ]
        .map(celula)
        .join(";")
    );
  }

  linhas.push(["", "", "", "", "", ""].join(";"));
  linhas.push(["", "", "", "", "TOTAL GERAL", report.totalGeral.toFixed(2).replace(".", ",")].map(celula).join(";"));

  return "﻿" + linhas.join("\r\n"); // BOM: acentos corretos no Excel
}

/**
 * Dispara o download. Devolve false quando o navegador bloqueia (acontece em
 * alguns celulares dentro da janela do Apps Script), para a tela poder sugerir
 * o caminho pela planilha.
 */
export function baixarCsv(report) {
  try {
    const blob = new Blob([montarCsv(report)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Gastos-${report.key}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch (err) {
    return false;
  }
}
