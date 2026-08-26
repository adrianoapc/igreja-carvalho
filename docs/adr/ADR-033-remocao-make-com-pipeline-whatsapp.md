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
recentemente (achado real de `@codex review`, 2ª rodada).

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

### 7. Escalas e Feelings ficam pra Fase 2; Liturgia/geo/pedido/testemunho pra Fase 3

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
   corromper `atendimentos_bot` (sem lock hoje). Tabela de dedupe/
   entrega é acesso `service_role`-only, sem SELECT via PostgREST pra
   ninguém (mesmo risco de vazamento cross-tenant do Passo 3, numa
   tabela nova). Reconciliação de entrega incerta (`"enviando"` com
   lease expirado) vira alerta manual na Fase 1, não reenvio automático
   — falta webhook de status de entrega da Meta pra fazer isso com
   segurança, fica como fast-follow.
   Ver plano de execução §Passo 1 pro desenho completo.
⚠️ Escopo real (6+ cenários Make, não 1) é maior que o assumido
   originalmente — plano precisa ser fatiado em fases já reconhecendo isso

### Neutras

🔄 `WHATSAPP_TOKEN` global compartilhado é mantido por ora (paridade, não
   regressão) — segredo por igreja é decisão futura, não bloqueante

## Alternativas Consideradas

### 1. Manter o Make e só melhorar observabilidade
❌ **Rejeitada**: não resolve custo nem ponto de falha externo; toda a
lógica de negócio já está no Supabase, o Make não agrega nada.

### 2. Migrar tudo de uma vez (todos os 6+ cenários numa PR)
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

## Implementação

Ver plano de execução detalhado em
[`docs/automacoes/PLANO_REMOCAO_MAKE_WHATSAPP.md`](../automacoes/PLANO_REMOCAO_MAKE_WHATSAPP.md).

### Escopo desta primeira fase

- Nova function `supabase/functions/whatsapp-webhook/index.ts`, com
  dedupe por `wamid` (fencing por `owner_token`, lease de 120s,
  retry-de-envio sem reinvocar chatbot) e resolução de mídia via Graph
  API antes de repassar pro `chatbot-financeiro`
- `chatbot-triagem`/`chatbot-financeiro` recebem `wamid` como campo de
  entrada novo e checam idempotência própria antes de comprometer
  efeito colateral (único ponto onde a Fase 1 toca lógica de negócio
  existente, e só o mínimo necessário)
- Fechamento de `chatbot-triagem` e `chatbot-financeiro` (secret fail-closed)
- Fix do `notificar_admin` via template `igreja_alerta_lider` (segunda
  mensagem ao pastor)
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
   (valida o fix do bug, não só a paridade)
6. ⬜ Continuidade de sessão/contexto entre mensagens
7. ⬜ Isolamento multi-número (mensagem no número financeiro não vaza pra
   triagem e vice-versa)
8. ⬜ Reenvio do mesmo `wamid` (Meta redelivery simulado) → processado só
   uma vez, segunda entrega recebe 200 sem rotear de novo. **Com 2
   sessões reais concorrentes de verdade** (achado real de `@codex
   review`, P1, 8ª rodada — rodar a 2ª entrega só depois da 1ª terminar
   é simulação sequencial, não testa a claim atômica/fencing sob
   colisão de verdade; já é guardrail existente do projeto — CLAUDE.md
   §Testing de SQL: "concorrência exige 2 sessões psql de verdade, não
   simulação sequencial" — este cenário só não seguia isso ainda), com
   sub-casos: disputa simultânea pela claim original, takeover de lease
   expirado, e entrega parcial com 2 destinatários (membro OK, pastor
   falha) sob concorrência.
9. ⬜ Duas mensagens (`wamid` diferentes) da MESMA conversa entregues em
   paralelo → processadas em série, não concorrentemente (valida o
   lock por conversa, achado de `@codex review`, 8ª rodada — eixo de
   concorrência diferente do item 8)

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

**Última Atualização**: 2026-08-26
**Próxima Revisão**: Depois da Fase 1 em produção, antes de iniciar a Fase 2
