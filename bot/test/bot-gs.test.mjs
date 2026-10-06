// Roda appsscript/Bot.gs de verdade, no Node, com os serviços do Google simulados.
// Fica em .mjs porque precisa do `node:vm`, que não existe nos tipos do Worker.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const codigo = readFileSync(new URL('../../appsscript/Bot.gs', import.meta.url), 'utf8');

const gastoOk = {
  date: '2026-09-30',
  title: 'Mercado',
  category: 'Alimentação',
  amount: 40,
  paymentMethod: 'Débito',
  observation: 'Pelo Telegram',
};

/** Objeto criado dentro do vm tem outro protótipo; a ida e volta traz para cá. */
const copia = (valor) => JSON.parse(JSON.stringify(valor));

function montar({ respostas, propriedades = { BOT_URL: 'https://bot.exemplo', BOT_SEGREDO: 's3gr3do' }, apiErro = null }) {
  const props = new Map(Object.entries(propriedades));
  const chamadas = { fetch: [], api: [], gatilhosCriados: 0, logs: [] };
  const ctx = {
    console: {
      log: (texto) => chamadas.logs.push(texto),
      warn: (texto) => chamadas.logs.push(texto),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperties: () => Object.fromEntries(props),
        setProperty: (k, v) => props.set(k, String(v)),
        deleteProperty: (k) => props.delete(k),
      }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    UrlFetchApp: {
      fetch: (url, opcoes) => {
        chamadas.fetch.push({ url, auth: opcoes.headers.Authorization, corpo: JSON.parse(opcoes.payload) });
        const r = respostas.shift();
        if (!r) throw new Error(`fetch inesperado: ${url}`);
        return { getResponseCode: () => r.codigo, getContentText: () => JSON.stringify(r.corpo ?? {}) };
      },
    },
    ScriptApp: {
      getProjectTriggers: () => [],
      newTrigger: () => ({
        timeBased: () => ({ everyMinutes: () => ({ create: () => chamadas.gatilhosCriados++ }) }),
      }),
    },
    listarCategorias_: () => [{ id: 1, name: 'Alimentação' }, { id: 2, name: 'Transporte' }],
    listarFormas_: () => [{ id: 1, name: 'Débito' }, { id: 2, name: 'Pix' }],
    api: (acao, carga) => {
      chamadas.api.push({ acao, carga: copia(carga) });
      return JSON.stringify(apiErro ? { ok: false, erro: apiErro } : { ok: true, dados: { id: 7 } });
    },
  };
  vm.createContext(ctx);
  vm.runInContext(codigo, ctx);
  return { ctx, props, chamadas };
}

const vazia = { codigo: 200, corpo: { pendentes: [] } };
const confirmado = { codigo: 200, corpo: { ok: true } };
const comPendentes = (...pendentes) => ({ codigo: 200, corpo: { pendentes } });

