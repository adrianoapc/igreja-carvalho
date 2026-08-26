# 📋 PLANO: Remoção do Make.com do Pipeline WhatsApp

**Data de criação:** 26/08/2026
**Status:** 🟡 Fase 1 planejada (aguardando execução)
**ADR relacionada:** [ADR-033](../adr/ADR-033-remocao-make-com-pipeline-whatsapp.md)
**Prioridade:** Média — custo recorrente + ponto de falha externo sem visibilidade

---

## 🎯 OBJETIVO

Substituir o Make.com por uma Edge Function própria (`whatsapp-webhook`)
como ponto de entrada/saída entre a Meta WhatsApp Cloud API e as Edge
Functions do Supabase, sem reescrever a lógica de negócio já validada
(sessão, triagem por IA, financeiro).

Este plano cobre **6+ cenários Make diferentes**, descobertos validando
blueprint real por blueprint contra o código nesta sessão — não é 1 fluxo
único. Por isso está fatiado em fases, cada uma = 1 PR, seguindo o
guardrail do projeto.

---

## 📊 ESTADO ATUAL (confirmado por export real + varredura de código)

| # | Cenário Make | Estado do export | Edge function(s) | Fase |
|---|---|---|---|---|
| 1 | Waba Chatbot - OakOS (triagem + financeiro) | ✅ Exportado e comparado | `chatbot-triagem`, `chatbot-financeiro` | **Fase 1** |
| 2 | Waba Escalas OakOS | ✅ Exportado | `disparar-escala` | Fase 2 |
| 3 | Waba Feelings OakOS (sentimento/OTP/lembrete/manual) | ✅ Exportado | `disparar-alerta`, `criar-usuario`, `inscricoes-lembrete-evento` | Fase 2 |
| 4 | Pedido de oração | ❌ Não exportado — suspeita forte de já estar morto | `receber-pedido-make` (parada desde 2026-06-23) | Fase 3 (auditoria) |
| 5 | Testemunho | ❌ Não exportado — suspeita forte de já estar morto | `receber-testemunho-make` (parada desde 2025-12-29) | Fase 3 (auditoria) |
| 6 | Liturgia | ❌ Não exportado, estado desconhecido ("tudo mato") | `notificar-liturgia-make` | Fase 3 (auditoria) |
| 7 | Check-in por geolocalização | ❌ Não exportado, estado desconhecido | `checkin-whatsapp-geo` | Fase 3 (auditoria) |
| 8 | Alerta emocional (caminho legado) | ❌ Não exportado, relação com #3 não confirmada | `verificar-sentimentos-criticos` | Fase 3 (auditoria) |

**Por que #4 e #5 são suspeitos de já estarem mortos**: `chatbot-triagem`
(mantida ativamente, último commit 2026-08-18) já classifica intenção via
IA (`PEDIDO_ORACAO`, `TESTEMUNHO`, `SOLICITACAO_PASTORAL`) e grava direto
em `pedidos_oracao`/`testemunhos`/`atendimentos_pastorais`, sem tocar no
Make. As duas functions `receber-*-make` (que recebem chamadas DO Make)
não têm commit recente correspondente a esse trabalho — indício de que
ficaram órfãs quando a lógica migrou pra dentro de `chatbot-triagem`, mas
**precisa de confirmação antes de apagar** (ver Fase 3).

---

## 🛠️ FASE 1 — Cenário "Waba Chatbot" (triagem + financeiro)

Único cenário com export real validado ponta a ponta. Detalhe completo das
decisões de design está na [ADR-033](../adr/ADR-033-remocao-make-com-pipeline-whatsapp.md);
aqui só o checklist de execução.

### Passo 1 — Nova Edge Function `whatsapp-webhook`

Arquivo novo: `supabase/functions/whatsapp-webhook/index.ts`,
`verify_jwt=false` em `supabase/config.toml`.

- [ ] `GET` — handshake `hub.verify_token`/`hub.challenge` contra novo
  segredo `WHATSAPP_VERIFY_TOKEN`. Sem `hub.mode`, responde 200 simples
  (health check).
- [ ] `POST` — valida `X-Hub-Signature-256` com `META_APP_SECRET` **antes**
  de fazer parse do corpo (validação nova — o Make não faz isso hoje).
