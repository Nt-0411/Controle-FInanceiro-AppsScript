import { mockLocal } from "./mockLocal.js";

/**
 * Canal de dados do app.
 *
 * Em produção tudo passa por uma única função no Apps Script (`api`), chamada
 * via google.script.run — sem CORS, sem senha própria, sem servidor ligado em
 * casa: o Google autentica, executa e lê/grava na Planilha.
 *
 * Em `npm run dev` (fora do Apps Script) as chamadas caem num banco falso
 * guardado no navegador, só para conseguir mexer na interface localmente.
 */

const runtimeGoogle = () =>
  typeof window !== "undefined" && window.google && window.google.script && window.google.script.run
    ? window.google.script.run
    : null;

export const rodandoNoAppsScript = () => runtimeGoogle() !== null;

// --- revisão dos dados ------------------------------------------------------
// O servidor devolve a revisão atual em toda resposta. Guardar a última vista
// aqui é o que permite perguntar depois "mudou alguma coisa?" de forma barata.

let revisaoConhecida = null;
const ouvintes = new Set();

export function revisaoLocal() {
  return revisaoConhecida;
}

export function aoMudarRevisao(callback) {
  ouvintes.add(callback);
  return () => ouvintes.delete(callback);
}

function registrarRevisao(rev) {
  if (!rev || rev === revisaoConhecida) return;
  const anterior = revisaoConhecida;
  revisaoConhecida = rev;
  if (anterior !== null) ouvintes.forEach((cb) => cb(rev));
}

// --- transporte -------------------------------------------------------------

function chamarAppsScript(acao, carga) {
  return new Promise((resolve, reject) => {
    runtimeGoogle()
      .withSuccessHandler((texto) => {
        let resposta;
        try {
          resposta = JSON.parse(texto);
        } catch (err) {
          reject(new Error("Resposta inesperada do servidor. Tente recarregar o app."));
          return;
        }
        if (!resposta.ok) {
          reject(new Error(resposta.erro || "Não foi possível concluir a operação."));
          return;
        }
        registrarRevisao(resposta.rev);
        resolve(resposta.dados);
      })
      .withFailureHandler((err) => {
        const detalhe = (err && err.message) || String(err || "");
        reject(new Error(detalhe || "Falha de comunicação com o Google. Verifique sua conexão."));
      })
      .api(acao, carga || {});
  });
}

async function chamar(acao, carga) {
  if (rodandoNoAppsScript()) return chamarAppsScript(acao, carga);
  const resposta = await mockLocal(acao, carga || {});
  registrarRevisao(resposta.rev);
  return resposta.dados;
}

// --- API usada pelas telas --------------------------------------------------

export const api = {
  // Abertura e sincronização
  estado: (month, year) => chamar("estado", { month, year }),
  revisao: () => chamar("revisao"),
  sincronizar: () => chamar("sincronizar"),

  // Gastos
  listExpenses: (params = {}) => chamar("listarGastos", limpar(params)),
  createExpense: (dados) => chamar("criarGasto", dados),
  updateExpense: (id, dados) => chamar("atualizarGasto", { id, dados }),
  deleteExpense: (id) => chamar("removerGasto", { id }),

  // Categorias
  listCategories: () => chamar("listarCategorias"),
  createCategory: (dados) => chamar("criarCategoria", dados),
  deleteCategory: (id) => chamar("removerCategoria", { id }),

  // Formas de pagamento
  listPaymentMethods: () => chamar("listarFormas"),
  createPaymentMethod: (dados) => chamar("criarForma", dados),
  deletePaymentMethod: (id) => chamar("removerForma", { id }),

  // Pessoas
  listPeople: () => chamar("listarPessoas"),
  createPerson: (dados) => chamar("criarPessoa", dados),
  updatePerson: (id, dados) => chamar("atualizarPessoa", { id, dados }),
  deletePerson: (id) => chamar("removerPessoa", { id }),

  // Dívidas
  listDebts: (params = {}) => chamar("listarDividas", limpar(params)),
  debtsSummary: () => chamar("resumoDividas"),
  createDebt: (dados) => chamar("criarDivida", dados),
  updateDebt: (id, dados) => chamar("atualizarDivida", { id, dados }),
  setDebtStatus: (id, status) => chamar("statusDivida", { id, status }),
  payDebt: (id, amount) => chamar("pagarDivida", { id, amount }),
  deleteDebt: (id) => chamar("removerDivida", { id }),

  // Relatórios
  monthlyReport: (month, year) => chamar("relatorioMensal", { month, year }),
  trend: (months = 6) => chamar("tendencia", { months }),
  gerarRelatorio: (month, year) => chamar("gerarRelatorio", { month, year }),
};

function limpar(params) {
  const saida = {};
  for (const [chave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== null && valor !== "") saida[chave] = valor;
  }
  return saida;
}
