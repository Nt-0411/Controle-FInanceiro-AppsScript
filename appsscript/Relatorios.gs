/**
 * Relatorios mensais e tendencia — os mesmos numeros que o app ja mostrava.
 * A exportacao agora e nativa do Google: em vez de gerar um .xlsx no servidor,
 * o relatorio vira uma aba formatada na propria planilha, que voce abre no
 * celular e baixa em Excel/PDF pelo proprio Sheets se quiser.
 */

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const ABA_RELATORIO = 'Relatório';

function rotuloMes_(chave) {
  const partes = String(chave).split('-');
  const ano = Number(partes[0]);
  const mes = Number(partes[1]);
  if (!ano || !mes) return chave;
  return MESES_PT[mes - 1] + ' de ' + ano;
}

function relatorioMensal_(mes, ano) {
  const chave = ano + '-' + ('0' + mes).slice(-2);

  const lista = gastos_()
    .filter((g) => chaveMes_(g.date) === chave)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id))
    .map(semLinha_);

  const totalGeral = arredondar2_(lista.reduce((soma, g) => soma + g.amount, 0));

  return {
    key: chave,
    label: rotuloMes_(chave),
    expenses: lista,
    totalGeral: totalGeral,
    byCategory: agrupar_(lista, 'category', 'category', totalGeral),
    byPaymentMethod: agrupar_(lista, 'paymentMethod', 'method', totalGeral),
  };
}

function agrupar_(lista, campo, nomeSaida, totalGeral) {
  const totais = {};
  const ordem = [];

  for (const item of lista) {
    const chave = item[campo] || '(sem)';
    if (!(chave in totais)) {
      totais[chave] = 0;
      ordem.push(chave);
    }
    totais[chave] += item.amount;
  }

  return ordem
    .map((chave) => {
      const total = arredondar2_(totais[chave]);
      const linha = { total: total, percent: totalGeral ? arredondar2_((total / totalGeral) * 100) : 0 };
      linha[nomeSaida] = chave;
      return linha;
    })
    .sort((a, b) => b.total - a.total);
}

function tendencia_(meses) {
  const quantidade = Math.min(Number(meses) || 6, 24);
  const hoje = new Date();
  const lista = gastos_();
  const serie = [];

  for (let i = quantidade - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const chave = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
    const total = arredondar2_(
      lista.filter((g) => chaveMes_(g.date) === chave).reduce((soma, g) => soma + g.amount, 0)
    );
    serie.push({ key: chave, label: rotuloMes_(chave), total: total });
  }

  return serie;
}

// ---------------------------------------------------------------------------
// Relatorio como aba da planilha
// ---------------------------------------------------------------------------

/**
 * Escreve (ou reescreve) a aba "Relatório" com o mes pedido e devolve o link
 * direto para ela. Dali o proprio Google Sheets exporta para Excel, PDF ou CSV.
 */
function gerarAbaRelatorio_(mes, ano) {
  const dados = relatorioMensal_(mes, ano);
  const ss = planilha_();

  let alvo = ss.getSheetByName(ABA_RELATORIO);
  if (!alvo) {
    alvo = ss.insertSheet(ABA_RELATORIO);
  } else {
    alvo.clear();
    const filtro = alvo.getFilter();
    if (filtro) filtro.remove();
  }

  const moeda = 'R$ #,##0.00';
  const linhas = [];

  linhas.push(['Relatório de Gastos — ' + dados.label, '', '', '', '', '']);
  linhas.push(['', '', '', '', '', '']);
  linhas.push(['Data', 'Título', 'Categoria', 'Valor (R$)', 'Forma de Pagamento', 'Observações']);

  for (const gasto of dados.expenses) {
    linhas.push([
      paraDataCelula_(gasto.date),
      gasto.title,
      gasto.category,
      gasto.amount,
      gasto.paymentMethod,
      gasto.observation,
    ]);
  }

  const primeiraLinhaDados = 4;
  const totalGastos = dados.expenses.length;
  const linhaTotal = primeiraLinhaDados + totalGastos;

  linhas.push(['', '', 'TOTAL GERAL', dados.totalGeral, '', '']);
  linhas.push(['', '', '', '', '', '']);

  const linhaCategorias = linhas.length + 1;
  linhas.push(['Totais por categoria', '', '', '', '', '']);
  linhas.push(['Categoria', 'Total (R$)', '% do mês', '', '', '']);
  for (const item of dados.byCategory) {
    linhas.push([item.category, item.total, item.percent / 100, '', '', '']);
  }
  linhas.push(['', '', '', '', '', '']);

  const linhaFormas = linhas.length + 1;
  linhas.push(['Totais por forma de pagamento', '', '', '', '', '']);
  linhas.push(['Forma de Pagamento', 'Total (R$)', '% do mês', '', '', '']);
  for (const item of dados.byPaymentMethod) {
    linhas.push([item.method, item.total, item.percent / 100, '', '', '']);
  }

  alvo.getRange(1, 1, linhas.length, 6).setValues(linhas);

  // Titulo
  alvo.getRange(1, 1, 1, 6).merge().setFontSize(14).setFontWeight('bold');

  // Tabela principal
  estilizarCabecalho_(alvo.getRange(3, 1, 1, 6));
  if (totalGastos > 0) {
    alvo.getRange(primeiraLinhaDados, 1, totalGastos, 1).setNumberFormat('yyyy-mm-dd');
    alvo.getRange(primeiraLinhaDados, 4, totalGastos, 1).setNumberFormat(moeda);
    alvo.getRange(3, 1, totalGastos + 1, 6).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
  }
  alvo.getRange(linhaTotal, 1, 1, 6).setFontWeight('bold').setBackground('#e2e8f0');
  alvo.getRange(linhaTotal, 4).setNumberFormat(moeda);

  // Resumos
  estilizarSecao_(alvo, linhaCategorias, dados.byCategory.length, moeda);
  estilizarSecao_(alvo, linhaFormas, dados.byPaymentMethod.length, moeda);

  const larguras = [110, 260, 150, 120, 170, 300];
  larguras.forEach((largura, idx) => alvo.setColumnWidth(idx + 1, largura));
  alvo.setFrozenRows(3);

  ss.setActiveSheet(alvo);

  return {
    label: dados.label,
    total: dados.totalGeral,
    lancamentos: totalGastos,
    url: ss.getUrl() + '#gid=' + alvo.getSheetId(),
  };
}

function estilizarCabecalho_(intervalo) {
  intervalo.setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
}

function estilizarSecao_(alvo, linhaTitulo, quantidade, moeda) {
  alvo.getRange(linhaTitulo, 1, 1, 3).merge().setFontWeight('bold').setFontSize(11);
  estilizarCabecalho_(alvo.getRange(linhaTitulo + 1, 1, 1, 3));
  if (quantidade > 0) {
    alvo.getRange(linhaTitulo + 2, 2, quantidade, 1).setNumberFormat(moeda);
    alvo.getRange(linhaTitulo + 2, 3, quantidade, 1).setNumberFormat('0.0%');
  }
}
