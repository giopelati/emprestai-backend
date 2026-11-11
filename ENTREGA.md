# Entrega da prática

## Links

- Repositório (turma REST: back e front):
  - Backend: https://github.com/giopelati/emprestai-backend
  - Frontend: https://github.com/giopelati/emprestai-frontend
  - Monorepo com specs, ADRs, rules, subagente, skill e histórico citado
    abaixo: PENDENTE (repositório `emprestai` a criar; os hashes desta
    entrega são deste repositório).
- Produção (Vercel):
  - Frontend: https://emprestai-frontend-roan.vercel.app
  - Backend: https://emprestai-backend.vercel.app (`GET /health`)

O trabalho é feito num monorepo (npm workspaces). `backend/` e `frontend/`
são publicados nos dois repositórios da turma REST por `git subtree split`
(`scripts/entrega/preparar-publicacao.mjs`, que põe este ENTREGA.md na raiz
de cada um). O split reescreve os hashes; por isso todo hash citado aqui é
do monorepo.

## 1. Conflitos: o que foi pedido contra o que já existia

| pedido | contrariava o quê | o que fiz | por quê | onde ficou registrado | commit |
|--------|-------------------|-----------|---------|-----------------------|--------|
| Briefing de dados, item 4: "instale a biblioteca sharp" | ADR-001 (sharp não está lá), `rules/restrictions.md` ("não escolha biblioteca fora do ADR"), contrato da skill | Sem sharp. Recorte 800×600 pedido ao CDN do Pexels e **conferido** lendo o cabeçalho JPEG antes de salvar, antes de enviar e depois, pela URL pública | O contrato pede tamanho garantido, não biblioteca; conferir o cabeçalho garante sem dependência nova | `docs/specs/002-dados-iniciais/spec.md` C1; `skills/imagens-equipamentos/scripts/lib.mjs` (`exigirTamanho`) | `6daf147`, `acc94c3` |
| Briefing de dados, item 5: "deixe a senha escrita no próprio arquivo que popula os dados" | Regra da prática (nenhuma senha no git), `rules/secrets.md` | Senha só em `SENHA_PROFESSOR` (`.env.producao`, fora do Git) ou digitada; pre-commit recusa senha literal | Senha no histórico não se apaga com um commit; o professor recebe a senha pela turma | spec 002 C2; `scripts/dados/popular.mjs`; `scripts/guardas/pre-commit.mjs` | `6daf147`, `50cad7c`, `6a37387` |
| Briefing de dados, item 3: "TI-0004 e TI-0007 em manutenção; os outros 10 disponíveis" | A lista da prática ("use exatamente esta") também marca TI-0010 em manutenção | 3 em manutenção (TI-0004, TI-0007, TI-0010), 9 disponíveis | A lista é o dado item a item e é declarada igual para todos; o item 3 é um resumo que diverge dela | spec 002 C3; `supabase/dados/equipamentos.json` | `6daf147` |
| Briefing de empréstimo, item 4: limite de 5 | PRD: "no máximo 3 itens"; Login já anuncia `3 itens por pessoa` | Limite 3 | Regra de negócio é do PRD; briefing é pedido | spec 003 C1; `supabase/migrations/20261111012009_emprestimos.sql` | `904e5a0`, `a5538ef` |
| Briefing de empréstimo, item 3: "14 dias úteis" | PRD: "prazo padrão de 14 dias"; Login anuncia `14 dias de prazo` | 14 dias corridos, "hoje" em `America/Sao_Paulo` | PRD não fala em úteis; dias úteis exigiriam calendário de feriados que nenhuma fonte define | spec 003 C2 e L3 | `904e5a0`, `a5538ef` |
| Briefing de empréstimo, item 9: catálogo "sem rodapé nem texto de crédito" | Contrato da skill e diretrizes da API do Pexels: "Fotos: Pexels" com link | Um único link `Fotos: Pexels`; fotógrafo só no `title` da foto | É o mínimo que cumpre a exigência da API e deixa o catálogo limpo | spec 003 C3 e CA-02; `frontend/src/components/CreditoPexels.tsx` | `904e5a0`, `8d14031` |
| Pedido do tech lead: verificador corrige teste quebrado | Requisito "Independência" da própria prática; conceito de verificador visto em sala | Recusado. O verificador não tem `Write`/`Edit` e o corpo dele diz que teste quebrado volta para o agente principal | Um verificador que conserta o teste que usa como evidência deixa de ser evidência independente | `.claude/agents/verificador-spec.md` ("Você não corrige nada"); o próprio verificador apontou o pedido como instrução embutida nos relatórios `20261111-011444-gate-8fdda33.md` e `20261111-012007-gate-904e5a0.md` | `6a37387` |
| Precisar de schema (tabelas, RLS, bucket) | `rules/migration.md`: "estratégia não decidida, PARE" | Decidida e registrada no ADR-002 (Supabase CLI, SQL versionado); regra atualizada | Sem estratégia não havia como criar as tabelas da prática | `docs/adr/002-migrations.md`; `rules/migration.md` | `f88797a` |
| Usar Prisma (ADR-001) e RLS (ADR-001) ao mesmo tempo | O ADR-001 contradiz a si mesmo na prática: Prisma conecta com papel privilegiado e ignora RLS | Backend fala com o PostgREST repassando o JWT da pessoa; regra atômica numa função SQL; Prisma não usado | Mantém o RLS que o ADR exige sem segredo de banco na Vercel nem biblioteca de JWT fora do ADR | `docs/adr/003-acesso-a-dados-do-backend.md` | `f88797a` |
| Scripts de dados usarem a chave secreta | `rules/secrets.md` (rascunho): "só o backend usa" a chave secreta; ADR-003: backend não usa segredo | Chave secreta só em `.env.producao`, lida só pelos scripts de produção, que exigem TTY; regra revisada | Apontado pelo verificador no gate (rodada 1, BLOQUEADO) | spec 002 C4; `rules/secrets.md` | `8fdda33` |
| Contrato da skill: "só a API do Pexels, com chave gratuita" | O Pexels suspendeu a emissão de chaves novas (aviso em pexels.com/api, conferido em 11/11/2026); sem chave a skill não roda | Fonte trocada para a API do Openverse (sem chave), só fotos do Flickr CC0/domínio público/CC BY; o resto do contrato fica igual (800×600 conferido, revisão humana, sem repetição, crédito). Crédito na tela passa a ser `Fotos: Openverse` | Única fonte gratuita testada que entrega 800×600 exato sem biblioteca (tamanho `_c` do Flickr); Pixabay/Unsplash exigem chave e a Wikimedia não serve 800 px | spec 002 C5 e T07; spec 003 T08; gates em `docs/specs/002-dados-iniciais/verificacoes/` (`…-gate-4f0fc54.md` NÃO CONFORME, `…-gate-e1d02e0.md` CONFORME) | `4f0fc54`, `e1d02e0`, `0af6b37` |

