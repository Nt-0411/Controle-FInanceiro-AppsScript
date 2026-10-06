/**
 * As duas portas do bot e como cada uma confere quem bate:
 *
 * - /telegram: o Telegram manda o segredo do webhook no cabeçalho
 *   X-Telegram-Bot-Api-Secret-Token, o mesmo que o bot passou no setWebhook.
 * - /fila e /telegram/configurar: o Apps Script manda um segredo combinado no
 *   Authorization.
 *
 * Tudo com Web Crypto, que existe no Worker e no Node dos testes.
 */

const codificador = new TextEncoder();

/**
 * O segredo do webhook sai do próprio token do bot, para não haver mais um
 * segredo para gravar: quem tem o token já manda no bot de qualquer jeito, e o
 * resumo não devolve o token. Hex cabe nos caracteres que o Telegram aceita
 * (A-Z, a-z, 0-9, _ e -). Trocou o token? Rode o ligarBot() de novo.
 */
export async function segredoDoWebhook(tokenDoBot: string): Promise<string> {
  if (!tokenDoBot) return '';
  const resumo = await crypto.subtle.digest('SHA-256', codificador.encode(`webhook:${tokenDoBot}`));
  return Array.from(new Uint8Array(resumo), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compara dois segredos sem vazar, pelo tempo de resposta, o quanto bateu.
 * Resume os dois em SHA-256 para que o tamanho também não vaze. O
 * crypto.subtle.timingSafeEqual só existe no Worker, e os testes rodam no Node.
 */
export async function segredosIguais(recebido: string, esperado: string): Promise<boolean> {
  if (!esperado) return false;
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', codificador.encode(recebido)),
    crypto.subtle.digest('SHA-256', codificador.encode(esperado)),
  ]);
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diferenca = 0;
  for (let i = 0; i < x.length; i++) diferenca |= x[i] ^ y[i];
  return diferenca === 0;
}
