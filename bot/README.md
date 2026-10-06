# Bot do Telegram

Anote gasto mandando mensagem: **"mercado 40 débito"** vira um gasto no app, com categoria, forma de
pagamento e data. O bot também entende nota de voz e duas compras na mesma frase.

```
Você no Telegram ──webhook──▶ este Worker (Cloudflare)
                               ├─ confere se a mensagem veio mesmo do Telegram
                               ├─ Workers AI entende a frase (ou transcreve o áudio)
                               ├─ responde "✅ Mercado · R$ 40,00 · Débito · Mercado"
                               └─ guarda o gasto numa fila (banco D1)
Apps Script, a cada minuto ──busca──▶ /fila ──▶ api('criarGasto') ──▶ Planilha
```

Quem grava na Planilha é sempre o Apps Script ([`appsscript/Bot.gs`](../appsscript/Bot.gs)), pelo mesmo
caminho do app. O Worker nunca chama o Google, e o app continua publicado como "somente eu".

Por que não WhatsApp: o número de teste grátis da Meta é americano, e a Meta bloqueia mensagem de
número de fora do Brasil para celular brasileiro (erro 130497). O bot recebia, mas não conseguia
responder. Sem chip extra, o Telegram faz o mesmo de graça.

## Como usar

| Você manda | O bot anota |
|---|---|
| `mercado 40 débito` | Mercado · R$ 40,00 · Débito · hoje |
| `uber 23,50 pix ontem` | Uber · R$ 23,50 · Pix · ontem |
| `padaria 12 no dinheiro e farmácia 35,90 no crédito` | dois gastos, cada um com a sua forma de pagamento |
| uma nota de voz curta | o mesmo, a partir do áudio transcrito |
| `/help` | exemplos, as suas categorias e as suas formas de pagamento |

- **Categoria e forma de pagamento** têm de existir no app: o bot só escolhe entre elas. Ele pega a
  categoria que mais combina. Para escolher você mesmo, diga o nome dela na frase.
- **Data:** sem data na frase ("ontem", "dia 3", "sexta", "03/10"), o gasto entra com a data de hoje.
- **Correção:** o bot não muda gasto já anotado. Para corrigir, edite no app.
- **Tempo:** a confirmação chega na hora, e o gasto aparece no app em até um minuto.

## Ligar pela primeira vez

Leva uns 15 minutos. Você vai precisar de:

