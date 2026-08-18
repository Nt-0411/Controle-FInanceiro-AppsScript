/**
 * Regras de negocio: mesma API que o servidor Node expunha, agora lendo e
 * gravando na Planilha Google. Os nomes dos campos devolvidos ao app sao
 * identicos aos de antes, entao a interface nao precisou ser reescrita.
 */

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

function comoCategoria_(linha) {
  return {
    id: Number(linha.ID),
    name: texto_(linha.Nome),
    color: texto_(linha.Cor) || '#64748b',
    _linha: linha._linha,
  };
}

function listarCategorias_() {
  return tabela_('categorias')
    .filter((l) => texto_(l.Nome))
    .map(comoCategoria_)
    .map(semLinha_);
}

function criarCategoria_(dados) {
  const nome = texto_(dados && dados.name);
  if (!nome) throw new Error('Nome da categoria é obrigatório.');

  const existentes = tabela_('categorias').map(comoCategoria_);
  if (existentes.some((c) => c.name.toLowerCase() === nome.toLowerCase())) {
    throw new Error('Já existe uma categoria com esse nome.');
  }

  const categoria = { id: proximoId_('categorias'), name: nome, color: texto_(dados.color) || '#64748b' };
  acrescentar_('categorias', { ID: categoria.id, Nome: categoria.name, Cor: categoria.color });
  return categoria;
}

function removerCategoria_(id) {
  const alvo = tabela_('categorias').map(comoCategoria_).find((c) => c.id === Number(id));
  if (!alvo) throw new Error('Categoria não encontrada.');

  const emUso = tabela_('gastos').some((g) => texto_(g.Categoria) === alvo.name);
  if (emUso) {
    throw new Error('Categoria em uso por gastos existentes. Reclassifique-os antes de remover.');
  }

  remover_('categorias', alvo._linha);
  return semLinha_(alvo);
}

// ---------------------------------------------------------------------------
// Formas de pagamento
// ---------------------------------------------------------------------------

function comoForma_(linha) {
  return { id: Number(linha.ID), name: texto_(linha.Nome), _linha: linha._linha };
}

function listarFormas_() {
  return tabela_('formas')
    .filter((l) => texto_(l.Nome))
    .map(comoForma_)
    .map(semLinha_);
}

function criarForma_(dados) {
  const nome = texto_(dados && dados.name);
  if (!nome) throw new Error('Nome da forma de pagamento é obrigatório.');

  const existentes = tabela_('formas').map(comoForma_);
  if (existentes.some((f) => f.name.toLowerCase() === nome.toLowerCase())) {
    throw new Error('Já existe uma forma de pagamento com esse nome.');
  }

  const forma = { id: proximoId_('formas'), name: nome };
  acrescentar_('formas', { ID: forma.id, Nome: forma.name });
  return forma;
}

function removerForma_(id) {
  const alvo = tabela_('formas').map(comoForma_).find((f) => f.id === Number(id));
  if (!alvo) throw new Error('Forma de pagamento não encontrada.');

  const emUso = tabela_('gastos').some((g) => texto_(g['Forma de Pagamento']) === alvo.name);
  if (emUso) throw new Error('Forma de pagamento em uso por gastos existentes.');

  remover_('formas', alvo._linha);
  return semLinha_(alvo);
}

// ---------------------------------------------------------------------------
// Pessoas
// ---------------------------------------------------------------------------

function comoPessoa_(linha) {
  return { id: Number(linha.ID), name: texto_(linha.Nome), _linha: linha._linha };
}

function pessoas_() {
  return tabela_('pessoas').filter((l) => texto_(l.Nome)).map(comoPessoa_);
}

function pessoaPorNome_(nome) {
  const alvo = texto_(nome).toLowerCase();
  if (!alvo) return null;
  return pessoas_().find((p) => p.name.toLowerCase() === alvo) || null;
}

function listarPessoas_() {
  const dividas = dividas_();

  return pessoas_().map((pessoa) => {
    const abertas = dividas.filter((d) => d.personId === pessoa.id && d.status === 'pending');
    const aReceber = arredondar2_(
      abertas.filter((d) => d.direction === 'a_receber').reduce((soma, d) => soma + d.remaining, 0)
    );
    const aPagar = arredondar2_(
      abertas.filter((d) => d.direction === 'a_pagar').reduce((soma, d) => soma + d.remaining, 0)
    );
    return { id: pessoa.id, name: pessoa.name, aReceber, aPagar, saldo: arredondar2_(aReceber - aPagar) };
  });
}