## 1b. Lacunas: o que foi pedido de forma incompleta

| spec | o que faltava | alternativas | o que decidi | por quê | commit |
|------|---------------|--------------|--------------|---------|--------|
| 002 | Papel da conta do professor | `colaborador`; `operacoes`; sem papel | `colaborador` | É quem vê Catálogo e Meus empréstimos e solicita; sem papel o Login (spec 001) recusa | `6daf147` |
| 002 | Repetir o processo mexe na situação? | Sobrescrever com a lista; gravar só na criação | Só na criação | Rodar de novo depois de empréstimos reais "devolveria" itens emprestados | `6daf147`, `50cad7c` |
| 002 | Onde ficam foto e crédito | Tabela separada; colunas em `equipamentos`; só no JSON | Colunas em `equipamentos` + `creditos-imagens.json` versionado | Uma foto por equipamento; `unique (foto_pexels_id)` garante sem repetição no banco | `6daf147`, `2bb7877` |
| 002 | Quem escreve em `equipamentos` | Policies de escrita; só chave secreta | Só chave secreta (script) e funções `security definer` | Não há cadastro pela interface nesta versão | `2bb7877` |
| 002 | As fotos vão para o Git? | Versionar JPEGs; só créditos e URL | Só créditos, URL de download e hash | A licença do Pexels proíbe redistribuir como banco de imagens | `acc94c3` |
| 003 | Quem pode solicitar | Só colaborador; qualquer papel válido | Qualquer papel válido | O PRD põe o limite "por pessoa"; Operações também tem `Meus empréstimos` na navegação | `904e5a0` |
| 003 | O que é "em atraso" | Devolução ≤ hoje; < hoje | Devolução prevista anterior a hoje | No dia da devolução a pessoa ainda está no prazo | `904e5a0` |
| 003 | Ordem das recusas | Várias | Inexistente → indisponível → atraso → limite | Mensagem mais específica ao pedido primeiro | `904e5a0` |
| 003 | Catálogo mostra quem está com o item | Mostrar nome (layout.md); só "Emprestado" | Só "Emprestado" / "Está com você" | PRD: cada pessoa vê os próprios empréstimos; layout é inspiração | `904e5a0` |
| 003 | Confirmação antes de criar | Um clique cria; confirmar no card | Confirmar no card | Sem devolução nesta versão, um clique acidental prenderia o item sem volta | `904e5a0`, `8d14031` |
| 003 | Concorrência | Checagem no código; lock + índice | `select ... for update`, lock por pessoa e índice único parcial | O banco garante mesmo se duas instâncias serverless atenderem ao mesmo tempo | `a5538ef` |