- [ ] **Normaliza o envelope bruto da Meta antes de rotear** (achado real
  de `@codex review`, P1 — sem isso mensagem comum chega sem telefone/
  conteúdo e falha ou cria sessão inválida). O `POST` da Meta chega como
  `entry[].changes[].value.{messages[],contacts[],metadata}` — hoje o
  conector nativo do Make já achata isso pro Make por baixo dos panos;
  a nova função precisa fazer essa extração explicitamente:
  - **Itera TODOS os itens, não só o primeiro** (achado real de `@codex
    review`, P2): a Meta pode entregar mais de um `entry`/`change`/
    `message` numa única notificação (batch). Extrair só `messages[0]`
    e responder 200 pro payload inteiro descarta o resto
    silenciosamente. Iterar `entry[].changes[].value.messages[]` e
    aplicar roteamento + dedupe (item abaixo) em cada mensagem,
    independente.
  - `phone_number_id` ← `value.metadata.phone_number_id`
  - `whatsapp_number`/`display_phone_number` ← `value.metadata.display_phone_number`
    (achado real de `@codex review`, P1 — **obrigatório pro número
    financeiro**: `chatbot-financeiro` deriva `filialIdFromWhatsApp`
    exclusivamente de `body.whatsapp_number`/`body.display_phone_number`,
    `index.ts:613-635` — não aceita `filial_id` já resolvido. Sem
    repassar esse campo, toda operação financeira grava com filial nula,
    mesmo a `whatsapp-webhook` já tendo achado a rota certa por
    `phone_number_id`)
  - `telefone` ← `value.messages[].from`
  - `nome_perfil` ← `value.contacts[].profile.name`
  - **`origem_canal: "whatsapp_financeiro"` fixo pro número financeiro**
    (achado real de `@codex review`, P1, 17ª rodada — o Make hoje já
    manda esse valor, `MAKE_WHATSAPP_PHONE_NUMBER_ID.md:195-205`, e
    `chatbot-financeiro` usa ele pra achar a sessão ativa,
    `index.ts:804-818`; sem mandar, o handler cai no default
    `"whatsapp"`, `index.ts:665-666`, e TODA conversa financeira em
    andamento no momento do corte fica invisível — vira sessão nova do
    zero em vez de continuar de onde parou)
  - `tipo_mensagem` ← `value.messages[].type` **E também `tipo`** ←
    mesmo valor (achado real de `@codex review`, P1, 6ª rodada — mesmo
    padrão do achado do campo de texto: `chatbot-triagem` lê
    `tipo_mensagem`, mas `chatbot-financeiro` lê especificamente `tipo`
    — `body.tipo`/`index.ts:656-674` — e os 3 branches de anexo dela
    testam `tipo === "image" || tipo === "document"`,
    `index.ts:1113-1116,1300-1304,2193-2195`. Mandar só `tipo_mensagem`
    faz `chatbot-financeiro` pular processamento de anexo mesmo com
    `url_anexo` presente). Mandar os dois campos com o mesmo valor pros
    dois chatbots, não um campo por function.
  - `mensagem`/`conteudo_texto` ← `value.messages[].text.body` (achado
    real de `@codex review`, P1 — a checklist original enumerava os
    outros campos flat mas esquecia este; sem ele o texto nunca chega,
    os dois chatbots recebem mensagem vazia e podem criar/avançar sessão
    incorretamente com conteúdo em branco)
  - **Anexo é tratado diferente em cada function — não existe campo
    único "media_id" que sirva pros dois** (achado real de `@codex
    review`, P1). O envelope bruto da Meta **nunca** tem uma URL de
    anexo, só um `id` opaco por tipo (`image.id`/`video.id`/`audio.id`/
    `document.id`) — resolver pra URL exige uma chamada própria à Graph
    API (`GET /v21.0/{media-id}` com o token) que hoje o conector nativo
    do Make faz por baixo dos panos (por isso o blueprint real mostra
    `document.url` — é o Make já resolvido, não o payload cru da Meta):
    - `chatbot-triagem` (`index.ts:1034-1035`) só usa mídia pra
      `tipo_mensagem === "audio"`, e já resolve sozinha via Graph API
      dado um `media_id` bruto (`processarAudio`, `index.ts:388`) — pra
      esse caso, repassar `media_id` cru, sem resolver antes.
    - `chatbot-financeiro` (`index.ts:676-685`) **não lê `media_id`
      nenhum** — só aceita `url_anexo` (ou aliases) já como URL
      resolvida. Pra imagem/documento indo pro número financeiro, a
      `whatsapp-webhook` precisa resolver o `media_id` → URL via Graph
      API ela mesma, ANTES de chamar `chatbot-financeiro`, e mandar o
      resultado como `url_anexo` — não repassar o `id` cru.
  - **Filtra eventos que não são mensagem, E tipos de mensagem sem
    suporte** (achado real de `@codex review`, P2, 14ª rodada — o
    filtro original só cobria `statuses[]`; a Meta também entrega
    `messages[].type` como `interactive`/`button`/`reaction`/
    `location`/`contacts`/`sticker`, nenhum coberto pela extração de
    `text.body`/mídia acima. Sem allowlist, esses tipos passam com
    `mensagem=""` e são roteados mesmo assim — `chatbot-triagem`
    processa string vazia contra a sessão ativa,
    `index.ts:987-994`, gerando resposta sem sentido ou avançando
    histórico com "mensagem" vazia do usuário). Allowlist explícita de
    tipos suportados (`text`, `audio`, `image`, `document`); qualquer
    outro tipo responde 200 sem rotear, igual ao tratamento de
    `statuses[]`.
- [ ] Resolve `igreja_id`/`filial_id` e destino via `phone_number_id` já
  extraído — **não** por palavra-chave (roteamento real do Make é por
  número, confirmado no export; não existe lógica de keyword).
- [ ] Roteia pros dois números reais: `1031291743394274` →
  `chatbot-financeiro`, `745419461981790` → `chatbot-triagem`,
  **mandando o header `x-webhook-secret: MAKE_WEBHOOK_SECRET`** (achado
  real de `@codex review`, P1 — inconsistência entre este passo e o
  Passo 2: fechar os dois endpoints com fail-closed sem a
  `whatsapp-webhook` enviar o segredo faz as duas chamadas voltarem 401
  logo depois do corte). Cobrir isso explicitamente nos testes do
  Passo 4.