function criarPessoa_(dados) {
  const nome = texto_(dados && dados.name);
  if (!nome) throw new Error('Nome é obrigatório.');
  if (pessoaPorNome_(nome)) throw new Error('Já existe uma pessoa com esse nome.');

  const pessoa = { id: proximoId_('pessoas'), name: nome };
  acrescentar_('pessoas', { ID: pessoa.id, Nome: pessoa.name });
  return pessoa;
}

function atualizarPessoa_(id, dados) {
  const pessoa = pessoas_().find((p) => p.id === Number(id));
  if (!pessoa) throw new Error('Pessoa não encontrada.');

  const nome = texto_(dados && dados.name);
  if (!nome) throw new Error('Nome é obrigatório.');

  const conflito = pessoaPorNome_(nome);
  if (conflito && conflito.id !== pessoa.id) throw new Error('Já existe uma pessoa com esse nome.');

  const antigo = pessoa.name;
  atualizar_('pessoas', pessoa._linha, { Nome: nome });

  // As dividas guardam o nome (para a planilha ficar legivel): renomeia junto.
  if (antigo !== nome) {
    for (const linha of tabela_('dividas')) {
      if (texto_(linha.Pessoa).toLowerCase() === antigo.toLowerCase()) {
        atualizar_('dividas', linha._linha, { Pessoa: nome });
      }
    }
  }

  return { id: pessoa.id, name: nome };
}

function removerPessoa_(id) {
  const pessoa = pessoas_().find((p) => p.id === Number(id));
  if (!pessoa) throw new Error('Pessoa não encontrada.');

  const temDividas = tabela_('dividas').some(
    (l) => texto_(l.Pessoa).toLowerCase() === pessoa.name.toLowerCase()
  );
  if (temDividas) {
    throw new Error('Pessoa possui dívidas registradas. Remova-as antes de excluir a pessoa.');
  }

  remover_('pessoas', pessoa._linha);
  return semLinha_(pessoa);
}

/**
 * Registra em "Pessoas" qualquer nome que apareceu em "Dívidas" mas ainda nao
 * estava cadastrado — acontece quando a divida e digitada direto na planilha.
 * Roda no gatilho de alteracao, nunca durante uma leitura.
 */
function normalizarPessoas_() {
  const conhecidas = {};
  for (const pessoa of pessoas_()) conhecidas[pessoa.name.toLowerCase()] = true;

  const novas = [];
  for (const linha of tabela_('dividas')) {
    const nome = texto_(linha.Pessoa);
    if (!nome) continue;
    const chave = nome.toLowerCase();
    if (conhecidas[chave]) continue;
    conhecidas[chave] = true;
    novas.push(nome);
  }

  if (!novas.length) return 0;

  let id = proximoId_('pessoas');
  const alvo = aba_('pessoas');
  const linhas = novas.map((nome) => [id++, nome]);
  alvo.getRange(alvo.getLastRow() + 1, 1, linhas.length, 2).setValues(linhas);
  delete MEMO_.pessoas;
  return novas.length;
}

// ---------------------------------------------------------------------------
// Gastos
// ---------------------------------------------------------------------------

function comoGasto_(linha) {
  return {
    id: Number(linha.ID),
    date: paraDataTexto_(linha.Data),
    title: texto_(linha['Título']),
    category: texto_(linha.Categoria),
    amount: arredondar2_(paraNumero_(linha.Valor) || 0),
    paymentMethod: texto_(linha['Forma de Pagamento']),
    observation: texto_(linha['Observação']),
    createdAt: paraDataHoraTexto_(linha['Criado em']),
    _linha: linha._linha,
  };
}

function gastos_() {
  return tabela_('gastos')
    .filter((l) => Number(l.ID) > 0)
    .map(comoGasto_);
}

function chaveMes_(data) {
  return data ? String(data).slice(0, 7) : '';
}

