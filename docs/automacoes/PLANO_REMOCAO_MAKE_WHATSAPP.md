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

Este plano cobre **8 cenários Make diferentes**, descobertos validando
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
`verify_jwt=false` em `supabase/config.toml` (obrigatório — a Meta não
manda JWT; igual `pix-webhook`). **`verify_jwt=false` não é o mesmo
que nos crons existentes** (achado real de `/code-review` local, 30ª
rodada): `getnet-sftp` e `buscar-pix-cron` **não** estão listados em
`config.toml` com `verify_jwt=false`, então o default do hosted
(`verify_jwt=true`) faz o *gateway* rejeitar POST sem Bearer JWT
**antes** do isolate — o `Authorization: Bearer <service_role>` do
`pg_cron` (`20260813020100`) é o que passa nessa checagem. Nesta
function o gateway **não** faz essa checagem. Qualquer auth de rota
interna (`{action: "reclaim"}`) tem que viver **no handler**, senão
é backdoor público. Ver item 4.5.

- [ ] `GET` — handshake `hub.verify_token`/`hub.challenge` contra novo
  segredo `WHATSAPP_VERIFY_TOKEN`. Sem `hub.mode`, responde 200 simples
  (health check). Com `hub.mode=subscribe` e token certo, o body da
  resposta é o valor **cru** de `hub.challenge` (`text/plain`), não
  JSON — a Meta rejeita a verificação do callback se não for
  byte-a-byte o challenge.
- [ ] `POST` — lê o corpo **cru** (`req.text()`, não `req.json()` —
  `json()` consome o stream e impede HMAC depois). Despacho **não**
  é "HMAC em todo POST" nem "se `action===reclaim` pula HMAC"
  (achado real de `/code-review` local, 30ª rodada — as duas
  leituras ingênuas quebram):
  1. Se `Authorization: Bearer` bate com
     `SUPABASE_SERVICE_ROLE_KEY` (comparação no isolate, padrão
     `getnet-sftp/index.ts:468-473`) **e** o JSON parseado do cru é
     exatamente `{action: "reclaim", wamid}` (sem `entry`/`object`
     da Meta) → rota interna, sem HMAC. Bearer ausente/errado neste
     formato → 401, não cai no caminho Meta.
  2. Qualquer outro POST → valida `X-Hub-Signature-256` com
     `META_APP_SECRET` **sobre os bytes crus**. Campo `action` no
     JSON **não** pula essa checagem — um envelope Meta forjado
     com `"action": "reclaim"` extra ainda precisa de HMAC válido.
     HMAC inválido → 401. (Validação nova — o Make não faz isso
     hoje.)
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
    silenciosamente. Iterar `entry[].changes[].value.messages[]`.
    **`independente` não é `Promise.all`** (achado real de
    `/code-review` local, 32ª rodada — a 31ª fechou o 5xx cego da
    FIFO, mas este bullet ainda mandava aplicar roteamento+dedupe
    "em cada mensagem, independente"; duas mensagens da mesma
    conversa no mesmo POST processadas em paralelo reabrem a
    corrida que o lock existe pra evitar, e a seq de chegada do
    array se perde). Em cada notificação: (1) **enfileirar todas**
    as mensagens suportadas (allowlist por rota), com `seq` = ordem
    no array como desempate depois do `timestamp` Meta; (2) **só
    então** processar a cabeça de cada conversa. Conversas
    diferentes no mesmo lote podem andar em paralelo; a mesma
    conversa, não.
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
  - `nome_perfil` ← **contato cujo `wa_id` bate com o `from` DESSA
    mensagem específica, não `contacts[]` posicional/arbitrário**
    (achado real de `@codex review`, P2, 23ª rodada — quando um
    `value` batchado tem mensagens de VÁRIOS remetentes diferentes,
    pegar `contacts[]` sem correlacionar por índice/posição pode
    associar o nome de uma pessoa ao número de outra;
    `MAKE_WHATSAPP_PHONE_NUMBER_ID.md:65-73` mostra um exemplo de payload
    da Meta com `contacts[]` e `messages[]` lado a lado — não é uma regra
    em prosa, mas o próprio formato do envelope já deixa claro que a
    correlação certa é por `contacts[].wa_id === messages[].from`, não
    posição no array; os dois chatbots persistem/usam `nome_perfil` em
    registro financeiro/pastoral — o mismatch contamina esses registros)
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
    - `chatbot-financeiro` (`index.ts:676-685`) só EXTRAI `url_anexo`
      (ou aliases) do body ali — mas **já sabe resolver um `media_id`
      cru sozinha, sem precisar de URL pré-resolvida** (correção de
      achado real de `/code-review ultra` local, PR #133: o texto
      anterior desta doc dizia "não lê `media_id` nenhum", o que é
      impreciso). `persistirAnexo` → `resolverMediaUrl`
      (`index.ts:111-149`) recebe exatamente o valor de `url_anexo` e
      testa `/^\d+$/` — se for só dígitos (um `media_id` da Meta, não
      uma URL), resolve via `GET /v21.0/{media-id}` usando
      `WHATSAPP_API_TOKEN` (`index.ts:605`) antes de baixar o arquivo.
      Ou seja: **a `whatsapp-webhook` NÃO precisa fazer resolução de
      mídia nenhuma pro número financeiro** — só extrair o `id` bruto
      do payload da Meta (`image.id`/`document.id`) e mandar como
      `url_anexo`, exatamente como já manda pra `chatbot-triagem` com
      `media_id` de áudio (item acima). Isso elimina uma chamada Graph
      API inteira do desenho da `whatsapp-webhook`, e junto com ela a
      preocupação de qual token usar nesse lookup — `WHATSAPP_API_TOKEN`
      já é o token que `resolverMediaUrl` usa internamente
      (`chatbot-triagem/index.ts:61,388-395` resolve áudio do mesmo
      jeito, próprio token). **Cobrir esse caminho explicitamente no
      cenário de teste que exercita mídia** (ADR-033 §Validação, cenário
      10): mandar `media_id` cru (string só de dígitos) como `url_anexo`
      pro número financeiro e confirmar que `chatbot-financeiro` resolve
      e baixa sozinha, sem a `whatsapp-webhook` ter feito Graph API
      nenhuma antes.
  - **Filtra eventos que não são mensagem, E tipos de mensagem sem
    suporte** (achado real de `@codex review`, P2, 14ª rodada — o
    filtro original só cobria `statuses[]`; a Meta também entrega
    `messages[].type` como `interactive`/`button`/`reaction`/
    `location`/`contacts`/`sticker`, nenhum coberto pela extração de
    `text.body`/mídia acima. Sem allowlist, esses tipos passam com
    `mensagem=""` e são roteados mesmo assim — a string vazia vira
    `conteudo_texto` (fallback chain, `index.ts:987-993`) e daí segue
    pro fluxo normal: busca a sessão ativa (`index.ts:1042-1063`) e
    passa pela checagem de idempotência que compara com a última
    mensagem do usuário no histórico (`index.ts:1089-1112`) — achando
    resposta sem sentido ou avançando histórico com "mensagem" vazia do
    usuário quando não bate com a idempotência). Allowlist explícita de
    tipos suportados (`text`, `audio`, `image`, `document`) globalmente;
    qualquer outro tipo responde 200 sem rotear, igual ao tratamento de
    `statuses[]`. **A allowlist certa é POR ROTA, não uma lista global
    única** (achado real de `@codex review`, P2, 18ª rodada —
    `chatbot-triagem` só processa mídia de `audio`, `index.ts:1033-1040`;
    `chatbot-financeiro` só processa `image`/`document`; a lista global
    deixaria imagem passar pro número de triagem, ou áudio pro
    financeiro, chegando no handler errado sem texto nem mídia
    utilizável — mesmo efeito de sessão avançando com entrada vazia que
    o filtro pretende evitar). Aplicar o filtro de tipo DEPOIS de
    resolver o destino (`phone_number_id` → chatbot), com a allowlist
    certa pra cada um: `{text, audio}` pra `chatbot-triagem`,
    `{text, image, document}` pra `chatbot-financeiro`.
