-- Mensagens já vistas. O Telegram reenvia o webhook quando não recebe 200, e
-- o id da mensagem (chat:número) é o que impede o gasto de entrar duas vezes.
CREATE TABLE mensagens (
  id TEXT PRIMARY KEY,
  recebida_em TEXT NOT NULL
);

-- Gastos já entendidos, esperando o Apps Script vir buscar.
-- A fila é só passagem: a verdade continua na Planilha, e o que já foi
-- resolvido é apagado depois de alguns dias.
CREATE TABLE fila (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mensagem_id TEXT NOT NULL,
  gasto TEXT NOT NULL,                      -- JSON no formato do criarGasto_ do Apps Script
  status TEXT NOT NULL DEFAULT 'pendente',  -- pendente | gravado | erro
  erro TEXT,
  criado_em TEXT NOT NULL,
  resolvido_em TEXT
);

CREATE INDEX fila_por_status ON fila (status, id);

-- Categorias e formas de pagamento, que o Apps Script manda a cada busca.
-- A IA só pode escolher entre elas.
CREATE TABLE listas (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,                      -- JSON: lista de nomes
  atualizado_em TEXT NOT NULL
);
