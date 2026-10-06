/**
 * Gastos que chegam pelo Telegram.
 *
 * Quem recebe a mensagem é o bot (pasta bot/, um Cloudflare Worker): ele
 * entende a frase com IA e guarda o gasto numa fila. Este arquivo vai buscar
 * essa fila a cada minuto e grava pelo mesmo caminho do app, api('criarGasto').
 *
 * O sentido da chamada é de propósito: o Apps Script busca, o bot nunca chama.
 * Assim nenhuma URL do Google fica pública e a implantação segue "somente eu".
 *
 * Para ligar:
 *   1. Configurações do projeto > Propriedades do script:
 *        BOT_URL      endereço do Worker, sem barra no fim
 *        BOT_SEGREDO  o mesmo valor do segredo SEGREDO_APPS_SCRIPT do Worker
 *   2. Rodar ligarBot() uma vez pelo editor. Ele também aponta o webhook do
 *      Telegram para o bot; rode de novo se trocar o token do bot.
 */

const GATILHO_BOT = 'buscarGastosDoBot';

/** Id da fila -> resultado. Impede gravar duas vezes se a confirmação se perder. */
const BOT_PROCESSADOS = 'BOT_PROCESSADOS';
const BOT_FALHAS = 'BOT_FALHAS';
const BOT_ESPERAR_ATE = 'BOT_ESPERAR_ATE';

function ligarBot() {
  const conf = PropertiesService.getScriptProperties().getProperties();
  if (!conf.BOT_URL || !conf.BOT_SEGREDO) {
    throw new Error('Configure BOT_URL e BOT_SEGREDO nas propriedades do script antes de ligar o bot.');
  }

  // O bot aponta o webhook do Telegram para ele mesmo: o token nunca sai de lá.
  const telegram = chamarBot_(conf, '/telegram/configurar', {});
  console.log('Telegram ligado em ' + telegram.endereco + '.');
  if (telegram.ultimoErro) console.warn('Último erro do Telegram ao chamar o bot: ' + telegram.ultimoErro);
  if (!telegram.usuarioConfigurado) {
    console.log('Falta o TELEGRAM_USUARIO_PERMITIDO: mande /start para o bot e ele responde com o seu ID.');
  }

  const jaLigado = ScriptApp.getProjectTriggers().some((g) => g.getHandlerFunction() === GATILHO_BOT);
  if (!jaLigado) ScriptApp.newTrigger(GATILHO_BOT).timeBased().everyMinutes(1).create();

  buscarGastosDoBot(); // manda as listas agora, sem esperar o primeiro minuto
}

function desligarBot() {
  for (const gatilho of ScriptApp.getProjectTriggers()) {
    if (gatilho.getHandlerFunction() === GATILHO_BOT) ScriptApp.deleteTrigger(gatilho);
  }
}

/**
 * Roda a cada minuto. Manda as categorias e formas atuais (a IA só escolhe
 * entre elas), grava o que estiver pendente e conta ao bot o resultado.
 */
function buscarGastosDoBot() {
  const props = PropertiesService.getScriptProperties();
  const conf = props.getProperties();
  if (!conf.BOT_URL || !conf.BOT_SEGREDO) return;

  // Depois de uma falha, espera antes de tentar de novo: bot fora do ar não
  // pode queimar a cota diária de gatilhos, que o onChange também usa.
  if (Date.now() < Number(conf[BOT_ESPERAR_ATE] || 0)) return;

  const trava = LockService.getScriptLock();
  if (!trava.tryLock(1000)) return; // a busca anterior ainda está rodando

  try {
    const listas = {
      categorias: listarCategorias_().map((c) => c.name),
      formas: listarFormas_().map((f) => f.name),
    };
    const pendentes = chamarBot_(conf, '/fila', listas).pendentes || [];

    if (pendentes.length) {
      const processados = JSON.parse(conf[BOT_PROCESSADOS] || '{}');
      const resultados = pendentes.map((item) => {
        if (!processados[item.id]) {
          processados[item.id] = gravarDoBot_(item.gasto, listas);
          // Guarda a cada gasto: se a execução cair no meio, o próximo minuto
          // sabe o que já entrou na planilha.
          props.setProperty(BOT_PROCESSADOS, JSON.stringify(ultimosProcessados_(processados)));
        }
        return { id: item.id, ok: processados[item.id].ok, erro: processados[item.id].erro };
      });
      chamarBot_(conf, '/fila/confirmar', { resultados: resultados });
    }

    if (conf[BOT_FALHAS]) {
      props.deleteProperty(BOT_FALHAS);
      props.deleteProperty(BOT_ESPERAR_ATE);
    }
  } catch (err) {
    const falhas = Number(conf[BOT_FALHAS] || 0) + 1;
    const minutos = Math.min(60, Math.pow(2, falhas - 1)); // 1, 2, 4... até uma hora
    props.setProperty(BOT_FALHAS, String(falhas));
    props.setProperty(BOT_ESPERAR_ATE, String(Date.now() + minutos * 60 * 1000));
    throw err; // aparece em Execuções e no resumo de falhas que o Google manda por e-mail
  } finally {
    trava.releaseLock();
  }
}

/** Grava pelo mesmo caminho do app: trava, ID e revisão, como se fosse pelo celular. */
function gravarDoBot_(gasto, listas) {
  try {
    // O bot já conferiu, mas a planilha pode ter mudado entre a mensagem e a busca.
    if (listas.categorias.indexOf(gasto.category) < 0) {
      return { ok: false, erro: 'a categoria "' + gasto.category + '" não existe mais' };
    }
    if (listas.formas.indexOf(gasto.paymentMethod) < 0) {
      return { ok: false, erro: 'a forma de pagamento "' + gasto.paymentMethod + '" não existe mais' };
    }
    const resposta = JSON.parse(api('criarGasto', gasto));
    return resposta.ok ? { ok: true, erro: null } : { ok: false, erro: String(resposta.erro).slice(0, 120) };
  } catch (err) {
    // Item malformado não pode travar a fila para sempre: vira recusa e segue.
    return { ok: false, erro: String((err && err.message) || err).slice(0, 120) };
  }
}

/** Só os 50 mais recentes: uma propriedade do script aceita no máximo 9 KB. */
function ultimosProcessados_(processados) {
  const ids = Object.keys(processados).map(Number).sort((a, b) => b - a).slice(0, 50);
  const resultado = {};
  ids.forEach((id) => {
    resultado[id] = processados[id];
  });
  return resultado;
}

function chamarBot_(conf, caminho, corpo) {
  const resposta = UrlFetchApp.fetch(conf.BOT_URL + caminho, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + conf.BOT_SEGREDO },
    payload: JSON.stringify(corpo),
    muteHttpExceptions: true,
  });
  const codigo = resposta.getResponseCode();
  if (codigo !== 200) {
    let motivo = '';
    try {
      motivo = JSON.parse(resposta.getContentText()).erro || '';
    } catch (err) {
      // corpo sem JSON (401, 404): o código já basta
    }
    throw new Error('O bot respondeu ' + codigo + ' em ' + caminho + (motivo ? ': ' + motivo : ''));
  }
  return JSON.parse(resposta.getContentText());
}