describe('Bot.gs: buscarGastosDoBot', () => {
  it('sem nada pendente, só manda as listas: não grava nem confirma', () => {
    const { ctx, chamadas } = montar({ respostas: [vazia] });
    ctx.buscarGastosDoBot();
    expect(chamadas.fetch).toEqual([
      {
        url: 'https://bot.exemplo/fila',
        auth: 'Bearer s3gr3do',
        corpo: { categorias: ['Alimentação', 'Transporte'], formas: ['Débito', 'Pix'] },
      },
    ]);
    expect(chamadas.api).toEqual([]);
  });

  it('grava o pendente por api(criarGasto) e confirma', () => {
    const { ctx, chamadas } = montar({ respostas: [comPendentes({ id: 1, gasto: gastoOk }), confirmado] });
    ctx.buscarGastosDoBot();
    expect(chamadas.api).toEqual([{ acao: 'criarGasto', carga: gastoOk }]);
    expect(chamadas.fetch[1].url).toBe('https://bot.exemplo/fila/confirmar');
    expect(chamadas.fetch[1].corpo).toEqual({ resultados: [{ id: 1, ok: true, erro: null }] });
  });

  it('confirmação perdida: espera, e na volta confirma sem gravar de novo', () => {
    const { ctx, props, chamadas } = montar({
      respostas: [
        comPendentes({ id: 2, gasto: gastoOk }),
        { codigo: 500 },
        comPendentes({ id: 2, gasto: gastoOk }),
        confirmado,
      ],
    });
    expect(() => ctx.buscarGastosDoBot()).toThrow('O bot respondeu 500 em /fila/confirmar');
    expect(props.get('BOT_FALHAS')).toBe('1');
    expect(Number(props.get('BOT_ESPERAR_ATE'))).toBeGreaterThan(Date.now());

    ctx.buscarGastosDoBot(); // dentro da espera: nem chama o bot
    expect(chamadas.fetch).toHaveLength(2);

    props.set('BOT_ESPERAR_ATE', String(Date.now() - 1));
    ctx.buscarGastosDoBot();
    expect(chamadas.api).toHaveLength(1); // o gasto não pode entrar duas vezes na planilha
    expect(chamadas.fetch[3].corpo).toEqual({ resultados: [{ id: 2, ok: true, erro: null }] });
    expect(props.has('BOT_FALHAS')).toBe(false);
    expect(props.has('BOT_ESPERAR_ATE')).toBe(false);
  });

  it('a espera dobra a cada falha seguida, até uma hora', () => {
    const { ctx, props } = montar({ respostas: Array.from({ length: 8 }, () => ({ codigo: 503 })) });
    const esperas = [];
    for (let i = 0; i < 8; i++) {
      props.set('BOT_ESPERAR_ATE', '0');
      const antes = Date.now();
      expect(() => ctx.buscarGastosDoBot()).toThrow();
      esperas.push(Math.round((Number(props.get('BOT_ESPERAR_ATE')) - antes) / 60000));
    }
    expect(esperas).toEqual([1, 2, 4, 8, 16, 32, 60, 60]);
  });

  it('categoria que sumiu da planilha vira recusa, sem chamar api', () => {
    const { ctx, chamadas } = montar({
      respostas: [comPendentes({ id: 3, gasto: { ...gastoOk, category: 'Lazer' } }), confirmado],
    });
    ctx.buscarGastosDoBot();
    expect(chamadas.api).toEqual([]);
    expect(chamadas.fetch[1].corpo).toEqual({
      resultados: [{ id: 3, ok: false, erro: 'a categoria "Lazer" não existe mais' }],
    });
  });

  it('recusa do criarGasto_ volta para o bot com o motivo', () => {
    const { ctx, chamadas } = montar({
      apiErro: 'Valor deve ser um número maior que zero.',
      respostas: [comPendentes({ id: 4, gasto: gastoOk }), confirmado],
    });
    ctx.buscarGastosDoBot();
    expect(chamadas.fetch[1].corpo).toEqual({
      resultados: [{ id: 4, ok: false, erro: 'Valor deve ser um número maior que zero.' }],
    });
  });

  it('item malformado vira recusa e não trava a fila', () => {
    const { ctx, chamadas } = montar({
      respostas: [comPendentes({ id: 5, gasto: null }, { id: 6, gasto: gastoOk }), confirmado],
    });
    ctx.buscarGastosDoBot();
    const [ruim, bom] = chamadas.fetch[1].corpo.resultados;
    expect(ruim).toMatchObject({ id: 5, ok: false });
    expect(bom).toEqual({ id: 6, ok: true, erro: null });
  });

  it('guarda só os 50 processados mais recentes, abaixo do limite de 9 KB', () => {
    const pendentes = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, gasto: gastoOk }));
    const { ctx, props } = montar({ respostas: [comPendentes(...pendentes), confirmado] });
    ctx.buscarGastosDoBot();
    const guardados = Object.keys(JSON.parse(props.get('BOT_PROCESSADOS'))).map(Number);
    expect(guardados).toHaveLength(50);
    expect(Math.min(...guardados)).toBe(11);
    expect(props.get('BOT_PROCESSADOS').length).toBeLessThan(9 * 1024);
  });
});

describe('Bot.gs: ligar e desligar', () => {
  it('sem configuração, buscar não faz nada e ligar explica o que falta', () => {
    const { ctx, chamadas } = montar({ respostas: [], propriedades: {} });
    ctx.buscarGastosDoBot();
    expect(chamadas.fetch).toEqual([]);
    expect(() => ctx.ligarBot()).toThrow('Configure BOT_URL e BOT_SEGREDO');
    expect(chamadas.gatilhosCriados).toBe(0);
  });

  it('ligarBot aponta o webhook do Telegram, cria o gatilho e já manda as listas', () => {
    const { ctx, chamadas } = montar({ respostas: [telegramLigado(), vazia] });
    ctx.ligarBot();
    expect(chamadas.fetch.map((f) => f.url)).toEqual(['https://bot.exemplo/telegram/configurar', 'https://bot.exemplo/fila']);
    expect(chamadas.fetch[0].auth).toBe('Bearer s3gr3do');
    expect(chamadas.gatilhosCriados).toBe(1);
    expect(chamadas.logs).toEqual(['Telegram ligado em https://bot.exemplo/telegram.']);
  });

  it('ligarBot avisa o que falta e o último erro do Telegram', () => {
    const { ctx, chamadas } = montar({
      respostas: [telegramLigado({ usuarioConfigurado: false, ultimoErro: 'Connection timed out' }), vazia],
    });
    ctx.ligarBot();
    expect(chamadas.logs).toContain('Último erro do Telegram ao chamar o bot: Connection timed out');
    expect(chamadas.logs.some((l) => l.includes('TELEGRAM_USUARIO_PERMITIDO'))).toBe(true);
  });

  it('sem o token no bot, ligarBot para com o motivo e não cria gatilho', () => {
    const { ctx, chamadas } = montar({
      respostas: [{ codigo: 409, corpo: { erro: 'falta gravar o segredo TELEGRAM_TOKEN no bot' } }],
    });
    expect(() => ctx.ligarBot()).toThrow(
      'O bot respondeu 409 em /telegram/configurar: falta gravar o segredo TELEGRAM_TOKEN no bot',
    );
    expect(chamadas.gatilhosCriados).toBe(0);
  });
});

function telegramLigado(mudancas = {}) {
  return {
    codigo: 200,
    corpo: {
      ok: true,
      endereco: 'https://bot.exemplo/telegram',
      pendentes: 0,
      ultimoErro: null,
      usuarioConfigurado: true,
      ...mudancas,
    },
  };
}