- [ ] Resolve `igreja_id`/`filial_id` e destino via `phone_number_id` já
  extraído — **não** por palavra-chave (roteamento real do Make é por
  número, confirmado no export; não existe lógica de keyword).
  **Achado de `@codex review` (P1, 23ª rodada) investigado e
  resolvido**: o número financeiro real `1031291743394274` foi
  seedado com `igreja_id = NULL` em
  `20260129170838_733fcf96-461c-4a44-986f-c35c3d520f6e.sql` — a
  migration sozinha sugeria que `resolverIgrejaEFilialWhatsApp`
  (`financeiro-core.ts:421-456`) devolveria `NULL` e `chatbot-financeiro`
  rejeitaria com 400 (`index.ts:631-650`). **Confirmado contra o banco
  real (SQL Editor, 2026-08-27)**: a row de produção tem
  `igreja_id=d5be1965-b3dc-4b65-b847-b6d395543533`,
  `filial_id=86134a25-1dea-44df-9ccb-3350032ee8ab`, `enabled=true` — o
  seed `NULL` da migration ficou desatualizado (corrigido depois,
  fora do controle de migration rastreado). Nenhum bloqueio real:
  `resolverIgrejaEFilialWhatsApp` acha a row por `display_phone_number`
  e resolve `igreja_id`/`filial_id` normalmente, sem precisar de
  `igreja_id` explícito no body — a `whatsapp-webhook` pode confiar
  nesse mesmo lookup sem replicar nada especial pra esse número.
  **Lição pro resto do plano**: qualquer achado baseado só no seed de
  uma migration precisa ser confirmado contra o banco real antes de
  virar bloqueio — a migration é o estado inicial, não o estado atual.
  **O número de triagem `745419461981790` NÃO teve a mesma confirmação
  — é bloqueio de cutover, não o mesmo caso** (achado real de `@codex
  review`, P1, 26ª rodada): busca no repo por esse `phone_number_id`
  só acha estes documentos novos; **não existe** seed em
  `whatsapp_numeros` (o financeiro pelo menos tinha um `INSERT`, ainda
  que com `igreja_id` NULL). `chatbot-triagem` **não** rejeita com 400
  quando o tenant falta — omite o predicado de `igreja_id` da query de
  sessão (`index.ts:1053-1055`) e **insere sessão com `igreja_id =
  NULL`** (`:1114-1127`). Pedidos/testemunhos/pastorais saem sem
  tenant; sessões de igrejas diferentes no mesmo número colapsam.
  Os dois chatbots hoje buscam tenant só por `display_phone_number`
  (`financeiro-core.ts:430-435`, `chatbot-triagem/index.ts:1014-1019`),
  não por `phone_number_id` — se o metadata da Meta não bater com o
  valor gravado, o lookup falha mesmo com a row existindo.
  **Antes de trocar a URL no Meta**, confirmar contra o banco real
  (mesmo método da 23ª rodada):
  `SELECT igreja_id, filial_id, display_phone_number, enabled FROM
  whatsapp_numeros WHERE phone_number_id = '745419461981790'`.
  - Row com `igreja_id` preenchido e `enabled=true`: registrar o valor
    nesta doc (igual ao financeiro) e seguir.
  - Row ausente, `igreja_id IS NULL` ou `enabled=false`: **não cortar**.
    Inserir/corrigir a row de produção **e** uma migration de seed na
    PR de implementação da Fase 1, com o tenant do número financeiro
    (`d5be1965-b3dc-4b65-b847-b6d395543533` /
    `86134a25-1dea-44df-9ccb-3350032ee8ab`) a menos que o time confirme
    outro.
  A `whatsapp-webhook` resolve tenant por `phone_number_id` (índice
  único `whatsapp_numeros_phone_number_id_key`) e **repassa
  `igreja_id` já resolvido no body** (os dois chatbots já aceitam
  `body.igreja_id`) **e `filial_id` pra triagem** (`body.filial_id` em
  `chatbot-triagem/index.ts:1007`). `chatbot-financeiro` **ignora**
  `body.filial_id` — continua derivando filial só via
  `resolverIgrejaEFilialWhatsApp` por `display_phone_number`
  (`index.ts:613-635`), então o campo `display_phone_number` do
  metadata da Meta continua obrigatório no body financeiro. Se o
  lookup por `phone_number_id` não achar row com `igreja_id NOT NULL`,
  **não rotear**: 5xx + log, nunca invocar o chatbot com tenant nulo —
  senão a triagem recria o buraco mesmo com a row certa no banco.
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
  API, com os parâmetros que o template espera. **`to` do template é
  `telefone_admin_destino` do retorno de `chatbot-triagem`**, não um
  número hardcoded (achado real de `/code-review` local, 26ª rodada —
  a function já resolve o plantão via
  `resolverTelefonePlantaoPastoral`, `index.ts:1567-1575`, e devolve
  esse campo; o blueprint placeholder antigo usava
  `telefone_admin_destino` com fallback `5517988216456`
  (`make-whatsapp-chatbots-blueprint.json:467`,
  `MAKE_BLUEPRINT_SETUP.md:113` — **correção de citação**, achado real
  de `/code-review ultra` local, PR #133: uma rodada anterior citou
  `MAKE_WHATSAPP_PHONE_NUMBER_ID.md:271`, que só tem
  `"to": "{{4.telefone_admin_destino}}"`, sem fallback nenhum; o
  literal `5517988216456` vive nos 2 arquivos certos acima — e também
  no código de produção, `TELEFONE_PASTOR_PLANTAO_FALLBACK` em
  `chatbot-triagem/index.ts:72`). Sem ler o campo, o alerta
  pastoral sai pro número errado ou pra ninguém).
  **`notificar_admin: true` tem um SEGUNDO produtor que os dois
  documentos não distinguiam — falha técnica de IA, não só
  `SOLICITACAO_PASTORAL`** (achado real de `/code-review` local, P1):
  `responderComFalhaIA` (`index.ts:1279-1288`) retorna `HTTP 200` (sem
  status explícito em `respostaJson`, default 200) com
  `notificar_admin: true` e `dados_contato.motivo = "Falha técnica:
  ${motivo}"` em TODO timeout/erro HTTP/conteúdo vazio da IA
  (`:1316,1339,1345,1349` — gateway Lovable falhou, OpenAI falhou,
  exceção/timeout de 30s, ou resposta vazia), não só no branch
  `SOLICITACAO_PASTORAL` (`:1502`). Os dois produtores são
  distinguíveis (`erro_ia: true` só existe no payload de
  `responderComFalhaIA`, `:1280`), mas a especificação acima ("quando
  retornar `notificar_admin: true`, disparar o template") não diz qual
  dos dois vira mensagem pro pastor — aplicada como está, dispararia o
  template aprovado toda vez que a IA cair, preenchendo os parâmetros
  do template (incluindo o `telefone_admin_destino` acima) com um
  texto técnico ("Falha técnica: IA indisponível (timeout)") em vez de
  um resumo pastoral de verdade. Checar `erro_ia` no payload de
  retorno: se `true`, **não** disparar `igreja_alerta_lider` (é falha
  técnica, não pedido pastoral — cai só em
  `log_edge_function_with_metrics`/log de erro, sem mensagem extra pro
  pastor); só disparar o template quando `notificar_admin: true` E
  `erro_ia` ausente/`false` (o caminho `SOLICITACAO_PASTORAL` de
  verdade). Cobrir os dois casos (falha de IA NÃO dispara template;
  `SOLICITACAO_PASTORAL` dispara, com `telefone_admin_destino` correto)
  no cenário de teste 5 da ADR-033 §Validação, que hoje só exercita o
  caminho pastoral. Hoje isso não acontece em produção — é bug
  conhecido, ver ADR-033 §Bugs conhecidos.
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
  depois de conseguir esse lock de conversa. **Mesma exigência de acesso
  da tabela de dedup por `wamid` (item abaixo) se aplica aqui: sem
  SELECT nenhum via PostgREST, nem pra admin, nem pra super_admin** —
  essa tabela também carrega telefone (e indiretamente correlaciona com
  conteúdo de conversa via o `wamid` que está sendo processado no
  momento); é estado interno só do orquestrador, RLS sem nenhuma policy
  de SELECT (ou `REVOKE ALL ... FROM PUBLIC`, nunca só `FROM anon`, ver
  CLAUDE.md), acesso só via `service_role` de dentro da própria
  function — mesmo raciocínio do vazamento cross-tenant que o Passo 3
  corrige em `edge_function_logs`. **`filial_id` nullable
  quebra a unicidade da chave — NULL não é igual a NULL num constraint
  padrão** (achado real de `@codex review`, P1, 22ª rodada:
  `whatsapp_numeros.filial_id` é nullable de verdade — coluna aceita
  `NULL` no schema. **Correção** [achado real de `/code-review` local]:
  a 22ª rodada citou o número financeiro seedado com `filial_id=NULL`
  como "caso real, não hipotético", mas a checagem contra o banco real
  na 23ª rodada mostrou esse MESMO número com `filial_id` preenchido
  (`86134a25-1dea-44df-9ccb-3350032ee8ab`) hoje — o seed nulo também
  ficou desatualizado, igual ao `igreja_id`. O ponto arquitetural segue
  válido (a coluna É nullable, algum outro número pode legitimamente
  ter `filial_id=NULL` pra representar recurso compartilhado entre
  filiais — mesmo padrão do resto do sistema, ver CLAUDE.md §Filial
  compartilhada), só a alegação "é o caso real deste número específico
  hoje" estava errada. Um constraint único comum trata cada `NULL` como
  distinto dos outros, então duas mensagens da MESMA conversa num
  número com filial nula (real ou futuro) criariam 2 rows de lock
  "únicas" e entrariam no chatbot concorrentemente — o fix continua
  necessário como defesa arquitetural, independente de qual número
  específico está nulo hoje. Usar
  `UNIQUE NULLS NOT DISTINCT` nessa constraint (Postgres 15+), ou
  substituir **cada** componente nullable por um sentinela não-nulo
  (`COALESCE(filial_id, '00000000-...')` **e**
  `COALESCE(igreja_id, '00000000-...')`) na chave calculada — nunca
  deixar a comparação de unicidade depender de semântica de NULL.
  **`igreja_id` é nullable na mesma tabela** (`whatsapp_numeros.igreja_id`
  foi `DROP NOT NULL` em `20260129153358`; o comentário da tabela
  documenta `NULL` = config global). `NULLS NOT DISTINCT` na
  constraint composta cobre os dois de uma vez; o sentinela
  `COALESCE` tem que se aplicar aos dois, não só a `filial_id`
  (achado real de `/code-review` local, 26ª rodada — o texto da 22ª
  rodada falava em "componente nullable" no singular).
  **Exclusão mútua sozinha
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
  **A condição de LIBERAÇÃO do lock de conversa nunca foi
  especificada — só aquisição, heartbeat e roubo por expiração**
  (achado real de `/code-review ultra` local, PR #133: sem uma
  liberação ativa definida, o comportamento fica ambíguo entre 3
  leituras possíveis do texto acima — liberar já no `chatbot_done`
  [antes dos envios Graph], só depois do `completed` [depois dos
  envios], ou nunca liberar ativamente e deixar o próximo item da
  fila esperar o lease inteiro expirar mesmo com o anterior já
  terminado em milissegundos. As 3 têm consequência real: a 2ª e a 3ª
  adicionam latência de fila proporcional ao tempo de envio Graph/ao
  lease inteiro pra CADA mensagem de uma conversa ativa, não só a
  primeira). Liberar (UPDATE pra `status=livre`, ou `DELETE` da row,
  dependendo da escolha de schema) **assim que o `wamid` atingir
  `chatbot_done`** — não esperar `completed`: a partir de
  `chatbot_done`, o `chatbot_result` já está persistido e os envios
  Graph restantes (`pendente`→`enviando`→`enviado`, item 3 abaixo) não
  tocam mais `atendimentos_bot`/sessão nenhuma, que é exatamente o
  recurso que este lock protege — segurar o lock até `completed`
  só adicionaria latência de fila sem fechar nenhuma corrida a mais.
  Se o passo de liberação em si falhar (row já reclamada por outro
  worker via lease expirado, por exemplo), tratar como no-op — quem
  já roubou o lock não deve ser derrubado por uma liberação tardia da
  invocação anterior.
  **Quem termina um `wamid` tenta drenar a FIFO na mesma request**
  (achado real de `/code-review` local, 31ª rodada — sem
  `waitUntil` não existe worker nenhum olhando a fila depois do
  `return`. Liberar em `chatbot_done` e encerrar deixa o próximo
  `wamid` da conversa parado em `queued` até redelivery/sweep, e
  com lease válido a redelivery levava 5xx; ver item 4). O lock
  continua sendo liberado em `chatbot_done` (os Graph de A não
  precisam dele). **Drenar só depois deste `wamid` estar
  `completed`** — não entre `chatbot_done` e o Graph, senão A
  nunca fecha nesta request. Aí: **re-adquire o lock de conversa**
  (foi solto em `chatbot_done`) na mesma transaction que o claim
  `queued`→`processing` da cabeça — não só o UPDATE da row de
  `wamid`, senão o chatbot de B roda sem fencing de conversa.
  `SELECT` a cabeça (`queued`, mesma chave, `ORDER BY timestamp
  Meta, seq`). Se houver item e restar orçamento de tempo no
  isolate (ex.: >30s; teto da function ~150s), processa **nessa**
  request (chatbot + Graph desse próximo `wamid`) antes de
  responder. 0 linhas no claim = um retry de B já ganhou o
  dequeue — no-op. Sem orçamento: deixa `queued`; a regra do
  item 4 é a rede de segurança. **O 200/5xx desta request HTTP
  é só dos `wamid` que vieram NESTE envelope Meta** (32ª
  rodada): drenar B (outra notificação) é oportunista; falha
  ao drenar B não vira 5xx do POST de A — a Meta retrataria A
  (já `completed`) e o status de B continua na notificação de B.
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
  nullable), **`request_payload` (JSONB, obrigatório no enqueue)**.
  **Sem o payload persistido o sweep da Decisão 7 não consegue
  reprocessar nada** (achado real de `/code-review` local, 29ª
  rodada — as colunas listadas até a 28ª não incluíam o envelope
  normalizado; "passar o payload já persistido" no item 4.5 não
  tinha onde persistir. Sem isso o cron só consegue alertar, nunca
  reinvocar). Gravar no `INSERT` do enqueue **o JSON exato que a
  `whatsapp-webhook` postaria no chatbot naquele instante** — não
  um subset. A lista da 29ª (`telefone`, `mensagem`/`media_id`/
  `url_anexo`, `phone_number_id`, `display_phone_number`,
  `nome_perfil`, `tipo`, `origem_canal`, `igreja_id`) **omitia
  campos que o Passo 1 já exige na chamada ao vivo** (achado real
  de `/code-review` local, 30ª rodada):
  - `filial_id` resolvido (chave do lock de conversa; triagem lê
    `body.filial_id` em `index.ts:1007` — sem persistir, o reclaim
    não reconstrói o mesmo lock e a triagem reabre lookup por
    `display_phone_number`).
  - `wamid` (claim na entrada dos dois chatbots; Passo 2).
  - os **dois** aliases de texto (`mensagem` **e** `conteudo_texto`)
    e de tipo (`tipo` **e** `tipo_mensagem`) — cada chatbot lê um.
  - `whatsapp_number` (financeiro deriva filial disso, não de
    `filial_id`).
  **`owner_token` NÃO entra no `request_payload` gravado.** O token
  só existe depois do dequeue/aquisição do lock. Replay cru do JSON
  persistido cai no caminho Make (campo ausente = pular fencing,
  cenário 16 da ADR) — exatamente na retomada por reclaim, que é
  quando o fencing mais precisa valer. No dequeue **e** no reclaim:
  clonar o JSON persistido e injetar **só** o `owner_token` do lock
  de **conversa** (31ª rodada; o UUID da row de `wamid` fica no
  orquestrador). Uma frase residual da 30ª ("claim (wamid +
  conversa)") contradizia isso e mandaria o token errado pro
  chatbot. Mesma restrição de acesso do resto da tabela: PII de conversa. **Sem SELECT nenhum via PostgREST — nem pra admin, nem pra
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

  **Estados**: `queued` → `processing` → `chatbot_done` → `completed`
  (ou `processing` reclamado de novo se o lease expirar sem progresso;
  `queued` com lease de espera expirado também é roubável — ver item
  de enqueue abaixo).

  1. Enqueue: `INSERT` do `wamid` com `status=queued` (unique; lease
     longo de espera, ver item 2) **e `request_payload` já achatado**. Claim de `processing`: no dequeue,
     `queued` → `processing` com `owner_token=<novo uuid>`,
     `lease_until=now()+120s`. Em conflito
     (row já existe), só atualiza pra reclamar se `status=processing`
     E `lease_until < now()` (lease expirado) — vira dono novo com
     `owner_token` novo. **Enquanto a row está em `processing`**, toda
     escrita subsequente de estado exige `WHERE wamid=... AND
     owner_token=$meu_token` (fencing — só quem é dono corrente da vez
     consegue avançar o estado; um dono antigo que "acordou" depois de
     perder o lease não consegue mais gravar nada por cima de quem já
     reclamou) — **essa regra de fencing por `owner_token`, e a de
     transferência de dono que a acompanha (só reclama se
     `status=processing` E lease expirado), vale só pro estado
     `processing`, não pros estados seguintes** (achado real de `@codex
     review`, P1, 22ª rodada — corrigindo o item 4 abaixo: como essa regra nunca deixa
     alguém virar dono de uma row em `chatbot_done`, NENHUMA escrita
     condicionada a `owner_token` novo consegue afetar a row depois que
     o `processing` original terminou — o mecanismo de claim por item
     de entrega ficaria inalcançável na prática). Pra `chatbot_done`,
     a segurança real já vem do claim atômico POR ITEM de entrega (item
     4 abaixo) — o `owner_token` da row nesse estado é só decorativo,
     não precisa de gate condicional: qualquer tentativa pode atualizar
     `owner_token` da row livremente quando `status=chatbot_done`, e a
     transição final pra `completed` é um simples check "lista inteira
     `enviado`/`falhou`", sem exigir dono específico.
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
     entre etapas. **Falha de renovação (0 rows afetadas) é perda de
     posse, não erro transiente pra ignorar** (achado real de `@codex
     review`, P1, 24ª rodada — o heartbeat como descrito renova
     periodicamente e cancela quando o `await` retorna, mas não diz o
     que fazer se uma renovação FALHAR no meio — ou seja, o `UPDATE ...
     WHERE wamid=... AND owner_token=$meu_token AND lease_until > now()`
     afeta 0 linhas porque outro worker já reclamou o lease expirado.
     Nesse caso a invocação original continua rodando e mutando sessão/
     `atendimentos_bot` mesmo sem ser mais dona — o fencing por
     `owner_token` só protege a ROW de orquestração no próximo write de
     ESTADO, não desfaz mutação que já aconteceu rio abaixo nem cancela
     a chamada ao Graph/chatbot em voo). Tratar renovação com 0 linhas
     afetadas como sinal de perda de posse. **"O mesmo heartbeat renova
     os dois leases" (achado da 17ª rodada) não implica checagem
     unificada de falha — são 2 `UPDATE`s, 2 contagens de linha pra
     checar separadamente** (achado real de `/code-review ultra` local, PR
     #133: o heartbeat unificado (item 17ª rodada, acima) dispara um
     `UPDATE` no lease do `wamid` E um `UPDATE` no lease da CONVERSA a
     cada tick — mas são 2 statements contra 2 rows/tabelas diferentes;
     nada garante que os dois sempre sucedem ou falham juntos. Se só o
     `UPDATE` do `wamid` for checado quanto a 0 linhas [porque é o que
     está explicitamente descrito acima], e o da CONVERSA falhar
     sozinho [outro `wamid` da mesma conversa roubou o lock expirado
     enquanto o lease do `wamid` atual ainda está saudável], o
     orquestrador segue achando que tem posse — fencing do `wamid`
     intacto — enquanto o lock de CONVERSA já foi roubado, permitindo
     a exata invocação concorrente do chatbot que esse lock existe pra
     evitar, sem o orquestrador nunca detectar). O heartbeat precisa
     checar a contagem de linhas dos 2 `UPDATE`s independentemente, e
     tratar `perdeuPosse=true` se QUALQUER um dos dois afetar 0 linhas
     — não só o do `wamid`. **A flag local no
     orquestrador NÃO fecha o buraco** (achado real de `@codex review`,
     P1, 24ª rodada, **ainda aberto no `/code-review` local da 26ª** —
     `atendimentos_bot` é escrito DENTRO de `chatbot-financeiro`/
     `chatbot-triagem`, que são outro isolate HTTP; a flag
     `perdeuPosse` só vive no `whatsapp-webhook` e só consegue pular
     `chatbot_result`/Graph DEPOIS que o `await fetch` retorna. Enquanto
     o chatbot está em voo, ele muta sessão à vontade; um takeover do
     lease de conversa por outro `wamid` gera duas invocações
     concorrentes no mesmo `atendimentos_bot` — exatamente o que o
     lock de conversa existe pra evitar). Fase 1 fecha isso de verdade:
     1. Passar no body dos dois chatbots **só o `owner_token` do
        lock de CONVERSA** — não o da row de `wamid` (achado real
        de `/code-review` local, 31ª rodada: o texto anterior
        ("token do lock de conversa (e do claim de `wamid`)")
        cabia num campo só; são 2 UUIDs de 2 tabelas. O chatbot
        revalida `atendimentos_bot` contra a row de conversa,
        `UPDATE ... WHERE owner_token=$token`; mandar o token da
        row de `wamid` faz essa query afetar 0 linhas → 409 em
        todo write depois do corte. O claim interno de
        idempotência do chatbot (item 5) gera o **próprio** token
        na tabela append-only dele; o token da row de orquestração
        nunca sai do `whatsapp-webhook`). **Ausente = caminho Make, não é erro**
        (achado real de `/code-review` local, 27ª rodada — o Passo 2
        atualiza o Make só pra `x-webhook-secret` + `wamid`; o Make
        nunca vai ter lock de conversa nem esse token. Se o chatbot
        exigir `owner_token` no mesmo deploy que fecha os endpoints,
        toda chamada real ainda passando pelo Make leva 409 e o
        tráfego de produção cai na janela pré-cutover — o mesmo
        padrão do `wamid` ausente, 25ª rodada). Fencing do lock só
        quando o campo vem preenchido; sem ele, pular a revalidação
        (paridade com o Make de hoje, que também não serializa por
        conversa). Depois do corte, a `whatsapp-webhook` **sempre**
        manda o token.
     2. Antes de CADA write em `atendimentos_bot`, o chatbot revalida
        o lock (`UPDATE ... WHERE owner_token=$token AND lease_until >
        now()`); 0 linhas → aborta sem mutar, responde 409. **Só
        aplica se `owner_token` veio no body** (item 1).
     3. Orquestrador trata 409 como perda de posse: não grava
        `chatbot_result`, não envia Graph, responde 5xx pra Meta.
     4. Defesa extra no orquestrador: `AbortSignal.timeout` no `fetch`
        do chatbot limitado ao tempo restante do lease (ex.: 90s dum
        lease de 120s) — cobre o caso "isolate vivo mas lento", não o
        isolate congelado (aí só o fencing interno do passo 2 segura).
     Cobrir o cenário "renovação falha no meio do processamento" nos
     testes da ADR-033 §Validação **exercitando o abort DENTRO do
     chatbot** (sessão inalterada), não só o skip de Graph no
     orquestrador.
     **O heartbeat também precisa cobrir o tempo de
     ESPERA na fila FIFO de conversa, não só a execução** (achado real
     de `@codex review`, P1, 23ª rodada — se um item ficar atrás de uma
     mensagem lenta na fila por mais que os 120s do lease do `wamid`,
     esse lease expira ainda na fila [antes de qualquer heartbeat de
     execução começar], a Meta pode reentregar e reclamar o mesmo
     `wamid`, e o worker antigo ainda na fila pode eventualmente pegar
     sua vez e invocar o chatbot mesmo assim — o fencing só é checado
     nas escritas de estado, não imediatamente antes de invocar).
     Reclamar o claim de `processing` só no momento de DESENFILEIRAR
     (não antes, ao entrar na fila) e revalidar posse (`owner_token`
     ainda válido) imediatamente antes de chamar o chatbot — não deixar
     um claim "vivo" de 120s contando tempo enquanto só está esperando.
     **Mas a row de `wamid` TEM que nascer no enqueue, senão a
     redelivery entra na fila duas vezes** (achado real de `/code-review`
     local, 26ª rodada — "claim só no dequeue" sem unique no enqueue
     deixa duas entregas Meta do mesmo `wamid` virarem dois itens FIFO;
     o segundo só descobriria `completed` depois de esperar a conversa
     inteira, e se o primeiro worker morrer ainda `queued` a unique
     nenhuma impede o duplicado). Estados: `queued` → `processing` →
     `chatbot_done` → `completed`. `INSERT` no enqueue com
     `status=queued`, `owner_token`, `lease_until=now()+15min`
     (heartbeat longo só de "ainda estou esperando na FIFO", não o
     lease de 120s de processamento) e unique em `wamid`.     Conflito:
     `queued` com lease válido **não é 5xx cego** (ver item 4);
     `queued` com lease expirado → rouba `owner_token` e **tenta o
     dequeue na mesma request**. No
     dequeue: `queued` → `processing` com lease de 120s e token novo.
  3. Depois que o chatbot responde: grava `chatbot_result` e
     `status=chatbot_done` (condicionado ao `owner_token`) ANTES de
     tentar qualquer envio via Graph. **`chatbot_result` guarda uma
     lista de entregas, não um resultado único** (achado real de
     `@codex review`, P1, 5ª rodada — quando `notificar_admin` é
     verdadeiro **E `erro_ia` está ausente/`false`** existem 2 envios
     Graph independentes por `wamid`, resposta ao membro E template ao
     pastor; `notificar_admin: true` com `erro_ia: true` é só a
     resposta ao membro — **não** entra item `pastor` na lista
     (achado real de `/code-review` local, 27ª rodada, alinhando este
     parágrafo com o gate de `erro_ia` do Passo 1; senão o
     orquestrador enfileira `igreja_alerta_lider` em toda falha de IA
     mesmo depois daquele gate). Um estado único não permite retry
     parcial sem duplicar a que já foi enviada ou perder a que falhou):
     `[{alvo: "membro", payload, status: "pendente"|"enviado"}, {alvo:
     "pastor", payload, status: "pendente"|"enviado", opcional}]`. Cada
     entrega tem seu próprio status; o `wamid` só vira `completed`
     quando TODAS as entregas da lista estiverem `"enviado"`.
  4. **Toda entrada nova reclamando um `wamid` existente precisa agir
     conforme o status encontrado**:
     - `completed` → responde 200, não faz nada (já entregue de verdade).
     - `queued` → **não é 5xx cego só porque o lease ainda vale**
       (achado real de `/code-review` local, 31ª rodada — o texto
       da 27ª/5ª rodada mandava 5xx em `queued`+lease válido pra
       a Meta não parar de reentregar se o worker original morresse
       ainda na fila. Sem `waitUntil`, esse 5xx **também** é o que
       a request de B recebe enquanto A segura o lock. Quando A
       termina e libera a conversa, B continua `queued` com lease
       de 15min válido: a próxima redelivery de B leva 5xx de
       novo, o sweep ignora lease válido, e B só anda daqui a
       15min — no caminho feliz de duas mensagens da mesma
       conversa, não só em crash. O parágrafo do Passo 1 que diz
       "quem ganha o dequeue processa nessa request" contradiz
       esse 5xx cego: ninguém ganhava o dequeue nunca).
       Regra: dequeue é **um transaction** — `LOCK` da row de
       conversa `FOR UPDATE`, reler a cabeça da FIFO, só então
       `queued`→`processing` se esta row **ainda** é a cabeça
       (achado real de `/code-review` local, 32ª rodada: checar
       cabeça e adquirir lock em 2 statements deixa uma mensagem
       mais velha inserida no meio virar não-cabeça depois da
       checagem; o debounce da 12ª rodada não fecha isso sozinho
       no retry). Conseguiu → processa até o fim nesta request.
       Lock ocupado por outro `wamid` → **5xx** (a Meta reentrega;
       quem completar o `wamid` corrente drena a FIFO depois de
       `completed`, ver lock de conversa). `queued` com lease expirado → rouba
       `owner_token` e aplica a **mesma** regra de dequeue, não
       "continua queued" e devolve — steal sem dequeue + lease
       renovado de 15min prende a mensagem até o próximo expiry,
       e o cron do reclaim receber 200 acharia que acabou.
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
       pela row — manda pro Graph de fato. **"Transição atômica por
       item" precisa de UM statement condicionado, não read-modify-
       write em 2 passos** (achado real de `/code-review ultra` local,
       PR #133: a especificação diz QUE cada item precisa de claim
       atômico, mas não FIXA a forma SQL — um `SELECT
       chatbot_result`, mutar o array em memória na aplicação, depois
       `UPDATE chatbot_result = $array_mutado` é exatamente o padrão
       que reabre a mesma corrida que este item existe pra fechar:
       2 retentativas concorrentes cada uma lê o array com o item
       ainda `"pendente"`, cada uma muta um elemento DIFERENTE
       localmente, e o segundo `UPDATE` sobrescreve o array inteiro —
       inclusive a transição que a 1ª retentativa já tinha gravado pro
       OUTRO item, revertendo-a pra `"pendente"` e reabrindo envio
       duplicado nesse item também). Usar um `UPDATE` único
       condicionado no valor atual do item específico via `jsonb_path`/
       índice, ex.: `UPDATE wamid_dedup SET chatbot_result =
       jsonb_set(chatbot_result, '{N,status}', '"enviando"') WHERE
       wamid = $1 AND chatbot_result->N->>'status' = 'pendente'
       RETURNING chatbot_result->N` — `N` é o índice do item na lista
       (membro=0, pastor=1); `0` linhas afetadas = outra tentativa já
       reclamou esse item específico, mesmo que o array inteiro tenha
       sido tocado por outra transação no meio. Se a lista de entregas
       crescer além de 2 itens fixos no futuro, considerar migrar pra
       tabela normalizada (`wamid_entregas`, 1 linha por item) em vez
       de continuar aninhando `jsonb_set` por índice — mais simples de
       manter atômico e ganha `FOR UPDATE SKIP LOCKED` de graça, mas
       reescrever isso agora é desproporcional pros 2 itens fixos de
       hoje (membro/pastor). Item já `"enviando"` com
       lease válido é pulado por qualquer outra tentativa concorrente,
       **que responde 5xx, não 200** (achado real de `@codex review`,
       P1, 13ª rodada — mesma lógica do branch `processing`: se a
       tentativa concorrente pular o item ocupado e devolver 200, e o
       dono da entrega ativa cair logo depois, a Meta para de reentregar
       e o item nunca chega no caminho de lease expirado/reconciliação
       manual — fica preso pra sempre). Marca cada item `"enviado"`
       conforme confirma; só marca o `wamid` inteiro `completed` e
       responde 200 quando a lista estiver toda `"enviado"` ou `"falhou"`
       (ver estado novo abaixo). **Rejeição definitiva do Graph precisa
       de estado terminal próprio, não só `pendente`/`enviando`/
       `enviado`** (achado real de `@codex review`, P2, 19ª rodada — um
       400 de verdade do Graph, ex.: parâmetro de template inválido ou
       destinatário inválido, nunca vai ter sucesso não importa quantas
       vezes reenviar; sem um estado terminal de falha, o item fica
       preso em `"enviando"` indo pra reconciliação manual pra sempre, o
       `wamid` NUNCA satisfaz "lista inteira enviado", e o webhook nunca
       consegue confirmar 200 o evento original — a Meta reentrega pra
       sempre). Adicionar `"falhou"` como 4º estado: resposta do Graph
       classificada como definitivamente não-retryable (4xx de
       parâmetro/destinatário inválido, não rate-limit/5xx) marca o item
       `"falhou"` direto, sem reconciliação manual — esse item conta
       como "resolvido" (não vai ter sucesso nunca, alertar mas seguir),
       não bloqueia o `wamid` de fechar `completed`.
       **A classificação "4xx = falhou definitivo" precisa excluir 401/
       403 explicitamente** (achado real de `/code-review ultra` local,
       PR #133: `401`/`403` são 4xx, mas significam token
       expirado/revogado — uma condição SISTÊMICA e corrigível [rotação
       de `WHATSAPP_TOKEN`], não um defeito da mensagem específica como
       template/destinatário inválido. Se a regra for "todo 4xx não-
       rate-limit vira `falhou` direto", um incidente de token
       corrompido marcaria PERMANENTEMENTE como `"falhou"` toda entrega
       em voo no momento — sem reconciliação manual nenhuma, por
       desenho — mesmo depois do token ser corrigido; isso é uma
       regressão de disponibilidade pior que duplicar/atrasar entrega,
       que é o cenário que o resto deste desenho já trata como "menos
       grave que duplicar lançamento financeiro"). `401`/`403` do Graph
       ficam em `"enviando"` (ou um 5º estado `"erro_credencial"`, se
       fizer diferença operacional alertar esse caso separado) — sujeito
       a alerta operacional imediato (é sinal de token quebrado pra
       TODA a integração, não só esse item) e SEM transição automática
       pra `"falhou"`; só reconciliação manual depois do token corrigido.
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
  4.5. **Todo reclaim de lease expirado acima depende de uma NOVA
     requisição HTTP tocar o mesmo `wamid` — não existe reclaim
     autônomo, promovido de "aceitável" pra obrigatório** (achado real
     de `/code-review ultra` local, PR #133, P1: o repo não usa
     `EdgeRuntime.waitUntil` em lugar nenhum — item já documentado no
     Passo 4 sobre "200 rápido" — e o lease de `queued` é
     explicitamente NÃO renovado por heartbeat, só o de `processing`
     [item 2 acima]. Se o isolate que fez o `INSERT ... status=queued`
     morrer ANTES de desenfileirar, ou se uma mensagem ficar presa
     atrás de outra na fila por mais que os 15min do lease de espera, a
     ÚNICA forma de alguém reclamar essa row é uma nova requisição
     HTTP real bater no MESMO `wamid` de novo — e isso só acontece se
     a Meta reentregar. A documentação oficial da Meta Cloud API
     descreve reentrega por até ~7 dias em teoria, mas na prática
     comercial (rate limits, circuit breakers do lado da Meta, o
     próprio endpoint respondendo 5xx repetidamente) não é uma garantia
     confiável de "sempre vai retentar dentro do lease" — e mesmo
     quando reentrega, se for a MESMA pessoa que não manda outra
     mensagem, não existe ATO NENHUM que dispare a reentrega antes do
     limite da Meta. Resultado no pior caso: mensagem perdida
     silenciosamente pra sempre, sem alerta, sem reconciliação — o
     oposto do que essa máquina de estado inteira foi desenhada pra
     evitar). Fase 1 precisa de um sweep independente de tráfego HTTP
     novo: job `pg_cron` a cada poucos minutos. **Não postar na
     rota pública da `whatsapp-webhook` como se fosse envelope Meta**
     (achado real de `/code-review` local, 29ª rodada — o caminho
     Meta valida `X-Hub-Signature-256` no body cru; um
     `pg_net.http_post` com `{wamid}` falha a assinatura, e fabricar
     um envelope Meta assinado com `META_APP_SECRET` de dentro do
     Postgres é o caminho errado; a 30ª rodada abaixo é o que
     impede o `{action: "reclaim"}` de virar bypass desse HMAC). Rota interna na mesma function (ex.: `POST .../whatsapp-webhook`
     com `{action: "reclaim", wamid}`), autenticada como os crons que
     já existem **no lado do caller**: `Authorization: Bearer` lido de
     `vault.decrypted_secrets` onde `name = 'cron_service_role_key'`
     — **nunca** `current_setting('app.settings.service_role_key')`.
     Essa GUC nunca existiu neste projeto; os jobs
     `getnet-sync-automatico`/`buscar-pix-automatico` falharam 100%
     das vezes até a migration
     `20260813020100_fix_cron_service_role_key_vault.sql` apontar pro
     Vault. Copiar o padrão dessa migration (URL pública hardcoded,
     `timeout_milliseconds := 120000` — o default do `net.http_post`
     é 5s, insuficiente pra chatbot+Graph).
     **O isolate tem que revalidar o Bearer — o gateway desta
     function não faz isso** (achado real de `/code-review` local,
     30ª rodada): com `verify_jwt=false` (obrigatório pra Meta),
     qualquer um na URL pública postando `{action: "reclaim",
     wamid}` pula o HMAC da Decisão 2. Comparar o token com
     `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` no handler (o Vault
     não é acessível do isolate; a env **é** o mesmo valor que o
     cron lê no Vault), igual `getnet-sftp/index.ts:468-473`. Sem
     Bearer válido → 401, não processa. O `action` sozinho nunca
     autoriza. Ver despacho do `POST` no início do Passo 1.
     O POST do cron carrega **só** `{action, wamid}` (não o PII —
     `pg_cron`/`net._http_response` loga body). A function lê
     `request_payload` da row, injeta o `owner_token` **da conversa**
     corrente (não o da row de `wamid` — 31ª rodada) e entra no MESMO
     switch de status, **incluindo a tentativa de dequeue** se o
     item está `queued`. Sem a coluna o cron não tem o que reprocessar.
     **Escopo do sweep: só `queued`/`processing` com lease expirado.**
     Não tocar `enviando` com lease expirado nem `erro_credencial`
     (401/403) — esses continuam reconciliação manual (8ª rodada:
     reenvio cego duplica mensagem; 28ª: token quebrado não é
     `"falhou"` permanente). O reclaim entra no MESMO switch de
     status de uma redelivery da Meta (item 4), não num atalho que
     reinvoca o chatbot às cegas.
     Alertar via `log_edge_function_with_metrics` em CADA row
     encontrada é adicional, não substituto do reclaim.
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
     `chatbot-triagem` fecha a sessão pra `CONCLUIDO` PRIMEIRO
     (`index.ts:1376-1387`) e só DEPOIS grava em `pedidos_oracao`/
     `testemunhos`/`atendimentos_pastorais` conforme a intenção
     classificada (`index.ts:1453-1517`) — achado real de `/code-review`
     local corrigindo a ordem que uma rodada anterior tinha invertido.
     Essa ordem real importa pro desenho de idempotência: um crash entre
     o fechamento da sessão e o insert pastoral deixaria a sessão com
     `status=CONCLUIDO` sem o registro pastoral ter sido gravado — por
     isso o registro append-only de idempotência (item acima) não pode
     inferir "já processado" a partir do status da sessão; só marca
     `completed` depois que TODA a sequência (fechamento + insert)
     terminar de verdade. Cobrir
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
       resultado anterior. **`criarLancamento` roda em LOOP, um `wamid`
       cru não serve de chave** (achado real de `@codex review`, P1,
       18ª rodada — uma confirmação de DESPESA/CONTA_ÚNICA com vários
       comprovantes itera `metaDados.itens` chamando `criarLancamento`
       uma vez por item, `index.ts:1676-1714`; passar o MESMO `wamid`
       pra cada chamada do loop rejeita todo item depois do 1º [se a
       unicidade for estrita] ou permite duplicar itens já criados numa
       retentativa no meio do loop [se for frouxa]). Chave composta
       `wamid + item_id/índice` por item, não `wamid` sozinho — cada
       item do lote tem sua própria idempotência, todos os N itens
       pretendidos são criados uma vez, e uma retentativa reproduz só
       os que faltaram. Pra `chatbot-triagem`: **registro append-only
       por `wamid`, não campo na sessão mutável** (achado real de
       `@codex review`, P1, 16ª rodada — `atendimentos_bot` é a MESMA
       row reusada por toda mensagem da conversa; gravar `wamid` nela
       significa que a mensagem B sobrescreve o marcador da mensagem A,
       e um retry atrasado de A — ex.: resposta do chatbot pra A se
       perdeu — não encontra mais conflito nenhum depois que B já
       rodou, podendo duplicar o pedido de oração/testemunho/pastoral
       de A de novo). Tabela/registro separado, chave única em `wamid`
       (guardando o resultado anterior junto). **Claim no INÍCIO da
       function, não só antes do branch de gravação por intenção**
       (achado real de `@codex review`, P1, 19ª rodada — `chatbot-
       triagem` já faz trabalho com efeito antes desse ponto: cria/loga
       sessão, `index.ts:1042-1142`; tem handlers de "fluxo direto" que
       retornam a partir de `:1148`, sem NUNCA chegar no branch de
       gravação por intenção que a guarda protegia; e o caminho
       `completed` fecha/reescreve a sessão em `:1376-1387`. Guardar só
       antes da gravação por intenção não protege nenhum desses —
       replay do mesmo `wamid` pode recriar/avançar sessão ou repetir
       um fluxo direto de novo). Reclamar/cachear o `wamid` logo na
       ENTRADA da function. **O mesmo claim na ENTRADA vale pra
       `chatbot-financeiro`, não só pra triagem** (achado real de
       `@codex review`, P1, 26ª rodada — a mitigação das 3 unicidades
       no write de ledger só protege o commit final de reembolso/
       `fin_*`; os turnos comuns mutam `atendimentos_bot` ANTES. Ex.:
       um `"1"` atualiza a sessão de seleção de conta pra
       `TRANSFERENCIA_AGUARDANDO_CONFIRMACAO` em `index.ts:2349-2360`;
       se a resposta HTTP se perde, o retry do mesmo `wamid` processa
       `"1"` de novo em `:2416-2432` e escolhe o destino sem nova
       mensagem do usuário). Reclamar/cachear o `wamid` na entrada de
       `chatbot-financeiro` com o mesmo padrão (estado `processing` +
       `owner_token`/lease, só devolve cache quando `completed`). As
       unicidades no ledger continuam como defesa em profundidade do
       commit financeiro, não substituem o claim de sessão. **O
       registro interno precisa do MESMO
       fencing do claim externo, não "existe = já processado"**
       (achado real de `@codex review`, P1, 20ª rodada — se a 1ª
       invocação criar o registro e depois cair/der timeout ANTES de
       gravar a resposta, essa regra faz o retry (via lease externo de
       `processing`) achar o registro já existente e devolver
       resultado nulo/incompleto SEM NUNCA executar a mensagem de
       verdade — perde a mensagem pra sempre, o oposto do problema de
       duplicação que a guarda tentava resolver). Registro interno tem
       o mesmo padrão do claim externo: estado `processing` próprio com
       `owner_token`/lease que expira, só devolve resposta cacheada
       quando o registro está `completed` — se achar `processing` com
       lease expirado, reclama e executa de novo; não trata "registro
       existe" como sinônimo de "já processado com sucesso". Não fecha
       100% (upload de
       Storage isolado ainda pode duplicar em teoria), mas fecha os 3
       piores casos financeiros, o avanço de sessão no meio do fluxo
       financeiro, e o registro pastoral, com mudança aditiva, sem
       reescrever o motor `fin_*` existente.

  O dedupe de 5s por conteúdo que já existe dentro de `chatbot-triagem`
  fica como está (defesa em profundidade adicional), mas não é
  suficiente sozinho pros motivos acima.
- [ ] Envia a resposta via Graph API copiando o padrão de
  `send-otp/index.ts` (`WHATSAPP_TOKEN`), **mas NÃO o lookup de
  `phone_number_id`** (achado real de `@codex review`, P1, 21ª rodada
  — `send-otp/index.ts:97-116` usa `.limit(1)` e pega um número
  qualquer habilitado da igreja em `whatsapp_numeros`; copiar isso faz
  mensagem financeira poder ser respondida pelo número de triagem ou
  vice-versa, numa igreja com os 2 números documentados). A resposta
  tem que sair pelo MESMO `phone_number_id` já extraído da mensagem de
  entrada (`value.metadata.phone_number_id`, item de normalização do
  Passo 1) — nunca um novo lookup "primeiro número habilitado".
- [ ] Registra a execução via `log_edge_function_with_metrics` (RPC já
  existente). **200 pra Meta só quando o `wamid` está `completed`
  (ou a lista toda `"enviado"`/`"falhou"`); 5xx enquanto
  `queued`/`processing`/`enviando`** — não é "200 rápido" no sentido
  de responder antes de processar (achado real de `/code-review`
  local, 27ª rodada: o repo não usa `EdgeRuntime.waitUntil` em lugar
  nenhum, então não há worker pra drenar a FIFO depois que a
  resposta HTTP saiu; o processamento é síncrono no próprio
  request. 200 cedo enquanto o isolate ainda vai chamar o chatbot
  mata o resto do trabalho no return, e 200 em `processing` já foi
  rejeitado na 5ª/13ª rodada). A FIFO durável serve pra **outras
  requisições HTTP concorrentes** (outro `wamid` da mesma conversa,
  ou redelivery do mesmo): se o lock está ocupado, 5xx; se o lock
  está livre e este `wamid` é a cabeça, **esta** request ganha o
  dequeue e processa até o fim, só então 200. Quem já completou um
  `wamid` drena o próximo item da conversa nessa request se restar
  tempo (31ª rodada). **Batch da
  Meta** (`entry[]`/`messages[]` com mais de um item): enfileirar
  **todas** antes de processar (32ª rodada; seq = ordem no array).
  Um único status HTTP pra notificação inteira — 5xx se **qualquer**
  mensagem **deste** lote não estiver `completed` (enqueue falhou,
  ainda `queued`/`processing`/`enviando`). 200 só quando todas as
  do lote estiverem resolvidas. Item já `completed` no retry é
  no-op (item 4); 200 no lote com um item que falhou o INSERT
  perde essa mensagem pra sempre (não há row pro sweep). Drenar um
  `wamid` que **não** veio neste envelope não entra nessa conta.

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
   MAKE_WEBHOOK_SECRET` **E `wamid`** nas chamadas pra `chatbot-triagem`/
   `chatbot-financeiro`. Confirmar que está mandando os dois de verdade
   antes de seguir. **`wamid` no payload é pré-requisito, não
   opcional** (achado real de `@codex review`, P1, 25ª rodada): o Passo
   1 exige que os dois chatbots reclamem/cachear o `wamid` **na entrada
   da própria function** (ver §Idempotência acima, achado da 19ª
   rodada) como parte do MESMO deploy que fecha esses endpoints — mas
   os bodies reais hoje configurados no Make
   (`MAKE_WHATSAPP_PHONE_NUMBER_ID.md:182-205`, módulos 3a/3b) não
   mandam `messages[].id` nenhum, só `telefone`/`nome_perfil`/
   `conteudo_texto` ou `mensagem`/`tipo`/`origem_canal`/
   `phone_number_id`/`display_phone_number`. Deployar a exigência de
   `wamid` sem atualizar o blueprint primeiro faz toda chamada
   vinda do Make (que ainda carrega tráfego real nessa janela) chegar
   sem `wamid`, ou compartilhar uma chave de idempotência nula/inválida
   — quebrando validação ou furando a proteção até o corte (Passo 4).
   Adicionar `"wamid":
   "{{1.entry[].changes[].value.messages[].id}}"` aos 2 bodies (módulos
   3a e 3b) junto com o header do secret, na mesma atualização de
   blueprint deste passo.
   **Não** pedir `owner_token` no body do Make (achado real de
   `/code-review` local, 27ª rodada; o cenário 16 da ADR cobre o
   teste): esse campo só existe depois do corte, gerado pela
   `whatsapp-webhook`. O Make continuar sem ele é o caminho de
   compatibilidade do Passo 1 — fencing de lock de conversa fica
   no-op enquanto o caller for o Make.
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
  3. Esconder a aba `monitoring` de `/admin` (`Admin.tsx:1155-1157`)
     pra quem não é `super_admin` — a página é de admin de igreja, não
     de super_admin; com a policy nova o `.select` volta vazio/erro pra
     `admin` comum e a aba fica quebrada (achado real de `/code-review`
     local, 26ª rodada). `has_role(..., 'super_admin')` já existe e é
     o mesmo predicado da policy.
  Dar `edge_function_logs` uma coluna `igreja_id` real com RLS por
  tenant (pra liberar `admin` de igreja de novo, escopado à própria
  igreja) é fix maior, fora do escopo desta fase — tratar como
  fast-follow; até lá, só `super_admin` vê a tabela, ponto.
  **O raio de impacto é maior que só a lista — restringir a policy
  base apaga os cards de estatística e o gráfico diário pra QUALQUER
  `admin` comum, não só o dialog/lista de logs** (achado real de
  `/code-review` local, P1): `EdgeFunctionMonitoring.tsx` lê 4 fontes,
  não 1 — além de `edge_function_logs` (`:150-152`, a lista que este
  passo mira), também `view_edge_function_stats` (`:121-123`, cards de
  estatística) e `view_edge_function_daily_stats` (`:130-132`, gráfico
  diário). As duas views são `WITH (security_invoker = true)`
  (`20251219151025...sql:6-7,23-24`) sobre `edge_function_logs` — ou
  seja, herdam a policy da tabela base pro USUÁRIO que consulta, não
  do dono da view. Depois deste fix, um `admin` comum (não
  `super_admin`) some com os cards e o gráfico também, não só perde a
  lista de logs — o dashboard inteiro fica em branco pra ele, não só a
  tabela. Confirmar esse comportamento esperado com o time antes de
  deployar (é o trade-off aceito do fix, não um bug do fix em si), e
  ajustar o texto/loading state do dashboard pra `admin` não-
  `super_admin` em vez de deixar os cards quebrarem silenciosamente
  (query vazia sem erro, já que RLS nega linhas, não a query).

### Passo 4 — Corte (cutover)

- [ ] Deployar e testar isoladamente handshake `GET` + POST sintético,
  antes de tocar em qualquer configuração do Meta.
- [ ] Rodar os 18 cenários de teste da ADR-033 (§Validação — inclui
  reenvio de `wamid` simulado com 2 sessões reais, lock por conversa,
  payload real de mídia, retry de turno financeiro no meio do fluxo,
  tenant do número de triagem, reclaim autenticado, 401 do reclaim
  sem Bearer, e drenagem da FIFO depois que A completa com B ainda
  `queued`+lease válido) contra a nova função.
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
