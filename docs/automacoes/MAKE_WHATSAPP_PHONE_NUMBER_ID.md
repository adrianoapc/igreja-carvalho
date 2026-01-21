# Ajustes no Blueprint Make.com para phone_number_id

## 📋 Contexto

Os chatbots WhatsApp agora escopam sessões por `phone_number_id` para evitar colisões entre conversas iniciadas por diferentes números da mesma igreja. Este documento explica os ajustes necessários no blueprint Make.com.

---

## 🎯 O que mudou

### Antes
Sessões eram filtradas apenas por:
- `telefone` (contato do usuário)
- `origem_canal` (ex: "whatsapp")
- `igreja_id`

**Problema:** Se a mesma pessoa enviasse mensagem para dois números diferentes da igreja, a sessão poderia ser compartilhada/sobrescrita.

### Agora
Sessões são filtradas também por:
- `phone_number_id` (ID único do número de envio no WhatsApp Business)

**Solução:** Cada conversa fica isolada por número de origem, garantindo continuidade correta.

---

## 🔧 Ajustes Necessários no Make

### 🎯 Contexto do seu Blueprint

Baseado no blueprint que você compartilhou, sua estrutura atual é:

```
Watch WhatsApp Events → BasicRouter → HTTP Request (3 rotas) → Parse JSON → Send WhatsApp Message
```

**Rota 1:** Triagem (Pastoral) → `chatbot-triagem`  
**Rota 2:** Financeiro (Reembolso/Conta) → `chatbot-financeiro`  
**Rota 3:** Compartilhe (Inscrições) → `inscricao-compartilhe`

### O que você perguntou:
> "Como posso garantir que eu devolvo a resposta no caminho certo e para o telefone certo? E quando a pessoa responder ele volte na rota que iniciou?"

**Resposta:** Com os ajustes abaixo! 👇

---

### 1. Capturar `phone_number_id` do Webhook WhatsApp

No módulo **Watch WhatsApp Messages** ou equivalente, o webhook do Meta/WhatsApp envia o seguinte payload:

```json
{
  "entry": [
    {
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [
        {
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {
              "display_phone_number": "5517999999999",
              "phone_number_id": "123456789012345"  ← ESTE CAMPO
            },
            "contacts": [
              {
                "profile": { "name": "Nome do Contato" },
                "wa_id": "5517988888888"
              }
            ],
            "messages": [
              {
                "from": "5517988888888",
                "id": "wamid.xxx",
                "timestamp": "1737316800",
                "text": { "body": "Olá" },
                "type": "text"
              }
            ]
          }
        }
      ]
    }
  ]
}
```

**Caminho no Make:**
- `metadata.phone_number_id` → ID único do número de envio
- `metadata.display_phone_number` → Número formatado (ex: 5517999999999)

---

### 2. Mapear campos no módulo HTTP (Request to Edge Functions)

Nos módulos HTTP que enviam payload para:
- `chatbot-triagem`
- `chatbot-financeiro`
- `inscricao-compartilhe`

**Adicione os seguintes campos no body:**

```json
{
  "telefone": "{{messages[].from}}",
  "nome_perfil": "{{contacts[].profile.name}}",
  "mensagem": "{{messages[].text.body}}",
  "tipo": "{{messages[].type}}",
  "origem_canal": "whatsapp",
  
  // ✅ NOVOS CAMPOS OBRIGATÓRIOS:
  "phone_number_id": "{{metadata.phone_number_id}}",
  "display_phone_number": "{{metadata.display_phone_number}}",
  
  // Opcional (para facilitar resolução de igreja/filial):
  "whatsapp_number": "{{metadata.display_phone_number}}"
}
```

---

### 3. Retornar resposta pelo número correto

No módulo **Send WhatsApp Message** (resposta ao usuário), use:

**Para (To):**
```
{{messages[].from}}
```

**De (From / Phone Number ID):**
```
{{metadata.phone_number_id}}
```

Isso garante que a resposta retorna pelo mesmo número que recebeu a mensagem.

---

## 📦 Exemplo Completo de Fluxo Make (Baseado no seu Blueprint)

