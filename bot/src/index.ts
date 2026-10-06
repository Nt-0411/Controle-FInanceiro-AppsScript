/**
 * Bot do Controle Financeiro: gasto anotado pelo Telegram.
 *
 *   POST /telegram             o Telegram entrega a mensagem; o bot entende e põe na fila
 *   POST /telegram/configurar  o Apps Script (ligarBot) aponta o webhook do Telegram para cá
 *                              e grava o menu do "/"
 *   POST /fila                 o Apps Script manda as listas e leva o que está pendente
 *   POST /fila/confirmar       o Apps Script conta o que gravou e o que recusou
 *
 * Quem grava na Planilha é sempre o Apps Script, pelo api('criarGasto'). Este
 * Worker nunca chama o Google; ver appsscript/Bot.gs.
 */

import { enfileirar, lerListas, limparAntigos, mensagemNova, pendentes, resolver, salvarListas } from './fila';
import type { GastoRecusado, ResultadoDaGravacao } from './fila';
import {
  conferirGastos,
  emReais,
  FUSO,
  hojeEm,
  perguntarAIA,
  SEM_LISTAS,
  textoDaResposta,
  textoDeAjuda,
  transcrever,
} from './interpretar';
import type { Listas } from './interpretar';
import { segredoDoWebhook, segredosIguais } from './seguranca';
import {
  AudioLongo,
  baixarVoz,
  configurarMenu,
  configurarWebhook,
  enviarTexto,
  extrairMensagem,
  mesmoUsuario,
  TelegramRecusou,
} from './telegram';
import type { MensagemRecebida } from './telegram';

/** Um update do Telegram tem poucos KB; o limite só barra abuso. */
const LIMITE_DO_WEBHOOK = 256 * 1024;
const LIMITE_DO_APPS_SCRIPT = 64 * 1024;