function listarGastos_(filtros) {
  const f = filtros || {};
  let lista = gastos_();

  if (f.month && f.year) {
    const chave = f.year + '-' + ('0' + f.month).slice(-2);
    lista = lista.filter((g) => chaveMes_(g.date) === chave);
  }
  if (f.category) lista = lista.filter((g) => g.category === f.category);
  if (f.paymentMethod) lista = lista.filter((g) => g.paymentMethod === f.paymentMethod);
  if (f.search) {
    const termo = String(f.search).toLowerCase();
    lista = lista.filter(
      (g) => g.title.toLowerCase().indexOf(termo) >= 0 || g.observation.toLowerCase().indexOf(termo) >= 0
    );
  }

  lista.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
  return lista.map(semLinha_);
}

function validarGasto_(dados) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto_(dados.date))) {
    throw new Error('Data inválida. Use o formato AAAA-MM-DD.');
  }
  if (!texto_(dados.title)) throw new Error('Título é obrigatório.');
  if (!texto_(dados.category)) throw new Error('Categoria é obrigatória.');
  const valor = paraNumero_(dados.amount);
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error('Valor deve ser um número maior que zero.');
  }
  if (!texto_(dados.paymentMethod)) throw new Error('Forma de pagamento é obrigatória.');
  return valor;
}

function criarGasto_(dados) {
  const valor = validarGasto_(dados || {});
  const gasto = {
    id: proximoId_('gastos'),
    date: texto_(dados.date),
    title: texto_(dados.title),
    category: texto_(dados.category),
    amount: arredondar2_(valor),
    paymentMethod: texto_(dados.paymentMethod),
    observation: texto_(dados.observation),
    createdAt: new Date().toISOString(),
  };

  acrescentar_('gastos', {
    ID: gasto.id,
    Data: paraDataCelula_(gasto.date),
    'Título': gasto.title,
    Categoria: gasto.category,
    Valor: gasto.amount,
    'Forma de Pagamento': gasto.paymentMethod,
    'Observação': gasto.observation,
    'Criado em': gasto.createdAt,
  });

  return gasto;
}

function atualizarGasto_(id, dados) {
  const gasto = gastos_().find((g) => g.id === Number(id));
  if (!gasto) throw new Error('Gasto não encontrado.');

  const d = dados || {};
  const mudancas = {};

  if (d.date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto_(d.date))) {
      throw new Error('Data inválida. Use o formato AAAA-MM-DD.');
    }
    gasto.date = texto_(d.date);
    mudancas.Data = paraDataCelula_(gasto.date);
  }
  if (d.title !== undefined) {
    if (!texto_(d.title)) throw new Error('Título é obrigatório.');
    gasto.title = texto_(d.title);
    mudancas['Título'] = gasto.title;
  }
  if (d.category !== undefined) {
    gasto.category = texto_(d.category);
    mudancas.Categoria = gasto.category;
  }
  if (d.amount !== undefined) {
    const valor = paraNumero_(d.amount);
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new Error('Valor deve ser um número maior que zero.');
    }
    gasto.amount = arredondar2_(valor);
    mudancas.Valor = gasto.amount;
  }
  if (d.paymentMethod !== undefined) {
    gasto.paymentMethod = texto_(d.paymentMethod);
    mudancas['Forma de Pagamento'] = gasto.paymentMethod;
  }
  if (d.observation !== undefined) {
    gasto.observation = texto_(d.observation);
    mudancas['Observação'] = gasto.observation;
  }

  atualizar_('gastos', gasto._linha, mudancas);
  return semLinha_(gasto);
}

function removerGasto_(id) {
  const gasto = gastos_().find((g) => g.id === Number(id));
  if (!gasto) throw new Error('Gasto não encontrado.');
  remover_('gastos', gasto._linha);
  return semLinha_(gasto);
}

// ---------------------------------------------------------------------------
// Dividas
// ---------------------------------------------------------------------------