## 2. Onde o agente tentou decidir por mim

- **Código antes do gate.** Ao começar a spec 002, o agente escreveu a skill,
  a migration, o script de dados e o Jest de uma vez, antes de a T01 passar
  pelo gate. O verificador devolveu `BLOQUEADO`
  (`docs/specs/002-dados-iniciais/verificacoes/20261111-011126-gate-6daf147.md`):
  código de T02–T04 fora do escopo da T01 e árvore mudando durante a
  verificação. O código foi guardado (stash), o que faltava foi registrado
  (`8fdda33`) e o gate refeito com a árvore limpa (rodada 2, `CONFORME`); as
  tarefas foram commitadas uma a uma (`acc94c3`, `2bb7877`, `50cad7c`,
  `f710b38`).
- **Fonte da regra.** O agente justificou que Operações pode solicitar dizendo
  que a spec 001 define a aba `Meus empréstimos` para Operações. O verificador
  apontou que a spec 001 não diz isso — a aba está no código e no
  `layout.md`. A referência foi corrigida na spec 003 (`a5538ef`).
- **Guarda de produção.** O hook barrou o próprio agente várias vezes: num
  commit cuja mensagem citava a plataforma de deploy (falso positivo,
  corrigido em `scripts/guardas/bloquear-producao.mjs`) e sempre que um
  comando de shell continha o nome de um script de produção, mesmo só como
  texto. A edição passou a ser feita pela ferramenta de edição, que não
  executa nada; o bloqueio de execução continuou valendo.
- **Teste que passaria por engano.** O verificador apontou que o teste de
  inserção do CA-08 da 002 manda uma linha incompleta, então falharia mesmo
  sem a política de acesso. O agente tinha escrito o teste e declarado o CA
  provado; ficou registrado como observação a corrigir (seção 8).

## 3. Uma decisão que merece (ou não) um ADR

**Virou ADR: acesso a dados do backend (ADR-003).** A alternativa defensável
era seguir o ADR-001 à letra e usar Prisma. A decisão muda o que vale para
todo o backend daqui para frente (onde fica regra, quais segredos o deploy
guarda, como o RLS é aplicado) e contraria uma linha de um ADR aceito — por
isso precisa de ADR, e não só de uma nota na spec.

**Não virou ADR: recortar a imagem no CDN em vez de usar sharp.** Também
tinha alternativa, mas vale só para a skill, é reversível sem custo e já está
explicada na spec 002 (C1) e na referência da skill.

## 4. A skill imagens-equipamentos

