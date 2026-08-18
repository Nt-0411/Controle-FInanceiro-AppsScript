/**
 * Camada de dados: a Planilha Google e o banco de dados do app.
 *
 * Cada colecao vira uma aba com cabecalho em portugues, para que a planilha
 * continue legivel e editavel a mao pelo Google Sheets (celular ou navegador).
 * O app le e escreve nessas mesmas abas, entao os dois lados enxergam sempre
 * a mesma verdade.
 */

const ABAS = {
  gastos: 'Gastos',
  dividas: 'Dívidas',
  pessoas: 'Pessoas',
  categorias: 'Categorias',
  formas: 'Formas de Pagamento',
  config: '_Config',
};

const COLUNAS = {
  gastos: ['ID', 'Data', 'Título', 'Categoria', 'Valor', 'Forma de Pagamento', 'Observação', 'Criado em'],
  dividas: ['ID', 'Pessoa', 'Tipo', 'Título', 'Valor', 'Valor Pago', 'Data', 'Status', 'Observação', 'Criado em', 'Quitado em'],
  pessoas: ['ID', 'Nome'],
  categorias: ['ID', 'Nome', 'Cor'],
  formas: ['ID', 'Nome'],
  config: ['Chave', 'Valor'],
};

const LARGURAS = {
  gastos: [60, 110, 240, 150, 110, 160, 280, 160],
  dividas: [60, 150, 110, 220, 110, 110, 110, 110, 260, 160, 160],
  pessoas: [60, 220],
  categorias: [60, 200, 100],
  formas: [60, 200],
  config: [220, 320],
};

/** Rotulos legiveis na planilha <-> codigos usados pelo app. */
const TIPO_DIVIDA = { a_receber: 'Me devem', a_pagar: 'Eu devo' };
const STATUS_DIVIDA = { pending: 'Em aberto', paid: 'Quitada' };

const CATEGORIAS_PADRAO = [
  { nome: 'Alimentação', cor: '#f97316' },
  { nome: 'Mercado', cor: '#84cc16' },
  { nome: 'Moradia', cor: '#0ea5e9' },
  { nome: 'Contas Fixas', cor: '#6366f1' },
  { nome: 'Transporte', cor: '#eab308' },
  { nome: 'Veículo', cor: '#f59e0b' },
  { nome: 'Saúde', cor: '#ef4444' },
  { nome: 'Lazer', cor: '#ec4899' },
  { nome: 'Vestuário', cor: '#a855f7' },
  { nome: 'Educação', cor: '#14b8a6' },
  { nome: 'Outros', cor: '#64748b' },
];

const FORMAS_PADRAO = ['Pix', 'Débito', 'Crédito', 'Dinheiro', 'Boleto'];

// ---------------------------------------------------------------------------
// Acesso basico
// ---------------------------------------------------------------------------

function planilha_() {
  const ss = SpreadsheetApp.getActive();
  if (!ss) {
    throw new Error(
      'Este script precisa estar vinculado a uma Planilha Google. ' +
      'Abra a planilha, va em Extensoes > Apps Script e use o projeto de la.'
    );
  }
  return ss;
}

function fusoHorario_() {
  return planilha_().getSpreadsheetTimeZone() || 'America/Sao_Paulo';
}

function aba_(chave) {
  const nome = ABAS[chave];
  let alvo = planilha_().getSheetByName(nome);
  if (!alvo) {
    garantirEstrutura();
    alvo = planilha_().getSheetByName(nome);
  }
  return alvo;
}

/**
 * Memoria por execucao: evita reler a mesma aba varias vezes dentro de uma
 * unica chamada da API (o carregamento inicial toca 5 abas de uma vez so).
 */
let MEMO_ = {};

function limparMemo_() {
  MEMO_ = {};
}

/**
 * Le uma aba inteira como lista de objetos indexados pelo nome da coluna.
 * Cada item carrega `_linha` (numero da linha na planilha) para permitir
 * atualizacao/remocao cirurgica depois.
 */
