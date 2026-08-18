/**
 * Banco falso para desenvolvimento (`npm run dev`).
 *
 * Fora do Apps Script não existe google.script.run nem Planilha, então as
 * chamadas caem aqui e ficam guardadas no localStorage. Serve só para mexer na
 * interface no computador — em produção este arquivo nunca é usado.
 */

const CHAVE = "controle-financeiro:mock";

const CATEGORIAS_PADRAO = [
  { name: "Alimentação", color: "#f97316" },
  { name: "Mercado", color: "#84cc16" },
  { name: "Moradia", color: "#0ea5e9" },
  { name: "Contas Fixas", color: "#6366f1" },
  { name: "Transporte", color: "#eab308" },
  { name: "Saúde", color: "#ef4444" },
  { name: "Lazer", color: "#ec4899" },
  { name: "Outros", color: "#64748b" },
];

const FORMAS_PADRAO = ["Pix", "Débito", "Crédito", "Dinheiro", "Boleto"];

const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function estadoInicial() {
  return {
    rev: 1,
    expenses: [],
    debts: [],
    people: [],
    categories: CATEGORIAS_PADRAO.map((c, i) => ({ id: i + 1, ...c })),
    paymentMethods: FORMAS_PADRAO.map((name, i) => ({ id: i + 1, name })),
  };
}

function ler() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return estadoInicial();
    return { ...estadoInicial(), ...JSON.parse(bruto) };
  } catch (err) {
    return estadoInicial();
  }
}

function gravar(estado) {
  estado.rev = Number(estado.rev || 0) + 1;
  localStorage.setItem(CHAVE, JSON.stringify(estado));
}

const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
const proximoId = (lista) => lista.reduce((maior, item) => Math.max(maior, Number(item.id) || 0), 0) + 1;
const chaveMes = (data) => (data ? String(data).slice(0, 7) : "");
const rotuloMes = (chave) => {
  const [ano, mes] = String(chave).split("-").map(Number);
  return ano && mes ? `${MESES_PT[mes - 1]} de ${ano}` : chave;
};

function restanteDe(divida) {
  return round2(Math.max((divida.amount || 0) - (divida.paidAmount || 0), 0));
}

function comPessoa(estado, divida) {
  const pessoa = estado.people.find((p) => p.id === divida.personId);
  return {
    ...divida,
    paidAmount: divida.paidAmount || 0,
    personName: pessoa ? pessoa.name : "(removida)",
    remaining: restanteDe(divida),
  };
}

