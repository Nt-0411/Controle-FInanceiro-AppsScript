import { describe, expect, it } from 'vitest';
import {
  acharNaLista,
  citaData,
  conferirGastos,
  conteudoDaResposta,
  emReais,
  hojeEm,
  instrucoes,
  somarDias,
  textoDaResposta,
  textoDeAjuda,
} from '../src/interpretar';

const listas = { categorias: ['Alimentação', 'Transporte', 'Lazer'], formas: ['Débito', 'Crédito', 'Pix'] };
const hoje = '2026-09-30';
/** Frase que não diz quando foi: o gasto é de hoje. */
const SEM_DATA = 'mercado 40 débito';

function gastoDaIA(campos: Record<string, unknown> = {}) {
  return { titulo: 'Mercado', valor: 40, categoria: 'Alimentação', forma: 'Débito', data: hoje, ...campos };
}

describe('conferirGastos', () => {
  it('monta o gasto no formato que o criarGasto_ espera', () => {
    expect(conferirGastos({ gastos: [gastoDaIA()] }, listas, hoje, SEM_DATA)).toEqual({
      gastos: [
        {
          date: hoje,
          title: 'Mercado',
          category: 'Alimentação',
          amount: 40,
          paymentMethod: 'Débito',
          observation: 'Pelo Telegram',
        },
      ],
      problemas: [],
    });
  });

  it('devolve o nome exato da lista mesmo sem acento e em maiúscula', () => {
    const { gastos } = conferirGastos(
      { gastos: [gastoDaIA({ categoria: 'alimentacao', forma: 'DEBITO' })] },
      listas,
      hoje,
      SEM_DATA,
    );
    expect(gastos[0]).toMatchObject({ category: 'Alimentação', paymentMethod: 'Débito' });
  });

  it('aceita valor escrito como texto brasileiro', () => {
    const r = conferirGastos(
      { gastos: [gastoDaIA({ valor: '1.234,56' }), gastoDaIA({ valor: 'R$ 23,5' }), gastoDaIA({ valor: 19.999 })] },
      listas,
      hoje,
      SEM_DATA,
    );
    expect(r.gastos.map((g) => g.amount)).toEqual([1234.56, 23.5, 20]);
  });

  it('não anota gasto sem valor e explica o porquê', () => {
    const r = conferirGastos({ gastos: [gastoDaIA({ valor: 0 })] }, listas, hoje, SEM_DATA);
    expect(r.gastos).toEqual([]);
    expect(r.problemas).toEqual(['Faltou o valor de "Mercado".']);
  });

  it('pede a forma de pagamento quando a mensagem não diz, listando as opções', () => {
    const r = conferirGastos({ gastos: [gastoDaIA({ forma: '' })] }, listas, hoje, SEM_DATA);
    expect(r.gastos).toEqual([]);
    expect(r.problemas[0]).toBe('Faltou a forma de pagamento de "Mercado". As suas são: Débito, Crédito, Pix.');
  });

  it('não aceita categoria fora da lista da planilha', () => {
    const r = conferirGastos({ gastos: [gastoDaIA({ categoria: 'Supermercado' })] }, listas, hoje, SEM_DATA);
    expect(r.gastos).toEqual([]);
    expect(r.problemas[0]).toContain('Não achei a categoria de "Mercado"');
  });

  it('mantém ontem, mas troca por hoje data impossível, futura ou antiga demais', () => {
    const datas = ['2026-09-29', '2026-13-01', '2026-02-31', '2026-10-01', '2024-01-01', 'ontem'];
    const r = conferirGastos({ gastos: datas.map((data) => gastoDaIA({ data })) }, listas, hoje, 'mercado 40 débito ontem');
    expect(r.gastos.map((g) => g.date)).toEqual(['2026-09-29', hoje, hoje, hoje, hoje, hoje]);
  });

  it('usa hoje quando a frase não cita data, mesmo que a IA invente outra', () => {
    // O caso de 05/10/2026: a IA devolveu 03/10 para as duas compras.
    const r = conferirGastos(
      { gastos: [gastoDaIA({ titulo: 'padaria', data: '2026-09-28' }), gastoDaIA({ titulo: 'farmácia', data: '2026-09-28' })] },
      listas,
      hoje,
      'padaria 12 no dinheiro e farmácia 35,90 no crédito',
    );
    expect(r.gastos.map((g) => g.date)).toEqual([hoje, hoje]);
  });

  it('usa a categoria como título quando a IA não dá um', () => {
    const { gastos } = conferirGastos({ gastos: [gastoDaIA({ titulo: '  ' })] }, listas, hoje, SEM_DATA);
    expect(gastos[0].title).toBe('Alimentação');
  });

  it('ignora resposta que não é objeto e limita a dez gastos por mensagem', () => {
    expect(conferirGastos(null, listas, hoje, SEM_DATA)).toEqual({ gastos: [], problemas: [] });
    expect(conferirGastos('texto solto', listas, hoje, SEM_DATA)).toEqual({ gastos: [], problemas: [] });
    expect(conferirGastos({ gastos: 'x' }, listas, hoje, SEM_DATA)).toEqual({ gastos: [], problemas: [] });
    const muitos = Array.from({ length: 15 }, () => gastoDaIA());
    expect(conferirGastos({ gastos: muitos }, listas, hoje, SEM_DATA).gastos).toHaveLength(10);
  });
});

