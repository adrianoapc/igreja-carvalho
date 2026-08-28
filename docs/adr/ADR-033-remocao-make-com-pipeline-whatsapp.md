# ADR 033: Remoção do Make.com do Pipeline WhatsApp

**Status**: Proposto
**Data**: 2026-08-26
**Decisores**: Equipe de Desenvolvimento
**Tags**: #whatsapp #make #chatbot #integracao #automacoes

## Contexto

O Make.com hoje é o único ponto de contato entre a Meta WhatsApp Cloud API e
as Edge Functions do Supabase que já contêm toda a lógica de negócio
(sessão, triagem por IA, financeiro, escalas, sentimentos). Ele faz relay
puro — recebe o evento, decide pra onde mandar, devolve a resposta — mas
custa mensalidade, é um ponto de falha externo sem visibilidade nativa
(`edge_function_logs` já existe e cobre as functions, não cobre o Make), e
não agrega nada que justifique a dependência, já que `igreja_id`/
`filial_id` já são resolvidos do lado do Supabase.

Esta ADR nasceu de uma sessão de validação em que 3 blueprints reais foram
exportados do Make e comparados byte-a-byte contra o código do repo. A
topologia real diverge da documentação antiga (`docs/automacoes/
make-whatsapp-chatbots-blueprint.json`, que é exemplo/placeholder, não
export real) em pontos que mudam o desenho da solução — registrados abaixo
porque não são óbvios a partir do código sozinho.

### Inventário confirmado (via export real + varredura de código)

| Cenário Make (export real) | Trigger | Edge function(s) alvo | Observações |
|---|---|---|---|
| **Waba Chatbot - OakOS** | `whatsapp-business-cloud:watchEvents` (conector nativo Make, não webhook genérico) | `chatbot-financeiro` (número `1031291743394274`) / `chatbot-triagem` (número `745419461981790`) | Roteia por **`phone_number_id`**, não por palavra-chave nem por `consultar-sessao`. Sub-router de `chatbot-triagem` detecta substring `"QR code"` na resposta pra decidir entre texto e imagem — regra de negócio vivendo só no Make hoje. |
| **Waba Escalas OakOS** | `gateway:CustomWebHook` (recebido do app) | `disparar-escala` (tipo `make_escalas` na tabela `webhooks`) | App manda campos brutos (`nome_voluntario`, `data_culto`, `funcao_escala`); é o Make quem decide o template Meta `escala_convite_v1`. |
| **Waba Feelings OakOS** | `gateway:CustomWebHook` (recebido do app) | `disparar-alerta`, `criar-usuario` (OTP), `inscricoes-lembrete-evento` (via `disparar-alerta`) | Um único webhook multiplexado por campo `template`/`evento` em 4 branches: default (sentimento/acolhimento → `igreja_acolhimento_ia` pro membro + `igreja_alerta_lider` pro pastor), `lembrete_evento_inscricao` → `appointment_confirmation`, `otp_verificacao` → `verificacado_de_conta`, `mensagem_manual` → `appointment_confirmation` reaproveitado. |

**Achado arquitetural central**: em todo o pipeline (exceto `send-otp`, que já
fala direto com a Graph API v21.0), **o app nunca conhece o nome real do
template Meta**. Ele manda só um identificador interno (`template`/`evento`)
e é o Make quem decide, dentro dos blueprints, qual template Meta disparar.
Remover o Make exige recriar essa camada evento→template dentro do próprio
Supabase, estendendo o padrão que `send-otp` já usa.

### Cenários ainda não confirmados (fora do escopo desta ADR)

`receber-pedido-make` e `receber-testemunho-make` (Make→app, autenticados
por `MAKE_WEBHOOK_SECRET`) parecem superados: `chatbot-triagem`
(mantida ativamente, último commit 2026-08-18) já classifica intenção via
IA e grava direto em `pedidos_oracao`/`testemunhos`/`atendimentos_pastorais`
sem passar pelo Make. `receber-pedido-make` está parada desde 2026-06-23 e
`receber-testemunho-make` desde 2025-12-29 — consistente com terem sido
substituídas.

`notificar-liturgia-make` (liturgia), `checkin-whatsapp-geo` (check-in por
geolocalização) e `verificar-sentimentos-criticos` (um segundo caminho de
alerta emocional, separado de `analise-sentimento-ia` → `disparar-alerta`)
**não têm blueprint validado nem confirmação de estado** — o histórico do
Make pra esses fluxos é descrito pelo time como "tudo mato" (config antiga,
não revisada). Tratar como Fase 3 (auditoria antes de decidir remover ou
recriar) — ver plano de execução.

### Bugs conhecidos descobertos durante a validação (escopo desta ADR)