function agrupar(lista, campo, nomeSaida, totalGeral) {
  const totais = new Map();
  for (const item of lista) {
    const chave = item[campo] || "(sem)";
    totais.set(chave, round2((totais.get(chave) || 0) + item.amount));
  }
  return [...totais.entries()]
    .map(([chave, total]) => ({
      [nomeSaida]: chave,
      total,
      percent: totalGeral ? round2((total / totalGeral) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

function relatorio(estado, month, year) {
  const hoje = new Date();
  const mes = Number(month) || hoje.getMonth() + 1;
  const ano = Number(year) || hoje.getFullYear();
  const chave = `${ano}-${String(mes).padStart(2, "0")}`;

  const lista = estado.expenses
    .filter((e) => chaveMes(e.date) === chave)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const totalGeral = round2(lista.reduce((soma, e) => soma + e.amount, 0));

  return {
    key: chave,
    label: rotuloMes(chave),
    expenses: lista,
    totalGeral,
    byCategory: agrupar(lista, "category", "category", totalGeral),
    byPaymentMethod: agrupar(lista, "paymentMethod", "method", totalGeral),
  };
}

function tendencia(estado, meses = 6) {
  const hoje = new Date();
  const serie = [];
  for (let i = Math.min(Number(meses) || 6, 24) - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    serie.push({
      key: chave,
      label: rotuloMes(chave),
      total: round2(estado.expenses.filter((e) => chaveMes(e.date) === chave).reduce((s, e) => s + e.amount, 0)),
    });
  }
  return serie;
}

function resumoDividas(estado) {
  const abertas = estado.debts.filter((d) => d.status === "pending");
  const aReceber = round2(abertas.filter((d) => d.direction === "a_receber").reduce((s, d) => s + restanteDe(d), 0));
  const aPagar = round2(abertas.filter((d) => d.direction === "a_pagar").reduce((s, d) => s + restanteDe(d), 0));
  return { aReceber, aPagar, saldo: round2(aReceber - aPagar) };
}

function listarPessoas(estado) {
  return estado.people.map((pessoa) => {
    const abertas = estado.debts.filter((d) => d.personId === pessoa.id && d.status === "pending");
    const aReceber = round2(abertas.filter((d) => d.direction === "a_receber").reduce((s, d) => s + restanteDe(d), 0));
    const aPagar = round2(abertas.filter((d) => d.direction === "a_pagar").reduce((s, d) => s + restanteDe(d), 0));
    return { ...pessoa, aReceber, aPagar, saldo: round2(aReceber - aPagar) };
  });
}

function resolverPessoa(estado, dados) {
  if (dados.personId) {
    const pessoa = estado.people.find((p) => p.id === Number(dados.personId));
    if (pessoa) return pessoa;
  }
  const nome = String(dados.personName || "").trim();
  if (!nome) throw new Error("Informe uma pessoa válida.");
  const existente = estado.people.find((p) => p.name.toLowerCase() === nome.toLowerCase());
  if (existente) return existente;
  const nova = { id: proximoId(estado.people), name: nome };
  estado.people.push(nova);
  return nova;
}

const ESCRITAS = new Set([
  "criarGasto", "atualizarGasto", "removerGasto",
  "criarDivida", "atualizarDivida", "statusDivida", "pagarDivida", "removerDivida",
  "criarCategoria", "removerCategoria", "criarForma", "removerForma",
  "criarPessoa", "atualizarPessoa", "removerPessoa",
]);

export async function mockLocal(acao, d) {
  await new Promise((r) => setTimeout(r, 120)); // finge a latência da rede
  const estado = ler();
  const dados = executar(estado, acao, d);
  if (ESCRITAS.has(acao)) gravar(estado);
  return { ok: true, rev: String(estado.rev), dados };
}

function executar(estado, acao, d) {
  switch (acao) {
    case "estado":
      return {
        report: relatorio(estado, d.month, d.year),
        trend: tendencia(estado, 6),
        debts: estado.debts.map((x) => comPessoa(estado, x)).sort((a, b) => (a.date < b.date ? 1 : -1)),
        debtsSummary: resumoDividas(estado),
        categories: estado.categories,
        paymentMethods: estado.paymentMethods,
        people: listarPessoas(estado),
        spreadsheetUrl: "",
        spreadsheetName: "Banco local de desenvolvimento",
        appUrl: "",
        syncedAt: new Date().toISOString(),
      };
    case "revisao":
      return { rev: String(estado.rev) };
    case "sincronizar":
      return { ajustes: 0 };

    case "listarGastos": {
      let lista = [...estado.expenses];
      if (d.month && d.year) {
        const chave = `${d.year}-${String(d.month).padStart(2, "0")}`;
        lista = lista.filter((e) => chaveMes(e.date) === chave);
      }
      if (d.category) lista = lista.filter((e) => e.category === d.category);
      if (d.paymentMethod) lista = lista.filter((e) => e.paymentMethod === d.paymentMethod);
      if (d.search) {
        const termo = String(d.search).toLowerCase();
        lista = lista.filter(
          (e) => e.title.toLowerCase().includes(termo) || (e.observation || "").toLowerCase().includes(termo)
        );
      }
      return lista.sort((a, b) => (a.date < b.date ? 1 : -1));
    }
    case "criarGasto": {
      const gasto = {
        id: proximoId(estado.expenses),
        date: d.date,
        title: String(d.title || "").trim(),
        category: d.category,
        amount: round2(Number(d.amount)),
        paymentMethod: d.paymentMethod,
        observation: String(d.observation || "").trim(),
        createdAt: new Date().toISOString(),
      };
      estado.expenses.push(gasto);
      return gasto;
    }
    case "atualizarGasto": {
      const gasto = estado.expenses.find((e) => e.id === Number(d.id));
      if (!gasto) throw new Error("Gasto não encontrado.");
      Object.assign(gasto, d.dados, { amount: round2(Number(d.dados.amount ?? gasto.amount)) });
      return gasto;
    }
    case "removerGasto": {
      const idx = estado.expenses.findIndex((e) => e.id === Number(d.id));
      if (idx === -1) throw new Error("Gasto não encontrado.");
      return estado.expenses.splice(idx, 1)[0];
    }

    case "listarDividas": {
      let lista = estado.debts.map((x) => comPessoa(estado, x));
      if (d.personId) lista = lista.filter((x) => x.personId === Number(d.personId));
      if (d.direction) lista = lista.filter((x) => x.direction === d.direction);
      if (d.status) lista = lista.filter((x) => x.status === d.status);
      return lista.sort((a, b) => (a.date < b.date ? 1 : -1));
    }
    case "resumoDividas":
      return resumoDividas(estado);
    case "criarDivida": {
      const pessoa = resolverPessoa(estado, d);
      const divida = {
        id: proximoId(estado.debts),
        personId: pessoa.id,
        direction: d.direction,
        title: String(d.title || "").trim(),
        amount: round2(Number(d.amount)),
        paidAmount: 0,
        date: d.date,
        status: "pending",
        observation: String(d.observation || "").trim(),
        createdAt: new Date().toISOString(),
        paidAt: null,
      };
      estado.debts.push(divida);
      return comPessoa(estado, divida);
    }
    case "atualizarDivida": {
      const divida = estado.debts.find((x) => x.id === Number(d.id));
      if (!divida) throw new Error("Dívida não encontrada.");
      const dados = { ...d.dados };
      if (dados.personName || dados.personId) dados.personId = resolverPessoa(estado, dados).id;
      delete dados.personName;
      Object.assign(divida, dados);
      if (dados.amount !== undefined) divida.amount = round2(Number(dados.amount));
      divida.status = divida.paidAmount >= divida.amount ? "paid" : "pending";
      return comPessoa(estado, divida);
    }
    case "statusDivida": {
      const divida = estado.debts.find((x) => x.id === Number(d.id));
      if (!divida) throw new Error("Dívida não encontrada.");
      divida.status = d.status;
      divida.paidAmount = d.status === "paid" ? divida.amount : 0;
      divida.paidAt = d.status === "paid" ? new Date().toISOString() : null;
      return comPessoa(estado, divida);
    }
    case "pagarDivida": {
      const divida = estado.debts.find((x) => x.id === Number(d.id));
      if (!divida) throw new Error("Dívida não encontrada.");
      const pagamento = Number(d.amount);
      if (!Number.isFinite(pagamento) || pagamento <= 0) throw new Error("Informe um valor maior que zero.");
      if (pagamento > restanteDe(divida) + 0.01) throw new Error("O pagamento não pode ser maior que o saldo restante.");
      divida.paidAmount = round2((divida.paidAmount || 0) + pagamento);
      if (divida.paidAmount >= divida.amount - 0.001) {
        divida.paidAmount = divida.amount;
        divida.status = "paid";
        divida.paidAt = new Date().toISOString();
      }
      return comPessoa(estado, divida);
    }
    case "removerDivida": {
      const idx = estado.debts.findIndex((x) => x.id === Number(d.id));
      if (idx === -1) throw new Error("Dívida não encontrada.");
      return estado.debts.splice(idx, 1)[0];
    }

    case "listarCategorias":
      return estado.categories;
    case "criarCategoria": {
      const nome = String(d.name || "").trim();
      if (!nome) throw new Error("Nome da categoria é obrigatório.");
      if (estado.categories.some((c) => c.name.toLowerCase() === nome.toLowerCase())) {
        throw new Error("Já existe uma categoria com esse nome.");
      }
      const categoria = { id: proximoId(estado.categories), name: nome, color: d.color || "#64748b" };
      estado.categories.push(categoria);
      return categoria;
    }
    case "removerCategoria": {
      const idx = estado.categories.findIndex((c) => c.id === Number(d.id));
      if (idx === -1) throw new Error("Categoria não encontrada.");
      if (estado.expenses.some((e) => e.category === estado.categories[idx].name)) {
        throw new Error("Categoria em uso por gastos existentes.");
      }
      return estado.categories.splice(idx, 1)[0];
    }

    case "listarFormas":
      return estado.paymentMethods;
    case "criarForma": {
      const nome = String(d.name || "").trim();
      if (!nome) throw new Error("Nome da forma de pagamento é obrigatório.");
      if (estado.paymentMethods.some((p) => p.name.toLowerCase() === nome.toLowerCase())) {
        throw new Error("Já existe uma forma de pagamento com esse nome.");
      }
      const forma = { id: proximoId(estado.paymentMethods), name: nome };
      estado.paymentMethods.push(forma);
      return forma;
    }
    case "removerForma": {
      const idx = estado.paymentMethods.findIndex((p) => p.id === Number(d.id));
      if (idx === -1) throw new Error("Forma de pagamento não encontrada.");
      if (estado.expenses.some((e) => e.paymentMethod === estado.paymentMethods[idx].name)) {
        throw new Error("Forma de pagamento em uso por gastos existentes.");
      }
      return estado.paymentMethods.splice(idx, 1)[0];
    }

    case "listarPessoas":
      return listarPessoas(estado);
    case "criarPessoa":
      return resolverPessoa(estado, { personName: d.name });
    case "atualizarPessoa": {
      const pessoa = estado.people.find((p) => p.id === Number(d.id));
      if (!pessoa) throw new Error("Pessoa não encontrada.");
      pessoa.name = String(d.dados.name || "").trim();
      return pessoa;
    }
    case "removerPessoa": {
      const idx = estado.people.findIndex((p) => p.id === Number(d.id));
      if (idx === -1) throw new Error("Pessoa não encontrada.");
      if (estado.debts.some((x) => x.personId === Number(d.id))) {
        throw new Error("Pessoa possui dívidas registradas.");
      }
      return estado.people.splice(idx, 1)[0];
    }

    case "relatorioMensal":
      return relatorio(estado, d.month, d.year);
    case "tendencia":
      return tendencia(estado, d.months);
    case "gerarRelatorio":
      throw new Error("A exportação para a planilha só funciona no app publicado no Google.");

    default:
      throw new Error(`Ação desconhecida: ${acao}`);
  }
}