describe('citaData', () => {
  it('reconhece data dita de vários jeitos, com ou sem acento', () => {
    for (const frase of [
      'uber 23,50 pix ontem',
      'mercado dia 3 débito',
      'farmácia 03/10 crédito',
      'almoço na sexta-feira',
      'cinema sabado passado',
      'aluguel do mês passado',
      'show em 2 de outubro',
      'gasolina 3 dias atrás',
    ]) {
      expect(citaData(frase), frase).toBe(true);
    }
  });

  it('não vê data em frase de gasto comum', () => {
    for (const frase of [
      'padaria 12 no dinheiro e farmácia 35,90 no crédito',
      'almoço trinta e dois reais no pix',
      'mercado R$ 23.50 débito',
      'padaria hoje 12 pix',
      'plano de saúde 300 boleto',
    ]) {
      expect(citaData(frase), frase).toBe(false);
    }
  });
});

describe('acharNaLista', () => {
  it('aceita um único nome parecido', () => {
    expect(acharNaLista('débito', ['Cartão de Débito', 'Pix'])).toBe('Cartão de Débito');
  });

  it('não escolhe quando dois nomes servem', () => {
    expect(acharNaLista('crédito', ['Crédito Nubank', 'Crédito Inter'])).toBeNull();
  });

  it('não acha nada com texto vazio ou que não é texto', () => {
    expect(acharNaLista('', listas.formas)).toBeNull();
    expect(acharNaLista(42, listas.formas)).toBeNull();
  });
});

describe('conteudoDaResposta', () => {
  it('lê a resposta da IA vindo como texto JSON ou já como objeto', () => {
    expect(conteudoDaResposta({ response: '{"gastos":[]}' })).toEqual({ gastos: [] });
    expect(conteudoDaResposta({ response: { gastos: [] } })).toEqual({ gastos: [] });
    expect(conteudoDaResposta('{"gastos":[]}')).toEqual({ gastos: [] });
  });

  it('devolve null quando o JSON vem quebrado', () => {
    expect(conteudoDaResposta({ response: '{"gastos": [' })).toBeNull();
    expect(conteudoDaResposta(undefined)).toBeNull();
  });
});

describe('textoDaResposta', () => {
  it('confirma com valor em reais e diz quando não foi hoje', () => {
    const { gastos } = conferirGastos(
      { gastos: [gastoDaIA({ valor: 1234.56, data: '2026-09-29' })] },
      listas,
      hoje,
      'mercado 1234,56 débito ontem',
    );
    expect(textoDaResposta({ gastos, problemas: [] }, hoje)).toBe(
      '✅ Anotado:\n• Mercado · R$ 1.234,56 · Débito · Alimentação · ontem',
    );
  });

  it('junta o que entrou e o que ficou de fora', () => {
    const r = conferirGastos(
      { gastos: [gastoDaIA({ data: '2026-09-20' }), gastoDaIA({ titulo: 'Uber', forma: '' })] },
      listas,
      hoje,
      'mercado 40 débito dia 20 e uber 15',
    );
    expect(textoDaResposta(r, hoje)).toBe(
      '✅ Anotado:\n• Mercado · R$ 40,00 · Débito · Alimentação · 20/09\n\n' +
        '⚠️ Faltou a forma de pagamento de "Uber". As suas são: Débito, Crédito, Pix.',
    );
  });

  it('ensina o formato quando nada foi entendido, em texto puro', () => {
    const texto = textoDaResposta({ gastos: [], problemas: [] }, hoje);
    expect(texto).toContain('mercado 40 débito');
    expect(texto).toContain('/help');
    expect(texto).not.toContain('*'); // sem parse_mode, o Telegram mostraria o asterisco
  });
});

describe('textoDeAjuda', () => {
  it('mostra exemplos e as opções da planilha, em texto puro', () => {
    const texto = textoDeAjuda(listas);
    expect(texto).toContain('• mercado 40 débito');
    expect(texto).toContain('Categorias: Alimentação, Transporte, Lazer.');
    expect(texto).toContain('Formas de pagamento: Débito, Crédito, Pix.');
    expect(texto).not.toContain('*');
  });

  it('sem as listas da planilha, manda conferir o gatilho', () => {
    const texto = textoDeAjuda(null);
    expect(texto).toContain('Confira o gatilho do Apps Script');
    expect(texto).not.toContain('Categorias:');
  });
});

describe('datas e valores', () => {
  it('conta o dia no fuso de São Paulo, não no UTC', () => {
    expect(hojeEm('America/Sao_Paulo', new Date('2026-10-01T02:30:00Z'))).toBe('2026-09-30');
    expect(hojeEm('America/Sao_Paulo', new Date('2026-10-01T03:30:00Z'))).toBe('2026-10-01');
  });

  it('soma dias atravessando mês e ano', () => {
    expect(somarDias('2026-10-01', -1)).toBe('2026-09-30');
    expect(somarDias('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('formata reais com milhar e centavos', () => {
    expect(emReais(40)).toBe('R$ 40,00');
    expect(emReais(1234567.8)).toBe('R$ 1.234.567,80');
  });

  it('as instruções levam as listas, hoje e ontem', () => {
    const texto = instrucoes(listas, hoje);
    expect(texto).toContain('Hoje é 2026-09-30 (quarta-feira). Ontem foi 2026-09-29.');
    expect(texto).toContain('Categorias que existem: Alimentação, Transporte, Lazer.');
    expect(texto).toContain('Formas de pagamento que existem: Débito, Crédito, Pix.');
  });
});
