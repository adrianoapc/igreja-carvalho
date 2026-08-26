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
  - `tipo_mensagem` ← `value.messages[].type`
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
  - **Filtra eventos que não são mensagem** — a Meta também manda
    webhooks de status (`statuses[]`: sent/delivered/read), sem
    `messages[]` nenhum. Detectar e responder 200 sem rotear pra
    nenhuma function, senão a extração acima falha silenciosamente.
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
  nullable).

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
  2. **Lease generoso o bastante pra cobrir o pior caso, não 30s**
     (achado real de `@codex review`, P1, 4ª rodada: `chatbot-triagem`
     sozinha já permite até 30s só na chamada de IA, fora sessão/DB e o
     envio Graph depois — um lease de 30s deixa uma entrega concorrente
     reclamar uma row que ainda está sendo processada de verdade,
     recriando a duplicidade que o lease deveria evitar). Usar
     `lease_until=now()+120s` como piso da Fase 1; ajustar com dado real
     de latência no bake period. Renovação periódica do lease durante
     processamento longo fica como fast-follow.
  3. Depois que o chatbot responde: grava `chatbot_result` e
     `status=chatbot_done` (condicionado ao `owner_token`) ANTES de
     tentar o envio via Graph.
  4. **Toda entrada nova reclamando um `wamid` existente precisa agir
     conforme o status encontrado** (achado real de `@codex review`, P1,
     4ª rodada — a versão anterior tratava `chatbot_done` igual a
     `completed`, respondendo 200 sem fazer nada; como a Meta para de
     reentregar depois de um 200, isso perde a mensagem pra sempre se o
     envio original tinha falhado):
     - `completed` → responde 200, não faz nada (já entregue de verdade).
     - `chatbot_done` (lease ainda válido ou expirado, tanto faz) →
       **retenta só o envio Graph** usando `chatbot_result` já
       persistido — não invoca o chatbot de novo — depois marca
       `completed`.
     - `processing` com lease válido e dono diferente do meu →
       responde 200, não faz nada (outra entrega concorrente já está
       cuidando).
  5. **Idempotência não pode viver só no orquestrador** (achado real de
     `@codex review`, P1, 4ª rodada: se a resposta HTTP do chatbot se
     perder na rede, ou a `whatsapp-webhook` cair entre receber a
     resposta e gravar `chatbot_done`, o lease depois reclama
     `processing` e invoca o chatbot de novo — mas ele já pode ter
     comprometido a operação financeira/sessão na 1ª tentativa cuja
     resposta se perdeu; o orquestrador sozinho não tem como saber
     disso). Propagar `wamid` como campo de entrada pra
     `chatbot-triagem`/`chatbot-financeiro`, e cada uma delas checar
     (de forma leve, atômica, junto do próprio commit do efeito
     colateral) se já processou esse `wamid` antes de repetir a
     operação — pequena mudança de contrato de entrada + 1 check de
     idempotência interno, não reescrita de lógica de negócio.

  O dedupe de 5s por conteúdo que já existe dentro de `chatbot-triagem`
  fica como está (defesa em profundidade adicional), mas não é
  suficiente sozinho pros motivos acima.
- [ ] Envia a resposta via Graph API copiando o padrão de
  `send-otp/index.ts` (`WHATSAPP_TOKEN` + `phone_number_id` via
  `whatsapp_numeros`).
- [ ] Registra a execução via `log_edge_function_with_metrics` (RPC já
  existente) e responde 200 rápido pra Meta.

### Passo 2 — Fechar os endpoints hoje abertos

- [ ] `chatbot-triagem`: adicionar validação `x-webhook-secret`
  fail-closed contra `MAKE_WEBHOOK_SECRET` (hoje não valida nada).
- [ ] `chatbot-financeiro`: trocar de fail-open pra fail-closed no mesmo
  segredo (hoje só loga aviso se a env var estiver ausente).
- [ ] Confirmar que só a nova `whatsapp-webhook` vai chamar essas duas
  depois do corte — nenhum outro caller externo.

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
- [ ] Rodar os 8 cenários de teste da ADR-033 (§Validação — inclui o
  reenvio de `wamid` simulado, achado de `@codex review`) contra a nova
  função.
- [ ] Trocar a URL do webhook no Meta Business Manager (de Make pra
  Supabase) — **sem apagar** o scenario "Waba Chatbot - OakOS" no Make,
  só desligar.
- [ ] Acompanhar `edge_function_logs` por alguns dias de uso real: taxa de
  erro, duplicidade, latência.
- [ ] Só então desativar de fato o scenario no Make — **e antes de
  revogar qualquer token, confirmar que não é o mesmo `WHATSAPP_TOKEN`
  que a `whatsapp-webhook` está usando pra responder** (achado real de
  `@codex review`, P2: a Decisão 5 da ADR-033 reaproveita de propósito
  o token global já existente — se for o MESMO token que o Make usa
  hoje, revogar quebra as respostas da função nova também, não só o
  Make). Se for compartilhado, ou mantém como está (não revoga nada), ou
  primeiro rotaciona a `whatsapp-webhook` pra um token distinto e só
  depois revoga o antigo.

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
   ainda recebem tráfego real (checar `edge_function_logs` por
   invocações recentes). Se zero invocações nos últimos ~60 dias,
   remover como código morto — `chatbot-triagem` já cobre o caso de uso.
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