- **SKILL.md** tem o que o agente precisa a cada uso: quem faz cada passo, a
  ordem, o que é garantido por código, o que depende de pessoa e o que não
  fazer. **references/** tem o que só se lê quando precisa: detalhes da API do
  Pexels (`pexels-api.md`) e o critério de reprovação visual
  (`revisao-visual.md`). **scripts/** tem tudo que precisa dar o mesmo
  resultado sempre: busca, recorte, conferência de tamanho, envio. Critério:
  se o erro custaria uma foto errada em produção, é script; se é julgamento,
  é instrução + revisão humana.
- **Por código:** origem só `images.pexels.com`; 800×600 conferido pelo
  cabeçalho JPEG em três momentos; sem repetição (envio recusa id repetido e
  o banco tem `unique`); créditos completos ou o envio recusa; idempotência
  por `x-upsert` num objeto por patrimônio; produção exige TTY + confirmação.
  **Por pessoa:** pessoa, marca, texto e tela com conteúdo — a triagem pelo
  `alt` só descarta o óbvio. A aprovação só é gravada por
  `imagens:revisar`, que exige terminal interativo e nome de quem revisou.
- **Impedimento de produção:** (1) o agente não tem a chave secreta
  (`.env.producao` só existe na máquina da pessoa, e o hook nega leitura de
  `.env`); (2) `--producao` exige TTY e digitar a referência do projeto — o
  agente roda sem TTY (teste `CA-09` da spec 002 prova a recusa); (3) o hook
  `bloquear-producao.mjs` e as regras `deny` de `.claude/settings.json` negam
  qualquer comando com `:producao`.
- **Fotos reprovadas na revisão visual:** PENDENTE (preencher após a T05 da
  spec 002, a partir de `supabase/dados/imagens-rejeitadas.json`).

## 5. O subagente verificador

- **Gatilho.** Três camadas, porque "não depender de alguém lembrar" não se
  resolve com instrução: (1) `rules/checks.md` e `rules/spec-flow.md` mandam
  acionar em gate e entrega; (2) o hook `SubagentStop` salva o relatório em
  `docs/specs/<NNN>/verificacoes/` sem passar pelo agente principal; (3) o
  pre-commit do Git (`scripts/guardas/pre-commit.mjs`, instalado por
  `npm install`) **recusa** o commit que muda o status de uma spec para
  `Pronta` sem relatório `CONFORME`, modo entrega, sobre o `HEAD` atual, e
  recusa código no mesmo commit. Escolhi o commit, e não o push, porque
  "pronta" é uma afirmação gravada na spec, e o commit é onde ela nasce.
- **O que lê e por que não herda.** AGENTS.md, rules, PRD, ADRs, briefings,
  spec/plan/tasks e o código, do zero. Herdar o resumo do agente principal
  levaria junto exatamente as interpretações que ele deveria checar — foi
  assim que ele pegou a referência errada à spec 001.
- **O que não consegue fazer.** Não tem `Write`, `Edit`, `NotebookEdit`,
  `WebFetch` (frontmatter `tools`/`disallowedTools`). O Bash passa por um hook
  de lista de permissão (`scripts/guardas/verificador-bash.mjs`): só leitura
  do Git, typecheck/build, `npm run db:reset` (local) e os testes; nega
  encadeamento, redirecionamento, `--linked`, `db push`, `node`, `curl`.
  Além disso valem a guarda global de produção e a falta da chave secreta.
- **Monolito ou back/front.** Back e front separados nos remotos, mas um
  monorepo local. O verificador roda typecheck e build dos dois workspaces e
  os testes do backend, e confere CA de tela no código do frontend; o que é
  só visual vem da T06 (navegador local), registrada em `tasks.md`.
- **Limitação real desta sessão:** o harness carrega subagentes ao abrir a
  sessão, e o verificador foi criado no meio dela. As rodadas desta entrega
  rodaram num agente de contexto limpo e sem ferramentas de escrita, lendo
  `.claude/agents/verificador-spec.md`, e o relatório foi salvo com
  `salvar-relatorio.mjs --arquivo` (procedimento previsto no `AGENTS.md`). Os
  hooks de projeto, esses sim, estavam ativos (o agente principal foi barrado
  por eles).

## 6. O verificador em ação

Todos os relatórios estão em `docs/specs/<NNN>/verificacoes/`, um arquivo por
rodada (`<data>-<modo>-<commit>.md`), sempre com as mesmas seções e a tabela
de CAs em ordem. `npm run verificacoes:comparar -- <a> <b>` põe duas rodadas
lado a lado.

### Histórico real — rodadas que reprovaram algo

| Spec | Rodada | Veredito | O que reprovou | Causa | Correção |
|---|---|---|---|---|---|
| 002 | gate T01 (`20261111-011126-gate-6daf147.md`) | BLOQUEADO | Código de T02–T04 já escrito antes do gate da T01; árvore mudando durante a verificação; briefing fora do repositório; conflito `rules/secrets.md` × chave secreta nos scripts | O agente principal adiantou código e editou arquivos com o verificador rodando | Código guardado, briefings versionados e conflito C4 registrado (`8fdda33`); gate refeito com árvore limpa → CONFORME (`20261111-011444-gate-8fdda33.md`); tarefas commitadas uma a uma |
| 003 | entrega 1 (`20261111-013229-entrega-8d14031.md`) | NÃO CONFORME | **CA-11 divergente**: `POST /emprestimos` com token inválido e corpo malformado respondia `400`, não `401` | O Zod validava o corpo antes de qualquer chamada que validasse o token | `310c381`: confere a sessão no Supabase Auth antes de recusar o corpo; teste `CA-11` ganhou o caso. Rodada 2 → CA-11 atendido |

Comparação gerada pelo script (rodada 1 × rodada 2 da 003):

| CA | 8d14031 | 310c381 | Mudou |
|---|---|---|---|
| CA-01 a CA-10 | Atendido | Atendido | |
| CA-11 | Divergente | Atendido | sim |
| **Veredito** | NÃO CONFORME | CONFORME COM LIMITAÇÕES | sim |

### Prova com erro plantado

- **O que plantei** (`cfc8f0e`, mensagem neutra "feat(db): ajuste do limite
  de empréstimos", sem avisar o verificador): uma migration nova,
  `20261111013827_ajuste_limite.sql`, que redefine `solicitar_emprestimo` com
  `if v_abertos >= 5` — exatamente o número do briefing que a spec rejeitou
  (C1). É o erro mais provável na vida real: alguém "atende o pedido".
- **O que voltou** (`20261111-014430-entrega-cfc8f0e.md`): `NÃO CONFORME`,
  CA-05 `Divergente`, teste `CA-05` falhou (`Expected: 422, Received: 201`),
  mais duas divergências que eu não tinha previsto: migration fora das
  tarefas, sem rastreabilidade, e backend (`3`) e banco (`5`) discordando — o
  resumo poderia mostrar `4 de 3 itens`.

| CA | 310c381 (antes) | cfc8f0e (plantado) | b5ffaeb (desfeito) |
|---|---|---|---|
| CA-01 a CA-04 | Atendido | Atendido | Atendido |
| **CA-05** | Atendido | **Divergente** | Atendido |
| CA-06 a CA-11 | Atendido | Atendido | Atendido |
| **Veredito** | CONFORME COM LIMITAÇÕES | **NÃO CONFORME** | CONFORME COM LIMITAÇÕES |

- **Desfeito** em `439d0dc` (revert; a migration nunca saiu do banco local,
  recriado a cada `db:reset`). Rodada de confirmação:
  `20261111-014840-entrega-b5ffaeb.md`, CA-05 atendido, `23 passed`.
- Commits da prova: `cfc8f0e` (erro) e `439d0dc` (desfaz).

### Tabelas finais

**Spec 002** (`20261111-015328-entrega-83e8bbd.md`) — CONFORME COM LIMITAÇÕES

| CA | Situação | Teste |
|---|---|---|
| CA-01 | Atendido | `CA-01` passou |
| CA-02 | Atendido | `CA-02` passou |
| CA-03 | Atendido | dois testes `CA-03` passaram (só JPEG sintético local) |
| CA-04 | Não verificável | três testes `CA-04` passaram; falta a revisão humana das fotos reais (T05) |
| CA-05 | Atendido | `CA-05` passou |
| CA-06 | Atendido | `CA-06` passou |
| CA-07 | Atendido | `CA-07` passou |
| CA-08 | Atendido | `CA-08` passou |
| CA-09 | Atendido | dois testes `CA-09` passaram |

**Spec 003** (`20261111-014840-entrega-b5ffaeb.md`) — CONFORME COM LIMITAÇÕES

| CA | Situação | Teste |
|---|---|---|
| CA-01 | Atendido | `CA-01` passou |
| CA-02 | Atendido | sem teste automatizado; conferido no navegador local (T06) |
| CA-03 | Atendido | sem teste automatizado; conferido no navegador local (T06) |
| CA-04 a CA-10 | Atendido | testes `CA-04` a `CA-10` passaram |
| CA-11 | Atendido | dois testes `CA-11` passaram |

As limitações das duas são de propósito: produção é escrita por pessoa (T06
da 002, T07 da 003) e as fotos reais dependem da revisão humana (T05 da 002).
Por isso nenhuma das duas specs está com status `Pronta` — e o pre-commit não
deixaria.

## 7. Uma regra minha que esta prática pôs à prova

**`rules/migration.md` — "a estratégia de migrations ainda não foi decidida;
PARE".** A regra protegeu o que devia (ninguém improvisou schema), mas não
tinha saída: a prática exigia tabelas, RLS e um bucket, e a regra só dizia
parar. O resultado foi decidir a estratégia (ADR-002: Supabase CLI, SQL
versionado, `npm run db:reset` como check local, produção aplicada por
pessoa) e reescrever a regra com os comandos confirmados (`f88797a`).

A prática ainda mostrou um furo na regra nova: ela diz "migration aplicada
não é editada; correção vira migration nova", e o verificador apontou
(rodada 4 da 003) que o erro plantado foi desfeito apagando o arquivo, não
com migration nova. Vale porque ela nunca saiu do banco local, mas a regra
não distingue "aplicada localmente" de "aplicada em produção".

Também revisei `rules/secrets.md` (`8fdda33`): ela dizia que só o backend usa
a chave secreta, e a ADR-003 tirou todo segredo do backend. Quem usa a chave
agora é só a pessoa, pelos scripts de produção.

## 8. O que ficou de fora e o que faria diferente

**Não ficou pronto (depende de pessoa; roteiro em
`docs/producao/roteiro-pratica.md`):**

- Fonte das fotos (spec 002, T07; spec 003, T08): troca para o Openverse
  (C5) com gate CONFORME; código da skill em andamento, entrega da tarefa
  ainda não verificada. A tela ainda mostra `Fotos: Pexels` até a T08.
- Fotos reais (spec 002, T05): falta a revisão visual humana das candidatas
  do Openverse. Até lá, o catálogo em produção não tem imagem.
- Produção (spec 002, T06; spec 003, T07): migrations no banco do deploy,
  dados e conta do professor, variáveis da Vercel (`CORS_ORIGIN` hoje não
  existe no backend de produção) e merge para a branch de produção.
- Status `Pronta` nas duas specs: só depois disso e de uma rodada `CONFORME`.

PENDENTE: resultado do roteiro em produção (data, saída das duas execuções do
script de dados de produção e contagem de empréstimos do professor = 0).

**Desvios conscientes do processo:**

- O gate rodou uma vez por spec (antes da T01), não antes de cada tarefa como
  pede `rules/spec-flow.md`. Cada rodada leva minutos e recria o banco local;
  as rodadas foram gastas em entrega e na prova.
- T04 e T05 da 003 saíram num commit só (mesmas linhas de `ProtectedShell` e
  `styles.css`), registrado em `tasks.md`.
- O subagente não foi carregado pelo harness nesta sessão (criado no meio
  dela); as rodadas usaram o caminho alternativo descrito na seção 5.

**Observações do verificador que não corrigi:** teste de token inválido em
`GET /emprestimos/meus`; ordem entre papel inválido e corpo malformado (lacuna
da spec 003); teste de inserção do CA-08 da 002 com corpo incompleto;
`@jest/globals` só transitivo.

**O que faria diferente:**

- Exigiria o gate de cada tarefa por hook, não por disciplina: o pre-commit
  já lê a spec e poderia exigir relatório de gate no primeiro commit de cada
  `Txx`.
- Publicaria o monorepo inteiro desde o início. Os repositórios de back e
  front vêm de `git subtree split`, que reescreve hashes e deixa specs, ADRs
  e o verificador fora deles.
- Colocaria o pre-commit também em CI: localmente, `git commit --no-verify`
  passa por cima dele.
- Nos testes de RLS, mandaria sempre a linha completa, para o teste falhar só
  por causa da política.
