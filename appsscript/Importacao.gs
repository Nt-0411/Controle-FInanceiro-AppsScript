/**
 * Importa uma unica vez uma carga de dados vinda de fora — util para quem ja
 * controlava os gastos em outro lugar e nao quer digitar tudo de novo.
 * O conteudo fica em DadosIniciais.gs, gerado pelo comando `npm run dados`.
 *
 * Roda sozinho dentro de configurar(). Rodar de novo nao duplica nada: gastos,
 * dividas e pessoas so entram se a aba estiver vazia, e categorias/formas sao
 * mescladas pelo nome.
 */

const CHAVE_IMPORTADO = 'dadosImportados';

function importarDadosIniciais() {
  const dados = typeof DADOS_INICIAIS !== 'undefined' ? DADOS_INICIAIS : null;

  if (!dados) {
    avisar_('Nenhum dado para importar (DadosIniciais.gs está vazio).');
    return { importado: false, motivo: 'sem-dados' };
  }

  const props = PropertiesService.getDocumentProperties();
  if (props.getProperty(CHAVE_IMPORTADO)) {
    avisar_('Esses dados já haviam sido importados. Nada foi alterado.');
    return { importado: false, motivo: 'ja-importado' };
  }

  garantirEstrutura();
  limparMemo_();

  const resumo = {
    categorias: mesclarPorNome_('categorias', (dados.categories || []).map((c) => ({
      Nome: c.name,
      Cor: c.color || '#64748b',
    }))),
    formas: mesclarPorNome_('formas', (dados.paymentMethods || []).map((p) => ({ Nome: p.name }))),
    pessoas: 0,
    gastos: 0,
    dividas: 0,
  };

  const nomePorId = {};
  for (const pessoa of dados.people || []) nomePorId[pessoa.id] = pessoa.name;

  if (tabela_('pessoas').length === 0) {
    resumo.pessoas = escreverLote_('pessoas', (dados.people || []).map((p) => [p.id, p.name]));
  }

  if (tabela_('gastos').length === 0) {
    resumo.gastos = escreverLote_('gastos', (dados.expenses || []).map((g) => [
      g.id,
      paraDataCelula_(g.date),
      g.title || '',
      g.category || '',
      Number(g.amount) || 0,
      g.paymentMethod || '',
      g.observation || '',
      g.createdAt || '',
    ]));
  }

  if (tabela_('dividas').length === 0) {
    resumo.dividas = escreverLote_('dividas', (dados.debts || []).map((d) => [
      d.id,
      nomePorId[d.personId] || '',
      TIPO_DIVIDA[d.direction] || TIPO_DIVIDA.a_receber,
      d.title || '',
      Number(d.amount) || 0,
      Number(d.paidAmount) || 0,
      paraDataCelula_(d.date),
      STATUS_DIVIDA[d.status] || STATUS_DIVIDA.pending,
      d.observation || '',
      d.createdAt || '',
      d.paidAt || '',
    ]));
  }

  props.setProperty(CHAVE_IMPORTADO, new Date().toISOString());
  limparMemo_();
  garantirIntegridade_();
  novaRevisao_();

  avisar_(
    'Importação concluída:\n\n' +
    resumo.gastos + ' gastos\n' +
    resumo.dividas + ' dívidas\n' +
    resumo.pessoas + ' pessoas\n' +
    resumo.categorias + ' categorias novas\n' +
    resumo.formas + ' formas de pagamento novas'
  );

  return { importado: true, resumo: resumo };
}

/** Acrescenta so o que ainda nao existe (comparando pelo nome, sem diferenciar maiusculas). */
function mesclarPorNome_(chave, itens) {
  if (!itens.length) return 0;

  const existentes = {};
  for (const linha of tabela_(chave)) {
    const nome = texto_(linha.Nome);
    if (nome) existentes[nome.toLowerCase()] = true;
  }

  const novos = itens.filter((item) => {
    const nome = texto_(item.Nome);
    return nome && !existentes[nome.toLowerCase()];
  });
  if (!novos.length) return 0;

  let id = proximoId_(chave);
  const colunas = COLUNAS[chave];
  const linhas = novos.map((item) => {
    const linha = colunas.map((coluna) => (coluna === 'ID' ? id : item[coluna] !== undefined ? item[coluna] : ''));
    id++;
    return linha;
  });

  const alvo = aba_(chave);
  alvo.getRange(alvo.getLastRow() + 1, 1, linhas.length, colunas.length).setValues(linhas);
  delete MEMO_[chave];
  return linhas.length;
}

function escreverLote_(chave, linhas) {
  if (!linhas.length) return 0;
  const alvo = aba_(chave);
  alvo.getRange(alvo.getLastRow() + 1, 1, linhas.length, COLUNAS[chave].length).setValues(linhas);
  delete MEMO_[chave];
  return linhas.length;
}

function avisar_(mensagem) {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.alert('Controle Financeiro', mensagem, ui.ButtonSet.OK);
  } catch (err) {
    Logger.log(mensagem);
  }
}

/**
 * Escotilha de emergencia: libera uma nova importacao (nao apaga nada sozinho —
 * limpe as abas a mao antes, se for o caso).
 */
function permitirNovaImportacao() {
  PropertiesService.getDocumentProperties().deleteProperty(CHAVE_IMPORTADO);
  avisar_('Pronto. A próxima "Importar dados de um arquivo JSON" vai rodar de novo.');
}
