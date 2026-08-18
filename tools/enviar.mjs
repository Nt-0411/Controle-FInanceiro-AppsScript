/**
 * Envia o código para o Apps Script, falhando de verdade quando o clasp falha
 * em silêncio (veja o comentário no topo de clasp.mjs).
 */

import fs from "node:fs";
import path from "node:path";
import { raiz, rodarClasp, falhar, conferirErrosConhecidos } from "./clasp.mjs";

if (!fs.existsSync(path.join(raiz, ".clasp.json"))) {
  falhar("Este projeto ainda não está ligado a um Apps Script.", [
    "Rode `npm run instalar` — ele cria a planilha e publica o app de uma vez.",
  ]);
}

const { status, saida } = rodarClasp(["push", "--force"]);
process.stdout.write(saida);

conferirErrosConhecidos(saida);

if (status !== 0 || !/Pushed \d+ files?/i.test(saida)) {
  falhar("O envio NÃO foi concluído.", ["Leia a mensagem do clasp acima para saber o motivo."]);
}

console.log("\n  Código enviado para o Apps Script.");