1. **`notificar_admin` não wired**: `chatbot-triagem` seta
   `notificar_admin: true` no payload de resposta quando a intenção é
   `SOLICITACAO_PASTORAL` (pedido pro gabinete pastoral), mas o cenário
   real "Waba Chatbot - OakOS" só reage a `reply_message` conter
   `"QR code"` — não existe node lendo `notificar_admin`/`admin`. Bug
   conhecido: a notificação ao pastor sobre escalonamento pastoral
   provavelmente não está saindo hoje. Corrigir na Fase 1, não só
   replicar o comportamento (quebrado) do Make.
2. **`chatbot-triagem` sem gate de segredo**: diferente de
   `chatbot-financeiro` (que ao menos loga aviso quando
   `MAKE_WEBHOOK_SECRET` está ausente, fail-open), `chatbot-triagem` não
   valida `x-webhook-secret` nenhum — qualquer um pode fazer POST direto
   nela hoje. Fechar como parte da Fase 1, reaproveitando o
   `MAKE_WEBHOOK_SECRET` já existente.
3. **Auth header do blueprint aponta pro projeto errado**: o header
   `Authorization` do "Waba Chatbot - OakOS" carrega uma anon key cujo
   `ref` no JWT é `mcomwaelbwvyotvudnzt` (projeto de teste, só aparece em
   `.env.test.local`), mas a URL chamada é a do projeto real
   (`ugnrumtngcskbfpwynsr`). Inofensivo hoje só porque `verify_jwt=false`
   nessas functions — sinal de blueprint desincronizado do ambiente, não
   um incidente ativo.
4. **`disparar-alerta` com branch `whatsapp_meta` morto** (achado numa
   investigação anterior, mantido aqui por registro): referencia uma
   variável `config` nunca declarada, gerando `ReferenceError` engolido
   pelo try/catch. Na prática só o Make envia WhatsApp de verdade nesse
   fluxo de alertas hoje. Fix próprio, fora do escopo desta ADR.
5. **`make_geral`** existe como tipo de webhook configurável na UI admin
   (`Webhooks.tsx`, `ConfiguracoesGlobais.tsx`) mas nenhuma edge function
   faz query com esse tipo em runtime — órfão, candidato a remoção de UI.

## Decisão

Substituir o relay do Make por uma Edge Function própria
(`whatsapp-webhook`) que fala diretamente com a Meta Graph API, replicando
o comportamento validado dos blueprints reais (não o assumido pela
documentação antiga) — em fases, por cenário, com o Make de cada fase
mantido desligado (não apagado) até confirmação em produção. Rollback
**não é 1 clique** (achado real de `@codex review`, ver plano de
execução §Fase 1 Passo 4): depois do corte, a Meta entrega tudo pro
endpoint novo; reativar o scenario no Make sozinho não redireciona
tráfego nenhum — é preciso também trocar a URL do callback de volta no
Meta Business Manager.

### 1. Roteamento por `phone_number_id`, não por palavra-chave

A `whatsapp-webhook` resolve `igreja_id`/`filial_id`/destino via
`phone_number_id` do payload da Meta — espelhando o Router real do Make
("Waba Chatbot - OakOS"), não um roteamento por palavra-chave (que não
existe no cenário real; era suposição da versão anterior deste plano).
Lookup em `whatsapp_numeros` **pelo `phone_number_id`** (índice único),
não só por `display_phone_number`. Sem row com `igreja_id NOT NULL`,
não roteia (5xx) — `chatbot-triagem` hoje insere sessão com tenant
nulo em vez de falhar, e o número `745419461981790` não tem seed
commitado (bloqueio de cutover; ver plano §Passo 1). **`filial_id`
resolvido aqui não chega ponta a ponta pros dois chatbots** (achado
real de `/code-review ultra` local, PR #133, clarificando esta
decisão): `chatbot-triagem` aceita `body.filial_id`, mas
`chatbot-financeiro` **ignora** esse campo e deriva a própria filial
via `resolverIgrejaEFilialWhatsApp` por `display_phone_number` — ver
plano §Passo 1 pro detalhe completo. Quem só lê este resumo não
saberia que a filial resolvida aqui é descartada num dos dois
caminhos.

### 2. Handshake e assinatura da Meta, hoje delegados ao conector nativo do Make

Como o trigger real é `whatsapp-business-cloud:watchEvents` (conector
gerenciado pelo Make), a nova função precisa implementar do zero o que o
Make faz de graça: handshake `GET` (`hub.verify_token`/`hub.challenge`
contra novo segredo `WHATSAPP_VERIFY_TOKEN`) e validação de assinatura
`POST` (`X-Hub-Signature-256` contra `META_APP_SECRET`, verificação nova —
o Make não valida isso hoje). A troca de assinatura no Meta Business
Manager (de "endpoint do Make" pra "endpoint do Supabase") é o ponto de
corte real da Fase 1.

### 3. Normalização de resposta na camada de orquestração

