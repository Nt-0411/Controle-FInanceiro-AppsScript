/**
 * Conversa com a API de bots do Telegram.
 *
 * O token vai no caminho de toda chamada (api.telegram.org/bot<token>/...).
 * Por isso nenhum erro daqui leva a URL: só o método, o código e a descrição
 * que o Telegram devolve.
 */

const API = 'https://api.telegram.org';

/**
 * Mais de um minuto de nota de voz. Gasto se fala em segundos, e o plano Free
 * dá 10 ms de CPU por requisição: áudio grande estouraria no base64.
 */
const LIMITE_DO_AUDIO = 256 * 1024;

/** Limite do Telegram para uma mensagem de texto. */
const LIMITE_DO_TEXTO = 4096;

export interface MensagemRecebida {
  /** Chat e número da mensagem: é o que impede o mesmo webhook de virar dois gastos. */
  id: string;
  /** Id numérico de quem mandou, em texto. */
  de: string;
  tipo: 'texto' | 'voz' | 'outro';
  texto?: string;
  vozId?: string;
  vozTamanho?: number;
}

/**
 * Tira a mensagem do update do webhook. O Telegram manda um update por vez.
 * Grupo, canal e mensagem de outro bot ficam de fora: o bot é conversa de uma
 * pessoa só.
 */
export function extrairMensagem(corpo: unknown): MensagemRecebida | null {
  const mensagem = campo(corpo, 'message');
  const chat = campo(mensagem, 'chat');
  const remetente = campo(mensagem, 'from');
  const numero = campo(mensagem, 'message_id');
  const chatId = campo(chat, 'id');
  const usuarioId = campo(remetente, 'id');
  if (typeof numero !== 'number' || typeof chatId !== 'number' || typeof usuarioId !== 'number') return null;
  if (campo(chat, 'type') !== 'private' || campo(remetente, 'is_bot') === true) return null;

  const base = { id: `${chatId}:${numero}`, de: String(usuarioId) };
  const texto = campo(mensagem, 'text');
  if (typeof texto === 'string') return { ...base, tipo: 'texto', texto };

  const voz = campo(mensagem, 'voice');
  const vozId = campo(voz, 'file_id');
  if (typeof vozId === 'string') {
    const tamanho = campo(voz, 'file_size');
    return { ...base, tipo: 'voz', vozId, vozTamanho: typeof tamanho === 'number' ? tamanho : undefined };
  }
  return { ...base, tipo: 'outro' };
}

export function mesmoUsuario(de: string, permitido: string): boolean {
  if (!de || !permitido) return false; // segredo ainda não gravado chega como undefined
  return de === permitido.trim();
}

export async function enviarTexto(token: string, para: string, texto: string): Promise<void> {
  await chamar(token, 'sendMessage', { chat_id: para, text: texto.slice(0, LIMITE_DO_TEXTO) });
}

/** Baixa uma nota de voz: primeiro pede o caminho do arquivo, depois o arquivo. */
export async function baixarVoz(token: string, arquivoId: string, tamanho?: number): Promise<ArrayBuffer> {
  if (tamanho && tamanho > LIMITE_DO_AUDIO) throw new AudioLongo();

  const info = await chamar(token, 'getFile', { file_id: arquivoId });
  const caminho = campo(info, 'file_path');
  const tamanhoReal = campo(info, 'file_size');
  if (typeof caminho !== 'string') throw new Error('O Telegram não devolveu o caminho do áudio.');
  if (typeof tamanhoReal === 'number' && tamanhoReal > LIMITE_DO_AUDIO) throw new AudioLongo();

  const arquivo = await fetch(`${API}/file/bot${token}/${caminho}`);
  if (!arquivo.ok) {
    await arquivo.body?.cancel();
    throw new Error(`Falhou o download do áudio: ${arquivo.status}`);
  }
  if (Number(arquivo.headers.get('Content-Length') ?? 0) > LIMITE_DO_AUDIO) {
    await arquivo.body?.cancel();
    throw new AudioLongo();
  }
  const audio = await arquivo.arrayBuffer();
  if (audio.byteLength > LIMITE_DO_AUDIO) throw new AudioLongo();
  return audio;
}

export interface SituacaoDoWebhook {
  /** Updates que o Telegram ainda não conseguiu entregar. */
  pendentes: number;
  /** A última recusa que o Telegram registrou ao chamar o webhook, se houver. */
  ultimoErro: string | null;
}

/** Aponta o webhook do bot para `url` e devolve como o Telegram o enxerga. */
export async function configurarWebhook(token: string, url: string, segredo: string): Promise<SituacaoDoWebhook> {
  await chamar(token, 'setWebhook', { url, secret_token: segredo, allowed_updates: ['message'] });
  const info = await chamar(token, 'getWebhookInfo', {});
  const pendentes = campo(info, 'pending_update_count');
  const ultimoErro = campo(info, 'last_error_message');
  return {
    pendentes: typeof pendentes === 'number' ? pendentes : 0,
    ultimoErro: typeof ultimoErro === 'string' ? ultimoErro.slice(0, 200) : null,
  };
}

/**
 * O menu que aparece ao digitar "/" no Telegram. Quem grava é o ligarBot: mudou
 * aqui, rode-o de novo depois do deploy.
 */
const COMANDOS = [{ command: 'help', description: 'Categorias, formas de pagamento e exemplos' }];

export async function configurarMenu(token: string): Promise<void> {
  await chamar(token, 'setMyCommands', { commands: COMANDOS });
}

export class AudioLongo extends Error {
  constructor() {
    super('Áudio longo demais.');
  }
}

export class TelegramRecusou extends Error {}

async function chamar(token: string, metodo: string, corpo: object): Promise<unknown> {
  const resposta = await fetch(`${API}/bot${token}/${metodo}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  const dados: unknown = await resposta.json().catch(() => null);
  if (campo(dados, 'ok') !== true) {
    const codigo = campo(dados, 'error_code') ?? resposta.status;
    const descricao = campo(dados, 'description') ?? 'sem descrição';
    throw new TelegramRecusou(`O Telegram recusou ${metodo}: ${String(codigo)} ${String(descricao).slice(0, 200)}`);
  }
  return campo(dados, 'result');
}

function campo(objeto: unknown, nome: string): unknown {
  return typeof objeto === 'object' && objeto !== null ? (objeto as Record<string, unknown>)[nome] : undefined;
}