### Módulo 1: Watch WhatsApp Events (Webhook)
**Trigger:** Webhook do Meta/WhatsApp Business Cloud API
**Saídas disponíveis:**
- `entry[].changes[].value.metadata.phone_number_id` → `123456789012345` (ID do número que recebeu)
- `entry[].changes[].value.metadata.display_phone_number` → `5517999999999` (Número formatado)
- `entry[].changes[].value.messages[].from` → `5517988888888` (Contato do usuário)
- `entry[].changes[].value.messages[].text.body` → `"reembolso"` (Mensagem)
- `entry[].changes[].value.messages[].type` → `"text"` (Tipo)
- `entry[].changes[].value.contacts[].profile.name` → `"João Silva"` (Nome)

**⚠️ IMPORTANTE:** Salve `phone_number_id` em uma variável para usar no roteamento e resposta.

---

### Módulo 2: Router (BasicRouter)
**Função:** Rotear para o edge function correto baseado em:
- Conteúdo da mensagem (keywords)
- Sessão existente em `atendimentos_bot`
- Estado do fluxo (meta_dados)

**Filtros de rota:**

#### Rota 1: Triagem (Pastoral)
**Condição:** Mensagem contém "oração", "pastor", "testemunho" OU sessão ativa com `origem_canal = 'whatsapp'`

#### Rota 2: Financeiro
**Condição:** Mensagem contém "reembolso", "conta", "nota" OU sessão ativa com `origem_canal = 'whatsapp_financeiro'`

#### Rota 3: Compartilhe (Inscrição)
**Condição:** Mensagem contém "compartilhe", "inscrição" OU sessão ativa com `origem_canal = 'whatsapp_compartilhe'`

---

### Módulo 3a: HTTP Request → chatbot-triagem
**Método:** POST
**URL:** `https://[PROJECT].supabase.co/functions/v1/chatbot-triagem`
**Headers:**
- `Authorization: Bearer [ANON_KEY]`
- `Content-Type: application/json`

**Body:**
```json
{
  "telefone": "{{1.entry[].changes[].value.messages[].from}}",
  "nome_perfil": "{{1.entry[].changes[].value.contacts[].profile.name}}",
  "conteudo_texto": "{{1.entry[].changes[].value.messages[].text.body}}",
  "tipo_mensagem": "{{1.entry[].changes[].value.messages[].type}}",
  "origem_canal": "whatsapp",
  "phone_number_id": "{{1.entry[].changes[].value.metadata.phone_number_id}}",
  "display_phone_number": "{{1.entry[].changes[].value.metadata.display_phone_number}}"
}
```

### Módulo 3b: HTTP Request → chatbot-financeiro
**Body:**
```json
{
  "telefone": "{{1.entry[].changes[].value.messages[].from}}",
  "nome_perfil": "{{1.entry[].changes[].value.contacts[].profile.name}}",
  "mensagem": "{{1.entry[].changes[].value.messages[].text.body}}",
  "tipo": "{{1.entry[].changes[].value.messages[].type}}",
  "origem_canal": "whatsapp_financeiro",
  "phone_number_id": "{{1.entry[].changes[].value.metadata.phone_number_id}}",
  "display_phone_number": "{{1.entry[].changes[].value.metadata.display_phone_number}}"
}
```

### Módulo 3c: HTTP Request → inscricao-compartilhe
**Body:**
```json
{
  "telefone": "{{1.entry[].changes[].value.messages[].from}}",
  "nome_perfil": "{{1.entry[].changes[].value.contacts[].profile.name}}",
  "mensagem": "{{1.entry[].changes[].value.messages[].text.body}}",
  "tipo_mensagem": "{{1.entry[].changes[].value.messages[].type}}",
  "origem_canal": "whatsapp_compartilhe",
  "phone_number_id": "{{1.entry[].changes[].value.metadata.phone_number_id}}",
  "display_phone_number": "{{1.entry[].changes[].value.metadata.display_phone_number}}"
}
```

---

### Módulo 4: Parse JSON Response
**Input:** `{{3.data}}` (do HTTP Request)
**Mapeamento:**
- `reply_message` ou `text` → Mensagem de resposta do bot
- `notificar_admin` → Flag booleana (opcional)
- `telefone_admin_destino` → Telefone admin (opcional)