`chatbot-financeiro` responde em `.data.text`; `chatbot-triagem` responde
em `.data.reply_message`. A `whatsapp-webhook` normaliza os dois formatos
antes de montar a mensagem de saída — paridade com o que o Router do Make
já faz hoje via `if(exists(...))` encadeado.

### 4. Decidir texto vs. imagem pela presença de `qr_image`, e corrigir o `notificar_admin`

Não replicar a regra do Make como está: a versão original (detecção de
substring `"QR code"` na resposta de `chatbot-triagem`) nunca dispararia
— o texto real sempre usa `"QR Code"` com C maiúsculo (achado real de
`@codex review`). A `whatsapp-webhook` decide pela **presença do campo
`qr_image`** no payload de retorno, não por substring de texto — mais
robusto e não depende de capitalização de mensagem. Já o
`notificar_admin` também não é replicado como está (quebrado); a Fase 1
entrega o disparo real da segunda mensagem ao pastor quando
`notificar_admin: true` — **via template aprovado `igreja_alerta_lider`**
(achado no blueprint "Waba Feelings OakOS"), não mensagem free-form:
a Meta rejeita mensagem business-initiated fora da janela de 24h da
conversa, e o pastor não necessariamente conversou com esse número
recentemente (achado real de `@codex review`, 2ª rodada). O `to` do
template é `telefone_admin_destino` já devolvido por `chatbot-triagem`
(`resolverTelefonePlantaoPastoral`), não um número fixo. **Mas
`notificar_admin: true` tem 2 produtores, só 1 deve virar template**
(achado real de `/code-review` local): além do branch
`SOLICITACAO_PASTORAL` (`index.ts:1502`), `responderComFalhaIA`
(`index.ts:1279-1288`) também retorna `notificar_admin: true` em
QUALQUER falha técnica de IA (timeout, erro HTTP do provedor, conteúdo
vazio) — distinguível pelo campo `erro_ia: true`, presente só nesse
caminho. Disparar o template só quando `erro_ia` estiver ausente; falha
técnica de IA não deve virar mensagem template pro pastor com um texto
técnico nos parâmetros (ver plano §Passo 1 pro detalhe completo).

### 5. Token via Graph API — paridade primeiro, segredo por igreja depois

Reaproveitar o padrão de `send-otp/index.ts` (única chamada direta à Meta
que já funciona hoje): variável global `WHATSAPP_TOKEN` +
`phone_number_id` resolvido por igreja via `whatsapp_numeros`. É paridade
com o Make atual (que também usa token compartilhado), não regressão.
Migrar pra segredo criptografado por igreja
(`webhooks.secret_encrypted`) fica como fast-follow, só necessário quando
houver mais de uma conta WhatsApp Business real entre igrejas.

### 6. Fechar os endpoints hoje abertos

`chatbot-triagem` (sem gate nenhum) e `chatbot-financeiro` (fail-open) só
serão chamados pela nova função depois do corte — este é o momento
natural de fechar os dois com validação `x-webhook-secret` fail-closed,
reaproveitando o `MAKE_WEBHOOK_SECRET` já existente.

### 7. Reclaim de lease expirado não pode depender só de redelivery da Meta

