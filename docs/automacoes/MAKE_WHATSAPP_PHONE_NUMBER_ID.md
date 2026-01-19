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

## 📦 Exemplo Completo de Fluxo Make

### Módulo 1: Watch WhatsApp Messages
**Trigger:** Webhook do Meta/WhatsApp
**Saídas:**
- `metadata.phone_number_id` → `123456789012345`
- `metadata.display_phone_number` → `5517999999999`
- `messages[].from` → `5517988888888`
- `messages[].text.body` → `"reembolso"`

### Módulo 2: HTTP Request → chatbot-financeiro
**Método:** POST
**URL:** `https://[PROJECT].supabase.co/functions/v1/chatbot-financeiro`
**Headers:**
- `Authorization: Bearer [ANON_KEY]`
- `Content-Type: application/json`

**Body:**
```json
{
  "telefone": "5517988888888",
  "nome_perfil": "João Silva",
  "mensagem": "reembolso",
  "tipo": "text",
  "origem_canal": "whatsapp",
  "phone_number_id": "123456789012345",
  "display_phone_number": "5517999999999"
}
```

### Módulo 3: Parse JSON Response
**Input:** `{{2.data}}`
**Mapeamento:**
- `text` → Mensagem de resposta do bot
- `notificar_admin` → Flag booleana (opcional)

### Módulo 4: Send WhatsApp Message
**Método:** POST
**URL:** `https://graph.facebook.com/v18.0/123456789012345/messages`
**Headers:**
- `Authorization: Bearer [WABA_TOKEN]`
- `Content-Type: application/json`

**Body:**
```json
{
  "messaging_product": "whatsapp",
  "to": "5517988888888",
  "type": "text",
  "text": {
    "body": "{{3.text}}"
  }
}
```

---

## ✅ Checklist de Validação

- [ ] `phone_number_id` está sendo capturado do webhook
- [ ] `phone_number_id` está sendo enviado no body para os 3 chatbots
- [ ] `display_phone_number` está sendo enviado como fallback
- [ ] Resposta WhatsApp usa o `phone_number_id` correto no campo `from`
- [ ] Testado com 2 números diferentes da mesma igreja
- [ ] Sessões permanecem isoladas por número (sem colisões)

---

## 🐛 Troubleshooting

### Problema: Sessão não encontrada
**Causa:** `phone_number_id` não está sendo enviado ou está `null`
**Solução:** Verificar mapeamento no módulo HTTP e garantir que o campo existe no webhook

### Problema: Resposta enviada pelo número errado
**Causa:** Campo `from` no Send Message não está usando `metadata.phone_number_id`
**Solução:** Usar `{{metadata.phone_number_id}}` em vez de um ID fixo

### Problema: Conversas misturadas entre números
**Causa:** `phone_number_id` diferente entre requisições
**Solução:** Garantir que o mesmo `phone_number_id` seja usado durante toda a conversa

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
