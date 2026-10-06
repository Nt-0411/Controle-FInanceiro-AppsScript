/**
 * Transforma "Mercado 40 reais paguei no débito" num gasto do app.
 *
 * A IA só sugere; quem decide é este arquivo. O JSON mode do Workers AI não
 * garante o schema, então tudo que volta é conferido contra as listas da
 * Planilha antes de ir para a fila.
 */

export const MODELO_TEXTO = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const MODELO_AUDIO = '@cf/openai/whisper-large-v3-turbo';
export const FUSO = 'America/Sao_Paulo';

/** Mais que isso numa mensagem só é engano, não compra. */
const MAXIMO_DE_GASTOS = 10;

export interface Listas {
  categorias: string[];
  formas: string[];
}

/** O formato que o criarGasto_ do Apps Script espera. */
export interface Gasto {
  date: string;
  title: string;
  category: string;
  amount: number;
  paymentMethod: string;
  observation: string;
}

export interface Resultado {
  gastos: Gasto[];
  /** O que impediu algum gasto de entrar, já escrito para a pessoa ler. */
  problemas: string[];
}

const ESQUEMA = {
  type: 'object',
  properties: {
    gastos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titulo: { type: 'string' },
          valor: { type: 'number' },
          categoria: { type: 'string' },
          forma: { type: 'string' },
          data: { type: 'string' },
        },
        required: ['titulo', 'valor', 'categoria', 'forma', 'data'],
      },
    },
  },
  required: ['gastos'],
};

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

export function instrucoes(listas: Listas, hoje: string): string {
  const diaDaSemana = DIAS[new Date(`${hoje}T12:00:00Z`).getUTCDay()];
  return [
    'Você lê mensagens curtas de Telegram em que uma pessoa anota o que gastou, e devolve os gastos em JSON.',
    '',
    `Hoje é ${hoje} (${diaDaSemana}). Ontem foi ${somarDias(hoje, -1)}.`,
    `Categorias que existem: ${listas.categorias.join(', ')}.`,
    `Formas de pagamento que existem: ${listas.formas.join(', ')}.`,
    '',
    'Para cada gasto da mensagem:',
    '- titulo: nome curto do gasto, como a pessoa diria. Ex.: "Mercado", "Uber", "Almoço".',
    '- valor: número em reais, com ponto decimal. "40 conto" é 40; "23,50" é 23.5.',
    '- categoria: exatamente um nome da lista de categorias, o que mais combina com o gasto.',
    '- forma: exatamente um nome da lista de formas de pagamento. Se a mensagem não disser como pagou, "".',
    '- data: AAAA-MM-DD. Se a mensagem não disser a data, use hoje.',
    '',
    'Se a mensagem não fala de gasto nenhum, devolva {"gastos": []}. Nunca invente valor.',
  ].join('\n');
}

export async function perguntarAIA(ai: Ai, texto: string, listas: Listas, hoje: string): Promise<unknown> {
  const saida = await ai.run(MODELO_TEXTO, {
    messages: [
      { role: 'system', content: instrucoes(listas, hoje) },
      { role: 'user', content: texto },
    ],
    response_format: { type: 'json_schema', json_schema: ESQUEMA },
    temperature: 0,
    max_tokens: 512,
  });
  return conteudoDaResposta(saida);
}

export async function transcrever(ai: Ai, audio: ArrayBuffer): Promise<string> {
  const saida = await ai.run(MODELO_AUDIO, { audio: paraBase64(audio), language: 'pt' });
  return (saida.text ?? '').trim();
}

/** Com response_format, `response` pode vir já como objeto ou como texto JSON. */
export function conteudoDaResposta(saida: unknown): unknown {
  const bruto = typeof saida === 'object' && saida !== null && 'response' in saida ? saida.response : saida;
  if (typeof bruto !== 'string') return bruto ?? null;
  try {
    return JSON.parse(bruto);
  } catch {
    return null;
  }
}

/** Confere o que a IA devolveu e monta só os gastos que o app aceitaria. */
export function conferirGastos(bruto: unknown, listas: Listas, hoje: string, texto: string): Resultado {
  const itens = ehObjeto(bruto) && Array.isArray(bruto.gastos) ? bruto.gastos.slice(0, MAXIMO_DE_GASTOS) : [];
  const gastos: Gasto[] = [];
  const problemas: string[] = [];
  // Frase sem data é gasto de hoje, diga a IA o que disser.
  const datada = citaData(texto);

  for (const item of itens) {
    if (!ehObjeto(item)) continue;
    const titulo = paraTexto(item.titulo).slice(0, 60);
    const nome = titulo ? `"${titulo}"` : 'um dos gastos';

    const valor = paraValor(item.valor);
    if (valor === null) {
      problemas.push(`Faltou o valor de ${nome}.`);
      continue;
    }
    const categoria = acharNaLista(item.categoria, listas.categorias);
    if (!categoria) {
      problemas.push(`Não achei a categoria de ${nome}. As suas são: ${listas.categorias.join(', ')}.`);
      continue;
    }
    const forma = acharNaLista(item.forma, listas.formas);
    if (!forma) {
      problemas.push(`Faltou a forma de pagamento de ${nome}. As suas são: ${listas.formas.join(', ')}.`);
      continue;
    }

    gastos.push({
      date: datada ? dataAceitavel(item.data, hoje) : hoje,
      title: titulo || categoria,
      category: categoria,
      amount: valor,
      paymentMethod: forma,
      observation: 'Pelo Telegram',
    });
  }

  return { gastos, problemas };
}

/**
 * A resposta que volta para o Telegram depois de interpretar a mensagem. Texto
 * puro, sem parse_mode: o título vem da pessoa e não precisa de escape.
 */
