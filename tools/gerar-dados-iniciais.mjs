/**
 * Converte um arquivo JSON de gastos/dívidas em um arquivo .gs que viaja junto
 * com o projeto do Apps Script. Na primeira configuração da planilha,
 * importarDadosIniciais() lê essa constante e preenche as abas.
 *
 *   node tools/gerar-dados-iniciais.mjs [caminho/do/arquivo.json]
 *
 * Sem argumento, procura em dados/importar.json.
 *
 * Formato esperado (tudo é opcional; o que faltar entra vazio):
 *
 *   {
 *     "expenses":       [{ "id": 1, "date": "2026-08-07", "title": "Aluguel",
 *                          "category": "Moradia", "amount": 1150,
 *                          "paymentMethod": "Pix", "observation": "" }],
 *     "debts":          [{ "id": 1, "personId": 1, "direction": "a_receber",
 *                          "title": "Ingresso", "amount": 200, "paidAmount": 0,
 *                          "date": "2026-08-15", "status": "pending" }],
 *     "people":         [{ "id": 1, "name": "Fulano" }],
 *     "categories":     [{ "name": "Moradia", "color": "#0ea5e9" }],
 *     "paymentMethods": [{ "name": "Pix" }]
 *   }
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destino = path.join(raiz, "appsscript", "DadosIniciais.gs");

const candidatos = process.argv[2]
  ? [path.resolve(process.argv[2])]
  : [path.join(raiz, "dados", "importar.json"), path.join(raiz, "dados", "db-antigo.json")];

const origem = candidatos.find((caminho) => fs.existsSync(caminho));

const CABECALHO = `/**
 * Carga inicial de dados, pronta para a primeira importação.
 * Gerado por tools/gerar-dados-iniciais.mjs — não edite à mão.
 *
 * Depois que a importação rodar uma vez, este arquivo vira só um histórico:
 * a planilha passa a ser a fonte da verdade.
 */

`;

if (!origem) {
  fs.writeFileSync(destino, `${CABECALHO}const DADOS_INICIAIS = null;\n`, "utf-8");
  console.log("\n  Nenhum arquivo de dados encontrado — gerei um DadosIniciais.gs vazio.");
  console.log("  A planilha vai começar do zero, com as categorias padrão.");
  console.log(`  (procurei em: ${candidatos.map((c) => path.relative(raiz, c)).join(", ")})\n`);
  process.exit(0);
}

let bruto;
try {
  bruto = JSON.parse(fs.readFileSync(origem, "utf-8"));
} catch (err) {
  console.error(`\n  ${path.relative(raiz, origem)} não é um JSON válido:\n    ${err.message}\n`);
  process.exit(1);
}

const dados = {
  expenses: bruto.expenses || [],
  debts: bruto.debts || [],
  people: bruto.people || [],
  categories: bruto.categories || [],
  paymentMethods: bruto.paymentMethods || [],
};

fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, `${CABECALHO}const DADOS_INICIAIS = ${JSON.stringify(dados, null, 2)};\n`, "utf-8");

console.log(`\n  appsscript/DadosIniciais.gs gerado a partir de ${path.relative(raiz, origem)}:`);
console.log(`    ${dados.expenses.length} gastos`);
console.log(`    ${dados.debts.length} dívidas`);
console.log(`    ${dados.people.length} pessoas`);
console.log(`    ${dados.categories.length} categorias`);
console.log(`    ${dados.paymentMethods.length} formas de pagamento`);
console.log("\n  Envie com `npm run publicar` e rode “Importar dados de um arquivo JSON” no menu da planilha.\n");