- [ ] Normaliza a resposta na camada de orquestração: `chatbot-financeiro`
  retorna `.data.text`, `chatbot-triagem` retorna `.data.reply_message` —
  os dois formatos precisam virar uma única forma antes de montar a
  mensagem de saída.
- [ ] Decide texto vs. imagem pela **presença do campo `qr_image`** no
  payload de retorno de `chatbot-triagem`, não por substring na mensagem
  (achado real de `@codex review`, P2 — o texto real sempre usa
  `"QR Code"` com C maiúsculo; um match `"QR code"` case-sensitive nunca
  dispara, e toda resposta de inscrição sairia como texto em vez de
  imagem). Se `qr_image` existir no retorno, manda imagem
  (`image.link = qr_image`); senão, texto.
- [ ] **Corrige** (não replica) o `notificar_admin` **usando template
  aprovado, não mensagem livre** (achado real de `@codex review`, P1 —
  a 1ª correção assumia mensagem free-form, que a Meta REJEITA se o
  pastor não tiver mandado mensagem pro número nas últimas 24h — a
  janela de sessão é por conversa, não abre pro pastor só porque o
  membro mandou mensagem pra outro número). Quando `chatbot-triagem`
  retornar `notificar_admin: true`, disparar o template já aprovado
  `igreja_alerta_lider` (achado no blueprint "Waba Feelings OakOS" —
  ver ADR-033 §Inventário) via endpoint de template message da Graph
  API, com os parâmetros que o template espera. Hoje isso não acontece
  em produção — é bug conhecido, ver ADR-033 §Bugs conhecidos.
- [ ] **Serializa por CONVERSA, não só por mensagem — eixo de
  concorrência diferente do dedup de `wamid`** (achado real de `@codex
  review`, P1, 8ª rodada). Dois `wamid` diferentes da MESMA conversa
  (usuário manda 2 mensagens rápido, ou a própria Meta entrega em
  paralelo) passam pelo dedup de `wamid` sem problema — são mensagens
  diferentes de verdade — mas invocam o MESMO chatbot concorrentemente,
  e `chatbot-financeiro`/`chatbot-triagem` leem `atendimentos_bot` e
  escrevem de volta sem lock nenhum
  (`chatbot-financeiro/index.ts:804-818,1080-1091`) — uma pode ler
  estado velho, sobrescrever histórico, ou interpretar resposta no
  passo financeiro errado. Precisa de uma chave de ordenação/lease
  adicional por CONVERSA (`igreja_id`+`filial_id`+`phone_number_id`+
  `telefone`, não `wamid`) — a `whatsapp-webhook` só invoca o chatbot
  depois de conseguir esse lock de conversa. **Exclusão mútua sozinha
  não basta — precisa ser FIFO pela ordem real de chegada** (achado
  real de `@codex review`, P1, 9ª rodada: um lock/lease simples só
  garante "um de cada vez", não "na ordem certa" — se as mensagens A
  (mandada primeiro) e B (mandada depois) chegam concorrentes, quem
  ganha o lease primeiro processa primeiro, então B pode avançar a
  sessão financeira antes de A mesmo tendo chegado depois; "espera ou
  enfileira" sem fila ordenada deixa até um retry ultrapassar trabalho
  mais antigo). Usar uma fila durável por conversa, ordenada pelo
  timestamp/sequência real de chegada (`value.messages[].timestamp` da
  Meta, não hora de processamento) — quem chega primeiro na fila
  processa primeiro, mesmo que outra mensagem da mesma conversa
  consiga o lock técnico antes. **`timestamp` da Meta sozinho não
  desempata** (achado real de `@codex review`, P1, 11ª rodada —
  `docs/automacoes/MAKE_WHATSAPP_PHONE_NUMBER_ID.md:75` mostra esse
  campo como epoch de 10 dígitos, granularidade de segundo; duas
  mensagens rápidas do mesmo usuário podem cair no mesmo segundo e a
  ordem entre elas fica indefinida). Usar uma sequência própria,
  atribuída de forma durável no momento em que a mensagem entra na fila
  (ex.: coluna serial/autoincrement na tabela da fila) como critério de
  desempate — `timestamp` da Meta ordena primeiro, a sequência de
  chegada decide entre iguais. **Ordenar a fila não basta se o worker
  já começou a processar B antes de A ser inserida** (achado real de
  `@codex review`, P1, 12ª rodada — corrida de rede pode fazer a
  requisição HTTP da mensagem A [mais antiga pelo timestamp] ainda
  estar em trânsito/sendo parseada enquanto B já foi inserida,
  desenfileirada e começou a processar; nesse ponto reordenar a fila
  não desfaz o que já começou). Pequena janela de espera/debounce antes
  de desenfileirar o próximo item de uma conversa (ex.: alguns segundos)
  — dá tempo de mensagens quase simultâneas convergirem na fila antes
  do worker pegar a próxima. Não é garantia formal (não substitui um
  protocolo de watermark completo), mas é proporcional ao volume real
  esperado — fica documentado como limite conhecido, não fast-follow,
  já que fechar isso por completo é desproporcional ao risco pra um
  chatbot de baixo volume. **O lease da CONVERSA precisa do mesmo
  heartbeat que o lease do `wamid`, não só um dos dois** (achado real
  de `@codex review`, P1, 17ª rodada — o heartbeat especificado mais
  abaixo (item de dedup) só renova o lease de processamento por
  `wamid`; se a mensagem A ficar presa numa chamada lenta ao chatbot
  além do tempo do lease de CONVERSA, a mensagem B — outro `wamid`,
  mesma conversa — pode adquirir esse lock já expirado e entrar no
  mesmo chatbot concorrentemente mesmo com A ainda saudável, recriando
  a corrupção de sessão que esse lock existe pra evitar). Renovar e
  fazer fencing do lease de conversa durante TODA a operação a jusante,
  no mesmo heartbeat que renova o lease do `wamid` — não são dois
  mecanismos independentes, é o mesmo heartbeat renovando os dois.
