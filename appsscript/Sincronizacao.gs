/**
 * Sincronizacao entre o app e a planilha.
 *
 * A ideia e simples: existe um numero de revisao que sobe a cada mudanca nos
 * dados, venha ela do app (celular) ou de uma edicao feita a mao na planilha
 * (Google Sheets). O app guarda a ultima revisao que viu e, sempre que e
 * aberto/reaberto, pergunta "mudou alguma coisa?" — uma chamada baratissima.
 * So recarrega tudo quando a resposta e sim.
 */

const CHAVE_REV = 'revisao';
const GATILHO_ALTERACAO = 'aoAlterarPlanilha';

let ALTERACAO_PENDENTE_ = false;

/** Marca que esta requisicao mexeu nos dados; a revisao sobe uma unica vez no fim. */
function marcarAlteracao_() {
  ALTERACAO_PENDENTE_ = true;
}

function revisaoAtual() {
  const props = PropertiesService.getDocumentProperties();
  const atual = props.getProperty(CHAVE_REV);
  if (!atual) {
    props.setProperty(CHAVE_REV, '1');
    return '1';
  }
  return atual;
}

function novaRevisao_() {
  const props = PropertiesService.getDocumentProperties();
  const atual = Number(props.getProperty(CHAVE_REV)) || 0;
  const nova = String(atual + 1);
  props.setProperty(CHAVE_REV, nova);
  return nova;
}

function persistirRevisao_() {
  if (!ALTERACAO_PENDENTE_) return revisaoAtual();
  ALTERACAO_PENDENTE_ = false;
  return novaRevisao_();
}

/**
 * Gatilho instalavel: dispara quando alguem edita a planilha direto no Google
 * Sheets. E o que faz o app perceber, ao ser aberto, que a planilha mudou.
 */
function aoAlterarPlanilha(e) {
  // Mesma trava que o app usa: o gatilho e a abertura do app podem cair juntos
  // na mesma linha recem-digitada, e os dois querem consertá-la.
  const trava = LockService.getDocumentLock();
  if (!trava.tryLock(20000)) return;

  try {
    limparMemo_();
    garantirIntegridade_();
  } catch (err) {
    Logger.log('Falha ao normalizar apos edicao manual: ' + err);
  } finally {
    trava.releaseLock();
    limparMemo_();
  }

  // Uma edição feita à mão sempre conta como mudança, mesmo que não tenha
  // sobrado nada para consertar — é assim que o app sabe que precisa recarregar.
  marcarAlteracao_();
  persistirRevisao_();
}

function instalarGatilhos() {
  const existentes = ScriptApp.getProjectTriggers();
  for (const gatilho of existentes) {
    if (gatilho.getHandlerFunction() === GATILHO_ALTERACAO) return; // ja instalado
  }
  ScriptApp.newTrigger(GATILHO_ALTERACAO)
    .forSpreadsheet(planilha_())
    .onChange()
    .create();
}

// ---------------------------------------------------------------------------
// Menu dentro da planilha
// ---------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('💰 Controle Financeiro')
    .addItem('Abrir aplicativo', 'mostrarLinkAplicativo')
    .addSeparator()
    .addItem('Configurar / reparar planilha', 'configurar')
    .addItem('Importar dados de um arquivo JSON', 'importarDadosIniciais')
    .addToUi();
}

function urlAplicativo_() {
  try {
    return ScriptApp.getService().getUrl() || '';
  } catch (err) {
    return '';
  }
}

function mostrarLinkAplicativo() {
  const url = urlAplicativo_();
  const ui = SpreadsheetApp.getUi();

  if (!url) {
    ui.alert(
      'Aplicativo ainda nao publicado',
      'Va em Implantar > Nova implantacao > Aplicativo da Web ' +
      '(Executar como: Eu | Quem tem acesso: Somente eu) e clique em Implantar.',
      ui.ButtonSet.OK
    );
    return;
  }

  const html = HtmlService.createHtmlOutput(
    '<div style="font:14px system-ui;padding:16px 18px;line-height:1.5">' +
    '<p style="margin:0 0 14px">Abra o app e adicione a pagina a tela inicial do celular:</p>' +
    '<p style="margin:0 0 16px"><a href="' + url + '" target="_blank" ' +
    'style="display:inline-block;background:#2a78d6;color:#fff;padding:9px 16px;' +
    'border-radius:8px;text-decoration:none;font-weight:600">Abrir Controle Financeiro</a></p>' +
    '<p style="margin:0;color:#64748b;font-size:12px;word-break:break-all">' + url + '</p>' +
    '</div>'
  ).setWidth(430).setHeight(190);

  ui.showModalDialog(html, 'Controle Financeiro');
}

// ---------------------------------------------------------------------------
// Configuracao inicial
// ---------------------------------------------------------------------------

/**
 * Roda uma vez (ou sempre que quiser reparar): cria as abas, semeia os
 * padroes, importa a carga inicial (se houver) e liga o gatilho de sincronizacao.
 */
function configurar() {
  garantirEstrutura();
  instalarGatilhos();
  importarDadosIniciais();
  garantirIntegridade_();

  const url = urlAplicativo_();
  const mensagem = url
    ? 'Planilha pronta e sincronizacao ligada.\n\nApp: ' + url
    : 'Planilha pronta e sincronizacao ligada.\n\n' +
      'Falta publicar: Implantar > Nova implantacao > Aplicativo da Web.';

  try {
    SpreadsheetApp.getUi().alert('Controle Financeiro', mensagem, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (err) {
    Logger.log(mensagem); // rodando sem interface (pelo editor de scripts)
  }
}