function comoDivida_(linha, indicePessoas) {
  const nome = texto_(linha.Pessoa);
  const pessoa = indicePessoas[nome.toLowerCase()];
  const valor = arredondar2_(paraNumero_(linha.Valor) || 0);
  const pago = arredondar2_(paraNumero_(linha['Valor Pago']) || 0);
  const status = rotuloParaCodigo_(STATUS_DIVIDA, linha.Status, 'pending');

  return {
    id: Number(linha.ID),
    personId: pessoa ? pessoa.id : null,
    personName: nome || '(sem pessoa)',
    direction: rotuloParaCodigo_(TIPO_DIVIDA, linha.Tipo, 'a_receber'),
    title: texto_(linha['Título']),
    amount: valor,
    paidAmount: pago,
    remaining: arredondar2_(Math.max(valor - pago, 0)),
    date: paraDataTexto_(linha.Data),
    status: status,
    observation: texto_(linha['Observação']),
    createdAt: paraDataHoraTexto_(linha['Criado em']),
    paidAt: paraDataHoraTexto_(linha['Quitado em']),
    _linha: linha._linha,
  };
}

function dividas_() {
  const indice = {};
  for (const pessoa of pessoas_()) indice[pessoa.name.toLowerCase()] = pessoa;

  return tabela_('dividas')
    .filter((l) => Number(l.ID) > 0)
    .map((l) => comoDivida_(l, indice));
}

function listarDividas_(filtros) {
  const f = filtros || {};
  let lista = dividas_();

  if (f.personId) lista = lista.filter((d) => d.personId === Number(f.personId));
  if (f.direction) lista = lista.filter((d) => d.direction === f.direction);
  if (f.status) lista = lista.filter((d) => d.status === f.status);

  lista.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
  return lista.map(semLinha_);
}

function resumoDividas_() {
  const abertas = dividas_().filter((d) => d.status === 'pending');
  const aReceber = arredondar2_(
    abertas.filter((d) => d.direction === 'a_receber').reduce((soma, d) => soma + d.remaining, 0)
  );
  const aPagar = arredondar2_(
    abertas.filter((d) => d.direction === 'a_pagar').reduce((soma, d) => soma + d.remaining, 0)
  );
  return { aReceber, aPagar, saldo: arredondar2_(aReceber - aPagar) };
}

/** Aceita personId de alguem ja cadastrado ou personName (cadastra na hora). */
function resolverPessoa_(dados) {
  if (dados.personId) {
    const pessoa = pessoas_().find((p) => p.id === Number(dados.personId));
    if (pessoa) return pessoa;
  }

  const nome = texto_(dados.personName);
  if (nome) {
    const existente = pessoaPorNome_(nome);
    if (existente) return existente;
    return criarPessoa_({ name: nome });
  }

  throw new Error('Informe uma pessoa válida.');
}

function criarDivida_(dados) {
  const d = dados || {};

  const direcao = rotuloParaCodigo_(TIPO_DIVIDA, d.direction, null);
  if (!direcao) throw new Error('Direção inválida (use a_receber ou a_pagar).');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto_(d.date))) {
    throw new Error('Data inválida. Use o formato AAAA-MM-DD.');
  }
  if (!texto_(d.title)) throw new Error('Título é obrigatório.');
  const valor = paraNumero_(d.amount);
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error('Valor deve ser um número maior que zero.');
  }

  const pessoa = resolverPessoa_(d);
  const divida = {
    id: proximoId_('dividas'),
    personId: pessoa.id,
    personName: pessoa.name,
    direction: direcao,
    title: texto_(d.title),
    amount: arredondar2_(valor),
    paidAmount: 0,
    remaining: arredondar2_(valor),
    date: texto_(d.date),
    status: 'pending',
    observation: texto_(d.observation),
    createdAt: new Date().toISOString(),
    paidAt: null,
  };

  acrescentar_('dividas', {
    ID: divida.id,
    Pessoa: divida.personName,
    Tipo: TIPO_DIVIDA[divida.direction],
    'Título': divida.title,
    Valor: divida.amount,
    'Valor Pago': 0,
    Data: paraDataCelula_(divida.date),
    Status: STATUS_DIVIDA.pending,
    'Observação': divida.observation,
    'Criado em': divida.createdAt,
    'Quitado em': '',
  });

  return divida;
}

