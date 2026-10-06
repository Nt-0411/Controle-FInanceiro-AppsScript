import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AudioLongo,
  baixarVoz,
  configurarMenu,
  configurarWebhook,
  enviarTexto,
  extrairMensagem,
  mesmoUsuario,
} from '../src/telegram';

/** Update no formato do webhook do Telegram, numa conversa privada. */
function update(mensagem: Record<string, unknown>, chat: Record<string, unknown> = { id: 111, type: 'private' }) {
  return { update_id: 1, message: { message_id: 7, from: { id: 111, is_bot: false, first_name: 'Natan' }, chat, date: 0, ...mensagem } };
}

const TOKEN = '123456:token-de-teste';

/** Troca o fetch por respostas prontas e guarda o que foi pedido. */
function simularFetch(...respostas: Response[]) {
  const pedidos: { url: string; corpo: unknown }[] = [];
  vi.stubGlobal('fetch', async (url: string, opcoes?: RequestInit) => {
    pedidos.push({ url, corpo: opcoes?.body ? JSON.parse(String(opcoes.body)) : undefined });
    const resposta = respostas.shift();
    if (!resposta) throw new Error(`fetch inesperado: ${url}`);
    return resposta;
  });
  return pedidos;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('extrairMensagem', () => {
  it('pega texto e nota de voz', () => {
    expect(extrairMensagem(update({ text: 'Mercado 40 débito' }))).toEqual({
      id: '111:7',
      de: '111',
      tipo: 'texto',
      texto: 'Mercado 40 débito',
    });
    expect(extrairMensagem(update({ voice: { file_id: 'VOZ', duration: 3, file_size: 9000 } }))).toEqual({
      id: '111:7',
      de: '111',
      tipo: 'voz',
      vozId: 'VOZ',
      vozTamanho: 9000,
    });
  });

  it('foto e figurinha chegam como "outro", para o bot explicar o que entende', () => {
    expect(extrairMensagem(update({ photo: [{ file_id: 'F' }] }))?.tipo).toBe('outro');
  });

  it('ignora grupo, canal e mensagem de outro bot', () => {
    expect(extrairMensagem(update({ text: 'oi' }, { id: -100, type: 'group' }))).toBeNull();
    expect(extrairMensagem(update({ text: 'oi', from: { id: 222, is_bot: true } }))).toBeNull();
  });

  it('não quebra com corpo malformado', () => {
    for (const corpo of [null, 'texto', {}, { message: null }, { message: { message_id: '7' } }, { edited_message: {} }]) {
      expect(extrairMensagem(corpo)).toBeNull();
    }
  });
});

describe('mesmoUsuario', () => {
  it('só aceita o id configurado', () => {
    expect(mesmoUsuario('111', '111')).toBe(true);
    expect(mesmoUsuario('111', ' 111\n')).toBe(true);
    expect(mesmoUsuario('1111', '111')).toBe(false);
  });

  it('não aceita nada enquanto o segredo não estiver gravado', () => {
    expect(mesmoUsuario('111', '')).toBe(false);
    expect(mesmoUsuario('', '')).toBe(false);
    expect(mesmoUsuario('111', undefined as unknown as string)).toBe(false);
  });
});

describe('chamadas ao Telegram', () => {
  it('envia texto para o chat pedido, cortado no limite do Telegram', async () => {
    const pedidos = simularFetch(Response.json({ ok: true, result: {} }));
    await enviarTexto(TOKEN, '111', 'x'.repeat(5000));
    expect(pedidos[0].url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    expect(pedidos[0].corpo).toEqual({ chat_id: '111', text: 'x'.repeat(4096) });
  });

  it('o erro diz o motivo do Telegram e nunca leva o token', async () => {
    simularFetch(Response.json({ ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' }, { status: 403 }));
    const erro = (await enviarTexto(TOKEN, '111', 'oi').catch((e: unknown) => e)) as Error;
    expect(erro.message).toBe('O Telegram recusou sendMessage: 403 Forbidden: bot was blocked by the user');
    expect(erro.message).not.toContain('token-de-teste');
  });

  it('recusa áudio grande antes de baixar', async () => {
    const pedidos = simularFetch();
    await expect(baixarVoz(TOKEN, 'VOZ', 300 * 1024)).rejects.toBeInstanceOf(AudioLongo);
    expect(pedidos).toEqual([]);
  });

  it('baixa a nota de voz pelo caminho que o getFile devolve', async () => {
    const pedidos = simularFetch(
      Response.json({ ok: true, result: { file_id: 'VOZ', file_path: 'voice/file_1.oga', file_size: 4 } }),
      new Response(new Uint8Array([1, 2, 3, 4])),
    );
    const audio = await baixarVoz(TOKEN, 'VOZ', 4);
    expect(audio.byteLength).toBe(4);
    expect(pedidos[1].url).toBe(`https://api.telegram.org/file/bot${TOKEN}/voice/file_1.oga`);
  });

  it('configura o webhook só com mensagens e devolve o último erro do Telegram', async () => {
    const pedidos = simularFetch(
      Response.json({ ok: true, result: true }),
      Response.json({ ok: true, result: { url: 'https://bot/telegram', pending_update_count: 2, last_error_message: 'Wrong response from the webhook: 401 Unauthorized' } }),
    );
    const situacao = await configurarWebhook(TOKEN, 'https://bot/telegram', 'abc');
    expect(pedidos[0].corpo).toEqual({ url: 'https://bot/telegram', secret_token: 'abc', allowed_updates: ['message'] });
    expect(situacao).toEqual({ pendentes: 2, ultimoErro: 'Wrong response from the webhook: 401 Unauthorized' });
  });

  it('põe o /help no menu do "/" do Telegram', async () => {
    const pedidos = simularFetch(Response.json({ ok: true, result: true }));
    await configurarMenu(TOKEN);
    expect(pedidos[0].url).toBe(`https://api.telegram.org/bot${TOKEN}/setMyCommands`);
    expect(pedidos[0].corpo).toEqual({
      commands: [{ command: 'help', description: 'Categorias, formas de pagamento e exemplos' }],
    });
  });
});
