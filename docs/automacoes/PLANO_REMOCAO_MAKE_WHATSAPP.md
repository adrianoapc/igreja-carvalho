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
- [ ] Resolve `igreja_id`/`filial_id` e destino via `phone_number_id` do
  payload — **não** por palavra-chave (roteamento real do Make é por
  número, confirmado no export; não existe lógica de keyword).
- [ ] Roteia pros dois números reais: `1031291743394274` →
  `chatbot-financeiro`, `745419461981790` → `chatbot-triagem`.
- [ ] Normaliza a resposta na camada de orquestração: `chatbot-financeiro`
  retorna `.data.text`, `chatbot-triagem` retorna `.data.reply_message` —
  os dois formatos precisam virar uma única forma antes de montar a
  mensagem de saída.
- [ ] Replica a detecção de substring `"QR code"` na resposta de
  `chatbot-triagem` pra decidir entre mensagem de texto e imagem
  (`image.link` a partir de `qr_image` no payload de retorno).
- [ ] **Corrige** (não replica) o `notificar_admin`: quando
  `chatbot-triagem` retornar `notificar_admin: true`, dispara de fato a
  segunda mensagem ao telefone do pastor responsável. Hoje isso não
  acontece em produção — é bug conhecido, ver ADR-033 §Bugs conhecidos.
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
- [ ] Estender `EdgeFunctionMonitoring.tsx` com dialog de detalhe por
  linha (reaproveitar padrão `<details><pre>` de `IntegracaoLogsDialog.tsx`)
  pra ver `request_payload`/`response_payload` sem sair da tela.

### Passo 4 — Corte (cutover)

- [ ] Deployar e testar isoladamente handshake `GET` + POST sintético,
  antes de tocar em qualquer configuração do Meta.
- [ ] Rodar os 7 cenários de teste da ADR-033 (§Validação) contra a nova
  função.
- [ ] Trocar a URL do webhook no Meta Business Manager (de Make pra
  Supabase) — **sem apagar** o scenario "Waba Chatbot - OakOS" no Make,
  só desligar (rollback de 1 clique).
- [ ] Acompanhar `edge_function_logs` por alguns dias de uso real: taxa de
  erro, duplicidade, latência.
- [ ] Só então desativar de fato o scenario no Make e revogar token, se
  aplicável.
- [ ] Marcar "Waba Chatbot - OakOS" como desativado em
  `docs/automacoes/catalogo-automacoes.md`.
- [ ] Substituir ou marcar como histórico `docs/automacoes/
  make-whatsapp-chatbots-blueprint.json` (não reflete a topologia real).

### Fora de escopo da Fase 1 (fast-follows)

- Bug do branch `whatsapp_meta` morto em `disparar-alerta/index.ts`
  (variável `config` indefinida) — fluxo diferente, PR própria.
- Migrar `WHATSAPP_TOKEN` global pra segredo criptografado por igreja —
  só necessário com múltiplas contas WhatsApp Business reais.
- Tabela de dedupe por `message_id` (wamid) — só se duplicidade for
  observada de fato no bake period; dedupe atual (5s por conteúdo) segue
  como está.
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
  `MAKE_WEBHOOK_URL`/`MAKE_WEBHOOK_SECRET`/`WEBHOOK_MAKE_ALERTA_EMOCIONAL`
  nem de linhas `tipo LIKE 'make_%'`/`'whatsapp_make'` na tabela
  `webhooks`, a menos que explicitamente mantidas por decisão registrada.
- `docs/automacoes/catalogo-automacoes.md` refletir o estado final (o que
  foi migrado, o que foi removido, o que foi mantido e por quê).