- [ ] **Deduplica por `wamid` (`value.messages[].id`) antes de chamar
  qualquer chatbot — máquina de estado com fencing, não claim binário**
  (achado real de `@codex review`, P1 — promovido de "fora de escopo"
  pra obrigatório: a Meta reentrega o evento se a resposta 200 demorar,
  o que é esperado aqui já que o processamento síncrono envolve
  IA/Graph; sem isso a mesma mensagem pode rodar 2x em paralelo).
  **4 rodadas de review acharam problema numa versão anterior desta
  mesma lógica — o desenho abaixo é o que sobrou depois de fechar
  todos**. Tabela dedicada por `wamid`: `status`, `owner_token` (UUID
  gerado por tentativa), `lease_until`, `chatbot_result` (JSONB,
  nullable). **Sem SELECT nenhum via PostgREST — nem pra admin, nem pra
  super_admin** (achado real de `@codex review`, P1, 8ª rodada: essa
  tabela guarda telefone + conteúdo completo de mensagem/resposta; se
  for criada em `public` sem RLS ou sem revogar o `EXECUTE`/`SELECT` de
  `PUBLIC`, é o MESMO vazamento cross-tenant que o Passo 3 corrige em
  `edge_function_logs`, só que numa tabela nova que ninguém tinha
  pensado em proteger ainda). É estado interno só do orquestrador,
  ninguém precisa navegar por ela via UI — RLS sem nenhuma policy de
  SELECT (ou `REVOKE ALL ... FROM PUBLIC`, lembrando que `REVOKE ...
  FROM anon` sozinho não fecha nada, ver CLAUDE.md), acesso só via
  `service_role` de dentro da própria function.

  **Estados**: `processing` → `chatbot_done` → `completed` (ou
  `processing` reclamado de novo se o lease expirar sem progresso).

  1. Claim: `INSERT` do `wamid` com `status=processing`,
     `owner_token=<novo uuid>`, `lease_until=now()+120s`. Em conflito
     (row já existe), só atualiza pra reclamar se `status=processing`
     E `lease_until < now()` (lease expirado) — vira dono novo com
     `owner_token` novo. Toda escrita subsequente de estado exige
     `WHERE wamid=... AND owner_token=$meu_token` (fencing — só quem
     é dono corrente da vez consegue avançar o estado; um dono antigo
     que "acordou" depois de perder o lease não consegue mais gravar
     nada por cima de quem já reclamou).
  2. **Lease renovado durante o processamento — fixo não é seguro
     mesmo em 120s** (achado real de `@codex review`, P1, 4ª e 11ª
     rodadas: `chatbot-financeiro` sozinha já faz lookup/download de
     mídia via Graph — `index.ts:125,175` — mais trabalho de DB/Storage
     depois; nenhum número fixo de lease cobre com garantia o pior caso
     de rede lenta, e um lease expirado durante processamento real
     permite takeover enquanto a invocação original ainda está rodando
     — o fencing por `owner_token` só protege a ROW de orquestração,
     não cancela nem desfaz o que a invocação original já executou rio
     abaixo). Renovação passa de fast-follow pra **obrigatória na Fase
     1**. **Renovar só entre etapas não basta** (achado real de
     `@codex review`, P1, 12ª rodada — se a PRÓPRIA chamada ao chatbot
     (um único `await`) passar de 120s, o lease expira NO MEIO dessa
     chamada, antes de qualquer chance de renovar entre etapas — a
     renovação "depois que o chatbot responder" já chega tarde demais).
     Precisa de heartbeat periódico DURANTE cada operação longa
     (`await`) — um timer em paralelo que renova `lease_until` a cada
     ~30-40s enquanto a chamada ao Graph/chatbot ainda está em voo,
     cancelado assim que a chamada retorna — não só nas fronteiras
     entre etapas.
  3. Depois que o chatbot responde: grava `chatbot_result` e
     `status=chatbot_done` (condicionado ao `owner_token`) ANTES de
     tentar qualquer envio via Graph. **`chatbot_result` guarda uma
     lista de entregas, não um resultado único** (achado real de
     `@codex review`, P1, 5ª rodada — quando `notificar_admin` é
     verdadeiro existem 2 envios Graph independentes por `wamid`, resposta
     ao membro E template ao pastor; um estado único não permite retry
     parcial sem duplicar a que já foi enviada ou perder a que falhou):
     `[{alvo: "membro", payload, status: "pendente"|"enviado"}, {alvo:
     "pastor", payload, status: "pendente"|"enviado", opcional}]`. Cada
     entrega tem seu próprio status; o `wamid` só vira `completed`
     quando TODAS as entregas da lista estiverem `"enviado"`.
  4. **Toda entrada nova reclamando um `wamid` existente precisa agir
     conforme o status encontrado**:
     - `completed` → responde 200, não faz nada (já entregue de verdade).
     - `chatbot_done` → reenvia (usando `chatbot_result` já persistido,
       sem invocar o chatbot de novo) só as entregas `"pendente"` da
       lista. **Cada entrega individual precisa do próprio claim atômico
       antes de mandar pro Graph, não só trocar o `owner_token` da row**
       (achado real de `@codex review`, P1, 7ª rodada — trocar
       `owner_token` da row inteira não é exclusivo: duas retentativas
       chegando perto uma da outra podem cada uma trocar o token e ler
       o mesmo item `"pendente"`, mandando a mesma mensagem 2x. Cada
       item da lista de entregas precisa de um estado intermediário
       (ex.: `"pendente"` → `"enviando"` com lease próprio → `"enviado"`)
       e só quem ganha a transição atômica pra `"enviando"` — igual ao
       padrão de fencing do claim original, aplicado por item, não só
       pela row — manda pro Graph de fato; item já `"enviando"` com
       lease válido é pulado por qualquer outra tentativa concorrente,
       **que responde 5xx, não 200** (achado real de `@codex review`,
       P1, 13ª rodada — mesma lógica do branch `processing`: se a
       tentativa concorrente pular o item ocupado e devolver 200, e o
       dono da entrega ativa cair logo depois, a Meta para de reentregar
       e o item nunca chega no caminho de lease expirado/reconciliação
       manual — fica preso pra sempre). Marca cada item `"enviado"`
       conforme confirma; só marca o `wamid` inteiro `completed` e
       responde 200 quando a lista estiver toda `"enviado"`.
       **Lease de `"enviando"` expirado NÃO reenvia automaticamente**
       (achado real de `@codex review`, P1, 8ª rodada — se o Graph
       aceitou o envio mas a resposta HTTP se perdeu, ou o runtime
       morreu logo depois do Graph confirmar, o item fica `"enviando"`
       mesmo tendo sido entregue de verdade; reenviar às cegas duplica
       a mensagem pro destinatário final, e o repo hoje **não tem**
       nenhum webhook de status de entrega da Meta pra reconciliar
       contra isso). Pra Fase 1: item `"enviando"` com lease expirado
       vira alerta/log pra revisão manual, não retry automático —
       aceitável porque duplicar/perder uma notificação de WhatsApp é
       bem menos grave que duplicar uma operação financeira (que já
       está protegida pela idempotência dentro do próprio chatbot, item
       acima). Construir o webhook de status de entrega da Meta
       (`statuses[]`) pra reconciliar automaticamente fica como
       fast-follow — ver §Fora de escopo da Fase 1.
     - `processing` com lease válido e dono diferente do meu → **não
       responde 200** (achado real de `@codex review`, P1, 5ª rodada —
       devolver 200 aqui e o dono original travar/cair depois deixa a
       mensagem presa em `processing` pra sempre, porque a Meta já
       considerou entregue e não reentrega de novo). Responde erro
       5xx/timeout — deixa a própria Meta reentregar mais tarde; quando
       reentregar, ou acha `completed` (deu certo, responde 200 à toa
       mas sem efeito) ou acha o lease expirado e reclama pra valer.
  5. **Idempotência não pode viver só no orquestrador — mas cobertura
     100% de todo efeito colateral é maior que o escopo da Fase 1**
     (achado real de `@codex review`, P1, 4ª e 9ª rodadas). Se a
     resposta HTTP do chatbot se perder, ou a `whatsapp-webhook` cair
     entre receber a resposta e gravar `chatbot_done`, o lease depois
     reclama `processing` e invoca o chatbot de novo — mas ele já pode
     ter comprometido efeito colateral na 1ª tentativa cuja resposta se
     perdeu. **Decisão de escopo explícita**: nem `chatbot-financeiro`
     nem `chatbot-triagem` têm hoje um único commit transacional que
     cubra todo o fluxo — `chatbot-financeiro` faz upload no Storage
     (`index.ts:216`) e depois inserts separados em
     `solicitacoes_reembolso`/`itens_reembolso` (`index.ts:1984,2028`);
     `chatbot-triagem` grava em `pedidos_oracao`/`testemunhos`/
     `atendimentos_pastorais` conforme a intenção classificada
     (`index.ts:1438-1505`) e só depois atualiza a sessão. Cobrir
     idempotência de TODO efeito individual (outbox pattern ou RPC
     única envolvendo Storage + múltiplos inserts) é reescrita de
     lógica de negócio de verdade — fora do escopo desta fase, vira
     fast-follow (ver §Fora de escopo).
     - **Mitigação mínima da Fase 1, escopo aditivo (não reescrita) —
       precisa cobrir TODOS os fluxos que comprometem dinheiro, não só
       reembolso** (achado real de `@codex review`, P1, 13ª rodada,
       corrigindo uma afirmação errada da rodada anterior: `chatbot-
       financeiro` também comete DESPESA/CONTA_ÚNICA via
       `criarLancamento`, `index.ts:1713-1720`, e transferência via
       `criarTransferencia`, `index.ts:2562-2567` — nenhum dos dois
       passa por `solicitacoes_reembolso`; a guarda de unicidade só ali
       não fecha "o pior caso", fecha só 1 de 3 fluxos que duplicam
       lançamento financeiro). Guarda de idempotência no PRIMEIRO write
       de CADA um dos 3 fluxos: `wamid` + constraint de unicidade em
       `solicitacoes_reembolso` (reembolso), e propagar `wamid` até as
       RPCs canônicas `fin_*` chamadas por `criarLancamento`/
       `criarTransferencia` (despesa/conta única/transferência) — mesmo
       padrão de conflito-de-unicidade = já processado, retorna
       resultado anterior. Pra `chatbot-triagem`: **registro append-only
       por `wamid`, não campo na sessão mutável** (achado real de
       `@codex review`, P1, 16ª rodada — `atendimentos_bot` é a MESMA
       row reusada por toda mensagem da conversa; gravar `wamid` nela
       significa que a mensagem B sobrescreve o marcador da mensagem A,
       e um retry atrasado de A — ex.: resposta do chatbot pra A se
       perdeu — não encontra mais conflito nenhum depois que B já
       rodou, podendo duplicar o pedido de oração/testemunho/pastoral
       de A de novo). Tabela/registro separado, chave única em `wamid`
       (guardando o resultado anterior junto), checado ANTES do branch
       de gravação por intenção — não reaproveitar coluna nenhuma de
       `atendimentos_bot` pra isso. Não fecha 100% (upload de
       Storage isolado ainda pode duplicar em teoria), mas fecha os 3
       piores casos financeiros + o registro pastoral com mudança
       aditiva, sem reescrever o motor `fin_*` existente.

  O dedupe de 5s por conteúdo que já existe dentro de `chatbot-triagem`
  fica como está (defesa em profundidade adicional), mas não é
  suficiente sozinho pros motivos acima.
- [ ] Envia a resposta via Graph API copiando o padrão de
  `send-otp/index.ts` (`WHATSAPP_TOKEN` + `phone_number_id` via
  `whatsapp_numeros`).
- [ ] Registra a execução via `log_edge_function_with_metrics` (RPC já
  existente) e responde 200 rápido pra Meta.

### Passo 2 — Fechar os endpoints hoje abertos

**Ordem importa — fail-closed antes da hora derruba o Make que ainda
está em produção** (achado real de `@codex review`, P1, 15ª rodada):
`supabase-deploy.yml` deploya TODAS as functions juntas a cada push em
`main`; o blueprint real do Make hoje **não manda** `x-webhook-secret`
(confirmado em `docs/automacoes/MAKE_WHATSAPP_PHONE_NUMBER_ID.md:175-180`).
Se o fail-closed for deployado ANTES da URL do callback ser trocada no
Meta Business Manager, toda mensagem real que ainda está passando pelo
Make (produção, tráfego de verdade) recebe 401 na hora do deploy —
mesmo sem qualquer mudança na Meta ainda. Ordem correta:
1. [ ] Atualizar o blueprint do Make **primeiro** (mudança só no Make,
   sem deploy no Supabase) pra mandar `x-webhook-secret:
   MAKE_WEBHOOK_SECRET` nas chamadas pra `chatbot-triagem`/
   `chatbot-financeiro`. Confirmar que está mandando de verdade antes
   de seguir.
2. [ ] Só então deployar `chatbot-triagem`: adicionar validação
   `x-webhook-secret` fail-closed contra `MAKE_WEBHOOK_SECRET` (hoje
   não valida nada).
3. [ ] `chatbot-financeiro`: trocar de fail-open pra fail-closed no
   mesmo segredo (hoje só loga aviso se a env var estiver ausente).
4. [ ] Confirmar que só a nova `whatsapp-webhook` (que também precisa
   mandar o header, ver Passo 1) e o Make atualizado vão chamar essas
   duas — nenhum outro caller externo.

### Passo 3 — Visibilidade de execução

- [ ] Sem tabela nova — `edge_function_logs` já cobre; `EdgeFunctionMonitoring.tsx`
  já lista com filtro por função/período.
- [ ] **Fechar o vazamento na policy/query, não só na UI** (achado real
  de `@codex review`, P1, **2ª rodada corrige a 1ª**: restringir só o
  dialog de detalhe no client não fecha nada — `EdgeFunctionMonitoring.tsx`
  já faz `.select("*")` na query da LISTA hoje, então `request_payload`/
  `response_payload` de TODAS as igrejas já chegam no browser do admin
  antes mesmo de abrir qualquer dialog; e a policy de SELECT continua
  permitindo `admin` de qualquer igreja ler a tabela direto via
  PostgREST, gate de UI nenhum impede isso). `edge_function_logs` não
  tem `igreja_id`, e a policy de SELECT
  (`20260820010000_perf_auth_rls_initplan_wrap_select.sql:336`) é só
  `has_role(auth.uid(), 'admin')` — vazamento cross-tenant confirmado,
  não hipotético. Fix de verdade, dentro do escopo desta fase (é troca
  de predicado de policy existente, não schema/dado novo):
  1. Migration alterando a policy de SELECT de `edge_function_logs` pra
     exigir `has_role(auth.uid(), 'super_admin')` em vez de `'admin'`
     genérico — fecha o acesso direto via PostgREST também, não só a UI.
  2. `EdgeFunctionMonitoring.tsx`: trocar `.select("*")` da query de
     lista por uma projeção sem `request_payload`/`response_payload`;
     essas duas colunas só entram numa query separada, disparada ao
     abrir o dialog de detalhe (que já está atrás do gate de
     `super_admin` do passo 1).
  Dar `edge_function_logs` uma coluna `igreja_id` real com RLS por
  tenant (pra liberar `admin` de igreja de novo, escopado à própria
  igreja) é fix maior, fora do escopo desta fase — tratar como
  fast-follow; até lá, só `super_admin` vê a tabela, ponto.

### Passo 4 — Corte (cutover)

- [ ] Deployar e testar isoladamente handshake `GET` + POST sintético,
  antes de tocar em qualquer configuração do Meta.
- [ ] Rodar os 10 cenários de teste da ADR-033 (§Validação — inclui
  reenvio de `wamid` simulado com 2 sessões reais, lock por conversa e
  payload real de mídia, achados de `@codex review`) contra a nova
  função.
- [ ] Trocar a URL do webhook no Meta Business Manager (de Make pra
  Supabase) — **sem apagar** o scenario "Waba Chatbot - OakOS" no Make,
  só desligar.
- [ ] Acompanhar `edge_function_logs` por alguns dias de uso real: taxa de
  erro, duplicidade, latência.
- [ ] Só então desativar de fato o scenario no Make — **e antes de
  revogar qualquer token, confirmar que não é o mesmo que ALGUMA
  function ainda usa — são 2 nomes de token diferentes, não 1**
  (achado real de `@codex review`, P1, 14ª rodada, ampliando o achado
  P2 anterior): `WHATSAPP_TOKEN` (respostas de texto da
  `whatsapp-webhook`, Decisão 5 da ADR-033) é um; separadamente,
  `WHATSAPP_API_TOKEN` autentica a transcrição de áudio em
  `chatbot-triagem` (`index.ts:61,388-395`) e o download de
  comprovante/documento em `chatbot-financeiro` (`index.ts:605,170-175`)
  — revogar só verificando `WHATSAPP_TOKEN` pode deixar resposta de
  texto funcionando enquanto quebra silenciosamente áudio e anexo, se
  o token antigo do Make coincidir com o `WHATSAPP_API_TOKEN`. Checar/
  rotacionar OS DOIS nomes antes de revogar qualquer credencial do Make.

**Rollback não é "1 clique" — documentar o procedimento real** (achado de
`@codex review`, P2): depois que a URL do callback é trocada no Meta
Business Manager pra apontar pra `whatsapp-webhook`, a Meta passa a
entregar TODO evento pra lá. Reativar o scenario no Make sozinho não
restaura tráfego nenhum — o scenario ficaria ligado e ocioso, sem receber
nada, enquanto a Supabase (agora com problema) continua sendo o único
destino. Rollback de verdade exige, nessa ordem: (1) reativar o scenario
no Make, (2) trocar a URL do callback de volta pro endpoint do Make no
Meta Business Manager, (3) confirmar o handshake de verificação do Make
ainda passa (token/segredo do Make precisam continuar válidos — não
revogar nada do lado do Make até ter certeza que o corte deu certo e o
bake period terminou).
- [ ] Marcar "Waba Chatbot - OakOS" como desativado em
  `docs/automacoes/catalogo-automacoes.md`.
- [ ] Substituir ou marcar como histórico `docs/automacoes/
  make-whatsapp-chatbots-blueprint.json` (não reflete a topologia real).

### Fora de escopo da Fase 1 (fast-follows)

- Bug do branch `whatsapp_meta` morto em `disparar-alerta/index.ts`
  (variável `config` indefinida) — fluxo diferente, PR própria.
- Migrar `WHATSAPP_TOKEN` global pra segredo criptografado por igreja —
  só necessário com múltiplas contas WhatsApp Business reais.
- ~~Tabela de dedupe por `message_id` (wamid)~~ — **promovido a
  obrigatório no Passo 1** (achado de `@codex review`, não é mais
  fast-follow). Fica fora de escopo só o refinamento de infra (TTL de
  limpeza da tabela de dedupe, métricas de taxa de duplicidade) — a
  claim atômica básica entra na Fase 1.
- **Webhook de status de entrega da Meta** (`statuses[]`: sent/
  delivered/read) pra reconciliar item `"enviando"` travado sem
  reenviar às cegas (achado de `@codex review`, 8ª rodada) — Fase 1
  trata isso como alerta manual, não reenvio automático; ver Passo 1
  item de dedup.
- **Idempotência transacional completa em `chatbot-financeiro`/
  `chatbot-triagem`** (outbox pattern, ou RPC única cobrindo Storage +
  todos os inserts do fluxo) — achado real de `@codex review`, 9ª
  rodada. Fase 1 entra só com a mitigação mínima (guarda de unicidade
  no primeiro write de cada fluxo, ver Passo 1 item 5); cobertura de
  100% dos efeitos colaterais individuais é reescrita de lógica de
  negócio de verdade, fora do escopo desta fase.
- Mover roteamento (hoje array fixo por `phone_number_id`) pra tabela
  configurável — só se precisar ajustar sem deploy.

---

## 🛠️ FASE 2 — Escalas + Feelings

Blueprints já exportados e comparados (ver inventário na ADR-033), mas
implementação ainda não iniciada. Abrir como plano próprio quando a Fase 1
estiver em produção e estável — reaproveitar a mesma estrutura de
validação (export → comparar contra código → decidir) usada na Fase 1.

Pontos que a Fase 2 precisa decidir, já identificados:
- Como recriar a camada evento→template Meta (`otp_verificacao` →
  `verificacado_de_conta`, `lembrete_evento_inscricao` →
  `appointment_confirmation`, `mensagem_manual` → `appointment_confirmation`,
  default → `igreja_acolhimento_ia` + `igreja_alerta_lider`,
  `escala_convite_v1` pra Escalas) — hoje essa decisão vive só dentro dos
  blueprints do Make; nenhuma tabela ou config no Supabase a representa.
- Resolver por que `disparar-alerta` manda `evento="alerta_gabinete_pastoral"`
  sem branch nomeado no Feelings (cai no `default`) — confirmar se é
  comportamento intencional antes de portar 1:1.

---

## 🛠️ FASE 3 — Auditoria dos cenários não exportados

**Não iniciar implementação nesta fase sem exportar o blueprint real ou
confirmar que a function é código morto.** Passos:

1. [ ] Confirmar se `receber-pedido-make` e `receber-testemunho-make`
   ainda recebem tráfego real. **`receber-pedido-make` NÃO pode ser
   avaliada só por `edge_function_logs`** (achado real de `@codex
   review`, P1 — checagem ingênua de 60 dias sem invocação teria
   mandado remover um endpoint vivo): `src/pages/public/PublicOracao.tsx:87`
   chama `receber-pedido-make` direto do site público
   (`supabase.functions.invoke`), fora do fluxo Make inteiramente, e
   essa function não grava em `edge_function_logs`. Auditar TODOS os
   callers no repo (`grep -rn "receber-pedido-make" src/
   supabase/functions/`) antes de checar invocação, não só o lado Make.
   **`receber-testemunho-make` tem o MESMO problema de instrumentação,
   não menos** (achado real de `@codex review`, P1, 15ª rodada,
   corrigindo uma afirmação errada da checklist anterior — a diferença
   é só não ter caller no frontend, não ter log): ela também nunca
   grava em `edge_function_logs` nem chama
   `log_edge_function_with_metrics`. Um fluxo de testemunho ainda ativo
   só pelo Make (sem frontend nenhum, exatamente como se espera de um
   webhook Make→app) continuaria parecendo "sem invocação" pra sempre,
   mesmo recebendo testemunhos reais — a checagem por
   `edge_function_logs` teria mandado apagar um endpoint vivo e perder
   testemunhos futuros. Antes de remover: auditar histórico de execução
   do próprio scenario no Make (não do lado Supabase) ou instrumentar
   a function com `log_edge_function_with_metrics` primeiro e observar
   por um período, em vez de usar ausência de log como evidência.
2. [ ] Confirmar estado de `notificar-liturgia-make` — ainda dispara
   notificações reais de escala de liturgia, ou já morreu sem
   substituto? Se ativo, exportar blueprint antes de qualquer mudança.
3. [ ] Confirmar estado de `checkin-whatsapp-geo` — mesma pergunta.
4. [ ] Esclarecer a relação entre `verificar-sentimentos-criticos`
   (webhook `WEBHOOK_MAKE_ALERTA_EMOCIONAL` direto, fora da tabela
   `webhooks`) e `analise-sentimento-ia` → `disparar-alerta` (evento
   `alerta_gabinete_pastoral`, via tabela `webhooks`/resolver de 3
   níveis) — são dois caminhos correndo em paralelo? Um substituiu o
   outro sem o outro ser desligado?
5. [ ] Decidir o destino do tipo de webhook órfão `make_geral` (existe na
   UI admin, nenhuma function lê) — remover da UI ou implementar leitor.

---

## ✅ Critério de conclusão do plano

O plano só é considerado concluído quando:
- Todas as fases 1-3 estiverem executadas ou explicitamente descartadas
  (com motivo registrado nesta doc ou na ADR-033).
- Nenhuma edge function do inventário acima depender de
  `MAKE_WEBHOOK_URL`/`WEBHOOK_MAKE_ALERTA_EMOCIONAL` nem de linhas
  `tipo LIKE 'make_%'`/`'whatsapp_make'` na tabela `webhooks`, a menos
  que explicitamente mantidas por decisão registrada. **Exceção
  deliberada, não pendência**: `MAKE_WEBHOOK_SECRET` continua em uso
  (achado real de `@codex review`, P2 — a Fase 1 torna
  `chatbot-triagem`/`chatbot-financeiro` fail-closed nesse segredo E
  exige que a `whatsapp-webhook` o envie; "eliminar toda dependência
  dele" contradiz o próprio fix de segurança desta fase). O nome pode
  ser trocado por algo menos amarrado ao Make (ex.:
  `INTERNAL_WEBHOOK_SECRET`) num fast-follow de rotação coordenada
  (caller + callees no mesmo commit), mas o segredo em si — como
  mecanismo de auth interna entre orquestrador e chatbots — fica.
- `docs/automacoes/catalogo-automacoes.md` refletir o estado final (o que
  foi migrado, o que foi removido, o que foi mantido e por quê).
