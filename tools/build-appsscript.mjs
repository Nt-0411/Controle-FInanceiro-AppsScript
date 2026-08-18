/**
 * Empacota a interface para o Apps Script.
 *
 * O Vite (com viteSingleFile) gera client/dist/index.html com todo o JS e CSS
 * embutidos. Aqui esse arquivo é copiado para appsscript/Index.html, que é o
 * que o doGet() entrega ao navegador.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pastaDist = path.join(raiz, "client", "dist");
const origem = path.join(pastaDist, "index.html");
const destino = path.join(raiz, "appsscript", "Index.html");

function falhar(titulo, detalhes = []) {
  console.error(`\n  ${titulo}`);
  for (const linha of detalhes) console.error(`    ${linha}`);
  console.error("");
  process.exit(1);
}

if (!fs.existsSync(origem)) {
  falhar("Não encontrei client/dist/index.html.", [
    "Rode `npm run build`, que faz o passo do Vite antes deste.",
  ]);
}

const html = fs.readFileSync(origem, "utf-8");

// O Apps Script serve um HTML só: nada pode ter sobrado do lado de fora dele.
const sobras = fs
  .readdirSync(pastaDist, { withFileTypes: true })
  .filter((item) => item.isDirectory() || item.name !== "index.html")
  .map((item) => item.name);

if (sobras.length) {
  falhar("O build gerou arquivos além do index.html:", [
    ...sobras,
    "",
    "Confira o viteSingleFile em client/vite.config.js.",
  ]);
}

// ...e nada pode apontar para um caminho local, que lá não existiria.
const externos = [...html.matchAll(/(?:src|href)="([^"]+)"/gi)]
  .map((achado) => achado[1])
  .filter((url) => !/^(data:|https?:|#|\/\/)/i.test(url));

if (externos.length) {
  falhar("O HTML ainda aponta para arquivos externos:", [
    ...externos,
    "",
    "Tudo precisa estar embutido. Confira o viteSingleFile em client/vite.config.js.",
  ]);
}

if (!html.includes('<div id="root">') || !html.trimEnd().endsWith("</html>")) {
  falhar("O HTML gerado não parece completo (faltou o #root ou o fechamento).");
}

fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, html, "utf-8");

const kb = Math.round(Buffer.byteLength(html, "utf-8") / 1024);
console.log(`\n  appsscript/Index.html gerado (${kb} KB).`);
if (kb > 2048) {
  console.log("  Atenção: acima de 2 MB o app começa a demorar para abrir no celular.");
}
console.log("  Envie para o Google com: npm run push\n");