- uma conta no Telegram;
- uma conta grátis na [Cloudflare](https://dash.cloudflare.com/sign-up);
- o app já instalado, pelo README da raiz, e o Node.js 18 ou mais novo.

Os comandos rodam dentro da pasta `bot/`. A exceção é o envio ao Apps Script, que roda na raiz.

### 1. Cloudflare: criar o Worker e o banco

```bash
cd bot
npm install
npx wrangler login       # abre o navegador para você entrar na Cloudflare
npx wrangler deploy      # cria o Worker e o banco D1
npx wrangler d1 migrations apply controle-financeiro-bot --remote   # cria as tabelas
```

No fim do `deploy`, o wrangler mostra o endereço do seu Worker, algo como
`https://controle-financeiro-bot.SEU-USUARIO.workers.dev`. Anote esse endereço, porque ele vai no
passo 6. Na primeira vez na Cloudflare, o wrangler pode pedir que você escolha esse `SEU-USUARIO`.

> **Cuidado:** é `npx wrangler deploy` ou `npm run deploy`, nunca `npx deploy`. Sem o `wrangler`, o
> npx baixa e roda um pacote de terceiros que se chama `deploy`, que não tem nada a ver com isto.

O Worker sobe **fechado**. Sem os segredos dos próximos passos, ele recusa tudo.

### 2. Telegram: criar o bot

1. No Telegram, abra o **@BotFather**, o que tem o selo azul, e mande `/newbot`.
2. Escolha um nome, como "Controle Financeiro", e um usuário que termine em `bot`, como
   `meus_gastos_bot`.
3. Ele responde com o **token**, algo como `123456789:AAH...`. O token é a senha do bot: guarde num
   gerenciador de senhas e nunca mande em print nem cole em conversa nenhuma.

Perdeu o token? No BotFather, mande `/mybots`, escolha o seu bot e toque em **API Token**. Não toque
em **Revoke current token**, porque isso troca o token.

### 3. Segredos

São três, e nenhum vai no código nem no `wrangler.jsonc`:

| Segredo | Para que serve | De onde vem |
|---|---|---|
| `TELEGRAM_TOKEN` | deixa o bot ler e responder | o token do passo 2 |
| `SEGREDO_APPS_SCRIPT` | senha entre o Apps Script e o bot | você gera, logo abaixo |
| `TELEGRAM_USUARIO_PERMITIDO` | o único usuário que pode anotar gasto | o bot te diz, no passo 7 |

> **O prompt do wrangler não mostra o que você cola.** Se você colar duas vezes, ou der Enter antes
> de a colagem entrar, o segredo fica errado sem nenhum aviso, e o erro só aparece no passo 6. Cole
> **uma vez só**. Onde der, entregue o valor direto ao wrangler, como nos comandos abaixo.

**O token.** Copie o token, ou a mensagem inteira do BotFather, e rode:

```bash
npm run token
```

O script acha o token no que você copiou e confere com o Telegram se ele vale. Depois mostra o @ do
seu bot, grava o token no Worker sem passar pelo prompt e limpa a área de transferência. O token não
aparece na tela em momento nenhum. No Linux, ele precisa do `xclip` ou do `wl-clipboard`.

Prefere o jeito manual? Rode `npx wrangler secret put TELEGRAM_TOKEN` e cole o token uma vez só.

**A senha do Apps Script.** Este comando gera uma senha aleatória, entrega ao wrangler e mostra o
valor uma vez, para você copiar:

```bash
node -e "const s=require('crypto').randomBytes(32).toString('hex'),cp=require('child_process');cp.execSync('npx wrangler secret put SEGREDO_APPS_SCRIPT',{input:s,stdio:['pipe','inherit','inherit']});console.log('Copie para o BOT_SEGREDO do Apps Script: '+s)"
```

Guarde o valor no gerenciador de senhas, porque ele vai no passo 6. Rode o comando uma vez só: cada
execução gera outra senha.

> No Windows, para copiar direto sem o valor aparecer na tela, troque
> `console.log('Copie para o BOT_SEGREDO do Apps Script: '+s)` por `cp.execSync('clip',{input:s})`.

Para conferir, rode `npx wrangler secret list`. Devem aparecer os dois nomes; ele só mostra os nomes,
nunca os valores.

Não existe um quarto segredo para o webhook: o que prova que a mensagem veio do Telegram sai do
próprio token.

### 4. Publicar

```bash
npm run deploy
```

Os segredos continuam valendo depois de cada deploy.

### 5. Enviar o código ao Apps Script

Na **raiz** do projeto:

```bash
npm run push
```

Deu certo quando a lista enviada inclui `appsscript/Bot.gs` e a saída termina com "Código enviado
para o Apps Script.". Aqui não precisa de `publicar`, porque o gatilho do bot roda sempre o código
mais recente, não a versão publicada do app.

### 6. Ligar o bot no Apps Script

1. Abra o editor do Apps Script com `npx clasp open`, na raiz. Vá em ⚙ **Configurações do projeto >
   Propriedades do script** e crie:
   - `BOT_URL` = o endereço do passo 1, **sem barra no fim**;
   - `BOT_SEGREDO` = a senha do passo 3.
2. Abra o arquivo **Bot.gs**, escolha a função `ligarBot` na barra de cima e clique em
   **▷ Executar**. Não clique em **Depuração**, que para no meio do caminho.
3. O Google pede uma autorização nova, a de **conectar a um serviço externo**: é o `Bot.gs` falando
   com o bot. Se aparecerem caixas de seleção, marque todas.

O **Registro de execução** deve mostrar "Telegram ligado em …/telegram." e avisar que falta o
`TELEGRAM_USUARIO_PERMITIDO`. Nesse momento, o `ligarBot`:

- aponta o webhook do Telegram para o Worker;
- grava o menu do "/";
- cria o gatilho de um minuto;
- já manda as suas categorias e formas de pagamento para o bot.

Da próxima vez que você rodar `npm run publicar`, o app também vai pedir essa autorização, uma vez
só.

### 7. Seu ID

1. No Telegram, abra o seu bot (`t.me/<usuário do bot>`) e toque em **Começar**.
2. Ele responde "O seu ID do Telegram é …". Grave esse número, trocando `123456789` pelo seu:

   ```bash
   echo 123456789 | npx wrangler secret put TELEGRAM_USUARIO_PERMITIDO
   ```

   Vale em segundos, sem novo deploy.

Pronto: mande "mercado 40 débito" para o bot. Para parar o bot, rode `desligarBot` no editor.

## Se não funcionar

| O que aparece | Causa | O que fazer |
|---|---|---|
| `ligarBot`: "O bot respondeu 401" | o `BOT_SEGREDO` não é idêntico ao `SEGREDO_APPS_SCRIPT` | gere a senha de novo (passo 3) e cole o mesmo valor no `BOT_SEGREDO` |
| `ligarBot`: "O bot respondeu 404 em /telegram/configurar" | o `BOT_URL` tem barra no fim ou está errado | corrija a propriedade |
| `ligarBot`: "Configure BOT_URL e BOT_SEGREDO…" | uma propriedade ficou com o nome errado ou não foi salva | confira os nomes, em maiúsculas |
| "502 … setWebhook: 404 Not Found" | o token está malformado: colado duas vezes, com espaço ou sem o número | grave o token de novo (passo 3) |
| "502 … setWebhook: 401 Unauthorized" | o token tem o formato certo, mas está errado ou foi trocado no BotFather | copie de novo em `/mybots` > **API Token** |
| "409 … TELEGRAM_TOKEN" | o token não foi gravado | passo 3 |
| O bot não responde nada | o webhook não aponta para o Worker | rode o `ligarBot` de novo e leia o log; "Último erro do Telegram" diz o que houve |
| Responde, mas o gasto não entra no app | o gatilho falhou | veja **Execuções** no Apps Script. Depois de uma falha, o gatilho espera 1, 2, 4… até 60 minutos antes de tentar de novo, para não queimar a cota diária |
| "Ainda não recebi suas categorias" | o `ligarBot` não rodou, ou o `BOT_URL` ou o `BOT_SEGREDO` estão errados | passo 6 |

Para ver ao vivo o que chega ao Worker, rode `npx wrangler tail` e mande a mensagem de novo:

- "webhook com segredo inválido": o `TELEGRAM_TOKEN` mudou depois do último `ligarBot`. Rode-o de
  novo.
- "remetente fora da lista": o `TELEGRAM_USUARIO_PERMITIDO` está errado.
- "O Telegram recusou sendMessage: 401": o token está errado.

**O token vazou?** No @BotFather, `/revoke` gera outro. Copie o novo, rode `npm run token` e depois
o `ligarBot`.

## No dia a dia

```bash
npm test              # interpretação, segredos, Telegram e o Bot.gs com o Google simulado
npm run checar        # tipos
npm run dev           # Worker local com banco local; a IA não roda sem login
npm run deploy        # publica
npm run token         # grava um token novo, lido da área de transferência
npx wrangler tail     # log ao vivo do Worker publicado
```

- Mudou o `wrangler.jsonc` ou o `.dev.vars`? Rode `npm run tipos` para regerar o
  `worker-configuration.d.ts`.
- Mudou o menu do "/", em `src/telegram.ts`? Depois do deploy, rode o `ligarBot` de novo, porque é
  ele que grava o menu no Telegram.

## Custo

- **Telegram:** a API de bots é grátis.
- **Workers AI:** 10.000 neurons grátis por dia, e um gasto consome uns 47. No plano Free, passar da
  cota dá erro, não cobrança.
- **Gatilho:** roda 1.440 vezes por dia, e a conta Google gratuita tem 90 minutos diários de gatilho.
  Se apertar, troque `everyMinutes(1)` por `everyMinutes(5)` no `Bot.gs`.
