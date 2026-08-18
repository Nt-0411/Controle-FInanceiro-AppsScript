/**
 * Envia o código E atualiza o app que já está no ar.
 *
 * Existe porque `push` sozinho não muda o que você vê no celular: uma
 * implantação fica presa à versão do código que existia quando ela foi criada.
 * Sem criar uma versão nova e reapontar a implantação, o endereço continua
 * servindo o código antigo — ou, se ela foi criada cedo demais, um projeto
 * vazio (o famoso "Função de script não encontrada: doGet").
 *
 * A URL não muda: reaproveitamos a implantação existente em vez de criar outra.
 */

import { rodarClasp, rodarNpm, falhar, conferirErrosConhecidos, listarImplantacoes, urlDoApp } from "./clasp.mjs";

// 1. build + push (o enviar.mjs detecta os erros silenciosos do clasp)
const envio = rodarNpm(["run", "push"]);
if (envio.status !== 0) process.exit(envio.status || 1);

// 2. descobre qual implantação atualizar
const publicadas = listarImplantacoes();

if (publicadas.length === 0) {
  falhar("Não existe nenhuma implantação para atualizar.", [
    "Se este é o primeiro envio, rode `npm run instalar`.",
    "",
    "Ou publique pelo editor do Apps Script:",
    "Implantar → Nova implantação → Aplicativo da Web",
    "(Executar como: Eu | Quem tem acesso: Somente eu)",
  ]);
}

if (publicadas.length > 1) {
  falhar("Há mais de uma implantação publicada — não sei qual atualizar.", [
    ...publicadas.map((item) => `${item.id} @${item.versao} ${item.descricao}`),
    "",
    "Apague as que sobraram em Implantar → Gerenciar implantações.",
  ]);
}

// 3. cria uma versão nova e aponta a implantação existente para ela
const alvo = publicadas[0];
const hoje = new Date().toISOString().slice(0, 10);
const { status, saida } = rodarClasp(["deploy", "--deploymentId", alvo.id, "--description", `atualizado em ${hoje}`]);
process.stdout.write(saida);

conferirErrosConhecidos(saida);

if (status !== 0 || /error/i.test(saida)) {
  falhar("O código subiu, mas a implantação não foi atualizada.", [
    "Faça pelo editor: Implantar → Gerenciar implantações → ✏️ → Versão: Nova versão → Implantar",
  ]);
}

console.log("\n  App atualizado — a URL é a mesma de sempre, é só recarregar no celular.");
console.log(`  ${urlDoApp(alvo.id)}\n`);
