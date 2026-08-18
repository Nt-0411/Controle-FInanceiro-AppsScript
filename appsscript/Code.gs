/**
 * Ponto de entrada do aplicativo web.
 *
 * doGet  -> entrega a interface (React empacotada em Index.html)
 * api    -> canal unico de dados, chamado pelo navegador via google.script.run
 *
 * Nao existe senha propria: quem protege o acesso e o login da conta Google.
 * A implantacao usa "Executar como: eu" + "Quem tem acesso: somente eu", entao
 * so a sua conta abre esta URL, de qualquer aparelho, com o PC desligado.
 */

/**
 * Atencao ao mexer aqui: addMetaTag() aceita SO quatro nomes —
 * viewport, mobile-web-app-capable, apple-mobile-web-app-capable e
 * google-site-verification. Qualquer outro derruba a pagina inteira com
 * "A metatag especificada nao e permitida neste contexto".
 *
 * Titulo do atalho e cor da barra ficam nas <meta> do proprio Index.html.
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Controle Financeiro')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .addMetaTag('mobile-web-app-capable', 'yes')
    .addMetaTag('apple-mobile-web-app-capable', 'yes');
}

// ---------------------------------------------------------------------------
// Canal de dados
// ---------------------------------------------------------------------------

/** Acoes que escrevem na planilha (precisam de trava e sobem a revisao). */
const ACOES_DE_ESCRITA = {
  criarGasto: true, atualizarGasto: true, removerGasto: true,
  criarDivida: true, atualizarDivida: true, statusDivida: true,
  pagarDivida: true, removerDivida: true,
  criarCategoria: true, removerCategoria: true,
  criarForma: true, removerForma: true,
  criarPessoa: true, atualizarPessoa: true, removerPessoa: true,
  gerarRelatorio: true, sincronizar: true, estado: true,
};

/**
 * Unica funcao chamada pelo navegador. Devolve sempre uma string JSON no
 * formato { ok, rev, dados } ou { ok: false, erro }.
 */
function api(acao, carga) {
  const dados = carga || {};
  let trava = null;
  let resposta;

  try {
    limparMemo_();

    if (ACOES_DE_ESCRITA[acao]) {
      trava = LockService.getDocumentLock();
      // Espera a vez se o gatilho de edicao manual estiver rodando agora
      if (!trava.tryLock(20000)) {
        throw new Error('A planilha está ocupada. Tente de novo em alguns segundos.');
      }
    }

    resposta = { ok: true, dados: executar_(acao, dados) };
  } catch (err) {
    resposta = { ok: false, erro: (err && err.message) || String(err) };
  } finally {
    // Sobe a revisao aqui, e nao no caminho feliz: se a operacao falhou no meio
    // do caminho, o que ja tinha sido gravado precisa chegar ao app do mesmo jeito.
    try {
      resposta.rev = persistirRevisao_();
    } catch (err) {
      resposta.rev = null;
    }
    if (trava) trava.releaseLock();
    limparMemo_();
  }

  return JSON.stringify(resposta);
}

function executar_(acao, d) {
  switch (acao) {
    // Abertura do app / sincronizacao
    case 'estado': return estado_(d.month, d.year);
    case 'revisao': return { rev: revisaoAtual() };
    case 'sincronizar': return sincronizar_();

    // Gastos
    case 'listarGastos': return listarGastos_(d);
    case 'criarGasto': return criarGasto_(d);
    case 'atualizarGasto': return atualizarGasto_(d.id, d.dados);
    case 'removerGasto': return removerGasto_(d.id);

    // Dividas
    case 'listarDividas': return listarDividas_(d);
    case 'resumoDividas': return resumoDividas_();
    case 'criarDivida': return criarDivida_(d);
    case 'atualizarDivida': return atualizarDivida_(d.id, d.dados);
    case 'statusDivida': return definirStatusDivida_(d.id, d.status);
    case 'pagarDivida': return pagarDivida_(d.id, d.amount);
    case 'removerDivida': return removerDivida_(d.id);

    // Cadastros
    case 'listarCategorias': return listarCategorias_();
    case 'criarCategoria': return criarCategoria_(d);
    case 'removerCategoria': return removerCategoria_(d.id);
    case 'listarFormas': return listarFormas_();
    case 'criarForma': return criarForma_(d);
    case 'removerForma': return removerForma_(d.id);
    case 'listarPessoas': return listarPessoas_();
    case 'criarPessoa': return criarPessoa_(d);
    case 'atualizarPessoa': return atualizarPessoa_(d.id, d.dados);
    case 'removerPessoa': return removerPessoa_(d.id);

    // Relatorios
    case 'relatorioMensal': return relatorioMensal_(d.month, d.year);
    case 'tendencia': return tendencia_(d.months);
    case 'gerarRelatorio': return gerarAbaRelatorio_(d.month, d.year);

    default:
      throw new Error('Ação desconhecida: ' + acao);
  }
}

// ---------------------------------------------------------------------------
// Carga inicial: tudo que o app precisa em uma unica ida ate o servidor
// ---------------------------------------------------------------------------

/**
 * Chamada quando o app abre (e toda vez que ele volta ao primeiro plano e
 * percebe que a revisao mudou). Antes de responder, conserta o que tiver sido
 * digitado a mao na planilha — e a rotina de atualizacao ao abrir.
 */
function estado_(mes, ano) {
  const hoje = new Date();
  const mesAlvo = Number(mes) || hoje.getMonth() + 1;
  const anoAlvo = Number(ano) || hoje.getFullYear();

  garantirIntegridade_();

  return {
    report: relatorioMensal_(mesAlvo, anoAlvo),
    trend: tendencia_(6),
    debts: listarDividas_({}),
    debtsSummary: resumoDividas_(),
    categories: listarCategorias_(),
    paymentMethods: listarFormas_(),
    people: listarPessoas_(),
    spreadsheetUrl: planilha_().getUrl(),
    spreadsheetName: planilha_().getName(),
    appUrl: urlAplicativo_(),
    syncedAt: new Date().toISOString(),
  };
}

/** Reparo manual pedido pelo botao "Sincronizar" dentro do app. */
function sincronizar_() {
  garantirEstrutura();
  const ajustes = garantirIntegridade_();
  return { ajustes: ajustes };
}