function atualizarDivida_(id, dados) {
  const divida = dividas_().find((x) => x.id === Number(id));
  if (!divida) throw new Error('Dívida não encontrada.');

  const d = dados || {};
  const mudancas = {};

  if (d.title !== undefined) {
    if (!texto_(d.title)) throw new Error('Título é obrigatório.');
    divida.title = texto_(d.title);
    mudancas['Título'] = divida.title;
  }
  if (d.amount !== undefined) {
    const valor = paraNumero_(d.amount);
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new Error('Valor deve ser um número maior que zero.');
    }
    divida.amount = arredondar2_(valor);
    mudancas.Valor = divida.amount;

    if (divida.paidAmount > divida.amount) {
      divida.paidAmount = divida.amount;
      mudancas['Valor Pago'] = divida.paidAmount;
    }
    divida.status = divida.paidAmount >= divida.amount ? 'paid' : 'pending';
    mudancas.Status = STATUS_DIVIDA[divida.status];
    divida.remaining = arredondar2_(divida.amount - divida.paidAmount);
  }
  if (d.date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto_(d.date))) throw new Error('Data inválida.');
    divida.date = texto_(d.date);
    mudancas.Data = paraDataCelula_(divida.date);
  }
  if (d.observation !== undefined) {
    divida.observation = texto_(d.observation);
    mudancas['Observação'] = divida.observation;
  }
  if (d.direction !== undefined) {
    const direcao = rotuloParaCodigo_(TIPO_DIVIDA, d.direction, null);
    if (!direcao) throw new Error('Direção inválida.');
    divida.direction = direcao;
    mudancas.Tipo = TIPO_DIVIDA[direcao];
  }
  if (d.personId !== undefined || d.personName !== undefined) {
    const pessoa = resolverPessoa_(d);
    divida.personId = pessoa.id;
    divida.personName = pessoa.name;
    mudancas.Pessoa = pessoa.name;
  }

  atualizar_('dividas', divida._linha, mudancas);
  return semLinha_(divida);
}

function definirStatusDivida_(id, status) {
  const divida = dividas_().find((x) => x.id === Number(id));
  if (!divida) throw new Error('Dívida não encontrada.');
  if (status !== 'pending' && status !== 'paid') {
    throw new Error('Status inválido (use pending ou paid).');
  }

  divida.status = status;
  divida.paidAmount = status === 'paid' ? divida.amount : 0;
  divida.remaining = arredondar2_(divida.amount - divida.paidAmount);
  divida.paidAt = status === 'paid' ? new Date().toISOString() : null;

  atualizar_('dividas', divida._linha, {
    Status: STATUS_DIVIDA[status],
    'Valor Pago': divida.paidAmount,
    'Quitado em': divida.paidAt || '',
  });

  return semLinha_(divida);
}

/** Registra um pagamento (total ou parcial), abatendo do valor da divida. */
function pagarDivida_(id, valorPagamento) {
  const divida = dividas_().find((x) => x.id === Number(id));
  if (!divida) throw new Error('Dívida não encontrada.');

  const pagamento = paraNumero_(valorPagamento);
  const restante = divida.remaining;

  if (!Number.isFinite(pagamento) || pagamento <= 0) {
    throw new Error('Informe um valor de pagamento maior que zero.');
  }
  if (pagamento > restante + 0.01) {
    throw new Error('O pagamento não pode ser maior que o saldo restante (' + restante.toFixed(2) + ').');
  }

  divida.paidAmount = arredondar2_(divida.paidAmount + pagamento);
  if (divida.paidAmount >= divida.amount - 0.001) {
    divida.paidAmount = divida.amount;
    divida.status = 'paid';
    divida.paidAt = new Date().toISOString();
  }
  divida.remaining = arredondar2_(divida.amount - divida.paidAmount);

  atualizar_('dividas', divida._linha, {
    'Valor Pago': divida.paidAmount,
    Status: STATUS_DIVIDA[divida.status],
    'Quitado em': divida.paidAt || '',
  });

  return semLinha_(divida);
}

function removerDivida_(id) {
  const divida = dividas_().find((x) => x.id === Number(id));
  if (!divida) throw new Error('Dívida não encontrada.');
  remover_('dividas', divida._linha);
  return semLinha_(divida);
}

// ---------------------------------------------------------------------------
// Utilitario
// ---------------------------------------------------------------------------

/** Tira o `_linha` (detalhe interno da planilha) antes de mandar para o app. */
function semLinha_(objeto) {
  const copia = {};
  for (const chave of Object.keys(objeto)) {
    if (chave !== '_linha') copia[chave] = objeto[chave];
  }
  return copia;
}