**💡 Padronização de resposta:**
Todos os edges agora retornam `{ text: "mensagem" }` ou `{ reply_message: "mensagem" }`.
Use `{{4.text}}` ou `{{4.reply_message}}` (fallback com coalescência).

---

### Módulo 5: Send WhatsApp Message (Resposta ao usuário)
**Método:** POST
**URL:** `https://graph.facebook.com/v18.0/{{1.entry[].changes[].value.metadata.phone_number_id}}/messages`

**⚠️ CRÍTICO:** Use o `phone_number_id` da mensagem **RECEBIDA** (módulo 1), não um ID fixo!

**Headers:**
- `Authorization: Bearer [WABA_TOKEN]`
- `Content-Type: application/json`

**Body:**
```json
{
  "messaging_product": "whatsapp",
  "to": "{{1.entry[].changes[].value.messages[].from}}",
  "type": "text",
  "text": {
    "body": "{{4.text or 4.reply_message}}"
  }
}
```

**Resultado:** Resposta é enviada **pelo mesmo número que recebeu** a mensagem original.

---

### Módulo 6 (Opcional): Notificar Admin via WhatsApp
**Condição:** `{{4.notificar_admin}} = true`
**URL:** `https://graph.facebook.com/v18.0/{{1.entry[].changes[].value.metadata.phone_number_id}}/messages`
**Body:**
```json
{
  "messaging_product": "whatsapp",
  "to": "{{4.telefone_admin_destino}}",
  "type": "text",
  "text": {
    "body": "🔔 Nova solicitação pastoral de {{1.entry[].changes[].value.contacts[].profile.name}}"
  }
}
```

---

## ✅ Checklist de Validação

### Configuração Inicial
- [ ] Webhook do WhatsApp Business Cloud API está ativo e recebendo eventos
- [ ] Token de acesso (WABA_TOKEN) está válido e não expirado
- [ ] Supabase ANON_KEY está configurada nos módulos HTTP

### Captura de Dados (Módulo 1: Watch Events)
- [ ] `entry[].changes[].value.metadata.phone_number_id` está disponível
- [ ] `entry[].changes[].value.metadata.display_phone_number` está disponível
- [ ] `entry[].changes[].value.messages[].from` captura telefone do usuário
- [ ] `entry[].changes[].value.contacts[].profile.name` captura nome do usuário

### Roteamento (Módulo 2: Router)
- [ ] Filtros de rota por keyword funcionam (testar "reembolso", "oração", "inscrição")
- [ ] Router consulta `atendimentos_bot` para sessões ativas (opcional mas recomendado)
- [ ] Fallback para rota padrão (triagem) quando nenhum filtro bate

### Envio para Edge Functions (Módulos 3a/b/c)
- [ ] `phone_number_id` está sendo enviado no body JSON
- [ ] `display_phone_number` está sendo enviado no body JSON
- [ ] `origem_canal` está diferenciado por rota (`whatsapp`, `whatsapp_financeiro`, `whatsapp_compartilhe`)
- [ ] Headers incluem `Authorization` e `Content-Type`

### Resposta ao Usuário (Módulo 5: Send Message)
- [ ] URL usa `phone_number_id` dinâmico (não fixo)
- [ ] Campo `to` usa `messages[].from` (telefone do usuário)
- [ ] Campo `text.body` usa resposta do edge function (`{{4.text}}` ou `{{4.reply_message}}`)
- [ ] Resposta chega no WhatsApp do usuário pelo número correto

### Testes de Integração
- [ ] Testado com 2 números diferentes da mesma igreja
- [ ] Sessões permanecem isoladas por `phone_number_id` (verificar em `atendimentos_bot`)
- [ ] Continuidade de fluxo: mensagens subsequentes mantêm contexto
- [ ] Teste de colisão: mesmo usuário conversa com Número A e Número B simultaneamente

### Monitoramento
- [ ] Logs do Make.com sem erros (HTTP 200 em todos os módulos)
- [ ] Logs dos edge functions sem erros: `supabase functions logs <nome-da-funcao>`
- [ ] Sessões em `atendimentos_bot` têm `meta_dados.phone_number_id` populado
- [ ] Webhook do WhatsApp não está sendo bloqueado (verificar no Meta Business)

---

## 🐛 Troubleshooting

