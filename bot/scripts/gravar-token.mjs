// Grava o TELEGRAM_TOKEN no Worker sem o prompt do wrangler, que esconde o que
// se cola: colar duas vezes grava o token dobrado, e o Telegram só reclama no
// ligarBot ("setWebhook: 404 Not Found").
//
// Uso: copie o token, ou a mensagem inteira do BotFather, e rode `npm run token`.
//
// 1. Lê a área de transferência e acha o token (número:código) no meio do texto.
// 2. Pergunta ao Telegram (getMe) se o token vale e mostra o @ do bot.
// 3. Só então entrega o token ao wrangler pela entrada padrão.
// 4. Limpa a área de transferência.
//
// O token nunca aparece na tela nem vai como argumento de comando.

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PASTA_DO_BOT = fileURLToPath(new URL('..', import.meta.url));

/** Como ler e limpar a área de transferência em cada sistema. */
function areaDeTransferencia() {
  if (process.platform === 'win32') {
    return { ler: 'powershell -NoProfile -Command Get-Clipboard -Raw', limpar: 'type nul | clip' };
  }
  if (process.platform === 'darwin') {
    return { ler: 'pbpaste', limpar: "printf '' | pbcopy" };
  }
  if (process.env.WAYLAND_DISPLAY) {
    return { ler: 'wl-paste --no-newline', limpar: 'wl-copy --clear' };
  }
  return { ler: 'xclip -selection clipboard -o', limpar: "printf '' | xclip -selection clipboard" };
}

/** Tokens distintos no texto. O do Telegram é o id do bot, dois-pontos e o código. */
export function acharTokens(texto) {
  return [...new Set(texto.match(/\d{5,}:[\w-]{30,}/g) ?? [])];
}

function parar(mensagem) {
  console.log(mensagem);
  process.exit(1);
}

async function principal() {
  const area = areaDeTransferencia();

  let texto;
  try {
    texto = execSync(area.ler, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) ?? '';
  } catch {
    parar(
      'Não consegui ler a área de transferência. No Linux, instale o xclip ou o wl-clipboard. ' +
        'Ou grave à mão: npx wrangler secret put TELEGRAM_TOKEN',
    );
  }

  const tokens = acharTokens(texto);
  if (tokens.length === 0) {
    parar(
      `Não achei um token na área de transferência (ela tem ${texto.trim().length} caracteres). ` +
        'Copie o token de novo e rode outra vez.',
    );
  }
  if (tokens.length > 1) {
    parar(`Achei ${tokens.length} tokens diferentes na área de transferência. Copie só um e rode outra vez.`);
  }
  const [token] = tokens;

  let corpo;
  try {
    const resposta = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    corpo = await resposta.json();
  } catch {
    parar('Não consegui falar com o Telegram. Confira a internet e rode outra vez.');
  }
  if (!corpo.ok) {
    parar(
      `O Telegram recusou o token: ${corpo.error_code} ${corpo.description}. ` +
        'Pegue de novo no @BotFather: /mybots > o seu bot > API Token.',
    );
  }
  console.log(`Token válido: bot @${corpo.result.username} ("${corpo.result.first_name}").`);

  try {
    execSync('npx wrangler secret put TELEGRAM_TOKEN', {
      cwd: PASTA_DO_BOT,
      input: token,
      stdio: ['pipe', 'inherit', 'inherit'],
    });
  } catch {
    parar('O wrangler não gravou o token. Leia a mensagem dele acima.');
  }

  try {
    execSync(area.limpar, { stdio: 'ignore' });
    console.log('Área de transferência limpa.');
  } catch {
    console.log('O token foi gravado, mas não consegui limpar a área de transferência: limpe à mão.');
  }
  console.log('Se o bot já estava ligado, rode o ligarBot de novo no Apps Script.');
}

// Rodado direto (npm run token), e não importado pelo teste.
const rodadoDireto =
  process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (rodadoDireto) await principal();