function tabela_(chave) {
  if (MEMO_[chave]) return MEMO_[chave];

  const alvo = aba_(chave);
  const colunas = COLUNAS[chave];
  const ultimaLinha = alvo.getLastRow();
  const linhas = [];

  if (ultimaLinha > 1) {
    const valores = alvo.getRange(2, 1, ultimaLinha - 1, colunas.length).getValues();
    for (let i = 0; i < valores.length; i++) {
      const bruta = valores[i];
      if (bruta.every((celula) => celula === '' || celula === null)) continue;
      const item = { _linha: i + 2 };
      colunas.forEach((nome, idx) => {
        item[nome] = bruta[idx];
      });
      linhas.push(item);
    }
  }

  MEMO_[chave] = linhas;
  return linhas;
}

function proximoId_(chave) {
  const linhas = tabela_(chave);
  let maior = 0;
  for (const linha of linhas) {
    const id = Number(linha.ID);
    if (Number.isFinite(id) && id > maior) maior = id;
  }
  return maior + 1;
}

function acrescentar_(chave, valoresPorColuna) {
  const alvo = aba_(chave);
  const colunas = COLUNAS[chave];
  const linha = colunas.map((nome) => {
    const valor = valoresPorColuna[nome];
    return valor === undefined || valor === null ? '' : valor;
  });
  alvo.appendRow(linha);
  delete MEMO_[chave];
  marcarAlteracao_();
  return alvo.getLastRow();
}

function atualizar_(chave, numeroLinha, valoresPorColuna) {
  const alvo = aba_(chave);
  const colunas = COLUNAS[chave];
  const atuais = alvo.getRange(numeroLinha, 1, 1, colunas.length).getValues()[0];
  const linha = colunas.map((nome, idx) => {
    if (!(nome in valoresPorColuna)) return atuais[idx];
    const valor = valoresPorColuna[nome];
    return valor === undefined || valor === null ? '' : valor;
  });
  alvo.getRange(numeroLinha, 1, 1, colunas.length).setValues([linha]);
  delete MEMO_[chave];
  marcarAlteracao_();
}

function remover_(chave, numeroLinha) {
  aba_(chave).deleteRow(numeroLinha);
  delete MEMO_[chave];
  marcarAlteracao_();
}

// ---------------------------------------------------------------------------
// Conversores (planilha <-> app)
// ---------------------------------------------------------------------------

function ehData_(valor) {
  return Object.prototype.toString.call(valor) === '[object Date]' && !isNaN(valor.getTime());
}

/** Converte o que veio da celula de data para o texto AAAA-MM-DD do app. */
function paraDataTexto_(valor) {
  if (valor === '' || valor === null || valor === undefined) return '';
  if (ehData_(valor)) return Utilities.formatDate(valor, fusoHorario_(), 'yyyy-MM-dd');

  const texto = String(valor).trim();
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const br = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return br[3] + '-' + ('0' + br[2]).slice(-2) + '-' + ('0' + br[1]).slice(-2);
  return texto;
}

/** Converte AAAA-MM-DD em Date real, para a planilha ordenar/filtrar direito. */
function paraDataCelula_(texto) {
  const partes = String(texto || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!partes) return texto || '';
  return new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
}

function paraDataHoraTexto_(valor) {
  if (!valor) return null;
  if (ehData_(valor)) return valor.toISOString();
  return String(valor);
}

function paraNumero_(valor) {
  if (typeof valor === 'number') return valor;
  const texto = String(valor === undefined || valor === null ? '' : valor).trim();
  if (!texto) return NaN;
  // Aceita "1.234,56" (padrao BR) e "1234.56"
  const limpo = texto.replace(/[R$\s]/g, '');
  const normalizado = limpo.indexOf(',') >= 0 ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : NaN;
}