### Problema: Sessão não encontrada ou duplicada
**Causa:** `phone_number_id` não está sendo enviado ou está `null`
**Solução:** 
1. Verificar se o módulo 1 (Watch Events) está capturando `metadata.phone_number_id`
2. Garantir que o mapeamento usa `{{1.entry[].changes[].value.metadata.phone_number_id}}`
3. Verificar se o edge function está recebendo o campo (logs no Supabase)

### Problema: Resposta enviada pelo número errado
**Causa:** URL do Send Message usa ID fixo em vez de `phone_number_id` dinâmico
**Solução:** 
- URL deve ser: `https://graph.facebook.com/v18.0/{{1.entry[].changes[].value.metadata.phone_number_id}}/messages`
- **NÃO use:** `https://graph.facebook.com/v18.0/123456789012345/messages` (ID fixo)

### Problema: Conversas misturadas entre números
**Causa:** Usuário conversa com Número A, depois com Número B, mas sessão continua a mesma
**Solução:** 
1. Confirmar que `phone_number_id` **diferente** está sendo enviado em cada requisição
2. Verificar em `atendimentos_bot` se `meta_dados` contém `phone_number_id` correto
3. Testar limpando sessões antigas: `UPDATE atendimentos_bot SET status = 'CONCLUIDO' WHERE telefone = '5517988888888'`

### Problema: Router não direciona corretamente
**Causa:** Sessão existe mas com `phone_number_id` diferente, router não encontra
**Solução:**
1. Adicionar fallback no Router: se não encontrar sessão ativa, rotear por keyword
2. Implementar consulta à `atendimentos_bot` ANTES do Router para decidir rota
3. Passar `origem_canal` atual da sessão para o Router decidir

### Problema: Edge function retorna erro 400
**Causa:** Campos obrigatórios faltando ou formato incorreto
**Solução:**
1. Verificar logs do edge function: `supabase functions logs chatbot-triagem`
2. Confirmar que `telefone`, `nome_perfil` e `phone_number_id` estão presentes
3. Testar payload diretamente via Postman/Insomnia antes de integrar no Make

### Problema: Continuidade de fluxo quebrada após resposta
**Causa:** Sessão foi finalizada prematuramente ou `phone_number_id` mudou
**Solução:**
1. Não finalizar sessão (`status = 'CONCLUIDO'`) até fluxo completo
2. Manter `phone_number_id` consistente em todas as mensagens da conversa
3. Verificar se webhook está enviando `phone_number_id` em TODAS as mensagens (não só a primeira)

---

## 🔄 Continuidade de Rota: Como Garantir que a Pessoa Volte na Rota Correta

### Problema
Se o usuário inicia uma conversa de **reembolso** (rota financeiro), depois para e retoma no dia seguinte, como garantir que ele volte na mesma rota?

### Solução: Consulta de Sessão ANTES do Router

#### Opção 1: Router Inteligente com Filtro de Sessão (Recomendado)

**Adicionar módulo antes do Router:**

**Módulo 1.5: HTTP Request → Consultar Sessão Ativa**
```
POST https://[PROJECT].supabase.co/rest/v1/atendimentos_bot?select=*&telefone=eq.{{1.messages[].from}}&status=neq.CONCLUIDO&order=updated_at.desc&limit=1
```

**Headers:**
- `Authorization: Bearer [SUPABASE_ANON_KEY]`
- `apikey: [SUPABASE_ANON_KEY]`
- `Content-Type: application/json`

**Resultado:** Retorna sessão ativa (se existir) com `origem_canal` e `meta_dados.phone_number_id`

**Ajustar Router:**

**Filtro Rota 1 (Triagem):**
```
{{1.5.origem_canal}} = "whatsapp" 
AND {{1.5.meta_dados.phone_number_id}} = {{1.metadata.phone_number_id}}

OU (se não há sessão):
{{1.messages[].text.body}} contains "oração" OR "pastor" OR "testemunho"
```

**Filtro Rota 2 (Financeiro):**
```
{{1.5.origem_canal}} = "whatsapp_financeiro" 
AND {{1.5.meta_dados.phone_number_id}} = {{1.metadata.phone_number_id}}

OU (se não há sessão):
{{1.messages[].text.body}} contains "reembolso" OR "conta" OR "nota"
```

