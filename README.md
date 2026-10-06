# Controle Financeiro

Aplicativo de gastos, dívidas e relatórios que roda **inteiro dentro da sua conta
Google**: a interface é servida pelo Google Apps Script e os dados moram em uma
Planilha Google sua.

- **Funciona no celular com o computador desligado** — não há servidor para manter no ar
- **Endereço fixo** — um link só, para sempre, que você fixa na tela inicial
- **Sem senha para inventar** — quem controla o acesso é o login da sua conta Google
- **Custo zero** — cabe folgado nas cotas gratuitas do Apps Script
- **Seus dados, legíveis** — é uma planilha comum; abra e edite à mão quando quiser

Não há chave de API, servidor de terceiro nem banco de dados para contratar. Você
instala na *sua* conta e ninguém além de você enxerga nada. A única exceção é o
[bot do Telegram](#bot-do-telegram-opcional), que é opcional.

---

## Instalação

### Antes: ligue a API do Apps Script

Abra **[script.google.com/home/usersettings](https://script.google.com/home/usersettings)**
e ative a chave **API Google Apps Script**. Uma vez na vida, por conta.

> Sem isso nada funciona, e de um jeito traiçoeiro: o `clasp` mostra o erro mas
> ainda escreve "Pushed N files" e sai como sucesso. Os scripts deste projeto
> detectam esse caso e param com uma mensagem clara.

### Depois: três comandos

Você precisa de [Node.js](https://nodejs.org) 18 ou mais novo.

```bash
git clone https://github.com/SEU-USUARIO/controle-financeiro.git
cd controle-financeiro

npm install        # baixa o clasp
npm run login      # abre o navegador para você entrar na conta Google
npm run instalar   # cria a planilha, envia o código e publica o app
```

O `npm run instalar` faz tudo sozinho: cria a Planilha Google já com o projeto do
Apps Script embutido, compila a interface, envia e publica o aplicativo web
(restrito à sua conta). No fim ele imprime os três links — planilha, editor e app.

Quer outro nome para a planilha? `npm run instalar "Minhas Finanças"`.

### Por último: dois cliques que o Google não deixa automatizar

**1. Autorize e configure.** Abra a planilha que o instalador criou e recarregue
(F5). No menu **💰 Controle Financeiro**, clique em **Configurar / reparar
planilha**.

O Google vai pedir autorização com uma tela que assusta — é o seu próprio script
pedindo acesso à sua própria planilha, e o aviso aparece para qualquer script que
não passou pela revisão da loja do Google. O caminho é:

> **Continuar** → escolha sua conta → **Avançado** →
> **Acessar Controle Financeiro (não seguro)** → **Permitir**

Depois de autorizar, o Google interrompe a execução. **Clique em "Configurar"
mais uma vez.** Terminou quando aparecer *"Planilha pronta e sincronização
ligada."*

**2. Coloque na tela inicial.** Abra o link do app no celular (logado na mesma
conta Google) e use **Adicionar à tela inicial**. Pronto.

> Perdeu o link? Menu **💰 Controle Financeiro → Abrir aplicativo**, dentro da planilha.

---

## Como funciona

```
    celular / computador
            │
            ▼
  script.google.com/…/exec        ← endereço fixo, protegido pela sua conta Google
            │
      Apps Script  (doGet serve o app · api() lê e grava)
            │
            ▼
     Planilha Google              ← o banco de dados
     Gastos · Dívidas · Pessoas · Categorias · Formas de Pagamento
```

### A rotina de atualização

App e planilha mexem nos mesmos dados, então existe um número de **revisão** que
sobe a cada mudança, venha de onde vier. O app guarda a última revisão que viu e
pergunta *"mudou alguma coisa?"* — uma resposta minúscula — sempre que:

- o app é aberto;
- você volta para ele (troca de aba, desbloqueia o celular, reabre o atalho);
- o celular reconecta à internet;
- passam 60 segundos com o app em primeiro plano;
- você registra, edita ou apaga qualquer coisa;
- você puxa a tela para baixo, ou toca em **Atualizar**.

Só quando a revisão mudou é que ele baixa tudo de novo. Como a carga vem inteira
de uma vez, navegar entre as telas e filtrar é instantâneo — só gravações vão ao
servidor.

Ao abrir, o app ainda **arruma o que foi digitado à mão** na planilha: dá ID para
linhas novas, preenche status e "Valor Pago" das dívidas e cadastra pessoas que
apareceram só na aba Dívidas. Um gatilho `onChange` faz o mesmo assim que você
edita pelo Sheets.

---

## Funcionalidades

- **Painel** — total do mês, dívidas em aberto, gastos por categoria e por forma
  de pagamento, tendência dos últimos 6 meses e lançamentos recentes.
- **Gastos** — data, título, categoria, valor, forma de pagamento e observação.
  Filtros e busca instantâneos.
- **Dívidas** — o que te devem e o que você deve, com pagamento parcial: cada
  pagamento abate do saldo e a dívida só fecha quando é quitada por inteiro.
- **Relatórios** — tabela do mês, totais por categoria e forma de pagamento,
  gráficos, e três saídas:
  - **Gerar na planilha** — cria a aba `Relatório` formatada; de lá o Google
    Sheets exporta para Excel, PDF ou CSV com um toque, inclusive no celular
  - **Baixar CSV** — pronto para o Excel brasileiro (`;` e vírgula decimal)
  - **Imprimir / PDF**
- **Ajustes** — categorias, formas de pagamento, pessoas e sincronização.
- **Bot do Telegram (opcional)** — anote gasto por mensagem ou nota de voz, sem
  abrir o app. Veja abaixo.

---

## Bot do Telegram (opcional)

Para anotar um gasto sem abrir o app, mande uma mensagem para um bot seu no
Telegram:

```
você:  mercado 40 débito
bot:   ✅ Anotado:
       • Mercado · R$ 40,00 · Débito · Mercado
```

Em até um minuto o gasto aparece no app e na planilha, com a observação
"Pelo Telegram".

### O que ele entende

| Você manda | Vira |
| --- | --- |
| `mercado 40 débito` | um gasto de hoje, no débito |
| `uber 23,50 pix ontem` | um gasto de ontem, no Pix |
| `padaria 12 no dinheiro e farmácia 35,90 no crédito` | dois gastos, cada um com a sua forma de pagamento |
| uma nota de voz curta | o mesmo, a partir do áudio transcrito |
| `/help` | exemplos, as suas categorias e as suas formas de pagamento |

- **Categoria e forma de pagamento** saem das listas do seu app, então o bot nunca
  inventa uma nova. Para escolher a categoria, é só dizer o nome dela na frase.
- **Data:** se a frase não fala em data ("ontem", "dia 3", "sexta", "03/10"), o
  gasto é de hoje.
- **Correção:** o bot não muda um gasto já anotado. Para corrigir, edite no app.

### Como funciona por dentro

```
  Telegram ──▶ Worker na Cloudflare ──▶ fila (banco D1)
                │  confere se a mensagem veio do Telegram e de você
                │  entende a frase com IA (Workers AI)
                │  responde ✅ na hora
                ▼
  Apps Script, a cada minuto ──▶ busca a fila ──▶ grava na Planilha
```

O bot é a **única parte que sai da conta Google**: um Worker grátis da Cloudflare,
que usa a IA da própria Cloudflare. Mesmo assim, ele nunca toca na planilha nem
chama o Google. Quem busca os gastos e grava é o Apps Script, pelo mesmo caminho do
app. Por isso:

- o app continua publicado como "somente eu";
- só o **seu** usuário do Telegram consegue anotar, e o bot ignora quem mais
  escrever;
- nenhuma senha fica no código. Os três segredos do bot moram no próprio Worker.

### Como ligar

Você precisa de uma conta no Telegram, de uma conta grátis na Cloudflare e de uns
15 minutos. O passo a passo completo, com o que aparece em cada etapa e o que fazer
se algo der errado, está em **[`bot/README.md`](bot/README.md)**. Em resumo:

1. **Cloudflare:** criar o Worker e o banco com `npx wrangler deploy`.
2. **Telegram:** criar o bot no @BotFather e guardar o token.
3. **Segredos:** gravar o token e uma senha gerada na hora no Worker.
4. **Publicar** o Worker e **enviar** o `Bot.gs` ao Apps Script.
5. **Ligar:** colar o endereço do Worker e a senha nas propriedades do script e
   rodar `ligarBot` no editor.
6. **Seu ID:** tocar em **Começar** no bot e gravar o número que ele mostra.

### Custo

Zero. A API de bots do Telegram é grátis, e a Cloudflare dá 10.000 "neurons" de IA
por dia; um gasto consome uns 47. No plano grátis, passar da cota dá erro, não
cobrança.

---

## Editando direto na planilha

Pode digitar à vontade nas abas **Gastos** e **Dívidas**, inclusive pelo app do
Google Sheets no celular. Preencha o que souber e **deixe o ID em branco** — o app
atribui um na próxima vez que abrir.

| Aba | O que preencher |
| --- | --- |
| Gastos | Data, Título, Categoria, Valor, Forma de Pagamento |
| Dívidas | Pessoa, Tipo (`Me devem` / `Eu devo`), Título, Valor, Data |

Nomes novos na coluna Pessoa são cadastrados sozinhos. Se algo ficar estranho, use
**Ajustes → Revisar planilha** dentro do app.

---

## Trazendo dados de outro lugar

Se você já controlava os gastos em outro sistema, monte um JSON e importe:

```bash
mkdir dados
#  … salve seu arquivo como dados/importar.json
npm run dados        # converte para appsscript/DadosIniciais.gs
npm run publicar     # envia
```

Depois, na planilha: **💰 Controle Financeiro → Importar dados de um arquivo JSON**.
O formato esperado está documentado no topo de
[`tools/gerar-dados-iniciais.mjs`](tools/gerar-dados-iniciais.mjs). A importação
roda uma vez só e não duplica nada se você repetir.

---

## Backup

O **histórico de versões** do Google Sheets (`Arquivo → Histórico de versões`) já
é o backup: dá para voltar a planilha a qualquer momento anterior. Para uma cópia
offline, `Arquivo → Fazer download → Excel`.

---

## Mexer no código

```bash
npm run dev        # interface no navegador, com um banco falso no localStorage
npm run publicar   # compila, envia e atualiza o app no ar (mesma URL)
```

Use **`npm run publicar`** sempre. O `npm run push` só manda o código, e isso não
muda o que você vê no celular: uma implantação fica presa à versão que existia
quando foi criada. O `publicar` cria a versão nova e reaponta a implantação.

Fora do Apps Script não existe `google.script.run` nem planilha, então o
`npm run dev` guarda tudo num banco de mentira no navegador
([`client/src/lib/mockLocal.js`](client/src/lib/mockLocal.js)) — serve para
ajustar a interface, não para uso real.

### Estrutura

```
├─ appsscript/           projeto do Apps Script (enviado pelo clasp)
│  ├─ Code.gs            doGet + canal único de dados (api)
│  ├─ Planilha.gs        a planilha como banco: abas, leitura, escrita
│  ├─ Api.gs             regras de gastos, dívidas, pessoas e cadastros
│  ├─ Relatorios.gs      relatório mensal, tendência e a aba Relatório
│  ├─ Normalizacao.gs    conserta o que foi digitado à mão
│  ├─ Sincronizacao.gs   revisão, gatilho onChange e menu da planilha
│  ├─ Importacao.gs      importação única de dados externos
│  └─ Bot.gs             busca os gastos do bot do Telegram a cada minuto
├─ bot/                  bot do Telegram: Worker da Cloudflare (opcional)
├─ client/               interface React + Vite + Tailwind
└─ tools/                build, envio e publicação
```

O `Index.html` do Apps Script é a interface inteira (React, CSS e tudo) embutida
num arquivo só pelo `vite-plugin-singlefile`, porque o Apps Script serve um HTML
apenas, sem pasta de assets. Ele é gerado no build e não fica versionado.

---

## Limites e cuidados

- **Abrir demora 2 a 4 segundos** — é o Google iniciando o script. Depois disso a
  navegação é imediata.
- **Não apague as abas nem renomeie as colunas.** Se acontecer, use
  **Ajustes → Revisar planilha** para recriar a estrutura.
- **Cotas**: contas gratuitas têm 90 minutos de execução de script por dia — muito
  mais do que uso pessoal consome.
- **`addMetaTag` do Apps Script aceita só quatro nomes** (`viewport`,
  `mobile-web-app-capable`, `apple-mobile-web-app-capable`,
  `google-site-verification`). Qualquer outro derruba a página inteira. Está
  comentado no `doGet`, mas fica o aviso para quem for mexer.

---

## Licença

MIT — veja [LICENSE](LICENSE). Use, modifique e compartilhe à vontade.
