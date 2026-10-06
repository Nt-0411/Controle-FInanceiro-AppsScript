/**
 * A fila no D1: o que o bot entendeu e o Apps Script ainda não gravou.
 * Tabelas em migrations/0001_fila.sql.
 */

import type { Gasto, Listas } from './interpretar';

export interface ItemDaFila {
  id: number;
  gasto: Gasto;
}

export interface ResultadoDaGravacao {
  id: number;
  ok: boolean;
  erro: string | null;
}

export interface GastoRecusado {
  gasto: Gasto;
  erro: string;
}

/** Registra a mensagem e diz se é a primeira vez que ela chega. */
export async function mensagemNova(db: D1Database, id: string, agora: string): Promise<boolean> {
  const { meta } = await db
    .prepare('INSERT OR IGNORE INTO mensagens (id, recebida_em) VALUES (?, ?)')
    .bind(id, agora)
    .run();
  return meta.changes === 1;
}

export async function enfileirar(db: D1Database, mensagemId: string, gastos: Gasto[], agora: string): Promise<void> {
  const inserir = db.prepare('INSERT INTO fila (mensagem_id, gasto, criado_em) VALUES (?, ?, ?)');
  await db.batch(gastos.map((g) => inserir.bind(mensagemId, JSON.stringify(g), agora)));
}

export async function pendentes(db: D1Database): Promise<ItemDaFila[]> {
  const { results } = await db
    .prepare("SELECT id, gasto FROM fila WHERE status = 'pendente' ORDER BY id LIMIT 50")
    .all<{ id: number; gasto: string }>();
  return results.map((linha) => ({ id: linha.id, gasto: JSON.parse(linha.gasto) as Gasto }));
}

/**
 * Marca o que o Apps Script gravou ou recusou. Só mexe no que ainda está
 * pendente, então uma confirmação repetida não avisa duas vezes.
 * Devolve os recusados, para avisar no Telegram.
 */
export async function resolver(
  db: D1Database,
  resultados: ResultadoDaGravacao[],
  agora: string,
): Promise<GastoRecusado[]> {
  if (!resultados.length) return [];
  const marcar = db.prepare(
    "UPDATE fila SET status = ?, erro = ?, resolvido_em = ? WHERE id = ? AND status = 'pendente' RETURNING gasto",
  );
  const respostas = await db.batch<{ gasto: string }>(
    resultados.map((r) => marcar.bind(r.ok ? 'gravado' : 'erro', r.erro, agora, r.id)),
  );

  const recusados: GastoRecusado[] = [];
  respostas.forEach((resposta, i) => {
    const resultado = resultados[i];
    if (resultado.ok) return;
    for (const linha of resposta.results) {
      recusados.push({ gasto: JSON.parse(linha.gasto) as Gasto, erro: resultado.erro ?? 'motivo desconhecido' });
    }
  });
  return recusados;
}

export async function salvarListas(db: D1Database, listas: Listas, agora: string): Promise<void> {
  const gravar = db.prepare(
    'INSERT INTO listas (chave, valor, atualizado_em) VALUES (?, ?, ?) ' +
      'ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor, atualizado_em = excluded.atualizado_em',
  );
  await db.batch([
    gravar.bind('categorias', JSON.stringify(listas.categorias), agora),
    gravar.bind('formas', JSON.stringify(listas.formas), agora),
  ]);
}

/** As listas que o Apps Script mandou por último, ou null se ainda não mandou. */
export async function lerListas(db: D1Database): Promise<Listas | null> {
  const { results } = await db.prepare('SELECT chave, valor FROM listas').all<{ chave: string; valor: string }>();
  const pegar = (chave: string): string[] => {
    const linha = results.find((l) => l.chave === chave);
    return linha ? (JSON.parse(linha.valor) as string[]) : [];
  };
  const listas = { categorias: pegar('categorias'), formas: pegar('formas') };
  return listas.categorias.length && listas.formas.length ? listas : null;
}

/** A fila é só passagem: o que já foi resolvido some depois de uma semana. */
export async function limparAntigos(db: D1Database, agora: Date): Promise<void> {
  const umaSemana = new Date(agora.getTime() - 7 * 86_400_000).toISOString();
  const umMes = new Date(agora.getTime() - 30 * 86_400_000).toISOString();
  await db.batch([
    db.prepare("DELETE FROM fila WHERE status <> 'pendente' AND resolvido_em < ?").bind(umaSemana),
    db.prepare('DELETE FROM mensagens WHERE recebida_em < ?').bind(umMes),
  ]);
}