function arredondar2_(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function texto_(valor) {
  return valor === undefined || valor === null ? '' : String(valor).trim();
}

/** Aceita tanto o rotulo da planilha ("Me devem") quanto o codigo ("a_receber"). */
function rotuloParaCodigo_(mapa, valor, padrao) {
  const alvo = texto_(valor).toLowerCase();
  const chaves = Object.keys(mapa);
  for (const codigo of chaves) {
    if (codigo.toLowerCase() === alvo) return codigo;
    if (mapa[codigo].toLowerCase() === alvo) return codigo;
  }
  return padrao;
}

// ---------------------------------------------------------------------------
// Estrutura da planilha
// ---------------------------------------------------------------------------

/**
 * Cria (ou conserta) todas as abas, cabecalhos, formatos e validacoes.
 * Pode rodar quantas vezes quiser: nunca apaga dados existentes.
 */
function garantirEstrutura() {
  const ss = planilha_();

  const chaves = Object.keys(ABAS);
  for (const chave of chaves) {
    const nome = ABAS[chave];
    let alvo = ss.getSheetByName(nome);
    if (!alvo) alvo = ss.insertSheet(nome);

    const colunas = COLUNAS[chave];
    if (alvo.getMaxColumns() < colunas.length) {
      alvo.insertColumnsAfter(alvo.getMaxColumns(), colunas.length - alvo.getMaxColumns());
    }

    const cabecalhoAtual = alvo.getRange(1, 1, 1, colunas.length).getValues()[0];
    const precisaCabecalho = colunas.some((c, i) => texto_(cabecalhoAtual[i]) !== c);
    if (precisaCabecalho) alvo.getRange(1, 1, 1, colunas.length).setValues([colunas]);

    alvo.getRange(1, 1, 1, colunas.length)
      .setFontWeight('bold')
      .setBackground('#1e293b')
      .setFontColor('#ffffff');
    alvo.setFrozenRows(1);

    LARGURAS[chave].forEach((largura, idx) => alvo.setColumnWidth(idx + 1, largura));

    if (alvo.getMaxColumns() > colunas.length) {
      alvo.deleteColumns(colunas.length + 1, alvo.getMaxColumns() - colunas.length);
    }

    if (chave === 'config' && !alvo.isSheetHidden() && ss.getSheets().length > 1) alvo.hideSheet();
  }

  limparMemo_();
  formatarColunas_();
  aplicarValidacoes_();
  semearPadroes_();
  removerAbaVazia_(ss);

  marcarAlteracao_();
}

function removerAbaVazia_(ss) {
  const nomes = ['Página1', 'Sheet1', 'Planilha1'];
  for (const nome of nomes) {
    const sobra = ss.getSheetByName(nome);
    if (sobra && ss.getSheets().length > 1 && sobra.getLastRow() === 0) {
      ss.deleteSheet(sobra);
      return;
    }
  }
}

function formatarColunas_() {
  const moeda = 'R$ #,##0.00';
  const data = 'yyyy-mm-dd';

  const gastos = aba_('gastos');
  const linhasGastos = Math.max(gastos.getMaxRows() - 1, 1);
  gastos.getRange(2, 2, linhasGastos, 1).setNumberFormat(data);
  gastos.getRange(2, 5, linhasGastos, 1).setNumberFormat(moeda);

  const dividas = aba_('dividas');
  const linhasDividas = Math.max(dividas.getMaxRows() - 1, 1);
  dividas.getRange(2, 5, linhasDividas, 2).setNumberFormat(moeda);
  dividas.getRange(2, 7, linhasDividas, 1).setNumberFormat(data);
}

function aplicarValidacoes_() {
  const dividas = aba_('dividas');
  const linhas = Math.max(dividas.getMaxRows() - 1, 1);

  const tipos = SpreadsheetApp.newDataValidation()
    .requireValueInList([TIPO_DIVIDA.a_receber, TIPO_DIVIDA.a_pagar], true)
    .setAllowInvalid(false)
    .build();
  dividas.getRange(2, 3, linhas, 1).setDataValidation(tipos);

  const status = SpreadsheetApp.newDataValidation()
    .requireValueInList([STATUS_DIVIDA.pending, STATUS_DIVIDA.paid], true)
    .setAllowInvalid(false)
    .build();
  dividas.getRange(2, 8, linhas, 1).setDataValidation(status);
}

function semearPadroes_() {
  if (tabela_('categorias').length === 0) {
    const alvo = aba_('categorias');
    const linhas = CATEGORIAS_PADRAO.map((c, i) => [i + 1, c.nome, c.cor]);
    alvo.getRange(2, 1, linhas.length, 3).setValues(linhas);
    delete MEMO_.categorias;
  }
  if (tabela_('formas').length === 0) {
    const alvo = aba_('formas');
    const linhas = FORMAS_PADRAO.map((nome, i) => [i + 1, nome]);
    alvo.getRange(2, 1, linhas.length, 2).setValues(linhas);
    delete MEMO_.formas;
  }
}