**Filtro Rota 3 (Compartilhe):**
```
{{1.5.origem_canal}} = "whatsapp_compartilhe" 
AND {{1.5.meta_dados.phone_number_id}} = {{1.metadata.phone_number_id}}

OU (se não há sessão):
{{1.messages[].text.body}} contains "inscrição" OR "compartilhe"
```

#### Opção 2: Edge Function Resolve o Roteamento (Mais Simples)

Deixe o Router apenas com filtros por keyword e permita que os próprios edge functions gerenciem a sessão:

1. Edge function recebe a mensagem
2. Busca sessão ativa por `telefone + origem_canal + phone_number_id`
3. Se encontrar, continua o fluxo
4. Se não encontrar e keyword bater, cria nova sessão
5. Se não encontrar e keyword não bater, retorna "Não entendi, digite 'menu' para opções"

**Vantagem:** Menos lógica no Make, mais controle no backend.

---

## 🔐 Garantindo Resposta pelo Número Correto

### Cenário de Teste

**Setup:**
- Número A: `5517999999999` (Matriz) → `phone_number_id: 123456`
- Número B: `5517888888888` (Filial) → `phone_number_id: 789012`

**Fluxo:**

1. Usuário (`5517911111111`) envia "reembolso" para **Número A**
   - Make captura: `metadata.phone_number_id = 123456`
   - Edge function recebe: `phone_number_id: "123456"`
   - Sessão criada: `meta_dados.phone_number_id = "123456"`
   - Resposta enviada via: `POST /123456/messages`
   - ✅ Usuário recebe pelo **Número A**

2. Usuário envia "sim" (continua conversa)
   - Make captura: `metadata.phone_number_id = 123456` (mesmo número)
   - Edge function busca sessão: `telefone + origem_canal + phone_number_id = "123456"`
   - ✅ Encontra sessão ativa, continua contexto
   - Resposta enviada via: `POST /123456/messages`
   - ✅ Usuário recebe pelo **Número A** (continuidade mantida)

3. Usuário envia "inscrição" para **Número B** (conversa paralela)
   - Make captura: `metadata.phone_number_id = 789012` (número diferente!)
   - Edge function busca sessão: `telefone + origem_canal + phone_number_id = "789012"`
   - ❌ Não encontra (porque a sessão de reembolso tem `phone_number_id = "123456"`)
   - Cria NOVA sessão: `meta_dados.phone_number_id = "789012"`
   - Resposta enviada via: `POST /789012/messages`
   - ✅ Usuário recebe pelo **Número B** (sem colisão!)

**Resultado:** Duas conversas simultâneas, isoladas por `phone_number_id`.

---

## 📊 Validação em Banco de Dados

Após implementar, valide em `atendimentos_bot`:

```sql
SELECT 
  telefone,
  origem_canal,
  status,
  meta_dados->>'phone_number_id' as numero_origem,
  meta_dados->>'display_phone_number' as numero_display,
  created_at,
  updated_at
FROM atendimentos_bot
WHERE telefone = '5517911111111'
  AND status != 'CONCLUIDO'
ORDER BY updated_at DESC;
```

**Esperado:**
| telefone | origem_canal | status | numero_origem | numero_display | created_at |
|----------|--------------|--------|---------------|----------------|------------|
| 5517911111111 | whatsapp_financeiro | EM_ANDAMENTO | 123456 | 5517999999999 | 2026-01-19 10:00 |
| 5517911111111 | whatsapp_compartilhe | EM_ANDAMENTO | 789012 | 5517888888888 | 2026-01-19 10:05 |

✅ Duas sessões diferentes, sem conflito!

---

## 📚 Referências

- Edge Functions:
  - `supabase/functions/chatbot-triagem/index.ts` (linha 208-220)
  - `supabase/functions/chatbot-financeiro/index.ts` (linha 264-275)
  - `supabase/functions/inscricao-compartilhe/index.ts` (linha 28-58)
  
- Documentação Meta WhatsApp:
  - [Webhook Payload Structure](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples)
  - [Send Message API](https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages)

---

## 📝 Changelog

**19 Jan/2026:** Documento criado com instruções de ajuste para escopo por `phone_number_id`.