A máquina de estado de dedup/lease (`queued`→`processing`→`chatbot_done`→
`completed`, ver plano de execução §Passo 1) só reclama um lease expirado
quando uma NOVA requisição HTTP toca o mesmo `wamid` — e a única fonte
dessa requisição nova é a própria Meta reentregando o webhook. Sem
`EdgeRuntime.waitUntil` em uso em nenhuma function do repo, não existe
worker nenhum rodando fora do ciclo de vida de uma requisição HTTP
(achado real de `/code-review ultra` local, PR #133). Se o isolate que
enfileirou uma mensagem morrer antes de desenfileirar, ou uma mensagem
ficar presa atrás de outra por mais que o lease de espera, o único jeito
de reclamar é a Meta reentregar — sem garantia formal disso acontecer
dentro da janela de lease. Fase 1 adiciona um job `pg_cron` (extensão já
disponível no Supabase Postgres) que varre periodicamente leases
expirados **sem depender de tráfego HTTP da Meta**. O job **não**
posta na rota pública (assinatura `X-Hub-Signature-256`); usa uma
rota interna `{action: "reclaim", wamid}` autenticada com
`vault.decrypted_secrets` (`cron_service_role_key`), o mesmo padrão
que consertou os crons `getnet-sync`/`buscar-pix`
(`20260813020100_fix_cron_service_role_key_vault.sql` — GUC
`app.settings.*` nunca funcionou neste projeto). **Copiar só o
caller não basta** (achado real de `/code-review` local, 30ª
rodada): `getnet-sftp`/`buscar-pix-cron` não estão em
`config.toml` com `verify_jwt=false`, então o *gateway* valida o
Bearer `service_role` antes do isolate. `whatsapp-webhook` **tem**
que ser `verify_jwt=false` (Meta não manda JWT — Decisão 2); o
gateway não checa o Bearer do cron. Sem comparação **dentro** da
function (`token === SUPABASE_SERVICE_ROLE_KEY`, padrão
`getnet-sftp/index.ts:468-473`) **antes** de pular o HMAC, um POST
público `{action: "reclaim", wamid}` reprocessa PII sem assinatura
Meta. O envelope normalizado tem que estar persistido no enqueue
(`request_payload` = body exato do chatbot, inclusive `filial_id` e
`wamid`; `owner_token` **não** vive aí — é injetado no dequeue);
sem isso o cron não tem o que reprocessar. Escopo: só
`queued`/`processing` expirados — não reenvia `enviando` às cegas.
Timeout do `net.http_post` 120s, não o default de 5s.

### 8. Escalas e Feelings ficam pra Fase 2; Liturgia/geo/pedido/testemunho pra Fase 3

Esta ADR cobre o cenário "Waba Chatbot" (triagem + financeiro) como Fase 1
porque é o único com export validado ponta a ponta nesta sessão. Escalas e
Feelings têm export real mas não foram implementados ainda — Fase 2, ADR
não precisa ser reaberta, só o plano de execução é estendido. Liturgia,
check-in geo, e os dois caminhos de alerta emocional (`verificar-
sentimentos-criticos` vs `analise-sentimento-ia`) exigem auditoria antes
de qualquer decisão — Fase 3, ver plano.

## Consequências

### Positivas

✅ Elimina mensalidade e ponto de falha externo sem visibilidade nativa
✅ Reaproveita `edge_function_logs` + `EdgeFunctionMonitoring.tsx` já
   existentes — visibilidade de execução sem tabela nova
✅ Corrige 3 problemas de segurança/correção reais encontrados durante a
   validação (`notificar_admin` não wired, `chatbot-triagem` sem gate,
   vazamento cross-tenant em `edge_function_logs` achado em review)
✅ Scenario do Make mantido (só desligado, não apagado) durante o período
   de convivência — mas rollback exige trocar a URL do callback de volta
   no Meta Business Manager, não é 1 clique (ver plano de execução §Fase
   1 Passo 4)

### Negativas

⚠️ Handshake e validação de assinatura da Meta, hoje de graça via conector
   nativo do Make, precisam ser implementados e testados do zero
⚠️ Dedupe hoje é uma janela de 5s por conteúdo em `chatbot-triagem`, não
   por `message_id` (wamid) da Meta — a Meta reentrega o evento se a
   resposta 200 demorar (esperado aqui, processamento envolve IA/Graph).
   Obrigatório na Fase 1 (achado de `@codex review`, 5 rodadas até
   convergir): claim com fencing por `owner_token` (reclamado de novo a
   cada tentativa de entrega, não só na claim original) ANTES de chamar
   qualquer chatbot, lease de 120s (não 30s), lista de entregas Graph
   independentes por `wamid` (não um resultado único — `notificar_admin`
   manda 2 mensagens separadas), concorrência que encontra `processing`
   ainda válido responde erro (não 200 — 200 pra quem não processou de
   verdade impede a Meta de reentregar se o dono original cair), e
   idempotência própria dentro de `chatbot-triagem`/`chatbot-financeiro`
   por `wamid` (o orquestrador sozinho não fecha o caso de resposta do
   chatbot perdida em trânsito). **Eixo separado, não coberto por
   `wamid`**: lock por conversa (`igreja_id`+`filial_id`+
   `phone_number_id`+`telefone`) pra serializar mensagens DIFERENTES da
   mesma conversa entregues em paralelo — sem isso, duas mensagens reais
   do mesmo usuário podem invocar o chatbot concorrentemente e
   corromper `atendimentos_bot` (sem lock hoje) — precisa ser FIFO pela
   ordem real de chegada, não só exclusão mútua (senão uma mensagem
   mais nova processa antes de uma mais velha da mesma conversa).
   **`queued`+lease válido não é 5xx cego** (achado real de
   `/code-review` local, 31ª rodada): sem `waitUntil`, a 2ª mensagem
   da conversa que encostou na fila enquanto a 1ª rodava ficaria
   15min parada — a request que completa um `wamid` drena a FIFO
   nessa invocação, e redelivery/reclaim tenta dequeue se o lock
   está livre e o `wamid` é a cabeça. O `owner_token` no body do
   chatbot é **só** o do lock de conversa, não o da row de `wamid`.
   Idempotência transacional 100% (Storage + múltiplos inserts em cada
   chatbot) é maior que o escopo desta fase — Fase 1 entra só com
   guarda de unicidade no primeiro write de cada fluxo, cobertura
   completa fica fast-follow. Tabela de dedupe/
   entrega é acesso `service_role`-only, sem SELECT via PostgREST pra
   ninguém (mesmo risco de vazamento cross-tenant do Passo 3, numa
   tabela nova). Reconciliação de entrega incerta (`"enviando"` com
   lease expirado) vira alerta manual na Fase 1, não reenvio automático
   — falta webhook de status de entrega da Meta pra fazer isso com
   segurança, fica como fast-follow.
   Ver plano de execução §Passo 1 pro desenho completo.
⚠️ Escopo real (8 cenários Make, não 1) é maior que o assumido
   originalmente — plano precisa ser fatiado em fases já reconhecendo isso

### Neutras

🔄 `WHATSAPP_TOKEN` global compartilhado é mantido por ora (paridade, não
   regressão) — segredo por igreja é decisão futura, não bloqueante

## Alternativas Consideradas

### 1. Manter o Make e só melhorar observabilidade
❌ **Rejeitada**: não resolve custo nem ponto de falha externo; toda a
lógica de negócio já está no Supabase, o Make não agrega nada.

### 2. Migrar tudo de uma vez (todos os 8 cenários numa PR)
❌ **Rejeitada**: viola o guardrail de "1 fase = 1 PR"; o escopo real só
foi descoberto validando blueprint por blueprint — cenários ainda não
exportados (Liturgia, check-in geo) não podem entrar numa PR sem
validação prévia.

### 3. Fase 1 cobrindo só o cenário "Waba Chatbot" (triagem + financeiro)
✅ **Escolhida**: é o único cenário com export real completo e
correspondência 1:1 confirmada contra o código nesta sessão. Escalas,
Feelings e o restante entram como fases seguintes, com este ADR servindo
de modelo de investigação (exportar → comparar contra código → só depois
decidir).

### 4. `pgmq` (Supabase Queues) em vez de lease/fencing hand-rolled
❌ **Rejeitada por ora, registrada por transparência** (achado real de
`/code-review ultra` local, PR #133 — a extensão nunca tinha sido
avaliada nas ~28 rodadas de review anteriores, que só endureceram o
mecanismo hand-rolled sem questionar a base). `pgmq` (extensão mantida,
já disponível no Postgres do Supabase) cobre boa parte do que o dedup
por `wamid` reimplementa manualmente: `pgmq.read` com visibility timeout
≈ claim com `lease_until`, `pgmq.set_vt` ≈ heartbeat de renovação,
`pgmq.archive`/`delete` ≈ marcar `completed`. Não foi escolhida porque
(a) o mecanismo hand-rolled já passou por ~28 rodadas de review
adversarial e está bem verificado especificamente pros dois eixos de
concorrência deste domínio (dedup por `wamid` E lock por CONVERSA — dois
recursos diferentes que `pgmq` sozinho não modela, já que é uma fila
genérica, não um lock por chave arbitrária), e trocar de mecanismo nesta
fase jogaria fora essa verificação; (b) o modo de pooling de conexão do
Supabase (PgBouncer transaction mode) quebra locks de sessão Postgres
mantidos entre statements (`pg_advisory_lock`/`FOR UPDATE` fora de uma
única transação) — plausivelmente o motivo original de ter escolhido
lease numa tabela de dados em vez de um lock nativo, embora este motivo
nunca tivesse sido escrito explicitamente até agora. Fast-follow real:
avaliar `pgmq` especificamente pro lock de CONVERSA (que É uma fila,
diferente do dedup por `wamid`) numa sessão dedicada, fora do escopo
desta fase.

### 5. Tabela normalizada de entregas em vez de array JSONB por `wamid`
❌ **Rejeitada por ora, mesma razão da alternativa 4** (achado real de
`/code-review ultra` local, PR #133): `chatbot_result` como
`[{alvo,payload,status}]` exige `jsonb_set` condicionado por índice pra
claim atômico por item (ver plano §Passo 1, item de dedup #4) — uma
tabela `wamid_entregas` (1 linha por item) seria mais simples de manter
atômica e ganharia `FOR UPDATE SKIP LOCKED` de graça. Não escolhida
porque hoje só existem 2 itens fixos por `wamid` (membro/pastor) — o
ganho de uma tabela normalizada é proporcional ao número de itens e ao
quanto a lógica de claim json cresce; reavaliar se um fluxo futuro
precisar de mais de ~2-3 destinatários por mensagem.

## Implementação

Ver plano de execução detalhado em
[`docs/automacoes/PLANO_REMOCAO_MAKE_WHATSAPP.md`](../automacoes/PLANO_REMOCAO_MAKE_WHATSAPP.md).

### Escopo desta primeira fase

- Nova function `supabase/functions/whatsapp-webhook/index.ts`, com
  dedupe por `wamid` (fencing por `owner_token`, lease de 120s,
  retry-de-envio sem reinvocar chatbot). **Não** resolve mídia via
  Graph — repassa `media_id` cru (`url_anexo`/`media_id`); os
  chatbots já resolvem com `WHATSAPP_API_TOKEN`. Rota interna
  `{action: "reclaim"}` autenticada via Vault
  (`cron_service_role_key`) no **caller** (pg_cron) **e** Bearer
  `SUPABASE_SERVICE_ROLE_KEY` **dentro** da function (Decisão 7 —
  `verify_jwt=false` faz o gateway não checar) + job `pg_cron` pra
  leases `queued`/`processing` expirados; `request_payload` = body
  exato do chatbot persistido no enqueue (`filial_id`/`wamid`
  inclusos); no dequeue injeta o `owner_token` **do lock de
  conversa** (não o da row de `wamid`). FIFO: quem completa um
  `wamid` drena o próximo da conversa na mesma request; `queued`
  tenta dequeue se o lock está livre.
- `chatbot-triagem`/`chatbot-financeiro` recebem `wamid` **e, quando
  o caller é a `whatsapp-webhook`, `owner_token` do lock de
  conversa** como campos de entrada novos: claim de idempotência na
  **entrada** das duas functions (não só no write de ledger/`fin_*`)
  e revalidação do lock antes de cada write em `atendimentos_bot`
  **só se `owner_token` veio no body** (Make na janela pré-cutover
  não manda esse campo — exigir quebraria produção; ver plano
  §Passo 1). Único ponto onde a Fase 1 toca lógica de negócio
  existente, e só o mínimo necessário.
- Fechamento de `chatbot-triagem` e `chatbot-financeiro` (secret fail-closed)
- Confirmação (ou seed) da row de `whatsapp_numeros` do número de
  triagem `745419461981790` com `igreja_id` preenchido — bloqueio de
  cutover; lookup por `phone_number_id` e fail-closed se faltar tenant
- Fix do `notificar_admin` via template `igreja_alerta_lider` (segunda
  mensagem ao pastor, `to` = `telefone_admin_destino`)
- Migration restringindo a policy de SELECT de `edge_function_logs` a
  `super_admin` + projeção sem payload na query de lista de
  `EdgeFunctionMonitoring.tsx` (fecha vazamento cross-tenant confirmado)
- Atualização de `docs/automacoes/catalogo-automacoes.md` marcando o
  scenario "Waba Chatbot - OakOS" como desativado (não apagado) após corte

## Validação

### Cenários de teste (antes de trocar a URL no Meta Business Manager)

1. ⬜ Handshake `GET` de verificação isolado
2. ⬜ POST sintético com assinatura válida/inválida (`X-Hub-Signature-256`)
3. ⬜ Roteamento pelos dois `phone_number_id` reais (financeiro / triagem)
4. ⬜ Resposta de `chatbot-triagem` com `qr_image` no payload → envia
   imagem, não texto
5. ⬜ `SOLICITACAO_PASTORAL` → confirma segunda mensagem chega ao pastor
   (valida o fix do bug, não só a paridade). **Cobrir também o 2º
   produtor de `notificar_admin: true`** (achado real de `/code-review`
   local, P1, 25ª rodada): forçar falha técnica de IA (timeout/erro
   HTTP do provedor) e confirmar que `erro_ia: true` NÃO dispara o
   template `igreja_alerta_lider` — só o branch `SOLICITACAO_PASTORAL`
   (sem `erro_ia`) dispara
6. ⬜ Continuidade de sessão/contexto entre mensagens
7. ⬜ Isolamento multi-número (mensagem no número financeiro não vaza pra
   triagem e vice-versa)
8. ⬜ Reenvio do mesmo `wamid` (Meta redelivery simulado) → processado só
   uma vez. **Com 2 sessões reais concorrentes de verdade** (achado
   real de `@codex review`, P1, 8ª rodada — rodar a 2ª entrega só depois
   da 1ª terminar é simulação sequencial, não testa a claim atômica/
   fencing sob colisão de verdade; já é guardrail existente do projeto
   — CLAUDE.md §Testing de SQL: "concorrência exige 2 sessões psql de
   verdade, não simulação sequencial"), com sub-casos: **disputa
   simultânea pela claim original → a 2ª entrega recebe 5xx, NÃO 200**
   (achado real de `@codex review`, P1, 11ª rodada — corrigindo o
   próprio texto deste cenário, que ainda pedia 200 depois do desenho
   ter mudado pra 5xx nesse caso exato na 5ª rodada; só devolve 200
   quando o `wamid` já está `completed` de verdade), takeover de lease
   expirado, e entrega parcial com 2 destinatários (membro OK, pastor
   falha) sob concorrência.
9. ⬜ Duas mensagens (`wamid` diferentes, com conteúdo distinguível que
   muda estado, ex.: dois passos sequenciais de um fluxo financeiro)
   da MESMA conversa entregues em paralelo, a mais antiga pelo
   timestamp da Meta chegando por último na corrida de rede →
   **valida ordem real (A processada antes de B), não só exclusão
   mútua** (achado real de `@codex review`, P1, 10ª rodada — um mutex
   simples passaria um teste que só checasse "rodou em série", mesmo
   processando B antes de A; o teste precisa afirmar a ordem final do
   estado, não só ausência de concorrência), **incluindo o caso de
   timestamp igual da Meta** (achado real de `@codex review`, P1, 11ª
   rodada — granularidade de segundo permite empate; valida que a
   sequência de chegada, não só o `timestamp`, decide a ordem)
10. ⬜ Payload de imagem/documento (pro número financeiro) e áudio (pro
    número de triagem) no formato bruto real da Meta (só `id` do
    anexo, sem URL) → `whatsapp-webhook` repassa o `id` cru como
    `url_anexo`/`media_id` SEM chamar a Graph API ela mesma (achado
    real de `@codex review`, P2, 13ª rodada, **corrigido na 28ª**:
    versões anteriores deste cenário assumiam que a `whatsapp-webhook`
    precisava resolver `media_id` → URL antes de chamar
    `chatbot-financeiro` — na verdade `chatbot-financeiro` já resolve
    um `media_id` cru sozinha, `resolverMediaUrl`
    [`chatbot-financeiro/index.ts:111-149`], então basta repassar o
    `id` bruto; ver plano de execução §Passo 1). Confirmar que
    `chatbot-financeiro` baixa o anexo usando `WHATSAPP_API_TOKEN`
    (não `WHATSAPP_TOKEN`, que a `whatsapp-webhook` usa só pra
    resposta de saída — Decisão 5) e que a transcrição de áudio em
    `chatbot-triagem` continua funcionando com `media_id` cru. **Exercitar
    com `WHATSAPP_TOKEN` e `WHATSAPP_API_TOKEN` configurados como
    valores DIFERENTES** (achado real de `@codex review`, P1, 24ª
    rodada — se os dois tokens coincidirem em ambiente de teste por
    acaso, um bug de token errado dentro de `chatbot-financeiro`/
    `chatbot-triagem` passa despercebido; o teste só prova algo se os
    valores divergirem de propósito)
11. ⬜ Renovação de heartbeat falha durante processamento (`UPDATE` do
    lease afeta 0 linhas porque outro worker já reclamou) → a invocação
    **do chatbot** aborta sem persistir sessão/`atendimentos_bot` (409
    após fencing interno com `owner_token`), e o orquestrador não envia
    Graph. Não basta o orquestrador pular o envio: as mutações de sessão
    acontecem noutro isolate HTTP (achado real de `@codex review`, P1,
    24ª rodada, reaberto no `/code-review` local da 26ª).
12. ⬜ Replay do mesmo `wamid` num turno financeiro que SÓ muta sessão
    (ex.: `"1"` em `TRANSFERENCIA_AGUARDANDO_CONTA_ORIGEM` →
    `TRANSFERENCIA_AGUARDANDO_CONFIRMACAO`, `chatbot-financeiro/index.ts:
    2349-2360`) → a 2ª entrega devolve o cache da 1ª e **não** avança
    pra seleção de destino (`:2416-2432`). Sem claim na entrada, a
    unicidade de ledger não cobre esse passo (achado real de `@codex
    review`, P1, 26ª rodada).
13. ⬜ Payload no `phone_number_id` de triagem `745419461981790` resolve
    `igreja_id` concreto (row em `whatsapp_numeros` com tenant
    preenchido) e grava sessão/pedido **com** esse tenant. Payload no
    mesmo formato com `phone_number_id` desconhecido **não** cria
    sessão com `igreja_id = NULL` — 5xx, sem insert (achado real de
    `@codex review`, P1, 26ª rodada). Confirmar a row de produção
    antes do cutover; ver plano §Passo 1.
14. ⬜ `wamid` fica `queued`/`processing` com lease expirado e NENHUMA
    nova requisição HTTP toca esse `wamid` de novo (sem redelivery da
    Meta simulado) → o job `pg_cron` de reclaim (Decisão 7) encontra a
    row na próxima varredura e reinvoca pela rota interna de reclaim
    (Vault `cron_service_role_key`, sem assinatura Meta), usando o
    `request_payload` persistido no enqueue — sem depender de
    nenhuma requisição HTTP nova da Meta (achado real de `/code-review ultra`
    local, PR #133 — nenhum cenário anterior exercita reclaim sem
    tráfego HTTP tocando o `wamid`; todos os cenários de lease/
    redelivery acima simulam uma NOVA entrega da Meta como gatilho, o
    que mascara justamente a lacuna que este cenário fecha). **Também
    confirmar o negativo**: row `enviando` com lease expirado NÃO é
    reenviada pelo sweep.
15. ⬜ POST em `chatbot-triagem`/`chatbot-financeiro` **sem** `x-webhook-
    secret` (ou com valor errado), depois do corte (Passo 2 completo)
    → 401, sem processar (achado real de `/code-review ultra` local,
    PR #133: nenhum cenário anterior exercita o gate fail-closed em si
    — o cenário 2 testa a assinatura EXTERNA Meta→`whatsapp-webhook`,
    não esse gate INTERNO `whatsapp-webhook`→chatbots; uma regressão
    que reabrisse o fail-open original passaria despercebida por todos
    os 14 cenários acima).
16. ⬜ POST em `chatbot-triagem`/`chatbot-financeiro` com `x-webhook-
    secret` válido mas **sem** `owner_token` (simulando o Make na
    janela pré-cutover, Passo 2) → processa normalmente, sem cair no
    409 de revalidação de lock (achado real de `/code-review ultra`
    local, PR #133: o plano trata isso como risco reconhecido — mesmo
    padrão do bug do `wamid` ausente achado na 25ª rodada — mas nenhum
    cenário confirma o comportamento; uma regressão que passasse a
    exigir `owner_token` incondicionalmente derrubaria produção real
    ainda em trânsito pelo Make, sem nenhum teste acusando antes do
    deploy).
17. ⬜ POST `{action: "reclaim", wamid}` **sem** `Authorization: Bearer`
    da service_role (ou com token errado) na `whatsapp-webhook`
    (`verify_jwt=false`) → 401, sem tocar a row, sem invocar
    chatbot/Graph. POST Meta sem `X-Hub-Signature-256` válida
    continua 401 **mesmo se o JSON tiver `action: "reclaim"`** —
    o campo `action` sozinho não pula o HMAC (achado real de
    `/code-review` local, PR #133, 30ª rodada: o cenário 14 exercita
    o reclaim *autenticado* pelo cron; o cenário 2 exercita HMAC na
    rota Meta; nenhum dos dois cobre o buraco em que `verify_jwt=
    false` + branch `action===reclaim` antes do HMAC vira
    backdoor público). Também: reclaim autenticado reinvoca o
    chatbot com `owner_token` **novo** (do claim de dequeue), não
    com o JSON cru de `request_payload` — payload persistido no
    enqueue não tem token; replay cru cairia no caminho Make
    (cenário 16) e pularia o fencing.
18. ⬜ Duas mensagens da mesma conversa em POSTs HTTP **separados**:
    A completa (`completed`) e B já está `queued` com lease **válido**
    (B levou 5xx enquanto A tinha o lock). Sem esperar os 15min do
    lease de espera: a request de A, **depois** de `completed`, drena
    B nessa invocação; e/ou uma redelivery/reclaim de B encontra o
    lock livre, B é cabeça da FIFO, e desenfileira — não 5xx cego.
    Também: o body do chatbot de B traz o `owner_token` do lock de
    **conversa**, e o fencing de `atendimentos_bot` afeta >0 linhas
    (não o UUID da row de `wamid`). Achado real de `/code-review`
    local, PR #133, 31ª rodada — o cenário 9 testa ordem A-antes-de-B
    sob paralelismo, mas não o liveness "B anda depois que A solta o
    lock, ainda com lease de `queued` válido"; o 5xx cego da 27ª
    passava no 9 e deixava B 15min parado no caminho feliz.

### Bake period

Acompanhar `edge_function_logs` por alguns dias de uso real (taxa de erro,
duplicidade, latência) antes de desativar o scenario do Make e revogar o
token, se aplicável.

## Referências

- [`docs/automacoes/catalogo-automacoes.md`](../automacoes/catalogo-automacoes.md)
- [`docs/automacoes/MAKE_BLUEPRINT_SETUP.md`](../automacoes/MAKE_BLUEPRINT_SETUP.md) — 5 cenários de teste originais, reaproveitados na validação
- ADR-026: Integração de Lotes com Chatbots WhatsApp
- Blueprints reais exportados 2026-08-26: "Waba Chatbot - OakOS", "Waba Escalas OakOS", "Waba Feelings OakOS" (não versionados no repo — contêm credenciais; guardar fora do controle de versão)

## Notas de Implementação

### Sobre os blueprints exportados

Os 3 arquivos `.blueprint.json` usados nesta investigação **não devem ser
commitados como estão** — o "Waba Chatbot - OakOS" carrega uma anon key em
texto plano no header `Authorization`. Se precisar versionar como
referência, redigir o segredo antes.

### `docs/automacoes/make-whatsapp-chatbots-blueprint.json` está desatualizado

Esse arquivo no repo é exemplo/placeholder, não reflete a topologia real
(assume `gateway:CustomWebHook` + `consultar-sessao` + rota
`inscricao-compartilhe` que não existem no cenário de produção
validado). Substituir ou marcar como histórico na Fase 1.

---

**Última Atualização**: 2026-08-28 (31ª rodada — `/code-review` da FIFO)
**Próxima Revisão**: Depois da Fase 1 em produção, antes de iniciar a Fase 2