export function textoDaResposta(resultado: Resultado, hoje: string): string {
  const { gastos, problemas } = resultado;
  if (!gastos.length && !problemas.length) {
    return 'Não entendi como gasto 🤔\nManda assim: mercado 40 débito\nOu: uber 23,50 pix ontem\nCategorias e formas de pagamento: /help';
  }

  const partes: string[] = [];
  if (gastos.length) {
    const cabecalho = gastos.length === 1 ? '✅ Anotado:' : `✅ Anotei ${gastos.length} gastos:`;
    const linhas = gastos.map(
      (g) => `• ${g.title} · ${emReais(g.amount)} · ${g.paymentMethod} · ${g.category}${quando(g.date, hoje)}`,
    );
    partes.push([cabecalho, ...linhas].join('\n'));
  }
  if (problemas.length) {
    partes.push(problemas.map((p) => `⚠️ ${p}`).join('\n'));
  }
  return partes.join('\n\n');
}

export const SEM_LISTAS = 'Ainda não recebi suas categorias da planilha. Confira o gatilho do Apps Script.';

/**
 * Resposta ao /help e a qualquer outro comando. As opções são as da Planilha,
 * que o Apps Script manda a cada minuto: o /help mostra o mesmo que o app.
 */
export function textoDeAjuda(listas: Listas | null): string {
  return [
    'Eu anoto os seus gastos na planilha. Manda o que comprou, o valor e como pagou:',
    '• mercado 40 débito',
    '• uber 23,50 pix ontem',
    '• padaria 12 no dinheiro e farmácia 35,90 no crédito',
    '',
    'Também vale nota de voz. Sem data na frase, o gasto entra com a data de hoje. ' +
      'Para escolher a categoria, é só dizer o nome dela.',
    '',
    listas
      ? `Categorias: ${listas.categorias.join(', ')}.\n\nFormas de pagamento: ${listas.formas.join(', ')}.`
      : SEM_LISTAS,
    '',
    'Para corrigir um gasto já anotado, edite no app.',
  ].join('\n');
}

export function emReais(valor: number): string {
  const [inteiro, centavos] = valor.toFixed(2).split('.');
  return `R$ ${inteiro.replace(/\B(?=(\d{3})+$)/g, '.')},${centavos}`;
}

/** Data de hoje (AAAA-MM-DD) no fuso da pessoa, não no do servidor. */
export function hojeEm(fuso: string, agora: Date): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: fuso,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(agora);
  const pegar = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${pegar('year')}-${pegar('month')}-${pegar('day')}`;
}

export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function quando(data: string, hoje: string): string {
  if (data === hoje) return '';
  if (data === somarDias(hoje, -1)) return ' · ontem';
  return ` · ${data.slice(8, 10)}/${data.slice(5, 7)}`;
}

/**
 * Palavras que fazem a frase citar data. Sem nenhuma delas, o gasto é de hoje:
 * em 05/10/2026 a IA pôs 03/10 em "padaria 12 no dinheiro e farmácia 35,90 no
 * crédito". "hoje" fica de fora porque não muda a data.
 */
const PALAVRAS_DE_DATA = [
  'ontem', 'anteontem', 'dias?', 'semana', 'mes', 'ano',
  'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo',
  'janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  'passad[ao]', 'retrasad[ao]',
];
const CITA_DATA = new RegExp(`\\b(${PALAVRAS_DE_DATA.join('|')})\\b|\\d{1,2}/\\d{1,2}`);

/** A frase diz quando foi? "ontem", "dia 3", "sexta", "03/10"... sem ligar para acento. */
export function citaData(texto: string): boolean {
  return CITA_DATA.test(normalizar(texto));
}

/** Data da IA só vale se existir, não estiver no futuro nem tiver mais de um ano. */
function dataAceitavel(bruto: unknown, hoje: string): string {
  const data = paraTexto(bruto);
  if (!dataReal(data)) return hoje;
  if (data > hoje || data < somarDias(hoje, -366)) return hoje;
  return data;
}

/** Recusa 2026-13-01 (data inválida) e 2026-02-31 (que o JS empurraria para março). */
function dataReal(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const d = new Date(`${data}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === data;
}

function paraValor(bruto: unknown): number | null {
  let valor = NaN;
  if (typeof bruto === 'number') {
    valor = bruto;
  } else if (typeof bruto === 'string') {
    const limpo = bruto.replace(/[R$\s]/g, '');
    // "1.234,56" e "40,5" viram 1234.56 e 40.5; "23.5" fica como está.
    valor = Number(limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo);
  }
  if (!Number.isFinite(valor) || valor <= 0 || valor >= 1_000_000) return null;
  return Math.round(valor * 100) / 100;
}

/**
 * Acha o nome exato da lista, sem ligar para acento e maiúscula. Se não bater
 * inteiro, aceita quando um único item contém o texto ou está contido nele:
 * "débito" acha "Cartão de Débito", mas não escolhe entre dois candidatos.
 */
export function acharNaLista(bruto: unknown, lista: string[]): string | null {
  const alvo = normalizar(paraTexto(bruto));
  if (!alvo) return null;
  const exato = lista.find((item) => normalizar(item) === alvo);
  if (exato) return exato;
  const parecidos = lista.filter((item) => {
    const n = normalizar(item);
    return n.includes(alvo) || alvo.includes(n);
  });
  return parecidos.length === 1 ? parecidos[0] : null;
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function paraTexto(bruto: unknown): string {
  return typeof bruto === 'string' ? bruto.trim() : '';
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function paraBase64(dados: ArrayBuffer): string {
  const bytes = new Uint8Array(dados);
  let binario = '';
  // Em pedaços: String.fromCharCode com argumentos demais estoura a pilha.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
}