const COMO_MANDAR = 'Manda assim: mercado 40 débito';

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method !== 'POST') return new Response('Não encontrado', { status: 404 });
      if (url.pathname === '/telegram') return await receberWebhook(request, env, ctx);
      if (url.pathname === '/telegram/configurar') return await configurarTelegram(request, env);
      if (url.pathname === '/fila') return await entregarFila(request, env);
      if (url.pathname === '/fila/confirmar') return await receberConfirmacao(request, env, ctx);
      return new Response('Não encontrado', { status: 404 });
    } catch (erro) {
      if (erro instanceof CorpoInvalido) return new Response(erro.message, { status: erro.status });
      console.error(JSON.stringify({ mensagem: 'erro não tratado', caminho: url.pathname, erro: descrever(erro) }));
      return Response.json({ erro: 'Erro interno' }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;

// ---------------------------------------------------------------------------
// Telegram
// ---------------------------------------------------------------------------

async function receberWebhook(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const segredo = request.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? '';
  if (!(await segredosIguais(segredo, await segredoDoWebhook(env.TELEGRAM_TOKEN)))) {
    console.warn(JSON.stringify({ mensagem: 'webhook com segredo inválido' }));
    return new Response('Não autorizado', { status: 401 });
  }
  const mensagem = extrairMensagem(paraJson(await lerCorpo(request, LIMITE_DO_WEBHOOK)));

  // O Telegram quer 200 rápido, senão reenvia. Entender e responder fica para depois.
  if (mensagem) ctx.waitUntil(processarComAviso(mensagem, env));
  return new Response('ok');
}

async function processarComAviso(mensagem: MensagemRecebida, env: Env): Promise<void> {
  try {
    await processarMensagem(mensagem, env);
  } catch (erro) {
    console.error(JSON.stringify({ mensagem: 'falha ao processar', id: mensagem.id, erro: descrever(erro) }));
    const aviso =
      erro instanceof AudioLongo
        ? 'Esse áudio é longo demais para mim. Manda um curtinho ou por texto.'
        : 'Deu erro aqui e não anotei 😕 Tenta de novo daqui a pouco.';
    await responder(env, aviso).catch((falha: unknown) => {
      console.error(JSON.stringify({ mensagem: 'falha ao avisar do erro', erro: descrever(falha) }));
    });
  }
}

async function processarMensagem(mensagem: MensagemRecebida, env: Env): Promise<void> {
  if (!env.TELEGRAM_USUARIO_PERMITIDO) {
    // Antes de configurar, o bot só diz a quem escreveu o próprio id, que é o
    // que falta gravar. Não anota nada.
    await responder(
      env,
      `O seu ID do Telegram é ${mensagem.de}.\n\nGrave esse número no segredo TELEGRAM_USUARIO_PERMITIDO do bot para eu começar a anotar os seus gastos.`,
      mensagem.de,
    );
    return;
  }
  if (!mesmoUsuario(mensagem.de, env.TELEGRAM_USUARIO_PERMITIDO)) {
    // Só o dono anota gasto. O id de quem tentou não vai para o log.
    console.warn(JSON.stringify({ mensagem: 'remetente fora da lista', tipo: mensagem.tipo }));
    return;
  }

  const agora = new Date();
  if (!(await mensagemNova(env.DB, mensagem.id, agora.toISOString()))) return; // o Telegram reenviou

  if (mensagem.texto?.trim().startsWith('/')) {
    // /start, /help e qualquer outro comando: como mandar e as opções da Planilha.
    await responder(env, textoDeAjuda(await lerListas(env.DB)));
    return;
  }

  const texto = await textoDaMensagem(mensagem, env);
  if (texto === null) {
    await responder(env, `Por enquanto eu entendo texto e áudio. ${COMO_MANDAR}`);
    return;
  }

  const listas = await lerListas(env.DB);
  if (!listas) {
    await responder(env, SEM_LISTAS);
    return;
  }

  const hoje = hojeEm(FUSO, agora);
  const resultado = conferirGastos(await perguntarAIA(env.AI, texto, listas, hoje), listas, hoje, texto);
  if (resultado.gastos.length) {
    await enfileirar(env.DB, mensagem.id, resultado.gastos, agora.toISOString());
  }

  const ouvido = mensagem.tipo === 'voz' ? `🎙️ "${texto}"\n\n` : '';
  await responder(env, ouvido + textoDaResposta(resultado, hoje));
}

/** Texto da mensagem; nota de voz vira texto pelo Whisper. Outros tipos: null. */
async function textoDaMensagem(mensagem: MensagemRecebida, env: Env): Promise<string | null> {
  if (mensagem.tipo === 'texto') return mensagem.texto?.trim() || null;
  if (mensagem.tipo === 'voz' && mensagem.vozId) {
    const audio = await baixarVoz(env.TELEGRAM_TOKEN, mensagem.vozId, mensagem.vozTamanho);
    return (await transcrever(env.AI, audio)) || null;
  }
  return null;
}

/**
 * Responde ao usuário configurado, não ao id que veio na mensagem. A única
 * exceção é o primeiro contato, antes de existir usuário configurado.
 */
async function responder(env: Env, texto: string, para = env.TELEGRAM_USUARIO_PERMITIDO): Promise<void> {
  if (!env.TELEGRAM_TOKEN) {
    // Sem token (npm run dev), a resposta só aparece no terminal.
    console.log(JSON.stringify({ mensagem: 'resposta não enviada: falta TELEGRAM_TOKEN', texto }));
    return;
  }
  await enviarTexto(env.TELEGRAM_TOKEN, para, texto);
}

/**
 * Chamada pelo ligarBot() do Apps Script. Aponta o webhook para este mesmo
 * endereço: assim o token nunca precisa ser colado num terminal ou navegador.
 */
async function configurarTelegram(request: Request, env: Env): Promise<Response> {
  if (!(await autorizado(request, env))) return new Response('Não autorizado', { status: 401 });
  if (!env.TELEGRAM_TOKEN) {
    return Response.json({ erro: 'falta gravar o segredo TELEGRAM_TOKEN no bot' }, { status: 409 });
  }

  const endereco = new URL('/telegram', request.url).toString();
  try {
    const situacao = await configurarWebhook(env.TELEGRAM_TOKEN, endereco, await segredoDoWebhook(env.TELEGRAM_TOKEN));
    await configurarMenu(env.TELEGRAM_TOKEN);
    return Response.json({ ok: true, endereco, ...situacao, usuarioConfigurado: Boolean(env.TELEGRAM_USUARIO_PERMITIDO) });
  } catch (erro) {
    if (!(erro instanceof TelegramRecusou)) throw erro;
    return Response.json({ erro: erro.message }, { status: 502 });
  }
}

// ---------------------------------------------------------------------------
// Apps Script
// ---------------------------------------------------------------------------

async function entregarFila(request: Request, env: Env): Promise<Response> {
  if (!(await autorizado(request, env))) return new Response('Não autorizado', { status: 401 });
  const corpo = paraJson(await lerCorpo(request, LIMITE_DO_APPS_SCRIPT));

  const agora = new Date();
  const listas = listasDoCorpo(corpo);
  if (listas) await salvarListas(env.DB, listas, agora.toISOString());
  await limparAntigos(env.DB, agora);

  return Response.json({ pendentes: await pendentes(env.DB) });
}

async function receberConfirmacao(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!(await autorizado(request, env))) return new Response('Não autorizado', { status: 401 });
  const corpo = paraJson(await lerCorpo(request, LIMITE_DO_APPS_SCRIPT));

  const recusados = await resolver(env.DB, resultadosDoCorpo(corpo), new Date().toISOString());
  if (recusados.length) ctx.waitUntil(avisarRecusados(env, recusados));
  return Response.json({ ok: true });
}

async function avisarRecusados(env: Env, recusados: GastoRecusado[]): Promise<void> {
  const linhas = recusados.map(({ gasto, erro }) => `• ${gasto.title} · ${emReais(gasto.amount)}: ${erro}`);
  try {
    await responder(env, ['❌ A planilha recusou:', ...linhas, '', 'Lança pelo app ou manda de novo.'].join('\n'));
  } catch (erro) {
    console.error(JSON.stringify({ mensagem: 'falha ao avisar recusa', erro: descrever(erro) }));
  }
}

async function autorizado(request: Request, env: Env): Promise<boolean> {
  const cabecalho = request.headers.get('Authorization') ?? '';
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice('Bearer '.length) : '';
  return segredosIguais(token, env.SEGREDO_APPS_SCRIPT);
}

function listasDoCorpo(corpo: unknown): Listas | null {
  if (typeof corpo !== 'object' || corpo === null) return null;
  const nomes = (valor: unknown): string[] =>
    Array.isArray(valor)
      ? valor.filter((n): n is string => typeof n === 'string' && n.trim() !== '').slice(0, 200)
      : [];
  const categorias = nomes('categorias' in corpo ? corpo.categorias : undefined);
  const formas = nomes('formas' in corpo ? corpo.formas : undefined);
  return categorias.length && formas.length ? { categorias, formas } : null;
}

function resultadosDoCorpo(corpo: unknown): ResultadoDaGravacao[] {
  const lista = typeof corpo === 'object' && corpo !== null && 'resultados' in corpo ? corpo.resultados : undefined;
  if (!Array.isArray(lista)) return [];
  const resultados: ResultadoDaGravacao[] = [];
  for (const item of lista.slice(0, 50)) {
    if (typeof item !== 'object' || item === null) continue;
    const { id, ok, erro } = item as Record<string, unknown>;
    if (typeof id !== 'number' || typeof ok !== 'boolean') continue;
    resultados.push({ id, ok, erro: typeof erro === 'string' ? erro.slice(0, 300) : null });
  }
  return resultados;
}

// ---------------------------------------------------------------------------
// Corpo da requisição
// ---------------------------------------------------------------------------

class CorpoInvalido extends Error {
  readonly status: number;

  constructor(mensagem: string, status: number) {
    super(mensagem);
    this.status = status;
  }
}

/** Lê o corpo sem aceitar mais que `limite` bytes, mesmo sem Content-Length. */
async function lerCorpo(request: Request, limite: number): Promise<ArrayBuffer> {
  if (Number(request.headers.get('Content-Length') ?? 0) > limite) {
    throw new CorpoInvalido('Corpo grande demais', 413);
  }
  if (!request.body) return new ArrayBuffer(0);

  const pedacos: Uint8Array[] = [];
  let total = 0;
  const leitor = request.body.getReader();
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > limite) {
      await leitor.cancel();
      throw new CorpoInvalido('Corpo grande demais', 413);
    }
    pedacos.push(value);
  }

  const corpo = new Uint8Array(total);
  let posicao = 0;
  for (const pedaco of pedacos) {
    corpo.set(pedaco, posicao);
    posicao += pedaco.byteLength;
  }
  return corpo.buffer;
}

function paraJson(corpo: ArrayBuffer): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(corpo));
  } catch {
    throw new CorpoInvalido('JSON inválido', 400);
  }
}

function descrever(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}
