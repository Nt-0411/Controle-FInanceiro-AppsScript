/**
 * Rotina de integridade — o "atualizar ao abrir".
 *
 * A planilha pode ser editada a mao (pelo Google Sheets no celular ou no
 * computador), e nesse caso as linhas novas vem sem ID, sem status, sem
 * "Valor Pago", com a pessoa ainda nao cadastrada... Esta rotina conserta tudo
 * isso e roda em tres momentos:
 *
 *   1. quando o app e aberto ou volta para o primeiro plano (carregarTudo_);
 *   2. quando a planilha e editada direto no Sheets (gatilho onChange);
 *   3. quando voce roda "Configurar / reparar planilha" pelo menu.
 *
 * So escreve quando encontra algo faltando, entao rodar de novo nao custa nada
 * e nao gera um ciclo infinito de gatilhos.
 */

function garantirIntegridade_() {
  let ajustes = 0;

  ajustes += preencherIdsFaltantes_('gastos', (linha) => texto_(linha['Título']) || linha.Valor !== '');
  ajustes += preencherIdsFaltantes_('categorias', (linha) => texto_(linha.Nome));
  ajustes += preencherIdsFaltantes_('formas', (linha) => texto_(linha.Nome));
  ajustes += preencherIdsFaltantes_('pessoas', (linha) => texto_(linha.Nome));
  ajustes += preencherIdsFaltantes_('dividas', (linha) => texto_(linha['Título']) || texto_(linha.Pessoa));

  ajustes += completarDividas_();
  ajustes += normalizarPessoas_();

  if (ajustes > 0) marcarAlteracao_();
  return ajustes;
}

/**
 * Da um ID para toda linha preenchida que ainda nao tem um. Sem isso, uma
 * linha digitada a mao ficaria invisivel para o app.
 */
function preencherIdsFaltantes_(chave, pareceUtil) {
  const linhas = tabela_(chave);
  const pendentes = linhas.filter((linha) => !Number.isFinite(Number(linha.ID)) || texto_(linha.ID) === '');
  const alvos = pendentes.filter(pareceUtil);
  if (!alvos.length) return 0;

  let id = proximoId_(chave);
  const alvo = aba_(chave);
  for (const linha of alvos) {
    alvo.getRange(linha._linha, 1).setValue(id);
    linha.ID = id;
    id++;
  }

  delete MEMO_[chave];
  return alvos.length;
}

/** Completa os campos que o app precisa nas dividas digitadas a mao. */
function completarDividas_() {
  const alvo = aba_('dividas');
  let ajustes = 0;

  for (const linha of tabela_('dividas')) {
    if (!texto_(linha['Título']) && !texto_(linha.Pessoa)) continue;

    const mudancas = {};

    if (!texto_(linha.Tipo)) mudancas.Tipo = TIPO_DIVIDA.a_receber;
    if (!texto_(linha.Status)) mudancas.Status = STATUS_DIVIDA.pending;
    if (texto_(linha['Valor Pago']) === '') mudancas['Valor Pago'] = 0;
    if (!texto_(linha['Criado em'])) mudancas['Criado em'] = new Date().toISOString();
    if (!texto_(linha.Data)) mudancas.Data = paraDataCelula_(hojeTexto_());

    // Quitada no olho (Valor Pago >= Valor) mas ainda marcada como em aberto
    const valor = paraNumero_(linha.Valor) || 0;
    const pago = paraNumero_(mudancas['Valor Pago'] !== undefined ? mudancas['Valor Pago'] : linha['Valor Pago']) || 0;
    const status = rotuloParaCodigo_(STATUS_DIVIDA, mudancas.Status || linha.Status, 'pending');
    if (valor > 0 && pago >= valor - 0.001 && status !== 'paid') {
      mudancas.Status = STATUS_DIVIDA.paid;
      if (!texto_(linha['Quitado em'])) mudancas['Quitado em'] = new Date().toISOString();
    }

    if (Object.keys(mudancas).length === 0) continue;

    const colunas = COLUNAS.dividas;
    const atuais = alvo.getRange(linha._linha, 1, 1, colunas.length).getValues()[0];
    const novaLinha = colunas.map((nome, idx) => (nome in mudancas ? mudancas[nome] : atuais[idx]));
    alvo.getRange(linha._linha, 1, 1, colunas.length).setValues([novaLinha]);
    ajustes++;
  }

  if (ajustes) delete MEMO_.dividas;
  return ajustes;
}

function hojeTexto_() {
  return Utilities.formatDate(new Date(), fusoHorario_(), 'yyyy-MM-dd');
}
