/**
 * Instalação completa em um comando.
 *
 * Cria a Planilha Google já com o projeto do Apps Script embutido, envia o
 * código e publica o aplicativo web — tudo pelo clasp, sem ninguém precisar
 * abrir o editor para copiar IDs de um lugar para outro.
 *
 * Sobram dois passos manuais, que o Google não deixa automatizar:
 *   • ligar a API do Apps Script na conta (uma vez na vida);
 *   • autorizar o script na primeira execução (a tela de "app não verificado").
 */

import fs from "node:fs";
import path from "node:path";
import { raiz, rodarClasp, rodarNpm, falhar, conferirErrosConhecidos, listarImplantacoes, urlDoApp } from "./clasp.mjs";

const TITULO = process.argv[2] || "Controle Financeiro";
const arquivoClasp = path.join(raiz, ".clasp.json");

console.log(`\n  Instalando "${TITULO}" na sua conta Google...\n`);

// --- 1. já existe? ----------------------------------------------------------

if (fs.existsSync(arquivoClasp)) {
  const atual = JSON.parse(fs.readFileSync(arquivoClasp, "utf-8"));
  falhar("Este projeto já está ligado a um Apps Script.", [
    `scriptId: ${atual.scriptId}`,
    "",
    "Para atualizar o app existente:      npm run publicar",
    "Para começar do zero em outra conta: apague o .clasp.json e rode de novo",
  ]);
}

// --- 2. login ---------------------------------------------------------------

const login = rodarClasp(["login", "--status"]);
if (!/logged in|You are logged in/i.test(login.saida)) {
  falhar("Você ainda não entrou na sua conta Google.", [
    "Rode `npm run login` (abre o navegador) e depois `npm run instalar` de novo.",
  ]);
}

// --- 3. cria a planilha + o projeto -----------------------------------------

console.log("  [1/3] Criando a Planilha Google e o projeto do Apps Script...");
const criacao = rodarClasp(["create", "--type", "sheets", "--title", TITULO, "--rootDir", "appsscript"]);
conferirErrosConhecidos(criacao.saida);

if (!fs.existsSync(arquivoClasp)) {
  process.stdout.write(criacao.saida);
  falhar("Não consegui criar o projeto. Veja a mensagem do clasp acima.");
}

const linkPlanilha = (criacao.saida.match(/https:\/\/(?:drive|docs)\.google\.com\/\S+/) || [])[0] || "";
const linkEditor = (criacao.saida.match(/https:\/\/script\.google\.com\/d\/\S+/) || [])[0] || "";

// O clasp cria um Código.js de exemplo que conflita com os arquivos do projeto.
const sobra = path.join(raiz, "appsscript", "Código.js");
if (fs.existsSync(sobra)) fs.rmSync(sobra);

// --- 4. envia o código ------------------------------------------------------

console.log("  [2/3] Compilando a interface e enviando o código...");
const envio = rodarNpm(["run", "push"]);
if (envio.status !== 0) process.exit(envio.status || 1);

// --- 5. publica o aplicativo web -------------------------------------------

console.log("  [3/3] Publicando o aplicativo web...");
const publicacao = rodarClasp(["deploy", "--description", "primeira instalação"]);
conferirErrosConhecidos(publicacao.saida);

const implantacoes = listarImplantacoes();
if (!implantacoes.length) {
  process.stdout.write(publicacao.saida);
  falhar("O código subiu, mas a publicação falhou.", [
    "Publique pelo editor: Implantar → Nova implantação → Aplicativo da Web",
    "(Executar como: Eu | Quem tem acesso: Somente eu)",
  ]);
}

// --- pronto -----------------------------------------------------------------

const linha = "─".repeat(64);
console.log(`\n${linha}`);
console.log("  Instalado. Faltam dois cliques seus:\n");
console.log("  1. Abra a planilha e recarregue (F5). No menu");
console.log("     “Controle Financeiro”, clique em “Configurar / reparar planilha”.");
console.log("     Autorize quando o Google pedir: Avançado → Acessar (não seguro) → Permitir.");
console.log("     Depois de autorizar, clique em Configurar mais uma vez.\n");
console.log("  2. Abra o app no celular e adicione à tela inicial.\n");
console.log(`${linha}\n`);

if (linkPlanilha) console.log(`  Planilha:  ${linkPlanilha}`);
if (linkEditor) console.log(`  Editor:    ${linkEditor}`);
console.log(`  App:       ${urlDoApp(implantacoes[0].id)}`);
console.log("\n  Daqui em diante, para publicar mudanças: npm run publicar\n");
