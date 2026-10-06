/**
 * Utilidades compartilhadas pelos scripts que falam com o Apps Script.
 *
 * O motivo de existir: o `clasp` erra de um jeito silencioso. Quando a API do
 * Apps Script está desligada na conta, ele imprime o 403 no meio da saída,
 * escreve "Pushed N files" logo abaixo e **sai com código 0** — parece sucesso.
 * Aqui a saída é sempre lida e traduzida para uma falha de verdade.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// O clasp e o npm rodam pelo próprio node, sem shell. Com `shell: true`, o jeito
// de rodar os .cmd no Windows, o Node junta os argumentos sem aspas: "atualizado
// em 06/10" virava três argumentos, e a implantação ficava só com "atualizado".
const clasp = path.join(raiz, "node_modules", "@google", "clasp", "build", "src", "index.js");

export function rodarClasp(argumentos, opcoes = {}) {
  const execucao = spawnSync(process.execPath, [clasp, ...argumentos], {
    cwd: raiz,
    encoding: "utf-8",
    ...opcoes,
  });
  const saida = `${execucao.stdout || ""}${execucao.stderr || ""}`;
  return { ...execucao, saida };
}

export function rodarNpm(argumentos) {
  // Chamado por `npm run`, o npm diz em npm_execpath onde está o próprio script.
  const npm = process.env.npm_execpath;
  if (npm) return spawnSync(process.execPath, [npm, ...argumentos], { cwd: raiz, stdio: "inherit" });
  // Fora dele, vale o npm do PATH. Os argumentos daqui são fixos e sem espaço.
  return spawnSync(["npm", ...argumentos].join(" "), { cwd: raiz, stdio: "inherit", shell: true });
}

export function falhar(titulo, passos = []) {
  console.error(`\n  ${titulo}\n`);
  for (const passo of passos) console.error(`    ${passo}`);
  console.error("");
  process.exit(1);
}

/** Traduz os erros mais comuns do clasp para instruções acionáveis. */
export function conferirErrosConhecidos(saida) {
  if (/has not enabled the Apps Script API/i.test(saida)) {
    falhar("A API do Apps Script está desligada na sua conta Google.", [
      "1. Abra https://script.google.com/home/usersettings",
      "2. Ligue a chave “API Google Apps Script”",
      "3. Espere ~1 minuto e rode o comando de novo",
      "",
      "(o clasp às vezes diz “Pushed N files” mesmo assim — ignore, não foi.)",
    ]);
  }

  if (/invalid_grant|Unauthorized|Could not read API credentials/i.test(saida)) {
    falhar("O Google recusou a autorização.", ["Rode `npm run login` e tente de novo."]);
  }
}

/**
 * Lista as implantações publicadas (a "@HEAD" é a de teste e não conta).
 * Processa linha a linha de propósito: num regex sobre o texto inteiro, o `\s`
 * depois da versão engole a quebra de linha e cola uma entrada na seguinte.
 */
export function listarImplantacoes() {
  const { saida } = rodarClasp(["deployments"]);
  conferirErrosConhecidos(saida);

  return saida
    .split(/\r?\n/)
    .map((linha) => linha.trim().match(/^-\s+(\S+)\s+@(\S+)(?:\s+-\s+(.*))?$/))
    .filter(Boolean)
    .map((achado) => ({ id: achado[1], versao: achado[2], descricao: (achado[3] || "").trim() }))
    .filter((item) => item.versao !== "HEAD");
}

export function urlDoApp(deploymentId) {
  return `https://script.google.com/macros/s/${deploymentId}/exec`;
}
