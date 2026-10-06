import { describe, expect, it } from 'vitest';
import { acharTokens } from '../scripts/gravar-token.mjs';

const TOKEN = '123456789:AAF' + 'x'.repeat(29) + '_-q';

describe('gravar-token: acharTokens', () => {
  it('acha o token sozinho, com espaço em volta ou no meio da mensagem do BotFather', () => {
    expect(acharTokens(TOKEN)).toEqual([TOKEN]);
    expect(acharTokens(`  ${TOKEN}\r\n`)).toEqual([TOKEN]);
    const mensagem =
      'Done! Congratulations on your new bot. You will find it at t.me/teste_bot.\n' +
      `Use this token to access the HTTP API:\n${TOKEN}\nKeep your token secure and store it safely`;
    expect(acharTokens(mensagem)).toEqual([TOKEN]);
  });

  it('conta o mesmo token repetido uma vez só, e dois tokens diferentes como dois', () => {
    expect(acharTokens(`${TOKEN}\n${TOKEN}`)).toEqual([TOKEN]);
    expect(acharTokens(`${TOKEN} 987654321:BBF${'y'.repeat(32)}`)).toHaveLength(2);
  });

  it('não confunde texto comum nem a senha de 64 caracteres do Apps Script com token', () => {
    expect(acharTokens('')).toEqual([]);
    expect(acharTokens('mercado 40 débito')).toEqual([]);
    expect(acharTokens('a'.repeat(64))).toEqual([]);
  });
});
