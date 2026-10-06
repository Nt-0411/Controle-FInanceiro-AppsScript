import { describe, expect, it } from 'vitest';
import { segredoDoWebhook, segredosIguais } from '../src/seguranca';

describe('segredoDoWebhook', () => {
  it('é sempre o mesmo para o mesmo token e muda com o token', async () => {
    const a = await segredoDoWebhook('123:abc');
    expect(await segredoDoWebhook('123:abc')).toBe(a);
    expect(await segredoDoWebhook('123:abd')).not.toBe(a);
  });

  it('usa só caracteres que o Telegram aceita e não contém o token', async () => {
    const segredo = await segredoDoWebhook('123:abc');
    expect(segredo).toMatch(/^[0-9a-f]{64}$/);
    expect(segredo).not.toContain('abc');
  });

  it('fica vazio sem token, e o webhook recusa tudo', async () => {
    expect(await segredoDoWebhook('')).toBe('');
    expect(await segredosIguais('', await segredoDoWebhook(''))).toBe(false);
  });
});

describe('segredosIguais', () => {
  it('só aceita o segredo exato', async () => {
    expect(await segredosIguais('abc123', 'abc123')).toBe(true);
    expect(await segredosIguais('abc124', 'abc123')).toBe(false);
    expect(await segredosIguais('abc1234', 'abc123')).toBe(false);
    expect(await segredosIguais('', 'abc123')).toBe(false);
  });

  it('nunca aceita enquanto o segredo esperado estiver vazio', async () => {
    expect(await segredosIguais('', '')).toBe(false);
  });
});
